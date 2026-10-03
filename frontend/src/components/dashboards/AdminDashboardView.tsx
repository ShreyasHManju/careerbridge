import React, { useState, useEffect, useCallback } from 'react';
import { AdminDashboard } from '@/types/dashboard';
import { getAdminDashboard } from '@/api/dashboards';
import { ApiErrorResponse } from '@/types/api';
import { AdminHeader } from './admin/AdminHeader';
import { GovernanceActionCenter } from './admin/GovernanceActionCenter';
import { PlatformHealthSnapshot } from './admin/PlatformHealthSnapshot';
import { MonthlyRegistrationChart } from './admin/MonthlyRegistrationChart';
import { TrustSafetyPulse } from './admin/TrustSafetyPulse';
import { AdminQuickActions } from './admin/AdminQuickActions';

const CURRENT_YEAR = new Date().getFullYear();

export const AdminDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingYear, setIsUpdatingYear] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    fetchDashboardData(year);
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

  return (
    <div className="cb-dashboard-container cb-admin-os-container" data-testid="admin-dashboard-view">
      {/* 1. Header with System Authority Badge */}
      <AdminHeader
        selectedYear={selectedYear}
        isUpdatingYear={isUpdatingYear}
        onRefresh={() => fetchDashboardData(selectedYear)}
      />

      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" style={{ marginBottom: '1.5rem' }}>
          {errorMessage}
        </div>
      )}

      {/* 2. Urgent Governance Action Center */}
      <GovernanceActionCenter dashboard={dashboard} />

      {/* 3. Platform Health Snapshot (6 Canonical KPI Cards) */}
      <PlatformHealthSnapshot dashboard={dashboard} />

      {/* 4. Monthly Registration Volume & Chart */}
      <MonthlyRegistrationChart
        monthlyRegistrations={dashboard.monthly_registrations}
        selectedYear={selectedYear}
        isUpdatingYear={isUpdatingYear}
        onYearChange={handleYearChange}
      />

      {/* 5. Trust & Safety Verification Loop */}
      <TrustSafetyPulse />

      {/* 6. Admin Governance Quick Actions */}
      <AdminQuickActions />
    </div>
  );
};
