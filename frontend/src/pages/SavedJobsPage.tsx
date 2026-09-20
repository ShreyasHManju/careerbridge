import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { getSavedJobs, unsaveJob } from '@/api/savedJobs';
import { SavedJob, JobPosting } from '@/types/job';
import { JobCard } from '@/components/jobs/JobCard';
import { ApplyModal } from '@/components/jobs/ApplyModal';
import { ApiErrorResponse } from '@/types/api';

/**
 * Helper to normalize SavedJob into JobPosting shape for JobCard compatibility
 */
function toJobPosting(item: SavedJob): JobPosting {
  if (item.job_posting) {
    return item.job_posting;
  }
  return {
    id: item.id,
    recruiter_id: (item as unknown as { recruiter_id?: number }).recruiter_id ?? 0,
    title: item.title ?? 'Untitled Opportunity',
    description: item.description ?? '',
    opportunity_type: item.opportunity_type ?? 'internship',
    company_name: item.company_name ?? 'Unknown Company',
    location: item.location ?? null,
    is_remote: item.is_remote ?? false,
    employment_type: item.employment_type ?? 'full_time',
    skills: item.skills ?? null,
    minimum_qualification: item.minimum_qualification ?? null,
    experience_required: item.experience_required ?? null,
    salary_min: item.salary_min ?? null,
    salary_max: item.salary_max ?? null,
    application_deadline: item.application_deadline ?? null,
    is_active: item.is_active ?? true,
    created_at: item.created_at,
    updated_at: item.updated_at ?? item.created_at,
  };
}

export const SavedJobsPage: React.FC = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unsavingId, setUnsavingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Apply Modal state
  const [selectedJobToApply, setSelectedJobToApply] = useState<JobPosting | null>(null);

  const fetchSavedJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getSavedJobs();
      setSavedJobs(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
        apiError?.message ||
        'Failed to load saved opportunities. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStudent) {
      fetchSavedJobs();
    }
  }, [isStudent, fetchSavedJobs]);

  const handleUnsave = async (jobId: number) => {
    if (unsavingId != null) return;

    setUnsavingId(jobId);
    setToastMessage(null);

    try {
      await unsaveJob(jobId);
      // Remove item from state upon backend-confirmed unsave
      setSavedJobs((prev) => prev.filter((item) => (item.job_posting_id ?? item.id) !== jobId));
      setToastMessage({
        type: 'success',
        text: 'Opportunity removed from your saved list.',
      });
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setToastMessage({
        type: 'error',
        text: detailStr || apiError?.message || 'Failed to remove saved opportunity. Please try again.',
      });
    } finally {
      setUnsavingId(null);
    }
  };

  if (!isStudent) {
    return (
      <div className="cb-saved-jobs-container" data-testid="saved-jobs-forbidden">
        <div className="cb-alert cb-alert-danger" role="alert">
          <p>Access restricted. Only student accounts can view and manage saved opportunities.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-saved-jobs-container" data-testid="saved-jobs-page">
      {/* Page Header */}
      <header className="cb-page-header">
        <div>
          <h1 className="cb-page-title">Saved Jobs</h1>
          <p className="cb-page-subtitle">
            Review and manage opportunities you have bookmarked for quick application.
          </p>
        </div>
        {!isLoading && !errorMessage && savedJobs.length > 0 && (
          <span className="cb-count-badge" data-testid="saved-jobs-count">
            {savedJobs.length} {savedJobs.length === 1 ? 'saved opportunity' : 'saved opportunities'}
          </span>
        )}
      </header>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`cb-alert ${toastMessage.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'}`}
          role={toastMessage.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="cb-alert-close-btn"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error State */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm"
            onClick={fetchSavedJobs}
            style={{ marginTop: '0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="cb-loading-state" role="status" aria-live="polite">
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading your saved opportunities...</p>
        </div>
      ) : !errorMessage && savedJobs.length === 0 ? (
        /* Empty State */
        <div className="cb-empty-card" data-testid="saved-jobs-empty">
          <svg
            className="cb-empty-icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--cb-text-muted)' }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <h2>No Saved Opportunities Yet</h2>
          <p className="cb-empty-desc">
            You haven&apos;t saved any jobs or internships yet. Browse available openings and bookmark the ones that match your career goals.
          </p>
          <Link to="/app/jobs" className="cb-btn cb-btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Explore Opportunities
          </Link>
        </div>
      ) : !errorMessage ? (
        /* Populated List */
        <div className="cb-job-list" data-testid="saved-jobs-list">
          {savedJobs.map((item) => {
            const jobPosting = toJobPosting(item);
            return (
              <JobCard
                key={item.saved_id ?? item.id}
                job={jobPosting}
                isSaved={true}
                isSaving={unsavingId === jobPosting.id}
                onToggleSave={handleUnsave}
                onApply={(job) => setSelectedJobToApply(job)}
                userRole={user?.role}
              />
            );
          })}
        </div>
      ) : null}

      {/* Apply Modal */}
      {selectedJobToApply && (
        <ApplyModal
          isOpen={true}
          job={selectedJobToApply}
          onClose={() => setSelectedJobToApply(null)}
          onSuccess={() => {
            setSelectedJobToApply(null);
            setToastMessage({
              type: 'success',
              text: `Application submitted successfully for ${selectedJobToApply.title}!`,
            });
          }}
        />
      )}
    </div>
  );
};
