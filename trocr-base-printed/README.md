# trocr-base-printed API

A second deployable image of the backend that recognises text with
`microsoft/trocr-base-printed` (~334M params) instead of `trocr-small-stage1`, exported to
**int8 ONNX** at build time. The backend code (`backend/*.py`) is used unchanged. The model is
switched through env vars the engine already reads: `OCR_BACKEND=onnx`, `TROCR_ONNX_DIR`,
`TROCR_MODEL_ID`.

| File | Purpose |
| :--- | :--- |
| `Dockerfile` | CPU-only image with the int8 weights baked in |
| `fetch_models.py` | Downloads DBNet (constants from `download_detector.py`), exports trocr-base-printed to ONNX, quantizes it to int8 |
| `app.py` | Imports `main.app` and opens ONNX Runtime sessions in low-memory mode |

## Build and run

From the repo root:

```bash
docker build -f trocr-base-printed/Dockerfile -t ecriture-trocr-base .
docker run -p 8000:8000 -e API_KEY=change-me ecriture-trocr-base
```

`/health` and `/ocr` need the `X-API-Key` header (see `backend/main.py`):

```bash
curl -H "X-API-Key: change-me" -F "file=@page.jpg" http://localhost:8000/ocr
```

The first build downloads ~1.5 GB (torch and the model). pip is upgraded first so dropped
downloads resume instead of failing with `THESE PACKAGES DO NOT MATCH THE HASHES`.

## Measured (in the container, Linux, cgroup `memory.peak`, 3–4 line page)

| Config | Peak RAM | Time per page | Under 2 GB cap |
| :--- | :--- | :--- | :--- |
| fp32 PyTorch | ~2.2–2.4 GB | ~14 s | OOM-killed |
| int8 ONNX, default ORT sessions, batch 4 | 2.39 GB | ~7 s | OOM-killed |
| + low-memory sessions (`app.py`), batch 4 | 1.95 GB | ~7 s | OOM-killed |
| + low-memory sessions, **batch 1 (image default)** | **1.79 GB** | ~7–11 s | **runs** |

The output matches the fp32 model. Most of the memory isn't TrOCR: the DBNet detector at
736×736 takes ~600 MB, and torch, which the engine imports even in ONNX mode, ~300 MB.

## Deploy on Render

New → Web Service → this repo, Language **Docker**:

- **Dockerfile Path**: `trocr-base-printed/Dockerfile`
- **Docker Build Context Directory**: `.` (repo root)
- **Health Check Path**: `/` (`/health` needs the API key, which health checks can't send)
- **Instance type**: **Standard (2 GB)** works with the defaults (~200 MB headroom).
  Free and Starter (512 MB) run out of memory. On Pro (4 GB), set `OCR_BATCH_SIZE=4` for ~25% more speed.
- **Environment**: `API_KEY=<secret>`, `ALLOWED_ORIGINS=https://<your-frontend-domain>`

No `PORT` setup is needed: the container listens on Render's `$PORT`.

The frontend points at it through `frontend/.env.local` (see `frontend/.env.example`):
`VITE_API_URL=https://<service>.onrender.com` and `VITE_API_KEY=<same secret>`.

The log line `Could not find any ONNX files with standard file name decoder_model_merged.onnx`
is expected: the decoder is exported unmerged so it can be quantized.
