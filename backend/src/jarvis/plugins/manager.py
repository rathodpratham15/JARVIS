"""Plugin discovery, loading, and dispatch.

Replaces the legacy 22 KB `PluginManager`/`plugin_marketplace.py`/
`auth_manager.py` triple — this is ~110 lines.

Discovery: walk a directory, import each `*.py` file as a module,
instantiate every concrete `BasePlugin` subclass found.
Dispatch: highest-priority plugin whose `can_handle()` returns True wins.
"""

from __future__ import annotations

import importlib.util
import inspect
import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional

from jarvis.plugins.base import BasePlugin

logger = logging.getLogger(__name__)


class PluginManager:
    def __init__(self, plugins_dir: str | Path = "plugins") -> None:
        self.plugins_dir = Path(plugins_dir)
        self.plugins: dict[str, BasePlugin] = {}
        # Tracked here rather than on the manifest because most plugins
        # construct a fresh manifest in get_manifest() — mutating that
        # would silently no-op.
        self._enabled: dict[str, bool] = {}

    def discover(self) -> None:
        """Find and instantiate plugins under `plugins_dir`. Idempotent."""
        if not self.plugins_dir.exists():
            logger.info("No plugins directory at %s", self.plugins_dir)
            return
        for path in sorted(self.plugins_dir.glob("*.py")):
            if path.name.startswith("_"):
                continue
            self._load_file(path)

    def _load_file(self, path: Path) -> None:
        module_name = f"jarvis_plugin_{path.stem}"
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            logger.warning("Could not load %s", path)
            return
        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except Exception as exc:
            logger.exception("Plugin %s failed to import: %s", path.name, exc)
            return
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if obj is BasePlugin or not issubclass(obj, BasePlugin) or inspect.isabstract(obj):
                continue
            try:
                instance = obj()
                manifest = instance.get_manifest()
            except Exception as exc:
                logger.exception("Plugin %s failed to instantiate: %s", obj.__name__, exc)
                continue
            if manifest.name in self.plugins:
                logger.warning("Duplicate plugin name %r — skipping", manifest.name)
                continue
            self.plugins[manifest.name] = instance
            self._enabled[manifest.name] = manifest.enabled
            logger.info("Loaded plugin %s v%s", manifest.name, manifest.version)

    def list(self) -> list[dict]:
        """Return manifest dicts for every loaded plugin (with live `enabled`)."""
        out = []
        for name, plugin in self.plugins.items():
            data = asdict(plugin.get_manifest())
            data["enabled"] = self._enabled.get(name, data.get("enabled", True))
            out.append(data)
        return out

    def dispatch(self, query: str) -> Optional[str]:
        """Run the highest-priority enabled plugin that can handle `query`."""
        candidates = [
            (name, p) for name, p in self.plugins.items()
            if self._enabled.get(name, True) and p.can_handle(query)
        ]
        if not candidates:
            return None
        winner_name, winner = max(candidates, key=lambda nm_p: nm_p[1].get_manifest().priority)
        try:
            result = winner.run(query)
        except Exception as exc:
            logger.exception("Plugin %s raised", winner_name)
            return f"Plugin error: {exc}"
        return result if isinstance(result, str) else str(result)

    def get(self, name: str) -> Optional[BasePlugin]:
        return self.plugins.get(name)

    def set_enabled(self, name: str, enabled: bool) -> bool:
        if name not in self.plugins:
            return False
        self._enabled[name] = enabled
        return True

    def is_enabled(self, name: str) -> bool:
        return self._enabled.get(name, False)
