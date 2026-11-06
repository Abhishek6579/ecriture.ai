# ecriture.ai

ecriture.ai is a full-page Optical Character Recognition (OCR) system designed for document text detection and line-level recognition. The backend implements a two-stage deep learning pipeline using Differentiable Binarization (DBNet) and Transformer-based OCR (TrOCR) exposed via a FastAPI service, paired with a React 19 and Vite 8 frontend.

---

## Architecture and Inference Pipeline

The core recognition engine (`backend/ocr_engine.py`) processes full-page document images through a four-stage CPU-optimized pipeline:

1. **Text Detection (DBNet)**
   - Uses a ResNet-50 Differentiable Binarization model (`DB_TD500_resnet50.onnx`) executed via OpenCV's DNN module (`cv2.dnn_TextDetectionModel_DB`).
   - Input images are resized to $736 \times 736$ with ImageNet mean subtraction, binary threshold $0.3$, polygon threshold $0.5$, and unclip ratio $2.0$ to output quadrilateral bounding polygons.

2. **Reading-Order Grouping and Perspective Rectification**
   - Detected polygons are sorted into reading lines (`_group_reading_rows`) by clustering vertical centroids within a tolerance of $0.5 \times \text{median line height}$, then ordered left-to-right per line.
   - Polygon vertices are canonically ordered (top-left, top-right, bottom-right, bottom-left) and rectified into horizontal image crops via perspective transformation (`cv2.getPerspectiveTransform` and `cv2.warpPerspective`).

3. **Aspect-Ratio Splitting and Variance Filtering**
   - Because TrOCR resizes inputs to a fixed square resolution, wide text lines suffer from horizontal compression. Crops exceeding a maximum aspect ratio ($\text{width} / \text{height} > 10.0$) are binarized using Otsu's method and split along smoothed vertical-projection whitespace valleys (`_split_wide_crop`).
   - Near-uniform false-positive crops with a grayscale standard deviation below `MIN_CROP_STD` ($12.0$ by default) are discarded prior to recognition.

4. **Sequence Recognition (TrOCR)**
   - Rectified crops are batched and passed through `TrOCRProcessor` and `VisionEncoderDecoderModel` (`microsoft/trocr-small-stage1` by default) using greedy decoding (`num_beams=1`, `max_new_tokens=128`).
   - Supports both PyTorch (`torch.inference_mode`) and ONNX Runtime (`optimum.onnxruntime.ORTModelForVision2Seq`) execution backends.
   - Requests are serialized at the API layer via a threading lock (`INFERENCE_LOCK`) to prevent CPU oversubscription and memory spikes during concurrent requests.

---

## Repository Structure

```text
ecriture.ai/
├── backend/
│   ├── models/                  # Git-ignored DBNet and TrOCR model weights
│   ├── main.py                  # Authenticated FastAPI endpoints
│   ├── ocr_engine.py            # FullPageOCR: detection, geometry, filtering, recognition
│   ├── preprocess.py            # CLAHE image preprocessing
│   ├── download_detector.py     # Model provisioning
│   └── .env.example             # Local API key and CORS configuration
├── frontend/
│   ├── public/                  # Static assets and favicon
│   ├── src/
│   │   ├── components/          # Navbar, spotlight, scramble text, pipeline explorer
│   │   ├── context/             # Theme and API health state
│   │   ├── pages/               # Home, Recognition, Architecture
│   │   ├── services/            # OCR API client
│   │   ├── styles/              # Page, theme, and responsive styles
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── vercel.json              # SPA route fallback for direct page visits
│   └── package.json
├── ocr/                         # Supporting capture and image-stitching utilities
├── trocr-base-printed/          # Printed-text TrOCR helper assets
└── README.md
```

---

## Prerequisites

- **Python**: 3.10 or higher
- **Node.js**: `^20.19.0` or `>=22.12.0` (required by Vite 8 and Oxlint)
- **npm**: 10.x or higher

---

## Backend Setup

### 1. Environment and Dependencies

Navigate to the `backend` directory and create a local `.env` file from the supplied template. The `API_KEY` value must match `VITE_API_KEY` in `frontend/.env.local` for a local browser demo.

Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
```

macOS / Linux:

```bash
cd backend
cp .env.example .env
python -m venv .venv
```

Activate the virtual environment:

- **Linux / macOS**:
  ```bash
  source .venv/bin/activate
  ```
- **Windows (PowerShell)**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```

Install the required packages:

```bash
pip install -r requirements.txt
```

### 2. Model Weights (`backend/models/`)

The `backend/models/` directory is excluded from version control via `.gitignore` and must be populated before starting the FastAPI server. It stores two models:

1. **DBNet Detector**: `backend/models/DB_TD500_resnet50.onnx` (SHA-1: `1b4dd21a6baa5e3523156776970895bd3db6960a`)
2. **TrOCR Recognizer**: `backend/models/trocr-small-stage1/` (processor configuration and `VisionEncoderDecoderModel` weights)

Run the provisioning script to automatically download, verify, and cache both models locally:

```bash
python download_detector.py
```

If you already have the `models` directory from another environment or wish to use custom weights, place them directly under `backend/models/` matching the structure above, or override their locations using environment variables.

### 3. Running the API Server

Start the Uvicorn development server from the `backend` directory:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- **API Root**: `http://localhost:8000/`
- **Interactive OpenAPI Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

The `/health` and `/ocr` endpoints require the `X-API-Key` header. Set `ALLOWED_ORIGINS` to the frontend origin(s) to permit browser requests. Keep real API keys out of version control. A key with a `VITE_` prefix is embedded in frontend assets and is not a production secret; use a server-side proxy for public deployments.

### 4. Backend Configuration

The OCR engine and FastAPI server can be configured via environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DBNET_MODEL_PATH` | `backend/models/DB_TD500_resnet50.onnx` | Path to the DBNet ONNX model file. |
| `TROCR_MODEL_ID` | `microsoft/trocr-small-stage1` | Hugging Face model ID or local path. Defaults to `backend/models/trocr-small-stage1` if present. |
| `OCR_BACKEND` | `pytorch` | Recognition runtime backend (`pytorch` or `onnx`). |
| `TROCR_ONNX_DIR` | `models/trocr-onnx` | Directory containing exported ONNX TrOCR weights when `OCR_BACKEND=onnx`. |
| `OCR_BATCH_SIZE` | `4` | Number of line crops processed per TrOCR forward pass. |
| `MIN_CROP_STD` | `12.0` | Minimum grayscale standard deviation required to pass a crop to TrOCR. |
| `TORCH_NUM_THREADS` | `2` | Number of CPU threads allocated to PyTorch intra-op parallelism. |
| `MAX_UPLOAD_BYTES` | `15728640` | Maximum allowed file upload size in bytes (15 MB). |
| `API_KEY` | Required | Shared development key checked through the `X-API-Key` header. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated browser origins permitted by CORS. |

---

## Frontend Setup

The React application lives in `frontend/`. Install and run it from that directory:

Windows PowerShell:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

macOS / Linux:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_API_URL` to the FastAPI origin and `VITE_API_KEY` to the same value as the backend's `API_KEY`. Add the frontend's origin to the backend `ALLOWED_ORIGINS` comma-separated list so browser CORS checks succeed. The API health indicator calls the authenticated `GET /health` endpoint and distinguishes a connected API, a warming model, an offline service, and a missing/invalid key. The indicator is clickable for a manual recheck and polls automatically while the application is open.

**Deployment security:** Vite embeds variables prefixed with `VITE_` in the browser bundle. Do not treat `VITE_API_KEY` as a secret in a public deployment. For production, put the OCR API behind a server-side proxy or authenticated application backend rather than shipping a shared API key to every browser.

The UI includes a `/architecture` route with an interactive, source-aligned breakdown of the DBNet → crop rectification → TrOCR inference pipeline. Theme preference is saved locally; the Threadpool-style cursor spotlight, scramble/scan animations, and scroll reveals respect reduced-motion settings. When deploying on Vercel, set the project root directory to `frontend` so its SPA rewrite configuration is applied.

Available scripts in `package.json`:

- `npm run dev`: Starts the local development server with HMR.
- `npm run build`: Bundles the application into `dist/` for production.
- `npm run preview`: Serves the production build locally.
- `npm run lint`: Runs static analysis using `oxlint`.

---

## API Reference

### `GET /health`

Returns the operational status of the API and confirms whether the `FullPageOCR` singleton has finished initializing.

```json
{
  "status": "ok",
  "model_loaded": true
}
```

### `POST /ocr`

Accepts a `multipart/form-data` image upload under the `file` field and returns the extracted full-page text.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/ocr" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_page.jpg"
```

**Example Response:**

```json
{
  "filename": "sample_page.jpg",
  "text": "Recognized line one\nRecognized line two",
  "characters": 39
}
```

---

## Contributing

Contributions should focus on modular, well-tested improvements to either the inference pipeline or the web client.

### Current Engineering Tasks

- **Frontend Client Integration**:
  - Extend the recognition workspace with additional document layouts and export formats.
  - Add multi-column reading-order analysis and benchmark handwritten checkpoints before making handwriting-recognition claims.
- **OCR Pipeline Enhancements**:
  - **Layout Analysis**: Extend `FullPageOCR._group_reading_rows` in `backend/ocr_engine.py` to handle multi-column document layouts rather than assuming single-column reading order.
  - **Handwriting Checkpoints**: Benchmark `microsoft/trocr-base-handwritten` and `microsoft/trocr-large-handwritten` against `trocr-small-stage1` for cursive and unconstrained handwritten inputs.
  - **ONNX Export Tooling**: Add a utility script to export TrOCR checkpoints to ONNX format (`models/trocr-onnx`) for out-of-the-box usage with `OCR_BACKEND=onnx`.

### Pull Request Workflow

1. Fork the repository and create a feature branch from `main`.
2. Ensure the backend runs cleanly with `uvicorn main:app` and verify inference via `/ocr` when modifying `backend/`.
3. Run `npm run lint` and `npm run build` from `frontend/` to verify the client after modifying `frontend/src/`.
4. Keep commits atomic and open a pull request detailing the technical changes and any benchmark or latency impacts.