import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExperienceRecord,
  ExperienceVerificationDecision,
} from '@/types/experience';
import { ExperienceVerificationBadge } from './ExperienceVerificationBadge';
import { formatExperienceDate, formatExperienceType } from './ExperienceCard';

export interface VerificationRequestCardProps {
  experience: ExperienceRecord;
  studentName?: string;
  onDecision: (
    experienceId: number,
    decision: ExperienceVerificationDecision
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const VerificationRequestCard: React.FC<VerificationRequestCardProps> = ({
  experience,
  studentName,
  onDecision,
  isSubmitting = false,
}) => {
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [rejectionNotes, setRejectionNotes] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const startDateFormatted = formatExperienceDate(experience.start_date);
  const endDateFormatted = experience.is_current
    ? 'Present'
    : experience.end_date
    ? formatExperienceDate(experience.end_date)
    : 'Present';

  const displaySkills: string[] =
    experience.structured_skills && experience.structured_skills.length > 0
      ? experience.structured_skills.map((s) => s.name)
      : experience.skills
      ? experience.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const handleApprove = async () => {
    setActionError(null);
    try {
      await onDecision(experience.id, {
        action: 'approve',
      });
    } catch (err: any) {
      const msg = err.message || err.detail || 'Failed to approve verification request.';
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleReject = async () => {
    setActionError(null);
    setRejectionError(null);

    if (rejectionNotes.length > 2000) {
      setRejectionError('Rejection notes cannot exceed 2000 characters.');
      return;
    }

    try {
      await onDecision(experience.id, {
        action: 'reject',
        notes: rejectionNotes.trim() || null,
      });
      setShowRejectBox(false);
      setRejectionNotes('');
    } catch (err: any) {
      const msg = err.message || err.detail || 'Failed to reject verification request.';
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <article
      className="cb-card cb-verification-card"
      data-testid={`verification-request-card-${experience.id}`}
      aria-label={`Verification request for ${experience.title}`}
    >
      <div className="cb-verification-card-header">
        <div className="cb-verification-header-main">
          <div className="cb-verification-title-row">
            <h3 className="cb-verification-title">{experience.title}</h3>
            <div className="cb-verification-badges">
              <span className={`cb-badge cb-badge-exp-type cb-badge-exp-${experience.experience_type}`}>
                {formatExperienceType(experience.experience_type)}
              </span>
              <ExperienceVerificationBadge status={experience.status} size="sm" />
            </div>
          </div>

          <div className="cb-verification-meta">
            {studentName ? (
              <p className="cb-verification-student-name">
                <strong>Candidate:</strong> {studentName} (Student ID: #{experience.student_id})
              </p>
            ) : (
              <p className="cb-verification-student-name">
                <strong>Candidate:</strong> Student #{experience.student_id}
              </p>
            )}

            {experience.organization_name && (
              <p className="cb-verification-org">
                <strong>Organization:</strong> {experience.organization_name}
              </p>
            )}

            <p className="cb-verification-dates">
              <strong>Dates:</strong> {startDateFormatted} – {endDateFormatted}
              {experience.is_current && (
                <span className="cb-badge cb-badge-current" style={{ marginLeft: '0.4rem' }}>
                  Current
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="cb-verification-card-body">
        <div className="cb-verification-desc-block">
          <h4 className="cb-verification-section-heading">Description & Responsibilities</h4>
          <p className="cb-verification-description">{experience.description}</p>
        </div>

        {experience.innovation_project_id && (
          <div className="cb-verification-project-wrap">
            <span className="cb-linked-project-label">Linked Portfolio Project:</span>
            <Link
              to={`/app/projects/${experience.innovation_project_id}`}
              className="cb-experience-project-link"
              aria-label={`View linked Innovation Project #${experience.innovation_project_id}`}
            >
              🚀 View Innovation Project #{experience.innovation_project_id} &rarr;
            </Link>
          </div>
        )}

        {displaySkills.length > 0 && (
          <div className="cb-verification-skills-wrap">
            <h4 className="cb-verification-section-heading">Reported Skills & Technologies</h4>
            <div className="cb-experience-skills" aria-label="Candidate skills">
              {displaySkills.map((skillName, idx) => (
                <span key={`${skillName}-${idx}`} className="cb-skill-tag">
                  {skillName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {actionError && (
        <div className="cb-alert cb-alert-danger" role="alert" style={{ margin: '0.75rem 1.25rem 0' }}>
          {actionError}
        </div>
      )}

      <div className="cb-verification-card-footer">
        {!showRejectBox ? (
          <div className="cb-verification-action-buttons">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="cb-btn cb-btn-success cb-btn-sm"
              aria-label={`Approve verification for ${experience.title}`}
              data-testid={`approve-btn-${experience.id}`}
            >
              {isSubmitting ? 'Processing...' : '✓ Approve Verification'}
            </button>

            <button
              type="button"
              onClick={() => setShowRejectBox(true)}
              disabled={isSubmitting}
              className="cb-btn cb-btn-danger cb-btn-sm"
              aria-label={`Reject verification for ${experience.title}`}
              data-testid={`reject-btn-${experience.id}`}
            >
              ✕ Reject Request
            </button>
          </div>
        ) : (
          <div
            className="cb-rejection-notes-box"
            data-testid={`rejection-box-${experience.id}`}
          >
            <label htmlFor={`reject-notes-${experience.id}`} className="cb-label">
              Reason for Rejection / Feedback Notes (Optional)
            </label>
            <textarea
              id={`reject-notes-${experience.id}`}
              rows={3}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Provide constructive feedback or audit reason for rejection..."
              className={`cb-textarea ${rejectionError ? 'cb-input-error' : ''}`}
              disabled={isSubmitting}
            />
            {rejectionError && (
              <span className="cb-field-error" role="alert">
                {rejectionError}
              </span>
            )}
            <div className="cb-rejection-box-actions">
              <button
                type="button"
                onClick={() => {
                  setShowRejectBox(false);
                  setRejectionNotes('');
                  setRejectionError(null);
                }}
                disabled={isSubmitting}
                className="cb-btn cb-btn-secondary cb-btn-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="cb-btn cb-btn-danger cb-btn-xs"
                data-testid={`confirm-reject-btn-${experience.id}`}
              >
                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
