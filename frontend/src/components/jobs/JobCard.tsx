import React from 'react';
import { Link } from 'react-router-dom';
import { JobPosting } from '@/types/job';

interface JobCardProps {
  job: JobPosting;
  isSaved?: boolean;
  isSaving?: boolean;
  onToggleSave?: (jobId: number) => void;
  onApply?: (job: JobPosting) => void;
  userRole?: string;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  onApply,
  userRole,
}) => {
  const isStudent = userRole === 'student';

  const formatSalary = (): string | null => {
    if (job.salary_min != null && job.salary_max != null) {
      return `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`;
    }
    if (job.salary_min != null) {
      return `From $${job.salary_min.toLocaleString()}`;
    }
    if (job.salary_max != null) {
      return `Up to $${job.salary_max.toLocaleString()}`;
    }
    return null;
  };

  const formatDate = (dateString?: string | null): string | null => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const salaryDisplay = formatSalary();
  const deadlineDisplay = formatDate(job.application_deadline);
  const postedDateDisplay = formatDate(job.created_at);

  const skillsList = job.skills
    ? job.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <article className="cb-card cb-job-card" data-testid={`job-card-${job.id}`}>
      <div className="cb-job-card-header">
        <div className="cb-job-card-title-group">
          <h3 className="cb-job-title">
            <Link to={`/app/jobs/${job.id}`} className="cb-job-title-link">
              {job.title}
            </Link>
          </h3>
          <div className="cb-job-company-row">
            <span className="cb-job-company">{job.company_name}</span>
            {job.location && (
              <span className="cb-job-location">
                <span className="cb-separator">•</span> {job.location}
              </span>
            )}
            {job.is_remote && (
              <span className="cb-badge cb-badge-remote">Remote</span>
            )}
          </div>
        </div>

        <div className="cb-job-badges">
          <span className={`cb-badge cb-badge-opp cb-badge-${job.opportunity_type}`}>
            {job.opportunity_type === 'internship' ? 'Internship' : 'Job'}
          </span>
          <span className="cb-badge cb-badge-emp">
            {job.employment_type === 'full_time'
              ? 'Full-time'
              : job.employment_type === 'part_time'
              ? 'Part-time'
              : 'Contract'}
          </span>
        </div>
      </div>

      <p className="cb-job-description">
        {job.description.length > 200
          ? `${job.description.slice(0, 200)}...`
          : job.description}
      </p>

      {skillsList.length > 0 && (
        <div className="cb-job-skills">
          {skillsList.map((skill, idx) => (
            <span key={idx} className="cb-skill-tag">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="cb-job-meta">
        {salaryDisplay && (
          <div className="cb-job-meta-item">
            <span className="cb-meta-label">Salary:</span>
            <span className="cb-meta-value">{salaryDisplay}</span>
          </div>
        )}
        {deadlineDisplay && (
          <div className="cb-job-meta-item">
            <span className="cb-meta-label">Deadline:</span>
            <span className="cb-meta-value">{deadlineDisplay}</span>
          </div>
        )}
        {postedDateDisplay && (
          <div className="cb-job-meta-item">
            <span className="cb-meta-label">Posted:</span>
            <span className="cb-meta-value">{postedDateDisplay}</span>
          </div>
        )}
      </div>

      <div className="cb-job-card-actions">
        <Link
          to={`/app/jobs/${job.id}`}
          className="cb-btn cb-btn-secondary cb-btn-sm"
        >
          View Details
        </Link>

        {isStudent && (
          <div className="cb-student-actions">
            <button
              type="button"
              onClick={() => onToggleSave?.(job.id)}
              disabled={isSaving}
              className={`cb-btn cb-btn-sm ${
                isSaved ? 'cb-btn-saved' : 'cb-btn-secondary'
              }`}
              aria-label={isSaved ? `Unsave job ${job.title}` : `Save job ${job.title}`}
              data-testid={`save-btn-${job.id}`}
            >
              {isSaving ? 'Saving...' : isSaved ? '★ Saved' : '☆ Save'}
            </button>

            <button
              type="button"
              onClick={() => onApply?.(job)}
              className="cb-btn cb-btn-primary cb-btn-sm"
              data-testid={`apply-btn-${job.id}`}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </article>
  );
};
