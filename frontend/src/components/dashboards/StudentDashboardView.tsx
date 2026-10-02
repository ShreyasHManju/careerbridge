import React, { useState, useEffect, useCallback, useContext } from 'react';
import { StudentDashboard } from '@/types/dashboard';
import { PassportResponse } from '@/types/passport';
import { getStudentDashboard } from '@/api/dashboards';
import { getMyPassport } from '@/api/passport';
import { AuthContext } from '@/auth/AuthContext';
import { ApiErrorResponse } from '@/types/api';

import { CareerHeader } from './student/CareerHeader';
import { CareerJourneyTracker } from './student/CareerJourneyTracker';
import { CareerActionList } from './student/CareerActionList';
import { ApplicationJourney } from './student/ApplicationJourney';
import { CareerEvidencePreview } from './student/CareerEvidencePreview';
import { PassportBanner } from './student/PassportBanner';
import { UpcomingCareerEvents } from './student/UpcomingCareerEvents';
import { CareerInsightsCard } from './student/CareerInsightsCard';

export const StudentDashboardView: React.FC = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;

  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [passport, setPassport] = useState<PassportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Fetch authoritative dashboard metrics
      const dashboardPromise = getStudentDashboard();
      // Attempt to fetch passport identity/evidence safely
      const passportPromise = getMyPassport().catch(() => null);

      const [dashboardData, passportData] = await Promise.all([
        dashboardPromise,
        passportPromise,
      ]);

      setDashboard(dashboardData);
      setPassport(passportData);
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

  const hasSkills = Boolean(
    (passport?.summary?.canonical_skills_count ?? 0) > 0 ||
    (passport?.skills?.length ?? 0) > 0
  );
  const hasProjects = Boolean(
    (passport?.summary?.public_projects_count ?? 0) > 0 ||
    (passport?.projects?.length ?? 0) > 0
  );
  const hasExperiences = Boolean(
    (passport?.summary?.verified_experiences_count ?? 0) > 0 ||
    (passport?.verified_experiences?.length ?? 0) > 0
  );

  return (
    <div className="cb-dashboard-container cb-student-career-os" data-testid="student-dashboard-view">
      {/* 1. Career Header */}
      <CareerHeader
        user={user}
        identity={passport?.identity}
        onRefresh={fetchDashboardData}
        isLoading={isLoading}
      />

      {/* 2. Career Journey Roadmap */}
      <CareerJourneyTracker dashboard={dashboard} passport={passport} />

      {/* 3. Today's Career Actions ("What should I do next?") */}
      <CareerActionList dashboard={dashboard} passport={passport} />

      {/* 4. Application Journey & Funnel (Preserves metric links & test contracts) */}
      <ApplicationJourney dashboard={dashboard} />

      {/* 5. Verified Career Evidence & Artifacts */}
      <CareerEvidencePreview passport={passport} />

      {/* 6. Career Passport Identity CTA */}
      <PassportBanner />

      {/* 7. Upcoming Milestones & Quick Resources */}
      <UpcomingCareerEvents dashboard={dashboard} />

      {/* 8. Career Insights (Extensible Future Intelligence) */}
      <CareerInsightsCard
        hasSkills={hasSkills}
        hasProjects={hasProjects}
        hasExperiences={hasExperiences}
      />
    </div>
  );
};
