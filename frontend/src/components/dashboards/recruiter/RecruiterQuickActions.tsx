import React from 'react';
import { Link } from 'react-router-dom';
import {
  SearchIcon,
  UsersIcon,
  BriefcaseIcon,
  CalendarIcon,
  BuildingIcon,
} from './RecruiterDashboardIcons';

export const RecruiterQuickActions: React.FC = () => {
  return (
    <section className="cb-dashboard-actions-section" aria-labelledby="recruiter-quick-actions-heading">
      <h2 id="recruiter-quick-actions-heading" className="cb-section-title">
        Recruiting Actions & Tools
      </h2>
      <div className="cb-action-grid cb-recruiter-action-grid">
        {/* 1. Talent Discovery */}
        <Link to="/app/recruiter/candidates" className="cb-action-card" data-testid="quick-link-candidates">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <SearchIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Talent Discovery</h3>
              <p className="cb-action-desc">
                Proactively discover and source verified student talent by skills, Experience Passport credentials, and public projects.
              </p>
            </div>
          </div>
        </Link>

        {/* 2. Review Applications */}
        <Link to="/app/recruiter/applications" className="cb-action-card" data-testid="quick-link-applications">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <UsersIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Review Applications</h3>
              <p className="cb-action-desc">
                Triage incoming candidate submissions, evaluate profiles, and update candidate statuses.
              </p>
            </div>
          </div>
        </Link>

        {/* 3. Opportunities */}
        <Link to="/app/jobs" className="cb-action-card" data-testid="quick-link-jobs">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <BriefcaseIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Opportunities</h3>
              <p className="cb-action-desc">
                Browse published opportunities and inspect active candidate demand across roles.
              </p>
            </div>
          </div>
        </Link>

        {/* 4. Interview Coordination */}
        <Link to="/app/recruiter/interviews" className="cb-action-card" data-testid="quick-link-interviews">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <CalendarIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Interview Coordination</h3>
              <p className="cb-action-desc">
                Manage schedule times, update meeting links, reschedule dates, or cancel interview sessions.
              </p>
            </div>
          </div>
        </Link>

        {/* 5. Company Profile */}
        <Link to="/app/recruiter/profile" className="cb-action-card" data-testid="quick-link-profile">
          <div className="cb-action-card-body">
            <span className="cb-action-icon cb-action-icon-custom" aria-hidden="true">
              <BuildingIcon size={24} />
            </span>
            <div>
              <h3 className="cb-action-title">Company Profile</h3>
              <p className="cb-action-desc">
                Maintain your organization name, industry, website, size, and view institutional verification status.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
};
