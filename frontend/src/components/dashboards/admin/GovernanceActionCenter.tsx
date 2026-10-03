import React from 'react';
import { Link } from 'react-router-dom';
import { AdminDashboard } from '@/types/dashboard';
import {
  ShieldCheckIcon,
  BriefcaseIcon,
  AwardIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
} from './AdminDashboardIcons';

interface GovernanceActionCenterProps {
  dashboard: AdminDashboard;
}

export const GovernanceActionCenter: React.FC<GovernanceActionCenterProps> = ({ dashboard }) => {
  const unverifiedCompanies = Math.max(0, dashboard.total_companies - dashboard.verified_companies);

  return (
    <section className="cb-governance-action-center" aria-labelledby="governance-action-heading">
      <div className="cb-section-header-compact">
        <div>
          <h2 id="governance-action-heading" className="cb-section-title-sm">
            Platform Governance Action Center
          </h2>
          <span className="cb-section-hint">
            Prioritized operational queue for institutional vetting, content moderation, and trust validation
          </span>
        </div>
      </div>

      <div className="cb-action-cards-deck cb-governance-deck">
        {/* Action 1: Recruiter Organization Verification */}
        <div className="cb-priority-action-card cb-governance-card">
          <div className="cb-card-top-row">
            <div
              className={`cb-priority-action-badge ${
                unverifiedCompanies > 0 ? 'cb-badge-urgent' : 'cb-badge-neutral'
              }`}
            >
              {unverifiedCompanies > 0 ? (
                <>
                  <AlertTriangleIcon size={12} aria-hidden={true} />
                  <span>{unverifiedCompanies} Unverified</span>
                </>
              ) : (
                <>
                  <ShieldCheckIcon size={12} aria-hidden={true} />
                  <span>All Verified</span>
                </>
              )}
            </div>
            <span className="cb-governance-category">Recruiter Governance</span>
          </div>

          <div className="cb-priority-action-content">
            <h3 className="cb-priority-action-title">Organization Credential Vetting</h3>
            <p className="cb-priority-action-desc">
              {unverifiedCompanies > 0
                ? `${unverifiedCompanies} hiring ${
                    unverifiedCompanies === 1 ? 'organization requires' : 'organizations require'
                  } verification vetting, business authenticity checks, and domain proof.`
                : 'All registered hiring organizations currently have verified institutional status.'}
            </p>
          </div>

          <Link
            to={unverifiedCompanies > 0 ? '/app/admin/recruiters?is_verified=false' : '/app/admin/recruiters'}
            className="cb-priority-action-btn"
          >
            <span>{unverifiedCompanies > 0 ? 'Review Queue' : 'Manage Recruiters'}</span>
            <ArrowRightIcon size={14} aria-hidden={true} />
          </Link>
        </div>

        {/* Action 2: Job Postings Moderation */}
        <div className="cb-priority-action-card cb-governance-card">
          <div className="cb-card-top-row">
            <div className="cb-priority-action-badge cb-badge-neutral">
              <BriefcaseIcon size={12} aria-hidden={true} />
              <span>{dashboard.published_internships} Active</span>
            </div>
            <span className="cb-governance-category">Content Moderation</span>
          </div>

          <div className="cb-priority-action-content">
            <h3 className="cb-priority-action-title">Opportunity Moderation Queue</h3>
            <p className="cb-priority-action-desc">
              Inspect published opportunities, verify salary transparency, assess role compliance, and toggle public visibility.
            </p>
          </div>

          <Link to="/app/admin/jobs" className="cb-priority-action-btn">
            <span>Moderate Postings</span>
            <ArrowRightIcon size={14} aria-hidden={true} />
          </Link>
        </div>

        {/* Action 3: Student Experience Claims Moderation */}
        <div className="cb-priority-action-card cb-governance-card">
          <div className="cb-card-top-row">
            <div className="cb-priority-action-badge cb-badge-highlight">
              <AwardIcon size={12} aria-hidden={true} />
              <span>Trust & Safety</span>
            </div>
            <span className="cb-governance-category">Experience Claims</span>
          </div>

          <div className="cb-priority-action-content">
            <h3 className="cb-priority-action-title">Experience Verification Queue</h3>
            <p className="cb-priority-action-desc">
              Audit and adjudicate platform-wide student work, research, and internship claims with supervisor validation.
            </p>
          </div>

          <Link to="/app/admin/experience-verification" className="cb-priority-action-btn">
            <span>Review Claims</span>
            <ArrowRightIcon size={14} aria-hidden={true} />
          </Link>
        </div>
      </div>
    </section>
  );
};
