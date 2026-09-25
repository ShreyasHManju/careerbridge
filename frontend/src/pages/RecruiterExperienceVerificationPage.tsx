import React, { useEffect, useState, useCallback } from 'react';
import {
  decideExperienceVerification,
  getPendingVerifications,
} from '@/api/experiences';
import {
  ExperienceRecord,
  ExperienceVerificationDecision,
} from '@/types/experience';
import { VerificationRequestCard } from '@/components/experiences/VerificationRequestCard';

export const RecruiterExperienceVerificationPage: React.FC = () => {
  const [requests, setRequests] = useState<ExperienceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getPendingVerifications();
      setRequests(resp.items || []);
    } catch (err: any) {
      setError(
        err?.message ||
        err?.detail ||
        'Failed to load pending verification requests. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleDecision = async (
    experienceId: number,
    decision: ExperienceVerificationDecision
  ) => {
    setSubmittingId(experienceId);
    setFeedback(null);
    try {
      const updated = await decideExperienceVerification(experienceId, decision);
      // Remove or update the verified/rejected request from the pending queue
      setRequests((prev) => prev.filter((r) => r.id !== experienceId));
      setFeedback({
        type: 'success',
        message: `Experience "${updated.title}" was ${
          decision.action === 'approve' ? 'verified' : 'rejected'
        } successfully.`,
      });
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.detail ||
        `Failed to process verification decision.`;
      setFeedback({
        type: 'error',
        message: msg,
      });
      throw err;
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      r.title.toLowerCase().includes(term) ||
      (r.organization_name && r.organization_name.toLowerCase().includes(term)) ||
      (r.skills && r.skills.toLowerCase().includes(term)) ||
      (r.description && r.description.toLowerCase().includes(term)) ||
      String(r.student_id).includes(term)
    );
  });

  return (
    <div
      className="cb-page cb-recruiter-verification-page"
      data-testid="recruiter-verification-page"
    >
      <div className="cb-page-header">
        <div>
          <h1 className="cb-page-title">Candidate Experience Verification</h1>
          <p className="cb-page-subtitle">
            Review and verify candidate work experience, internships, and project claims submitted for your organization.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`cb-alert ${
            feedback.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'
          }`}
          role="status"
          data-testid="verification-feedback"
        >
          {feedback.message}
          <button
            type="button"
            className="cb-alert-close"
            onClick={() => setFeedback(null)}
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="cb-stats-bar">
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{requests.length}</span>
          <span className="cb-stat-lbl">Pending Review</span>
        </div>
      </div>

      {/* Search Input */}
      {requests.length > 0 && (
        <div className="cb-toolbar" style={{ marginBottom: '1.5rem' }}>
          <div className="cb-search-input-wrap">
            <input
              type="text"
              className="cb-input cb-search-input"
              placeholder="Filter by role, student ID, or technologies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Filter verification requests"
            />
          </div>
        </div>
      )}

      {/* Content States */}
      {loading ? (
        <div
          className="cb-experience-loading"
          data-testid="verification-loading"
          role="status"
        >
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading pending verification requests...</p>
        </div>
      ) : error ? (
        <div
          className="cb-experience-error"
          data-testid="verification-error"
          role="alert"
        >
          <span className="cb-error-icon" aria-hidden="true">
            ⚠️
          </span>
          <h4 className="cb-error-title">Failed to load verification queue</h4>
          <p className="cb-error-message">{error}</p>
          <button
            type="button"
            onClick={fetchPendingRequests}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            data-testid="retry-verification-btn"
          >
            Retry
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div
          className="cb-experience-empty"
          data-testid="verification-empty-state"
          role="status"
        >
          <span className="cb-empty-icon" aria-hidden="true">
            🎉
          </span>
          <h4 className="cb-empty-title">Queue is Clear</h4>
          <p className="cb-empty-message">
            There are no pending experience verification claims awaiting review at this time.
          </p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="cb-experience-empty" role="status">
          <span className="cb-empty-icon" aria-hidden="true">
            🔍
          </span>
          <h4 className="cb-empty-title">No Matching Requests</h4>
          <p className="cb-empty-message">
            No verification requests matched your search term "{searchTerm}".
          </p>
        </div>
      ) : (
        <div
          className="cb-verification-queue"
          data-testid="verification-requests-list"
          aria-label="Pending verification requests"
        >
          {filteredRequests.map((request) => (
            <VerificationRequestCard
              key={request.id}
              experience={request}
              onDecision={handleDecision}
              isSubmitting={submittingId === request.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
