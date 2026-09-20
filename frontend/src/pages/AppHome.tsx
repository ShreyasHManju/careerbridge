import React from 'react';
import { useAuth } from '@/auth/useAuth';
import { StudentDashboardView } from '@/components/dashboards/StudentDashboardView';
import { RecruiterDashboardView } from '@/components/dashboards/RecruiterDashboardView';
import { AdminDashboardView } from '@/components/dashboards/AdminDashboardView';

/**
 * CareerBridge Role-Based Home Landing Page (Phase 22)
 *
 * Automatically renders the authoritative, database-aggregated dashboard
 * tailored to the authenticated user's role (Student, Recruiter, or Admin).
 */
export const AppHome: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="cb-dashboard-loading" role="status" aria-live="polite">
        <div className="cb-spinner" aria-hidden="true" />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.role === 'student') {
    return <StudentDashboardView />;
  }

  if (user.role === 'recruiter') {
    return <RecruiterDashboardView />;
  }

  if (user.role === 'admin') {
    return <AdminDashboardView />;
  }

  return (
    <div className="cb-home-container" data-testid="fallback-home-view">
      <div className="cb-card">
        <h2>Welcome, {user.email}</h2>
        <p className="cb-subtitle">Role: {user.role}</p>
      </div>
    </div>
  );
};
