import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ScanText,
  Cpu,
  FileText,
  Activity,
  Menu,
  X,
  MoveUpRight,
} from 'lucide-react';
import '../styles/Home.css';
import UnderTheHood from '../components/UnderTheHood.jsx';

const sectionLinks = {
  '01': '#top',
  '02': '#system',
  '03': '#process',
  '04': '#project',
};

const projectModules = [
  {
    number: '01',
    icon: ScanText,
    title: 'Handwriting recognition',
    tag: 'IMAGE / TEXT',
    description:
      'Explore how handwritten marks can be translated into machine-readable digital text.',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'Artificial intelligence',
    tag: 'MODEL / INFERENCE',
    description:
      'Discover the machine learning techniques behind the handwriting recognition system.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Digital transformation',
    tag: 'INPUT / OUTPUT',
    description:
      'Understand the transition from handwritten documents to structured digital information.',
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

const processStages = [
  {
    number: '01',
    title: 'Image acquisition',
    description:
      'A handwritten page enters the system as a digital image.',
    label: 'VISUAL INPUT',
  },
  {
    number: '02',
    title: 'Image processing',
    description:
      'The input can be prepared and normalized for the recognition model.',
    label: 'PREPROCESSING',
  },
  {
    number: '03',
    title: 'Model inference',
    description:
      'A trained recognition model analyzes the handwriting and predicts text.',
    label: 'AI INFERENCE',
  },
  {
    number: '04',
    title: 'Text output',
    description:
      'The predicted text can be presented for review and further use.',
    label: 'DIGITAL OUTPUT',
  },
];

function getStageClass(isActive, activeClass) {
  return isActive ? activeClass : '';
}

function SiteNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="navbar" id="top">
      <div className="navbar-inner">
        <a href="#top" className="wordmark" onClick={closeMenu}>
          <span className="wordmark-symbol">e.</span>
          <span>
            ecriture<span className="cyan">.ai</span>
          </span>
        </a>

        <div className="nav-index" aria-label="Page sections">
          {Object.entries(sectionLinks).map(([number, link]) => (
            <a href={link} key={number}>
              {number}
            </a>
          ))}
        </div>

        <nav
          className={`nav-links ${
            getStageClass(menuOpen, 'nav-links-open')
          }`}
        >
          <a href="#system" onClick={closeMenu}>SYSTEM</a>
          <a href="#process" onClick={closeMenu}>PROCESS</a>
          <a href="#project" onClick={closeMenu}>PROJECT</a>

          <Link to="/recognize" onClick={closeMenu}>
            RECOGNITION
          </Link>

          <a className="nav-cta" href="#system" onClick={closeMenu}>
            EXPLORE SYSTEM <ArrowUpRight size={13} />
          </a>
        </nav>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
    </header>
  );
}

function RecognitionIllustration() {
  return (
    <div className="hero-visual">
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
          aria-label="Abstract visualization of handwriting being converted into digital text"
        >
          <defs>
            <pattern
              id="dots"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.8" fill="#3c3c3c" />
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
            fill="#080808"
            stroke="#303030"
          />

          <g stroke="#272727" strokeWidth="1">
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

          <g fill="#8b8b8b" fontFamily="monospace" fontSize="8">
            <text x="42" y="58">HANDWRITTEN INPUT</text>
            <text x="276" y="58">PREDICTED OUTPUT</text>
          </g>

          <g stroke="#464646" strokeWidth="1">
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

          <g fill="#777" fontFamily="monospace" fontSize="8">
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
            AI / HANDWRITING RECOGNITION
          </div>

          <h1>
            Written by hand.
            <br />
            <span>Understood by AI.</span>
          </h1>

          <p className="hero-description">
            Exploring the space between human writing and machine
            intelligence. Turning handwritten information into a
            format the digital world can understand.
          </p>

          <div className="hero-buttons">
            <a href="#system" className="button-primary">
              EXPLORE THE SYSTEM <ArrowUpRight size={15} />
            </a>

            <Link to="/recognize" className="button-secondary">
              TRY RECOGNITION <ArrowUpRight size={15} />
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
    <section className="section system-section" id="system">
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
              Handwriting recognition is more than reading characters.
              It is a process that connects visual information,
              learned patterns, and machine-readable output.
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
              <article className="module-card" key={module.number}>
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

                <a className="module-link" href="#process">
                  <span>EXPLORE CONCEPT</span>
                  <MoveUpRight size={15} />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RecognitionProcess() {
  const [selectedStage, setSelectedStage] = useState(0);
  const currentStage = processStages[selectedStage];

  return (
    <section className="section process-section" id="process">
      <div className="container">
        <div className="eyebrow">03 / PROCESS ARCHITECTURE</div>

        <div className="process-heading">
          <h2 className="section-title">
            From handwriting
            <br />
            to digital understanding.
          </h2>

          <p className="section-description">
            A conceptual look at the steps involved in an AI handwriting
            recognition pipeline. The exact implementation depends on
            the model and preprocessing used by the project.
          </p>
        </div>

        <div className="process-panel">
          <div className="stage-list">
            {processStages.map((stage, index) => (
              <button
                type="button"
                className={`stage-button ${getStageClass(
                  selectedStage === index,
                  'stage-active'
                )}`}
                key={stage.number}
                onClick={() => setSelectedStage(index)}
                aria-pressed={selectedStage === index}
              >
                <span className="mono">{stage.number}</span>
                <span>{stage.title}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>

          <div className="stage-detail" aria-live="polite">
            <span className="stage-label">
              PROCESS STAGE / {currentStage.number}
            </span>

            <div className="stage-large-number">
              {currentStage.number}
            </div>

            <h3>{currentStage.title}</h3>
            <p>{currentStage.description}</p>

            <div className="stage-bottom">
              <span>{currentStage.label}</span>

              <div className="stage-progress">
                {processStages.map((stage, index) => (
                  <span
                    key={stage.number}
                    className={getStageClass(
                      index <= selectedStage,
                      'progress-active'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectIntroduction() {
  return (
    <section className="project-section" id="project">
      <div className="container project-layout">
        <div>
          <div className="eyebrow">04 / THE PROJECT</div>

          <h2>
            Bridging the gap
            <br />
            between paper and data.
          </h2>

          <p>
            An engineering project exploring AI-powered handwriting
            recognition, its underlying technology, and its practical
            applications.
          </p>
        </div>

        <a href="#top" className="project-link">
          <span>EXPLORE ECRITURE.AI</span>
          <ArrowUpRight size={18} />
        </a>
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
          HANDWRITING / INTELLIGENCE / DIGITAL TEXT
        </span>

        <a href="#top" className="back-top">
          BACK TO TOP ↑
        </a>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} ECRITURE.AI</span>
        <span>AN AI HANDWRITING RECOGNITION PROJECT</span>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteNavigation />

      <main>
        <IntroSection />
        <TopicOverview />
        <RecognitionProcess />
        <UnderTheHood />
        <ProjectIntroduction />
      </main>

      <SiteFooter />
    </>
  );
}
