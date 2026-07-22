import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { audit } from '../../lib/audit';

// Candidate management. Staff can see all candidate profiles, promote a user's
// role, and upload a contract PDF against a candidate.
export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [msg, setMsg] = useState(null);

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
        <thead><tr><th>Name</th><th>Email</th><th>Headline</th><th>Role</th></tr></thead>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
