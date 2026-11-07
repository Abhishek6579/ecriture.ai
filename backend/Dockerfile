# Use official lightweight Python 3.14-slim image
FROM python:3.14-slim

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# opencv-contrib-python-headless needs no system GUI libraries, so no apt packages are installed.

# Set working directory inside container
WORKDIR /app

# Install CPU-only PyTorch first, pinned to the same version as requirements.txt.
# An unpinned install lets requirements.txt replace it with the CUDA build from PyPI (several GB).
# pip >= 25.1 resumes interrupted downloads instead of failing the build.
ENV PIP_RESUME_RETRIES=20 PIP_DEFAULT_TIMEOUT=120
RUN pip install --no-cache-dir -U "pip>=25.1" \
 && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.14.1

# Then install the remaining requirements (torch==2.14.1 is already satisfied by the CPU build)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the DBNet detector and TrOCR weights into the image (backend/models is git-ignored,
# so a fresh clone or a Render build has no models otherwise)
COPY download_detector.py .
RUN python download_detector.py && rm -rf /root/.cache/huggingface

# Copy the backend source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Set default runtime environment variables (override with --env-file or flags)
ENV PORT=8000

# Run Uvicorn server on $PORT (Render and similar hosts set it)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
