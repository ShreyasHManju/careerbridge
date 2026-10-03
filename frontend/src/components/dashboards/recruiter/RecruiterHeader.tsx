import React from 'react';
import { DownloadIcon, RefreshIcon, ShieldCheckIcon } from './RecruiterDashboardIcons';

interface RecruiterHeaderProps {
  totalApplications: number;
  isExporting: boolean;
  exportToast: string | null;
  onExport: () => void;
  onRefresh: () => void;
  onDismissToast: () => void;
}

export const RecruiterHeader: React.FC<RecruiterHeaderProps> = ({
  totalApplications,
  isExporting,
  exportToast,
  onExport,
  onRefresh,
  onDismissToast,
}) => {
  return (
    <div className="cb-recruiter-header-section">
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <div className="cb-recruiter-title-badge-row">
            <h1 className="cb-page-title">Recruiter Dashboard</h1>
            <span className="cb-recruiter-verified-badge" title="Verified Recruiter Organization">
              <ShieldCheckIcon size={14} aria-hidden={true} />
              <span>Verified Employer</span>
            </span>
          </div>
          <p className="cb-page-subtitle">
            Monitor your published opportunities, candidate triage queue, and hiring conversion funnel.
          </p>
        </div>
        <div className="cb-page-header-actions cb-recruiter-header-actions">
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || totalApplications === 0}
            className="cb-btn cb-btn-secondary cb-btn-sm cb-recruiter-btn-export"
            data-testid="dashboard-export-apps-btn"
            title="Export all received applications as CSV"
          >
            <DownloadIcon size={15} aria-hidden={true} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="cb-btn cb-btn-secondary cb-btn-sm cb-recruiter-btn-refresh"
            title="Refresh dashboard metrics"
            data-testid="refresh-recruiter-dashboard-btn"
          >
            <RefreshIcon size={15} aria-hidden={true} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Export Toast Feedback */}
      {exportToast && (
        <div
          className="cb-alert cb-alert-info cb-recruiter-toast-alert"
          role="status"
          data-testid="dashboard-export-toast"
        >
          <div className="cb-alert-message-wrap">
            <span>{exportToast}</span>
          </div>
          <button
            type="button"
            className="cb-alert-close-btn"
            onClick={onDismissToast}
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
