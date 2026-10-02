import React from 'react';
import { Link } from 'react-router-dom';
import { StudentDashboard } from '@/types/dashboard';

interface ApplicationJourneyProps {
  dashboard: StudentDashboard;
}

export const ApplicationJourney: React.FC<ApplicationJourneyProps> = ({ dashboard }) => {
  return (
    <section className="cb-app-journey-section" aria-labelledby="application-journey-heading">
      <div className="cb-section-header">
        <h2 id="application-journey-heading" className="cb-section-title">
          Application Journey & Funnel
        </h2>
        <p className="cb-section-subtitle">
          Real-time review states across your active candidate submissions and interviews.
        </p>
      </div>

      <div className="cb-stat-grid cb-application-funnel-grid">
        {/* 1. Total Applications */}
        <Link
          to="/app/applications"
          className="cb-stat-card cb-stat-card-link cb-funnel-stage"
          data-testid="metric-total-applications"
          aria-label="View all submitted applications"
        >
          <div className="cb-funnel-stage-header">
            <span className="cb-funnel-step-tag">Step 1</span>
            <span className="cb-stat-label">Total Applications</span>
          </div>
          <span className="cb-stat-value">{dashboard.total_applications}</span>
          <span className="cb-stat-desc">Submitted applications</span>
        </Link>

        {/* 2. Under Review */}
        <Link
          to="/app/applications?status=reviewing"
          className="cb-stat-card cb-stat-warning cb-stat-card-link cb-funnel-stage"
          data-testid="metric-applications-under-review"
          aria-label="View applications under review"
        >
          <div className="cb-funnel-stage-header">
            <span className="cb-funnel-step-tag">Step 2</span>
            <span className="cb-stat-label">Under Review</span>
          </div>
          <span className="cb-stat-value">{dashboard.applications_under_review}</span>
          <span className="cb-stat-desc">Being evaluated by recruiters</span>
        </Link>

        {/* 3. Shortlisted */}
        <Link
          to="/app/applications?status=shortlisted"
          className="cb-stat-card cb-stat-info cb-stat-card-link cb-funnel-stage"
          data-testid="metric-shortlisted-applications"
          aria-label="View shortlisted applications"
        >
          <div className="cb-funnel-stage-header">
            <span className="cb-funnel-step-tag">Step 3</span>
            <span className="cb-stat-label">Shortlisted</span>
          </div>
          <span className="cb-stat-value">{dashboard.shortlisted_applications}</span>
          <span className="cb-stat-desc">Advanced to shortlist</span>
        </Link>

        {/* 4. Upcoming Interviews */}
        <Link
          to="/app/interviews"
          className="cb-stat-card cb-stat-primary cb-stat-card-link cb-funnel-stage"
          data-testid="metric-upcoming-interviews"
          aria-label="View scheduled future interviews"
        >
          <div className="cb-funnel-stage-header">
            <span className="cb-funnel-step-tag">Step 4</span>
            <span className="cb-stat-label">Upcoming Interviews</span>
          </div>
          <span className="cb-stat-value">{dashboard.upcoming_interviews}</span>
          <span className="cb-stat-desc">Scheduled future interviews</span>
        </Link>

        {/* 5. Accepted Offers */}
        <Link
          to="/app/applications?status=accepted"
          className="cb-stat-card cb-stat-success cb-stat-card-link cb-funnel-stage"
          data-testid="metric-accepted-applications"
          aria-label="View accepted application offers"
        >
          <div className="cb-funnel-stage-header">
            <span className="cb-funnel-step-tag">Step 5</span>
            <span className="cb-stat-label">Accepted Offers</span>
          </div>
          <span className="cb-stat-value">{dashboard.accepted_applications}</span>
          <span className="cb-stat-desc">Accepted by employers</span>
        </Link>

        {/* 6. Saved Opportunities */}
        <Link
          to="/app/saved-jobs"
          className="cb-stat-card cb-stat-card-link cb-funnel-stage"
          data-testid="metric-saved-internships"
          aria-label="View bookmarked opportunities"
        >
          <div className="cb-funnel-stage-header">
            <span className="cb-funnel-step-tag">Bookmark</span>
            <span className="cb-stat-label">Saved Opportunities</span>
          </div>
          <span className="cb-stat-value">{dashboard.saved_internships}</span>
          <span className="cb-stat-desc">Bookmarked for later</span>
        </Link>
      </div>
    </section>
  );
};
