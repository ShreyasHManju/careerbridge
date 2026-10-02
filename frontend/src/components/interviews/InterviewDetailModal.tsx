import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Interview, InterviewType } from '@/types/interview';
import { InterviewStatusBadge } from './InterviewStatusBadge';

interface InterviewDetailModalProps {
  isOpen?: boolean;
  interview: Interview | null;
  role: 'student' | 'recruiter';
  onClose: () => void;
  onReschedule?: (interview: Interview) => void;
  onCancel?: (interview: Interview) => void;
  onMarkComplete?: (interview: Interview) => void;
  isMutating?: boolean;
}

const TYPE_CONFIG: Record<InterviewType, { label: string; icon: string; description: string }> = {
  online: {
    label: 'Online Video Call',
    icon: '💻',
    description: 'Virtual meeting via video conferencing link.',
  },
  in_person: {
    label: 'In-Person Meeting',
    icon: '🏢',
    description: 'Face-to-face meeting at the designated office/room location.',
  },
  phone: {
    label: 'Phone Call',
    icon: '📞',
    description: 'Audio phone interview with the hiring team.',
  },
};

const formatFullDateTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
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

export const InterviewDetailModal: React.FC<InterviewDetailModalProps> = ({
  isOpen = true,
  interview,
  role,
  onClose,
  onReschedule,
  onCancel,
  onMarkComplete,
  isMutating = false,
}) => {
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !interview) return null;

  const typeInfo = TYPE_CONFIG[interview.interview_type] || {
    label: interview.interview_type,
    icon: '📅',
    description: 'Scheduled interview event.',
  };

  const formattedDateTime = formatFullDateTime(interview.scheduled_at);
  const isOnline = interview.interview_type === 'online';
  const hasValidUrl = isHttpUrl(interview.location_or_link);
  const isActionable =
    interview.status === 'scheduled' || interview.status === 'rescheduled';

  return (
    <div
      className="cb-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="cb-modal cb-modal-md cb-interview-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-detail-title"
        data-testid={`interview-detail-modal-${interview.id}`}
      >
        {/* Modal Header */}
        <header className="cb-modal-header">
          <div className="cb-modal-title-group">
            <h2 id="interview-detail-title" className="cb-modal-title">
              Interview Details
            </h2>
            <p className="cb-modal-subtitle">
              Reference #{interview.id} &bull; Application #{interview.application_id}
            </p>
          </div>
          <button
            type="button"
            className="cb-modal-close"
            onClick={onClose}
            aria-label="Close interview details"
            data-testid="close-interview-detail-modal"
          >
            &times;
          </button>
        </header>

        {/* Modal Body */}
        <div className="cb-modal-body">
          {/* Opportunity Banner */}
          <div className="cb-detail-opportunity-banner">
            <div>
              <h3 className="cb-detail-job-heading">
                {interview.job_id ? (
                  <Link
                    to={`/app/jobs/${interview.job_id}`}
                    className="cb-detail-job-link"
                    onClick={onClose}
                  >
                    {interview.job_title || `Job Opportunity #${interview.job_id}`}
                  </Link>
                ) : (
                  interview.job_title || 'Job Opportunity'
                )}
              </h3>
              <p className="cb-detail-company-text">
                {interview.company_name || 'Hiring Organization'}
              </p>
            </div>
            <div>
              <InterviewStatusBadge status={interview.status} />
            </div>
          </div>

          {/* Key Schedule Information */}
          <div className="cb-detail-meta-grid">
            <div className="cb-detail-meta-cell">
              <span className="cb-detail-meta-label">Scheduled Date & Time</span>
              <span className="cb-detail-meta-value cb-detail-time-highlight">
                📅 {formattedDateTime}
              </span>
            </div>

            <div className="cb-detail-meta-cell">
              <span className="cb-detail-meta-label">Duration</span>
              <span className="cb-detail-meta-value">
                ⏱️ {interview.duration_minutes} minutes
              </span>
            </div>

            <div className="cb-detail-meta-cell">
              <span className="cb-detail-meta-label">Format</span>
              <span className="cb-detail-meta-value">
                {typeInfo.icon} {typeInfo.label}
              </span>
              <small className="cb-detail-meta-hint">{typeInfo.description}</small>
            </div>

            <div className="cb-detail-meta-cell">
              <span className="cb-detail-meta-label">
                {role === 'recruiter' ? 'Candidate Contact' : 'Hiring Team Contact'}
              </span>
              <span className="cb-detail-meta-value">
                ✉️ {role === 'recruiter'
                  ? interview.candidate_email || `Candidate #${interview.student_id}`
                  : interview.recruiter_email || interview.company_name || 'Hiring Recruiter'}
              </span>
            </div>
          </div>

          {/* Meeting Link / Physical Location */}
          {interview.location_or_link && (
            <div className="cb-detail-section">
              <h4 className="cb-detail-section-title">
                {isOnline ? '🎥 Virtual Meeting Link' : '📍 Location & Instructions'}
              </h4>
              <div className="cb-detail-location-box">
                {isOnline && hasValidUrl ? (
                  <div className="cb-detail-join-action-group">
                    <a
                      href={interview.location_or_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cb-btn cb-btn-primary cb-btn-sm"
                      data-testid="detail-join-interview-btn"
                    >
                      🎥 Launch Video Call
                    </a>
                    <span className="cb-detail-url-text" title={interview.location_or_link}>
                      {interview.location_or_link}
                    </span>
                  </div>
                ) : (
                  <p className="cb-detail-location-text">{interview.location_or_link}</p>
                )}
              </div>
            </div>
          )}

          {/* Agenda & Instructions */}
          {interview.notes && (
            <div className="cb-detail-section">
              <h4 className="cb-detail-section-title">📝 Agenda, Preparation & Notes</h4>
              <div className="cb-detail-notes-box">
                <p className="cb-detail-notes-text" style={{ whiteSpace: 'pre-line' }}>
                  {interview.notes}
                </p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="cb-detail-timestamps">
            <span>Created: {new Date(interview.created_at).toLocaleDateString()}</span>
            <span>Last Updated: {new Date(interview.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <footer className="cb-modal-footer">
          <div className="cb-detail-footer-actions">
            {role === 'recruiter' && isActionable && onReschedule && (
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={() => {
                  onClose();
                  onReschedule(interview);
                }}
                disabled={isMutating}
                data-testid="detail-reschedule-btn"
              >
                Reschedule / Edit
              </button>
            )}

            {role === 'recruiter' && isActionable && onMarkComplete && (
              <button
                type="button"
                className="cb-btn cb-btn-outline-success cb-btn-sm"
                onClick={() => {
                  onClose();
                  onMarkComplete(interview);
                }}
                disabled={isMutating}
                data-testid="detail-complete-btn"
              >
                Mark Completed
              </button>
            )}

            {role === 'recruiter' && isActionable && onCancel && (
              <button
                type="button"
                className="cb-btn cb-btn-outline-danger cb-btn-sm"
                onClick={() => {
                  onClose();
                  onCancel(interview);
                }}
                disabled={isMutating}
                data-testid="detail-cancel-btn"
              >
                Cancel Interview
              </button>
            )}

            {role === 'recruiter' && interview.student_id ? (
              <Link
                to={`/app/messages?recipientId=${interview.student_id}`}
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={onClose}
                data-testid="detail-message-candidate-btn"
              >
                💬 Message Candidate
              </Link>
            ) : null}

            {role === 'student' && interview.recruiter_id ? (
              <Link
                to={`/app/messages?recipientId=${interview.recruiter_id}`}
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={onClose}
                data-testid="detail-message-recruiter-btn"
              >
                💬 Message Hiring Team
              </Link>
            ) : null}

            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
