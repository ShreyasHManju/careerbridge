import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { JobPosting, OpportunityType, EmploymentType } from '@/types/job';
import { Application } from '@/types/application';
import { getMyJobPostings, updateJob, deleteJob } from '@/api/jobs';
import { getRecruiterApplications } from '@/api/applications';
import { exportRecruiterApplications } from '@/api/export';
import { JobFormModal } from '@/components/jobs/JobFormModal';
import { JobAnalyticsModal } from '@/components/jobs/JobAnalyticsModal';
import { ApiErrorResponse } from '@/types/api';

type StatusFilter = 'all' | 'active' | 'inactive';
type OpportunityFilter = 'all' | OpportunityType;
type EmploymentFilter = 'all' | EmploymentType;
type SortOption = 'newest' | 'oldest' | 'deadline' | 'salary_high' | 'salary_low';

interface ToastState {
  type: 'success' | 'error';
  text: string;
}

export const RecruiterJobsPage: React.FC = () => {
  const { user } = useAuth();
  const isRecruiter = user?.role === 'recruiter';

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [oppTypeFilter, setOppTypeFilter] = useState<OpportunityFilter>('all');
  const [empTypeFilter, setEmpTypeFilter] = useState<EmploymentFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [analyticsJob, setAnalyticsJob] = useState<JobPosting | null>(null);

  // Operation loaders
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchJobsAndApplications = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [jobsData, appsData] = await Promise.all([
        getMyJobPostings(),
        getRecruiterApplications().catch(() => [] as Application[]),
      ]);
      setJobs(jobsData);
      setApplications(appsData);
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
      fetchJobsAndApplications();
    } else {
      setIsLoading(false);
    }
  }, [isRecruiter, fetchJobsAndApplications]);

  const handleOpenCreateModal = () => {
    setEditingJob(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (job: JobPosting) => {
    setEditingJob(job);
    setIsFormModalOpen(true);
  };

  const handleOpenAnalyticsModal = (job: JobPosting) => {
    setAnalyticsJob(job);
  };

  const handleFormSuccess = (savedJob: JobPosting) => {
    if (editingJob) {
      setJobs((prev) => prev.map((j) => (j.id === savedJob.id ? savedJob : j)));
      setToastMessage({
        type: 'success',
        text: `Job posting "${savedJob.title}" updated successfully!`,
      });
    } else {
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

  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportRecruiterApplications();
      setToastMessage({
        type: 'success',
        text: 'Candidate applications exported successfully.',
      });
    } catch {
      setToastMessage({
        type: 'error',
        text: 'Failed to export candidate applications. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Map of job_posting_id to applicant count and unreviewed count
  const jobStatsMap = useMemo(() => {
    const map: Record<number, { total: number; awaiting: number; shortlisted: number; accepted: number }> = {};
    for (const app of applications) {
      if (!map[app.job_posting_id]) {
        map[app.job_posting_id] = { total: 0, awaiting: 0, shortlisted: 0, accepted: 0 };
      }
      map[app.job_posting_id].total += 1;
      if (app.status === 'applied') {
        map[app.job_posting_id].awaiting += 1;
      } else if (app.status === 'shortlisted') {
        map[app.job_posting_id].shortlisted += 1;
      } else if (app.status === 'accepted') {
        map[app.job_posting_id].accepted += 1;
      }
    }
    return map;
  }, [applications]);

  // Filtered and sorted jobs
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        // Status filter
        if (statusFilter === 'active' && !job.is_active) return false;
        if (statusFilter === 'inactive' && job.is_active) return false;

        // Opportunity type filter
        if (oppTypeFilter !== 'all' && job.opportunity_type !== oppTypeFilter) return false;

        // Employment type filter
        if (empTypeFilter !== 'all' && job.employment_type !== empTypeFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = job.title.toLowerCase().includes(q);
          const matchCompany = job.company_name.toLowerCase().includes(q);
          const matchLocation = job.location ? job.location.toLowerCase().includes(q) : false;
          const matchSkills = job.skills ? job.skills.toLowerCase().includes(q) : false;
          const matchDesc = job.description ? job.description.toLowerCase().includes(q) : false;
          if (!matchTitle && !matchCompany && !matchLocation && !matchSkills && !matchDesc) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'deadline') {
          if (!a.application_deadline) return 1;
          if (!b.application_deadline) return -1;
          return new Date(a.application_deadline).getTime() - new Date(b.application_deadline).getTime();
        }
        if (sortBy === 'salary_high') {
          const salA = a.salary_max ?? a.salary_min ?? 0;
          const salB = b.salary_max ?? b.salary_min ?? 0;
          return salB - salA;
        }
        if (sortBy === 'salary_low') {
          const salA = a.salary_min ?? a.salary_max ?? 0;
          const salB = b.salary_min ?? b.salary_max ?? 0;
          return salA - salB;
        }
        return 0;
      });
  }, [jobs, statusFilter, oppTypeFilter, empTypeFilter, searchQuery, sortBy]);

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
  const totalAppsCount = applications.length;

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
          <h1 className="cb-page-title">Job Postings & Listings</h1>
          <p className="cb-page-subtitle">
            Create, publish, edit, and track candidate pipelines across your organization&apos;s listings.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={handleExportCsv}
            disabled={isExporting || applications.length === 0}
            data-testid="export-applications-btn"
            title="Download candidate submissions as CSV"
          >
            {isExporting ? 'Exporting CSV...' : '📥 Export Applications CSV'}
          </button>
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

      {/* Quick Analytics Summary Strip */}
      {!isLoading && !errorMessage && jobs.length > 0 && (
        <section
          className="cb-jobs-analytics-strip"
          aria-label="Job Postings Overview"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
          data-testid="recruiter-jobs-stats-strip"
        >
          <div className="cb-stat-card" style={{ padding: '0.85rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
              Total Listings
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }} data-testid="stat-total-jobs">
              {jobs.length}
            </span>
          </div>

          <div className="cb-stat-card" style={{ padding: '0.85rem 1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
              Active (Published)
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }} data-testid="stat-active-jobs">
              {activeCount}
            </span>
          </div>

          <div className="cb-stat-card" style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
              Inactive / Closed
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#64748b' }} data-testid="stat-inactive-jobs">
              {inactiveCount}
            </span>
          </div>

          <div className="cb-stat-card" style={{ padding: '0.85rem 1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
              Total Applicants
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }} data-testid="stat-total-apps">
              {totalAppsCount}
            </span>
          </div>
        </section>
      )}

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

      {/* Search & Filter Toolbar */}
      {!isLoading && !errorMessage && jobs.length > 0 && (
        <div
          className="cb-recruiter-jobs-toolbar"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
          data-testid="recruiter-jobs-toolbar"
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search postings by title, skills, location..."
                className="cb-input"
                data-testid="recruiter-jobs-search"
                style={{ width: '100%' }}
              />
            </div>

            {/* Opportunity Type Select */}
            <div style={{ flex: '0 1 150px' }}>
              <select
                value={oppTypeFilter}
                onChange={(e) => setOppTypeFilter(e.target.value as OpportunityFilter)}
                className="cb-select"
                data-testid="filter-opp-type"
                aria-label="Filter by opportunity type"
              >
                <option value="all">All Types</option>
                <option value="internship">Internship</option>
                <option value="job">Full Job</option>
              </select>
            </div>

            {/* Employment Type Select */}
            <div style={{ flex: '0 1 150px' }}>
              <select
                value={empTypeFilter}
                onChange={(e) => setEmpTypeFilter(e.target.value as EmploymentFilter)}
                className="cb-select"
                data-testid="filter-emp-type"
                aria-label="Filter by employment type"
              >
                <option value="all">All Employments</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </div>

            {/* Sort Select */}
            <div style={{ flex: '0 1 160px' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="cb-select"
                data-testid="recruiter-jobs-sort"
                aria-label="Sort job postings"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="deadline">Upcoming Deadline</option>
                <option value="salary_high">Salary (High to Low)</option>
                <option value="salary_low">Salary (Low to High)</option>
              </select>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div
            className="cb-filter-tabs"
            role="tablist"
            aria-label="Filter job postings by status"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginRight: '0.25rem' }}>
              Status:
            </span>
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

            {/* Results count indicator */}
            <span
              className="cb-count-badge"
              data-testid="recruiter-jobs-count"
              style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
            >
              Showing {filteredJobs.length} of {jobs.length} total {jobs.length === 1 ? 'posting' : 'postings'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" data-testid="recruiter-jobs-error">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm"
            onClick={fetchJobsAndApplications}
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
          <p>Loading your job postings and applicant metrics...</p>
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
          <h2>No Matching Postings Found</h2>
          <p className="cb-empty-desc">
            There are currently no job postings matching your filter criteria.
          </p>
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={() => {
              setStatusFilter('all');
              setOppTypeFilter('all');
              setEmpTypeFilter('all');
              setSearchQuery('');
            }}
            style={{ marginTop: '1rem' }}
          >
            Reset Filters
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
            const stats = jobStatsMap[job.id] || { total: 0, awaiting: 0, shortlisted: 0, accepted: 0 };

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

                  <div className="cb-job-badges" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      className={`cb-badge ${job.is_active ? 'cb-badge-active' : 'cb-badge-inactive'}`}
                      style={{
                        backgroundColor: job.is_active ? 'var(--cb-success-bg, #ecfdf5)' : '#f1f5f9',
                        color: job.is_active ? 'var(--cb-success, #059669)' : 'var(--cb-text-muted, #64748b)',
                        fontWeight: 600,
                        border: `1px solid ${job.is_active ? 'var(--cb-success, #059669)' : '#cbd5e1'}`,
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

                {/* Candidate Pipeline Mini Bar */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.6rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    fontSize: '0.85rem',
                    marginTop: '0.75rem',
                  }}
                  data-testid={`pipeline-summary-${job.id}`}
                >
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>
                      👥 <strong>{stats.total}</strong> {stats.total === 1 ? 'applicant' : 'applicants'}
                    </span>
                    {stats.awaiting > 0 && (
                      <span style={{ color: '#ca8a04', fontWeight: 600 }}>
                        ⏳ {stats.awaiting} awaiting review
                      </span>
                    )}
                    {stats.shortlisted > 0 && (
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>
                        ★ {stats.shortlisted} shortlisted
                      </span>
                    )}
                    {stats.accepted > 0 && (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        ✓ {stats.accepted} accepted
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cb-btn cb-btn-secondary cb-btn-sm"
                    onClick={() => handleOpenAnalyticsModal(job)}
                    data-testid={`analytics-job-btn-${job.id}`}
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                  >
                    📊 Funnel & Analytics
                  </button>
                </div>

                <div className="cb-job-meta" style={{ marginTop: '0.75rem' }}>
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

                <div
                  className="cb-job-card-actions"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginTop: '1rem',
                  }}
                >
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
                      View Applications {stats.total > 0 ? `(${stats.total})` : ''}
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
                      className="cb-btn cb-btn-secondary cb-btn-sm"
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

      {/* Job Analytics & Funnel Modal */}
      {analyticsJob && (
        <JobAnalyticsModal
          isOpen={Boolean(analyticsJob)}
          job={analyticsJob}
          applications={applications}
          onClose={() => setAnalyticsJob(null)}
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
              <p style={{ color: 'var(--cb-danger, #dc2626)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
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
