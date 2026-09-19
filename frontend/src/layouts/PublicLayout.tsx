import React from 'react';
import { Outlet, Link } from 'react-router-dom';

/**
 * Public Layout Container
 * Used for authentication flows (Login and Register)
 */
export const PublicLayout: React.FC = () => {
  return (
    <div className="cb-public-layout">
      <div className="cb-public-container">
        <header className="cb-public-header">
          <Link to="/" className="cb-brand-title">
            <h1>CareerBridge</h1>
          </Link>
          <p className="cb-brand-subtitle">Student Internship Management Platform</p>
        </header>

        <main className="cb-public-card">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
