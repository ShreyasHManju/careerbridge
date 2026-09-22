import React, { useEffect, useState } from 'react';
import { AdminRecruiter } from '@/types/admin';
import * as adminApi from '@/api/admin';
import { ApiErrorResponse } from '@/types/api';

interface RecruiterVerificationModalProps {
  isOpen: boolean;
  recruiter: AdminRecruiter | null;
  onClose: () => void;
  onSuccess: (updatedRecruiter: AdminRecruiter) => void;
}

export const RecruiterVerificationModal: React.FC<RecruiterVerificationModalProps> = ({
  isOpen,
  recruiter,
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

  if (!isOpen || !recruiter) return null;

  const willVerify = !recruiter.is_verified;

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // Note: Backend requires user_id in the path
      const updated = await adminApi.updateAdminRecruiterVerification(
        recruiter.user_id,
        {
          is_verified: willVerify,
        }
      );
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const msg =
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        `Failed to ${willVerify ? 'verify' : 'unverify'} recruiter.`;
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
      aria-labelledby="recruiter-verification-modal-title"
      data-testid="recruiter-verification-modal"
    >
      <div className="cb-modal-container cb-modal-sm">
        <div className="cb-modal-header">
          <h3 id="recruiter-verification-modal-title" className="cb-modal-title">
            {willVerify ? 'Verify Recruiter Organization' : 'Unverify Recruiter Organization'}
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
            Are you sure you want to {willVerify ? 'verify' : 'unverify'}{' '}
            <strong>{recruiter.company_name}</strong>
            {recruiter.contact_name ? ` (Contact: ${recruiter.contact_name})` : ''}?
          </p>

          <p style={{ fontSize: '0.9rem', color: 'var(--cb-muted)' }}>
            {willVerify
              ? 'Verifying this organization will display a trusted badge on their profile and published opportunities.'
              : 'Unverifying this organization will remove the verified badge from their public postings.'}
          </p>
        </div>

        <div className="cb-modal-footer">
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-verification-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className={`cb-btn ${willVerify ? 'cb-btn-primary' : 'cb-btn-warning'}`}
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="confirm-verification-btn"
          >
            {isSubmitting
              ? willVerify
                ? 'Verifying...'
                : 'Unverifying...'
              : willVerify
              ? 'Verify Recruiter'
              : 'Unverify Recruiter'}
          </button>
        </div>
      </div>
    </div>
  );
};
