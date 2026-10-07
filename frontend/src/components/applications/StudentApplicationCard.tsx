import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';
import { Interview, InterviewType } from '@/types/interview';
import { JobOffer } from '@/types/jobOffer';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { InterviewStatusBadge } from '@/components/interviews/InterviewStatusBadge';
import { StudentOfferDecisionModal } from '@/components/offers/StudentOfferDecisionModal';
import { createExperienceFromAcceptedApplication } from '@/api/experiences';
import { getApplicationJobOffer } from '@/api/jobOffers';

export interface StudentApplicationCardProps {
  application: Application;
  job?: JobPosting | null;
  isLoadingJob?: boolean;
  interview?: Interview | null;
  interviews?: Interview[];
  offer?: JobOffer | null;
  onOfferDecided?: () => void;
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
    case 'offered':
      return 'Official job offer extended';
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
  offer: initialOffer = null,
  onOfferDecided,
}) => {
  const [isCreatingExperience, setIsCreatingExperience] = useState(false);
  const [experienceCreated, setExperienceCreated] = useState(false);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  // Job Offer state
  const [jobOffer, setJobOffer] = useState<JobOffer | null>(initialOffer);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState<boolean>(false);

  const fetchOffer = useCallback(async () => {
    if (application.status === 'offered' || application.status === 'accepted') {
      try {
        const fetched = await getApplicationJobOffer(application.id);
        setJobOffer(fetched);
      } catch {
        // Offer might not exist or failed
      }
    }
  }, [application.id, application.status]);

  useEffect(() => {
    if (initialOffer) {
      setJobOffer(initialOffer);
    } else if (application.status === 'offered' || application.status === 'accepted') {
      fetchOffer();
    }
  }, [application.status, initialOffer, fetchOffer]);

  const handleCreateExperience = async () => {
    if (
      application.status !== 'accepted' ||
      isCreatingExperience ||
      experienceCreated
    ) {
      return;
    }

    setIsCreatingExperience(true);
    setExperienceError(null);

    try {
      await createExperienceFromAcceptedApplication(application.id);
      setExperienceCreated(true);
    } catch (error: unknown) {
      let message = 'Unable to add this accepted application to your Experience Passport.';

      if (error instanceof Error && error.message) {
        message = error.message;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        message = error.message;
      }

      setExperienceError(message);
    } finally {
      setIsCreatingExperience(false);
    }
  };

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
  const isShortlistedOrBeyond =
    application.status === 'shortlisted' ||
    application.status === 'offered' ||
    application.status === 'accepted';

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
  const isReviewingStep =
    application.status === 'reviewing' ||
    application.status === 'shortlisted' ||
    application.status === 'offered' ||
    application.status === 'accepted';
  const isShortlistedStep =
    application.status === 'shortlisted' ||
    application.status === 'offered' ||
    application.status === 'accepted';
  const isInterviewStep =
    application.status === 'shortlisted' ||
    application.status === 'offered' ||
    application.status === 'accepted';
  const isDecisionStep =
    application.status === 'offered' ||
    application.status === 'accepted' ||
    application.status === 'rejected';

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

          <div
            className={`cb-journey-step ${
              isDecisionStep
                ? application.status === 'offered'
                  ? 'cb-step-offered'
                  : application.status === 'accepted'
                  ? 'cb-step-success'
                  : 'cb-step-closed'
                : ''
            }`}
          >
            <div className="cb-step-indicator">5</div>
            <span className="cb-step-label">
              {application.status === 'offered'
                ? 'Offered'
                : application.status === 'accepted'
                ? 'Accepted'
                : application.status === 'rejected'
                ? 'Closed'
                : 'Outcome'}
            </span>
          </div>
        </div>

        <div className="cb-app-journey-status-text">
          <span className="cb-journey-current-state">
            <strong>Current State:</strong> {statusMsg}
          </span>
        </div>
      </div>

      {/* Offer Received Alert Banner for OFFERED status */}
      {application.status === 'offered' && (
        <div
          className="cb-offer-card-banner"
          data-testid={`offer-card-banner-${application.id}`}
          role="region"
          aria-label="Job Offer Extended"
        >
          <div className="cb-offer-banner-content">
            <div className="cb-offer-banner-icon-group">
              <span className="cb-offer-banner-emoji" aria-hidden="true">🎉</span>
              <div>
                <strong className="cb-offer-banner-title">Official Job Offer Received!</strong>
                <p className="cb-offer-banner-desc">
                  {jobOffer?.title ? `${jobOffer.title} at ` : ''}{companyName} has extended a formal job offer.
                  {jobOffer?.compensation ? ` Compensation: ${jobOffer.currency || 'USD'} ${jobOffer.compensation.toLocaleString()}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cb-btn cb-btn-success cb-btn-sm cb-offer-banner-cta"
              onClick={() => setIsOfferModalOpen(true)}
              data-testid={`review-offer-btn-${application.id}`}
            >
              Review Offer & Decide 📋
            </button>
          </div>
        </div>
      )}

      {application.cover_message && (
        <div className="cb-app-card-cover-message">
          <span className="cb-app-card-cover-label">Your Cover Note:</span>
          <p className="cb-app-card-cover-text">{application.cover_message}</p>
        </div>
      )}

      {/* Upcoming Interview Preview Banner */}
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

        {isShortlistedOrBeyond && (
          <Link
            to="/app/interviews"
            className="cb-btn cb-btn-primary cb-btn-sm cb-btn-interview-link"
          >
            📅 View Interviews
          </Link>
        )}

        {application.status === 'offered' && jobOffer && (
          <button
            type="button"
            className="cb-btn cb-btn-success cb-btn-sm"
            onClick={() => setIsOfferModalOpen(true)}
            data-testid={`action-review-offer-btn-${application.id}`}
          >
            Review Offer ✍️
          </button>
        )}

        {application.status === 'accepted' && (
          <div className="cb-experience-passport-action">
            <button
              type="button"
              className="cb-btn cb-btn-primary cb-btn-sm"
              data-testid={`create-experience-btn-${application.id}`}
              onClick={handleCreateExperience}
              disabled={isCreatingExperience || experienceCreated}
            >
              {isCreatingExperience
                ? 'Adding to Experience Passport...'
                : experienceCreated
                  ? 'Added to Experience Passport'
                  : 'Add to Experience Passport'}
            </button>

            {experienceCreated && (
              <p
                data-testid={`experience-created-${application.id}`}
              >
                This accepted opportunity has been added to your Experience Passport.
              </p>
            )}

            {experienceError && (
              <div role="alert">
                {experienceError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Offer Decision Modal */}
      {isOfferModalOpen && (
        <StudentOfferDecisionModal
          isOpen={isOfferModalOpen}
          offer={
            jobOffer || {
              id: 0,
              application_id: application.id,
              recruiter_id: 0,
              title: jobTitle,
              compensation: null,
              currency: 'USD',
              start_date: null,
              expiration_date: null,
              terms: null,
              status: 'offered',
              created_at: application.created_at,
              updated_at: application.updated_at,
            }
          }
          job={job}
          onClose={() => setIsOfferModalOpen(false)}
          onDecisionComplete={(updatedOffer) => {
            setJobOffer(updatedOffer);
            if (onOfferDecided) {
              onOfferDecided();
            }
          }}
        />
      )}
    </article>
  );
};
