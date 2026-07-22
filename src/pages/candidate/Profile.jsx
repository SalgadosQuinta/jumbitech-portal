import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function CandidateProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [form, setForm] = useState({ headline: '', phone: '', location: '', skills: '', bio: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('candidate_profiles')
      .select('*')
      .eq('candidate_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm({ headline: data.headline, phone: data.phone, location: data.location, skills: data.skills, bio: data.bio });
      });
  }, [user.id]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true);
    setMsg(null);
    // Update display name on the auth profile.
    await supabase.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', user.id);
    // Upsert the extended candidate profile.
    const { error } = await supabase.from('candidate_profiles').upsert({
      candidate_id: user.id,
      ...form,
      updated_at: new Date().toISOString(),
    });
    if (error) setMsg({ type: 'err', text: error.message });
    else { setMsg({ type: 'ok', text: 'Profile saved.' }); refreshProfile(); }
    setBusy(false);
  }

  return (
    <div>
      <h1>My profile</h1>
      <p className="sub">Keep your details up to date for JumbiTech and your placement.</p>
      {msg && <div className={`card ${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <label>Full name</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <label>Headline</label>
        <input type="text" value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="e.g. Senior Cyber Security Engineer" />
        <label>Phone</label>
        <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <label>Location</label>
        <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} />
        <label>Skills</label>
        <input type="text" value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Comma separated" />
        <label>About</label>
        <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </div>
    </div>
  );
}
