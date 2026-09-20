import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getRecruiterApplications, updateApplicationStatus } from '@/api/applications';
import { getJobById } from '@/api/jobs';
import { Application, ApplicationFilterStatus, ApplicationStatus } from '@/types/application';
import { JobPosting } from '@/types/job';
import { RecruiterApplicationCard } from '@/components/applications/RecruiterApplicationCard';
import { ApplicationFilterBar } from '@/components/applications/ApplicationFilterBar';
import { ApiErrorResponse } from '@/types/api';

export const RecruiterApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobsMap, setJobsMap] = useState<Map<number, JobPosting>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingAppId, setUpdatingAppId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Client-side filter states
  const [statusFilter, setStatusFilter] = useState<ApplicationFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchApplicationsAndJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const apps = await getRecruiterApplications();
      setApplications(apps);

      // Collect unique job IDs to prevent duplicate/N+1 requests
      const uniqueJobIds = Array.from(
        new Set(apps.map((app) => app.job_posting_id))
      );

      if (uniqueJobIds.length > 0) {
        const jobResults = await Promise.all(
          uniqueJobIds.map(async (jobId) => {
            try {
              const job = await getJobById(jobId);
              return { jobId, job };
            } catch {
              return { jobId, job: null };
            }
          })
        );

        const newMap = new Map<number, JobPosting>();
        jobResults.forEach(({ jobId, job }) => {
          if (job) {
            newMap.set(jobId, job);
          }
        });
        setJobsMap(newMap);
      } else {
        setJobsMap(new Map());
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
          apiError?.message ||
          'Failed to load received candidate applications. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplicationsAndJobs();
  }, [fetchApplicationsAndJobs]);

  const handleStatusChange = async (applicationId: number, newStatus: ApplicationStatus) => {
    setUpdatingAppId(applicationId);
    setToastMessage(null);

    try {
      const updated = await updateApplicationStatus(applicationId, newStatus);
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? updated : app))
      );
      setToastMessage({
        type: 'success',
        text: `Application #${applicationId} status updated to ${newStatus}.`,
      });
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      const msg = detailStr || apiError?.message || 'Failed to update application status.';
      setToastMessage({ type: 'error', text: msg });
      throw err; // Re-throw to let RecruiterApplicationCard revert its select state
    } finally {
      setUpdatingAppId(null);
    }
  };

  // Client-side filtered list
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && app.status !== statusFilter) {
        return false;
      }

      // 2. Keyword Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const job = jobsMap.get(app.job_posting_id);
        const titleMatch = job?.title.toLowerCase().includes(query);
        const companyMatch = job?.company_name.toLowerCase().includes(query);
        const locationMatch = job?.location?.toLowerCase().includes(query);
        const studentIdMatch =
          `candidate #${app.student_id}`.toLowerCase().includes(query) ||
          String(app.student_id).includes(query);
        const statusMatch = app.status.toLowerCase().includes(query);
        const coverMatch = app.cover_message?.toLowerCase().includes(query);

        if (!titleMatch && !companyMatch && !locationMatch && !studentIdMatch && !statusMatch && !coverMatch) {
          return false;
        }
      }

      return true;
    });
  }, [applications, jobsMap, statusFilter, searchQuery]);

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="cb-recruiter-applications-page" data-testid="recruiter-applications-page">
      {/* Page Header */}
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Candidate Applications</h1>
          <p className="cb-page-subtitle">
            Review applicant submissions across all your job postings and triage candidate statuses.
          </p>
        </div>
      </div>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          className={`cb-alert ${
            toastMessage.type === 'success' ? 'cb-alert-success' : 'cb-alert-danger'
          } cb-toast-alert`}
          role="status"
          aria-live="polite"
        >
          {toastMessage.text}
        </div>
      )}

      {/* Error Alert State */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm cb-retry-btn"
            onClick={fetchApplicationsAndJobs}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="cb-loading-container" role="status" aria-label="Loading applications">
          <div className="cb-spinner" />
          <p className="cb-loading-text">Loading candidate applications...</p>
        </div>
      ) : applications.length === 0 && !errorMessage ? (
        /* Empty State (No Applications Received) */
        <div className="cb-empty-state cb-card">
          <div className="cb-empty-state-icon">📥</div>
          <h2 className="cb-empty-state-title">No Candidate Applications Yet</h2>
          <p className="cb-empty-state-text">
            No candidates have submitted applications for your job postings yet. Make sure your job
            postings are active to attract student candidates.
          </p>
        </div>
      ) : (
        /* Applications Content */
        <div className="cb-applications-content">
          {/* Client-side Filter Bar */}
          <ApplicationFilterBar
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            onStatusChange={setStatusFilter}
            onSearchChange={setSearchQuery}
            onReset={handleResetFilters}
            totalCount={applications.length}
            filteredCount={filteredApplications.length}
            searchPlaceholder="Search by candidate ID, job title, cover message, or status..."
          />

          {/* Filtered Empty State */}
          {filteredApplications.length === 0 ? (
            <div className="cb-empty-state cb-card cb-filtered-empty">
              <p className="cb-empty-state-text">
                No candidate applications match your selected filter criteria.
              </p>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-sm"
                onClick={handleResetFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            /* Application Cards Grid */
            <div className="cb-applications-list" role="feed" aria-label="Candidate applications received">
              {filteredApplications.map((app) => (
                <RecruiterApplicationCard
                  key={app.id}
                  application={app}
                  job={jobsMap.get(app.job_posting_id) || null}
                  onStatusChange={handleStatusChange}
                  isUpdating={updatingAppId === app.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
