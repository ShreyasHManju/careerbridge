import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyInterviews } from '@/api/interviews';
import { Interview, InterviewFilterStatus } from '@/types/interview';
import { InterviewCard } from '@/components/interviews/InterviewCard';
import { ApiErrorResponse } from '@/types/api';

type InterviewTab = 'upcoming' | 'past' | 'all';

export const StudentInterviewsPage: React.FC = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<InterviewTab>('upcoming');
  const [statusFilter, setStatusFilter] = useState<InterviewFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchInterviews = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getMyInterviews();
      setInterviews(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
          apiError?.message ||
          'Failed to load your interviews. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const filteredInterviews = useMemo(() => {
    const now = new Date();

    return interviews.filter((interview) => {
      // 1. Tab Filter
      if (activeTab === 'upcoming') {
        const interviewDate = new Date(interview.scheduled_at);
        const isPastOrConcluded =
          interviewDate < now ||
          interview.status === 'completed' ||
          interview.status === 'cancelled';
        if (isPastOrConcluded) return false;
      } else if (activeTab === 'past') {
        const interviewDate = new Date(interview.scheduled_at);
        const isPastOrConcluded =
          interviewDate < now ||
          interview.status === 'completed' ||
          interview.status === 'cancelled';
        if (!isPastOrConcluded) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && interview.status !== statusFilter) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (interview.job_title || '').toLowerCase().includes(q);
        const companyMatch = (interview.company_name || '').toLowerCase().includes(q);
        const notesMatch = (interview.notes || '').toLowerCase().includes(q);
        const locationMatch = (interview.location_or_link || '').toLowerCase().includes(q);
        if (!titleMatch && !companyMatch && !notesMatch && !locationMatch) {
          return false;
        }
      }

      return true;
    });
  }, [interviews, activeTab, statusFilter, searchQuery]);

  return (
    <div className="cb-page-container" data-testid="student-interviews-page">
      {/* Page Header */}
      <header className="cb-page-header">
        <div>
          <h1 className="cb-page-title">My Interviews</h1>
          <p className="cb-page-subtitle">
            Manage your upcoming and past interview schedules with hiring companies.
          </p>
        </div>
      </header>

      {/* Tabs and Filters */}
      <div className="cb-interviews-controls-bar">
        <div className="cb-tab-group" role="tablist" aria-label="Interview timing tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upcoming'}
            className={`cb-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'past'}
            className={`cb-tab-btn ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past & Completed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`cb-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({interviews.length})
          </button>
        </div>

        <div className="cb-interviews-filters-group">
          {/* Status Filter */}
          <div className="cb-filter-item">
            <label htmlFor="student-interview-status-filter" className="sr-only">
              Filter by Status
            </label>
            <select
              id="student-interview-status-filter"
              className="cb-select cb-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InterviewFilterStatus)}
              aria-label="Filter by interview status"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="cb-filter-item">
            <label htmlFor="student-interview-search" className="sr-only">
              Search Interviews
            </label>
            <input
              id="student-interview-search"
              type="search"
              className="cb-input cb-input-sm"
              placeholder="Search by job, company, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search interviews"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="cb-interviews-main-content">
        {isLoading && (
          <div className="cb-loading-container" role="status" aria-label="Loading interviews">
            <div className="cb-spinner" aria-hidden="true" />
            <p>Loading your interviews...</p>
          </div>
        )}

        {errorMessage && (
          <div className="cb-alert cb-alert-danger" role="alert">
            <p>{errorMessage}</p>
            <button
              type="button"
              className="cb-btn cb-btn-outline-danger cb-btn-sm"
              onClick={fetchInterviews}
              style={{ marginTop: '0.75rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            {filteredInterviews.length === 0 ? (
              <div className="cb-empty-state" data-testid="student-interviews-empty-state">
                <div className="cb-empty-icon" aria-hidden="true">
                  📅
                </div>
                <h2 className="cb-empty-title">No Interviews Found</h2>
                <p className="cb-empty-description">
                  {searchQuery || statusFilter !== 'all' || activeTab !== 'upcoming'
                    ? 'No interviews match your selected filter criteria. Try adjusting your filters.'
                    : 'You do not have any interviews scheduled yet. Once a recruiter invites you to an interview, it will appear here.'}
                </p>
                {(searchQuery || statusFilter !== 'all' || activeTab !== 'upcoming') && (
                  <button
                    type="button"
                    className="cb-btn cb-btn-secondary cb-btn-sm"
                    onClick={() => {
                      setActiveTab('upcoming');
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="cb-interviews-list" data-testid="student-interviews-list">
                {filteredInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    role="student"
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
