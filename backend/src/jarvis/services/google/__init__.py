from .token_store import GoogleTokenStore
from .gmail import GmailService
from .calendar import CalendarService
from .drive import DriveService


class GoogleServiceBundle:
    """Container for all three Google services, shared by ActionEngine."""

    def __init__(self, db_path: str, client_id: str, client_secret: str) -> None:
        self.token_store = GoogleTokenStore(db_path=db_path)
        self.gmail = GmailService(self.token_store, client_id, client_secret)
        self.calendar = CalendarService(self.token_store, client_id, client_secret)
        self.drive = DriveService(self.token_store, client_id, client_secret)


__all__ = ["GoogleServiceBundle", "GoogleTokenStore", "GmailService", "CalendarService", "DriveService"]
