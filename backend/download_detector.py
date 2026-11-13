from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

import requests
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "DB_TD500_resnet50.onnx"
# Public GitHub mirror of the OpenCV model. Override this with an immutable
# release URL or private artifact URL in production if desired.
MODEL_URL = os.getenv(
    "DBNET_MODEL_URL",
    "https://raw.githubusercontent.com/emgucv/models/master/scene_text/DB_TD500_resnet50.onnx",
)
EXPECTED_SHA1 = os.getenv("DBNET_MODEL_SHA1", "1b4dd21a6baa5e3523156776970895bd3db6960a").lower()

TROCR_HUB_ID = os.getenv("TROCR_MODEL_ID", "microsoft/trocr-small-stage1")
TROCR_LOCAL_DIR = MODEL_DIR / "trocr-small-stage1"


def sha1(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def ensure_detector_model() -> Path:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1_000_000:
        actual_sha1 = sha1(MODEL_PATH)
        if actual_sha1 == EXPECTED_SHA1:
            print(f"Detector checksum verified: {MODEL_PATH}")
            return MODEL_PATH
        MODEL_PATH.unlink()

    temporary_path = MODEL_PATH.with_suffix(MODEL_PATH.suffix + ".download")
    print(f"Downloading DBNet detector from {MODEL_URL} ...")
    try:
        with requests.get(MODEL_URL, stream=True, timeout=(20, 180)) as response:
            response.raise_for_status()
            with temporary_path.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output.write(chunk)
    except requests.RequestException as exc:
        temporary_path.unlink(missing_ok=True)
        raise RuntimeError(f"Could not download the DBNet detector from {MODEL_URL}.") from exc

    if not temporary_path.exists() or temporary_path.stat().st_size < 1_000_000:
        temporary_path.unlink(missing_ok=True)
        raise RuntimeError("Downloaded DBNet detector is missing or unexpectedly small.")

    actual_sha1 = sha1(temporary_path)
    if actual_sha1 != EXPECTED_SHA1:
        temporary_path.unlink(missing_ok=True)
        raise RuntimeError(
            "DBNet detector checksum mismatch. "
            f"Expected SHA-1 {EXPECTED_SHA1}, received {actual_sha1}. "
            "Check DBNET_MODEL_URL and DBNET_MODEL_SHA1."
        )

    temporary_path.replace(MODEL_PATH)
    print("DBNet detector checksum verified.")
    return MODEL_PATH


def main() -> None:
    ensure_detector_model()

    # Download and save TrOCR locally once so Uvicorn never downloads on startup.
    if (TROCR_LOCAL_DIR / "config.json").exists():
        print(f"TrOCR already saved locally: {TROCR_LOCAL_DIR}")
    else:
        print(f"Downloading {TROCR_HUB_ID} to {TROCR_LOCAL_DIR} ...")
        processor = TrOCRProcessor.from_pretrained(TROCR_HUB_ID, use_fast=False)
        model = VisionEncoderDecoderModel.from_pretrained(TROCR_HUB_ID)
        processor.save_pretrained(TROCR_LOCAL_DIR)
        model.save_pretrained(TROCR_LOCAL_DIR)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Model provisioning failed: {error}", file=sys.stderr)
        raise
