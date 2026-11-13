import os
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.exporters.onnx import main_export

from download_detector import ensure_detector_model

TROCR_HUB_ID = os.getenv("TROCR_HUB_ID", "microsoft/trocr-base-printed")
ONNX_DIR = Path(os.getenv("TROCR_ONNX_DIR", "/app/models/trocr-base-printed-onnx"))

ensure_detector_model()
ONNX_DIR.parent.mkdir(parents=True, exist_ok=True)

# Export the recognition model into an int8 ONNX graph at image-build time.
if not (ONNX_DIR / "config.json").exists():
    main_export(TROCR_HUB_ID, output=ONNX_DIR, task="image-to-text-with-past", no_post_process=True)
    for onnx_file in ONNX_DIR.glob("*.onnx"):
        int8_file = onnx_file.with_suffix(".int8")
        quantize_dynamic(onnx_file, int8_file, weight_type=QuantType.QInt8)
        int8_file.replace(onnx_file)

print(f"Exported {TROCR_HUB_ID} as int8 ONNX to {ONNX_DIR}")
