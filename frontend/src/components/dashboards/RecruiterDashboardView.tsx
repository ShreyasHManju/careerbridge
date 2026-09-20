import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RecruiterDashboard } from '@/types/dashboard';
import { getRecruiterDashboard } from '@/api/dashboards';
import { ApiErrorResponse } from '@/types/api';

export const RecruiterDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<RecruiterDashboard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getRecruiterDashboard();
      setDashboard(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const message =
        (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
        apiError?.message ||
        'Failed to load recruiter dashboard. Please try again.';
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
        <p>Loading your recruiter dashboard metrics...</p>
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
          data-testid="retry-recruiter-dashboard-btn"
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
    <div className="cb-dashboard-container" data-testid="recruiter-dashboard-view">
      {/* Header */}
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Recruiter Dashboard</h1>
          <p className="cb-page-subtitle">
            Monitor your published opportunities, candidate triage queue, and scheduled interviews.
          </p>
        </div>
        <div className="cb-page-header-actions">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            title="Refresh dashboard metrics"
            data-testid="refresh-recruiter-dashboard-btn"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Review Queue Alert Spotlight */}
      {dashboard.applications_awaiting_review > 0 && (
        <div className="cb-alert cb-alert-info cb-dashboard-alert" role="status" data-testid="review-queue-spotlight">
          <div className="cb-alert-content-with-action">
            <div>
              <strong>Action Required:</strong> You have{' '}
              <strong>{dashboard.applications_awaiting_review}</strong> candidate{' '}
              {dashboard.applications_awaiting_review === 1 ? 'application' : 'applications'} awaiting initial review.
            </div>
            <Link
              to="/app/recruiter/applications"
              className="cb-btn cb-btn-primary cb-btn-sm"
              data-testid="triage-review-queue-btn"
            >
              Review Candidates →
            </Link>
          </div>
        </div>
      )}

      {/* Five Canonical Metric Cards */}
      <section aria-labelledby="recruiter-metrics-heading">
        <h2 id="recruiter-metrics-heading" className="cb-sr-only">
          Recruitment Funnel Metrics
        </h2>
        <div className="cb-stat-grid">
          {/* 1. Active Internships */}
          <div className="cb-stat-card cb-stat-success" data-testid="metric-active-internships">
            <span className="cb-stat-label">Active Internships</span>
            <span className="cb-stat-value">{dashboard.active_internships}</span>
            <span className="cb-stat-desc">Published open postings</span>
          </div>

          {/* 2. Total Applications */}
          <div className="cb-stat-card" data-testid="metric-total-applications">
            <span className="cb-stat-label">Total Applications</span>
            <span className="cb-stat-value">{dashboard.total_applications}</span>
            <span className="cb-stat-desc">Received candidate submissions</span>
          </div>

          {/* 3. Applications Awaiting Review */}
          <div className="cb-stat-card cb-stat-warning" data-testid="metric-applications-awaiting-review">
            <span className="cb-stat-label">Awaiting Review</span>
            <span className="cb-stat-value">{dashboard.applications_awaiting_review}</span>
            <span className="cb-stat-desc">Pending initial evaluation</span>
          </div>

          {/* 4. Shortlisted Candidates */}
          <div className="cb-stat-card cb-stat-info" data-testid="metric-shortlisted-candidates">
            <span className="cb-stat-label">Shortlisted Candidates</span>
            <span className="cb-stat-value">{dashboard.shortlisted_candidates}</span>
            <span className="cb-stat-desc">Qualified for next rounds</span>
          </div>

          {/* 5. Scheduled Interviews */}
          <div className="cb-stat-card cb-stat-primary" data-testid="metric-scheduled-interviews">
            <span className="cb-stat-label">Scheduled Interviews</span>
            <span className="cb-stat-value">{dashboard.scheduled_interviews}</span>
            <span className="cb-stat-desc">Active upcoming rounds</span>
          </div>
        </div>
      </section>

      {/* Quick Navigation & Actions */}
      <section className="cb-dashboard-actions-section" aria-labelledby="recruiter-quick-actions-heading">
        <h2 id="recruiter-quick-actions-heading" className="cb-section-title">
          Recruiting Actions & Tools
        </h2>
        <div className="cb-action-grid">
          <Link to="/app/recruiter/applications" className="cb-action-card" data-testid="quick-link-applications">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">👥</span>
              <div>
                <h3 className="cb-action-title">Review Applications</h3>
                <p className="cb-action-desc">
                  Triage incoming candidate submissions, evaluate profiles, and update candidate statuses.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/recruiter/interviews" className="cb-action-card" data-testid="quick-link-interviews">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">📆</span>
              <div>
                <h3 className="cb-action-title">Interview Coordination</h3>
                <p className="cb-action-desc">
                  Manage schedule times, update meeting links, reschedule dates, or cancel interview sessions.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/jobs" className="cb-action-card" data-testid="quick-link-jobs">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">📢</span>
              <div>
                <h3 className="cb-action-title">Opportunities</h3>
                <p className="cb-action-desc">
                  Browse published opportunities and inspect active candidate demand across roles.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/recruiter/profile" className="cb-action-card" data-testid="quick-link-profile">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">🏢</span>
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
    </div>
  );
};
