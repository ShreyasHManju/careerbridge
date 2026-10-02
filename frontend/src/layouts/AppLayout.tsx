import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

interface NavGroup {
  domain: string;
  label: string;
  links: NavItem[];
}

const getStudentNavGroups = (): NavGroup[] => [
  {
    domain: 'career-os',
    label: 'Career OS',
    links: [
      { to: '/app', label: 'Home', end: true },
      { to: '/app/passport', label: 'Passport' },
      { to: '/app/student/profile', label: 'My Profile' },
      { to: '/app/projects', label: 'Projects' },
      { to: '/app/experiences', label: 'Experiences' },
    ],
  },
  {
    domain: 'opportunities',
    label: 'Opportunities & Funnel',
    links: [
      { to: '/app/jobs', label: 'Opportunities' },
      { to: '/app/saved-jobs', label: 'Saved Jobs' },
      { to: '/app/applications', label: 'My Applications' },
      { to: '/app/interviews', label: 'Interviews' },
    ],
  },
  {
    domain: 'inbox',
    label: 'Inbox',
    links: [
      { to: '/app/messages', label: 'Messages' },
    ],
  },
];

const getNavLinks = (role?: string): NavItem[] => {
  const links: NavItem[] = [
    { to: '/app', label: 'Home', end: true },
  ];

  if (role === 'student') {
    links.push(
      { to: '/app/student/profile', label: 'My Profile' },
      { to: '/app/passport', label: 'Passport' },
      { to: '/app/projects', label: 'Projects' },
      { to: '/app/experiences', label: 'Experiences' },
    );
  }

  if (role === 'recruiter') {
    links.push(
      { to: '/app/recruiter/profile', label: 'Company Profile' },
    );
  }

  links.push({ to: '/app/jobs', label: 'Opportunities' });

  if (role === 'student') {
    links.push(
      { to: '/app/saved-jobs', label: 'Saved Jobs' },
      { to: '/app/applications', label: 'My Applications' },
      { to: '/app/interviews', label: 'Interviews' },
    );
  }

  if (role === 'recruiter') {
    links.push(
      { to: '/app/recruiter/jobs', label: 'Job Postings' },
      { to: '/app/recruiter/applications', label: 'Applications' },
      { to: '/app/recruiter/interviews', label: 'Interviews' },
      { to: '/app/recruiter/experiences/verification', label: 'Experience Verification' },
    );
  }

  if (role === 'admin') {
    links.push(
      { to: '/app/admin/users', label: 'User Management' },
      { to: '/app/admin/recruiters', label: 'Recruiter Verification' },
      { to: '/app/admin/jobs', label: 'Job Moderation' },
      { to: '/app/admin/experiences/verification', label: 'Experience Verification' },
    );
  }

  links.push({ to: '/app/messages', label: 'Messages' });

  return links;
};

/**
 * Authenticated Application Shell
 * Provides domain-grouped responsive navigation, active route styling, user identity, and session management.
 */
export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const isStudent = user?.role === 'student';
  const studentGroups = isStudent ? getStudentNavGroups() : [];
  const standardNavLinks = getNavLinks(user?.role);

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    logout();
    navigate('/login');
  };

  // Close mobile navigation on Escape key or outside click
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="cb-app-layout">
      <header className="cb-navbar" ref={headerRef}>
        <div className="cb-nav-brand">
          <button
            type="button"
            className="cb-mobile-menu-btn"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="cb-mobile-nav-panel"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="cb-mobile-menu-icon" aria-hidden="true">
              {isMobileMenuOpen ? '✕' : '☰'}
            </span>
          </button>
          <Link to="/app" className="cb-logo-text">
            <strong>CareerBridge</strong>
          </Link>
        </div>

        <nav className="cb-nav-links" aria-label="Main Navigation">
          {isStudent ? (
            <div className="cb-student-nav-domains">
              {studentGroups.map((group) => (
                <div key={group.domain} className={`cb-nav-domain-group cb-nav-${group.domain}`}>
                  <span className="cb-nav-domain-label">{group.label}</span>
                  <div className="cb-nav-domain-links">
                    {group.links.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) => `cb-nav-link ${isActive ? 'cb-nav-active' : ''}`}
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            standardNavLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `cb-nav-link ${isActive ? 'cb-nav-active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))
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

        {isMobileMenuOpen && (
          <nav id="cb-mobile-nav-panel" className="cb-mobile-nav-panel" aria-label="Mobile Navigation">
            <div className="cb-mobile-nav-links">
              {isStudent ? (
                <div className="cb-mobile-student-groups">
                  {studentGroups.map((group) => (
                    <div key={`mobile-group-${group.domain}`} className="cb-mobile-group-section">
                      <span className="cb-mobile-group-title">{group.label}</span>
                      <div className="cb-mobile-group-items">
                        {group.links.map((link) => (
                          <NavLink
                            key={`mobile-${link.to}`}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) => `cb-nav-link ${isActive ? 'cb-nav-active' : ''}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {link.label}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                standardNavLinks.map((link) => (
                  <NavLink
                    key={`mobile-${link.to}`}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `cb-nav-link ${isActive ? 'cb-nav-active' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))
              )}
            </div>
          </nav>
        )}
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

