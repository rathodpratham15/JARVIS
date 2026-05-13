"""Plugin contract.

A plugin is any class that subclasses `BasePlugin` and implements
`get_manifest()` + `run()`. It's discovered by `PluginManager` from any
directory you point it at. The intent is *extensibility* — a user drops a
single .py file into a plugins directory and it gets picked up. Built-in
intents (calculator, datetime, weather) are handled by `ActionEngine`,
not by plugins, so this system carries no redundant baggage.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PluginManifest:
    name: str
    version: str = "0.1.0"
    description: str = ""
    author: str = ""
    keywords: list[str] = field(default_factory=list)
    enabled: bool = True
    priority: int = 100


class BasePlugin(ABC):
    """Subclass and implement the two abstract methods to ship a plugin."""

    @abstractmethod
    def get_manifest(self) -> PluginManifest: ...

    @abstractmethod
    def run(self, query: str, **kwargs: Any) -> Any: ...

    def can_handle(self, query: str) -> bool:
        """Default: keyword-match against the manifest's keywords list."""
        manifest = self.get_manifest()
        if not manifest.keywords:
            return False
        lowered = query.lower()
        return any(k.lower() in lowered for k in manifest.keywords)

    def get_help(self) -> str:
        manifest = self.get_manifest()
        return f"{manifest.name}: {manifest.description}"
