import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { DAYS, mondayOf, weekLabel, sumHours } from '../../lib/dates';

export default function Timesheets() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [placementId, setPlacementId] = useState('');
  const [weekStart] = useState(mondayOf());
  const [hours, setHours] = useState({});
  const [notes, setNotes] = useState('');
  const [existing, setExisting] = useState(null);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('timesheets')
      .select('id, week_start, total_hours, status, placement_id')
      .order('week_start', { ascending: false });
    setHistory(data || []);
  }, []);

  useEffect(() => {
    supabase
      .from('placements')
      .select('id, role_title, clients(name)')
      .eq('active', true)
      .then(({ data }) => {
        setPlacements(data || []);
        if (data && data.length) setPlacementId(data[0].id);
      });
    loadHistory();
  }, [loadHistory]);

  // When the selected placement changes, load any existing sheet for this week.
  useEffect(() => {
    if (!placementId) return;
    supabase
      .from('timesheets')
      .select('*')
      .eq('placement_id', placementId)
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }) => {
        setExisting(data || null);
        setHours(data?.hours || {});
        setNotes(data?.notes || '');
      });
  }, [placementId, weekStart]);

  const locked = existing && ['approved', 'locked'].includes(existing.status);

  function setDay(key, value) {
    const v = Math.max(0, Math.min(24, Number(value) || 0));
    setHours((h) => ({ ...h, [key]: v }));
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    const total = sumHours(hours);
    const payload = {
      placement_id: placementId,
      candidate_id: user.id,
      week_start: weekStart,
      hours,
      total_hours: total,
      notes,
      status: 'submitted',
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from('timesheets').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('timesheets').insert(payload));
    }

    if (error) {
      setMsg({ type: 'err', text: error.message });
    } else {
      setMsg({ type: 'ok', text: 'Your timesheet has been submitted.' });
      await loadHistory();
    }
    setBusy(false);
  }

  return (
    <div>
      <h1>Weekly timesheet</h1>
      <p className="sub">{weekLabel(weekStart)}</p>

      {msg && <div className={`card ${msg.type}`}>{msg.text}</div>}

      {placements.length === 0 ? (
        <div className="card">You have no active placement yet. JumbiTech will set one up before you submit timesheets.</div>
      ) : (
        <>
          {placements.length > 1 && (
            <>
              <label>Placement</label>
              <select value={placementId} onChange={(e) => setPlacementId(e.target.value)}>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>{p.role_title || 'Placement'}{p.clients?.name ? ` · ${p.clients.name}` : ''}</option>
                ))}
              </select>
            </>
          )}

          {existing && <p><strong>Current status:</strong> <span className={`pill ${existing.status}`}>{existing.status}</span></p>}

          {locked ? (
            <div className="card warn">This week is approved and locked. Contact JumbiTech if a change is needed.</div>
          ) : (
            <div className="card">
              <table>
                <thead><tr><th>Day</th><th>Hours</th></tr></thead>
                <tbody>
                  {DAYS.map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td><input type="number" step="0.25" min="0" max="24" value={hours[key] ?? ''} onChange={(e) => setDay(key, e.target.value)} /></td>
                    </tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td><strong>{sumHours(hours)}</strong></td></tr>
                </tbody>
              </table>
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div style={{ marginTop: '1rem' }}>
                <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : existing ? 'Update timesheet' : 'Submit timesheet'}</button>
              </div>
            </div>
          )}
        </>
      )}

      <h2>Submission history</h2>
      {history.length === 0 ? (
        <p className="muted">No timesheets submitted yet.</p>
      ) : (
        <table>
          <thead><tr><th>Week</th><th>Total hours</th><th>Status</th></tr></thead>
          <tbody>
            {history.map((t) => (
              <tr key={t.id}>
                <td>{weekLabel(t.week_start)}</td>
                <td>{t.total_hours}</td>
                <td><span className={`pill ${t.status}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
