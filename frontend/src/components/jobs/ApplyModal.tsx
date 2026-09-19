import React, { useState, useEffect } from 'react';
import { JobPosting, Application } from '@/types/job';
import { applyToJob } from '@/api/applications';
import { ApiErrorResponse } from '@/types/api';

interface ApplyModalProps {
  isOpen: boolean;
  job: JobPosting | null;
  onClose: () => void;
  onSuccess?: (application: Application) => void;
}

const MAX_COVER_MESSAGE_LENGTH = 2000;

export const ApplyModal: React.FC<ApplyModalProps> = ({
  isOpen,
  job,
  onClose,
  onSuccess,
}) => {
  const [coverMessage, setCoverMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Reset state when opening/closing or job changes
  useEffect(() => {
    if (isOpen) {
      setCoverMessage('');
      setErrorMessage(null);
      setIsSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, job]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !job) {
    return null;
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_COVER_MESSAGE_LENGTH) {
      setCoverMessage(text);
      if (errorMessage) setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSuccess) return;

    if (coverMessage.length > MAX_COVER_MESSAGE_LENGTH) {
      setErrorMessage(`Cover message cannot exceed ${MAX_COVER_MESSAGE_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const application = await applyToJob(job.id, {
        cover_message: coverMessage.trim() || undefined,
      });

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(application);
      }
      // Auto close or let user close after viewing success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      const message =
        detailStr ||
        apiError?.message ||
        'An error occurred while submitting your application. Please try again.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="cb-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-modal-title"
        data-testid="apply-modal"
      >
        <div className="cb-modal-header">
          <h2 id="apply-modal-title" className="cb-modal-title">
            Apply for {job.title}
          </h2>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close apply dialog"
          >
            &times;
          </button>
        </div>

        {isSuccess ? (
          <div className="cb-modal-body">
            <div className="cb-alert cb-alert-success" role="status">
              <strong>Application Submitted!</strong> Your application to{' '}
              {job.company_name} has been sent successfully.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="cb-modal-body">
            <p className="cb-modal-subtitle">
              Applying to <strong>{job.company_name}</strong>. Your profile and
              uploaded resume will automatically be submitted with this application.
            </p>

            {errorMessage && (
              <div className="cb-alert cb-alert-danger" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="cb-form-group">
              <label htmlFor="cover-message" className="cb-filter-label">
                Cover Note / Message (Optional)
              </label>
              <textarea
                id="cover-message"
                className="cb-textarea"
                rows={5}
                placeholder="Introduce yourself or highlight why you are a great fit for this opportunity..."
                value={coverMessage}
                onChange={handleMessageChange}
                disabled={isSubmitting}
                maxLength={MAX_COVER_MESSAGE_LENGTH}
              />
              <div className="cb-char-counter">
                <span
                  className={
                    coverMessage.length >= MAX_COVER_MESSAGE_LENGTH
                      ? 'cb-char-limit-reached'
                      : ''
                  }
                >
                  {coverMessage.length} / {MAX_COVER_MESSAGE_LENGTH} characters
                </span>
              </div>
            </div>

            <div className="cb-modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="cb-btn cb-btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cb-btn cb-btn-primary"
                disabled={isSubmitting}
                data-testid="submit-application-btn"
              >
                {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
