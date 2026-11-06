import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUpRight,
  ScanText,
  Cpu,
  FileText,
  Activity,
  MoveUpRight,
} from 'lucide-react';
import '../styles/Home.css';
import UnderTheHood from '../components/UnderTheHood.jsx';
import ScrambleText from '../components/ScrambleText.jsx';
import Navbar from '../components/Navbar.jsx';
import DotGrid from '../components/DotGrid.jsx';
import { scrollToTop } from '../utils/scrollToTop.js';

// const sectionLinks = {
//   '01': '#top',
//   '02': '#system',
//   '03': '/process',
//   '04': '#project',
// };

const projectModules = [
  {
    number: '01',
    icon: ScanText,
    title: 'Document text recognition',
    tag: 'IMAGE / TEXT',
    description:
      'Page images are detected, segmented into line crops, and decoded into machine-readable text.',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'OCR inference models',
    tag: 'MODEL / INFERENCE',
    description:
      'DBNet locates text regions while TrOCR recognises the rectified line images.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Digital transformation',
    tag: 'INPUT / OUTPUT',
    description:
      'Turn document images into searchable, shareable digital text.',
  },
  {
    number: '04',
    icon: Activity,
    title: 'Performance research',
    tag: 'EVALUATION / METRICS',
    description:
      'Explore the methods used to assess recognition quality, reliability, and limitations.',
  },
];

function RecognitionIllustration() {
  return (
    <div className="hero-visual spotlight-card">
      <div className="visual-header">
        <span>FIG. 001 / RECOGNITION STUDY</span>
        <span className="visual-live">
          <i /> SYSTEM OVERVIEW
        </span>
      </div>

      <div className="visual-canvas">
        <div className="visual-coord coord-one">X: 042.08</div>
        <div className="visual-coord coord-two">Y: 118.24</div>

        <svg
          viewBox="0 0 440 360"
          className="handwriting-svg"
          role="img"
          aria-label="Abstract visualization of document text being converted into digital text"
        >
          <defs>
            <pattern
              id="dots"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.8" fill="var(--illustration-dots)" />
            </pattern>

            <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00c8ff" />
              <stop offset="100%" stopColor="#677bff" />
            </linearGradient>
          </defs>

          <rect width="440" height="360" fill="url(#dots)" />

          <rect
            x="25"
            y="38"
            width="390"
            height="284"
            fill="var(--illustration-panel)"
            stroke="var(--illustration-border)"
          />

          <g stroke="var(--illustration-grid)" strokeWidth="1">
            <path d="M42 95 H398" />
            <path d="M42 151 H398" />
            <path d="M42 207 H398" />
            <path d="M42 263 H398" />
          </g>

          <g
            fill="none"
            stroke="url(#ink)"
            strokeWidth="2.3"
            strokeLinecap="round"
          >
            <path d="M55 109 C74 64, 89 155, 111 103 S145 84, 160 113 S186 137, 204 91" />
            <path d="M56 166 C76 135, 95 198, 116 158 S147 141, 166 170 S188 190, 207 151" />
            <path d="M55 222 C76 187, 92 251, 116 215 S147 199, 165 225 S191 244, 206 210" />
          </g>

          <path
            d="M224 161 H255 L247 153 M255 161 L247 169"
            stroke="#00c8ff"
            strokeWidth="1.5"
            fill="none"
          />

          <g fill="var(--illustration-label)" fontFamily="monospace" fontSize="8">
            <text x="42" y="58">DOCUMENT INPUT</text>
            <text x="276" y="58">PREDICTED OUTPUT</text>
          </g>

          <g stroke="var(--illustration-lines)" strokeWidth="1">
            <path d="M278 110 H370" />
            <path d="M278 128 H388" />
            <path d="M278 146 H359" />
            <path d="M278 180 H380" />
            <path d="M278 198 H370" />
            <path d="M278 216 H390" />
            <path d="M278 234 H355" />
          </g>

          <g fill="#00c8ff">
            <circle cx="278" cy="110" r="2.3" />
            <circle cx="278" cy="146" r="2.3" />
            <circle cx="278" cy="180" r="2.3" />
            <circle cx="278" cy="216" r="2.3" />
          </g>

          <g fill="var(--illustration-label)" fontFamily="monospace" fontSize="8">
            <text x="42" y="298">INPUT / IMAGE DATA</text>
            <text x="276" y="298">OUTPUT / TEXT DATA</text>
          </g>

          <g stroke="#00c8ff" strokeWidth="1">
            <path d="M17 38 H31 M25 30 V44" />
            <path d="M409 38 H423 M415 30 V44" />
            <path d="M17 322 H31 M25 314 V328" />
            <path d="M409 322 H423 M415 314 V328" />
          </g>
        </svg>

        <span className="visual-stamp">ECR / 001</span>
      </div>

      <div className="visual-footer">
        <span>VISUAL INPUT</span>
        <span className="connector-line" />
        <span>MODEL</span>
        <span className="connector-line" />
        <span>DIGITAL OUTPUT</span>
      </div>
    </div>
  );
}

function IntroSection() {
  return (
    <section className="hero">
      <div className="hero-grid-bg" aria-hidden="true" />

      <div className="container hero-layout">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            DOCUMENT / TEXT RECOGNITION
          </div>

          <h1>
            Written on a page.
            <br />
            <span className="hero-scramble">Understood by AI.</span>
          </h1>

          <p className="hero-description">
            A full-page OCR system that combines DBNet text detection and TrOCR line recognition to turn document images into digital text.
          </p>

          <div className="hero-buttons">
            <a href="#system" className="button-primary">
              <ScrambleText text="EXPLORE THE SYSTEM" /> <ArrowUpRight size={15} />
            </a>

            <Link to="/recognize" className="button-secondary">
              <ScrambleText text="TRY RECOGNITION" /> <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="hero-meta">
            <span>COMPUTER VISION</span>
            <span className="meta-separator">/</span>
            <span>MACHINE LEARNING</span>
            <span className="meta-separator">/</span>
            <span>TEXT RECOGNITION</span>
          </div>
        </div>

        <RecognitionIllustration />

        <a className="scroll-cue" href="#system">
          <span>SCROLL TO EXPLORE</span>
          <ArrowDown size={14} />
        </a>
      </div>
    </section>
  );
}

function TopicOverview() {
  return (
    <section className="section system-section scroll-reveal" id="system">
      <div className="container">
        <div className="system-heading">
          <div>
            <div className="eyebrow">02 / SYSTEM INDEX</div>

            <h2 className="section-title">
              A visual language
              <br />
              for written intelligence.
            </h2>

            <p className="section-description">
              Document OCR connects visual input, text-region detection, geometric correction, and sequence recognition to produce machine-readable output.
            </p>
          </div>

          <div className="index-aside">
            <span className="index-symbol">e.</span>
            <span className="mono">ONE SYSTEM</span>
            <span className="aside-divider" />
            <span className="mono">MULTIPLE POSSIBILITIES</span>
          </div>
        </div>

        <div className="module-grid">
          {projectModules.map((module) => {
            const ModuleIcon = module.icon;

            return (
              <article className="module-card spotlight-card" key={module.number}>
                <div className="module-top">
                  <span className="mono module-number">
                    {module.number}
                  </span>
                  <ModuleIcon size={19} strokeWidth={1.3} />
                </div>

                <div className="module-body">
                  <span className="module-tag">{module.tag}</span>
                  <h3>{module.title}</h3>
                  <p>{module.description}</p>
                </div>

                <Link className="module-link" to="/process">
                  <span>EXPLORE CONCEPT</span>
                  <MoveUpRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProcessOverview() {
  return (
    <section className="section process-section process-overview scroll-reveal" id="process">
      <div className="container">
        <div className="eyebrow">03 / PROCESS ARCHITECTURE</div>
        <div className="process-heading">
          <h2 className="section-title">
            From document image
            <br />
            to digital text.
          </h2>
          <div className="process-overview-action">
            <p className="section-description">
              Explore the complete DBNet and TrOCR pipeline, including image validation, text detection, geometric correction, crop filtering, and recognition.
            </p>
            <Link to="/process" className="process-page-link">
              <ScrambleText text="EXPLORE THE FULL PIPELINE" /> <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectIntroduction() {
  return (
    <section className="project-section scroll-reveal" id="project">
      <div className="container project-layout">
        <div>
          <div className="eyebrow">05 / THE PROJECT</div>

          <h2>
            Bridging the gap
            <br />
            between paper and data.
          </h2>

          <p>
            An engineering project exploring full-page document OCR, its underlying computer vision pipeline, and practical applications.
          </p>
        </div>

        <Link to="/recognize" className="project-link">
          <ScrambleText text="EXPLORE ECRITURE.AI" />
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <a href="#top" className="wordmark">
          <span className="wordmark-symbol">e.</span>
          <span>
            ecriture<span className="cyan">.ai</span>
          </span>
        </a>

        <span className="footer-description">
          DOCUMENT OCR / INTELLIGENCE / DIGITAL TEXT
        </span>

        <a href="#top" className="back-top" onClick={scrollToTop}>
          <ScrambleText text="BACK TO TOP ↑" />
        </a>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} ECRITURE.AI · ALL RIGHTS RESERVED</span>
        <span>A FULL-PAGE DOCUMENT OCR PROJECT</span>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main className="landing-main">
      <div className="landing-dot-grid" aria-hidden="true">
        <DotGrid
          baseColor="#3a3446"
          activeColor="#06b6d4"
          shape="circle"
          dotSize={3}
          gap={18}
          proximity={165}
          strength={1}
          bounce={0.6}
          tension={0.4}
          returnDuration={0.8}
          shockRadius={320}
          shockStrength={5}
          swell={0.8}
          stretch={0.5}
          glow={0.5}
          fade={0}
          intro={true}
        />
      </div>
        <IntroSection />
        <TopicOverview />
        <ProcessOverview />
        <UnderTheHood />
        <ProjectIntroduction />
      </main>

      <SiteFooter />
    </>
  );
}
