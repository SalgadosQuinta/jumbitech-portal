import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/dates';

export default function Placements() {
  const [placements, setPlacements] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [clients, setClients] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    candidate_id: '', client_id: '', role_title: '', approval_mode: 'jumbitech',
    day_rate: '', currency: 'GBP', start_date: '',
  });

  const load = useCallback(async () => {
    const [p, c, cl] = await Promise.all([
      supabase.from('placements').select('id, role_title, approval_mode, day_rate, currency, active, start_date, profiles!placements_candidate_id_fkey(full_name, email), clients(name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'candidate').order('full_name'),
      supabase.from('clients').select('id, name').order('name'),
    ]);
    setPlacements(p.data || []);
    setCandidates(c.data || []);
    setClients(cl.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function create() {
    if (!form.candidate_id) { setMsg({ type: 'err', text: 'Select a candidate.' }); return; }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('placements').insert({
      candidate_id: form.candidate_id,
      client_id: form.client_id || null,
      role_title: form.role_title,
      approval_mode: form.approval_mode,
      day_rate: form.day_rate ? Number(form.day_rate) : null,
      currency: form.currency,
      start_date: form.start_date || null,
    });
    if (error) setMsg({ type: 'err', text: error.message });
    else {
      setMsg({ type: 'ok', text: 'Placement created.' });
      setForm({ candidate_id: '', client_id: '', role_title: '', approval_mode: 'jumbitech', day_rate: '', currency: 'GBP', start_date: '' });
      load();
    }
    setBusy(false);
  }

  return (
    <div>
      <h1>Placements</h1>
      <p className="sub">Candidates engaged with clients, and their commercial terms.</p>
      {msg && <div className={`card ${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create a placement</h3>
        <label>Candidate</label>
        <select value={form.candidate_id} onChange={(e) => set('candidate_id', e.target.value)}>
          <option value="">Select candidate</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
        </select>
        <label>Client</label>
        <select value={form.client_id} onChange={(e) => set('client_id', e.target.value)}>
          <option value="">None</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label>Role title</label>
        <input type="text" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} />
        <label>Approval mode</label>
        <select value={form.approval_mode} onChange={(e) => set('approval_mode', e.target.value)}>
          <option value="jumbitech">JumbiTech approves</option>
          <option value="client">Client approves</option>
          <option value="auto">Auto-approve</option>
        </select>
        <label>Day rate</label>
        <input type="number" step="0.01" value={form.day_rate} onChange={(e) => set('day_rate', e.target.value)} />
        <label>Start date</label>
        <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create placement'}</button>
        </div>
      </div>

      <h2>All placements</h2>
      <table>
        <thead><tr><th>Candidate</th><th>Client</th><th>Role</th><th>Approval</th><th>Rate</th><th>Active</th></tr></thead>
        <tbody>
          {placements.map((p) => (
            <tr key={p.id}>
              <td>{p.profiles?.full_name || p.profiles?.email || '—'}</td>
              <td>{p.clients?.name || '—'}</td>
              <td>{p.role_title || '—'}</td>
              <td>{p.approval_mode}</td>
              <td>{p.day_rate ? money(p.day_rate, p.currency) : '—'}</td>
              <td>{p.active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
