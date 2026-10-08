"""NVIDIA Triton Inference Server client for face recognition.

Replaces direct ONNX Runtime calls with HTTP requests to a Triton server
that hosts the InsightFace models (det_500m + w600k_mbf) as TensorRT
engines.  Falls back silently when Triton is unreachable.

Architecture
------------
  JARVIS backend ──HTTP──► Triton Inference Server
                             ├── face-detection  (det_500m, TRT FP16)
                             └── face-recognition (w600k_mbf, TRT FP16)

Configuration (env vars)
------------------------
  TRITON_URL          Base URL of the Triton HTTP endpoint.
                      Default: http://localhost:8000
  TRITON_DETECTION_MODEL   Model name in Triton repo. Default: face_detection
  TRITON_RECOGNITION_MODEL Model name in Triton repo. Default: face_recognition
  TRITON_TIMEOUT_S    Per-request timeout in seconds. Default: 5

Deploying models on Triton
--------------------------
  1. Convert ONNX to TRT engines (see scripts/tensorrt_optimize.py)
  2. Place in a model repository:
       model_repo/
         face_detection/
           1/model.plan          ← TRT engine
           config.pbtxt
         face_recognition/
           1/model.plan
           config.pbtxt
  3. Start Triton:
       docker run --gpus all -p 8000:8000 -p 8001:8001 -p 8002:8002 \\
         -v $(pwd)/model_repo:/models \\
         nvcr.io/nvidia/tritonserver:24.08-py3 \\
         tritonserver --model-repository=/models
  4. Set TRITON_URL=http://<host>:8000 in JARVIS .env
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

_TRITON_URL = os.getenv("TRITON_URL", "http://localhost:8000").rstrip("/")
_DETECTION_MODEL = os.getenv("TRITON_DETECTION_MODEL", "face_detection")
_RECOGNITION_MODEL = os.getenv("TRITON_RECOGNITION_MODEL", "face_recognition")
_TIMEOUT = float(os.getenv("TRITON_TIMEOUT_S", "5"))

# Input/output tensor names must match the config.pbtxt for each model.
_DET_INPUT = "input"          # [1, 3, H, W] NCHW float32
_DET_OUTPUT = "output"        # bounding boxes + landmarks + scores
_REC_INPUT = "input"          # [1, 3, 112, 112] aligned face crop, float32
_REC_OUTPUT = "output"        # [1, 512] L2-normalised embedding


def _get_client():
    """Return a tritonclient.http.InferenceServerClient or None."""
    try:
        import tritonclient.http as triton_http  # type: ignore
        client = triton_http.InferenceServerClient(
            url=_TRITON_URL.replace("http://", ""),
            verbose=False,
        )
        if not client.is_server_ready():
            logger.warning("Triton server at %s not ready", _TRITON_URL)
            return None
        return client
    except ImportError:
        logger.debug("tritonclient not installed — Triton face inference unavailable")
        return None
    except Exception as exc:
        logger.warning("Cannot connect to Triton at %s: %s", _TRITON_URL, exc)
        return None


def is_triton_available() -> bool:
    """Return True if the Triton server is reachable and ready."""
    return _get_client() is not None


def get_face_embedding_via_triton(aligned_face: np.ndarray) -> Optional[np.ndarray]:
    """Send an aligned 112×112 BGR face crop to Triton and get a 512-dim embedding.

    Args:
        aligned_face: uint8 BGR image of shape (112, 112, 3), already aligned
                      by the detection model (same preprocessing as InsightFace).

    Returns:
        512-dim float32 L2-normalised embedding, or None on any failure.
    """
    client = _get_client()
    if client is None:
        return None

    try:
        import tritonclient.http as triton_http

        # Preprocess: BGR → RGB, HWC → CHW, uint8 → float32, normalise
        face_rgb = aligned_face[:, :, ::-1].astype(np.float32)
        face_rgb = (face_rgb - 127.5) / 128.0
        inp_data = face_rgb.transpose(2, 0, 1)[np.newaxis]  # (1, 3, 112, 112)

        inputs = [triton_http.InferInput(_REC_INPUT, inp_data.shape, "FP32")]
        inputs[0].set_data_from_numpy(inp_data)

        outputs = [triton_http.InferRequestedOutput(_REC_OUTPUT)]

        result = client.infer(
            model_name=_RECOGNITION_MODEL,
            inputs=inputs,
            outputs=outputs,
            timeout=_TIMEOUT,
        )
        embedding = result.as_numpy(_REC_OUTPUT).squeeze()  # (512,)

        # L2-normalise (Triton model may or may not normalise internally)
        norm = np.linalg.norm(embedding)
        if norm > 1e-6:
            embedding = embedding / norm

        return embedding.astype(np.float32)

    except Exception as exc:
        logger.warning("Triton recognition inference failed: %s", exc)
        return None


def get_face_detections_via_triton(
    image: np.ndarray,
    det_size: tuple[int, int] = (640, 640),
) -> list[dict]:
    """Run face detection on `image` via Triton and return bounding boxes.

    Args:
        image: uint8 BGR image (any size).
        det_size: (width, height) the model was compiled for.

    Returns:
        List of dicts with keys: bbox [x1,y1,x2,y2], score, kps (landmarks).
        Empty list on failure.
    """
    client = _get_client()
    if client is None:
        return []

    try:
        import cv2
        import tritonclient.http as triton_http

        h, w = det_size[1], det_size[0]
        resized = cv2.resize(image, (w, h)).astype(np.float32)
        resized = (resized - 127.5) / 128.0
        inp_data = resized.transpose(2, 0, 1)[np.newaxis]  # (1, 3, H, W)

        inputs = [triton_http.InferInput(_DET_INPUT, inp_data.shape, "FP32")]
        inputs[0].set_data_from_numpy(inp_data)
        outputs = [triton_http.InferRequestedOutput(_DET_OUTPUT)]

        result = client.infer(
            model_name=_DETECTION_MODEL,
            inputs=inputs,
            outputs=outputs,
            timeout=_TIMEOUT,
        )
        raw = result.as_numpy(_DET_OUTPUT)
        # Shape: (N, 15) — [x1,y1,x2,y2, score, kp0x,kp0y,...,kp4x,kp4y]
        detections = []
        scale_x = image.shape[1] / w
        scale_y = image.shape[0] / h
        for row in raw:
            score = float(row[4])
            bbox = [
                float(row[0]) * scale_x, float(row[1]) * scale_y,
                float(row[2]) * scale_x, float(row[3]) * scale_y,
            ]
            kps = row[5:].reshape(5, 2) * np.array([scale_x, scale_y])
            detections.append({"bbox": bbox, "score": score, "kps": kps.tolist()})
        return detections

    except Exception as exc:
        logger.warning("Triton detection inference failed: %s", exc)
        return []
