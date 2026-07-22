import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function StaffHome() {
  const [stats, setStats] = useState({ candidates: 0, placements: 0, pending: 0, clients: 0 });

  useEffect(() => {
    (async () => {
      const [c, p, ts, cl] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'candidate'),
        supabase.from('placements').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        candidates: c.count || 0,
        placements: p.count || 0,
        pending: ts.count || 0,
        clients: cl.count || 0,
      });
    })();
  }, []);

  return (
    <div>
      <h1>Overview</h1>
      <p className="sub">JumbiTech placement management.</p>

      <div className="grid">
        <Link className="tile" to="/candidates"><h3>{stats.candidates}</h3><p>Active candidates</p></Link>
        <Link className="tile" to="/placements"><h3>{stats.placements}</h3><p>Active placements</p></Link>
        <Link className="tile" to="/approvals"><h3>{stats.pending}</h3><p>Timesheets awaiting approval</p></Link>
        <Link className="tile" to="/clients"><h3>{stats.clients}</h3><p>Client organisations</p></Link>
      </div>
    </div>
  );
}
