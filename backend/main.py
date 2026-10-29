from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile

from ocr_engine import FullPageOCR

BASE_DIR = Path(__file__).resolve().parent
DETECTOR_PATH = Path(os.getenv("DBNET_MODEL_PATH", str(BASE_DIR / "models" / "DB_TD500_resnet50.onnx")))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))
OCR = None
INFERENCE_LOCK = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global OCR
    OCR = FullPageOCR(detector_path=DETECTOR_PATH)
    yield
    OCR = None


app = FastAPI(
    title="Full-page OCR API",
    description="Pretrained DBNet text detection + TrOCR line recognition.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {"message": "Full-page OCR API. Open /docs to try the /ocr endpoint."}


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": OCR is not None}


@app.post("/ocr")
def ocr_page(file: UploadFile = File(...)):
    if OCR is None:
        raise HTTPException(status_code=503, detail="OCR model is still loading.")

    raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large; maximum is 15 MB by default.")

    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image.")

    # Serialize model calls to avoid CPU oversubscription and memory spikes on small instances.
    try:
        with INFERENCE_LOCK:
            text = OCR.predict_page(image)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {type(exc).__name__}: {exc}") from exc

    return {
        "filename": file.filename,
        "text": text,
        "characters": len(text),
    }
