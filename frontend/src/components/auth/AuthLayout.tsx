import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
  footer,
}) => {
  return (
    <div className="cb-cinematic-auth">
      {/* Full-screen cinematic background layers */}
      <div className="cb-auth-bg-layers" aria-hidden="true">
        <div className="cb-bg-mesh" />
        <div className="cb-bg-glow cb-bg-glow-1" />
        <div className="cb-bg-glow cb-bg-glow-2" />
        <div className="cb-bg-glow cb-bg-glow-cyan" />
        <div className="cb-bg-horizon" />
        <div className="cb-bg-stars" />
      </div>

      {/* Centered Single Vertical Glass Card */}
      <main className="cb-auth-stage">
        <section className="cb-glass-card">
          {/* Logo */}
          <div className="cb-glass-brand">
            <Link to="/" className="cb-brand-logo-link" aria-label="CareerBridge Home">
              <img
                src="/images/careerbridge-logo.png"
                alt="CareerBridge"
                className="cb-glass-logo"
              />
            </Link>
          </div>

          {/* Heading */}
          <header className="cb-glass-header">
            <h1 className="cb-glass-title">{title}</h1>
            <p className="cb-glass-subtitle">{subtitle}</p>
          </header>

          {/* Form Content */}
          <div className="cb-glass-body">
            {children}
          </div>

          {/* Footer Switch Navigation */}
          {footer && (
            <footer className="cb-glass-footer">
              {footer}
            </footer>
          )}

          {/* Subtle Security Reassurance */}
          <div className="cb-glass-security" aria-label="Security Notice">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Secure authentication &middot; 256-bit encrypted</span>
          </div>
        </section>
      </main>
    </div>
  );
};
