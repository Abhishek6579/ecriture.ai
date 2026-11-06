import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, CircleAlert, LoaderCircle, Menu, Moon, Sun, WifiOff, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext.jsx';
import '../styles/SiteNav.css';

const STATUS = {
  checking: { label: 'CHECKING API', Icon: LoaderCircle },
  online: { label: 'API CONNECTED', Icon: Check },
  warming: { label: 'MODEL WARMING', Icon: LoaderCircle },
  offline: { label: 'API OFFLINE', Icon: WifiOff },
  unauthorized: { label: 'API KEY NEEDED', Icon: CircleAlert },
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme, apiState, apiDetail, lastChecked, checkApi } = useAppContext();
  const status = STATUS[apiState] || STATUS.checking;
  const StatusIcon = status.Icon;
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const compactStatus = { online: 'API OK', warming: 'WARMING', checking: 'CHECKING', offline: 'OFFLINE', unauthorized: 'KEY NEEDED' }[apiState] || 'CHECKING';
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-nav" id="top">
      <div className="site-nav-inner">
        <Link to="/" className="site-brand" onClick={closeMenu} aria-label="ecriture.ai home">
          <span className="site-brand-mark">e.</span>
          <span>ecriture<span className="site-brand-accent">.ai</span></span>
        </Link>

        <nav className={`site-nav-links ${menuOpen ? 'site-nav-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/" end onClick={closeMenu} className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}>
            OVERVIEW
          </NavLink>
          <NavLink to="/process" onClick={closeMenu} className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}>
            PROCESS
          </NavLink>
          <NavLink to="/architecture" onClick={closeMenu} className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}>
            ARCHITECTURE
          </NavLink>
          <NavLink to="/recognize" onClick={closeMenu} className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}>
            RECOGNITION
          </NavLink>
          <Link to="/recognize" className="site-nav-cta" onClick={closeMenu}>
            OPEN WORKSPACE <ArrowUpRight size={14} />
          </Link>
        </nav>

        <div className="site-nav-actions">
          <button
            type="button"
            className={`api-status-button api-${apiState}`}
            onClick={checkApi}
            title={`${apiDetail}${lastChecked ? ` Last checked ${lastChecked.toLocaleTimeString()}.` : ''} Click to check again.`}
            aria-label={`${status.label}. ${apiDetail} Click to check again.`}
            aria-live="polite"
            aria-busy={apiState === 'checking' || apiState === 'warming'}
          >
            <span className="api-status-orbit"><StatusIcon size={13} strokeWidth={2.3} /></span>
            <span className="api-status-copy">
              <strong>{status.label}</strong>
              <small>{apiState === 'online' ? 'SYSTEM READY' : apiState === 'warming' ? 'LOADING MODELS' : apiState === 'checking' ? 'PINGING /HEALTH' : apiState === 'unauthorized' ? 'CHECK API KEY' : 'RETRY CONNECTION'}</small>
            </span>
            <span className="api-status-compact">{compactStatus}</span>
            <span className="api-status-refresh"><ChevronDown size={12} /></span>
          </button>

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <ThemeIcon size={17} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className="site-menu-toggle"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
