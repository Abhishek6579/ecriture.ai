import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const AppContext = createContext(null);
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_KEY = import.meta.env.VITE_API_KEY;

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('ecriture-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be unavailable in private browsing; keep the default theme.
  }
  return 'dark';
}

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [apiState, setApiState] = useState('checking');
  const [apiDetail, setApiDetail] = useState('Checking the ecriture.ai recognition API.');
  const [lastChecked, setLastChecked] = useState(null);
  const inFlight = useRef(null);
  const activeController = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#050505' : '#f4f7f8');
    try {
      localStorage.setItem('ecriture-theme', theme);
    } catch {
      // Theme still works for this session when storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const checkApi = useCallback(async () => {
    if (inFlight.current) return inFlight.current;

    setApiState('checking');
    setApiDetail('Pinging /health and checking whether the OCR model is ready.');
    const controller = new AbortController();
    activeController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 7000);

    const request = (async () => {
      try {
        const response = await fetch(`${API_URL}/health`, {
          method: 'GET',
          headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
          signal: controller.signal,
          cache: 'no-store',
        });

        if (response.status === 401 || response.status === 403) {
          setApiState('unauthorized');
          setApiDetail('The API is reachable, but the health check rejected the key. Check VITE_API_KEY.');
          return 'unauthorized';
        }

        if (!response.ok) {
          setApiState('offline');
          setApiDetail(`The health endpoint returned HTTP ${response.status}.`);
          return 'offline';
        }

        const health = await response.json().catch(() => ({ status: 'ok' }));
        if (health?.model_loaded === false) {
          setApiState('warming');
          setApiDetail('API reachable · OCR model is still initializing.');
          return 'warming';
        }

        setApiState('online');
        setApiDetail('Connected · FastAPI is responding and the OCR model is loaded.');
        return 'online';
      } catch (error) {
        setApiState('offline');
        setApiDetail(error?.name === 'AbortError'
          ? 'The health check timed out after 7 seconds.'
          : `Could not reach ${API_URL}. Start the backend and check VITE_API_URL.`);
        return 'offline';
      } finally {
        window.clearTimeout(timeout);
        setLastChecked(new Date());
        activeController.current = null;
        inFlight.current = null;
      }
    })();

    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer = null;

    const poll = async () => {
      const result = await checkApi();
      if (!mounted) return;
      const delay = result === 'warming' ? 5000 : result === 'online' ? 30000 : 12000;
      timer = window.setTimeout(poll, delay);
    };

    // Deferring the initial request avoids React StrictMode's development-only
    // setup/cleanup replay aborting the first health check before it starts.
    const startTimer = window.setTimeout(poll, 0);
    return () => {
      mounted = false;
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
      activeController.current?.abort();
    };
  }, [checkApi]);

  const value = {
    theme,
    toggleTheme,
    apiState,
    apiDetail,
    lastChecked,
    checkApi,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used inside AppProvider.');
  return context;
}
