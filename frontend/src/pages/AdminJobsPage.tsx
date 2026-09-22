import React, { useCallback, useEffect, useState } from 'react';
import { AdminJobQueryParams } from '@/types/admin';
import { JobPosting } from '@/types/job';
import * as adminApi from '@/api/admin';
import { JobModerationModal } from '@/components/admin/JobModerationModal';
import { ApiErrorResponse } from '@/types/api';

export const AdminJobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [search, setSearch] = useState<string>('');
  const [opportunityType, setOpportunityType] = useState<'internship' | 'job' | ''>('');
  const [employmentType, setEmploymentType] = useState<
    'full_time' | 'part_time' | 'contract' | 'internship' | ''
  >('');
  const [isActive, setIsActive] = useState<string>(''); // '' | 'true' | 'false'

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const [selectedJobForModeration, setSelectedJobForModeration] = useState<JobPosting | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: AdminJobQueryParams = {
        page,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (opportunityType) params.opportunity_type = opportunityType;
      if (employmentType) params.employment_type = employmentType;
      if (isActive === 'true') params.is_active = true;
      if (isActive === 'false') params.is_active = false;

      const resp = await adminApi.getAdminJobs(params);
      setJobs(resp.items);
      setTotal(resp.total);
      setTotalPages(resp.total_pages || 1);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setError(
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        'Failed to load job postings for moderation.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search, opportunityType, employmentType, isActive]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const handleOpportunityTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOpportunityType(e.target.value as 'internship' | 'job' | '');
    setPage(1);
  };

  const handleEmploymentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEmploymentType(
      e.target.value as 'full_time' | 'part_time' | 'contract' | 'internship' | ''
    );
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsActive(e.target.value);
    setPage(1);
  };

  const handleJobModerationSuccess = (updatedJob: JobPosting) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
    );
    setActionSuccessMessage(
      `Job posting "${updatedJob.title}" status was successfully updated to ${
        updatedJob.is_active ? 'Active' : 'Inactive'
      }.`
    );
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  return (
    <div className="cb-admin-page-container" data-testid="admin-jobs-page">
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Job & Internship Moderation</h1>
          <p className="cb-page-subtitle">
            Inspect all platform job postings, review compliance, and moderate posting visibility.
          </p>
        </div>
      </div>

      {actionSuccessMessage && (
        <div className="cb-alert cb-alert-success" role="alert" style={{ marginBottom: '1.5rem' }}>
          {actionSuccessMessage}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="cb-admin-filter-bar">
        <form onSubmit={handleSearchSubmit} className="cb-admin-search-form">
          <input
            type="text"
            className="cb-input cb-input-sm"
            placeholder="Search title, company, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search job postings"
            data-testid="job-search-input"
          />
          <button type="submit" className="cb-btn cb-btn-primary cb-btn-sm" data-testid="search-jobs-btn">
            Search
          </button>
        </form>

        <div className="cb-admin-filter-group">
          <label htmlFor="opp-type-filter" className="cb-filter-label">Type:</label>
          <select
            id="opp-type-filter"
            className="cb-input cb-input-sm cb-select"
            value={opportunityType}
            onChange={handleOpportunityTypeChange}
            data-testid="opp-type-filter-select"
          >
            <option value="">All Types</option>
            <option value="job">Job</option>
            <option value="internship">Internship</option>
          </select>

          <label htmlFor="emp-type-filter" className="cb-filter-label">Employment:</label>
          <select
            id="emp-type-filter"
            className="cb-input cb-input-sm cb-select"
            value={employmentType}
            onChange={handleEmploymentTypeChange}
            data-testid="emp-type-filter-select"
          >
            <option value="">All Employment</option>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>

          <label htmlFor="job-status-filter" className="cb-filter-label">Status:</label>
          <select
            id="job-status-filter"
            className="cb-input cb-input-sm cb-select"
            value={isActive}
            onChange={handleStatusChange}
            data-testid="job-status-filter-select"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Content States */}
      {isLoading ? (
        <div className="cb-dashboard-loading" role="status" aria-live="polite">
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading job postings for moderation...</p>
        </div>
      ) : error ? (
        <div className="cb-dashboard-error-container" role="alert">
          <div className="cb-alert cb-alert-danger">
            <p className="cb-alert-message">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchJobs}
            className="cb-btn cb-btn-primary cb-retry-btn"
            data-testid="retry-jobs-btn"
          >
            Retry
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="cb-empty-state" data-testid="jobs-empty-state">
          <h3>No Job Postings Found</h3>
          <p>No postings matched your moderation filter and search criteria.</p>
        </div>
      ) : (
        <>
          <div className="cb-table-responsive">
            <table className="cb-table cb-table-hover" aria-label="Job Postings Moderation Table">
              <thead>
                <tr>
                  <th scope="col">Job Title</th>
                  <th scope="col">Company</th>
                  <th scope="col">Type</th>
                  <th scope="col">Employment</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} data-testid={`job-row-${j.id}`}>
                    <td>
                      <strong>{j.title}</strong>
                    </td>
                    <td>{j.company_name || '—'}</td>
                    <td>
                      <span className="cb-badge cb-badge-info">
                        {j.opportunity_type === 'internship' ? '🎓 Internship' : '💼 Job'}
                      </span>
                    </td>
                    <td>
                      <span className="cb-tag">{j.employment_type.replace('_', ' ')}</span>
                    </td>
                    <td>
                      {j.location || '—'} {j.is_remote ? '(Remote)' : ''}
                    </td>
                    <td>
                      <span
                        className={`cb-badge ${j.is_active ? 'cb-badge-success' : 'cb-badge-danger'}`}
                        data-testid={`job-status-${j.id}`}
                      >
                        {j.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={`cb-btn cb-btn-xs ${
                          j.is_active ? 'cb-btn-danger' : 'cb-btn-success'
                        }`}
                        onClick={() => setSelectedJobForModeration(j)}
                        data-testid={`toggle-job-${j.id}-btn`}
                      >
                        {j.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="cb-pagination-container">
            <span className="cb-pagination-info">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total postings)
            </span>
            <div className="cb-pagination" role="navigation" aria-label="Jobs pagination">
              <button
                type="button"
                className="cb-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                aria-label="Previous page"
                data-testid="prev-page-btn"
              >
                ← Previous
              </button>
              <button
                type="button"
                className="cb-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                aria-label="Next page"
                data-testid="next-page-btn"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Job Moderation Modal */}
      <JobModerationModal
        isOpen={Boolean(selectedJobForModeration)}
        job={selectedJobForModeration}
        onClose={() => setSelectedJobForModeration(null)}
        onSuccess={handleJobModerationSuccess}
      />
    </div>
  );
};
