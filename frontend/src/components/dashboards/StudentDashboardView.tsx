import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { StudentDashboard } from '@/types/dashboard';
import { getStudentDashboard } from '@/api/dashboards';
import { ApiErrorResponse } from '@/types/api';

export const StudentDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getStudentDashboard();
      setDashboard(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const message =
        (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
        apiError?.message ||
        'Failed to load student dashboard. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="cb-dashboard-loading" role="status" aria-live="polite">
        <div className="cb-spinner" aria-hidden="true" />
        <p>Loading your student dashboard metrics...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="cb-dashboard-error-container" role="alert">
        <div className="cb-alert cb-alert-danger">
          <p className="cb-alert-message">{errorMessage}</p>
        </div>
        <button
          type="button"
          onClick={fetchDashboardData}
          className="cb-btn cb-btn-primary cb-retry-btn"
          data-testid="retry-student-dashboard-btn"
        >
          Retry Loading Dashboard
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="cb-dashboard-container" data-testid="student-dashboard-view">
      {/* Header */}
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Student Dashboard</h1>
          <p className="cb-page-subtitle">
            Overview of your internship application funnel, upcoming interviews, and saved opportunities.
          </p>
        </div>
        <div className="cb-page-header-actions">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            title="Refresh dashboard metrics"
            data-testid="refresh-student-dashboard-btn"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Six Canonical Metric Cards */}
      <section aria-labelledby="student-metrics-heading">
        <h2 id="student-metrics-heading" className="cb-sr-only">
          Application and Opportunity Metrics
        </h2>
        <div className="cb-stat-grid">
          {/* 1. Total Applications */}
          <div className="cb-stat-card" data-testid="metric-total-applications">
            <span className="cb-stat-label">Total Applications</span>
            <span className="cb-stat-value">{dashboard.total_applications}</span>
            <span className="cb-stat-desc">Submitted applications</span>
          </div>

          {/* 2. Under Review */}
          <div className="cb-stat-card cb-stat-warning" data-testid="metric-applications-under-review">
            <span className="cb-stat-label">Under Review</span>
            <span className="cb-stat-value">{dashboard.applications_under_review}</span>
            <span className="cb-stat-desc">Being evaluated by recruiters</span>
          </div>

          {/* 3. Shortlisted */}
          <div className="cb-stat-card cb-stat-info" data-testid="metric-shortlisted-applications">
            <span className="cb-stat-label">Shortlisted</span>
            <span className="cb-stat-value">{dashboard.shortlisted_applications}</span>
            <span className="cb-stat-desc">Advanced to shortlist</span>
          </div>

          {/* 4. Accepted */}
          <div className="cb-stat-card cb-stat-success" data-testid="metric-accepted-applications">
            <span className="cb-stat-label">Accepted Offers</span>
            <span className="cb-stat-value">{dashboard.accepted_applications}</span>
            <span className="cb-stat-desc">Accepted by employers</span>
          </div>

          {/* 5. Saved Internships */}
          <div className="cb-stat-card" data-testid="metric-saved-internships">
            <span className="cb-stat-label">Saved Opportunities</span>
            <span className="cb-stat-value">{dashboard.saved_internships}</span>
            <span className="cb-stat-desc">Bookmarked for later</span>
          </div>

          {/* 6. Upcoming Interviews */}
          <div className="cb-stat-card cb-stat-primary" data-testid="metric-upcoming-interviews">
            <span className="cb-stat-label">Upcoming Interviews</span>
            <span className="cb-stat-value">{dashboard.upcoming_interviews}</span>
            <span className="cb-stat-desc">Scheduled future interviews</span>
          </div>
        </div>
      </section>

      {/* Quick Actions & Navigation */}
      <section className="cb-dashboard-actions-section" aria-labelledby="student-quick-actions-heading">
        <h2 id="student-quick-actions-heading" className="cb-section-title">
          Quick Actions & Resources
        </h2>
        <div className="cb-action-grid">
          <Link to="/app/jobs" className="cb-action-card" data-testid="quick-link-jobs">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">🔍</span>
              <div>
                <h3 className="cb-action-title">Browse Opportunities</h3>
                <p className="cb-action-desc">
                  Discover new active job and internship postings with custom search and filters.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/applications" className="cb-action-card" data-testid="quick-link-applications">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">📋</span>
              <div>
                <h3 className="cb-action-title">My Applications</h3>
                <p className="cb-action-desc">
                  Track the real-time review status of all your submitted candidate applications.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/interviews" className="cb-action-card" data-testid="quick-link-interviews">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">📅</span>
              <div>
                <h3 className="cb-action-title">My Interviews</h3>
                <p className="cb-action-desc">
                  View scheduled dates, durations, meeting links, and recruiter notes.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/student/profile" className="cb-action-card" data-testid="quick-link-profile">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">👤</span>
              <div>
                <h3 className="cb-action-title">My Profile & Resume</h3>
                <p className="cb-action-desc">
                  Update your contact details, education, skills, and resume document.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};
