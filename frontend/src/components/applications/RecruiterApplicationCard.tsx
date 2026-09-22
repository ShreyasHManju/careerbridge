import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Application, ApplicationStatus } from '@/types/application';
import { JobPosting } from '@/types/job';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';

interface RecruiterApplicationCardProps {
  application: Application;
  job?: JobPosting | null;
  onStatusChange: (applicationId: number, newStatus: ApplicationStatus) => Promise<void>;
  onScheduleInterview?: (application: Application, job: JobPosting | null) => void;
  isUpdating?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (applicationId: number) => void;
  selectable?: boolean;
}

const ALL_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'accepted', label: 'Accepted' },
];

export const RecruiterApplicationCard: React.FC<RecruiterApplicationCardProps> = ({
  application,
  job,
  onStatusChange,
  onScheduleInterview,
  isUpdating = false,
  isSelected = false,
  onToggleSelect,
  selectable = true,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>(application.status);
  const [localUpdating, setLocalUpdating] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const formattedDate = new Date(application.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const jobTitle = job?.title || `Job Posting #${application.job_posting_id}`;
  const companyName = job?.company_name || 'Your Company';

  const handleStatusSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ApplicationStatus;
    if (newStatus === application.status || localUpdating || isUpdating) {
      return;
    }

    setStatusError(null);
    setLocalUpdating(true);
    setSelectedStatus(newStatus);

    try {
      await onStatusChange(application.id, newStatus);
    } catch (err: unknown) {
      // Revert select back to current application status on error
      setSelectedStatus(application.status);
      const errorObj = err as { message?: string; detail?: string };
      setStatusError(
        typeof errorObj?.detail === 'string'
          ? errorObj.detail
          : errorObj?.message || 'Failed to update application status. Please try again.'
      );
    } finally {
      setLocalUpdating(false);
    }
  };

  const isBusy = localUpdating || isUpdating;
  const isInterviewEligible =
    application.status === 'applied' ||
    application.status === 'reviewing' ||
    application.status === 'shortlisted';

  return (
    <article
      className={`cb-recruiter-app-card cb-card ${isSelected ? 'cb-card-selected' : ''}`}
      data-testid={`recruiter-app-card-${application.id}`}
      aria-label={`Application #${application.id} for ${jobTitle} from Candidate #${application.student_id}`}
    >
      <div className="cb-app-card-header">
        <div className="cb-app-card-title-group">
          <div className="cb-recruiter-card-subheading">
            {selectable && onToggleSelect && (
              <label
                className="cb-checkbox-wrapper cb-app-select-label"
                htmlFor={`select-app-${application.id}`}
              >
                <input
                  id={`select-app-${application.id}`}
                  type="checkbox"
                  className="cb-checkbox cb-app-select-checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(application.id)}
                  aria-label={`Select Application #${application.id}`}
                  aria-checked={isSelected}
                  data-testid={`select-app-checkbox-${application.id}`}
                />
                <span className="sr-only">Select Application #{application.id}</span>
              </label>
            )}
            <span className="cb-app-id-pill">Application #{application.id}</span>
            <span className="cb-candidate-id-pill">Candidate #{application.student_id}</span>
          </div>

          <h3 className="cb-app-card-title">
            <Link
              to={`/app/jobs/${application.job_posting_id}`}
              className="cb-app-card-link"
            >
              {jobTitle}
            </Link>
          </h3>
          <p className="cb-app-card-company">{companyName}</p>
        </div>

        <div className="cb-recruiter-status-control-group">
          <div className="cb-app-card-status-wrapper">
            <ApplicationStatusBadge status={application.status} />
          </div>

          <div className="cb-status-select-container">
            <label
              htmlFor={`status-select-${application.id}`}
              className="cb-status-select-label"
            >
              Update Status:
            </label>
            <select
              id={`status-select-${application.id}`}
              className="cb-select cb-select-sm cb-status-select"
              value={selectedStatus}
              onChange={handleStatusSelect}
              disabled={isBusy}
              aria-label={`Change status for Application #${application.id}`}
            >
              {ALL_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {isBusy && (
              <span
                className="cb-status-updating-indicator"
                role="status"
                aria-label="Updating status..."
              >
                Updating...
              </span>
            )}
          </div>
        </div>
      </div>

      {statusError && (
        <div className="cb-alert cb-alert-danger cb-status-error-alert" role="alert">
          {statusError}
        </div>
      )}

      <div className="cb-app-card-meta">
        {job?.opportunity_type && (
          <span className="cb-tag cb-tag-opportunity">
            {job.opportunity_type === 'internship' ? 'Internship' : 'Job'}
          </span>
        )}
        <span className="cb-app-card-date">Received {formattedDate}</span>
      </div>

      {application.cover_message ? (
        <div className="cb-app-card-cover-message">
          <span className="cb-app-card-cover-label">Candidate Cover Message:</span>
          <p className="cb-app-card-cover-text">{application.cover_message}</p>
        </div>
      ) : (
        <div className="cb-app-card-cover-message cb-app-card-cover-empty">
          <span className="cb-app-card-cover-label">Cover Message:</span>
          <p className="cb-app-card-cover-text">No cover message provided.</p>
        </div>
      )}

      {/* Recruiter Action Row */}
      <div className="cb-app-card-bottom-actions">
        {onScheduleInterview && isInterviewEligible && (
          <button
            type="button"
            className="cb-btn cb-btn-outline-primary cb-btn-sm"
            onClick={() => onScheduleInterview(application, job || null)}
            data-testid={`schedule-interview-btn-${application.id}`}
          >
            📅 Schedule Interview
          </button>
        )}
        <Link
          to={`/app/messages?userId=${application.student_id}`}
          className="cb-btn cb-btn-secondary cb-btn-sm"
          data-testid={`message-candidate-btn-${application.id}`}
        >
          💬 Message Candidate
        </Link>
      </div>
    </article>
  );
};
