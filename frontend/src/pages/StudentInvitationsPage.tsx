import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStudentInvitations, respondToJobInvitation } from '@/api/invitations';
import { JobInvitation, InvitationStatus } from '@/types/invitation';
import { ApiErrorResponse } from '@/types/api';

export const StudentInvitationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<JobInvitation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | InvitationStatus>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getStudentInvitations();
      setInvitations(data || []);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        'Failed to load your job invitations. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleRespond = async (invitationId: number, status: 'accepted' | 'declined') => {
    setRespondingId(invitationId);
    setToastMessage(null);
    try {
      const updated = await respondToJobInvitation(invitationId, { status });
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationId ? updated : inv))
      );
      setToastMessage({
        type: 'success',
        text: status === 'accepted'
          ? 'Invitation accepted! You can now proceed to submit your application.'
          : 'Invitation declined.',
      });
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setToastMessage({
        type: 'error',
        text:
          (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
          apiErr?.message ||
          'Failed to respond to invitation. Please try again.',
      });
    } finally {
      setRespondingId(null);
    }
  };

  const filteredInvitations = invitations.filter((inv) => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  });

  const pendingCount = invitations.filter((inv) => inv.status === 'pending').length;

  return (
    <div className="cb-page-container cb-student-invitations-page" data-testid="student-invitations-page">
      {/* Header */}
      <header className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Job Invitations</h1>
          <p className="cb-page-subtitle">
            Proactive invitations from recruiters who discovered your verified skills, projects, and Experience Passport credentials.
          </p>
        </div>
      </header>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`cb-alert cb-alert-${toastMessage.type === 'success' ? 'success' : 'danger'}`}
          role="status"
          data-testid="invitation-toast-alert"
        >
          {toastMessage.text}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="cb-invitations-tabs" role="tablist" aria-label="Filter invitations by status">
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'all'}
          className={`cb-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
          data-testid="filter-tab-all"
        >
          All ({invitations.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'pending'}
          className={`cb-tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
          data-testid="filter-tab-pending"
        >
          Pending {pendingCount > 0 && <span className="cb-tab-badge">{pendingCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'accepted'}
          className={`cb-tab-btn ${statusFilter === 'accepted' ? 'active' : ''}`}
          onClick={() => setStatusFilter('accepted')}
          data-testid="filter-tab-accepted"
        >
          Accepted
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'declined'}
          className={`cb-tab-btn ${statusFilter === 'declined' ? 'active' : ''}`}
          onClick={() => setStatusFilter('declined')}
          data-testid="filter-tab-declined"
        >
          Declined
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" data-testid="invitations-error-alert">
          <p>{errorMessage}</p>
          <button type="button" className="cb-btn cb-btn-secondary cb-btn-sm" onClick={fetchInvitations}>
            Try Again
          </button>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="cb-loading-container" role="status" aria-label="Loading invitations">
          <div className="cb-spinner" />
          <p className="cb-loading-text">Loading your invitations...</p>
        </div>
      ) : filteredInvitations.length === 0 ? (
        <div className="cb-empty-state cb-card" data-testid="invitations-empty-state">
          <div className="cb-empty-state-icon">📩</div>
          <h2 className="cb-empty-state-title">No Invitations Found</h2>
          <p className="cb-empty-state-text">
            {statusFilter === 'all'
              ? 'You have not received any recruiter invitations yet. Keep verifying your experience claims and publishing projects to boost your discoverability!'
              : `You have no ${statusFilter} invitations.`}
          </p>
          <Link to="/app/jobs" className="cb-btn cb-btn-primary cb-btn-sm">
            Explore Job Postings
          </Link>
        </div>
      ) : (
        <div className="cb-invitations-list" role="feed" aria-label="Job invitations list" data-testid="invitations-list">
          {filteredInvitations.map((invitation) => {
            const job = invitation.job_posting;
            const company = job?.company_name || invitation.recruiter?.company_name || 'Hiring Team';
            const jobTitle = job?.title || `Opportunity #${invitation.job_id}`;
            const dateStr = new Date(invitation.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <article
                key={invitation.id}
                className={`cb-card cb-invitation-card cb-invitation-${invitation.status}`}
                data-testid={`invitation-card-${invitation.id}`}
              >
                <div className="cb-invitation-card-header">
                  <div className="cb-invitation-company-badge">🏢</div>
                  <div className="cb-invitation-title-group">
                    <div className="cb-invitation-top-row">
                      <h3 className="cb-invitation-job-title">{jobTitle}</h3>
                      <span
                        className={`cb-tag cb-tag-status cb-tag-${invitation.status}`}
                        data-testid={`invitation-status-${invitation.id}`}
                      >
                        {invitation.status === 'pending'
                          ? '⏳ Pending Review'
                          : invitation.status === 'accepted'
                          ? '✓ Accepted'
                          : '✕ Declined'}
                      </span>
                    </div>
                    <p className="cb-invitation-company-line">
                      <strong>{company}</strong>
                      {job?.location && ` • 📍 ${job.location}`}
                      {job?.is_remote && ' • 🌐 Remote'}
                      {job?.opportunity_type && ` • 💼 ${job.opportunity_type}`}
                    </p>
                  </div>
                </div>

                {/* Personalized Message from Recruiter */}
                {invitation.message && (
                  <div className="cb-invitation-message-box" data-testid={`invitation-message-${invitation.id}`}>
                    <span className="cb-invitation-message-label">
                      Message from {invitation.recruiter?.full_name || 'Recruiter'}:
                    </span>
                    <p className="cb-invitation-message-text">"{invitation.message}"</p>
                  </div>
                )}

                {/* Metadata and Actions */}
                <div className="cb-invitation-footer">
                  <span className="cb-invitation-date">Received on {dateStr}</span>

                  <div className="cb-invitation-actions">
                    {invitation.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="cb-btn cb-btn-secondary cb-btn-sm"
                          onClick={() => handleRespond(invitation.id, 'declined')}
                          disabled={respondingId === invitation.id}
                          data-testid={`decline-invite-btn-${invitation.id}`}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="cb-btn cb-btn-primary cb-btn-sm"
                          onClick={() => handleRespond(invitation.id, 'accepted')}
                          disabled={respondingId === invitation.id}
                          data-testid={`accept-invite-btn-${invitation.id}`}
                        >
                          {respondingId === invitation.id ? 'Accepting...' : 'Accept Invitation'}
                        </button>
                      </>
                    )}

                    {invitation.status === 'accepted' && (
                      <button
                        type="button"
                        className="cb-btn cb-btn-primary cb-btn-sm"
                        onClick={() => navigate(`/app/jobs?q=${encodeURIComponent(jobTitle)}`)}
                        data-testid={`apply-now-btn-${invitation.id}`}
                      >
                        🚀 Apply for Opportunity
                      </button>
                    )}

                    <Link
                      to={`/app/jobs?q=${encodeURIComponent(jobTitle)}`}
                      className="cb-btn cb-btn-outline cb-btn-sm"
                      data-testid={`view-job-btn-${invitation.id}`}
                    >
                      View Job Details
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
