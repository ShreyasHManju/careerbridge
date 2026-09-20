import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyApplications } from '@/api/applications';
import { getJobById } from '@/api/jobs';
import { Application, ApplicationFilterStatus } from '@/types/application';
import { JobPosting } from '@/types/job';
import { StudentApplicationCard } from '@/components/applications/StudentApplicationCard';
import { ApplicationFilterBar } from '@/components/applications/ApplicationFilterBar';
import { ApiErrorResponse } from '@/types/api';

export const StudentApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobsMap, setJobsMap] = useState<Map<number, JobPosting>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-side filter states
  const [statusFilter, setStatusFilter] = useState<ApplicationFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchApplicationsAndJobs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const apps = await getMyApplications();
      setApplications(apps);

      // Collect unique job IDs to prevent duplicate/N+1 requests
      const uniqueJobIds = Array.from(
        new Set(apps.map((app) => app.job_posting_id))
      );

      if (uniqueJobIds.length > 0) {
        // Fetch all unique job postings in parallel with individual error resilience
        const jobResults = await Promise.all(
          uniqueJobIds.map(async (jobId) => {
            try {
              const job = await getJobById(jobId);
              return { jobId, job };
            } catch {
              // Gracefully handle missing/failed job lookup without failing the page
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
          'Failed to load your applications. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplicationsAndJobs();
  }, [fetchApplicationsAndJobs]);

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
        const statusMatch = app.status.toLowerCase().includes(query);

        if (!titleMatch && !companyMatch && !locationMatch && !statusMatch) {
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
    <div className="cb-student-applications-page" data-testid="student-applications-page">
      {/* Page Header */}
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">My Applications</h1>
          <p className="cb-page-subtitle">
            Track and manage your submitted internship and job applications in real time.
          </p>
        </div>

        <div className="cb-page-header-actions">
          <Link to="/app/jobs" className="cb-btn cb-btn-secondary">
            🔍 Explore Opportunities
          </Link>
        </div>
      </div>

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
          <p className="cb-loading-text">Loading your submitted applications...</p>
        </div>
      ) : applications.length === 0 && !errorMessage ? (
        /* Empty State (No Applications Submitted) */
        <div className="cb-empty-state cb-card">
          <div className="cb-empty-state-icon">📋</div>
          <h2 className="cb-empty-state-title">No Applications Submitted Yet</h2>
          <p className="cb-empty-state-text">
            You haven&apos;t applied to any internships or job opportunities yet. Browse our active
            listings to find positions that match your skills and career interests.
          </p>
          <Link to="/app/jobs" className="cb-btn cb-btn-primary">
            Browse Active Opportunities
          </Link>
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
            searchPlaceholder="Search by job title, company, location, or status..."
          />

          {/* Filtered Empty State */}
          {filteredApplications.length === 0 ? (
            <div className="cb-empty-state cb-card cb-filtered-empty">
              <p className="cb-empty-state-text">
                No applications match your selected filter criteria.
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
            <div className="cb-applications-list" role="feed" aria-label="Your submitted applications">
              {filteredApplications.map((app) => (
                <StudentApplicationCard
                  key={app.id}
                  application={app}
                  job={jobsMap.get(app.job_posting_id) || null}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
