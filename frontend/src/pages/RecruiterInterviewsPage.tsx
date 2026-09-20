import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getRecruiterInterviews,
  updateInterview,
  cancelInterview,
} from '@/api/interviews';
import { Interview, InterviewFilterStatus } from '@/types/interview';
import { InterviewCard } from '@/components/interviews/InterviewCard';
import { RescheduleInterviewModal } from '@/components/interviews/RescheduleInterviewModal';
import { ApiErrorResponse } from '@/types/api';

type InterviewTab = 'upcoming' | 'past' | 'all';

export const RecruiterInterviewsPage: React.FC = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [mutatingInterviewId, setMutatingInterviewId] = useState<number | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<InterviewTab>('upcoming');
  const [statusFilter, setStatusFilter] = useState<InterviewFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);

  const fetchInterviews = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getRecruiterInterviews();
      setInterviews(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
          apiError?.message ||
          'Failed to load recruiter interviews. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  // Handle Mark Completed
  const handleMarkComplete = async (interview: Interview) => {
    setMutatingInterviewId(interview.id);
    setActionSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updated = await updateInterview(interview.id, { status: 'completed' });
      setInterviews((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setActionSuccessMessage(
        `Interview for ${interview.candidate_email || 'candidate'} marked as completed.`
      );
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
          apiError?.message ||
          'Failed to mark interview as completed. Please try again.'
      );
    } finally {
      setMutatingInterviewId(null);
    }
  };

  // Handle Cancel Interview
  const handleCancelInterview = async (interview: Interview) => {
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel the interview scheduled with ${
        interview.candidate_email || 'the candidate'
      }?`
    );
    if (!confirmCancel) return;

    setMutatingInterviewId(interview.id);
    setActionSuccessMessage(null);
    setErrorMessage(null);

    try {
      const cancelled = await cancelInterview(interview.id);
      setInterviews((prev) =>
        prev.map((item) => (item.id === cancelled.id ? cancelled : item))
      );
      setActionSuccessMessage(
        `Interview for ${interview.candidate_email || 'candidate'} cancelled successfully.`
      );
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const detailStr = typeof apiError?.detail === 'string' ? apiError.detail : null;
      setErrorMessage(
        detailStr ||
          apiError?.message ||
          'Failed to cancel interview. Please try again.'
      );
    } finally {
      setMutatingInterviewId(null);
    }
  };

  // Handle Reschedule Success
  const handleRescheduleSuccess = (updated: Interview) => {
    setInterviews((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setActionSuccessMessage(
      `Interview for ${updated.candidate_email || 'candidate'} updated successfully.`
    );
  };

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
        const candidateMatch = (interview.candidate_email || '').toLowerCase().includes(q);
        const notesMatch = (interview.notes || '').toLowerCase().includes(q);
        const locationMatch = (interview.location_or_link || '').toLowerCase().includes(q);
        if (!titleMatch && !candidateMatch && !notesMatch && !locationMatch) {
          return false;
        }
      }

      return true;
    });
  }, [interviews, activeTab, statusFilter, searchQuery]);

  return (
    <div className="cb-page-container" data-testid="recruiter-interviews-page">
      {/* Page Header */}
      <header className="cb-page-header">
        <div>
          <h1 className="cb-page-title">Candidate Interviews</h1>
          <p className="cb-page-subtitle">
            Manage your candidate interview pipeline, reschedule sessions, and track meeting statuses.
          </p>
        </div>
      </header>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div
          className="cb-alert cb-alert-success cb-alert-dismissible"
          role="status"
          data-testid="interview-action-success-alert"
        >
          <span>{actionSuccessMessage}</span>
          <button
            type="button"
            className="cb-alert-close"
            onClick={() => setActionSuccessMessage(null)}
            aria-label="Dismiss message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Tabs and Filters */}
      <div className="cb-interviews-controls-bar">
        <div className="cb-tab-group" role="tablist" aria-label="Recruiter interview tabs">
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
            <label htmlFor="recruiter-interview-status-filter" className="sr-only">
              Filter by Status
            </label>
            <select
              id="recruiter-interview-status-filter"
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
            <label htmlFor="recruiter-interview-search" className="sr-only">
              Search Candidate Interviews
            </label>
            <input
              id="recruiter-interview-search"
              type="search"
              className="cb-input cb-input-sm"
              placeholder="Search candidate, job, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search candidate interviews"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="cb-interviews-main-content">
        {isLoading && (
          <div className="cb-loading-container" role="status" aria-label="Loading candidate interviews">
            <div className="cb-spinner" aria-hidden="true" />
            <p>Loading candidate interviews...</p>
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
              <div className="cb-empty-state" data-testid="recruiter-interviews-empty-state">
                <div className="cb-empty-icon" aria-hidden="true">
                  👥
                </div>
                <h2 className="cb-empty-title">No Interviews Scheduled</h2>
                <p className="cb-empty-description">
                  {searchQuery || statusFilter !== 'all' || activeTab !== 'upcoming'
                    ? 'No candidate interviews match your filter criteria.'
                    : 'You have not scheduled any candidate interviews yet. You can schedule an interview directly from candidate application cards.'}
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
              <div className="cb-interviews-list" data-testid="recruiter-interviews-list">
                {filteredInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    role="recruiter"
                    onReschedule={(target) => setEditingInterview(target)}
                    onMarkComplete={handleMarkComplete}
                    onCancel={handleCancelInterview}
                    isMutating={mutatingInterviewId === interview.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Reschedule / Edit Modal */}
      {editingInterview && (
        <RescheduleInterviewModal
          isOpen={Boolean(editingInterview)}
          interview={editingInterview}
          onClose={() => setEditingInterview(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </div>
  );
};
