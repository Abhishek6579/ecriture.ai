import { useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Braces,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileText,
  Gauge,
  ImagePlus,
  Layers3,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ScrambleText from '../components/ScrambleText.jsx';
import { useAppContext } from '../context/AppContext.jsx';
import '../styles/Architecture.css';

const stages = [
  {
    number: '01',
    title: 'Image input',
    tag: 'BROWSER / UPLOAD',
    icon: ImagePlus,
    description: 'The recognition workspace accepts a page image and sends it to the backend as multipart form data.',
    details: [
      'Supported formats: JPEG, PNG, and WebP.',
      'Maximum upload size: 15 MB by default.',
      'The file is submitted in the `file` field to `POST /ocr`.',
      'The frontend sends a Supabase access token as a Bearer token; FastAPI verifies the identity before OCR.',
    ],
    output: 'Uploaded image file',
  },
  {
    number: '02',
    title: 'FastAPI gateway',
    tag: 'VALIDATION / ROUTING',
    icon: ShieldCheck,
    description: 'FastAPI authenticates the request, checks its size, decodes the image, and passes a valid BGR image to the OCR engine.',
    details: [
      'The user-specific Supabase Bearer token is verified before a quota reservation is made.',
      'Oversized, empty, or undecodable images are rejected before inference.',
      'INFERENCE_LOCK serializes inference requests to limit CPU oversubscription and memory spikes.',
      'GET /health reports API availability and whether the OCR singleton is initialized.',
    ],
    output: 'Validated OpenCV image',
  },
  {
    number: '03',
    title: 'Contrast enhancement',
    tag: 'IMAGE PREPROCESSING',
    icon: Gauge,
    description: 'CLAHE is applied to improve local contrast before text detection, helping the detector work with unevenly illuminated page images.',
    details: [
      'Implemented in backend/preprocess.py and called by FullPageOCR.predict_page().',
      'Default CLAHE clip limit: 5.0.',
      'Default brightness offset: 30.',
      'OpenCV CPU threading is constrained to one thread in the OCR engine.',
    ],
    output: 'Contrast-enhanced page',
  },
  {
    number: '04',
    title: 'DBNet text detection',
    tag: 'REGION DETECTION',
    icon: ScanLine,
    description: 'OpenCV DNN runs the DB_TD500 ResNet-50 detector and returns quadrilateral polygons around detected text regions.',
    details: [
      'Detector file: DB_TD500_resnet50.onnx.',
      'Network input: 736 × 736, scaled to 0–1 with ImageNet mean subtraction.',
      'Binary threshold: 0.3 · polygon threshold: 0.5.',
      'Unclip ratio: 2.0 to expand detected text regions.',
    ],
    output: 'Text-region polygons',
  },
  {
    number: '05',
    title: 'Reading order & rectification',
    tag: 'GEOMETRY / CROPS',
    icon: Workflow,
    description: 'Detected regions are grouped into reading rows, ordered, and transformed into horizontal crops so recognition receives aligned text.',
    details: [
      'Rows are grouped using a vertical-centroid tolerance of half the median detected line height (minimum 6 px).',
      'Polygons are ordered top-left, top-right, bottom-right, bottom-left.',
      'cv2.getPerspectiveTransform and cv2.warpPerspective rectify rotated or skewed text regions.',
      'The current row-order heuristic assumes a single-column page layout.',
    ],
    output: 'Ordered, rectified line crops',
  },
  {
    number: '06',
    title: 'Crop filtering & TrOCR',
    tag: 'SEQUENCE RECOGNITION',
    icon: BrainCircuit,
    description: 'Very wide crops are split around whitespace valleys, near-uniform false positives are removed, and TrOCR decodes the remaining lines in batches.',
    details: [
      'Crops wider than 10:1 are split using Otsu thresholding and smoothed vertical projections.',
      'Crops with grayscale standard deviation below 12.0 are discarded by default.',
      'Default recognizer: microsoft/trocr-small-stage1; default batch size: 4.',
      'Greedy decoding uses num_beams=1 and max_new_tokens=128. PyTorch and ONNX Runtime paths are supported.',
    ],
    output: 'Decoded text lines',
  },
  {
    number: '07',
    title: 'Structured response',
    tag: 'RESULT / FRONTEND',
    icon: FileText,
    description: 'Non-empty line predictions are reassembled in row order and returned to the browser for review and export.',
    details: [
      'The API returns filename, text, and characters.',
      'The browser renders the recognized text in the output panel.',
      'Users can copy the result or download it as a .txt file.',
      'An empty detection result returns an empty text string rather than fabricated content.',
    ],
    output: 'Machine-readable text',
  },
];

function ArchitectureFooter() {
  return (
    <footer className="architecture-footer">
      <div className="architecture-footer-inner">
        <Link to="/" className="architecture-wordmark"><span>e.</span> ecriture.ai</Link>
        <span>DBNet DETECTION / TrOCR RECOGNITION</span>
        <Link to="/recognize"><ScrambleText text="TRY RECOGNITION" /> <ArrowUpRight size={13} /></Link>
      </div>
      <div className="architecture-footer-bottom">
        <span>© {new Date().getFullYear()} ECRITURE.AI · ALL RIGHTS RESERVED</span>
        <span>IMPLEMENTATION NOTES · SINGLE-COLUMN PAGE HEURISTIC</span>
      </div>
    </footer>
  );
}

export default function Architecture() {
  const [activeStage, setActiveStage] = useState(0);
  const { apiState, apiDetail, checkApi } = useAppContext();
  const active = stages[activeStage];
  const ActiveIcon = active.icon;
  const statusLabel = apiState === 'online' ? 'API CONNECTED'
    : apiState === 'warming' ? 'MODEL WARMING'
    : apiState === 'checking' ? 'CHECKING API'
    : apiState === 'unauthorized' ? 'API HEALTH ERROR'
    : 'RETRY CONNECTION';

  return (
    <>
      <Navbar />
      <main className="architecture-page">
        <section className="architecture-hero">
          <div className="architecture-hero-grid" aria-hidden="true" />
          <div className="architecture-hero-inner">
            <div className="architecture-hero-copy">
              <div className="architecture-eyebrow"><span /> SYSTEM DESIGN / 01</div>
              <h1>From pixels.<br /><span className="architecture-title-accent">To readable text.</span></h1>
              <p>Inside the ecriture.ai inference engine: a CPU-optimized document OCR pipeline that detects text regions with DBNet, rectifies each line, and decodes it with TrOCR.</p>
              <div className="architecture-hero-actions">
                <a href="#pipeline" className="architecture-primary"><ScrambleText text="EXPLORE THE PIPELINE" /> <ArrowDown size={15} /></a>
                <Link to="/recognize" className="architecture-secondary"><ScrambleText text="OPEN RECOGNITION" /> <ArrowUpRight size={14} /></Link>
              </div>
              <div className="architecture-meta">
                <span>OPENCV DNN</span><i>/</i><span>DBNET</span><i>/</i><span>TrOCR</span><i>/</i><span>FASTAPI</span>
              </div>
            </div>

            <div className="architecture-engine-card spotlight-card">
              <div className="engine-card-top"><span>INFERENCE ENGINE / ECR-01</span><span className="engine-pulse"><i /> LIVE SYSTEM</span></div>
              <div className="engine-core">
                <div className="engine-orbit engine-orbit-a" />
                <div className="engine-orbit engine-orbit-b" />
                <div className="engine-core-mark"><BrainCircuit size={31} strokeWidth={1.3} /></div>
                <span className="engine-node engine-node-a">DB</span>
                <span className="engine-node engine-node-b">OCR</span>
                <span className="engine-node engine-node-c">TXT</span>
              </div>
              <div className="engine-flow"><span>IMAGE</span><b /><span>DETECTION</span><b /><span>TEXT</span></div>
              <div className="engine-card-bottom"><span>MODEL STACK</span><strong>DBNet <em>+</em> TrOCR</strong></div>
            </div>
          </div>
          <div className="architecture-hero-index"><span>FIG. 001 — END-TO-END INFERENCE FLOW</span><span>SCROLL TO INSPECT ↓</span></div>
        </section>

        <section className="architecture-intro container scroll-reveal">
          <div>
            <div className="architecture-section-kicker"><span>01</span> THE PIPELINE</div>
            <h2>Seven stages.<br /><span>One readable result.</span></h2>
          </div>
          <p>The frontend submits a page image to FastAPI. The backend enhances contrast, detects text regions, reconstructs reading order, and recognizes each crop. Select any stage to inspect its implementation and output.</p>
        </section>

        <section className="architecture-flow container scroll-reveal" id="pipeline" aria-label="OCR pipeline stages">
          {stages.map((stage, index) => {
            const StageIcon = stage.icon;
            return (
              <button
                type="button"
                key={stage.number}
                className={`architecture-stage spotlight-card ${activeStage === index ? 'architecture-stage-active' : ''}`}
                onClick={() => setActiveStage(index)}
                aria-pressed={activeStage === index}
              >
                <span className="architecture-stage-top"><span>{stage.number}</span></span>
                <span className="architecture-stage-icon"><StageIcon size={20} strokeWidth={1.55} /></span>
                <strong><ScrambleText text={stage.title} stable /></strong>
                <small><ScrambleText text={stage.tag} stable /></small>
              </button>
            );
          })}
        </section>

        <section className="architecture-detail-section container scroll-reveal">
          <div className="architecture-detail-label"><span>STAGE EXPLORER</span><span>{active.number} / 07</span></div>
          <div className="architecture-detail-grid">
            <div className="architecture-detail-copy" key={active.number}>
              <div className="architecture-detail-icon"><ActiveIcon size={25} strokeWidth={1.5} /></div>
              <div className="architecture-detail-tag">{active.tag}</div>
              <h2>{active.title}</h2>
              <p>{active.description}</p>
              <div className="architecture-detail-output"><span>OUTPUT OF THIS STAGE</span><strong>{active.output}</strong></div>
            </div>
            <div className="architecture-detail-spec spotlight-card">
              <div className="spec-head"><span>IMPLEMENTATION NOTES</span><span><CircleDot size={12} /> SOURCE-ALIGNED</span></div>
              {active.details.map((detail, index) => (
                <div className="spec-row" key={`${active.number}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{detail}</p>
                  <CheckCircle2 size={15} />
                </div>
              ))}
              <div className="spec-progress">{stages.map((stage, index) => <button type="button" key={stage.number} onClick={() => setActiveStage(index)} className={index === activeStage ? 'selected' : ''} aria-label={`Inspect stage ${stage.number}: ${stage.title}`} />)}</div>
            </div>
          </div>
        </section>

        <section className="architecture-contract container scroll-reveal">
          <div className="contract-heading">
            <div className="architecture-section-kicker"><span>02</span> API CONTRACT</div>
            <h2>The browser and<br /><span>the inference service.</span></h2>
            <p>Two endpoints expose the system boundary. The health check powers the status control in the navigation bar; the OCR route handles each image request.</p>
          </div>
          <div className="contract-cards">
            <article className="contract-card spotlight-card">
              <div className="contract-card-top"><span className="http-get">GET</span><span>HEALTH CHECK</span><CheckCircle2 size={16} /></div>
              <code>/health</code>
              <p>Reports service status and whether the FullPageOCR singleton has finished initializing.</p>
              <pre>{`{
  "status": "ok",
  "model_loaded": true
}`}</pre>
            </article>
            <article className="contract-card spotlight-card">
              <div className="contract-card-top"><span className="http-post">POST</span><span>TEXT RECOGNITION</span><Braces size={16} /></div>
              <code>/ocr</code>
              <p>Accepts an image in multipart form data under the <code>file</code> field and returns recognized text.</p>
              <pre>{`{
  "filename": "page.jpg",
  "text": "Recognized text…",
  "characters": 42
}`}</pre>
            </article>
          </div>
        </section>

        <section className="architecture-status-band container spotlight-card">
          <div className="status-band-icon"><Sparkles size={19} /></div>
          <div><strong>Check the live service.</strong><p>{apiDetail}</p></div>
          <button type="button" className={`status-band-button state-${apiState}`} onClick={checkApi}>
            <ScrambleText text={statusLabel} />
            <ArrowUpRight size={14} />
          </button>
        </section>

        <section className="architecture-caveat container scroll-reveal">
          <div className="caveat-icon"><Layers3 size={20} /></div>
          <div><strong>Current scope and known constraint</strong><p>The implemented reading-order heuristic is designed for single-column pages; multi-column layouts need a more advanced layout-analysis pass. Recognition quality depends on image clarity and the model's interpretation of line crops. The browser sends a user-specific Supabase access token as a Bearer token. FastAPI verifies the token and checks the user's server-side scan allowance before invoking OCR. The Supabase secret key is stored only in the backend environment and is never sent to the browser.</p></div>
        </section>
      </main>
      <ArchitectureFooter />
    </>
  );
}
