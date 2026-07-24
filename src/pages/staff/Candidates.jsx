import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { audit } from '../../lib/audit';

// Candidate management. Staff can see all candidate profiles, promote a user's
// role, and upload a contract PDF against a candidate.
export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [msg, setMsg] = useState(null);

  // Invite state.
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'candidate' });
  const [inviteResult, setInviteResult] = useState(null);
  const [actionLink, setActionLink] = useState(null);

  async function callAdmin(payload) {
    const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
    if (error) {
      let detail = error.message;
      try { const ctx = await error.context?.json?.(); if (ctx?.error) detail = ctx.error; } catch { /* keep default */ }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function sendInvite() {
    setMsg(null); setInviteResult(null);
    if (!invite.email) { setMsg({ type: 'err', text: 'Email is required.' }); return; }
    try {
      const res = await callAdmin({ action: 'invite', ...invite });
      setInviteResult(res);
      setInvite({ email: '', full_name: '', role: 'candidate' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  }

  async function resetFor(id) {
    setMsg(null); setActionLink(null);
    try {
      const res = await callAdmin({ action: 'reset', user_id: id });
      setActionLink({ label: 'Password reset link (send this to the user):', link: res.reset_link });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  }

  async function editUser(c) {
    const full_name = window.prompt('Full name:', c.full_name || '');
    if (full_name === null) return;
    const email = window.prompt('Email:', c.email || '');
    if (email === null) return;
    setMsg(null);
    try {
      await callAdmin({ action: 'update', user_id: c.id, full_name, email });
      setMsg({ type: 'ok', text: 'User updated.' });
      load();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  }

  // Contract upload state.
  const [uploadFor, setUploadFor] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, candidate_profiles(headline, phone, location, skills)')
      .order('full_name');
    setCandidates(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(id, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) setMsg({ type: 'err', text: error.message });
    else { setMsg({ type: 'ok', text: 'Role updated.' }); audit('profile.role_change', 'profile', id, { role }); load(); }
  }

  async function uploadContract() {
    if (!uploadFor || !file || !label) {
      setMsg({ type: 'err', text: 'Choose a candidate, a label, and a PDF.' });
      return;
    }
    if (file.type !== 'application/pdf') {
      setMsg({ type: 'err', text: 'Contracts must be PDF files.' });
      return;
    }
    setBusy(true);
    setMsg(null);

    // Path convention: <candidate_uid>/<uuid>.pdf so storage RLS can check owner.
    const contractId = crypto.randomUUID();
    const path = `${uploadFor}/${contractId}.pdf`;

    const { error: upErr } = await supabase.storage.from('contracts').upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (upErr) { setMsg({ type: 'err', text: upErr.message }); setBusy(false); return; }

    const { error: rowErr } = await supabase.from('contracts').insert({
      candidate_id: uploadFor,
      label,
      storage_path: path,
    });
    if (rowErr) { setMsg({ type: 'err', text: rowErr.message }); setBusy(false); return; }

    setMsg({ type: 'ok', text: 'Contract uploaded.' });
    setLabel(''); setFile(null); setUploadFor('');
    setBusy(false);
  }

  const candidateOptions = candidates.filter((c) => c.role === 'candidate');

  return (
    <div>
      <h1>Candidates</h1>
      <p className="sub">Everyone with an account, their role, and their details.</p>
      {msg && <div className={`card ${msg.type}`}>{msg.text}</div>}

      <div className="card accent">
        <h3 style={{ marginTop: 0 }}>Invite a new user</h3>
        <p className="muted">Accounts are created here only. The system attempts to email an invite; a setup link is also shown below to copy and send yourself.</p>
        <label>Full name</label>
        <input type="text" value={invite.full_name} onChange={(e) => setInvite((v) => ({ ...v, full_name: e.target.value }))} />
        <label>Email</label>
        <input type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} />
        <label>Role</label>
        <select value={invite.role} onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value }))}>
          <option value="candidate">Candidate</option>
          <option value="staff">Staff</option>
          <option value="client">Client</option>
        </select>
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={sendInvite}>Create and invite</button>
        </div>
        {inviteResult && (
          <div className="card ok" style={{ marginTop: '1rem' }}>
            <p>Account created. {inviteResult.emailed ? 'An invite email has been attempted.' : 'The invite email could not be sent.'}</p>
            {inviteResult.setup_link && (
              <>
                <p><strong>Setup link (send this to the user):</strong></p>
                <textarea readOnly value={inviteResult.setup_link} rows={3} onFocus={(e) => e.target.select()} />
              </>
            )}
          </div>
        )}
        {actionLink && (
          <div className="card ok" style={{ marginTop: '1rem' }}>
            <p><strong>{actionLink.label}</strong></p>
            <textarea readOnly value={actionLink.link} rows={3} onFocus={(e) => e.target.select()} />
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Upload a contract</h3>
        <label>Candidate</label>
        <select value={uploadFor} onChange={(e) => setUploadFor(e.target.value)}>
          <option value="">Select candidate</option>
          {candidateOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
        </select>
        <label>Document label</label>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Contract of engagement" />
        <label>PDF file</label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={uploadContract} disabled={busy}>{busy ? 'Uploading…' : 'Upload contract'}</button>
        </div>
      </div>

      <h2>All users</h2>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Headline</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id}>
              <td>{c.full_name || '—'}</td>
              <td>{c.email}</td>
              <td className="muted">{c.candidate_profiles?.headline || '—'}</td>
              <td>
                <select value={c.role} onChange={(e) => changeRole(c.id, e.target.value)}>
                  <option value="candidate">candidate</option>
                  <option value="staff">staff</option>
                  <option value="client">client</option>
                </select>
              </td>
              <td className="row-actions">
                <button className="btn sm ghost" onClick={() => resetFor(c.id)}>Reset</button>
                <button className="btn sm ghost" onClick={() => editUser(c)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
