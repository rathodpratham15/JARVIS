"""Tests for the action controller — confirmation flow, history, safety.

Subprocess execution is monkey-patched out so the test suite never
actually launches an application.
"""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import patch

import pytest

from jarvis.system import ActionController


def _make(tmp_path: Path) -> ActionController:
    return ActionController(
        log_path=tmp_path / "actions.jsonl",
        allowed_roots=[str(tmp_path)],
    )


def _wait_for(condition, timeout: float = 2.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(0.05)
    return False


# ── pending / approval flow ──────────────────────────────────────────


def test_open_application_starts_pending(tmp_path):
    ctrl = _make(tmp_path)
    action_id = ctrl.open_application("Calculator")
    pending = ctrl.get_pending()
    assert len(pending) == 1
    assert pending[0]["action_id"] == action_id
    assert pending[0]["status"] == "pending"


def test_confirm_unknown_action_returns_false(tmp_path):
    ctrl = _make(tmp_path)
    assert ctrl.confirm("doesnt_exist", True) is False


def test_approve_runs_and_appends_history(tmp_path):
    ctrl = _make(tmp_path)
    with patch("jarvis.system.control.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        action_id = ctrl.open_application("Calculator")
        ctrl.confirm(action_id, True)
        assert _wait_for(lambda: any(a["action_id"] == action_id for a in ctrl.get_history()[0]))
    history, _ = ctrl.get_history()
    record = next(a for a in history if a["action_id"] == action_id)
    assert record["status"] == "completed"
    mock_run.assert_called_once()


def test_deny_marks_cancelled_and_does_not_run(tmp_path):
    ctrl = _make(tmp_path)
    with patch("jarvis.system.control.subprocess.run") as mock_run:
        action_id = ctrl.open_application("Calculator")
        ctrl.confirm(action_id, False)
        assert _wait_for(lambda: any(a["action_id"] == action_id for a in ctrl.get_history()[0]))
    history, _ = ctrl.get_history()
    record = next(a for a in history if a["action_id"] == action_id)
    assert record["status"] == "cancelled"
    mock_run.assert_not_called()


# ── safety ───────────────────────────────────────────────────────────


def test_rejects_shell_metachars_in_args(tmp_path):
    ctrl = _make(tmp_path)
    with pytest.raises(ValueError, match="unsafe"):
        ctrl.open_application("App", args=["safe", "rm -rf / ; echo pwned"])


def test_rejects_blocked_system_path(tmp_path):
    ctrl = _make(tmp_path)
    with pytest.raises(PermissionError):
        ctrl.control_files("delete", "/etc/passwd")


def test_rejects_unknown_file_op(tmp_path):
    ctrl = _make(tmp_path)
    with pytest.raises(ValueError, match="Unsupported file op"):
        ctrl.control_files("burn", str(tmp_path / "x"))


def test_file_op_outside_allowed_root_is_rejected_immediately(tmp_path):
    """Safety check fires at request time, not after approval."""
    ctrl = ActionController(log_path=tmp_path / "actions.jsonl", allowed_roots=[str(tmp_path)])
    other = tmp_path.parent / "outside.txt"
    other.write_text("hello")
    try:
        with pytest.raises(PermissionError):
            ctrl.control_files("delete", str(other))
        # No pending action should be created for a rejected request.
        assert ctrl.get_pending() == []
    finally:
        if other.exists():
            other.unlink()


# ── file ops actually work inside allowed root ──────────────────────


def test_delete_and_backup(tmp_path):
    target = tmp_path / "doomed.txt"
    target.write_text("bye")
    ctrl = _make(tmp_path)
    action_id = ctrl.control_files("delete", str(target))
    ctrl.confirm(action_id, True)
    assert _wait_for(lambda: not target.exists())
    history, _ = ctrl.get_history()
    record = next(a for a in history if a["action_id"] == action_id)
    assert record["status"] == "completed"


def test_copy_file(tmp_path):
    src = tmp_path / "src.txt"
    dst = tmp_path / "dst.txt"
    src.write_text("data")
    ctrl = _make(tmp_path)
    action_id = ctrl.control_files("copy", str(src), str(dst))
    ctrl.confirm(action_id, True)
    assert _wait_for(lambda: dst.exists())
    assert dst.read_text() == "data"


# ── history pagination + delete ──────────────────────────────────────


def test_history_pagination(tmp_path):
    ctrl = _make(tmp_path)
    with patch("jarvis.system.control.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        for i in range(5):
            aid = ctrl.open_application(f"app{i}")
            ctrl.confirm(aid, True)
    assert _wait_for(lambda: ctrl.get_history()[1] >= 5)
    page, total = ctrl.get_history(limit=2, offset=0)
    assert total >= 5
    assert len(page) == 2


def test_bulk_delete(tmp_path):
    ctrl = _make(tmp_path)
    with patch("jarvis.system.control.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        ids = []
        for i in range(3):
            aid = ctrl.open_application(f"app{i}")
            ctrl.confirm(aid, True)
            ids.append(aid)
    assert _wait_for(lambda: ctrl.get_history()[1] >= 3)
    removed = ctrl.bulk_delete_history(ids[:2])
    assert removed == 2
    history, _ = ctrl.get_history()
    remaining_ids = {a["action_id"] for a in history}
    assert ids[2] in remaining_ids
    assert ids[0] not in remaining_ids


def test_send_message_returns_not_configured(tmp_path):
    ctrl = _make(tmp_path)
    aid = ctrl.send_message("whatsapp", "+15555555555", "hi")
    ctrl.confirm(aid, True)
    assert _wait_for(lambda: any(a["action_id"] == aid for a in ctrl.get_history()[0]))
    history, _ = ctrl.get_history()
    record = next(a for a in history if a["action_id"] == aid)
    assert record["status"] == "completed"
    assert record["result"]["delivered"] is False


def test_get_system_info_keys(tmp_path):
    info = ActionController.get_system_info()
    assert {"system", "release", "machine", "python", "cpu_count"} <= set(info)
