"""`jarvis-faces` — manage the face recognition database.

Subcommands:
  add        add one person from one or more photos
  import-folder  walk a directory where each subfolder is one person
  import-excel   bulk-import from an Excel sheet (Name + Image columns)
  list       show every person in the DB with image counts
  remove     drop a person by name
  stats      counts + processing-time average
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.table import Table

from jarvis.vision import FaceRecognitionEngine

console = Console()
logger = logging.getLogger(__name__)

_IMAGE_GLOBS = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.JPG", "*.JPEG", "*.PNG")


def _engine(args) -> FaceRecognitionEngine:
    return FaceRecognitionEngine(
        data_dir=args.data_dir,
        tolerance=args.tolerance,
    )


def cmd_add(args) -> int:
    paths = [Path(p) for p in args.images]
    missing = [p for p in paths if not p.exists()]
    if missing:
        console.print(f"[red]missing files:[/] {missing}")
        return 1
    person = _engine(args).add_person(args.name, paths)
    if person is None:
        console.print(f"[red]no faces detected in any of the {len(paths)} images[/]")
        return 2
    console.print(
        f"[green]added[/] {person.name} ({len(person.face_encodings)} encodings "
        f"from {len(person.image_paths)} images)"
    )
    return 0


def cmd_import_folder(args) -> int:
    root = Path(args.directory)
    if not root.is_dir():
        console.print(f"[red]not a directory:[/] {root}")
        return 1
    person_dirs = sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith("."))
    if not person_dirs:
        console.print(f"[yellow]no subdirectories under {root}[/]")
        return 0

    engine = _engine(args)
    added = 0
    skipped: list[tuple[str, str]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("importing people", total=len(person_dirs))
        for person_dir in person_dirs:
            images: list[Path] = []
            for pattern in _IMAGE_GLOBS:
                images.extend(person_dir.glob(pattern))
            if not images:
                skipped.append((person_dir.name, "no images"))
                progress.advance(task)
                continue
            progress.update(task, description=f"encoding {person_dir.name} ({len(images)} imgs)")
            person = engine.add_person(person_dir.name, images)
            if person is None:
                skipped.append((person_dir.name, "no detectable faces"))
            else:
                added += 1
            progress.advance(task)

    console.print(f"[green]added {added}[/] · [yellow]skipped {len(skipped)}[/]")
    if skipped:
        for name, reason in skipped[:10]:
            console.print(f"  [dim]·[/] {name}: {reason}")
        if len(skipped) > 10:
            console.print(f"  [dim]... and {len(skipped) - 10} more[/]")
    return 0


def cmd_import_excel(args) -> int:
    excel = Path(args.excel)
    if not excel.exists():
        console.print(f"[red]not found:[/] {excel}")
        return 1
    engine = _engine(args)
    try:
        added = engine.load_from_excel(excel, images_folder=args.images_folder)
    except ValueError as exc:
        console.print(f"[red]{exc}[/]")
        return 1
    console.print(f"[green]imported {added} people[/] from {excel}")
    return 0


def cmd_list(args) -> int:
    engine = _engine(args)
    if not engine.known_faces:
        console.print("[dim]face DB is empty[/]")
        return 0
    table = Table(show_header=True, header_style="bold")
    table.add_column("Name")
    table.add_column("Images", justify="right")
    table.add_column("Profession", style="dim")
    table.add_column("Age", justify="right", style="dim")
    for p in engine.known_faces:
        table.add_row(p.name, str(len(p.image_paths)), p.profession or "—", str(p.age) if p.age else "—")
    console.print(table)
    console.print(f"[dim]{len(engine.known_faces)} people total[/]")
    return 0


def cmd_remove(args) -> int:
    engine = _engine(args)
    before = len(engine.known_faces)
    engine.known_faces = [p for p in engine.known_faces if p.name.lower() != args.name.lower()]
    removed = before - len(engine.known_faces)
    if removed == 0:
        console.print(f"[yellow]no person named[/] {args.name}")
        return 1
    engine.save()
    console.print(f"[green]removed[/] {args.name} ({removed} record{'s' if removed != 1 else ''})")
    return 0


def cmd_stats(args) -> int:
    stats = _engine(args).get_statistics()
    console.print(stats)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="jarvis-faces",
        description="Manage the J.A.R.V.I.S face recognition database.",
    )
    parser.add_argument("--data-dir", default="data/faces", help="Where the encodings pickle lives")
    parser.add_argument("--tolerance", type=float, default=0.5, help="Match confidence floor (0..1)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="add one person from one or more images")
    p_add.add_argument("name")
    p_add.add_argument("images", nargs="+")
    p_add.set_defaults(func=cmd_add)

    p_folder = sub.add_parser("import-folder", help="walk a directory; one subfolder per person")
    p_folder.add_argument("directory")
    p_folder.set_defaults(func=cmd_import_folder)

    p_excel = sub.add_parser("import-excel", help="bulk import from an .xlsx (Name + Image columns)")
    p_excel.add_argument("excel")
    p_excel.add_argument("--images-folder", help="Resolve relative paths in the Image column against this dir")
    p_excel.set_defaults(func=cmd_import_excel)

    p_list = sub.add_parser("list", help="show every person currently in the DB")
    p_list.set_defaults(func=cmd_list)

    p_remove = sub.add_parser("remove", help="drop a person by name")
    p_remove.add_argument("name")
    p_remove.set_defaults(func=cmd_remove)

    p_stats = sub.add_parser("stats", help="counts + processing-time average")
    p_stats.set_defaults(func=cmd_stats)

    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    load_dotenv()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
