import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import { useAuthContext } from '../context/AuthContext.jsx';
import '../styles/Auth.css';

export default function Login() {
  const {
    configured, loading, user, signInWithGoogle, signInWithEmail, signUpWithEmail,
  } = useAuthContext();
  const location = useLocation();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const destination = location.state?.from?.pathname || '/recognize';

  useEffect(() => {
    if (new URLSearchParams(location.search).get('verified') === '1') {
      setMessage('Your email has been confirmed. Sign in to continue.');
    }
  }, [location.search]);

  if (loading) return <main className="auth-loading-screen">RESTORING YOUR SESSION</main>;
  if (user) return <Navigate to={destination} replace />;

  async function handleGoogle() {
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) setError(authError.message);
    } catch (authError) {
      setError(authError.message || 'Google sign-in could not be started.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = mode === 'signup'
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      if (result.error) {
        setError(result.error.message);
      } else if (mode === 'signup' && !result.data?.session) {
        setMessage('Account created. Check your inbox and confirm your email before signing in.');
      }
    } catch (authError) {
      setError(authError.message || 'Email authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="auth-page">
        <section className="auth-card">
          <Link to="/" className="auth-back-link"><ArrowLeft size={15} /> BACK TO OVERVIEW</Link>
          <div className="auth-brand-mark">e.</div>
          <p className="auth-eyebrow">ECRITURE.AI / SECURE WORKSPACE</p>
          <h1>{mode === 'signup' ? 'Create your account.' : 'Welcome back.'}</h1>
          <p className="auth-intro">Sign in to preserve printed knowledge and use your personal OCR allowance.</p>

          {!configured ? (
            <div className="auth-notice auth-notice-error" role="alert">
              Authentication is not configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the frontend environment, then redeploy.
            </div>
          ) : (
            <>
              <button type="button" className="auth-google-button" onClick={handleGoogle} disabled={busy}>
                {busy ? <LoaderCircle className="loading-icon" size={17} /> : <GoogleMark />}
                Continue with Google
                <ArrowUpRight size={15} />
              </button>

              <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>

              <form className="auth-form" onSubmit={handleEmailSubmit}>
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={16} />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  className="auth-password-input"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />

                <button type="submit" className="auth-submit-button" disabled={busy || !email || !password}>
                  {busy ? <LoaderCircle className="loading-icon" size={17} /> : null}
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                  <ArrowUpRight size={15} />
                </button>
              </form>

              {error && <div className="auth-notice auth-notice-error" role="alert">{error}</div>}
              {message && <div className="auth-notice auth-notice-success" role="status">{message}</div>}

              <button
                type="button"
                className="auth-mode-toggle"
                onClick={() => {
                  setMode((current) => current === 'signin' ? 'signup' : 'signin');
                  setError('');
                  setMessage('');
                }}
              >
                {mode === 'signup' ? 'Already have an account? Sign in' : 'New to ecriture.ai? Create an account'}
              </button>
            </>
          )}

          <div className="auth-security-note">
            <ShieldCheck size={15} />
            <span>Verified accounts · Private uploads · 5 free scans per account</span>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 32 15.1l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 32 15.1l5.7-5.7A20 20 0 0 0 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.2A12 12 0 0 1 12.8 28l-6.5 5A20 20 0 0 0 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.6l6.2 5.2C41.1 35.2 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5Z" />
    </svg>
  );
}
