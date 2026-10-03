import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  BriefcaseIcon,
  AwardIcon,
  SparklesIcon,
  ArrowRightIcon,
} from './AdminDashboardIcons';

export const TrustSafetyPulse: React.FC = () => {
  return (
    <section className="cb-trust-safety-pulse" aria-labelledby="trust-safety-pulse-heading">
      <div className="cb-trust-pulse-card">
        <div className="cb-trust-pulse-header">
          <div className="cb-trust-pulse-title-group">
            <div className="cb-trust-badge-row">
              <span className="cb-trust-os-badge">
                <SparklesIcon size={13} aria-hidden={true} />
                <span>Platform Governance & Trust Architecture</span>
              </span>
            </div>
            <h2 id="trust-safety-pulse-heading" className="cb-trust-pulse-title">
              Ecosystem Trust & Verification Loop
            </h2>
            <p className="cb-trust-pulse-subtitle">
              CareerBridge enforces a multi-tier trust model: employer vetting, opportunity moderation, and student credential verification.
            </p>
          </div>
        </div>

        <div className="cb-trust-features-grid">
          {/* Loop Step 1: Employer Verification */}
          <div className="cb-trust-feature-card">
            <div className="cb-trust-feature-icon cb-icon-bg-primary">
              <ShieldCheckIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-trust-feature-content">
              <h3 className="cb-trust-feature-title">1. Employer Vetting</h3>
              <p className="cb-trust-feature-desc">
                Review corporate credentials, legal entity legitimacy, and verified domains before granting institutional posting authority.
              </p>
            </div>
            <Link to="/app/admin/recruiters" className="cb-trust-feature-link">
              <span>Recruiters</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>

          {/* Loop Step 2: Opportunity Moderation */}
          <div className="cb-trust-feature-card">
            <div className="cb-trust-feature-icon cb-icon-bg-success">
              <BriefcaseIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-trust-feature-content">
              <h3 className="cb-trust-feature-title">2. Opportunity Audit</h3>
              <p className="cb-trust-feature-desc">
                Audit internship and job postings across all hiring companies to prevent fraudulent, predatory, or non-compliant listings.
              </p>
            </div>
            <Link to="/app/admin/jobs" className="cb-trust-feature-link">
              <span>Postings</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>

          {/* Loop Step 3: Experience Record Validation */}
          <div className="cb-trust-feature-card">
            <div className="cb-trust-feature-icon cb-icon-bg-warning">
              <AwardIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-trust-feature-content">
              <h3 className="cb-trust-feature-title">3. Experience Verification</h3>
              <p className="cb-trust-feature-desc">
                Confirm student work records and project evaluations to maintain authoritative Career Passports across the ecosystem.
              </p>
            </div>
            <Link to="/app/admin/experience-verification" className="cb-trust-feature-link">
              <span>Claims</span>
              <ArrowRightIcon size={14} aria-hidden={true} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
