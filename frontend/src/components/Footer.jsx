import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ScrambleText from './ScrambleText.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <Link to="/" className="wordmark">
          <span className="wordmark-symbol">e.</span>
          <span>ecriture<span className="cyan">.ai</span></span>
        </Link>
        <span className="footer-description">DOCUMENT OCR / INTELLIGENCE / DIGITAL TEXT</span>
        <a href="#top" className="back-top">
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
