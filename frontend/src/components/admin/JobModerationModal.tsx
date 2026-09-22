import React, { useEffect, useState } from 'react';
import { JobPosting } from '@/types/job';
import * as adminApi from '@/api/admin';
import { ApiErrorResponse } from '@/types/api';

interface JobModerationModalProps {
  isOpen: boolean;
  job: JobPosting | null;
  onClose: () => void;
  onSuccess: (updatedJob: JobPosting) => void;
}

export const JobModerationModal: React.FC<JobModerationModalProps> = ({
  isOpen,
  job,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !job) return null;

  const willActivate = !job.is_active;

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await adminApi.updateAdminJobStatus(job.id, {
        is_active: willActivate,
      });
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const msg =
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        `Failed to ${willActivate ? 'activate' : 'deactivate'} job posting.`;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-moderation-modal-title"
      data-testid="job-moderation-modal"
    >
      <div className="cb-modal-container cb-modal-sm">
        <div className="cb-modal-header">
          <h3 id="job-moderation-modal-title" className="cb-modal-title">
            {willActivate ? 'Activate Job Posting' : 'Deactivate Job Posting'}
          </h3>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="cb-modal-body">
          {error && (
            <div className="cb-alert cb-alert-danger" role="alert" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <p style={{ marginBottom: '1rem', color: 'var(--cb-text)' }}>
            Are you sure you want to {willActivate ? 'activate' : 'deactivate'} the posting{' '}
            <strong>"{job.title}"</strong> ({job.company_name || 'Organization'})?
          </p>

          <p style={{ fontSize: '0.9rem', color: 'var(--cb-muted)' }}>
            {willActivate
              ? 'Activating this posting will make it visible to students searching for opportunities.'
              : 'Deactivating this posting will hide it from student discovery while preserving existing applications.'}
          </p>
        </div>

        <div className="cb-modal-footer">
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-job-moderation-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className={`cb-btn ${willActivate ? 'cb-btn-success' : 'cb-btn-danger'}`}
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="confirm-job-moderation-btn"
          >
            {isSubmitting
              ? willActivate
                ? 'Activating...'
                : 'Deactivating...'
              : willActivate
              ? 'Activate Job'
              : 'Deactivate Job'}
          </button>
        </div>
      </div>
    </div>
  );
};
