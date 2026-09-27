import React, { useEffect, useState } from 'react';
import {
  EvidenceVerificationCreate,
  EvidenceVerificationStatus,
  ProjectEvidence,
} from '@/types/innovationProject';

interface ProjectEvidenceVerificationModalProps {
  isOpen: boolean;
  evidence: ProjectEvidence | null;
  onSubmit: (payload: EvidenceVerificationCreate) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const ProjectEvidenceVerificationModal: React.FC<ProjectEvidenceVerificationModalProps> = ({
  isOpen,
  evidence,
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [status, setStatus] = useState<EvidenceVerificationStatus>('verified');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (evidence?.verification) {
      setStatus(evidence.verification.status);
      setNotes(evidence.verification.notes || '');
    } else {
      setStatus('verified');
      setNotes('');
    }
    setError(null);
  }, [evidence, isOpen]);

  if (!isOpen || !evidence) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > 2000) {
      setError('Verification notes cannot exceed 2000 characters.');
      return;
    }

    const payload: EvidenceVerificationCreate = {
      status,
      notes: trimmedNotes ? trimmedNotes : null,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || 'Failed to record verification decision.'
      );
    }
  };

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-modal-title"
      data-testid="verification-modal"
    >
      <div className="cb-modal cb-modal-md">
        <div className="cb-modal-header">
          <h3 id="verification-modal-title">Review & Verify Evidence Artifact</h3>
          <button
            type="button"
            className="cb-modal-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="cb-modal-form">
          <div className="cb-modal-body">
            {error && (
              <div className="cb-alert cb-alert-danger" role="alert">
                {error}
              </div>
            )}

            <div className="cb-evidence-review-target" style={{ marginBottom: '1.25rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Artifact Under Review:</div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem', marginTop: '0.25rem' }}>{evidence.title}</div>
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.875rem', color: '#2563eb', wordBreak: 'break-all', display: 'inline-block', marginTop: '0.25rem' }}
              >
                🔗 {evidence.url} ↗
              </a>
            </div>

            <div className="cb-form-group">
              <label htmlFor="verification-status" className="cb-form-label">
                Verification Decision <span className="cb-required">*</span>
              </label>
              <select
                id="verification-status"
                className="cb-form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as EvidenceVerificationStatus)}
                disabled={isLoading}
                data-testid="verification-status-select"
              >
                <option value="verified">✓ Verified (Valid & Verified Artifact)</option>
                <option value="rejected">✕ Rejected (Requires Changes or Disqualified)</option>
                <option value="pending">⏳ Pending (Under Active Review)</option>
              </select>
            </div>

            <div className="cb-form-group">
              <label htmlFor="verification-notes" className="cb-form-label">
                Verification Feedback / Audit Notes
              </label>
              <textarea
                id="verification-notes"
                className="cb-form-textarea"
                rows={4}
                placeholder="Explain the audit outcome, validation observations, or required corrections..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                disabled={isLoading}
                data-testid="verification-notes-input"
              />
              <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right', marginTop: '0.25rem' }}>
                {notes.length} / 2000 characters
              </div>
            </div>
          </div>

          <div className="cb-modal-footer">
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cb-btn cb-btn-primary"
              disabled={isLoading}
              data-testid="verification-submit-btn"
            >
              {isLoading ? 'Saving Decision...' : 'Save Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
