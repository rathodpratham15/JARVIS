"""Reference plugin. Copy this file, rename it, and edit.

Drop any *.py file under `plugins/` (or wherever PluginManager is pointed)
that defines a `BasePlugin` subclass and it will be auto-loaded at startup.
Built-in intents (calculator, datetime, weather, etc.) are handled by the
action engine, not by plugins — so this system is for *new* capabilities.
"""

from jarvis.plugins import BasePlugin, PluginManifest


class ExamplePlugin(BasePlugin):
    def get_manifest(self) -> PluginManifest:
        return PluginManifest(
            name="example",
            version="0.1.0",
            description="Echo plugin — returns whatever it's given. Replace me.",
            author="you",
            keywords=["echo", "example"],
            priority=10,
        )

    def run(self, query: str, **kwargs) -> str:
        return f"Example plugin saw: {query}"
