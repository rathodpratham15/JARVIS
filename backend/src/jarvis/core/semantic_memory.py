"""Semantic (vector) search layer on top of the existing SQLite memory.

Stores a 384-dim embedding for every interaction using
`all-MiniLM-L6-v2` (runs fully local, ~80 MB, no API key needed).
Falls back silently if the model can't be loaded or sqlite-vec isn't
installed — callers always get *something* back.

Usage::

    from jarvis.core.semantic_memory import SemanticMemory
    sem = SemanticMemory(db_path="data/memory.db")
    sem.index_interaction(interaction_id, user_input)
    results = sem.search("remind me about the arc reactor", limit=5)
"""

from __future__ import annotations

import logging
import sqlite3
import struct
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

logger = logging.getLogger(__name__)

_DIMS = 384
_MODEL_NAME = "all-MiniLM-L6-v2"


def _encode_vec(v: list[float]) -> bytes:
    """Pack a float list into the little-endian binary format sqlite-vec expects."""
    return struct.pack(f"{len(v)}f", *v)


class SemanticMemory:
    """Vector index stored in the same SQLite file as the interactions table."""

    def __init__(self, db_path: str | Path = "data/memory.db") -> None:
        self.db_path = Path(db_path)
        self._lock = threading.RLock()
        self._model = self._load_model()
        if self._model:
            self._init_vec_table()

    # ── initialisation ─────────────────────────────────────────────────────

    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(_MODEL_NAME)
            logger.info("SemanticMemory: loaded %s", _MODEL_NAME)
            return model
        except Exception as exc:
            logger.warning("SemanticMemory: could not load model — %s", exc)
            return None

    def _init_vec_table(self) -> None:
        with self._connect() as conn:
            self._load_vec_extension(conn)
            conn.execute(
                f"CREATE VIRTUAL TABLE IF NOT EXISTS interaction_vecs "
                f"USING vec0(embedding float[{_DIMS}])"
            )
            conn.execute(
                "CREATE TABLE IF NOT EXISTS vec_id_map "
                "(rowid INTEGER PRIMARY KEY, interaction_id TEXT NOT NULL)"
            )
            conn.commit()

    @staticmethod
    def _load_vec_extension(conn: sqlite3.Connection) -> None:
        try:
            import sqlite_vec
            conn.enable_load_extension(True)
            sqlite_vec.load(conn)
            conn.enable_load_extension(False)
        except Exception as exc:
            raise RuntimeError(f"sqlite-vec not available: {exc}") from exc

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    # ── public API ─────────────────────────────────────────────────────────

    @property
    def available(self) -> bool:
        return self._model is not None

    def index_interaction(self, interaction_id: str, text: str) -> None:
        """Embed `text` and insert it into the vector index."""
        if not self._model:
            return
        try:
            vec = self._model.encode(text).tolist()
            with self._lock, self._connect() as conn:
                self._load_vec_extension(conn)
                conn.execute(
                    "INSERT INTO vec_id_map (interaction_id) VALUES (?)",
                    (interaction_id,),
                )
                rowid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                conn.execute(
                    "INSERT INTO interaction_vecs (rowid, embedding) VALUES (?, ?)",
                    (rowid, _encode_vec(vec)),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("SemanticMemory.index_interaction failed: %s", exc)

    def search(self, query: str, limit: int = 5) -> list[dict]:
        """Return up to `limit` interactions most semantically similar to `query`.

        Each result is a dict with keys from the `interactions` table plus
        a `similarity` float (0–1, higher = more similar).
        Returns an empty list if the model or extension isn't available.
        """
        if not self._model:
            return []
        try:
            vec = self._model.encode(query).tolist()
            with self._lock, self._connect() as conn:
                self._load_vec_extension(conn)
                rows = conn.execute(
                    """
                    SELECT
                        m.interaction_id,
                        v.distance
                    FROM interaction_vecs v
                    JOIN vec_id_map m ON m.rowid = v.rowid
                    WHERE v.embedding MATCH ?
                      AND k = ?
                    ORDER BY v.distance ASC
                    """,
                    (_encode_vec(vec), limit),
                ).fetchall()

                if not rows:
                    return []

                ids = [r["interaction_id"] for r in rows]
                dist_map = {r["interaction_id"]: r["distance"] for r in rows}

                placeholders = ",".join("?" * len(ids))
                interactions = conn.execute(
                    f"SELECT * FROM interactions WHERE id IN ({placeholders})",
                    ids,
                ).fetchall()

            results = []
            for row in interactions:
                d = dict(row)
                distance = dist_map.get(d["id"], 2.0)
                # sqlite-vec returns L2 distance; MiniLM vectors are normalised
                # so cosine similarity = 1 - (L2² / 2). Clamp to [0, 1].
                d["similarity"] = round(max(0.0, min(1.0, 1.0 - (distance ** 2) / 2.0)), 4)
                results.append(d)

            # Return in similarity-descending order
            results.sort(key=lambda x: x["similarity"], reverse=True)
            return results

        except Exception as exc:
            logger.warning("SemanticMemory.search failed: %s", exc)
            return []

    def reindex_all(self, interactions: list[dict]) -> int:
        """Rebuild the vector index from a list of interaction dicts.
        Returns the number of entries indexed."""
        if not self._model:
            return 0
        count = 0
        for item in interactions:
            self.index_interaction(item["id"], item["user_input"])
            count += 1
        return count
