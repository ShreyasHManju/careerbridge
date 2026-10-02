import React from 'react';
import { Link } from 'react-router-dom';
import { PassportIcon, ArrowRightIcon } from './StudentDashboardIcons';

export const PassportBanner: React.FC = () => {
  return (
    <section className="cb-passport-banner-section" aria-label="Career Passport overview">
      <div className="cb-passport-banner">
        <div className="cb-passport-banner-icon-bg" aria-hidden="true">
          <PassportIcon size={48} className="cb-passport-banner-icon" />
        </div>
        <div className="cb-passport-banner-content">
          <span className="cb-passport-badge">Unified Student Identity</span>
          <h2 className="cb-passport-banner-title">Your Career Passport</h2>
          <p className="cb-passport-banner-desc">
            Your verified projects, experiences, skills, and evaluations — organized into a single, shareable career identity for employers.
          </p>
        </div>
        <div className="cb-passport-banner-actions">
          <Link to="/app/passport" className="cb-btn cb-btn-primary cb-passport-cta-btn">
            <span>View Career Passport</span>
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};
