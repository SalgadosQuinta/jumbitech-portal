import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { audit } from '../../lib/audit';

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('contracts')
      .select('id, label, storage_path, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        setContracts(data || []);
      });
  }, []);

  // Generate a short-lived signed URL on demand and open it. The file is never
  // public; the URL expires after a minute.
  async function open(path) {
    const { data, error: e } = await supabase.storage.from('contracts').createSignedUrl(path, 60);
    if (e) { setError(e.message); audit('access.denied', 'contract', path, { reason: e.message }); return; }
    audit('contract.download', 'contract', path);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <div>
      <h1>My contracts</h1>
      <p className="sub">Download the documents relating to your placement.</p>
      {error && <div className="card err">{error}</div>}

      {contracts.length === 0 ? (
        <p className="muted">No contracts are available yet. JumbiTech will add them here once ready.</p>
      ) : (
        <table>
          <thead><tr><th>Document</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td>{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                <td><button className="btn sm" onClick={() => open(c.storage_path)}>Download PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
