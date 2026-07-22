import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mfaLevel, setMfaLevel] = useState(null); // { currentLevel, nextLevel }
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, client_id')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }, []);

  const loadMfa = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaLevel(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        await loadProfile(data.session.user.id);
        await loadMfa();
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
        await loadMfa();
      } else {
        setProfile(null);
        setMfaLevel(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, loadMfa]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // A user has satisfied MFA when their current assurance level is aal2, or when
  // no second factor is enrolled yet (they will be pushed to enrol).
  const hasMfaEnrolled = mfaLevel?.nextLevel === 'aal2';
  const mfaSatisfied = mfaLevel?.currentLevel === 'aal2';

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    mfaLevel,
    hasMfaEnrolled,
    mfaSatisfied,
    refreshMfa: loadMfa,
    refreshProfile: () => loadProfile(session?.user?.id),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
