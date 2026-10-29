from pathlib import Path
import hashlib
import os
import sys

import gdown
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "DB_TD500_resnet50.onnx"
MODEL_URL = "https://drive.google.com/uc?export=download&id=19YWhArrNccaoSza0CfkXlA8im4-lAGsR"
EXPECTED_SHA1 = "1b4dd21a6baa5e3523156776970895bd3db6960a"

TROCR_HUB_ID = os.getenv("TROCR_MODEL_ID", "microsoft/trocr-small-stage1")
TROCR_LOCAL_DIR = MODEL_DIR / "trocr-small-stage1"


def sha1(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1_000_000:
        print(f"Detector already exists: {MODEL_PATH}")
    else:
        downloaded = gdown.download(MODEL_URL, str(MODEL_PATH), quiet=False, fuzzy=True)
        if not downloaded or not MODEL_PATH.exists() or MODEL_PATH.stat().st_size < 1_000_000:
            raise RuntimeError(
                "Detector download failed. Open the official OpenCV model page linked in README.md "
                "and download DB_TD500_resnet50.onnx manually into the models folder."
            )

    actual_sha1 = sha1(MODEL_PATH)
    if actual_sha1 != EXPECTED_SHA1:
        print(
            "WARNING: The detector SHA-1 differs from the value documented by OpenCV.\n"
            f"Expected: {EXPECTED_SHA1}\nActual:   {actual_sha1}",
            file=sys.stderr,
        )
    else:
        print("Detector checksum verified.")

    # Download and save TrOCR locally once so Uvicorn never downloads on startup
    if (TROCR_LOCAL_DIR / "config.json").exists():
        print(f"TrOCR already saved locally: {TROCR_LOCAL_DIR}")
    else:
        print(f"Downloading {TROCR_HUB_ID} to {TROCR_LOCAL_DIR} ...")
        processor = TrOCRProcessor.from_pretrained(TROCR_HUB_ID, use_fast=False)
        model = VisionEncoderDecoderModel.from_pretrained(TROCR_HUB_ID)
        processor.save_pretrained(TROCR_LOCAL_DIR)
        model.save_pretrained(TROCR_LOCAL_DIR)
        print(f"TrOCR saved locally to: {TROCR_LOCAL_DIR}")


if __name__ == "__main__":
    main()