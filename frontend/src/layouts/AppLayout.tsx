import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

/**
 * Minimal Authenticated Application Shell
 * Demonstrates CareerBridge branding, navigation, user identity, and sign-out.
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
          {user?.role === 'student' && (
            <Link to="/app/saved-jobs" className="cb-nav-link">Saved Jobs</Link>
          )}
          {user?.role === 'student' && (
            <Link to="/app/applications" className="cb-nav-link">My Applications</Link>
          )}
          {user?.role === 'student' && (
            <Link to="/app/interviews" className="cb-nav-link">Interviews</Link>
          )}
          {user?.role === 'recruiter' && (
            <Link to="/app/recruiter/applications" className="cb-nav-link">Applications</Link>
          )}
          {user?.role === 'recruiter' && (
            <Link to="/app/recruiter/interviews" className="cb-nav-link">Interviews</Link>
          )}
        </nav>

        <div className="cb-nav-user">
          {user && (
            <>
              <NotificationDrawer />
              <div className="cb-user-pill">
                <span className="cb-user-email">{user.email}</span>
                <span className={`cb-role-tag cb-role-${user.role}`}>
                  {user.role}
                </span>
                {user.is_verified && (
                  <span className="cb-verified-badge" title="Verified Account">✓ Verified</span>
                )}
              </div>
            </>
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
