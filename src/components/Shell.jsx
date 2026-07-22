import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_BUILD } from '../lib/config';

const NAV = {
  candidate: [
    ['/', 'Overview', true],
    ['/timesheets', 'Timesheets'],
    ['/contracts', 'Contracts'],
    ['/profile', 'My profile'],
  ],
  staff: [
    ['/', 'Overview', true],
    ['/candidates', 'Candidates'],
    ['/placements', 'Placements'],
    ['/approvals', 'Approvals'],
    ['/clients', 'Clients'],
  ],
  client: [
    ['/', 'Overview', true],
    ['/placements', 'Placements'],
    ['/approvals', 'Approvals'],
  ],
};

export default function Shell({ children }) {
  const { profile, role, signOut } = useAuth();
  const items = NAV[role] || [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Jumbi<span>Tech</span></div>
        <nav>
          {items.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <span className="who">{profile?.full_name || profile?.email} · {role}</span>
        <button className="btn ghost sm" onClick={signOut}>Log out</button>
      </header>
      <main className="container">{children}</main>
      <footer className="container muted" style={{ fontSize: '.78rem', paddingTop: 0 }}>
        Build {APP_BUILD} · {navigator.onLine ? 'online' : 'offline'} · {profile?.role || 'no role'}
      </footer>
    </div>
  );
}
