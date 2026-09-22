import React, { useEffect, useState } from 'react';
import { AdminUser } from '@/types/admin';
import * as adminApi from '@/api/admin';
import { ApiErrorResponse } from '@/types/api';

interface UserStatusModalProps {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: (updatedUser: AdminUser) => void;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !user) return null;

  const willActivate = !user.is_active;

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await adminApi.updateAdminUserStatus(user.id, {
        is_active: willActivate,
      });
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const msg =
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        `Failed to ${willActivate ? 'activate' : 'deactivate'} user account.`;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-status-modal-title"
      data-testid="user-status-modal"
    >
      <div className="cb-modal-container cb-modal-sm">
        <div className="cb-modal-header">
          <h3 id="user-status-modal-title" className="cb-modal-title">
            {willActivate ? 'Activate User Account' : 'Deactivate User Account'}
          </h3>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="cb-modal-body">
          {error && (
            <div className="cb-alert cb-alert-danger" role="alert" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <p style={{ marginBottom: '1rem', color: 'var(--cb-text)' }}>
            Are you sure you want to {willActivate ? 'activate' : 'deactivate'} the account for{' '}
            <strong>{user.email}</strong> (Role: <span className="cb-role-tag">{user.role}</span>)?
          </p>

          {!willActivate && (
            <div className="cb-alert cb-alert-warning" role="note">
              ⚠️ Deactivating this user will revoke their authentication access immediately.
            </div>
          )}
        </div>

        <div className="cb-modal-footer">
          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-status-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className={`cb-btn ${willActivate ? 'cb-btn-success' : 'cb-btn-danger'}`}
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="confirm-status-btn"
          >
            {isSubmitting
              ? willActivate
                ? 'Activating...'
                : 'Deactivating...'
              : willActivate
              ? 'Activate User'
              : 'Deactivate User'}
          </button>
        </div>
      </div>
    </div>
  );
};
