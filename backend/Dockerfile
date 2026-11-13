# Production CPU image. The model files are fetched and checksum-verified at build time.
FROM python:3.15-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_RESUME_RETRIES=20 \
    PIP_DEFAULT_TIMEOUT=120

WORKDIR /app

# Install the CPU-only PyTorch build before the rest of requirements so pip
# cannot silently replace it with a large CUDA wheel.
RUN pip install --no-cache-dir -U "pip>=25.1" \
 && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.14.1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY download_detector.py .
RUN python download_detector.py && rm -rf /root/.cache/huggingface

COPY . .

EXPOSE 8000
ENV PORT=8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD python -c "import json,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:' + __import__('os').getenv('PORT','8000') + '/health',timeout=4)); exit(0 if d.get('model_loaded') else 1)"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
