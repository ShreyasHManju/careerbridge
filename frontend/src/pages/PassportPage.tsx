import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMyPassport, getStudentPassport } from '@/api/passport';
import { PassportResponse } from '@/types/passport';
import {
  PassportExperiences,
  PassportHeader,
  PassportProjects,
  PassportResume,
  PassportShareManager,
  PassportSkills,
  PassportSummary,
} from '@/components/passport';
import { ApiErrorResponse } from '@/types/api';

export const PassportPage: React.FC = () => {
  const { studentId } = useParams<{ studentId?: string }>();
  const [passport, setPassport] = useState<PassportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPassport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = studentId
        ? await getStudentPassport(parseInt(studentId, 10))
        : await getMyPassport();
      setPassport(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      setError(
        apiError?.message ||
          (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
          'Failed to load Experience Passport. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassport();
  }, [studentId]);

  return (
    <div className="cb-page-container cb-passport-page" data-testid="passport-page">
      {/* Contextual navigation header when viewing specific candidate */}
      {studentId && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to="/app/recruiter/applications"
            className="cb-btn cb-btn-secondary cb-btn-sm"
            data-testid="passport-back-to-apps-btn"
          >
            ← Back to Applications
          </Link>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          className="cb-loading-container"
          aria-busy="true"
          aria-live="polite"
          data-testid="passport-loading"
        >
          <div className="cb-spinner" />
          <p className="cb-loading-text">Assembling your Experience Passport...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          className="cb-card cb-error-card"
          role="alert"
          data-testid="passport-error"
        >
          <div className="cb-error-content">
            <h2 className="cb-error-title">Unable to Load Passport</h2>
            <p className="cb-error-message">{error}</p>
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={fetchPassport}
              data-testid="passport-retry-button"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Populated Passport Content */}
      {!loading && !error && passport && (
        <div className="cb-passport-content-wrapper" data-testid="passport-content">
          <PassportHeader identity={passport.identity} isOwner={passport.is_owner} />

          <PassportSummary summary={passport.summary} />

          <div className="cb-passport-main-grid">
            <div className="cb-passport-primary-col">
              <PassportExperiences experiences={passport.verified_experiences} />
              <PassportProjects projects={passport.projects} />
            </div>

            <div className="cb-passport-sidebar-col">
              <PassportSkills skills={passport.skills} />
              <PassportResume resume={passport.resume} />
            </div>
          </div>

          {/* Share Management Panel — Strictly restricted to passport owner */}
          {passport.is_owner && (
            <PassportShareManager onShareCreated={fetchPassport} />
          )}
        </div>
      )}
    </div>
  );
};
