import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { getJobs } from '@/api/jobs';
import { getSavedJobs, saveJob, unsaveJob } from '@/api/savedJobs';
import { JobPosting, JobFilters, JobPostingPagination } from '@/types/job';
import { JobCard } from '@/components/jobs/JobCard';
import { JobFilterBar } from '@/components/jobs/JobFilterBar';
import { ApplyModal } from '@/components/jobs/ApplyModal';
import { ApiErrorResponse } from '@/types/api';

const defaultFilters: JobFilters = {
  page: 1,
  page_size: 10,
  sort_by: 'created_at',
  sort_order: 'desc',
};

export const JobDiscoveryPage: React.FC = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [data, setData] = useState<JobPostingPagination | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Saved jobs tracking (Set of job_posting_id for O(1) checks, prevents N+1)
  const [savedJobIds, setSavedJobIds] = useState<Set<number>>(new Set());
  const [savingJobId, setSavingJobId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Apply Modal state
  const [selectedJobToApply, setSelectedJobToApply] = useState<JobPosting | null>(null);

  // Load saved jobs for students once on mount
  useEffect(() => {
    if (isStudent) {
      getSavedJobs()
        .then((saved) => {
          const ids = new Set(saved.map((item) => item.job_posting_id));
          setSavedJobIds(ids);
        })
        .catch(() => {
          // Non-critical; saved state can degrade gracefully
        });
    }
  }, [isStudent]);

  // Fetch jobs whenever filters change
  const fetchJobs = useCallback(async (activeFilters: JobFilters) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getJobs(activeFilters);
      setData(response);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
        apiError?.message ||
        'Unable to load job opportunities. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(filters);
  }, [fetchJobs, filters]);

  // Save / Unsave toggle
  const handleToggleSave = async (jobId: number) => {
    if (!isStudent || savingJobId !== null) return;

    setSavingJobId(jobId);
    const isCurrentlySaved = savedJobIds.has(jobId);

    try {
      if (isCurrentlySaved) {
        await unsaveJob(jobId);
        setSavedJobIds((prev) => {
          const updated = new Set(prev);
          updated.delete(jobId);
          return updated;
        });
        showToast('success', 'Opportunity removed from your saved list.');
      } else {
        await saveJob(jobId);
        setSavedJobIds((prev) => {
          const updated = new Set(prev);
          updated.add(jobId);
          return updated;
        });
        showToast('success', 'Opportunity saved to your bookmarks!');
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      showToast('error', detailStr || apiError?.message || 'Failed to update saved status.');
    } finally {
      setSavingJobId(null);
    }
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleFilterChange = (newFilters: JobFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setFilters((prev) => ({ ...prev, page_size: newSize, page: 1 }));
  };

  const currentPage = data?.page || 1;
  const totalPages = data?.total_pages || 1;
  const totalItems = data?.total || 0;
  const items = useMemo(() => data?.items || [], [data]);

  return (
    <div className="cb-discovery-container">
      <header className="cb-discovery-header">
        <div>
          <h1 className="cb-discovery-title">Discover Opportunities</h1>
          <p className="cb-discovery-subtitle">
            Explore active internships and jobs curated for CareerBridge candidates.
          </p>
        </div>
      </header>

      {toastMessage && (
        <div
          className={`cb-alert cb-alert-${toastMessage.type === 'success' ? 'success' : 'danger'} cb-discovery-toast`}
          role="status"
        >
          {toastMessage.text}
        </div>
      )}

      {/* Filter and Search Bar */}
      <JobFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        isLoading={isLoading}
      />

      {/* Results Section */}
      <section className="cb-jobs-section" aria-label="Job opportunities list">
        {isLoading ? (
          <div className="cb-loading-screen" role="status">
            <div className="cb-spinner" />
            <p>Loading opportunities...</p>
          </div>
        ) : errorMessage ? (
          <div className="cb-card cb-error-container" role="alert">
            <h3>Failed to Load Opportunities</h3>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={() => fetchJobs(filters)}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="cb-card cb-empty-jobs" data-testid="empty-jobs-state">
            <h3>No opportunities found</h3>
            <p>
              We couldn't find any active postings matching your search and filter
              criteria.
            </p>
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={handleResetFilters}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="cb-jobs-results-header">
              <span className="cb-jobs-count">
                Showing {items.length} of {totalItems} {totalItems === 1 ? 'opportunity' : 'opportunities'}
              </span>
              <div className="cb-page-size-picker">
                <label htmlFor="page-size-select">Per page:</label>
                <select
                  id="page-size-select"
                  className="cb-select cb-select-sm"
                  value={filters.page_size || 10}
                  onChange={handlePageSizeChange}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>

            <div className="cb-jobs-grid">
              {items.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedJobIds.has(job.id)}
                  isSaving={savingJobId === job.id}
                  onToggleSave={handleToggleSave}
                  onApply={(j) => setSelectedJobToApply(j)}
                  userRole={user?.role}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <nav className="cb-pagination" aria-label="Opportunities pagination">
                <button
                  type="button"
                  className="cb-btn cb-btn-secondary cb-btn-sm"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="Previous page"
                >
                  &larr; Previous
                </button>

                <span className="cb-pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="cb-btn cb-btn-secondary cb-btn-sm"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="Next page"
                >
                  Next &rarr;
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {/* Apply Modal */}
      <ApplyModal
        isOpen={Boolean(selectedJobToApply)}
        job={selectedJobToApply}
        onClose={() => setSelectedJobToApply(null)}
        onSuccess={() => {
          showToast('success', 'Application submitted successfully!');
        }}
      />
    </div>
  );
};
