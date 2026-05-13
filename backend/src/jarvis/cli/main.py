"""Text + voice CLI for J.A.R.V.I.S.

Default is text REPL. Add `--voice` to use the system microphone, speakers,
and webcam — same pipeline (intent → action → LLM → memory) but with
audio in/out and camera-driven person/scene recognition.

Web mode (the React frontend talking to `jarvis-web`) does its own
browser-side capture and never touches this module.
"""

from __future__ import annotations

import argparse
import logging
import os

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

from jarvis.core.action_engine import ActionEngine
from jarvis.core.intent_parser import IntentParser
from jarvis.core.llm_core import LLMCore
from jarvis.core.memory import Memory
from jarvis.plugins import PluginManager

console = Console()

CAMERA_INTENTS = {"person_identification", "visual_recognition"}


def _build_context(memory: Memory, n: int = 5) -> str | None:
    recent = memory.recent(limit=n)
    if not recent:
        return None
    lines = [f"User: {r['user_input']} | Assistant: {r['response']}" for r in recent]
    return " || ".join(lines)


def _process(
    user_input: str,
    *,
    parser: IntentParser,
    actions: ActionEngine,
    llm: LLMCore,
    memory: Memory,
    plugins: PluginManager,
    camera=None,
    face_engine=None,
    scene_analyzer=None,
) -> tuple[str, dict]:
    """Single turn: parse → dispatch → return (response, intent)."""
    intent = parser.parse_intent(user_input)

    # Camera-driven intents only run when local hardware is wired in.
    if camera is not None and intent.get("type") in CAMERA_INTENTS:
        console.print("[dim]capturing camera frame...[/]")
        image_path = camera.capture()
        if image_path is None:
            return "I couldn't access the camera.", intent
        if intent["type"] == "person_identification" and face_engine is not None:
            from jarvis.vision import format_recognition_result

            result = face_engine.recognize_face(image_path)
            return format_recognition_result(result), intent
        if intent["type"] == "visual_recognition" and scene_analyzer is not None:
            scene = scene_analyzer.describe_scene(str(image_path))
            return scene.description or "I couldn't describe what I'm seeing.", intent

    if intent.get("action_required"):
        return actions.execute_action(intent), intent

    plugin_response = plugins.dispatch(user_input)
    if plugin_response is not None:
        return plugin_response, intent
    return llm.query_llm(user_input, memory=_build_context(memory)), intent


def run_text() -> None:
    parser = IntentParser()
    actions = ActionEngine()
    llm = LLMCore()
    memory = Memory()
    plugins = PluginManager(plugins_dir=os.getenv("JARVIS_PLUGINS_DIR", "plugins"))
    plugins.discover()

    console.print(Panel.fit("J.A.R.V.I.S — type 'exit' to quit.", style="bold cyan"))

    while True:
        try:
            user_input = console.input("[bold green]you[/] › ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]bye.[/]")
            return
        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit", "bye"}:
            console.print("[dim]bye.[/]")
            return

        response, intent = _process(
            user_input,
            parser=parser, actions=actions, llm=llm, memory=memory, plugins=plugins,
        )
        memory.store_interaction(user_input, response, intent_type=intent.get("type"))
        console.print(f"[bold magenta]jarvis[/] › {response}")


def run_voice(record_seconds: float = 5.0) -> None:
    """Local hardware voice loop: mic → Whisper → action → ElevenLabs/pyttsx3."""
    from jarvis.local import Camera, Microphone, Speaker
    from jarvis.speech import Synthesizer, Transcriber
    from jarvis.vision import FaceRecognitionEngine, SceneAnalyzer

    parser = IntentParser()
    actions = ActionEngine()
    llm = LLMCore()
    memory = Memory()
    plugins = PluginManager(plugins_dir=os.getenv("JARVIS_PLUGINS_DIR", "plugins"))
    plugins.discover()

    transcriber = Transcriber()
    synthesizer = Synthesizer()
    mic = Microphone()
    speaker = Speaker(synthesizer=synthesizer)
    camera = Camera()
    face_engine = FaceRecognitionEngine(
        data_dir=os.getenv("JARVIS_FACE_DIR", "data/faces"),
        tolerance=float(os.getenv("JARVIS_FACE_TOLERANCE", "0.5")),
    )
    scene_analyzer = SceneAnalyzer()

    if not mic.is_available():
        console.print("[red]Microphone unavailable. Install pyaudio + speech_recognition.[/]")
        return

    console.print(
        Panel.fit(
            "J.A.R.V.I.S voice mode\n"
            "[dim]press Enter to talk · type a message to send text · 'exit' to quit[/]",
            style="bold cyan",
        )
    )

    while True:
        try:
            line = console.input("[bold green]you[/] › ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]bye.[/]")
            return
        if line.lower() in {"exit", "quit", "bye"}:
            console.print("[dim]bye.[/]")
            return

        if line:
            user_input = line
        else:
            console.print(f"[dim]listening for {record_seconds:.0f}s...[/]")
            audio_path = mic.record(duration=record_seconds)
            if audio_path is None:
                console.print("[red]capture failed[/]")
                continue
            user_input = transcriber.transcribe(audio_path) or ""
            try:
                audio_path.unlink()
            except OSError:
                pass
            if not user_input.strip():
                console.print("[dim]didn't catch that.[/]")
                continue
            console.print(f"[dim]you said:[/] {user_input}")

        response, intent = _process(
            user_input,
            parser=parser, actions=actions, llm=llm, memory=memory, plugins=plugins,
            camera=camera, face_engine=face_engine, scene_analyzer=scene_analyzer,
        )
        memory.store_interaction(user_input, response, intent_type=intent.get("type"))
        console.print(f"[bold magenta]jarvis[/] › {response}")
        speaker.speak(response)


def main() -> None:
    args = _parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    load_dotenv()
    if args.voice:
        run_voice(record_seconds=args.record_seconds)
    else:
        run_text()


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="jarvis", description="J.A.R.V.I.S CLI (text or voice).")
    p.add_argument("--voice", action="store_true", help="Use system mic, speakers, and webcam.")
    p.add_argument(
        "--record-seconds", type=float, default=5.0,
        help="Seconds to record per push-to-talk turn (voice mode only).",
    )
    p.add_argument("--log-level", default="WARNING", help="Logging level (default: WARNING)")
    return p.parse_args()


if __name__ == "__main__":
    main()
