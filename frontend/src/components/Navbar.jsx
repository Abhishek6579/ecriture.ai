import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import '../styles/Navbar.css';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Recognition', to: '/recognize' },
  { label: 'About', to: '/about' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  function closeMenu() {
    setMenuOpen(false);
  }

  const handleToggle = () => {
    if (menuOpen == true) {
      setMenuOpen(false);
    } else {
      setMenuOpen(true);
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        
        {/* Logo and brand name */}
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark">e.</span>
          <span>ecriture<span className="brand-dot">.</span>ai</span>
        </Link>

        {/* The actual navigation links, mapped from the array above */}
        <nav className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
          {links.map((link) => {
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={closeMenu}
                className={({ isActive }) => {
                  if (isActive) {
                    return "nav-link active";
                  } else {
                    return "nav-link";
                  }
                }}
              >
                {link.label}
              </NavLink>
            );
          })}

          <Link
            to="/recognize"
            className="nav-launch"
            onClick={closeMenu}
          >
            Try the system <ArrowUpRight size={15} />
          </Link>
        </nav>

        {/* Hamburger button for mobile views */}
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={handleToggle}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

      </div>
    </header>
  );
}