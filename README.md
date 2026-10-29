# Full-page OCR starter (pretrained models, CPU first)

This is a **starter project**, not a trained model. It downloads pretrained weights and runs a two-stage pipeline:

1. OpenCV DBNet ONNX detector proposes text regions.
2. TrOCR recognizes the cropped regions and the API returns reconstructed text.

The first version uses a simple single-column reading-order heuristic. It is not a reliable multi-column/table layout engine. You must test it on your own scans before relying on its output.

## 0. Model choice: printed text only

This project is configured for **printed text only**. Its default recognizer is the pretrained `microsoft/trocr-small-stage1` checkpoint. No model training or fine-tuning is required for the first version.

The small printed model has 61.4 million parameters and is fine-tuned on SROIE. TrOCR recognizes **single text-line images**, so this pipeline first detects/crops text from the full page and then sends the crops to TrOCR. See the model card: <https://huggingface.co/microsoft/trocr-small-printed>.

Start with the small checkpoint because your deployment target is CPU-only. If accuracy is inadequate, evaluate `microsoft/trocr-base-printed` against the same held-out pages before switching. The base model is much larger (about 0.3B parameters), so expect a higher memory and compute cost: <https://huggingface.co/microsoft/trocr-base-printed>.

No handwritten model is used or needed in this project.

## 1. Requirements

Use Python 3.11 (recommended for the pinned starter dependencies). You do not need a GPU.

Windows PowerShell:

```powershell
mkdir full-page-ocr
# Put this project folder's files in full-page-ocr, then:
cd full-page-ocr
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python download_detector.py
```

Linux/macOS:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python download_detector.py
```

The detector downloader uses the official OpenCV DB_TD500 model link and checks the documented SHA-1. If Google Drive blocks the download, download `DB_TD500_resnet50.onnx` manually from the official OpenCV text-detection tutorial and place it in `models/`:
<https://docs.opencv.org/5.0/tutorials/dnn/dnn_text_spotting/dnn_text_spotting.html>

TrOCR weights and processor files are fetched automatically from Hugging Face the first time the app starts. That requires outbound internet access during first startup. On a free Render service, do not assume this cache will persist through spin-down/restarts; repeated cold starts may need to fetch weights again. For a real deployment, use an instance and model-storage strategy appropriate for the model size.

## 2. Run locally (PyTorch baseline)

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000/docs>, select `POST /ocr`, upload a JPG or PNG, and execute the request. The response contains the recognized `text`.

### API reference

| Method | Path      | Description                                                        |
| ------ | --------- | ------------------------------------------------------------------ |
| GET    | `/`       | Short welcome message                                              |
| GET    | `/health` | `{"status": "ok", "model_loaded": true/false}`                     |
| POST   | `/ocr`    | Multipart upload (`file`), JPG or PNG, 15 MB max by default         |

Error codes: `400` (empty or undecodable image), `413` (file too large), `503` (model still loading), `500` (inference failure, message includes the exception type).

Requests to `/ocr` are serialized with a lock so that concurrent uploads do not oversubscribe the CPU.

### Configuration

Everything is read from environment variables. Defaults are sensible for local development.

| Variable            | Default                               | Purpose                                                        |
| ------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `DBNET_MODEL_PATH`  | `backend/models/DB_TD500_resnet50.onnx` | Path to the detector ONNX file                               |
| `TROCR_MODEL_ID`    | local `models/trocr-small-stage1` if present, otherwise `microsoft/trocr-small-stage1` | Hugging Face ID or local directory for the recognizer |
| `OCR_BACKEND`       | `pytorch`                             | `pytorch` or `onnx` (requires an exported model, see below)    |
| `TROCR_ONNX_DIR`    | `models/trocr-onnx`                   | Directory of the exported ONNX recognizer                      |
| `OCR_BATCH_SIZE`    | `4`                                   | Number of line crops sent to TrOCR per forward pass            |
| `TORCH_NUM_THREADS` | `2`                                   | CPU threads for PyTorch                                        |
| `MIN_CROP_STD`      | `12.0`                                | Crops with lower grayscale std-dev are treated as blank and skipped |
| `MAX_UPLOAD_BYTES`  | `15728640` (15 MB)                    | Upload size limit                                              |

### How the pipeline works

Reading `ocr_engine.py` top to bottom is the fastest way to get oriented. In short:

1. DBNet runs on a 736 x 736 resized page and returns quadrilateral text polygons.
2. Polygons are grouped into rows by vertical center (tolerance is half the median box height), then sorted left to right. This is a single-column heuristic; multi-column pages and tables are not handled yet.
3. Each polygon is perspective-warped into an upright crop with small padding.
4. Crops wider than 10x their height are split at whitespace valleys so TrOCR's square resize does not squash the text.
5. Near-uniform crops (false positives) are dropped using `MIN_CROP_STD`.
6. Remaining crops are batched through TrOCR with greedy decoding (`num_beams=1`, `max_new_tokens=128`).
7. Text is joined per row and rows are joined with newlines.

### Optional: ONNX recognizer

An ONNX export can reduce CPU latency. Export once on your machine (not per request):

Test at least 20 representative pages. Check missed text, false detections, crop quality, reading order, punctuation, and whether long lines are squashed. The included `np.std(gray_crop) < 12` filter rejects low-variation crops, but may also reject faint writing; tune `MIN_CROP_STD` against your real samples.

The detector uses 736 x 736 input because that is the documented recommended input for this DB_TD500 model. This is a scene-text baseline, not a guarantee of document-page or handwriting performance. If you see word-level boxes instead of line-level boxes, or bad detection on notebook pages, replace the detector with a suitable pretrained document-text detector before changing TrOCR.

The reading-order code assumes mostly single-column pages. Multi-column documents, tables, forms, and complex handwritten pages need layout-aware ordering. Very long lines may need splitting at word gaps before recognition.

## 4. Export TrOCR to ONNX (after the baseline works)

Export on your development machine, not during every API request. From the project root:

```bash
optimum-cli export onnx --model microsoft/trocr-small-printed --task image-to-text-with-past models/trocr-onnx
```

If this task is unsupported by your installed Optimum/model combination, check supported tasks with:

```bash
optimum-cli export onnx --help
```

Then try the supported `image-to-text` task (without the `-with-past` suffix) and validate the result. Run the exported model locally by setting:

PowerShell:

```powershell
$env:OCR_BACKEND="onnx"
$env:TROCR_ONNX_DIR="models/trocr-onnx"
uvicorn main:app --host 127.0.0.1 --port 8000
```

Bash:

```bash
OCR_BACKEND=onnx TROCR_ONNX_DIR=models/trocr-onnx uvicorn main:app --host 127.0.0.1 --port 8000
```

Compare OCR text and latency with the PyTorch baseline on the **same** test pages. ONNX export validity does not prove recognition equivalence. `image-to-text-with-past` is intended to export cached decoder states when supported, which can avoid repeating decoder work for generated tokens.

If the ONNX output directory is too large for ordinary GitHub files, do not commit large model blobs to the source repository. Host the exported model directory in a model-artifact store (for example, a Hugging Face model repository) or use Git LFS, then fetch it during the Render build. Keep an eye on storage/build-time limits.

## 5. Deploy to Render

Push the code to GitHub, but do not commit large ONNX/model files. Configure the detector download and model artifact download as part of the Render build process, or use a public model artifact URL.

Recommended Render **Build Command** for the PyTorch baseline:

```bash
pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements.txt && python download_detector.py
```

Recommended **Start Command**:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Render's official FastAPI guide uses the same host/port pattern: <https://render.com/docs/deploy-fastapi>.

Set these environment variables in Render if needed:

- `TROCR_MODEL_ID`: defaults to `microsoft/trocr-small-printed`; use `microsoft/trocr-base-printed` only if you have benchmarked it and chosen the larger model
- `OCR_BACKEND`: `pytorch` for the first deployment, `onnx` after the ONNX directory is available
- `TROCR_ONNX_DIR`: path to the exported ONNX directory when using ONNX
- `TORCH_NUM_THREADS`: start with `1` or `2` on a small CPU instance
- `MIN_CROP_STD`: default `12.0`

**Important:** Render's current Free web-service tier has 512 MB RAM and 0.1 CPU, and free services spin down after inactivity. This OCR stack is likely to be too heavy/slow there. A 1 CPU / 2 GB plan is a more realistic starting point for model-based inference, though actual memory and latency must still be measured. The pretrained model downloads and the encoder/decoder generation are significant memory and CPU costs; ONNX is an optimization to benchmark, not a promise of a fixed speedup. Source: <https://render.com/pricing> and <https://render.com/docs/free>.

## 6. Next improvements

1. Add a visual debug endpoint/image that overlays detected polygons on the page.
2. Add robust line grouping and multi-column layout handling.
3. Split excessively wide line crops at validated whitespace gaps.
4. Evaluate CER/WER on a manually transcribed test set.
5. Benchmark end-to-end p50/p95 latency and peak RAM under concurrent requests.
6. Only then consider ONNX graph optimization or quantization.
