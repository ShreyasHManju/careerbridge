import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

/**
 * Minimal Authenticated Application Shell
 * Demonstrates CareerBridge branding, navigation placeholder, user identity, and sign-out.
 */
export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="cb-app-layout">
      <header className="cb-navbar">
        <div className="cb-nav-brand">
          <Link to="/app" className="cb-logo-text">
            <strong>CareerBridge</strong>
          </Link>
          <span className="cb-env-badge">v1.0 Foundation</span>
        </div>

        <nav className="cb-nav-links">
          <Link to="/app" className="cb-nav-link">Home</Link>
          {user?.role === 'student' && (
            <Link to="/app/student/profile" className="cb-nav-link">My Profile</Link>
          )}
          {user?.role === 'recruiter' && (
            <Link to="/app/recruiter/profile" className="cb-nav-link">Company Profile</Link>
          )}
          <Link to="/app/jobs" className="cb-nav-link">Opportunities</Link>
          <span className="cb-nav-placeholder">Applications (Phase 5)</span>
        </nav>

        <div className="cb-nav-user">
          {user && (
            <div className="cb-user-pill">
              <span className="cb-user-email">{user.email}</span>
              <span className={`cb-role-tag cb-role-${user.role}`}>
                {user.role}
              </span>
              {user.is_verified && (
                <span className="cb-verified-badge" title="Verified Account">✓ Verified</span>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            type="button"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="cb-main-content">
        <Outlet />
      </main>

      <footer className="cb-footer">
        <p>CareerBridge Student Internship Platform &copy; 2026. All rights reserved.</p>
      </footer>
    </div>
  );
};
