import React from 'react';
import { Link } from 'react-router-dom';
import { RecruiterDashboard } from '@/types/dashboard';
import { BriefcaseIcon, UsersIcon, ArrowRightIcon } from './RecruiterDashboardIcons';

interface ActiveJobsSnapshotProps {
  dashboard: RecruiterDashboard;
}

export const ActiveJobsSnapshot: React.FC<ActiveJobsSnapshotProps> = ({ dashboard }) => {
  const { active_internships, total_applications } = dashboard;
  const avgApplicantsPerJob =
    active_internships > 0 ? (total_applications / active_internships).toFixed(1) : '0';

  return (
    <section className="cb-active-jobs-snapshot" aria-labelledby="active-jobs-snapshot-heading">
      <div className="cb-snapshot-card">
        <div className="cb-snapshot-header">
          <div className="cb-snapshot-title-group">
            <h2 id="active-jobs-snapshot-heading" className="cb-snapshot-title">
              Active Opportunities & Listings
            </h2>
            <p className="cb-snapshot-subtitle">
              Overview of published roles accepting applications and overall candidate volume.
            </p>
          </div>
          <Link to="/app/recruiter/jobs" className="cb-btn cb-btn-secondary cb-btn-sm cb-snapshot-action-btn">
            <span>Manage Postings</span>
            <ArrowRightIcon size={14} aria-hidden={true} />
          </Link>
        </div>

        <div className="cb-snapshot-stats-row">
          <div className="cb-snapshot-stat-box">
            <div className="cb-snapshot-stat-icon-wrap cb-icon-bg-success">
              <BriefcaseIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-snapshot-stat-text">
              <span className="cb-snapshot-stat-val">{active_internships}</span>
              <span className="cb-snapshot-stat-lbl">Active Roles</span>
            </div>
          </div>

          <div className="cb-snapshot-stat-box">
            <div className="cb-snapshot-stat-icon-wrap cb-icon-bg-primary">
              <UsersIcon size={20} aria-hidden={true} />
            </div>
            <div className="cb-snapshot-stat-text">
              <span className="cb-snapshot-stat-val">{total_applications}</span>
              <span className="cb-snapshot-stat-lbl">Total Candidate Pool</span>
            </div>
          </div>

          <div className="cb-snapshot-stat-box">
            <div className="cb-snapshot-stat-icon-wrap cb-icon-bg-neutral">
              <span className="cb-snapshot-stat-ratio" aria-hidden={true}>⌀</span>
            </div>
            <div className="cb-snapshot-stat-text">
              <span className="cb-snapshot-stat-val">{avgApplicantsPerJob}</span>
              <span className="cb-snapshot-stat-lbl">Avg Applicants / Role</span>
            </div>
          </div>
        </div>

        {active_internships === 0 ? (
          <div className="cb-snapshot-empty-prompt">
            <p>You have no active opportunities published. Create a job listing to start receiving verified student applications.</p>
            <Link to="/app/recruiter/jobs" className="cb-btn cb-btn-primary cb-btn-sm">
              Publish New Opportunity
            </Link>
          </div>
        ) : (
          <div className="cb-snapshot-footer-note">
            <span>Active listings are actively surfaced to qualified students based on skill and project matching.</span>
          </div>
        )}
      </div>
    </section>
  );
};
