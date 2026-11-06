
import { useEffect, useRef, useState as useStageState } from 'react';
import {
  Image as ImageIcon,
  ScanLine as ScanIcon,
  BrainCircuit as BrainIcon,
  FileCheck2 as CheckIcon,
  FileText as TextIcon,
  ArrowUpRight as ArrowIcon,
} from 'lucide-react';
import '../styles/UnderTheHood.css';

const pipelineSteps = [
  {
    number: '01',
    title: 'Image input',
    short: 'UPLOAD',
    description:
      'A JPG, PNG, or WebP page image enters the FastAPI service as multipart form data. The API key and 15 MB upload limit are checked before image decoding.',
    icon: ImageIcon,
  },
  {
    number: '02',
    title: 'CLAHE preprocessing',
    short: 'CONTRAST',
    description:
      'OpenCV converts the page to grayscale, applies CLAHE, and restores a three-channel BGR image. The default clip limit is 5.0 with a brightness offset of 30.',
    icon: ScanIcon,
  },
  {
    number: '03',
    title: 'DBNet detection',
    short: 'DETECTION',
    description:
      'OpenCV DNN runs the DB_TD500 ResNet-50 detector at 736 × 736 and returns quadrilateral polygons around text regions.',
    icon: BrainIcon,
  },
  {
    number: '04',
    title: 'Line rectification',
    short: 'CROP / ORDER',
    description:
      'Polygons are grouped into reading rows, ordered left to right, and perspective-warped into horizontal crops. Extremely wide crops are split and near-uniform false positives are filtered out.',
    icon: CheckIcon,
  },
  {
    number: '05',
    title: 'TrOCR output',
    short: 'RECOGNITION',
    description:
      'TrOCR recognises the rectified line images in batches. The API returns the filename, extracted text, and character count for review, copying, or download.',
    icon: TextIcon,
  },
];

const nodePositions = [
  { left: '50%', top: '3%' },
  { left: '91%', top: '34%' },
  { left: '75%', top: '83%' },
  { left: '25%', top: '83%' },
  { left: '9%', top: '34%' },
];

export default function UnderTheHood() {
  const [currentStep, setCurrentStep] = useStageState(0);
  const [orbitPaused, setOrbitPaused] = useStageState(false);
  const orbitPausedRef = useRef(false);
  const orbitRef = useRef(null);

  useEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return undefined;
    let visible = false;
    let interval = null;
    const start = () => {
      if (interval || !visible || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      interval = window.setInterval(() => {
        if (!orbitPausedRef.current) setCurrentStep((step) => (step + 1) % pipelineSteps.length);
      }, 2000);
    };
    const stop = () => { if (interval) window.clearInterval(interval); interval = null; };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.35 });
    observer.observe(orbit);
    return () => { stop(); observer.disconnect(); };
  }, []);

  const stepInfo = pipelineSteps[currentStep];
  const StepIcon = stepInfo.icon;

  return (
    <section className="hood-section scroll-reveal" id="under-the-hood">
      <div className="container">
        <div className="hood-heading">
          <div>
            <span className="hood-eyebrow">
              05 / UNDER THE HOOD
            </span>

            <h2>
              Every line.
              <br />
              <span>Every step.</span>
            </h2>
          </div>

          <p>
            From a page image to machine-readable text. Explore the implemented DBNet detection, crop rectification, and TrOCR recognition stages.
          </p>
        </div>

        <div className="hood-layout">
          <div className={`hood-orbit${orbitPaused ? ' orbit-paused' : ''}`} ref={orbitRef}>
            <div className="orbit orbit-outer" />
            <div className="orbit orbit-inner" />

            <div className="orbit-center" aria-live="polite">
              <span className="center-index">
                SYSTEM / {stepInfo.number}
              </span>

              <div className="center-icon">
                <StepIcon size={24} strokeWidth={1.4} />
              </div>

              <h3>
                {stepInfo.title}
              </h3>

              <p>
                {stepInfo.description}
              </p>

              <span className="center-flow">
                IMAGE <span>→</span> TEXT
              </span>
            </div>

            {pipelineSteps.map((step, stepIndex) => {
              const NodeIcon = step.icon;

              return (
                <button
                  key={step.number}
                  type="button"
                  className={`orbit-node ${
                    currentStep === stepIndex
                      ? 'orbit-node-active'
                      : ''
                  }`}
                  style={nodePositions[stepIndex]}
                  onPointerEnter={() => { orbitPausedRef.current = true; setOrbitPaused(true); setCurrentStep(stepIndex); }}
                  onPointerLeave={() => { orbitPausedRef.current = false; setOrbitPaused(false); }}
                  onFocus={() => { orbitPausedRef.current = true; setOrbitPaused(true); setCurrentStep(stepIndex); }}
                  onBlur={() => { orbitPausedRef.current = false; setOrbitPaused(false); }}
                  onClick={() => setCurrentStep(stepIndex)}
                  aria-label={`View stage ${step.number}: ${step.title}`}
                  aria-pressed={currentStep === stepIndex}
                >
                  <NodeIcon size={19} strokeWidth={1.5} />
                </button>
              );
            })}

            <span className="orbit-caption orbit-caption-top">
              RECOGNITION PIPELINE
            </span>

            <span className="orbit-caption orbit-caption-bottom">
              SELECT A NODE TO EXPLORE
            </span>
          </div>

          <div className="hood-details spotlight-card" aria-live="polite">
            <div className="detail-top">
              <span>{stepInfo.number} / 05</span>

              <span className="detail-indicator">
                <i />
                PIPELINE STAGE
              </span>
            </div>

            <span className="detail-tag">
              {stepInfo.short}
            </span>

            <h3>{stepInfo.title}</h3>

            <p>{stepInfo.description}</p>

            <div className="detail-divider" />

            <div className="detail-bottom">
              <div>
                <span className="detail-label">STAGE</span>

                <span className="detail-value">
                  {stepInfo.number}
                </span>
              </div>

              <div>
                <span className="detail-label">COMPONENT</span>

                <span className="detail-value">
                  {stepInfo.short}
                </span>
              </div>

              <ArrowIcon size={20} />
            </div>

            <div className="detail-progress">
              {pipelineSteps.map((step, stepIndex) => (
                <button
                  key={step.number}
                  type="button"
                  className={
                    stepIndex === currentStep
                      ? 'progress-active'
                      : ''
                  }
                  aria-label={`Select ${step.title}`}
                  onClick={() => setCurrentStep(stepIndex)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="hood-footnote">
          <span>
            FIG. 005 — IMPLEMENTED OCR PIPELINE
          </span>

          <span>
            OPENCV / DBNET / TrOCR / FASTAPI
          </span>
        </div>
      </div>
    </section>
  );
}
