import pytest

from jarvis.core.action_engine import ActionEngine, _safe_eval


def test_safe_eval_arithmetic():
    assert _safe_eval("2 + 3") == 5
    assert _safe_eval("10 * 5 - 7") == 43
    assert _safe_eval("2 ** 8") == 256
    assert _safe_eval("15 / 4") == 3.75


def test_safe_eval_rejects_attribute_access():
    with pytest.raises((ValueError, SyntaxError, NameError)):
        _safe_eval("__import__('os')")


def test_safe_eval_rejects_function_call():
    with pytest.raises((ValueError, SyntaxError, NameError)):
        _safe_eval("open('/etc/passwd')")


def test_safe_eval_rejects_name_lookup():
    with pytest.raises((ValueError, SyntaxError, NameError)):
        _safe_eval("x + 1")


def test_calculate_returns_result():
    ae = ActionEngine()
    out = ae.execute_action({"type": "calculation", "expression": "2 + 2", "action_required": True})
    assert "4" in out


def test_joke_runs_handler_not_conversation_fallback():
    ae = ActionEngine()
    out = ae.execute_action({"type": "joke", "action_required": True})
    assert "How can I help" not in out
    assert len(out) > 10


def test_unknown_intent_falls_back_to_conversation():
    ae = ActionEngine()
    out = ae.execute_action({"type": "nonexistent_intent_xyz", "action_required": True})
    assert isinstance(out, str) and out


def test_help_returns_help_text():
    ae = ActionEngine()
    out = ae.execute_action({"type": "help", "action_required": True})
    assert "search" in out.lower()
