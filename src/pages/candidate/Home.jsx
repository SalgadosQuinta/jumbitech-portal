import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/dates';

export default function CandidateHome() {
  const { profile } = useAuth();
  const [placements, setPlacements] = useState([]);

  useEffect(() => {
    supabase
      .from('placements')
      .select('id, role_title, day_rate, currency, active, clients(name)')
      .eq('active', true)
      .then(({ data }) => setPlacements(data || []));
  }, []);

  return (
    <div>
      <h1>Welcome, {profile?.full_name || 'candidate'}</h1>
      <p className="sub">Your JumbiTech placements, timesheets and documents in one place.</p>

      {placements.length > 0 && (
        <div className="card accent">
          <h3 style={{ marginTop: 0 }}>Current placement</h3>
          {placements.map((p) => (
            <p key={p.id} style={{ margin: '.25rem 0' }}>
              {p.role_title || 'Placement'}{p.clients?.name ? ` · ${p.clients.name}` : ''}
              {p.day_rate ? ` · ${money(p.day_rate, p.currency)}/day` : ''}
            </p>
          ))}
        </div>
      )}

      <div className="grid">
        <Link className="tile" to="/timesheets">
          <h3>Submit a timesheet</h3>
          <p>Enter your hours for the week and submit for approval.</p>
        </Link>
        <Link className="tile" to="/contracts">
          <h3>View contracts</h3>
          <p>Download the documents relating to your placement.</p>
        </Link>
        <Link className="tile" to="/profile">
          <h3>My profile</h3>
          <p>Keep your details and skills up to date.</p>
        </Link>
      </div>
    </div>
  );
}
