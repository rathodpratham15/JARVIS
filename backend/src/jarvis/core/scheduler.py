"""Autonomous scheduling — run agent goals on a recurring schedule.

JARVIS can proactively execute goals (search, summarise, save notes, etc.)
without being asked each time. Jobs are persisted to SQLite and survive
restarts.

Schedule expression syntax (case-insensitive):
    "every 30 minutes"
    "every 2 hours"
    "every 3 days"
    "every day at 09:00"
    "every day at 8:30am"
    "every monday at 10:00"
    "every friday at 17:00"

Usage::

    sched = Scheduler(task_manager, db_path="data/scheduler.db")
    job_id = sched.add("Morning briefing", "search web for today's tech news and save a note", "every day at 08:00")
    sched.start()   # call once; runs background thread
"""

from __future__ import annotations

import contextlib
import logging
import re
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

import schedule as _sched

if TYPE_CHECKING:
    from jarvis.core.task_manager import TaskManager

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    goal        TEXT NOT NULL,
    schedule_expr TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    last_run    TEXT,
    run_count   INTEGER NOT NULL DEFAULT 0,
    last_result TEXT,
    last_status TEXT
);
"""

_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@dataclass
class ScheduledJob:
    id: str
    name: str
    goal: str
    schedule_expr: str
    enabled: bool
    created_at: str
    last_run: Optional[str] = None
    run_count: int = 0
    last_result: Optional[str] = None
    last_status: Optional[str] = None
    _schedule_job: object = field(default=None, repr=False, compare=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "goal": self.goal,
            "schedule_expr": self.schedule_expr,
            "enabled": self.enabled,
            "created_at": self.created_at,
            "last_run": self.last_run,
            "run_count": self.run_count,
            "last_result": self.last_result,
            "last_status": self.last_status,
        }


def _normalize_time(t: str) -> str:
    """Convert '8:30am' or '17:00' to 'HH:MM' understood by the schedule lib."""
    t = t.strip().lower()
    m = re.match(r"(\d{1,2}):(\d{2})(am|pm)?", t)
    if not m:
        return "09:00"
    hour, minute, period = int(m.group(1)), m.group(2), m.group(3)
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute}"


def _register(scheduler: _sched.Scheduler, expr: str, fn) -> object:
    """Parse a human-readable schedule expression and register fn on scheduler."""
    s = expr.lower().strip()

    m = re.match(r"every (\d+) minutes?$", s)
    if m:
        return scheduler.every(int(m.group(1))).minutes.do(fn)

    m = re.match(r"every (\d+) hours?$", s)
    if m:
        return scheduler.every(int(m.group(1))).hours.do(fn)

    m = re.match(r"every (\d+) days?$", s)
    if m:
        return scheduler.every(int(m.group(1))).days.do(fn)

    m = re.match(r"every day at (.+)$", s)
    if m:
        return scheduler.every().day.at(_normalize_time(m.group(1))).do(fn)

    for day in _WEEKDAYS:
        m = re.match(rf"every {day}(?: at (.+))?$", s)
        if m:
            time_s = _normalize_time(m.group(1)) if m.group(1) else "09:00"
            return getattr(scheduler.every(), day).at(time_s).do(fn)

    raise ValueError(
        f"Unrecognised schedule expression: {expr!r}. "
        "Try: 'every 30 minutes', 'every day at 09:00', 'every monday at 10:00'."
    )


class Scheduler:
    """SQLite-backed autonomous job scheduler."""

    def __init__(
        self,
        task_manager: "TaskManager",
        db_path: str = "data/scheduler.db",
        max_steps: int = 8,
    ) -> None:
        self._tm = task_manager
        self._db_path = db_path
        self._max_steps = max_steps
        self._scheduler = _sched.Scheduler()
        self._jobs: dict[str, ScheduledJob] = {}
        self._lock = threading.RLock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._init_db()
        self._load_jobs()

    # ── public API ─────────────────────────────────────────────────────

    def add(self, name: str, goal: str, schedule_expr: str, enabled: bool = True) -> str:
        """Create and persist a new scheduled job. Returns its id."""
        # Validate expression before persisting
        dummy = _sched.Scheduler()
        _register(dummy, schedule_expr, lambda: None)  # raises ValueError if invalid

        job_id = str(uuid.uuid4())
        job = ScheduledJob(
            id=job_id,
            name=name,
            goal=goal,
            schedule_expr=schedule_expr,
            enabled=enabled,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._save(job)
        with self._lock:
            self._jobs[job_id] = job
            if enabled:
                self._attach(job)
        logger.info("Scheduled job %s added: %r (%s)", job_id, name, schedule_expr)
        return job_id

    def remove(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job is None:
            return False
        if job._schedule_job is not None:
            self._scheduler.cancel_job(job._schedule_job)
        self._delete(job_id)
        return True

    def set_enabled(self, job_id: str, enabled: bool) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return False
        job.enabled = enabled
        if enabled:
            if job._schedule_job is None:
                self._attach(job)
        else:
            if job._schedule_job is not None:
                self._scheduler.cancel_job(job._schedule_job)
                job._schedule_job = None
        self._save(job)
        return True

    def trigger(self, job_id: str) -> Optional[str]:
        """Run a job immediately (outside its schedule). Returns task_id or None."""
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return None
        return self._submit(job)

    def get(self, job_id: str) -> Optional[ScheduledJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def list_all(self) -> list[dict]:
        with self._lock:
            return [j.to_dict() for j in sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)]

    def start(self) -> None:
        """Start the background scheduler thread (idempotent)."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="jarvis-scheduler")
        self._thread.start()
        logger.info("Autonomous scheduler started (%d jobs loaded)", len(self._jobs))

    # ── internal ───────────────────────────────────────────────────────

    def _loop(self) -> None:
        import time
        while self._running:
            self._scheduler.run_pending()
            time.sleep(1)

    def _submit(self, job: ScheduledJob) -> str:
        task_id = self._tm.submit(job.goal, max_steps=self._max_steps)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            job.last_run = now
            job.run_count += 1
            job.last_result = task_id
            job.last_status = "submitted"
        self._save(job)
        logger.info("Scheduler fired job %r → task %s", job.name, task_id)
        return task_id

    def _attach(self, job: ScheduledJob) -> None:
        """Register job on the schedule lib scheduler."""
        try:
            sj = _register(self._scheduler, job.schedule_expr, lambda j=job: self._submit(j))
            job._schedule_job = sj
        except ValueError as exc:
            logger.error("Cannot register job %s: %s", job.id, exc)

    # ── persistence ────────────────────────────────────────────────────

    @contextlib.contextmanager
    def _connect(self):
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    def _load_jobs(self) -> None:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM scheduled_jobs").fetchall()
        for row in rows:
            job = ScheduledJob(
                id=row["id"],
                name=row["name"],
                goal=row["goal"],
                schedule_expr=row["schedule_expr"],
                enabled=bool(row["enabled"]),
                created_at=row["created_at"],
                last_run=row["last_run"],
                run_count=row["run_count"] or 0,
                last_result=row["last_result"],
                last_status=row["last_status"],
            )
            self._jobs[job.id] = job
            if job.enabled:
                self._attach(job)

    def _save(self, job: ScheduledJob) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO scheduled_jobs
                    (id, name, goal, schedule_expr, enabled, created_at,
                     last_run, run_count, last_result, last_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job.id, job.name, job.goal, job.schedule_expr,
                    int(job.enabled), job.created_at, job.last_run,
                    job.run_count, job.last_result, job.last_status,
                ),
            )

    def _delete(self, job_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM scheduled_jobs WHERE id = ?", (job_id,))
