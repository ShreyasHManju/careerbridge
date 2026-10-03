import React from 'react';
import { Link } from 'react-router-dom';
import { AdminDashboard } from '@/types/dashboard';
import {
  UsersIcon,
  BuildingIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  BarChartIcon,
  AwardIcon,
} from './AdminDashboardIcons';

interface PlatformHealthSnapshotProps {
  dashboard: AdminDashboard;
}

export const PlatformHealthSnapshot: React.FC<PlatformHealthSnapshotProps> = ({ dashboard }) => {
  return (
    <section aria-labelledby="admin-kpi-heading" className="cb-platform-health-section">
      <h2 id="admin-kpi-heading" className="cb-sr-only">
        Platform Key Performance Indicators
      </h2>
      <div className="cb-stat-grid cb-admin-stat-grid">
        {/* 1. Total Students */}
        <Link
          to="/app/admin/users?role=student"
          className="cb-stat-card cb-stat-primary cb-stat-card-link"
          data-testid="metric-total-students"
          aria-label="View registered student accounts"
        >
          <div className="cb-stat-card-top">
            <span className="cb-stat-label">Total Students</span>
            <span className="cb-stat-icon-badge cb-stat-icon-primary" aria-hidden="true">
              <UsersIcon size={16} />
            </span>
          </div>
          <span className="cb-stat-value">{dashboard.total_students}</span>
          <span className="cb-stat-desc">Registered student accounts</span>
        </Link>

        {/* 2. Total Companies */}
        <Link
          to="/app/admin/users?role=recruiter"
          className="cb-stat-card cb-stat-info cb-stat-card-link"
          data-testid="metric-total-companies"
          aria-label="View registered recruiter accounts"
        >
          <div className="cb-stat-card-top">
            <span className="cb-stat-label">Total Companies</span>
            <span className="cb-stat-icon-badge cb-stat-icon-info" aria-hidden="true">
              <BuildingIcon size={16} />
            </span>
          </div>
          <span className="cb-stat-value">{dashboard.total_companies}</span>
          <span className="cb-stat-desc">Registered recruiter accounts</span>
        </Link>

        {/* 3. Verified Companies */}
        <Link
          to="/app/admin/recruiters?is_verified=true"
          className="cb-stat-card cb-stat-success cb-stat-card-link"
          data-testid="metric-verified-companies"
          aria-label="View administratively verified organizations"
        >
          <div className="cb-stat-card-top">
            <span className="cb-stat-label">Verified Organizations</span>
            <span className="cb-stat-icon-badge cb-stat-icon-success" aria-hidden="true">
              <ShieldCheckIcon size={16} />
            </span>
          </div>
          <span className="cb-stat-value">{dashboard.verified_companies}</span>
          <span className="cb-stat-desc">Administratively verified</span>
        </Link>

        {/* 4. Published Internships */}
        <Link
          to="/app/admin/jobs?is_active=true"
          className="cb-stat-card cb-stat-card-link"
          data-testid="metric-published-internships"
          aria-label="View active published opportunities"
        >
          <div className="cb-stat-card-top">
            <span className="cb-stat-label">Active Opportunities</span>
            <span className="cb-stat-icon-badge cb-stat-icon-default" aria-hidden="true">
              <BriefcaseIcon size={16} />
            </span>
          </div>
          <span className="cb-stat-value">{dashboard.published_internships}</span>
          <span className="cb-stat-desc">Currently published postings</span>
        </Link>

        {/* 5. Total Applications */}
        <Link
          to="/app/admin/jobs"
          className="cb-stat-card cb-stat-card-link"
          data-testid="metric-total-applications"
          aria-label="View platform-wide job postings"
        >
          <div className="cb-stat-card-top">
            <span className="cb-stat-label">Total Applications</span>
            <span className="cb-stat-icon-badge cb-stat-icon-default" aria-hidden="true">
              <BarChartIcon size={16} />
            </span>
          </div>
          <span className="cb-stat-value">{dashboard.total_applications}</span>
          <span className="cb-stat-desc">Platform-wide submissions</span>
        </Link>

        {/* 6. Application Success Rate */}
        <div className="cb-stat-card cb-stat-warning" data-testid="metric-application-success-rate">
          <div className="cb-stat-card-top">
            <span className="cb-stat-label">Application Success Rate</span>
            <span className="cb-stat-icon-badge cb-stat-icon-warning" aria-hidden="true">
              <AwardIcon size={16} />
            </span>
          </div>
          <span className="cb-stat-value">
            {dashboard.application_success_rate.toFixed(1)}%
          </span>
          <span className="cb-stat-desc">Accepted vs total submissions</span>
        </div>
      </div>
    </section>
  );
};
