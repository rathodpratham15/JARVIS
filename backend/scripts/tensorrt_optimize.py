#!/usr/bin/env python3
"""Convert InsightFace ONNX models to TensorRT engines.

Run this script ONCE on the target GPU host before deploying JARVIS.
The resulting .engine files are loaded by ONNX Runtime's
TensorrtExecutionProvider automatically when placed alongside the ONNX
models (or pointed to by TRT_ENGINE_CACHE_PATH).

Usage
-----
  # On a CUDA host with TensorRT installed:
  pip install tensorrt onnx onnxruntime-gpu

  python scripts/tensorrt_optimize.py \\
      --onnx ~/.insightface/models/buffalo_sc/det_500m.onnx \\
      --output data/.trt_engines/det_500m.engine \\
      --fp16

  python scripts/tensorrt_optimize.py \\
      --onnx ~/.insightface/models/buffalo_sc/w600k_mbf.onnx \\
      --output data/.trt_engines/w600k_mbf.engine \\
      --fp16

Triton model repository layout (after conversion)
--------------------------------------------------
  model_repo/
    face_detection/
      1/
        model.plan        ← copy det_500m.engine here
      config.pbtxt
    face_recognition/
      1/
        model.plan        ← copy w600k_mbf.engine here
      config.pbtxt

Example config.pbtxt for face_recognition
------------------------------------------
  name: "face_recognition"
  backend: "tensorrt"
  max_batch_size: 8
  input [{ name: "input" data_type: TYPE_FP32 dims: [3, 112, 112] }]
  output [{ name: "output" data_type: TYPE_FP32 dims: [512] }]

Benchmark expectations (A10G, FP16)
-------------------------------------
  det_500m   : ~8 ms per 640×640 frame  (vs ~90 ms CPU)
  w600k_mbf  : ~3 ms per 112×112 crop   (vs ~25 ms CPU)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _build_with_tensorrt_api(onnx_path: Path, output_path: Path, fp16: bool, workspace_mb: int) -> None:
    """Use the TensorRT Python API to build an optimised engine."""
    try:
        import tensorrt as trt  # type: ignore
    except ImportError:
        logger.error("TensorRT Python bindings not found. Install: pip install tensorrt")
        sys.exit(1)

    logger.info("TensorRT version: %s", trt.__version__)

    TRT_LOGGER = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(TRT_LOGGER)
    network_flags = 1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    network = builder.create_network(network_flags)
    parser = trt.OnnxParser(network, TRT_LOGGER)

    logger.info("Parsing ONNX: %s", onnx_path)
    with open(onnx_path, "rb") as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                logger.error("ONNX parse error %d: %s", i, parser.get_error(i))
            sys.exit(1)

    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, workspace_mb * 1024 * 1024)

    if fp16 and builder.platform_has_fast_fp16:
        config.set_flag(trt.BuilderFlag.FP16)
        logger.info("FP16 enabled")
    elif fp16:
        logger.warning("FP16 requested but platform does not support fast FP16 — building FP32")

    # Dynamic shape profile for variable input sizes (det_500m accepts any H/W)
    profile = builder.create_optimization_profile()
    inp = network.get_input(0)
    if inp.shape[2] == -1 or inp.shape[3] == -1:
        name = inp.name
        # min / optimal / max shapes
        profile.set_shape(name, (1, 3, 320, 320), (1, 3, 640, 640), (1, 3, 640, 640))
        config.add_optimization_profile(profile)
        logger.info("Dynamic input shape profile set for %s", name)

    logger.info("Building TensorRT engine (this may take a few minutes)…")
    serialized_engine = builder.build_serialized_network(network, config)
    if serialized_engine is None:
        logger.error("Engine build failed")
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(serialized_engine)
    logger.info("Engine saved to: %s  (%.1f MB)", output_path, output_path.stat().st_size / 1e6)


def _build_with_trtexec(onnx_path: Path, output_path: Path, fp16: bool, workspace_mb: int) -> None:
    """Shell out to trtexec (simpler, same result as the Python API)."""
    import subprocess

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "trtexec",
        f"--onnx={onnx_path}",
        f"--saveEngine={output_path}",
        f"--workspace={workspace_mb}",
        "--minShapes=input:1x3x320x320",
        "--optShapes=input:1x3x640x640",
        "--maxShapes=input:1x3x640x640",
    ]
    if fp16:
        cmd.append("--fp16")

    logger.info("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode != 0:
        logger.error("trtexec failed with exit code %d", result.returncode)
        sys.exit(result.returncode)
    logger.info("Engine saved to: %s", output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert InsightFace ONNX models to TensorRT engines")
    parser.add_argument("--onnx", required=True, type=Path, help="Path to input .onnx model")
    parser.add_argument("--output", required=True, type=Path, help="Path to write .engine file")
    parser.add_argument("--fp16", action="store_true", default=True, help="Enable FP16 precision (default: on)")
    parser.add_argument("--no-fp16", dest="fp16", action="store_false")
    parser.add_argument("--workspace-mb", type=int, default=512, help="TRT builder workspace in MB (default: 512)")
    parser.add_argument("--use-trtexec", action="store_true", help="Use trtexec CLI instead of Python API")
    args = parser.parse_args()

    if not args.onnx.exists():
        logger.error("ONNX file not found: %s", args.onnx)
        sys.exit(1)

    if args.use_trtexec:
        _build_with_trtexec(args.onnx, args.output, args.fp16, args.workspace_mb)
    else:
        _build_with_tensorrt_api(args.onnx, args.output, args.fp16, args.workspace_mb)


if __name__ == "__main__":
    main()
