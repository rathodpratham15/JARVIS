import textwrap
from pathlib import Path

from jarvis.plugins import BasePlugin, PluginManager, PluginManifest


def _write_plugin(directory: Path, filename: str, body: str) -> None:
    (directory / filename).write_text(textwrap.dedent(body))


def test_discover_loads_plugins(tmp_path):
    _write_plugin(
        tmp_path,
        "echo_plugin.py",
        """
        from jarvis.plugins import BasePlugin, PluginManifest
        class EchoPlugin(BasePlugin):
            def get_manifest(self):
                return PluginManifest(name="echo", keywords=["echo"], priority=50)
            def run(self, query, **kw):
                return f"echo: {query}"
        """,
    )
    manager = PluginManager(plugins_dir=tmp_path)
    manager.discover()
    assert "echo" in manager.plugins


def test_dispatch_returns_none_for_no_match(tmp_path):
    manager = PluginManager(plugins_dir=tmp_path)
    manager.discover()
    assert manager.dispatch("anything") is None


def test_dispatch_picks_highest_priority(tmp_path):
    _write_plugin(
        tmp_path,
        "low.py",
        """
        from jarvis.plugins import BasePlugin, PluginManifest
        class LowPlugin(BasePlugin):
            def get_manifest(self):
                return PluginManifest(name="low", keywords=["foo"], priority=10)
            def run(self, q, **kw): return "low won"
        """,
    )
    _write_plugin(
        tmp_path,
        "high.py",
        """
        from jarvis.plugins import BasePlugin, PluginManifest
        class HighPlugin(BasePlugin):
            def get_manifest(self):
                return PluginManifest(name="high", keywords=["foo"], priority=99)
            def run(self, q, **kw): return "high won"
        """,
    )
    manager = PluginManager(plugins_dir=tmp_path)
    manager.discover()
    assert manager.dispatch("please foo") == "high won"


def test_set_enabled_skips_dispatch(tmp_path):
    _write_plugin(
        tmp_path,
        "p.py",
        """
        from jarvis.plugins import BasePlugin, PluginManifest
        class P(BasePlugin):
            def get_manifest(self):
                return PluginManifest(name="p", keywords=["bar"])
            def run(self, q, **kw): return "ran"
        """,
    )
    manager = PluginManager(plugins_dir=tmp_path)
    manager.discover()
    assert manager.dispatch("bar baz") == "ran"
    assert manager.set_enabled("p", False) is True
    assert manager.dispatch("bar baz") is None


def test_broken_plugin_does_not_crash_discovery(tmp_path):
    _write_plugin(tmp_path, "broken.py", "this is not valid python ===")
    _write_plugin(
        tmp_path,
        "good.py",
        """
        from jarvis.plugins import BasePlugin, PluginManifest
        class Good(BasePlugin):
            def get_manifest(self):
                return PluginManifest(name="good")
            def run(self, q, **kw): return "ok"
        """,
    )
    manager = PluginManager(plugins_dir=tmp_path)
    manager.discover()
    assert "good" in manager.plugins
    assert "broken" not in manager.plugins


def test_list_returns_manifest_dicts(tmp_path):
    _write_plugin(
        tmp_path,
        "p.py",
        """
        from jarvis.plugins import BasePlugin, PluginManifest
        class P(BasePlugin):
            def get_manifest(self):
                return PluginManifest(name="p", version="2.0", keywords=["x"])
            def run(self, q, **kw): return "ok"
        """,
    )
    manager = PluginManager(plugins_dir=tmp_path)
    manager.discover()
    listing = manager.list()
    assert any(item["name"] == "p" and item["version"] == "2.0" for item in listing)


def test_can_handle_default_uses_keywords(tmp_path):
    class P(BasePlugin):
        def get_manifest(self):
            return PluginManifest(name="t", keywords=["alpha", "beta"])
        def run(self, q, **kw): return ""

    plugin = P()
    assert plugin.can_handle("the alpha test")
    assert plugin.can_handle("BETA something")
    assert not plugin.can_handle("nothing here")
