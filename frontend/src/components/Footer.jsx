import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Footer() {
  
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <footer className="site-footer">
      <div className="container footer-main">
        
        {/* Brand info section */}
        <div className="footer-brand">
          <Link to="/" className="brand">
            <span className="brand-mark">e.</span>
            <span>ecriture<span className="brand-dot">.</span>ai</span>
          </Link>
          <p>
            Exploring the relationship between handwriting,
            machine learning, and digital information.
          </p>
        </div>

        {/* nav links */}
        <div className="footer-column">
          <span className="footer-heading">NAVIGATION</span>
          <Link to="/">Home</Link>
          <Link to="/recognize">Recognition</Link>
          <Link to="/about">About the project</Link>
        </div>

        {/* explore stuff */}
        <div className="footer-column">
          <span className="footer-heading">EXPLORE</span>
          <a href="#overview">System overview <ArrowUpRight size={13} /></a>
          {/* Note: kinda redundant having capabilities link to the same place as overview, but design wanted it */}
          <a href="#overview">Capabilities <ArrowUpRight size={13} /></a>
          <Link to="/recognize">Try the system <ArrowUpRight size={13} /></Link>
        </div>

      </div>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} ECRITURE.AI</span>
        <span>AN AI HANDWRITING RECOGNITION PROJECT</span>
        
        {/* Using the helper function instead of inline arrow func */}
        <a href="#top" onClick={scrollToTop}>
          BACK TO TOP ↑
        </a>
      </div>
    </footer>
  );
}