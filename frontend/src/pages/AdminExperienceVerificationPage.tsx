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

export const AdminExperienceVerificationPage: React.FC = () => {
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
        'Failed to load pending platform verification requests.'
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
      setRequests((prev) => prev.filter((r) => r.id !== experienceId));
      setFeedback({
        type: 'success',
        message: `Admin decision recorded: Experience "${updated.title}" was ${
          decision.action === 'approve' ? 'verified' : 'rejected'
        }.`,
      });
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.detail ||
        'Failed to process administrator verification decision.';
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
      className="cb-admin-page-container"
      data-testid="admin-experience-verification-page"
    >
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Experience Verification Moderation</h1>
          <p className="cb-page-subtitle">
            Platform administrator queue for reviewing and confirming verified student achievement claims across all organizations.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`cb-alert ${
            feedback.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'
          }`}
          role="status"
          data-testid="admin-verification-feedback"
          style={{ marginBottom: '1.5rem' }}
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
      <div className="cb-stats-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="cb-stat-pill">
          <span className="cb-stat-num">{requests.length}</span>
          <span className="cb-stat-lbl">Platform Claims Pending</span>
        </div>
      </div>

      {/* Search Input */}
      {requests.length > 0 && (
        <div className="cb-toolbar" style={{ marginBottom: '1.5rem' }}>
          <div className="cb-search-input-wrap">
            <input
              type="text"
              className="cb-input cb-search-input"
              placeholder="Filter by title, company, student ID, or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Filter claims"
            />
          </div>
        </div>
      )}

      {/* Main Content States */}
      {loading ? (
        <div
          className="cb-experience-loading"
          data-testid="admin-verification-loading"
          role="status"
        >
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading platform verification requests...</p>
        </div>
      ) : error ? (
        <div
          className="cb-experience-error"
          data-testid="admin-verification-error"
          role="alert"
        >
          <span className="cb-error-icon" aria-hidden="true">
            ⚠️
          </span>
          <h4 className="cb-error-title">Failed to load platform queue</h4>
          <p className="cb-error-message">{error}</p>
          <button
            type="button"
            onClick={fetchPendingRequests}
            className="cb-btn cb-btn-secondary cb-btn-sm"
            data-testid="retry-admin-verification-btn"
          >
            Retry
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div
          className="cb-experience-empty"
          data-testid="admin-verification-empty-state"
          role="status"
        >
          <span className="cb-empty-icon" aria-hidden="true">
            🛡️
          </span>
          <h4 className="cb-empty-title">All Verification Claims Processed</h4>
          <p className="cb-empty-message">
            There are currently no platform experience claims awaiting administrator review.
          </p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="cb-experience-empty" role="status">
          <span className="cb-empty-icon" aria-hidden="true">
            🔍
          </span>
          <h4 className="cb-empty-title">No Matching Claims</h4>
          <p className="cb-empty-message">
            No claims matched your search term "{searchTerm}".
          </p>
        </div>
      ) : (
        <div
          className="cb-verification-queue"
          data-testid="admin-verification-requests-list"
          aria-label="Administrator verification requests"
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
