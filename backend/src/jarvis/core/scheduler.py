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
    "every month on the 15th"
    "every month on the 1st at 09:00"
    "every year on july 1st"
    "every year on july 1st at 9am"
    "every year on december 25th at 08:00"

Usage::

    sched = Scheduler(task_manager, db_path="data/scheduler.db")
    job_id = sched.add("Morning briefing", "search web for today's tech news and save a note", "every day at 08:00")
    job_id = sched.add("Birthday wish", "send happy birthday to +1234567890 on whatsapp", "every year on july 1st at 9am")
    sched.start()   # call once; runs background thread
"""

from __future__ import annotations

import calendar
import contextlib
import logging
import re
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
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

_MIGRATE_USER_ID  = "ALTER TABLE scheduled_jobs ADD COLUMN user_id TEXT"
_MIGRATE_NEXT_RUN = "ALTER TABLE scheduled_jobs ADD COLUMN next_run_at TEXT"

_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

_MONTHS: dict[str, int] = {
    "january": 1,   "jan": 1,
    "february": 2,  "feb": 2,
    "march": 3,     "mar": 3,
    "april": 4,     "apr": 4,
    "may": 5,
    "june": 6,      "jun": 6,
    "july": 7,      "jul": 7,
    "august": 8,    "aug": 8,
    "september": 9, "sep": 9,  "sept": 9,
    "october": 10,  "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def _normalize_time(t: str) -> str:
    """Convert '8:30am' or '17:00' to 'HH:MM' understood by the schedule lib."""
    t = t.strip().lower()
    m = re.match(r"(\d{1,2})(?::(\d{2}))?(am|pm)?", t)
    if not m:
        return "09:00"
    hour, minute, period = int(m.group(1)), m.group(2) or "00", m.group(3)
    hour = int(hour)
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute}"


def _parse_ordinal(s: str) -> int:
    """'15th' → 15, '1st' → 1, '3' → 3."""
    return int(re.sub(r"(st|nd|rd|th)$", "", s.strip()))


# ── Calendar expression helpers ───────────────────────────────────────────────

def _is_calendar_expr(expr: str) -> bool:
    s = expr.lower().strip()
    return s.startswith("every year on") or s.startswith("every month on")


def _parse_calendar(expr: str) -> dict:
    """
    Parse calendar expressions into a dict with keys:
      type  : 'yearly' | 'monthly'
      month : int (yearly only)
      day   : int
      hour  : int
      minute: int
    """
    s = expr.lower().strip()

    # "every year on <month> <day> [at <time>]"
    m = re.match(r"every year on (\w+) (\w+)(?:\s+at\s+(.+))?$", s)
    if m:
        month_name, day_str, time_str = m.group(1), m.group(2), m.group(3)
        month = _MONTHS.get(month_name)
        if month is None:
            raise ValueError(f"Unknown month: {month_name!r}")
        day = _parse_ordinal(day_str)
        hhmm = _normalize_time(time_str) if time_str else "09:00"
        hour, minute = map(int, hhmm.split(":"))
        return {"type": "yearly", "month": month, "day": day, "hour": hour, "minute": minute}

    # "every month on [the] <day> [at <time>]"
    m = re.match(r"every month on (?:the )?(\w+)(?:\s+at\s+(.+))?$", s)
    if m:
        day_str, time_str = m.group(1), m.group(2)
        day = _parse_ordinal(day_str)
        hhmm = _normalize_time(time_str) if time_str else "09:00"
        hour, minute = map(int, hhmm.split(":"))
        return {"type": "monthly", "month": None, "day": day, "hour": hour, "minute": minute}

    raise ValueError(
        f"Unrecognised calendar expression: {expr!r}. "
        "Try: 'every year on july 1st at 9am' or 'every month on the 15th at 10:00'."
    )


def _next_occurrence(cal: dict, from_dt: Optional[datetime] = None) -> datetime:
    """Compute the next UTC datetime when a calendar trigger should fire."""
    now = from_dt or datetime.now(timezone.utc)
    h, mi = cal["hour"], cal["minute"]

    if cal["type"] == "yearly":
        month, day = cal["month"], cal["day"]
        try:
            candidate = now.replace(month=month, day=day, hour=h, minute=mi, second=0, microsecond=0)
        except ValueError:
            # Clamp to last valid day (e.g., Feb 30 → Feb 28/29)
            max_day = calendar.monthrange(now.year, month)[1]
            candidate = now.replace(month=month, day=min(day, max_day), hour=h, minute=mi, second=0, microsecond=0)
        if candidate <= now:
            next_year = candidate.year + 1
            max_day = calendar.monthrange(next_year, month)[1]
            candidate = candidate.replace(year=next_year, day=min(day, max_day))
        return candidate

    else:  # monthly
        day = cal["day"]
        year, month = now.year, now.month
        max_day = calendar.monthrange(year, month)[1]
        try:
            candidate = now.replace(day=min(day, max_day), hour=h, minute=mi, second=0, microsecond=0)
        except ValueError:
            candidate = now.replace(day=max_day, hour=h, minute=mi, second=0, microsecond=0)
        if candidate <= now:
            month += 1
            if month > 12:
                year += 1
                month = 1
            max_day = calendar.monthrange(year, month)[1]
            candidate = candidate.replace(year=year, month=month, day=min(day, max_day))
        return candidate


# ── Interval expression registration (schedule lib) ──────────────────────────

def _register(scheduler: _sched.Scheduler, expr: str, fn) -> object:
    """Parse a human-readable interval/weekday expression and register fn on scheduler."""
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
        "Try: 'every 30 minutes', 'every day at 09:00', 'every monday at 10:00', "
        "'every year on july 1st at 9am', 'every month on the 15th'."
    )


# ── Data model ────────────────────────────────────────────────────────────────

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
    user_id: Optional[str] = None
    next_run_at: Optional[str] = None
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
            "user_id": self.user_id,
            "next_run_at": self.next_run_at,
        }


# ── Scheduler ─────────────────────────────────────────────────────────────────

class Scheduler:
    """SQLite-backed autonomous job scheduler with interval and calendar recurrence."""

    def __init__(
        self,
        task_manager: "TaskManager",
        db_path: str = "data/scheduler.db",
        max_steps: int = 8,
        push_service=None,
    ) -> None:
        self._tm = task_manager
        self._db_path = db_path
        self._max_steps = max_steps
        self._push_service = push_service
        self._scheduler = _sched.Scheduler()
        self._jobs: dict[str, ScheduledJob] = {}
        self._lock = threading.RLock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._init_db()
        self._load_jobs()

    # ── public API ─────────────────────────────────────────────────────

    def add(self, name: str, goal: str, schedule_expr: str,
            enabled: bool = True, user_id: Optional[str] = None) -> str:
        """Create and persist a new scheduled job. Returns its id."""
        next_run_at: Optional[str] = None

        if _is_calendar_expr(schedule_expr):
            cal = _parse_calendar(schedule_expr)   # raises ValueError if invalid
            next_run_at = _next_occurrence(cal).isoformat()
        else:
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
            user_id=user_id,
            next_run_at=next_run_at,
        )
        self._save(job)
        with self._lock:
            self._jobs[job_id] = job
            if enabled:
                self._attach(job)
        logger.info("Scheduled job %s added: %r (%s)", job_id, name, schedule_expr)
        return job_id

    def remove(self, job_id: str, user_id: Optional[str] = None) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return False
            if user_id is not None and job.user_id != user_id:
                return False
            self._jobs.pop(job_id)
        if job._schedule_job is not None:
            self._scheduler.cancel_job(job._schedule_job)
        self._delete(job_id)
        return True

    def set_enabled(self, job_id: str, enabled: bool, user_id: Optional[str] = None) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return False
        if user_id is not None and job.user_id != user_id:
            return False
        job.enabled = enabled
        if enabled:
            if job._schedule_job is None and not _is_calendar_expr(job.schedule_expr):
                self._attach(job)
        else:
            if job._schedule_job is not None:
                self._scheduler.cancel_job(job._schedule_job)
                job._schedule_job = None
        self._save(job)
        return True

    def trigger(self, job_id: str, user_id: Optional[str] = None) -> Optional[str]:
        """Run a job immediately (outside its schedule). Returns task_id or None."""
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return None
        if user_id is not None and job.user_id != user_id:
            return None
        return self._submit(job)

    def get(self, job_id: str, user_id: Optional[str] = None) -> Optional[ScheduledJob]:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            return None
        if user_id is not None and job.user_id != user_id:
            return None
        return job

    def list_all(self, user_id: Optional[str] = None) -> list[dict]:
        with self._lock:
            jobs = list(self._jobs.values())
            if user_id is not None:
                jobs = [j for j in jobs if j.user_id == user_id]
            return [j.to_dict() for j in sorted(jobs, key=lambda j: j.created_at, reverse=True)]

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
            self._check_calendar_jobs()
            time.sleep(1)

    def _check_calendar_jobs(self) -> None:
        """Fire any calendar jobs whose next_run_at has passed."""
        now = datetime.now(timezone.utc)
        with self._lock:
            candidates = [
                j for j in self._jobs.values()
                if j.enabled and j.next_run_at and _is_calendar_expr(j.schedule_expr)
            ]
        for job in candidates:
            next_dt = datetime.fromisoformat(job.next_run_at)
            if next_dt.tzinfo is None:
                next_dt = next_dt.replace(tzinfo=timezone.utc)
            if now >= next_dt:
                self._submit(job)
                cal = _parse_calendar(job.schedule_expr)
                new_next = _next_occurrence(cal, from_dt=now + timedelta(seconds=1))
                with self._lock:
                    job.next_run_at = new_next.isoformat()
                self._save_next_run_at(job)
                logger.info("Calendar job %r fired; next run at %s", job.name, job.next_run_at)

    def _submit(self, job: ScheduledJob) -> str:
        with self._lock:
            if not job.enabled:
                return ""
        task_id = self._tm.submit(job.goal, max_steps=self._max_steps)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            job.last_run = now
            job.run_count += 1
            job.last_result = None
            job.last_status = "running"
        self._save_run_start(job)
        logger.info("Scheduler fired job %r → task %s", job.name, task_id)

        threading.Thread(
            target=self._watch_task,
            args=(job, task_id),
            daemon=True,
            name=f"sched-watch-{task_id[:8]}",
        ).start()
        return task_id

    def _watch_task(self, job: ScheduledJob, task_id: str) -> None:
        """Poll the task until done, then write final status + result back to the job."""
        import time
        for _ in range(120):
            time.sleep(5)
            task = self._tm.get(task_id)
            if task is None:
                break
            if task.status.value in ("done", "failed", "cancelled"):
                if task.status.value == "done" and task.result:
                    result_text = task.result.final_answer or "Completed."
                    status_text = "done"
                elif task.error:
                    result_text = f"Error: {task.error}"
                    status_text = "failed"
                else:
                    result_text = task.status.value
                    status_text = task.status.value
                with self._lock:
                    job.last_status = status_text
                    job.last_result = result_text[:1000]
                self._save_result(job)
                logger.info("Job %r finished: status=%s result=%s",
                            job.name, status_text, result_text[:80])
                if self._push_service and job.user_id:
                    title = "Task Complete" if status_text == "done" else "Task Failed"
                    self._push_service.notify_user(
                        job.user_id, title, f"{job.name}: {result_text[:80]}"
                    )
                return
        with self._lock:
            if job.last_status == "running":
                job.last_status = "timeout"
        self._save_result(job)

    def _attach(self, job: ScheduledJob) -> None:
        """Register job on the schedule lib scheduler (interval/weekday jobs only)."""
        if _is_calendar_expr(job.schedule_expr):
            return  # calendar jobs are checked in _check_calendar_jobs
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
            for migration in (_MIGRATE_USER_ID, _MIGRATE_NEXT_RUN):
                try:
                    conn.execute(migration)
                except Exception:
                    pass

    def _load_jobs(self) -> None:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM scheduled_jobs").fetchall()
        keys = None
        for row in rows:
            if keys is None:
                keys = row.keys()
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
                user_id=row["user_id"] if "user_id" in row.keys() else None,
                next_run_at=row["next_run_at"] if "next_run_at" in row.keys() else None,
            )
            # Recompute next_run_at for calendar jobs that don't have it yet
            if _is_calendar_expr(job.schedule_expr) and not job.next_run_at:
                try:
                    cal = _parse_calendar(job.schedule_expr)
                    job.next_run_at = _next_occurrence(cal).isoformat()
                    self._save_next_run_at(job)
                except ValueError:
                    pass
            self._jobs[job.id] = job
            if job.enabled:
                self._attach(job)

    def _save(self, job: ScheduledJob) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO scheduled_jobs
                    (id, name, goal, schedule_expr, enabled, created_at,
                     last_run, run_count, last_result, last_status, user_id, next_run_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job.id, job.name, job.goal, job.schedule_expr,
                    int(job.enabled), job.created_at, job.last_run,
                    job.run_count, job.last_result, job.last_status,
                    job.user_id, job.next_run_at,
                ),
            )

    def _save_run_start(self, job: ScheduledJob) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE scheduled_jobs SET last_run=?, run_count=?, last_result=NULL, last_status='running' WHERE id=?",
                (job.last_run, job.run_count, job.id),
            )

    def _save_result(self, job: ScheduledJob) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE scheduled_jobs SET last_status=?, last_result=? WHERE id=?",
                (job.last_status, job.last_result, job.id),
            )

    def _save_next_run_at(self, job: ScheduledJob) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE scheduled_jobs SET next_run_at=? WHERE id=?",
                (job.next_run_at, job.id),
            )

    def _delete(self, job_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM scheduled_jobs WHERE id = ?", (job_id,))
