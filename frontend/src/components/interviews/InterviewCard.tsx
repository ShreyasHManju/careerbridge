import React from 'react';
import { Link } from 'react-router-dom';
import { Interview, InterviewType } from '@/types/interview';
import { InterviewStatusBadge } from './InterviewStatusBadge';

interface InterviewCardProps {
  interview: Interview;
  role: 'student' | 'recruiter';
  onReschedule?: (interview: Interview) => void;
  onCancel?: (interview: Interview) => void;
  onMarkComplete?: (interview: Interview) => void;
  isMutating?: boolean;
}

const TYPE_LABELS: Record<InterviewType, { label: string; icon: string }> = {
  online: { label: 'Online Video', icon: '💻' },
  in_person: { label: 'In-Person', icon: '🏢' },
  phone: { label: 'Phone Call', icon: '📞' },
};

const formatInterviewDateTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
};

const isHttpUrl = (str: string | null): boolean => {
  if (!str) return false;
  return /^https?:\/\//i.test(str.trim());
};

export const InterviewCard: React.FC<InterviewCardProps> = ({
  interview,
  role,
  onReschedule,
  onCancel,
  onMarkComplete,
  isMutating = false,
}) => {
  const typeConfig = TYPE_LABELS[interview.interview_type] || {
    label: interview.interview_type,
    icon: '📅',
  };

  const formattedDateTime = formatInterviewDateTime(interview.scheduled_at);
  const isOnline = interview.interview_type === 'online';
  const hasValidUrl = isHttpUrl(interview.location_or_link);
  const isActionable =
    interview.status === 'scheduled' || interview.status === 'rescheduled';

  return (
    <article
      className="cb-interview-card"
      data-testid={`interview-card-${interview.id}`}
      aria-labelledby={`interview-title-${interview.id}`}
    >
      {/* Card Header */}
      <header className="cb-interview-card-header">
        <div className="cb-interview-card-title-group">
          <h3 id={`interview-title-${interview.id}`} className="cb-interview-job-title">
            {interview.job_id ? (
              <Link
                to={`/app/jobs/${interview.job_id}`}
                className="cb-interview-job-link"
              >
                {interview.job_title || `Job Posting #${interview.job_id}`}
              </Link>
            ) : (
              interview.job_title || 'Interview Opportunity'
            )}
          </h3>
          <span className="cb-interview-company-name">
            {interview.company_name || 'Hiring Company'}
          </span>
        </div>
        <div className="cb-interview-header-badge">
          <InterviewStatusBadge status={interview.status} />
        </div>
      </header>

      {/* Meta Grid */}
      <div className="cb-interview-meta-grid">
        <div className="cb-interview-meta-item">
          <span className="cb-interview-meta-label">Date & Time</span>
          <span className="cb-interview-meta-value cb-interview-time-highlight">
            {formattedDateTime}
          </span>
        </div>

        <div className="cb-interview-meta-item">
          <span className="cb-interview-meta-label">Duration</span>
          <span className="cb-interview-meta-value">
            {interview.duration_minutes} minutes
          </span>
        </div>

        <div className="cb-interview-meta-item">
          <span className="cb-interview-meta-label">Format</span>
          <span className="cb-interview-meta-value">
            <span aria-hidden="true" className="cb-interview-type-icon">
              {typeConfig.icon}
            </span>{' '}
            {typeConfig.label}
          </span>
        </div>

        {/* Participant Email */}
        <div className="cb-interview-meta-item">
          <span className="cb-interview-meta-label">
            {role === 'recruiter' ? 'Candidate' : 'Recruiter Contact'}
          </span>
          <span className="cb-interview-meta-value">
            {role === 'recruiter'
              ? interview.candidate_email || `Student #${interview.student_id}`
              : interview.recruiter_email || interview.company_name || 'Hiring Team'}
          </span>
        </div>
      </div>

      {/* Location / Meeting Link Details */}
      {interview.location_or_link && (
        <div className="cb-interview-location-section">
          <span className="cb-interview-section-label">
            {isOnline ? 'Meeting Link' : 'Location Details'}:
          </span>
          {isOnline && hasValidUrl ? (
            <div className="cb-interview-join-wrapper">
              <a
                href={interview.location_or_link}
                target="_blank"
                rel="noopener noreferrer"
                className="cb-btn cb-btn-sm cb-btn-join"
                aria-label={`Join interview for ${interview.job_title || 'job'}`}
              >
                🎥 Join Interview
              </a>
              <span className="cb-interview-url-text" title={interview.location_or_link}>
                {interview.location_or_link}
              </span>
            </div>
          ) : (
            <span className="cb-interview-location-text">
              {interview.location_or_link}
            </span>
          )}
        </div>
      )}

      {/* Recruiter Notes / Agenda */}
      {interview.notes && (
        <div className="cb-interview-notes-section">
          <span className="cb-interview-section-label">Notes & Instructions:</span>
          <p className="cb-interview-notes-text">{interview.notes}</p>
        </div>
      )}

      {/* Recruiter Action Controls */}
      {role === 'recruiter' && isActionable && (
        <footer className="cb-interview-card-actions">
          {onReschedule && (
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={() => onReschedule(interview)}
              disabled={isMutating}
            >
              Reschedule / Edit
            </button>
          )}

          {onMarkComplete && (
            <button
              type="button"
              className="cb-btn cb-btn-outline-success cb-btn-sm"
              onClick={() => onMarkComplete(interview)}
              disabled={isMutating}
            >
              Mark Completed
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              className="cb-btn cb-btn-outline-danger cb-btn-sm"
              onClick={() => onCancel(interview)}
              disabled={isMutating}
            >
              Cancel Interview
            </button>
          )}
        </footer>
      )}
    </article>
  );
};
