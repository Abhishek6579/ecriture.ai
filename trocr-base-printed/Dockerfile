# ecriture.ai backend running microsoft/trocr-base-printed (~334M params) as int8 ONNX.
# Backend code is used as-is; the model is swapped via its own env vars
# (OCR_BACKEND=onnx + TROCR_ONNX_DIR; TROCR_MODEL_ID for the processor files).
# Build from the repo root:
#   docker build -f trocr-base-printed/Dockerfile -t ecriture-trocr-base .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TROCR_HUB_ID=microsoft/trocr-base-printed \
    OCR_BACKEND=onnx \
    TROCR_ONNX_DIR=/app/models/trocr-base-printed-onnx \
    TROCR_MODEL_ID=/app/models/trocr-base-printed-onnx

WORKDIR /app

# CPU-only torch first, so requirements.txt doesn't pull ~3 GB of CUDA wheels.
# pip >= 25.1 resumes dropped downloads instead of failing the hash check.
ENV PIP_RESUME_RETRIES=20 \
    PIP_DEFAULT_TIMEOUT=120
COPY backend/requirements.txt .
RUN pip install -U "pip>=25.1" \
 && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.14.1 \
 && pip install -r requirements.txt

# int8 weights (~670 MB) baked into the image so startup never hits the network.
# fp32 download is dropped from the HF cache in the same layer.
COPY backend/download_detector.py trocr-base-printed/fetch_models.py ./
RUN python fetch_models.py && rm -rf /root/.cache/huggingface
ENV HF_HUB_OFFLINE=1

COPY backend/main.py backend/ocr_engine.py backend/preprocess.py trocr-base-printed/app.py ./

# Measured peak under a 2 GB cap: batch 1 = 1.85 GB (fits), batch 4 = OOM.
# On a 4 GB instance, OCR_BATCH_SIZE=4 is ~25% faster.
# Set API_KEY (and ALLOWED_ORIGINS for the frontend) at runtime, as for backend/Dockerfile.
ENV MALLOC_ARENA_MAX=2 \
    OCR_BATCH_SIZE=1

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
