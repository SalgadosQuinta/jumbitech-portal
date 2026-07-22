import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Read-only: a client sees the placements at their organisation. RLS restricts
// the rows to their own client_id, so no filtering is needed here.
export default function ClientPlacements() {
  const [placements, setPlacements] = useState([]);

  useEffect(() => {
    supabase
      .from('placements')
      .select('id, role_title, start_date, active, profiles!placements_candidate_id_fkey(full_name)')
      .then(({ data }) => setPlacements(data || []));
  }, []);

  return (
    <div>
      <h1>Placements</h1>
      <p className="sub">Candidates placed with your organisation.</p>
      {placements.length === 0 ? <p className="muted">No placements yet.</p> : (
        <table>
          <thead><tr><th>Candidate</th><th>Role</th><th>Start</th><th>Status</th></tr></thead>
          <tbody>
            {placements.map((p) => (
              <tr key={p.id}>
                <td>{p.profiles?.full_name || '—'}</td>
                <td>{p.role_title || '—'}</td>
                <td>{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</td>
                <td>{p.active ? 'Active' : 'Ended'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
