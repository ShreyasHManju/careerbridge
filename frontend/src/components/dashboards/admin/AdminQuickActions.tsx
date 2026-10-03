import React from 'react';
import { Link } from 'react-router-dom';
import {
  UsersIcon,
  BuildingIcon,
  BriefcaseIcon,
  AwardIcon,
} from './AdminDashboardIcons';

export const AdminQuickActions: React.FC = () => {
  return (
    <section className="cb-dashboard-actions-section" aria-labelledby="admin-governance-heading">
      <h2 id="admin-governance-heading" className="cb-section-title">
        Platform Governance & Moderation
      </h2>
      <div className="cb-action-grid cb-admin-action-grid">
        {/* 1. User Account Administration */}
        <Link to="/app/admin/users" className="cb-action-card" data-testid="quick-link-admin-users">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <UsersIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">User Account Administration</h3>
              <p className="cb-action-desc">
                Review student and recruiter accounts, toggle activation, and export directory CSV.
              </p>
            </div>
          </div>
        </Link>

        {/* 2. Recruiter Verification */}
        <Link to="/app/admin/recruiters" className="cb-action-card" data-testid="quick-link-admin-recruiters">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <BuildingIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Recruiter Verification</h3>
              <p className="cb-action-desc">
                Inspect hiring company profiles, assess credentials, and manage verification badges.
              </p>
            </div>
          </div>
        </Link>

        {/* 3. Job Postings Moderation */}
        <Link to="/app/admin/jobs" className="cb-action-card" data-testid="quick-link-admin-jobs">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <BriefcaseIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Job Postings Moderation</h3>
              <p className="cb-action-desc">
                Inspect and moderate all active and inactive job postings across all hiring companies.
              </p>
            </div>
          </div>
        </Link>

        {/* 4. Student Experience Verification */}
        <Link
          to="/app/admin/experience-verification"
          className="cb-action-card"
          data-testid="quick-link-admin-experiences"
        >
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <AwardIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Experience Verification</h3>
              <p className="cb-action-desc">
                Adjudicate student milestone and verified experience claims across all partner organizations.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
};
