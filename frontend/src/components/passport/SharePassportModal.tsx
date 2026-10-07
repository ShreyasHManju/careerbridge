import React, { useState, useEffect } from 'react';
import { PassportShareCreateResponse } from '@/types/passport';
import { createPassportShare } from '@/api/passport';
import { ApiErrorResponse } from '@/types/api';

export interface SharePassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdShare: PassportShareCreateResponse) => void;
}

export const SharePassportModal: React.FC<SharePassportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [label, setLabel] = useState<string>('');
  const [expiresInDays, setExpiresInDays] = useState<string>('none');
  const [allowContactInfo, setAllowContactInfo] = useState<boolean>(false);
  const [allowUnverifiedProjects, setAllowUnverifiedProjects] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdShare, setCreatedShare] = useState<PassportShareCreateResponse | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Reset form state on open
  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setExpiresInDays('none');
      setAllowContactInfo(false);
      setAllowUnverifiedProjects(false);
      setIsSubmitting(false);
      setErrorMessage(null);
      setCreatedShare(null);
      setCopyFeedback(false);
    }
  }, [isOpen]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const parsedDays = expiresInDays === 'none' ? null : parseInt(expiresInDays, 10);
      const response = await createPassportShare({
        label: label.trim() || null,
        expires_in_days: parsedDays,
        allow_contact_info: allowContactInfo,
        allow_unverified_projects: allowUnverifiedProjects,
      });

      setCreatedShare(response);
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      setErrorMessage(
        apiError?.message ||
          (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
          'Failed to generate share link. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullShareUrl = (): string => {
    if (!createdShare) return '';
    if (createdShare.share_token) {
      return `${window.location.origin}/p/${createdShare.share_token}`;
    }
    return createdShare.share_url;
  };

  const handleCopy = () => {
    const fullUrl = getFullShareUrl();
    if (navigator.clipboard && fullUrl) {
      navigator.clipboard.writeText(fullUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  return (
    <div
      className="cb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-passport-modal-title"
      data-testid="share-passport-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="cb-modal-dialog" style={{ maxWidth: '540px' }}>
        {/* Modal Header */}
        <div className="cb-modal-header">
          <div>
            <h2 id="share-passport-modal-title" className="cb-modal-title">
              {createdShare ? 'Share Link Ready' : 'Share CareerBridge Verified Passport'}
            </h2>
            <p className="cb-modal-subtitle">
              {createdShare
                ? 'Your public verified profile link is generated and ready to share.'
                : 'Create a secure public link to showcase your verified achievements.'}
            </p>
          </div>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            aria-label="Close share dialog"
            disabled={isSubmitting}
            data-testid="share-passport-modal-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="cb-modal-body">
          {errorMessage && (
            <div className="cb-alert cb-alert-danger" role="alert" data-testid="share-modal-error">
              {errorMessage}
            </div>
          )}

          {createdShare ? (
            /* Success View: Raw token displayed once with Copy Action */
            <div className="cb-share-success-view" data-testid="share-success-view">
              <div
                className="cb-alert cb-alert-info"
                style={{ marginBottom: '1.25rem' }}
                data-testid="share-token-notice"
              >
                <strong>Important:</strong> This share link contains a secure unique token. It is only
                displayed now upon creation. Please copy and share it with recruiters or on your resume.
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label" htmlFor="created-share-url">
                  Public Passport Link
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="created-share-url"
                    type="text"
                    readOnly
                    className="cb-input"
                    value={getFullShareUrl()}
                    data-testid="created-share-url-input"
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    className="cb-btn cb-btn-primary"
                    onClick={handleCopy}
                    data-testid="copy-share-url-btn"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {copyFeedback ? '✓ Copied!' : '📋 Copy URL'}
                  </button>
                </div>
              </div>

              <div
                className="cb-share-details-card"
                style={{
                  padding: '0.875rem',
                  borderRadius: 'var(--cb-radius-md, 8px)',
                  background: 'var(--cb-surface-card-subtle, rgba(255, 255, 255, 0.04))',
                  border: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.1))',
                  marginTop: '1rem',
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ opacity: 0.8 }}>Label:</span>
                  <strong>{createdShare.label || 'Default Link'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ opacity: 0.8 }}>Direct Contact Info:</span>
                  <strong>{createdShare.allow_contact_info ? 'Visible' : 'Hidden'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ opacity: 0.8 }}>Unverified Projects:</span>
                  <strong>{createdShare.allow_unverified_projects ? 'Visible' : 'Verified Only'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Expiration:</span>
                  <strong>
                    {createdShare.expires_at
                      ? new Date(createdShare.expires_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Never (Indefinite)'}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form id="share-passport-form" onSubmit={handleSubmit} data-testid="share-passport-form">
              <div className="cb-form-group">
                <label className="cb-form-label" htmlFor="share-label">
                  Link Label <span style={{ opacity: 0.7, fontWeight: 'normal' }}>(Optional)</span>
                </label>
                <input
                  id="share-label"
                  type="text"
                  className="cb-input"
                  placeholder="e.g. Google Recruiter, LinkedIn Profile, Resume Header"
                  maxLength={128}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="share-label-input"
                />
                <small className="cb-form-hint">
                  A memorable note to help you organize and identify this sharing link.
                </small>
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label" htmlFor="share-expiration">
                  Link Expiration
                </label>
                <select
                  id="share-expiration"
                  className="cb-input"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="share-expiration-select"
                >
                  <option value="none">Never (No expiration)</option>
                  <option value="1">1 Day</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="180">180 Days (6 Months)</option>
                  <option value="365">365 Days (1 Year)</option>
                </select>
                <small className="cb-form-hint">
                  The link will automatically deactivate after this duration.
                </small>
              </div>

              <div className="cb-form-group" style={{ marginTop: '1.25rem' }}>
                <span className="cb-form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Granular Visibility Preferences
                </span>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowContactInfo}
                    onChange={(e) => setAllowContactInfo(e.target.checked)}
                    disabled={isSubmitting}
                    data-testid="share-allow-contact-checkbox"
                    style={{ marginTop: '0.2rem' }}
                  />
                  <div>
                    <strong>Include Direct Contact Info</strong>
                    <div style={{ fontSize: '0.8125rem', opacity: 0.75 }}>
                      Allow visitors to view your email, phone, and professional social profiles.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowUnverifiedProjects}
                    onChange={(e) => setAllowUnverifiedProjects(e.target.checked)}
                    disabled={isSubmitting}
                    data-testid="share-allow-unverified-checkbox"
                    style={{ marginTop: '0.2rem' }}
                  />
                  <div>
                    <strong>Include In-Progress & Unverified Projects</strong>
                    <div style={{ fontSize: '0.8125rem', opacity: 0.75 }}>
                      Show active public innovation projects even before verified evidence is submitted.
                    </div>
                  </div>
                </label>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="cb-modal-footer">
          {createdShare ? (
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={onClose}
              data-testid="share-modal-done-btn"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="share-modal-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="share-passport-form"
                className="cb-btn cb-btn-primary"
                disabled={isSubmitting}
                data-testid="share-modal-submit-btn"
              >
                {isSubmitting ? 'Creating Link...' : '🚀 Create Share Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
