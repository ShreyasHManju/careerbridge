import React from 'react';
import { Link } from 'react-router-dom';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';

interface StudentApplicationCardProps {
  application: Application;
  job?: JobPosting | null;
  isLoadingJob?: boolean;
}

export const StudentApplicationCard: React.FC<StudentApplicationCardProps> = ({
  application,
  job,
  isLoadingJob = false,
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

      {application.cover_message && (
        <div className="cb-app-card-cover-message">
          <span className="cb-app-card-cover-label">Your Cover Note:</span>
          <p className="cb-app-card-cover-text">{application.cover_message}</p>
        </div>
      )}

      <div className="cb-app-card-actions">
        <Link
          to={`/app/jobs/${application.job_posting_id}`}
          className="cb-btn cb-btn-secondary cb-btn-sm"
        >
          View Opportunity Details
        </Link>
      </div>
    </article>
  );
};
