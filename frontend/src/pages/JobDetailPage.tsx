import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { getJobById } from '@/api/jobs';
import { getSavedJobStatus, saveJob, unsaveJob } from '@/api/savedJobs';
import { JobPosting } from '@/types/job';
import { ApplyModal } from '@/components/jobs/ApplyModal';
import { ApiErrorResponse } from '@/types/api';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const numericJobId = Number(jobId);

  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [job, setJob] = useState<JobPosting | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [is404, setIs404] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Saved job status
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Apply modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);

  const fetchJobData = useCallback(async () => {
    if (!jobId || isNaN(numericJobId)) {
      setIs404(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIs404(false);
    setErrorMessage(null);

    try {
      const jobData = await getJobById(numericJobId);
      setJob(jobData);

      // If student, check saved status
      if (isStudent) {
        try {
          const status = await getSavedJobStatus(numericJobId);
          setIsSaved(status.is_saved);
        } catch {
          // Non-critical saved status fetch error
        }
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      if (apiError?.status === 404) {
        setIs404(true);
      } else {
        const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
        setErrorMessage(
          detailStr ||
          apiError?.message ||
          'Failed to load job details. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [jobId, numericJobId, isStudent]);

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  const handleToggleSave = async () => {
    if (!job || !isStudent || isSaving) return;

    setIsSaving(true);
    try {
      if (isSaved) {
        await unsaveJob(job.id);
        setIsSaved(false);
        showToast('success', 'Opportunity removed from your saved list.');
      } else {
        await saveJob(job.id);
        setIsSaved(true);
        showToast('success', 'Opportunity saved to your bookmarks!');
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      showToast('error', detailStr || apiError?.message || 'Failed to update saved status.');
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const formatSalary = (): string | null => {
    if (!job) return null;
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

  if (isLoading) {
    return (
      <div className="cb-loading-screen" role="status">
        <div className="cb-spinner" />
        <p>Loading job details...</p>
      </div>
    );
  }

  if (is404) {
    return (
      <div className="cb-card cb-job-unavailable" data-testid="job-404-state">
        <h2>Job Unavailable</h2>
        <p>Job posting is no longer active or available.</p>
        <Link to="/app/jobs" className="cb-btn cb-btn-primary">
          &larr; Back to Opportunities
        </Link>
      </div>
    );
  }

  if (errorMessage || !job) {
    return (
      <div className="cb-card cb-error-container" role="alert">
        <h2>Unable to Load Opportunity</h2>
        <p>{errorMessage || 'An unexpected error occurred.'}</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="cb-btn cb-btn-primary"
            onClick={fetchJobData}
          >
            Retry
          </button>
          <Link to="/app/jobs" className="cb-btn cb-btn-secondary">
            Back to Opportunities
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="cb-job-detail-container" data-testid="job-detail-container">
      <div className="cb-job-detail-nav">
        <Link to="/app/jobs" className="cb-link">
          &larr; Back to Opportunities
        </Link>
      </div>

      {toastMessage && (
        <div
          className={`cb-alert cb-alert-${toastMessage.type === 'success' ? 'success' : 'danger'} cb-discovery-toast`}
          role="status"
        >
          {toastMessage.text}
        </div>
      )}

      {/* Main Detail Header Card */}
      <article className="cb-card cb-job-detail-card">
        <div className="cb-job-detail-header">
          <div>
            <h1 className="cb-job-detail-title">{job.title}</h1>
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

        {/* Key Metadata Overview */}
        <div className="cb-job-detail-meta-grid">
          {salaryDisplay && (
            <div className="cb-detail-meta-card">
              <span className="cb-detail-meta-title">Compensation</span>
              <span className="cb-detail-meta-val">{salaryDisplay}</span>
            </div>
          )}
          {deadlineDisplay && (
            <div className="cb-detail-meta-card">
              <span className="cb-detail-meta-title">Application Deadline</span>
              <span className="cb-detail-meta-val">{deadlineDisplay}</span>
            </div>
          )}
          {postedDateDisplay && (
            <div className="cb-detail-meta-card">
              <span className="cb-detail-meta-title">Date Posted</span>
              <span className="cb-detail-meta-val">{postedDateDisplay}</span>
            </div>
          )}
        </div>

        {/* Student Action Bar */}
        {isStudent && (
          <div className="cb-job-detail-actions">
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={() => setIsApplyModalOpen(true)}
              data-testid="detail-apply-btn"
            >
              Apply Now
            </button>
            <button
              type="button"
              className={`cb-btn ${isSaved ? 'cb-btn-saved' : 'cb-btn-secondary'}`}
              onClick={handleToggleSave}
              disabled={isSaving}
              aria-label={isSaved ? `Unsave job ${job.title}` : `Save job ${job.title}`}
              data-testid="detail-save-btn"
            >
              {isSaving ? 'Saving...' : isSaved ? '★ Saved to Bookmarks' : '☆ Save Opportunity'}
            </button>
          </div>
        )}

        <hr className="cb-divider" />

        {/* Job Description */}
        <section className="cb-job-detail-section">
          <h2>About the Role</h2>
          <div className="cb-job-description-content">
            <p style={{ whiteSpace: 'pre-line' }}>{job.description}</p>
          </div>
        </section>

        {/* Skills Required */}
        {skillsList.length > 0 && (
          <section className="cb-job-detail-section">
            <h2>Required Skills & Technologies</h2>
            <div className="cb-job-skills">
              {skillsList.map((skill, idx) => (
                <span key={idx} className="cb-skill-tag">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Qualifications & Experience */}
        {(job.minimum_qualification || job.experience_required) && (
          <section className="cb-job-detail-section">
            <h2>Qualifications & Requirements</h2>
            <dl className="cb-dl">
              {job.minimum_qualification && (
                <div className="cb-dl-row">
                  <dt>Minimum Qualification:</dt>
                  <dd>{job.minimum_qualification}</dd>
                </div>
              )}
              {job.experience_required && (
                <div className="cb-dl-row">
                  <dt>Experience Required:</dt>
                  <dd>{job.experience_required}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </article>

      {/* Apply Modal */}
      <ApplyModal
        isOpen={isApplyModalOpen}
        job={job}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          showToast('success', 'Your application has been submitted successfully!');
        }}
      />
    </div>
  );
};
