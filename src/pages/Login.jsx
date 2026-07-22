import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState('signin'); // signin | mfa
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      setError(signErr.message);
      setBusy(false);
      return;
    }
    // Check whether a second factor is required to reach aal2.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
        setMode('mfa');
        setBusy(false);
        return;
      }
    }
    // No MFA enrolled yet, or already satisfied: the app router will route them
    // onward (to enrolment if needed).
    window.location.reload();
  }

  async function verify(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr) { setError(cErr.message); setBusy(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (vErr) { setError(vErr.message); setBusy(false); return; }
    window.location.reload();
  }

  return (
    <div className="auth-wrap">
      <h1>JumbiTech <span style={{ color: 'var(--bronze)' }}>Portal</span></h1>
      <p className="sub">Sign in to access your account.</p>

      {error && <div className="card err">{error}</div>}

      {mode === 'signin' && (
        <form onSubmit={signIn}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <div style={{ marginTop: '1.25rem' }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      )}

      {mode === 'mfa' && (
        <form onSubmit={verify}>
          <p>Enter the 6-digit code from your authenticator app.</p>
          <label htmlFor="code">Authentication code</label>
          <input id="code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                 value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
          <div style={{ marginTop: '1.25rem' }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
