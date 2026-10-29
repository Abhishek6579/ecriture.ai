import { useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  FileText,
  ScanText,
  Copy,
  Download,
  RotateCcw,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';

import Navbar from '../components/Navbar.jsx';
import '../styles/Recognize.css';

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export default function Recognize() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState('');

  function selectFile(selectedFile) {
    if (!selectedFile) return;

    setError('');
    setOutput('');
    setCopied(false);

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('The image must be smaller than 15 MB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setFile(selectedFile);
      setPreview(reader.result);
    };

    reader.onerror = () => {
      setError('The image could not be read. Try another file.');
    };

    reader.readAsDataURL(selectedFile);
  }

  function resetPage() {
    setFile(null);
    setPreview('');
    setOutput('');
    setError('');
    setCopied(false);
    setProcessing(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];
    selectFile(droppedFile);
  }

  async function handleCopy() {
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the text and copy it manually.');
    }
  }

  function handleDownload() {
    if (!output) return;

    const blob = new Blob([output], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'ecriture-transcription.txt';
    link.click();

    URL.revokeObjectURL(url);
  }

  async function handleRecognize() {
    if (!file || processing) return;

    setProcessing(true);
    setError('');
    setOutput('');
    setCopied(false);

    // Frontend placeholder only.
    // Replace this section when the OCR API is integrated.
    setOutput(
      'OCR is not connected yet. Your image has been selected successfully, but no text has been extracted. The backend integration will enable real recognition.'
    );

    setProcessing(false);
  }

  return (
    <>
      <Navbar />

      <main className="recognize-page">
        <section className="recognize-heading">
          <div className="recognize-eyebrow">
            <span className="recognize-status-dot" />
            DIGITAL PRESERVATION / OCR WORKSPACE
          </div>

          <h1>
            Bring old pages
            <br />
            <span>into the digital world.</span>
          </h1>

          <p>
            Upload a photograph or scan of a printed book page.
            Prepare historical text for digital preservation
            and future research.
          </p>
        </section>

        <section className="recognize-workspace">
          <div className="workspace-topbar">
            <div>
              <span className="workspace-index">WORKSPACE / 01</span>
              <h2>Document transcription</h2>
            </div>

            <span className="demo-badge">
              FRONTEND DEMO
            </span>
          </div>

          <div className="recognize-grid">
            <section className="document-panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <ImageIcon size={17} />
                  <h3>Source document</h3>
                </div>

                {file && (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={resetPage}
                    aria-label="Remove uploaded document"
                    title="Remove document"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              {!preview ? (
                <div
                  className={`upload-zone ${
                    dragging ? 'upload-zone-active' : ''
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    <Upload size={25} />
                  </div>

                  <h3>Upload a book page</h3>

                  <p>
                    Drag an image here or select one from your device.
                  </p>

                  <button
                    type="button"
                    className="recognize-button upload-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    Choose image
                  </button>

                  <span className="upload-formats">
                    JPG, PNG, WEBP · MAX 15 MB
                  </span>
                </div>
              ) : (
                <div className="document-preview">
                  <img
                    src={preview}
                    alt="Preview of the uploaded historical book page"
                  />

                  <div className="preview-caption">
                    <ImageIcon size={15} />
                    <div className="preview-file-details">
                      <strong>{file.name}</strong>
                      <span>
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  selectFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />

              <div className="source-note">
                <AlertCircle size={15} />
                <p>
                  For best results, use a clear image with readable
                  printed text and minimal blur.
                </p>
              </div>
            </section>

            <section className="output-panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <FileText size={17} />
                  <h3>Extracted text</h3>
                </div>

                <span className="output-status">
                  {output ? 'DEMO MESSAGE' : 'AWAITING INPUT'}
                </span>
              </div>

              <div className="output-content">
                {output ? (
                  <div className="output-result">
                    <div className="demo-notice">
                      <AlertCircle size={17} />
                      <span>
                        Preview only — actual OCR is not connected.
                      </span>
                    </div>

                    <p>{output}</p>
                  </div>
                ) : (
                  <div className="output-empty">
                    <div className="output-empty-icon">
                      <ScanText size={27} />
                    </div>

                    <h3>Your transcription will appear here</h3>

                    <p>
                      Select a book page to prepare it for text
                      recognition. The connected OCR model will
                      eventually return the extracted text here.
                    </p>
                  </div>
                )}
              </div>

              <div className="output-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!output}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Copy size={15} />
                  )}
                  {copied ? 'Copied' : 'Copy text'}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={!output}
                  onClick={handleDownload}
                >
                  <Download size={15} />
                  Download .txt
                </button>
              </div>
            </section>
          </div>

          {error && (
            <div className="recognize-error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="recognize-footer">
            <div className="privacy-note">
              <CheckCircle2 size={16} />
              <span>Local image preview · No upload to a server yet</span>
            </div>

            <div className="workspace-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={resetPage}
                disabled={!file || processing}
              >
                <RotateCcw size={15} />
                Reset
              </button>

              <button
                type="button"
                className="recognize-button"
                onClick={handleRecognize}
                disabled={!file || processing}
              >
                {processing ? (
                  <LoaderCircle size={16} className="loading-icon" />
                ) : (
                  <ScanText size={16} />
                )}
                {processing ? 'Processing...' : 'Recognize text'}
              </button>
            </div>
          </div>
        </section>

        <p className="preservation-note">
          ECRITURE.AI / PRESERVING PRINTED KNOWLEDGE FOR THE DIGITAL AGE
        </p>
      </main>
    </>
  );
}
