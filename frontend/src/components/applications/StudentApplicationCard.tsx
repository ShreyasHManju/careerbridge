import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';
import { Interview, InterviewType } from '@/types/interview';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { InterviewStatusBadge } from '@/components/interviews/InterviewStatusBadge';

export interface StudentApplicationCardProps {
  application: Application;
  job?: JobPosting | null;
  isLoadingJob?: boolean;
  interview?: Interview | null;
  interviews?: Interview[];
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

const getStatusMessage = (status: string): string => {
  switch (status) {
    case 'applied':
      return 'Application submitted';
    case 'reviewing':
      return 'Application under review';
    case 'shortlisted':
      return "You've been shortlisted";
    case 'accepted':
      return 'Application accepted';
    case 'rejected':
      return 'Application closed';
    default:
      return `Status: ${status}`;
  }
};

export const StudentApplicationCard: React.FC<StudentApplicationCardProps> = ({
  application,
  job,
  isLoadingJob = false,
  interview,
  interviews,
}) => {
  const formattedDate = new Date(application.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const jobTitle = job?.title || `Opportunity #${application.job_posting_id}`;
  const companyName = job?.company_name || 'Hiring Organization';
  const locationDisplay = job?.is_remote
    ? job?.location
      ? `${job.location} (Remote)`
      : 'Remote'
    : job?.location || 'Location not specified';

  const statusMsg = getStatusMessage(application.status);
  const isShortlistedOrAccepted = application.status === 'shortlisted' || application.status === 'accepted';

  // Resolve upcoming active interview
  const resolvedInterview = useMemo(() => {
    if (interview !== undefined) return interview;
    if (interviews && interviews.length > 0) {
      const appInterviews = interviews.filter((i) => i.application_id === application.id);
      const active = appInterviews
        .filter((i) => i.status === 'scheduled' || i.status === 'rescheduled')
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      if (active.length > 0) return active[0];
      if (appInterviews.length > 0) return appInterviews[0];
    }
    return null;
  }, [interview, interviews, application.id]);

  const hasActiveInterview =
    resolvedInterview !== null &&
    (resolvedInterview.status === 'scheduled' || resolvedInterview.status === 'rescheduled');

  const interviewTypeConfig = resolvedInterview
    ? TYPE_LABELS[resolvedInterview.interview_type] || {
        label: resolvedInterview.interview_type,
        icon: '📅',
      }
    : null;

  const hasJoinableMeetingUrl =
    hasActiveInterview &&
    resolvedInterview !== null &&
    isHttpUrl(resolvedInterview.location_or_link);

  // Journey stage progression helpers
  const isAppliedStep = true;
  const isReviewingStep = application.status === 'reviewing' || application.status === 'shortlisted' || application.status === 'accepted';
  const isShortlistedStep = application.status === 'shortlisted' || application.status === 'accepted';
  const isInterviewStep = application.status === 'shortlisted' || application.status === 'accepted';
  const isDecisionStep = application.status === 'accepted' || application.status === 'rejected';

  return (
    <article
      className="cb-student-app-card cb-card"
      data-testid={`student-app-card-${application.id}`}
      aria-label={`Application for ${jobTitle} at ${companyName}`}
    >
      <div className="cb-app-card-header">
        <div className="cb-app-card-title-group">
          {isLoadingJob ? (
            <div className="cb-app-card-loading-title" aria-label="Loading job details">
              <span className="cb-skeleton-text">Loading opportunity details...</span>
            </div>
          ) : (
            <>
              <h3 className="cb-app-card-title">
                <Link
                  to={`/app/jobs/${application.job_posting_id}`}
                  className="cb-app-card-link"
                >
                  {jobTitle}
                </Link>
              </h3>
              <p className="cb-app-card-company">{companyName}</p>
            </>
          )}
        </div>

        <div className="cb-app-card-status-wrapper">
          <ApplicationStatusBadge status={application.status} />
        </div>
      </div>

      <div className="cb-app-card-meta">
        {job?.opportunity_type && (
          <span className="cb-tag cb-tag-opportunity">
            {job.opportunity_type === 'internship' ? 'Internship' : 'Full-Time Job'}
          </span>
        )}
        <span className="cb-app-card-location">📍 {locationDisplay}</span>
        <span className="cb-app-card-date">Applied on {formattedDate}</span>
      </div>

      {/* Visual Application Journey Funnel */}
      <div className="cb-app-journey-tracker" aria-label={`Application Journey: ${statusMsg}`}>
        <div className="cb-app-journey-steps">
          <div className={`cb-journey-step ${isAppliedStep ? 'cb-step-active' : ''}`}>
            <div className="cb-step-indicator">1</div>
            <span className="cb-step-label">Applied</span>
          </div>
          <div className={`cb-journey-connector ${isReviewingStep ? 'cb-conn-active' : ''}`} />

          <div className={`cb-journey-step ${isReviewingStep ? 'cb-step-active' : ''}`}>
            <div className="cb-step-indicator">2</div>
            <span className="cb-step-label">Review</span>
          </div>
          <div className={`cb-journey-connector ${isShortlistedStep ? 'cb-conn-active' : ''}`} />

          <div className={`cb-journey-step ${isShortlistedStep ? 'cb-step-active' : ''}`}>
            <div className="cb-step-indicator">3</div>
            <span className="cb-step-label">Shortlist</span>
          </div>
          <div className={`cb-journey-connector ${isInterviewStep ? 'cb-conn-active' : ''}`} />

          <div className={`cb-journey-step ${isInterviewStep ? 'cb-step-active' : ''}`}>
            <div className="cb-step-indicator">4</div>
            <span className="cb-step-label">Interview</span>
          </div>
          <div className={`cb-journey-connector ${isDecisionStep ? 'cb-conn-active' : ''}`} />

          <div className={`cb-journey-step ${isDecisionStep ? (application.status === 'accepted' ? 'cb-step-success' : 'cb-step-closed') : ''}`}>
            <div className="cb-step-indicator">5</div>
            <span className="cb-step-label">
              {application.status === 'accepted' ? 'Offer' : application.status === 'rejected' ? 'Closed' : 'Outcome'}
            </span>
          </div>
        </div>

        <div className="cb-app-journey-status-text">
          <span className="cb-journey-current-state">
            <strong>Current State:</strong> {statusMsg}
          </span>
        </div>
      </div>

      {application.cover_message && (
        <div className="cb-app-card-cover-message">
          <span className="cb-app-card-cover-label">Your Cover Note:</span>
          <p className="cb-app-card-cover-text">{application.cover_message}</p>
        </div>
      )}

      {/* Upcoming Interview Preview Banner (Phase 4 Step 3) */}
      {hasActiveInterview && resolvedInterview && interviewTypeConfig && (
        <div
          className="cb-app-interview-preview"
          data-testid={`app-interview-preview-${application.id}`}
          aria-label="Upcoming Interview Details"
        >
          <div className="cb-app-interview-header">
            <div className="cb-app-interview-title-wrap">
              <span aria-hidden="true">📅</span>
              <strong className="cb-app-interview-title">Upcoming Interview</strong>
            </div>
            <InterviewStatusBadge status={resolvedInterview.status} size="sm" />
          </div>

          <div className="cb-app-interview-grid">
            <div className="cb-app-interview-item">
              <span className="cb-app-interview-item-label">Date & Time</span>
              <span className="cb-app-interview-item-value">
                {formatInterviewDateTime(resolvedInterview.scheduled_at)}
              </span>
            </div>

            <div className="cb-app-interview-item">
              <span className="cb-app-interview-item-label">Format & Duration</span>
              <span className="cb-app-interview-item-value">
                <span aria-hidden="true">{interviewTypeConfig.icon}</span>{' '}
                {interviewTypeConfig.label} ({resolvedInterview.duration_minutes} min)
              </span>
            </div>

            {resolvedInterview.location_or_link && (
              <div className="cb-app-interview-item cb-app-interview-item-full">
                <span className="cb-app-interview-item-label">
                  {resolvedInterview.interview_type === 'online' ? 'Meeting Link / Platform' : 'Location Details'}
                </span>
                <span className="cb-app-interview-item-value" style={{ wordBreak: 'break-all' }}>
                  {resolvedInterview.location_or_link}
                </span>
              </div>
            )}

            {resolvedInterview.notes && (
              <div className="cb-app-interview-item cb-app-interview-item-full">
                <span className="cb-app-interview-item-label">Notes & Instructions</span>
                <p className="cb-app-interview-notes">{resolvedInterview.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="cb-app-card-actions">
        <Link
          to={`/app/jobs/${application.job_posting_id}`}
          className="cb-btn cb-btn-secondary cb-btn-sm"
        >
          View Opportunity Details
        </Link>

        {/* Direct Join Meeting Action when active interview has valid online meeting URL */}
        {hasJoinableMeetingUrl && resolvedInterview?.location_or_link && (
          <a
            href={resolvedInterview.location_or_link}
            target="_blank"
            rel="noopener noreferrer"
            className="cb-btn cb-btn-success cb-btn-sm cb-btn-join-meeting"
            data-testid={`join-interview-btn-${application.id}`}
            aria-label={`Join Online Meeting for ${jobTitle}`}
          >
            Join Online Meeting 🎥
          </a>
        )}

        {isShortlistedOrAccepted && (
          <Link
            to="/app/interviews"
            className="cb-btn cb-btn-primary cb-btn-sm cb-btn-interview-link"
          >
            📅 View Interviews
          </Link>
        )}
      </div>
    </article>
  );
};
