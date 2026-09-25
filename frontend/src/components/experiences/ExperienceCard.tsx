import React from 'react';
import { Link } from 'react-router-dom';
import {
  ExperienceRecord,
  ExperienceType,
  VerificationSource,
} from '@/types/experience';
import { ExperienceVerificationBadge } from './ExperienceVerificationBadge';

export interface ExperienceCardProps {
  experience: ExperienceRecord;
  isOwner?: boolean;
  onEdit?: (experience: ExperienceRecord) => void;
  onDelete?: (experience: ExperienceRecord) => void;
  onRequestVerification?: (experience: ExperienceRecord) => void;
  isLoadingAction?: boolean;
}

export const formatExperienceType = (type: ExperienceType): string => {
  switch (type) {
    case 'internship':
      return 'Internship';
    case 'work':
      return 'Work Experience';
    case 'project':
      return 'Project';
    case 'research':
      return 'Research';
    case 'leadership':
      return 'Leadership';
    case 'certification':
      return 'Certification';
    default:
      return type;
  }
};

export const formatExperienceDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parts.length > 2 ? parseInt(parts[2], 10) : 1;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatVerificationSource = (source: VerificationSource): string => {
  switch (source) {
    case 'platform_project':
      return 'Verified via Platform Project';
    case 'recruiter_confirmed':
      return 'Verified by Partner Organization';
    case 'admin_confirmed':
      return 'Verified by Administrator';
    case 'self_claimed':
    default:
      return 'Self-Claimed';
  }
};

export const ExperienceCard: React.FC<ExperienceCardProps> = ({
  experience,
  isOwner = false,
  onEdit,
  onDelete,
  onRequestVerification,
  isLoadingAction = false,
}) => {
  const isVerified = experience.status === 'verified';
  const isPending = experience.status === 'pending_verification';
  const isRejected = experience.status === 'rejected';
  const isDraftOrClaimed = experience.status === 'draft' || experience.status === 'claimed';

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

  return (
    <article
      className={`cb-card cb-experience-card ${
        isVerified ? 'cb-experience-card-verified' : ''
      }`}
      data-testid={`experience-card-${experience.id}`}
      aria-label={`${experience.title} at ${experience.organization_name || 'Independent'}`}
    >
      <div className="cb-experience-card-header">
        <div className="cb-experience-header-main">
          <div className="cb-experience-title-row">
            <h3 className="cb-experience-title">{experience.title}</h3>
            <div className="cb-experience-badges">
              <span className={`cb-badge cb-badge-exp-type cb-badge-exp-${experience.experience_type}`}>
                {formatExperienceType(experience.experience_type)}
              </span>
              <ExperienceVerificationBadge status={experience.status} size="sm" />
            </div>
          </div>

          {experience.organization_name && (
            <p className="cb-experience-org">{experience.organization_name}</p>
          )}

          <p className="cb-experience-dates">
            <span className="cb-experience-date-icon" aria-hidden="true">
              📅
            </span>{' '}
            <time dateTime={experience.start_date}>{startDateFormatted}</time>
            {' – '}
            {experience.is_current ? (
              <span>Present</span>
            ) : experience.end_date ? (
              <time dateTime={experience.end_date}>{endDateFormatted}</time>
            ) : (
              <span>Present</span>
            )}
            {experience.is_current && (
              <span className="cb-badge cb-badge-current" style={{ marginLeft: '0.5rem' }}>
                Current
              </span>
            )}
          </p>
        </div>
      </div>

      {isVerified && (
        <div
          className="cb-experience-verified-banner"
          data-testid={`verified-banner-${experience.id}`}
          role="note"
          aria-label="Verified achievement details"
        >
          <span className="cb-verified-banner-icon" aria-hidden="true">
            🛡️
          </span>
          <div className="cb-verified-banner-text">
            <strong>Verified Achievement</strong>
            <span className="cb-verified-banner-source">
              {' • '}
              {formatVerificationSource(experience.verification_source)}
              {experience.verified_at && (
                <> on {formatExperienceDate(experience.verified_at)}</>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="cb-experience-card-body">
        <p className="cb-experience-description">{experience.description}</p>

        {experience.innovation_project_id && (
          <div className="cb-experience-project-link-wrap">
            <span className="cb-linked-project-label">Linked Project:</span>
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
          <div
            className="cb-experience-skills"
            aria-label="Experience skills and technologies"
          >
            {displaySkills.map((skillName, idx) => (
              <span key={`${skillName}-${idx}`} className="cb-skill-tag">
                {skillName}
              </span>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="cb-experience-card-footer">
          <div className="cb-experience-footer-status-text">
            {isPending && (
              <span className="cb-exp-status-hint cb-exp-status-hint-pending">
                ⏳ Verification request in review by authorized partner or admin.
              </span>
            )}
            {isRejected && (
              <span className="cb-exp-status-hint cb-exp-status-hint-rejected">
                ✕ Verification not approved. You may edit and resubmit.
              </span>
            )}
          </div>

          <div className="cb-experience-actions">
            {(isDraftOrClaimed || isRejected) && onRequestVerification && (
              <button
                type="button"
                onClick={() => onRequestVerification(experience)}
                disabled={isLoadingAction}
                className="cb-btn cb-btn-primary cb-btn-xs"
                aria-label={`Request verification for ${experience.title}`}
                data-testid={`request-verify-btn-${experience.id}`}
              >
                {isRejected ? 'Resubmit Verification' : 'Request Verification'}
              </button>
            )}

            {!isVerified && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(experience)}
                disabled={isLoadingAction}
                className="cb-btn cb-btn-secondary cb-btn-xs"
                aria-label={`Edit ${experience.title}`}
                data-testid={`edit-experience-btn-${experience.id}`}
              >
                Edit
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(experience)}
                disabled={isLoadingAction}
                className="cb-btn cb-btn-danger cb-btn-xs"
                aria-label={`Delete ${experience.title}`}
                data-testid={`delete-experience-btn-${experience.id}`}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};
