import React, { useState, useEffect } from 'react';
import { JobPosting, Application } from '@/types/job';
import { applyToJob } from '@/api/applications';
import { getMyPassport } from '@/api/passport';
import { PassportResponse } from '@/types/passport';
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
  const [passport, setPassport] = useState<PassportResponse | null>(null);
  const [isLoadingPassport, setIsLoadingPassport] = useState<boolean>(false);

  // Reset state when opening/closing or job changes
  useEffect(() => {
    if (isOpen) {
      setCoverMessage('');
      setErrorMessage(null);
      setIsSuccess(false);
      setIsSubmitting(false);

      setIsLoadingPassport(true);
      getMyPassport()
        .then((data) => setPassport(data))
        .catch(() => setPassport(null))
        .finally(() => setIsLoadingPassport(false));
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

    const jobSkillsList = (job?.skills || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const verifiedProjects = (passport?.projects || []).filter(
      (p) =>
        (p.verified_evidence && p.verified_evidence.length > 0) ||
        (p.verified_evidence_count && p.verified_evidence_count > 0)
    );

    const unverifiedProjects = (passport?.projects || []).filter(
      (p) =>
        (!p.verified_evidence || p.verified_evidence.length === 0) &&
        (!p.verified_evidence_count || p.verified_evidence_count === 0)
    );

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

              {/* Passport Evidence Callout */}
              <div
                className="cb-passport-apply-callout"
                data-testid="apply-passport-evidence-callout"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(99, 102, 241, 0.07))',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 'var(--cb-radius, 8px)',
                  padding: '0.75rem 1rem',
                  margin: '0.75rem 0 0.75rem 0',
                  fontSize: '0.85rem',
                  color: 'var(--cb-text, #1e293b)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                }}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }} aria-hidden="true">
                  🛡️
                </span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.2rem', color: 'var(--cb-primary, #2563eb)' }}>
                    Verified Career Evidence Attached
                  </strong>
                  <p style={{ margin: 0, color: 'var(--cb-text-muted, #64748b)', lineHeight: 1.45, fontSize: '0.8125rem' }}>
                    Your verified Career Passport, skills, experiences, and project evidence will be shared with this employer as part of your application.
                  </p>
                </div>
              </div>

              {/* Verified Project Proof Section (Phase 32) */}
              <div
                className="cb-apply-proof-section"
                data-testid="verified-project-proof-section"
                style={{
                  margin: '0.5rem 0 1rem 0',
                  padding: '0.75rem 1rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--cb-radius, 8px)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                    Verified Project Proof
                  </strong>
                  {isLoadingPassport && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Loading proof...</span>
                  )}
                </div>

                {verifiedProjects.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {verifiedProjects.map((proj) => {
                      const projSkills = proj.skills
                        ? proj.skills.split(',').map((s) => s.trim()).filter(Boolean)
                        : [];
                      const evidenceCount = (proj.verified_evidence || []).length || proj.verified_evidence_count || 0;

                      return (
                        <div
                          key={proj.id}
                          data-testid="verified-project-proof-item"
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                                {proj.title}
                              </span>
                              <span
                                style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  fontWeight: 600,
                                }}
                              >
                                🛡️ Verified Proof
                              </span>
                            </div>
                            {evidenceCount > 0 && (
                              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 500 }}>
                                ✓ {evidenceCount} verified artifact{evidenceCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {projSkills.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
                              {projSkills.map((sk, idx) => {
                                const isTargetMatch = jobSkillsList.includes(sk.toLowerCase());
                                return (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '0.725rem',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: isTargetMatch ? '#dcfce7' : '#f1f5f9',
                                      color: isTargetMatch ? '#15803d' : '#475569',
                                      fontWeight: isTargetMatch ? 600 : 400,
                                      border: isTargetMatch ? '1px solid #86efac' : '1px solid #e2e8f0',
                                    }}
                                  >
                                    {sk} {isTargetMatch && '🎯'}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : unverifiedProjects.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {unverifiedProjects.map((proj) => (
                      <div
                        key={proj.id}
                        data-testid="unverified-project-item"
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          color: '#64748b',
                        }}
                      >
                        <span>{proj.title}</span>
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            color: '#64748b',
                          }}
                        >
                          Self-declared (Unverified)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>
                    No verified projects found in your Experience Passport yet.
                  </p>
                )}
              </div>

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
