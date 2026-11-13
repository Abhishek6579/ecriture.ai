from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

# Load local development variables before the auth/quota modules read them.
load_dotenv()

from auth import get_current_user  # noqa: E402
import quota_store  # noqa: E402
from quota_store import QuotaStoreError  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent
DETECTOR_PATH = Path(os.getenv("DBNET_MODEL_PATH", str(BASE_DIR / "models" / "DB_TD500_resnet50.onnx")))
MAX_UPLOAD_BYTES = max(1, int(os.getenv("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024))))
OCR = None
INFERENCE_LOCK = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global OCR
    load_model = os.getenv("LOAD_OCR_MODEL", "true").lower() not in {"0", "false", "no"}
    if load_model:
        from ocr_engine import FullPageOCR

        OCR = FullPageOCR(detector_path=DETECTOR_PATH)
    else:
        # Used by fast CI/container checks; production must leave this enabled.
        OCR = None
    yield
    OCR = None


app = FastAPI(
    title="Full-page OCR API",
    description="Pretrained DBNet text detection + TrOCR line recognition.",
    version="0.2.0",
    lifespan=lifespan,
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def _usage_payload(usage: dict) -> dict:
    return {
        "plan": usage.get("plan", "free"),
        "scans_used": int(usage.get("scans_used", 0)),
        "scan_limit": int(usage.get("scan_limit", 0)),
        "scans_remaining": int(usage.get("scans_remaining", 0)),
    }


@app.get("/")
def root():
    return {"message": "Full-page OCR API. Open /docs to explore the API."}


@app.get("/health")
def health():
    """Public health endpoint; it intentionally reveals no user or configuration data."""
    return {"status": "ok", "model_loaded": OCR is not None}


@app.get("/api/me")
def me(user: dict = Depends(get_current_user)):
    try:
        usage = quota_store.get_usage(user["id"])
    except QuotaStoreError as exc:
        raise HTTPException(status_code=503, detail="Usage information is temporarily unavailable.") from exc
    return {"user": user, "usage": _usage_payload(usage)}


@app.get("/api/me/usage")
def my_usage(user: dict = Depends(get_current_user)):
    try:
        usage = quota_store.get_usage(user["id"])
    except QuotaStoreError as exc:
        raise HTTPException(status_code=503, detail="Usage information is temporarily unavailable.") from exc
    return _usage_payload(usage)


@app.post("/ocr")
def ocr_page(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if OCR is None:
        raise HTTPException(status_code=503, detail="OCR model is still loading or is disabled.")

    raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large; maximum is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    import cv2
    import numpy as np

    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image.")

    try:
        reservation = quota_store.reserve_scan(user["id"])
    except QuotaStoreError as exc:
        raise HTTPException(status_code=503, detail="Could not check scan allowance. Try again shortly.") from exc

    if not reservation.get("allowed"):
        reason = reservation.get("reason", "user_quota_exceeded")
        if reason == "global_daily_limit":
            raise HTTPException(
                status_code=429,
                detail={"code": "daily_limit_reached", "message": "The service has reached its daily scan capacity. Try again tomorrow."},
            )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "quota_exceeded",
                "used": int(reservation.get("scans_used", 0)),
                "limit": int(reservation.get("scan_limit", 0)),
                "message": "You have used all OCR scans available on your account.",
            },
        )

    reservation_id = str(reservation["reservation_id"])
    try:
        with INFERENCE_LOCK:
            text = OCR.predict_page(image)
    except Exception as exc:
        try:
            quota_store.refund_scan(reservation_id)
        except QuotaStoreError:
            # The reservation is still counted if the database is unavailable.
            # This is safer than silently allowing extra scans.
            pass
        raise HTTPException(status_code=500, detail=f"OCR failed: {type(exc).__name__}.") from exc

    try:
        quota_store.finish_scan(reservation_id, len(text))
        updated_usage = quota_store.get_usage(user["id"])
    except QuotaStoreError:
        # The reservation has already been committed. Return the OCR output;
        # the UI can refresh usage on its next request.
        updated_usage = reservation

    return {
        "filename": file.filename,
        "text": text,
        "characters": len(text),
        "usage": _usage_payload(updated_usage),
    }
