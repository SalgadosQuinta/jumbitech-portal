import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { weekLabel } from '../lib/dates';
import { useAuth } from '../context/AuthContext';

// Reusable timesheet approval list. Staff see all submitted sheets; clients see
// only those for their placements (RLS enforces this regardless). Approve/reject
// write the decision and status.
export default function ApprovalList({ scope }) {
  const { user } = useAuth();
  const [sheets, setSheets] = useState([]);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('id, week_start, total_hours, notes, status, placements(role_title, profiles!placements_candidate_id_fkey(full_name, email))')
      .eq('status', 'submitted')
      .order('week_start', { ascending: false });
    setSheets(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id, decision) {
    const patch = {
      status: decision === 'approve' ? 'approved' : 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('timesheets').update(patch).eq('id', id);
    if (error) setMsg({ type: 'err', text: error.message });
    else { setMsg({ type: 'ok', text: `Timesheet ${patch.status}.` }); load(); }
  }

  return (
    <div>
      <h1>Approvals</h1>
      <p className="sub">{scope === 'client' ? 'Timesheets awaiting your approval.' : 'Submitted timesheets awaiting a decision.'}</p>
      {msg && <div className={`card ${msg.type}`}>{msg.text}</div>}

      {sheets.length === 0 ? (
        <p className="muted">Nothing awaiting approval.</p>
      ) : (
        <table>
          <thead><tr><th>Candidate</th><th>Role</th><th>Week</th><th>Hours</th><th>Notes</th><th>Action</th></tr></thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.id}>
                <td>{s.placements?.profiles?.full_name || s.placements?.profiles?.email || '—'}</td>
                <td>{s.placements?.role_title || '—'}</td>
                <td>{weekLabel(s.week_start)}</td>
                <td>{s.total_hours}</td>
                <td className="muted">{s.notes ? s.notes.slice(0, 50) : '—'}</td>
                <td className="row-actions">
                  <button className="btn sm" onClick={() => decide(s.id, 'approve')}>Approve</button>
                  <button className="btn sm ghost" onClick={() => decide(s.id, 'reject')}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
