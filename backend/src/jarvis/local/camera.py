"""System webcam capture via OpenCV.

Used when `jarvis --voice` is running on the same machine and the user
says something like "who is this person?". The CLI captures a single
frame, saves it, and feeds it to the face recognition / scene analysis
engines that the web routes also use.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class Camera:
    """Single-frame capture. Opens the camera per-call to avoid lock issues."""

    def __init__(self, device_index: int = 0, warmup_frames: int = 5) -> None:
        self.device_index = device_index
        self.warmup_frames = warmup_frames

    def capture(self, dest_dir: Optional[Path] = None) -> Optional[Path]:
        """Grab a frame from the default camera, save as JPEG, return its path."""
        try:
            import cv2  # type: ignore
        except ImportError:
            logger.warning("opencv-python not installed — camera capture disabled")
            return None

        cap = cv2.VideoCapture(self.device_index)
        if not cap.isOpened():
            logger.warning("Could not open camera at index %d", self.device_index)
            return None
        try:
            # First few frames from a cold camera are usually black or
            # dark — discard them.
            frame = None
            for _ in range(self.warmup_frames):
                ok, frame = cap.read()
                if not ok:
                    frame = None
            if frame is None:
                ok, frame = cap.read()
                if not ok:
                    return None
        finally:
            cap.release()

        dest_dir = dest_dir or Path(tempfile.gettempdir())
        dest_dir.mkdir(parents=True, exist_ok=True)
        fd, path = tempfile.mkstemp(suffix=".jpg", prefix="jarvis_cam_", dir=str(dest_dir))
        os.close(fd)
        cv2.imwrite(path, frame)
        return Path(path)
