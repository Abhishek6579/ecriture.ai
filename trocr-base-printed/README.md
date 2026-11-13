# trocr-base-printed API image

This is an alternative backend image that recognises text with
`microsoft/trocr-base-printed` (~334M parameters), exported to int8 ONNX at build time.
It imports the shared FastAPI application from `backend/main.py`, so it receives the
same Supabase authentication and server-enforced scan quota as `backend/Dockerfile`.

| File | Purpose |
| :--- | :--- |
| `Dockerfile` | CPU-only image with int8 weights baked in |
| `fetch_models.py` | Downloads checksum-verified DBNet, exports TrOCR to ONNX and quantizes it |
| `app.py` | Applies low-memory ONNX Runtime settings and imports `main.app` |

## Build and run

Run from the repository root:

```bash
docker build -f trocr-base-printed/Dockerfile -t ecriture-trocr-base .
docker run -p 8000:8000 --env-file backend/.env ecriture-trocr-base
```

`GET /health` is public. `GET /api/me`, `GET /api/me/usage`, and `POST /ocr` require a
Supabase access token:

```bash
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "file=@page.jpg" http://localhost:8000/ocr
```

The first build is substantially larger and slower than `backend/Dockerfile`: it exports
and quantizes the TrOCR base checkpoint. The regular backend image is the recommended
starting point unless the base model's recognition quality is worth its additional build
and memory cost.

## Deployment note

The production deployment described in the root README uses `backend/Dockerfile` and
publishes `dinokiller0607/ecriture-ai` to Docker Hub before updating the existing Azure
Container App. This alternative TrOCR-base image is **not** built or deployed by the
production GitHub Actions workflow. If you intentionally switch production to this image,
update the CI build context, Dockerfile path, model smoke test, and image deployment workflow
before pushing it to Azure.

The log line `Could not find any ONNX files with standard file name decoder_model_merged.onnx`
can be expected because the decoder is exported unmerged for quantization.
