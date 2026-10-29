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
│   ├── models/                  # Git-ignored directory containing local model weights
│   │   ├── DB_TD500_resnet50.onnx
│   │   └── trocr-small-stage1/
│   ├── download_detector.py     # Provisioning script for DBNet and TrOCR weights
│   ├── main.py                  # FastAPI application and endpoint definitions
│   ├── ocr_engine.py            # FullPageOCR pipeline implementation
│   └── requirements.txt         # Python dependencies
├── src/
│   ├── assets/                  # Static visual assets
│   ├── components/              # Reusable UI components (Navbar, Footer, UnderTheHood)
│   ├── pages/                   # Application views (Home, Docs, Features)
│   ├── styles/                  # Component and global stylesheets
│   ├── App.jsx                  # Root component
│   └── main.jsx                 # React DOM entry point
├── index.html
├── package.json
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

Navigate to the `backend` directory, create a virtual environment, and install the pinned dependencies:

```bash
cd backend
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

---

## Frontend Setup

From the repository root, install the Node.js dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

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
  - Implement the `/recognize` route (`Navbar.jsx` and `Footer.jsx` reference `/recognize`) with an image upload interface connected to `POST /ocr`.
  - Populate the placeholder page modules (`src/pages/Docs.jsx`, `src/pages/Features.jsx`) and shared UI components (`src/components/Button.jsx`).
  - Wire `ReactRouter` in `src/App.jsx` to handle navigation across `/`, `/recognize`, and `/about`.
- **OCR Pipeline Enhancements**:
  - **Layout Analysis**: Extend `FullPageOCR._group_reading_rows` in `backend/ocr_engine.py` to handle multi-column document layouts rather than assuming single-column reading order.
  - **Handwriting Checkpoints**: Benchmark `microsoft/trocr-base-handwritten` and `microsoft/trocr-large-handwritten` against `trocr-small-stage1` for cursive and unconstrained handwritten inputs.
  - **ONNX Export Tooling**: Add a utility script to export TrOCR checkpoints to ONNX format (`models/trocr-onnx`) for out-of-the-box usage with `OCR_BACKEND=onnx`.

### Pull Request Workflow

1. Fork the repository and create a feature branch from `main`.
2. Ensure the backend runs cleanly with `uvicorn main:app` and verify inference via `/ocr` when modifying `backend/`.
3. Run `npm run lint` and `npm run build` in the root directory to verify zero linting or bundling errors when modifying `src/`.
4. Keep commits atomic and open a pull request detailing the technical changes and any benchmark or latency impacts.