import os
from pathlib import Path

import gdown
from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.exporters.onnx import main_export

from download_detector import EXPECTED_SHA1, MODEL_PATH, MODEL_URL, sha1

TROCR_HUB_ID = os.getenv("TROCR_HUB_ID", "microsoft/trocr-base-printed")
ONNX_DIR = Path(os.getenv("TROCR_ONNX_DIR", str(MODEL_PATH.parent / "trocr-base-printed-onnx")))

MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
if not MODEL_PATH.exists():
    gdown.download(MODEL_URL, str(MODEL_PATH), quiet=False, fuzzy=True)
if not MODEL_PATH.exists() or sha1(MODEL_PATH) != EXPECTED_SHA1:
    raise SystemExit(f"DBNet download failed or checksum mismatch: {MODEL_PATH}")

# Unmerged export: ORT's quantizer skips weights inside the merged decoder's If subgraphs.
main_export(TROCR_HUB_ID, output=ONNX_DIR, task="image-to-text-with-past", no_post_process=True)
for onnx_file in ONNX_DIR.glob("*.onnx"):
    int8_file = onnx_file.with_suffix(".int8")
    quantize_dynamic(onnx_file, int8_file, weight_type=QuantType.QInt8)
    int8_file.replace(onnx_file)
print(f"Exported {TROCR_HUB_ID} as int8 ONNX to {ONNX_DIR}")
