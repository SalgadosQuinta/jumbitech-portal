import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Forced MFA enrolment. Shown when a signed-in user has no second factor.
export default function MfaSetup() {
  const { refreshMfa } = useAuth();
  const [qr, setQr] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Clean up any half-finished unverified factor before enrolling again.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const unverified = (existing?.all || []).find((f) => f.status === 'unverified');
      if (unverified) {
        await supabase.auth.mfa.unenroll({ factorId: unverified.id });
      }
      const { data, error: enrErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (!active) return;
      if (enrErr) { setError(enrErr.message); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code); // SVG data URI
    })();
    return () => { active = false; };
  }, []);

  async function verify(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr) { setError(cErr.message); setBusy(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (vErr) { setError(vErr.message); setBusy(false); return; }
    await refreshMfa();
    window.location.reload();
  }

  return (
    <div className="auth-wrap">
      <h1>Secure your account</h1>
      <p className="sub">JumbiTech requires two-factor authentication before you can access your data.</p>

      {error && <div className="card err">{error}</div>}

      <div className="card">
        <ol style={{ lineHeight: 1.9, paddingLeft: '1.2rem' }}>
          <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, or Authy).</li>
          <li>Scan the code below with that app.</li>
          <li>Enter the 6-digit code it shows to confirm.</li>
        </ol>
        <div className="mfa-code center">
          {qr ? <img src={qr} alt="Scan this QR code with your authenticator app" /> : <p className="muted">Generating code…</p>}
        </div>
      </div>

      <form onSubmit={verify}>
        <label htmlFor="code">Authentication code</label>
        <input id="code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
               value={code} onChange={(e) => setCode(e.target.value)} required />
        <div style={{ marginTop: '1.25rem' }}>
          <button className="btn" type="submit" disabled={busy || !factorId}>{busy ? 'Confirming…' : 'Confirm and continue'}</button>
        </div>
      </form>
    </div>
  );
}
