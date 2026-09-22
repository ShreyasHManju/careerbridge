import React, { useEffect, useState } from 'react';
import { AdminUser } from '@/types/admin';
import * as adminApi from '@/api/admin';
import { ApiErrorResponse } from '@/types/api';

interface UserDetailModalProps {
  isOpen: boolean;
  userId: number | null;
  onClose: () => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  isOpen,
  userId,
  onClose,
}) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true);
      setError(null);
      adminApi
        .getAdminUserDetail(userId)
        .then((data) => setUser(data))
        .catch((err: unknown) => {
          const apiErr = err as ApiErrorResponse;
          setError(
            (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
            apiErr?.message ||
            'Failed to load user details.'
          );
        })
        .finally(() => setIsLoading(false));
    } else {
      setUser(null);
      setError(null);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-modal-title"
      data-testid="user-detail-modal"
    >
      <div className="cb-modal-container cb-modal-md">
        <div className="cb-modal-header">
          <h3 id="user-detail-modal-title" className="cb-modal-title">
            User Account Details
          </h3>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="cb-modal-body">
          {isLoading && (
            <div className="cb-dashboard-loading" role="status">
              <div className="cb-spinner cb-spinner-sm" aria-hidden="true" />
              <p>Loading user details...</p>
            </div>
          )}

          {error && (
            <div className="cb-alert cb-alert-danger" role="alert">
              {error}
            </div>
          )}

          {user && (
            <div className="cb-user-detail-content" data-testid="user-detail-content">
              <div className="cb-detail-row">
                <span className="cb-detail-label">User ID:</span>
                <span className="cb-detail-value">#{user.id}</span>
              </div>
              <div className="cb-detail-row">
                <span className="cb-detail-label">Email:</span>
                <span className="cb-detail-value">{user.email}</span>
              </div>
              <div className="cb-detail-row">
                <span className="cb-detail-label">Role:</span>
                <span className="cb-detail-value">
                  <span className={`cb-role-tag cb-role-${user.role}`}>{user.role}</span>
                </span>
              </div>
              <div className="cb-detail-row">
                <span className="cb-detail-label">Account Status:</span>
                <span className="cb-detail-value">
                  <span className={`cb-badge ${user.is_active ? 'cb-badge-success' : 'cb-badge-danger'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </span>
              </div>
              <div className="cb-detail-row">
                <span className="cb-detail-label">Verification:</span>
                <span className="cb-detail-value">
                  {user.is_verified ? (
                    <span className="cb-verified-badge">✓ Verified</span>
                  ) : (
                    <span className="cb-badge cb-badge-secondary">Unverified</span>
                  )}
                </span>
              </div>
              <div className="cb-detail-row">
                <span className="cb-detail-label">Joined Platform:</span>
                <span className="cb-detail-value">
                  {new Date(user.created_at).toLocaleString()}
                </span>
              </div>
              <div className="cb-detail-row">
                <span className="cb-detail-label">Last Updated:</span>
                <span className="cb-detail-value">
                  {new Date(user.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="cb-modal-footer">
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            data-testid="close-user-detail-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
