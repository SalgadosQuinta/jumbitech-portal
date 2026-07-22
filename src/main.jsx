import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Shell from './components/Shell';
import Login from './pages/Login';
import MfaSetup from './pages/MfaSetup';

// Candidate pages
import CandidateHome from './pages/candidate/Home';
import Timesheets from './pages/candidate/Timesheets';
import Contracts from './pages/candidate/Contracts';
import CandidateProfile from './pages/candidate/Profile';

// Staff pages
import StaffHome from './pages/staff/Home';
import Candidates from './pages/staff/Candidates';
import Placements from './pages/staff/Placements';
import Approvals from './pages/staff/Approvals';
import Clients from './pages/staff/Clients';

// Client pages
import ClientHome from './pages/client/Home';
import ClientPlacements from './pages/client/Placements';
import ClientApprovals from './pages/client/Approvals';

import './styles.css';
import { APP_BUILD } from './lib/config';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
console.log('JumbiTech Portal build', APP_BUILD);

function Protected() {
  const { loading, session, role, hasMfaEnrolled, mfaSatisfied } = useAuth();

  if (loading) return <div className="spinner">Loading…</div>;
  if (!session) return <Login />;

  // Force MFA: if no factor enrolled, or enrolled but this session has not yet
  // satisfied the challenge, send to the MFA flow.
  if (!hasMfaEnrolled) return <MfaSetup />;
  if (!mfaSatisfied) return <Login />; // enrolled but not verified this session

  if (!role) return <div className="spinner">Setting up your account…</div>;

  return (
    <Shell>
      <Routes>
        {role === 'candidate' && (
          <>
            <Route path="/" element={<CandidateHome />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/profile" element={<CandidateProfile />} />
          </>
        )}
        {role === 'staff' && (
          <>
            <Route path="/" element={<StaffHome />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/placements" element={<Placements />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/clients" element={<Clients />} />
          </>
        )}
        {role === 'client' && (
          <>
            <Route path="/" element={<ClientHome />} />
            <Route path="/placements" element={<ClientPlacements />} />
            <Route path="/approvals" element={<ClientApprovals />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <Protected />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
