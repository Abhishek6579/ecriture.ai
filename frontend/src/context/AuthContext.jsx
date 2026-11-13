import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { fetchUsage } from '../services/ocrService.js';

const AuthContext = createContext(null);
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isConfigured);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('Could not restore Supabase session:', error.message);
      setSession(data?.session || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUsage = useCallback(async (tokenOverride) => {
    const token = tokenOverride || session?.access_token;
    if (!token) {
      setUsage(null);
      setUsageError('');
      return null;
    }

    setUsageLoading(true);
    setUsageError('');
    try {
      const nextUsage = await fetchUsage(token);
      setUsage(nextUsage);
      return nextUsage;
    } catch (error) {
      setUsageError(error.message || 'Could not load scan usage.');
      return null;
    } finally {
      setUsageLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (session?.access_token) {
      void refreshUsage(session.access_token);
    } else {
      setUsage(null);
      setUsageError('');
    }
  }, [session?.access_token, refreshUsage]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured. Set the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.');
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/recognize` },
    });
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUpWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return { error: null };
    return supabase.auth.signOut();
  }, []);

  const getAccessToken = useCallback(async () => {
    if (session?.access_token) return session.access_token;
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || null;
  }, [session?.access_token]);

  const value = useMemo(() => ({
    configured: isConfigured,
    loading,
    session,
    user: session?.user || null,
    usage,
    usageLoading,
    usageError,
    refreshUsage,
    getAccessToken,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }), [
    loading, session, usage, usageLoading, usageError, refreshUsage,
    getAccessToken, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used inside AuthProvider.');
  return context;
}
