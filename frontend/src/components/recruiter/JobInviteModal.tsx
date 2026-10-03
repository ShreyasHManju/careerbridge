import React, { useState, useEffect } from 'react';
import { getMyJobPostings } from '@/api/jobs';
import { createJobInvitation } from '@/api/invitations';
import { CandidateSourcingResult } from '@/types/candidate';
import { JobPosting } from '@/types/job';
import { JobInvitation } from '@/types/invitation';
import { ApiErrorResponse } from '@/types/api';

export interface JobInviteModalProps {
  candidate: CandidateSourcingResult | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (invitation: JobInvitation) => void;
}

export const JobInviteModal: React.FC<JobInviteModalProps> = ({
  candidate,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !candidate) {
      setSelectedJobId(null);
      setMessage('');
      setErrorMessage(null);
      setIsSuccess(false);
      return;
    }

    let isMounted = true;
    const fetchJobs = async () => {
      setIsLoadingJobs(true);
      setErrorMessage(null);
      try {
        const response = await getMyJobPostings();
        if (isMounted) {
          const activeJobs = (response || []).filter((j) => j.is_active);
          setJobs(activeJobs);
          if (activeJobs.length > 0) {
            setSelectedJobId(activeJobs[0].id);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const apiErr = err as ApiErrorResponse;
          setErrorMessage(
            (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
            apiErr?.message ||
            'Failed to load active job postings.'
          );
        }
      } finally {
        if (isMounted) setIsLoadingJobs(false);
      }
    };

    fetchJobs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, candidate]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !candidate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) {
      setErrorMessage('Please select an active job opportunity.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const invitation = await createJobInvitation(selectedJobId, {
        student_id: candidate.id,
        message: message.trim() || undefined,
      });

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(invitation);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        'Failed to send job invitation. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const candidateName = candidate.full_name || `Candidate #${candidate.id}`;

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-invite-modal-title"
      data-testid="job-invite-modal"
    >
      <div className="cb-modal-container cb-job-invite-modal-container">
        {/* Header */}
        <div className="cb-modal-header">
          <div className="cb-modal-header-text">
            <h2 id="job-invite-modal-title" className="cb-modal-title">
              Invite to Apply
            </h2>
            <p className="cb-modal-subtitle">
              Encourage top talent to apply for your active job or internship opportunities.
            </p>
          </div>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            data-testid="close-invite-modal-btn"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="cb-modal-body">
          {/* Candidate Summary Card */}
          <div className="cb-invite-candidate-preview" data-testid="invite-candidate-preview">
            <div className="cb-invite-candidate-avatar" aria-hidden="true">
              {candidateName.substring(0, 2).toUpperCase()}
            </div>
            <div className="cb-invite-candidate-info">
              <h3 className="cb-invite-candidate-name">{candidateName}</h3>
              <p className="cb-invite-candidate-education">
                🎓 {candidate.education.degree ? `${candidate.education.degree} • ` : ''}
                {candidate.education.college || 'Verified Student'}
                {candidate.education.graduation_year ? ` (Class of ${candidate.education.graduation_year})` : ''}
              </p>
              {candidate.passport_summary?.is_verified && (
                <span className="cb-tag cb-tag-verified-passport cb-tag-sm">
                  🛡️ Verified Passport
                </span>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              className="cb-alert cb-alert-danger"
              role="alert"
              data-testid="job-invite-error-alert"
            >
              {errorMessage}
            </div>
          )}

          {/* Success State */}
          {isSuccess ? (
            <div className="cb-invite-success-state" data-testid="job-invite-success">
              <div className="cb-invite-success-icon" aria-hidden="true">
                ✨
              </div>
              <h3 className="cb-invite-success-title">Invitation Sent Successfully!</h3>
              <p className="cb-invite-success-text">
                {candidateName} has been notified and invited to apply for this opportunity.
              </p>
              <button
                type="button"
                className="cb-btn cb-btn-primary"
                onClick={onClose}
                data-testid="invite-success-done-btn"
              >
                Done
              </button>
            </div>
          ) : isLoadingJobs ? (
            <div className="cb-loading-container" role="status" aria-label="Loading active jobs">
              <div className="cb-spinner" />
              <p className="cb-loading-text">Loading your active job postings...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="cb-empty-state" data-testid="no-active-jobs-state">
              <p className="cb-empty-state-title">No Active Job Postings</p>
              <p className="cb-empty-state-text">
                You must have at least one active job posting to invite candidates to apply.
              </p>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="cb-invite-form" data-testid="job-invite-form">
              {/* Job Selector */}
              <div className="cb-form-group">
                <label htmlFor="invite-job-select" className="cb-form-label">
                  Select Opportunity <span className="cb-required">*</span>
                </label>
                <select
                  id="invite-job-select"
                  className="cb-form-select"
                  value={selectedJobId || ''}
                  onChange={(e) => setSelectedJobId(Number(e.target.value))}
                  required
                  data-testid="invite-job-select"
                  disabled={isSubmitting}
                >
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} — {job.company_name} ({job.opportunity_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Personalized Message */}
              <div className="cb-form-group">
                <label htmlFor="invite-message-input" className="cb-form-label">
                  Personalized Message <span className="cb-form-label-hint">(Optional)</span>
                </label>
                <textarea
                  id="invite-message-input"
                  className="cb-form-textarea"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. We came across your verified project and would love for you to apply for our Distributed Systems role..."
                  maxLength={2000}
                  data-testid="invite-message-input"
                  disabled={isSubmitting}
                />
                <div className="cb-form-hint">
                  {message.length} / 2000 characters
                </div>
              </div>

              {/* Actions */}
              <div className="cb-modal-footer">
                <button
                  type="button"
                  className="cb-btn cb-btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                  data-testid="cancel-invite-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cb-btn cb-btn-primary"
                  disabled={isSubmitting || !selectedJobId}
                  data-testid="submit-invite-btn"
                >
                  {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
