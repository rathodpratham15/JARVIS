"""Google Drive service — list, create, move files."""
from __future__ import annotations
import io, logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .token_store import GoogleTokenStore

logger = logging.getLogger(__name__)

NOT_CONNECTED = "Google Drive is not connected. Please connect your Google account in Settings."


class DriveService:
    def __init__(self, token_store: "GoogleTokenStore", client_id: str, client_secret: str) -> None:
        self._store = token_store
        self._client_id = client_id
        self._client_secret = client_secret

    def _build(self, user_id: str):
        from googleapiclient.discovery import build
        creds = self._store.get_credentials(user_id, self._client_id, self._client_secret)
        if creds is None:
            return None
        return build("drive", "v3", credentials=creds, cache_discovery=False)

    def list_files(self, user_id: str, query: str = "", max_results: int = 20) -> "list[dict] | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            q = f"name contains '{query}' and trashed=false" if query else "trashed=false"
            resp = svc.files().list(
                q=q,
                pageSize=max_results,
                fields="files(id, name, mimeType, modifiedTime, size, webViewLink)",
                orderBy="modifiedTime desc",
            ).execute()
            return [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "type": f.get("mimeType", ""),
                    "modified": f.get("modifiedTime", ""),
                    "size": f.get("size", ""),
                    "link": f.get("webViewLink", ""),
                }
                for f in resp.get("files", [])
            ]
        except Exception as exc:
            logger.error("Drive list_files error: %s", exc)
            return f"Drive error: {exc}"

    def create_file(self, user_id: str, name: str, content: str = "",
                    mime_type: str = "text/plain") -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            from googleapiclient.http import MediaIoBaseUpload
            metadata = {"name": name}
            media = MediaIoBaseUpload(io.BytesIO(content.encode()), mimetype=mime_type)
            f = svc.files().create(
                body=metadata, media_body=media,
                fields="id, name, webViewLink"
            ).execute()
            return {"id": f["id"], "name": f["name"], "link": f.get("webViewLink", "")}
        except Exception as exc:
            logger.error("Drive create_file error: %s", exc)
            return f"Drive error: {exc}"

    def rename_file(self, user_id: str, file_id: str, new_name: str) -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            f = svc.files().update(
                fileId=file_id, body={"name": new_name},
                fields="id, name, webViewLink"
            ).execute()
            return {"id": f["id"], "name": f["name"], "link": f.get("webViewLink", "")}
        except Exception as exc:
            logger.error("Drive rename_file error: %s", exc)
            return f"Drive error: {exc}"

    def move_file(self, user_id: str, file_id: str, folder_id: str) -> "dict | str":
        svc = self._build(user_id)
        if svc is None:
            return NOT_CONNECTED
        try:
            f = svc.files().get(fileId=file_id, fields="parents").execute()
            previous_parents = ",".join(f.get("parents", []))
            updated = svc.files().update(
                fileId=file_id,
                addParents=folder_id,
                removeParents=previous_parents,
                fields="id, name, webViewLink"
            ).execute()
            return {"id": updated["id"], "name": updated["name"], "link": updated.get("webViewLink", "")}
        except Exception as exc:
            logger.error("Drive move_file error: %s", exc)
            return f"Drive error: {exc}"
