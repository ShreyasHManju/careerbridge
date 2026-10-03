import React, { useState, useEffect, useCallback } from 'react';
import { RecruiterDashboard } from '@/types/dashboard';
import { getRecruiterDashboard } from '@/api/dashboards';
import { exportRecruiterApplications } from '@/api/export';
import { ApiErrorResponse } from '@/types/api';
import { RecruiterHeader } from './recruiter/RecruiterHeader';
import { HiringActionCenter } from './recruiter/HiringActionCenter';
import { RecruitmentFunnel } from './recruiter/RecruitmentFunnel';
import { ActiveJobsSnapshot } from './recruiter/ActiveJobsSnapshot';
import { TalentEvidencePulse } from './recruiter/TalentEvidencePulse';
import { RecruiterQuickActions } from './recruiter/RecruiterQuickActions';

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

  return (
    <div className="cb-dashboard-container cb-recruiter-os-container" data-testid="recruiter-dashboard-view">
      {/* 1. Recruiter Command Header */}
      <RecruiterHeader
        totalApplications={dashboard.total_applications}
        isExporting={isExporting}
        exportToast={exportToast}
        onExport={handleExportApplications}
        onRefresh={fetchDashboardData}
        onDismissToast={() => setExportToast(null)}
      />

      {/* 2. Operational Hiring Action Center & Metric Cards */}
      <HiringActionCenter dashboard={dashboard} />

      {/* 3. Conversion Pipeline Funnel */}
      <RecruitmentFunnel dashboard={dashboard} />

      {/* 4. Active Opportunities & Talent Evidence Pulse (Dual Grid) */}
      <div className="cb-recruiter-middle-grid">
        <ActiveJobsSnapshot dashboard={dashboard} />
        <TalentEvidencePulse />
      </div>

      {/* 5. Recruiting Actions & Tools */}
      <RecruiterQuickActions />
    </div>
  );
};
