import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Shown when a user arrives via an invite or recovery link and must set a
// password before continuing. After saving, the normal flow resumes (MFA
// enrolment for new users, dashboard for existing).
export default function SetPassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (pw.length < 10) { setError('Password must be at least 10 characters.'); return; }
    if (pw !== pw2) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: upErr } = await supabase.auth.updateUser({
      password: pw,
      data: { invited: false },
    });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    sessionStorage.removeItem('jtp_recovery');
    window.location.hash = '#/';
    window.location.reload();
  }

  return (
    <div className="auth-wrap">
      <h1>Set your password</h1>
      <p className="sub">Choose the password you will use to sign in to the JumbiTech portal.</p>
      {error && <div className="card err">{error}</div>}
      <form onSubmit={save}>
        <label htmlFor="pw">New password</label>
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={10} autoComplete="new-password" />
        <label htmlFor="pw2">Confirm password</label>
        <input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" />
        <p className="muted" style={{ fontSize: '.85rem' }}>At least 10 characters. You will set up or confirm two-factor authentication next.</p>
        <div style={{ marginTop: '1.25rem' }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
        </div>
      </form>
    </div>
  );
}
