import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ClientHome() {
  const [counts, setCounts] = useState({ placements: 0, pending: 0 });

  useEffect(() => {
    (async () => {
      const [p, ts] = await Promise.all([
        supabase.from('placements').select('id', { count: 'exact', head: true }),
        supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      ]);
      setCounts({ placements: p.count || 0, pending: ts.count || 0 });
    })();
  }, []);

  return (
    <div>
      <h1>Overview</h1>
      <p className="sub">Your placements and timesheet approvals with JumbiTech.</p>
      <div className="grid">
        <Link className="tile" to="/placements"><h3>{counts.placements}</h3><p>Placements with your organisation</p></Link>
        <Link className="tile" to="/approvals"><h3>{counts.pending}</h3><p>Timesheets awaiting approval</p></Link>
      </div>
    </div>
  );
}
