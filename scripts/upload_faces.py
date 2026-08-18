#!/usr/bin/env python3
"""Seed Railway (or any remote backend) with local face images.

Usage:
    python scripts/upload_faces.py
    python scripts/upload_faces.py --url https://your-backend.up.railway.app
    python scripts/upload_faces.py --dry-run
"""

import argparse
import sys
from pathlib import Path

RAILWAY_URL = "https://jarvis-backend-production-e737.up.railway.app"
IMAGES_ROOT = Path(__file__).parent.parent / "data" / "faces" / "images"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def upload_person(url: str, name: str, images: list[Path], dry_run: bool) -> bool:
    print(f"  {'[dry-run] ' if dry_run else ''}uploading {len(images)} image(s)...")
    if dry_run:
        for p in images:
            print(f"    {p.name}")
        return True

    try:
        import requests
    except ImportError:
        print("  ERROR: requests not installed — run: pip install requests")
        return False

    handles = []
    try:
        files = []
        for p in images:
            fh = open(p, "rb")
            handles.append(fh)
            mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
            files.append(("image", (p.name, fh, mime)))

        resp = requests.post(
            f"{url}/api/face/add-person",
            data={"name": name},
            files=files,
            timeout=60,
        )
        data = resp.json()
        if data.get("success"):
            stats = data.get("statistics", {})
            print(f"  ✓ saved — total people on server: {stats.get('total_people', '?')}")
            return True
        else:
            print(f"  ✗ server error: {data.get('error')}")
            return False
    except Exception as exc:
        print(f"  ✗ request failed: {exc}")
        return False
    finally:
        for fh in handles:
            fh.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload face images to JARVIS backend")
    parser.add_argument("--url", default=RAILWAY_URL, help="Backend base URL")
    parser.add_argument("--dry-run", action="store_true", help="List files without uploading")
    args = parser.parse_args()

    if not IMAGES_ROOT.exists():
        print(f"No images directory found at {IMAGES_ROOT}")
        sys.exit(1)

    people = [
        d for d in sorted(IMAGES_ROOT.iterdir())
        if d.is_dir() and not d.name.startswith(".")
    ]
    if not people:
        print(f"No person folders found in {IMAGES_ROOT}")
        sys.exit(1)

    print(f"Backend : {args.url}")
    print(f"Source  : {IMAGES_ROOT}")
    print(f"People  : {len(people)}")
    print()

    success = failed = 0
    for person_dir in people:
        name = person_dir.name
        images = sorted(
            p for p in person_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTS
        )
        if not images:
            print(f"[{name}] — no images, skipping")
            continue

        print(f"[{name}]")
        if upload_person(args.url, name, images, args.dry_run):
            success += 1
        else:
            failed += 1
        print()

    print(f"Done: {success} uploaded, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
