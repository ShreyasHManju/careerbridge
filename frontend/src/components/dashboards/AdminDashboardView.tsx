import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminDashboard, MonthlyRegistrationMetric } from '@/types/dashboard';
import { getAdminDashboard } from '@/api/dashboards';
import { ApiErrorResponse } from '@/types/api';

const CURRENT_YEAR = new Date().getFullYear();

// Format 'YYYY-MM' into friendly readable label like 'August 2026'
function formatMonthLabel(monthStr: string): string {
  try {
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return monthStr;
    }
    const date = new Date(year, monthIndex, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return monthStr;
  }
}

export const AdminDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [inputYear, setInputYear] = useState<string>(String(CURRENT_YEAR));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingYear, setIsUpdatingYear] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [yearValidationError, setYearValidationError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (yearToFetch?: number) => {
    if (dashboard) {
      setIsUpdatingYear(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await getAdminDashboard(yearToFetch);
      setDashboard(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const message =
        (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
        apiError?.message ||
        'Failed to load admin dashboard analytics. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsUpdatingYear(false);
    }
  }, [dashboard]);

  useEffect(() => {
    fetchDashboardData(selectedYear);
  }, []); // Run initial load on mount

  const handleYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setYearValidationError(null);

    const parsed = parseInt(inputYear, 10);
    if (isNaN(parsed) || parsed < 2000 || parsed > 2100) {
      setYearValidationError('Please enter a valid calendar year between 2000 and 2100.');
      return;
    }

    setSelectedYear(parsed);
    fetchDashboardData(parsed);
  };

  const handleResetCurrentYear = () => {
    setInputYear(String(CURRENT_YEAR));
    setSelectedYear(CURRENT_YEAR);
    setYearValidationError(null);
    fetchDashboardData(CURRENT_YEAR);
  };

  if (isLoading) {
    return (
      <div className="cb-dashboard-loading" role="status" aria-live="polite">
        <div className="cb-spinner" aria-hidden="true" />
        <p>Loading platform-wide administrative metrics and analytics...</p>
      </div>
    );
  }

  if (errorMessage && !dashboard) {
    return (
      <div className="cb-dashboard-error-container" role="alert">
        <div className="cb-alert cb-alert-danger">
          <p className="cb-alert-message">{errorMessage}</p>
        </div>
        <button
          type="button"
          onClick={() => fetchDashboardData(selectedYear)}
          className="cb-btn cb-btn-primary cb-retry-btn"
          data-testid="retry-admin-dashboard-btn"
        >
          Retry Loading Dashboard
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  // Calculate highest count for bar chart proportionality
  const monthlyItems = dashboard.monthly_registrations || [];
  const maxRegistrationCount = Math.max(...monthlyItems.map((m: MonthlyRegistrationMetric) => m.count), 1);

  return (
    <div className="cb-dashboard-container" data-testid="admin-dashboard-view">
      {/* Page Header */}
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Administrative Platform Dashboard</h1>
          <p className="cb-page-subtitle">
            Platform-wide growth KPIs, institutional verification health, and monthly registration volume.
          </p>
        </div>
        <div className="cb-page-header-actions">
          <button
            type="button"
            onClick={() => fetchDashboardData(selectedYear)}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            disabled={isUpdatingYear}
            title="Refresh dashboard metrics"
            data-testid="refresh-admin-dashboard-btn"
          >
            {isUpdatingYear ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" style={{ marginBottom: '1.5rem' }}>
          {errorMessage}
        </div>
      )}

      {/* Six Platform KPI Cards */}
      <section aria-labelledby="admin-kpi-heading">
        <h2 id="admin-kpi-heading" className="cb-sr-only">
          Platform Key Performance Indicators
        </h2>
        <div className="cb-stat-grid">
          {/* 1. Total Students */}
          <div className="cb-stat-card cb-stat-primary" data-testid="metric-total-students">
            <span className="cb-stat-label">Total Students</span>
            <span className="cb-stat-value">{dashboard.total_students}</span>
            <span className="cb-stat-desc">Registered student accounts</span>
          </div>

          {/* 2. Total Companies */}
          <div className="cb-stat-card cb-stat-info" data-testid="metric-total-companies">
            <span className="cb-stat-label">Total Companies</span>
            <span className="cb-stat-value">{dashboard.total_companies}</span>
            <span className="cb-stat-desc">Registered recruiter accounts</span>
          </div>

          {/* 3. Verified Companies */}
          <div className="cb-stat-card cb-stat-success" data-testid="metric-verified-companies">
            <span className="cb-stat-label">Verified Organizations</span>
            <span className="cb-stat-value">{dashboard.verified_companies}</span>
            <span className="cb-stat-desc">Administratively verified</span>
          </div>

          {/* 4. Published Internships */}
          <div className="cb-stat-card" data-testid="metric-published-internships">
            <span className="cb-stat-label">Active Opportunities</span>
            <span className="cb-stat-value">{dashboard.published_internships}</span>
            <span className="cb-stat-desc">Currently published postings</span>
          </div>

          {/* 5. Total Applications */}
          <div className="cb-stat-card" data-testid="metric-total-applications">
            <span className="cb-stat-label">Total Applications</span>
            <span className="cb-stat-value">{dashboard.total_applications}</span>
            <span className="cb-stat-desc">Platform-wide submissions</span>
          </div>

          {/* 6. Application Success Rate */}
          <div className="cb-stat-card cb-stat-warning" data-testid="metric-application-success-rate">
            <span className="cb-stat-label">Application Success Rate</span>
            <span className="cb-stat-value">
              {dashboard.application_success_rate.toFixed(1)}%
            </span>
            <span className="cb-stat-desc">Accepted vs total submissions</span>
          </div>
        </div>
      </section>

      {/* Monthly Registration Activity Chart Section */}
      <section className="cb-chart-card" aria-labelledby="monthly-registrations-heading">
        <div className="cb-chart-header">
          <div>
            <h2 id="monthly-registrations-heading" className="cb-chart-title">
              Monthly User Registrations ({selectedYear})
            </h2>
            <p className="cb-chart-subtitle">
              New account creations grouped by calendar month for the selected period.
            </p>
          </div>

          {/* Year Filter Form */}
          <form onSubmit={handleYearSubmit} className="cb-year-filter-form" noValidate aria-label="Filter registrations by year">
            <label htmlFor="period-year-input" className="cb-year-filter-label">
              Year:
            </label>
            <input
              id="period-year-input"
              type="number"
              min={2000}
              max={2100}
              className="cb-input cb-year-input"
              value={inputYear}
              onChange={(e) => setInputYear(e.target.value)}
              disabled={isUpdatingYear}
              data-testid="period-year-input"
              aria-describedby={yearValidationError ? 'year-error-message' : undefined}
            />
            <button
              type="submit"
              className="cb-btn cb-btn-primary cb-btn-sm"
              disabled={isUpdatingYear}
              data-testid="apply-year-btn"
            >
              Apply
            </button>
            {selectedYear !== CURRENT_YEAR && (
              <button
                type="button"
                onClick={handleResetCurrentYear}
                className="cb-btn cb-btn-secondary cb-btn-sm"
                disabled={isUpdatingYear}
                data-testid="reset-year-btn"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {yearValidationError && (
          <div id="year-error-message" className="cb-alert cb-alert-danger cb-year-alert" role="alert">
            {yearValidationError}
          </div>
        )}

        {/* Semantic CSS Bar Chart Visualizer */}
        <div className="cb-chart-body" data-testid="monthly-registrations-chart">
          {monthlyItems.length === 0 ? (
            <div className="cb-chart-empty" data-testid="chart-empty-state">
              <p>No user registration data recorded for calendar year {selectedYear}.</p>
            </div>
          ) : (
            <div className="cb-bar-list" role="list" aria-label={`Monthly registration breakdown for ${selectedYear}`}>
              {monthlyItems.map((metric: MonthlyRegistrationMetric) => {
                const widthPercent =
                  metric.count === 0
                    ? 0
                    : Math.max(Math.round((metric.count / maxRegistrationCount) * 100), 5);

                const friendlyMonth = formatMonthLabel(metric.month);

                return (
                  <div
                    key={metric.month}
                    className="cb-bar-row"
                    role="listitem"
                    data-testid={`bar-row-${metric.month}`}
                  >
                    <div className="cb-bar-label-group">
                      <span className="cb-bar-month-text">{friendlyMonth}</span>
                      <span className="cb-bar-count-badge" data-testid={`bar-count-${metric.month}`}>
                        {metric.count} {metric.count === 1 ? 'user' : 'users'}
                      </span>
                    </div>

                    <div className="cb-bar-track" aria-hidden="true">
                      <div
                        className="cb-bar-fill"
                        style={{ width: `${widthPercent}%` }}
                        data-testid={`bar-fill-${metric.month}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Quick Governance Links */}
      <section className="cb-dashboard-actions-section" aria-labelledby="admin-governance-heading">
        <h2 id="admin-governance-heading" className="cb-section-title">
          Platform Governance & Moderation
        </h2>
        <div className="cb-action-grid">
          <Link to="/app/admin/users" className="cb-action-card" data-testid="quick-link-admin-users">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">👥</span>
              <div>
                <h3 className="cb-action-title">User Account Administration</h3>
                <p className="cb-action-desc">
                  Review student and recruiter accounts, toggle activation, and export directory CSV.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/admin/recruiters" className="cb-action-card" data-testid="quick-link-admin-recruiters">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">🏢</span>
              <div>
                <h3 className="cb-action-title">Recruiter Verification</h3>
                <p className="cb-action-desc">
                  Inspect hiring company profiles, assess credentials, and manage verification badges.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/admin/jobs" className="cb-action-card" data-testid="quick-link-admin-jobs">
            <div className="cb-action-card-body">
              <span className="cb-action-icon" aria-hidden="true">🛡️</span>
              <div>
                <h3 className="cb-action-title">Job Postings Moderation</h3>
                <p className="cb-action-desc">
                  Inspect and moderate all active and inactive job postings across all hiring companies.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};
