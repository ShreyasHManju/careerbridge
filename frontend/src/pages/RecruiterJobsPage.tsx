import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { JobPosting } from '@/types/job';
import { getMyJobPostings, updateJob, deleteJob } from '@/api/jobs';
import { JobFormModal } from '@/components/jobs/JobFormModal';
import { ApiErrorResponse } from '@/types/api';

type StatusFilter = 'all' | 'active' | 'inactive';

interface ToastState {
  type: 'success' | 'error';
  text: string;
}

export const RecruiterJobsPage: React.FC = () => {
  const { user } = useAuth();
  const isRecruiter = user?.role === 'recruiter';

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);

  // Operation loaders
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getMyJobPostings();
      setJobs(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const msg =
        typeof apiError?.detail === 'string'
          ? apiError.detail
          : apiError?.message || 'Failed to load job postings. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRecruiter) {
      fetchJobs();
    } else {
      setIsLoading(false);
    }
  }, [isRecruiter, fetchJobs]);

  const handleOpenCreateModal = () => {
    setEditingJob(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (job: JobPosting) => {
    setEditingJob(job);
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = (savedJob: JobPosting) => {
    if (editingJob) {
      // Edit mode: replace existing job in local state with backend source of truth
      setJobs((prev) => prev.map((j) => (j.id === savedJob.id ? savedJob : j)));
      setToastMessage({
        type: 'success',
        text: `Job posting "${savedJob.title}" updated successfully!`,
      });
    } else {
      // Create mode: prepend new job to local state
      setJobs((prev) => [savedJob, ...prev]);
      setToastMessage({
        type: 'success',
        text: `Job posting "${savedJob.title}" created successfully!`,
      });
    }
    setEditingJob(null);
  };

  const handleToggleActive = async (job: JobPosting) => {
    if (togglingId) return;
    const targetStatus = !job.is_active;
    setTogglingId(job.id);
    try {
      const updated = await updateJob(job.id, { is_active: targetStatus });
      // Update state with backend response
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      setToastMessage({
        type: 'success',
        text: `Posting "${updated.title}" is now ${updated.is_active ? 'Active' : 'Deactivated'}.`,
      });
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const msg =
        typeof apiError?.detail === 'string'
          ? apiError.detail
          : apiError?.message || 'Failed to update job status. Please try again.';
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteJob(jobToDelete.id);
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      setToastMessage({
        type: 'success',
        text: `Job posting "${jobToDelete.title}" was permanently deleted.`,
      });
      setJobToDelete(null);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const msg =
        typeof apiError?.detail === 'string'
          ? apiError.detail
          : apiError?.message || 'Failed to delete job posting. Please try again.';
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isRecruiter) {
    return (
      <div className="cb-saved-jobs-container" data-testid="recruiter-jobs-forbidden">
        <div className="cb-alert cb-alert-danger" role="alert">
          <p>Access restricted. Only recruiter accounts can manage job postings.</p>
        </div>
      </div>
    );
  }

  const activeCount = jobs.filter((j) => j.is_active).length;
  const inactiveCount = jobs.filter((j) => !j.is_active).length;

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === 'active') return job.is_active;
    if (statusFilter === 'inactive') return !job.is_active;
    return true;
  });

  const formatSalary = (job: JobPosting): string | null => {
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

  return (
    <div className="cb-saved-jobs-container" data-testid="recruiter-jobs-page">
      {/* Page Header */}
      <header className="cb-page-header">
        <div>
          <h1 className="cb-page-title">Job Postings</h1>
          <p className="cb-page-subtitle">
            Create, publish, edit, and track your organization&apos;s job and internship listings.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {!isLoading && !errorMessage && (
            <span className="cb-count-badge" data-testid="recruiter-jobs-count">
              {jobs.length} {jobs.length === 1 ? 'total posting' : 'total postings'}
            </span>
          )}
          <button
            type="button"
            className="cb-btn cb-btn-primary"
            onClick={handleOpenCreateModal}
            data-testid="create-job-btn"
          >
            + Post a Job
          </button>
        </div>
      </header>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`cb-alert ${toastMessage.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'}`}
          role={toastMessage.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          data-testid="recruiter-jobs-toast"
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

      {/* Filter Tabs */}
      {!isLoading && !errorMessage && jobs.length > 0 && (
        <div className="cb-filter-tabs" role="tablist" aria-label="Filter job postings by status" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'all'}
            className={`cb-btn cb-btn-sm ${statusFilter === 'all' ? 'cb-btn-primary' : 'cb-btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
            data-testid="filter-tab-all"
          >
            All ({jobs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'active'}
            className={`cb-btn cb-btn-sm ${statusFilter === 'active' ? 'cb-btn-primary' : 'cb-btn-secondary'}`}
            onClick={() => setStatusFilter('active')}
            data-testid="filter-tab-active"
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'inactive'}
            className={`cb-btn cb-btn-sm ${statusFilter === 'inactive' ? 'cb-btn-primary' : 'cb-btn-secondary'}`}
            onClick={() => setStatusFilter('inactive')}
            data-testid="filter-tab-inactive"
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      )}

      {/* Error State */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" data-testid="recruiter-jobs-error">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm"
            onClick={fetchJobs}
            style={{ marginTop: '0.75rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="cb-loading-state" role="status" aria-live="polite" data-testid="recruiter-jobs-loading">
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading your job postings...</p>
        </div>
      ) : !errorMessage && jobs.length === 0 ? (
        /* Empty State (No jobs at all) */
        <div className="cb-empty-card" data-testid="recruiter-jobs-empty">
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
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <h2>No Job Postings Yet</h2>
          <p className="cb-empty-desc">
            You have not posted any jobs or internships yet. Create your first listing to start connecting with top student talent.
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-primary"
            onClick={handleOpenCreateModal}
            style={{ marginTop: '1rem' }}
          >
            + Post Your First Job
          </button>
        </div>
      ) : !errorMessage && filteredJobs.length === 0 ? (
        /* Empty Filter State */
        <div className="cb-empty-card" data-testid="recruiter-jobs-empty-filter">
          <h2>No {statusFilter} Postings Found</h2>
          <p className="cb-empty-desc">
            There are currently no job postings matching the &ldquo;{statusFilter}&rdquo; filter.
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={() => setStatusFilter('all')}
            style={{ marginTop: '1rem' }}
          >
            View All Postings
          </button>
        </div>
      ) : !errorMessage ? (
        /* Populated Job List */
        <div className="cb-job-list" data-testid="recruiter-jobs-list">
          {filteredJobs.map((job) => {
            const salaryDisplay = formatSalary(job);
            const deadlineDisplay = formatDate(job.application_deadline);
            const postedDateDisplay = formatDate(job.created_at);
            const skillsList = job.skills
              ? job.skills.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            return (
              <article
                key={job.id}
                className="cb-card cb-job-card"
                data-testid={`recruiter-job-card-${job.id}`}
              >
                <div className="cb-job-card-header">
                  <div className="cb-job-card-title-group">
                    <h2 className="cb-job-title" style={{ fontSize: '1.25rem', margin: 0 }}>
                      <Link to={`/app/jobs/${job.id}`} className="cb-job-title-link">
                        {job.title}
                      </Link>
                    </h2>
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

                  <div className="cb-job-badges" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span
                      className={`cb-badge ${job.is_active ? 'cb-badge-active' : 'cb-badge-inactive'}`}
                      style={{
                        backgroundColor: job.is_active ? 'var(--cb-success-bg)' : '#f1f5f9',
                        color: job.is_active ? 'var(--cb-success)' : 'var(--cb-text-muted)',
                        fontWeight: 600,
                        border: `1px solid ${job.is_active ? 'var(--cb-success)' : '#cbd5e1'}`,
                      }}
                      data-testid={`status-badge-${job.id}`}
                    >
                      {job.is_active ? 'Active' : 'Inactive'}
                    </span>
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

                <div className="cb-job-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link
                      to={`/app/jobs/${job.id}`}
                      className="cb-btn cb-btn-secondary cb-btn-sm"
                    >
                      View Details
                    </Link>
                    <Link
                      to="/app/recruiter/applications"
                      className="cb-btn cb-btn-secondary cb-btn-sm"
                      data-testid={`view-apps-btn-${job.id}`}
                    >
                      View Applications
                    </Link>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary cb-btn-sm"
                      onClick={() => handleOpenEditModal(job)}
                      data-testid={`edit-job-btn-${job.id}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`cb-btn cb-btn-sm ${job.is_active ? 'cb-btn-secondary' : 'cb-btn-secondary'}`}
                      onClick={() => handleToggleActive(job)}
                      disabled={togglingId === job.id}
                      data-testid={`toggle-active-btn-${job.id}`}
                    >
                      {togglingId === job.id
                        ? job.is_active
                          ? 'Deactivating...'
                          : 'Reactivating...'
                        : job.is_active
                        ? 'Deactivate'
                        : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      className="cb-btn cb-btn-danger cb-btn-sm"
                      onClick={() => setJobToDelete(job)}
                      data-testid={`delete-job-btn-${job.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {/* Job Create/Edit Form Modal */}
      {isFormModalOpen && (
        <JobFormModal
          isOpen={isFormModalOpen}
          initialJob={editingJob}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingJob(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {jobToDelete && (
        <div
          className="cb-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setJobToDelete(null);
            }
          }}
        >
          <div
            className="cb-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            data-testid="delete-confirm-modal"
            style={{ maxWidth: '500px' }}
          >
            <div className="cb-modal-header">
              <h2 id="delete-dialog-title" className="cb-modal-title">
                Confirm Permanent Deletion
              </h2>
              <button
                type="button"
                className="cb-modal-close-btn"
                onClick={() => setJobToDelete(null)}
                disabled={isDeleting}
                aria-label="Close delete confirmation"
              >
                &times;
              </button>
            </div>

            <div className="cb-modal-body">
              <p style={{ margin: 0 }}>
                Are you sure you want to permanently delete{' '}
                <strong>&ldquo;{jobToDelete.title}&rdquo;</strong>?
              </p>
              <p style={{ color: 'var(--cb-danger)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                This action cannot be undone. Any candidates who applied will retain their application history, but the listing will be permanently removed.
              </p>
            </div>

            <div className="cb-modal-footer">
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                className="cb-btn cb-btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="cb-btn cb-btn-danger"
                disabled={isDeleting}
                data-testid="confirm-delete-btn"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
