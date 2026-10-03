import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RecruiterDashboard } from '@/types/dashboard';
import { getRecruiterDashboard } from '@/api/dashboards';
import { exportRecruiterApplications } from '@/api/export';
import { ApiErrorResponse } from '@/types/api';

export const RecruiterDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<RecruiterDashboard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

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

  const handleExportApplications = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportToast(null);
    try {
      await exportRecruiterApplications();
      setExportToast('Candidate applications exported successfully!');
    } catch {
      setExportToast('Failed to export applications. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

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

  // Pipeline funnel calculations
  const totalApps = dashboard.total_applications;
  const reviewedApps = totalApps - dashboard.applications_awaiting_review;
  const reviewRate = totalApps > 0 ? Math.round((reviewedApps / totalApps) * 100) : 0;
  const shortlistRate = totalApps > 0 ? Math.round((dashboard.shortlisted_candidates / totalApps) * 100) : 0;
  const interviewRate = totalApps > 0 ? Math.round((dashboard.scheduled_interviews / totalApps) * 100) : 0;

  return (
    <div className="cb-dashboard-container" data-testid="recruiter-dashboard-view">
      {/* Header */}
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Recruiter Dashboard</h1>
          <p className="cb-page-subtitle">
            Monitor your published opportunities, candidate triage queue, and hiring conversion funnel.
          </p>
        </div>
        <div className="cb-page-header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExportApplications}
            disabled={isExporting || dashboard.total_applications === 0}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            data-testid="dashboard-export-apps-btn"
            title="Export all received applications as CSV"
          >
            {isExporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
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

      {/* Export Toast Feedback */}
      {exportToast && (
        <div
          className="cb-alert cb-alert-info"
          role="status"
          style={{ marginBottom: '1.25rem' }}
          data-testid="dashboard-export-toast"
        >
          <span>{exportToast}</span>
          <button
            type="button"
            className="cb-alert-close-btn"
            onClick={() => setExportToast(null)}
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

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
          <Link
            to="/app/recruiter/jobs"
            className="cb-stat-card cb-stat-success cb-stat-card-link"
            data-testid="metric-active-internships"
            aria-label="View active published postings"
          >
            <span className="cb-stat-label">Active Internships</span>
            <span className="cb-stat-value">{dashboard.active_internships}</span>
            <span className="cb-stat-desc">Published open postings</span>
          </Link>

          {/* 2. Total Applications */}
          <Link
            to="/app/recruiter/applications"
            className="cb-stat-card cb-stat-card-link"
            data-testid="metric-total-applications"
            aria-label="View all received candidate submissions"
          >
            <span className="cb-stat-label">Total Applications</span>
            <span className="cb-stat-value">{dashboard.total_applications}</span>
            <span className="cb-stat-desc">Received candidate submissions</span>
          </Link>

          {/* 3. Applications Awaiting Review */}
          <Link
            to="/app/recruiter/applications?status=applied"
            className="cb-stat-card cb-stat-warning cb-stat-card-link"
            data-testid="metric-applications-awaiting-review"
            aria-label="View candidate submissions awaiting review"
          >
            <span className="cb-stat-label">Awaiting Review</span>
            <span className="cb-stat-value">{dashboard.applications_awaiting_review}</span>
            <span className="cb-stat-desc">Pending initial evaluation</span>
          </Link>

          {/* 4. Shortlisted Candidates */}
          <Link
            to="/app/recruiter/applications?status=shortlisted"
            className="cb-stat-card cb-stat-info cb-stat-card-link"
            data-testid="metric-shortlisted-candidates"
            aria-label="View shortlisted candidates"
          >
            <span className="cb-stat-label">Shortlisted Candidates</span>
            <span className="cb-stat-value">{dashboard.shortlisted_candidates}</span>
            <span className="cb-stat-desc">Qualified for next rounds</span>
          </Link>

          {/* 5. Scheduled Interviews */}
          <Link
            to="/app/recruiter/interviews"
            className="cb-stat-card cb-stat-primary cb-stat-card-link"
            data-testid="metric-scheduled-interviews"
            aria-label="View scheduled upcoming interview rounds"
          >
            <span className="cb-stat-label">Scheduled Interviews</span>
            <span className="cb-stat-value">{dashboard.scheduled_interviews}</span>
            <span className="cb-stat-desc">Active upcoming rounds</span>
          </Link>
        </div>
      </section>

      {/* Recruitment Funnel & Conversion Analytics */}
      <section
        className="cb-dashboard-funnel-section"
        aria-labelledby="recruiter-funnel-heading"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.5rem',
          margin: '1.5rem 0',
        }}
        data-testid="recruiter-funnel-section"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 id="recruiter-funnel-heading" style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
              Candidate Conversion & Pipeline Funnel
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Real-time progression of candidates across your hiring stages.
            </p>
          </div>
          <Link to="/app/recruiter/jobs" className="cb-btn cb-btn-secondary cb-btn-sm">
            Manage Postings →
          </Link>
        </div>

        {totalApps === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            No applications received yet. As candidates apply to your active listings, your hiring conversion funnel will populate automatically.
          </p>
        ) : (
          <div>
            {/* Conversion Metrics Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                  Evaluation Rate
                </span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>
                  {reviewRate}%
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  {reviewedApps} of {totalApps} evaluated
                </span>
              </div>

              <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                  Shortlist Rate
                </span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb' }}>
                  {shortlistRate}%
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  {dashboard.shortlisted_candidates} candidates shortlisted
                </span>
              </div>

              <div style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                  Interview Scheduling Rate
                </span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>
                  {interviewRate}%
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  {dashboard.scheduled_interviews} rounds coordinated
                </span>
              </div>
            </div>

            {/* Visual Funnel Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>1. Received Applications</span>
                  <strong>{totalApps} (100%)</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#64748b' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>2. Under Review / Evaluated</span>
                  <strong>{reviewedApps} ({reviewRate}%)</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${reviewRate}%`, height: '100%', background: '#ca8a04' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>3. Shortlisted Candidates</span>
                  <strong>{dashboard.shortlisted_candidates} ({shortlistRate}%)</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${shortlistRate}%`, height: '100%', background: '#2563eb' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>4. Scheduled Technical Interviews</span>
                  <strong>{dashboard.scheduled_interviews} ({interviewRate}%)</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${interviewRate}%`, height: '100%', background: '#16a34a' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Quick Navigation & Actions */}
      <section className="cb-dashboard-actions-section" aria-labelledby="recruiter-quick-actions-heading">
        <h2 id="recruiter-quick-actions-heading" className="cb-section-title">
          Recruiting Actions & Tools
        </h2>
        <div className="cb-action-grid">
          <Link to="/app/recruiter/candidates" className="cb-action-card" data-testid="quick-link-candidates">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">🔍</span>
              <div>
                <h3 className="cb-action-title">Talent Discovery</h3>
                <p className="cb-action-desc">
                  Proactively discover and source verified student talent by skills, Experience Passport credentials, and public projects.
                </p>
              </div>
            </div>
          </Link>

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
