from jarvis.core.memory import Memory


def test_store_and_recall(tmp_path):
    mem = Memory(db_path=tmp_path / "memory.db")
    mem.store_interaction("hello", "hi there", intent_type="greeting")
    recent = mem.recent()
    assert len(recent) == 1
    assert recent[0]["user_input"] == "hello"
    assert recent[0]["response"] == "hi there"
    assert recent[0]["intent_type"] == "greeting"


def test_recent_returns_oldest_first(tmp_path):
    mem = Memory(db_path=tmp_path / "memory.db")
    mem.store_interaction("first", "1")
    mem.store_interaction("second", "2")
    mem.store_interaction("third", "3")
    recent = mem.recent(limit=10)
    assert [r["user_input"] for r in recent] == ["first", "second", "third"]


def test_recent_limit(tmp_path):
    mem = Memory(db_path=tmp_path / "memory.db")
    for i in range(5):
        mem.store_interaction(f"q{i}", f"a{i}")
    assert len(mem.recent(limit=3)) == 3


def test_search_substring(tmp_path):
    mem = Memory(db_path=tmp_path / "memory.db")
    mem.store_interaction("what is python", "a programming language")
    mem.store_interaction("what is rust", "another language")
    mem.store_interaction("hello", "hi")
    results = mem.search("python")
    assert len(results) == 1
    assert "python" in results[0]["user_input"]


def test_count_and_clear(tmp_path):
    mem = Memory(db_path=tmp_path / "memory.db")
    assert mem.count() == 0
    mem.store_interaction("hi", "hello")
    assert mem.count() == 1
    mem.clear()
    assert mem.count() == 0


def test_tags_round_trip(tmp_path):
    mem = Memory(db_path=tmp_path / "memory.db")
    mem.store_interaction("hi", "hi", tags=["greeting", "casual"])
    assert mem.recent()[0]["tags"] == ["greeting", "casual"]
