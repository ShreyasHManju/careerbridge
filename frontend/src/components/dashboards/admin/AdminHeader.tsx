import React from 'react';
import { ShieldCheckIcon, RefreshIcon } from './AdminDashboardIcons';

interface AdminHeaderProps {
  selectedYear: number;
  isUpdatingYear: boolean;
  onRefresh: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  selectedYear,
  isUpdatingYear,
  onRefresh,
}) => {
  return (
    <div className="cb-admin-header-section">
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <div className="cb-admin-title-badge-row">
            <h1 className="cb-page-title">Administrative Platform Dashboard</h1>
            <span className="cb-admin-governance-badge" title="Platform Governance Authority">
              <ShieldCheckIcon size={14} aria-hidden={true} />
              <span>System Administrator</span>
            </span>
          </div>
          <p className="cb-page-subtitle">
            Platform-wide growth KPIs, institutional verification health, and monthly registration volume ({selectedYear}).
          </p>
        </div>
        <div className="cb-page-header-actions cb-admin-header-actions">
          <button
            type="button"
            onClick={onRefresh}
            className="cb-btn cb-btn-secondary cb-btn-sm cb-admin-btn-refresh"
            disabled={isUpdatingYear}
            title="Refresh dashboard metrics"
            data-testid="refresh-admin-dashboard-btn"
          >
            <RefreshIcon size={15} aria-hidden={true} />
            <span>{isUpdatingYear ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
