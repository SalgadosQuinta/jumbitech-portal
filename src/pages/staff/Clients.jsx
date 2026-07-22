import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('clients').select('id, name, created_at').order('name');
    setClients(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('clients').insert({ name: name.trim() });
    if (error) setMsg({ type: 'err', text: error.message });
    else { setMsg({ type: 'ok', text: 'Client added.' }); setName(''); load(); }
    setBusy(false);
  }

  return (
    <div>
      <h1>Clients</h1>
      <p className="sub">The end-client organisations candidates are placed into.</p>
      {msg && <div className={`card ${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add a client</h3>
        <label>Organisation name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add client'}</button>
        </div>
      </div>

      <h2>All clients</h2>
      {clients.length === 0 ? <p className="muted">No clients yet.</p> : (
        <table>
          <thead><tr><th>Name</th><th>Added</th></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{new Date(c.created_at).toLocaleDateString('en-GB')}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
