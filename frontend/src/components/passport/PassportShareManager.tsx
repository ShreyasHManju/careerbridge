import React, { useState, useEffect, useCallback } from 'react';
import {
  PassportShareSummaryResponse,
  PassportShareUpdateRequest,
} from '@/types/passport';
import {
  listPassportShares,
  updatePassportShare,
  revokePassportShare,
} from '@/api/passport';
import { SharePassportModal } from './SharePassportModal';
import { ApiErrorResponse } from '@/types/api';

export interface PassportShareManagerProps {
  onShareCreated?: () => void;
}

export const PassportShareManager: React.FC<PassportShareManagerProps> = ({
  onShareCreated,
}) => {
  const [shares, setShares] = useState<PassportShareSummaryResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Creation Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Edit Share state
  const [editingShare, setEditingShare] = useState<PassportShareSummaryResponse | null>(null);
  const [editLabel, setEditLabel] = useState<string>('');
  const [editContactInfo, setEditContactInfo] = useState<boolean>(false);
  const [editUnverifiedProjects, setEditUnverifiedProjects] = useState<boolean>(false);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editExpiryOption, setEditExpiryOption] = useState<string>('keep');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Revocation confirmation state
  const [revokingShareId, setRevokingShareId] = useState<number | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPassportShares();
      setShares(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      setError(
        apiError?.message ||
          (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
          'Failed to load passport share links.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  // Open Edit Modal
  const handleOpenEdit = (share: PassportShareSummaryResponse) => {
    setEditingShare(share);
    setEditLabel(share.label || '');
    setEditContactInfo(share.allow_contact_info);
    setEditUnverifiedProjects(share.allow_unverified_projects);
    setEditIsActive(share.is_active);
    setEditExpiryOption('keep');
    setUpdateError(null);
  };

  const handleCloseEdit = () => {
    setEditingShare(null);
    setUpdateError(null);
  };

  // Submit Update
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShare) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const payload: PassportShareUpdateRequest = {
        label: editLabel.trim() || null,
        allow_contact_info: editContactInfo,
        allow_unverified_projects: editUnverifiedProjects,
        is_active: editIsActive,
      };

      if (editExpiryOption === 'clear') {
        payload.clear_expiration = true;
      } else if (editExpiryOption !== 'keep') {
        payload.expires_in_days = parseInt(editExpiryOption, 10);
      }

      await updatePassportShare(editingShare.id, payload);
      await fetchShares();
      handleCloseEdit();
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      setUpdateError(
        apiError?.message ||
          (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
          'Failed to update share link settings.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Revoke Action
  const handleConfirmRevoke = async () => {
    if (!revokingShareId) return;

    setIsRevoking(true);
    setRevokeError(null);

    try {
      await revokePassportShare(revokingShareId);
      setRevokingShareId(null);
      await fetchShares();
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      setRevokeError(
        apiError?.message ||
          (typeof apiError?.detail === 'string' ? apiError.detail : null) ||
          'Failed to revoke share link.'
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const isShareExpired = (share: PassportShareSummaryResponse): boolean => {
    if (!share.expires_at) return false;
    return new Date(share.expires_at).getTime() <= Date.now();
  };

  const getStatusBadge = (share: PassportShareSummaryResponse) => {
    if (!share.is_active || share.revoked_at) {
      return (
        <span
          className="cb-badge cb-badge-danger"
          data-testid={`share-status-revoked-${share.id}`}
        >
          Revoked
        </span>
      );
    }
    if (isShareExpired(share)) {
      return (
        <span
          className="cb-badge cb-badge-warning"
          data-testid={`share-status-expired-${share.id}`}
        >
          Expired
        </span>
      );
    }
    return (
      <span
        className="cb-badge cb-badge-success"
        data-testid={`share-status-active-${share.id}`}
      >
        Active
      </span>
    );
  };

  return (
    <section
      className="cb-card cb-passport-share-manager"
      aria-labelledby="passport-share-manager-title"
      data-testid="passport-share-manager"
      style={{ marginTop: '1.5rem' }}
    >
      <div
        className="cb-card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.1))',
        }}
      >
        <div>
          <h2
            id="passport-share-manager-title"
            className="cb-card-title"
            style={{ margin: 0, fontSize: '1.25rem' }}
          >
            🔗 Career Passport Sharing Links
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
            Create and manage secure, granular public links for recruiters, portfolio sharing, or job applications.
          </p>
        </div>

        <button
          type="button"
          className="cb-btn cb-btn-primary cb-btn-sm"
          onClick={() => setIsCreateModalOpen(true)}
          data-testid="open-create-share-btn"
        >
          + Create Share Link
        </button>
      </div>

      <div className="cb-card-body" style={{ paddingTop: '1rem' }}>
        {/* Loading */}
        {loading && (
          <div
            className="cb-loading-container"
            style={{ padding: '2rem 0' }}
            data-testid="shares-loading"
          >
            <div className="cb-spinner" />
            <p className="cb-loading-text">Loading your passport sharing links...</p>
          </div>
        )}

        {/* Fetch Error */}
        {!loading && error && (
          <div className="cb-alert cb-alert-danger" role="alert" data-testid="shares-error">
            <span>{error}</span>
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={fetchShares}
              style={{ marginLeft: '1rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Global Revoke Error Alert */}
        {revokeError && (
          <div
            className="cb-alert cb-alert-danger"
            role="alert"
            style={{ marginBottom: '1rem' }}
            data-testid="shares-revoke-error"
          >
            {revokeError}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && shares.length === 0 && (
          <div
            className="cb-empty-state"
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
            }}
            data-testid="shares-empty"
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌐</div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>
              No Active Sharing Links Yet
            </h3>
            <p style={{ margin: '0 auto 1.25rem auto', maxWidth: '440px', fontSize: '0.875rem', opacity: 0.75 }}>
              Generate a share link to showcase your verified skills, projects, and experiences to employers.
            </p>
            <button
              type="button"
              className="cb-btn cb-btn-primary cb-btn-sm"
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="empty-create-share-btn"
            >
              Create Your First Link
            </button>
          </div>
        )}

        {/* Populated Shares List */}
        {!loading && !error && shares.length > 0 && (
          <div className="cb-shares-list" data-testid="shares-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {shares.map((share) => (
              <div
                key={share.id}
                className="cb-share-item-card"
                data-testid={`share-item-${share.id}`}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--cb-radius-md, 8px)',
                  background: 'var(--cb-surface-card-subtle, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--cb-border-subtle, rgba(255, 255, 255, 0.08))',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3
                        style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
                        data-testid={`share-label-${share.id}`}
                      >
                        {share.label || 'Default Share Link'}
                      </h3>
                      {getStatusBadge(share)}
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        opacity: 0.65,
                      }}
                      data-testid={`share-preview-${share.id}`}
                    >
                      Token Preview: {share.token_preview}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary cb-btn-sm"
                      onClick={() => handleOpenEdit(share)}
                      data-testid={`edit-share-btn-${share.id}`}
                    >
                      ⚙️ Edit Settings
                    </button>

                    {share.is_active && !share.revoked_at && (
                      <button
                        type="button"
                        className="cb-btn cb-btn-outline-danger cb-btn-sm"
                        onClick={() => setRevokingShareId(share.id)}
                        data-testid={`revoke-share-trigger-${share.id}`}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata & Permissions Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.75rem',
                    fontSize: '0.8125rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed var(--cb-border-subtle, rgba(255, 255, 255, 0.06))',
                  }}
                >
                  <div>
                    <span style={{ display: 'block', opacity: 0.65 }}>Views</span>
                    <strong data-testid={`share-views-${share.id}`}>
                      👁️ {share.view_count}
                    </strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', opacity: 0.65 }}>Expires</span>
                    <strong data-testid={`share-expires-${share.id}`}>
                      {share.expires_at
                        ? new Date(share.expires_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Indefinite (Never)'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', opacity: 0.65 }}>Contact Info</span>
                    <strong data-testid={`share-contact-visibility-${share.id}`}>
                      {share.allow_contact_info ? '✓ Visible' : '✗ Hidden'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', opacity: 0.65 }}>Unverified Projects</span>
                    <strong data-testid={`share-unverified-visibility-${share.id}`}>
                      {share.allow_unverified_projects ? '✓ Included' : '✗ Verified Only'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', opacity: 0.65 }}>Created</span>
                    <span style={{ opacity: 0.9 }}>
                      {new Date(share.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      <SharePassportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchShares();
          if (onShareCreated) onShareCreated();
        }}
      />

      {/* Edit Share Modal */}
      {editingShare && (
        <div
          className="cb-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-share-modal-title"
          data-testid="edit-share-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUpdating) {
              handleCloseEdit();
            }
          }}
        >
          <div className="cb-modal-dialog" style={{ maxWidth: '500px' }}>
            <div className="cb-modal-header">
              <div>
                <h2 id="edit-share-modal-title" className="cb-modal-title">
                  Update Share Settings
                </h2>
                <p className="cb-modal-subtitle">
                  Modify label, privacy settings, or lifecycle state for this link.
                </p>
              </div>
              <button
                type="button"
                className="cb-modal-close-btn"
                onClick={handleCloseEdit}
                aria-label="Close edit dialog"
                disabled={isUpdating}
                data-testid="edit-share-close-btn"
              >
                ✕
              </button>
            </div>

            <div className="cb-modal-body">
              {updateError && (
                <div className="cb-alert cb-alert-danger" role="alert" data-testid="edit-share-error">
                  {updateError}
                </div>
              )}

              <form id="edit-share-form" onSubmit={handleUpdateSubmit} data-testid="edit-share-form">
                <div className="cb-form-group">
                  <label className="cb-form-label" htmlFor="edit-share-label">
                    Link Label
                  </label>
                  <input
                    id="edit-share-label"
                    type="text"
                    className="cb-input"
                    maxLength={128}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    disabled={isUpdating}
                    data-testid="edit-share-label-input"
                  />
                </div>

                <div className="cb-form-group">
                  <label className="cb-form-label" htmlFor="edit-share-expiry">
                    Update Expiration
                  </label>
                  <select
                    id="edit-share-expiry"
                    className="cb-input"
                    value={editExpiryOption}
                    onChange={(e) => setEditExpiryOption(e.target.value)}
                    disabled={isUpdating}
                    data-testid="edit-share-expiry-select"
                  >
                    <option value="keep">Keep Current Expiration</option>
                    <option value="clear">Clear Expiration (Indefinite)</option>
                    <option value="1">Set to 1 Day from now</option>
                    <option value="7">Set to 7 Days from now</option>
                    <option value="30">Set to 30 Days from now</option>
                    <option value="90">Set to 90 Days from now</option>
                    <option value="180">Set to 180 Days from now</option>
                    <option value="365">Set to 365 Days from now</option>
                  </select>
                </div>

                <div className="cb-form-group" style={{ marginTop: '1rem' }}>
                  <span className="cb-form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                    Visibility & Active State
                  </span>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editContactInfo}
                      onChange={(e) => setEditContactInfo(e.target.checked)}
                      disabled={isUpdating}
                      data-testid="edit-contact-checkbox"
                    />
                    <span>Allow Direct Contact Info (email, phone, links)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editUnverifiedProjects}
                      onChange={(e) => setEditUnverifiedProjects(e.target.checked)}
                      disabled={isUpdating}
                      data-testid="edit-unverified-checkbox"
                    />
                    <span>Include In-Progress & Unverified Projects</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      disabled={isUpdating}
                      data-testid="edit-is-active-checkbox"
                    />
                    <span>Link is Active (Uncheck to deactivate/revoke)</span>
                  </label>
                </div>
              </form>
            </div>

            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={handleCloseEdit}
                disabled={isUpdating}
                data-testid="edit-share-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-share-form"
                className="cb-btn cb-btn-primary"
                disabled={isUpdating}
                data-testid="edit-share-save-btn"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      {revokingShareId && (
        <div
          className="cb-modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="revoke-confirm-title"
          data-testid="revoke-confirm-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isRevoking) {
              setRevokingShareId(null);
            }
          }}
        >
          <div className="cb-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="cb-modal-header">
              <h2 id="revoke-confirm-title" className="cb-modal-title" style={{ color: 'var(--cb-danger, #ef4444)' }}>
                Revoke Share Link?
              </h2>
              <button
                type="button"
                className="cb-modal-close-btn"
                onClick={() => setRevokingShareId(null)}
                aria-label="Cancel revocation"
                disabled={isRevoking}
              >
                ✕
              </button>
            </div>
            <div className="cb-modal-body">
              <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5 }}>
                Are you sure you want to deactivate and revoke this share link?
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', opacity: 0.75 }}>
                Anyone visiting this URL in the future will receive an <strong>HTTP 410 Expired/Revoked</strong> response.
              </p>
            </div>
            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={() => setRevokingShareId(null)}
                disabled={isRevoking}
                data-testid="cancel-revoke-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-danger"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                data-testid="confirm-revoke-btn"
              >
                {isRevoking ? 'Revoking...' : 'Yes, Revoke Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
