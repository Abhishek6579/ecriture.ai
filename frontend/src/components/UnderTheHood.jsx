
import { useState as useStageState } from 'react';
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
    letter: 'A',
    number: '01',
    title: 'Image input',
    short: 'INPUT',
    description:
      'A handwritten page enters the system as an image. Image quality and legibility can influence recognition.',
    icon: ImageIcon,
  },
  {
    letter: 'B',
    number: '02',
    title: 'Preprocessing',
    short: 'PREP',
    description:
      'The image may be resized, denoised, binarized, or normalized to prepare it for the recognition model.',
    icon: ScanIcon,
  },
  {
    letter: 'C',
    number: '03',
    title: 'AI recognition',
    short: 'MODEL',
    description:
      'A trained handwriting recognition model analyzes the input and predicts a sequence of characters or text.',
    icon: BrainIcon,
  },
  {
    letter: 'D',
    number: '04',
    title: 'Text refinement',
    short: 'REFINE',
    description:
      'The predicted text can be formatted and checked. Additional correction should only be applied if supported by the system.',
    icon: CheckIcon,
  },
  {
    letter: 'E',
    number: '05',
    title: 'Digital output',
    short: 'OUTPUT',
    description:
      'The recognized text is presented digitally so it can be reviewed, copied, or used in other applications.',
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
  const [currentStep, setCurrentStep] = useStageState(2);

  const stepInfo = pipelineSteps[currentStep];
  const StepIcon = stepInfo.icon;

  return (
    <section className="hood-section" id="under-the-hood">
      <div className="container">
        <div className="hood-heading">
          <div>
            <span className="hood-eyebrow">
              05 / UNDER THE HOOD
            </span>

            <h2>
              Every stroke.
              <br />
              <span>Every step.</span>
            </h2>
          </div>

          <p>
            From a handwritten image to machine-readable text.
            Explore the stages behind an AI handwriting recognition
            pipeline.
          </p>
        </div>

        <div className="hood-layout">
          <div className="hood-orbit">
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
                {currentStep === 2 ? (
                  <>
                    Ecriture<span>.ai</span>
                  </>
                ) : (
                  stepInfo.title
                )}
              </h3>

              <p>
                {currentStep === 2
                  ? 'Handwriting intelligence'
                  : stepInfo.description}
              </p>

              <span className="center-flow">
                IMAGE <span>→</span> TEXT
              </span>
            </div>

            {pipelineSteps.map((step, stepIndex) => {
              const NodeIcon = step.icon;

              return (
                <button
                  key={step.letter}
                  type="button"
                  className={`orbit-node ${
                    currentStep === stepIndex
                      ? 'orbit-node-active'
                      : ''
                  }`}
                  style={nodePositions[stepIndex]}
                  onMouseEnter={() => setCurrentStep(stepIndex)}
                  onFocus={() => setCurrentStep(stepIndex)}
                  onClick={() => setCurrentStep(stepIndex)}
                  aria-label={`View ${step.title}`}
                  aria-pressed={currentStep === stepIndex}
                >
                  <NodeIcon size={19} strokeWidth={1.5} />

                  <span className="node-letter">
                    {step.letter}
                  </span>
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

          <div className="hood-details" aria-live="polite">
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
                  {stepInfo.letter} / {stepInfo.short}
                </span>
              </div>

              <ArrowIcon size={20} />
            </div>

            <div className="detail-progress">
              {pipelineSteps.map((step, stepIndex) => (
                <button
                  key={step.letter}
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
            FIG. 005 — CONCEPTUAL SYSTEM ARCHITECTURE
          </span>

          <span>
            INPUT / PROCESSING / INFERENCE / OUTPUT
          </span>
        </div>
      </div>
    </section>
  );
}
