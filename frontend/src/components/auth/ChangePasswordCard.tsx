import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { changePasswordApi } from '@/api/auth';
import { useAuth } from '@/auth/useAuth';
import { ApiErrorResponse } from '@/types/api';

export interface ChangePasswordCardProps {
  className?: string;
}

export const ChangePasswordCard: React.FC<ChangePasswordCardProps> = ({ className = '' }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please enter and confirm your new password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await changePasswordApi({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Clear password fields immediately
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setSuccessMessage(
        response.message ||
          'Password changed successfully. Your session has been refreshed. Please sign in with your new password.'
      );

      // Invalidate current frontend session since backend revoked previous JWTs
      logout();

      // Navigate to login after brief moment or allow user to click
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      setErrorMessage(
        apiError.message || 'Failed to change password. Please check your current password and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`cb-glass-card ${className}`} data-testid="change-password-card">
      <div className="cb-card-header" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--cb-text)' }}>
          Change Password
        </h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--cb-text-muted)' }}>
          Update your account password. For security, changing your password will end all active sessions.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="cb-glass-alert cb-glass-alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          <svg
            className="cb-alert-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="cb-glass-alert cb-glass-alert-success" role="alert" style={{ marginBottom: '1rem' }}>
          <svg
            className="cb-alert-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="cb-glass-form">
        <div className="cb-glass-field" style={{ marginBottom: '1rem' }}>
          <div className="cb-glass-label-row">
            <label htmlFor="current_password" className="cb-glass-label">
              Current Password
            </label>
          </div>
          <PasswordInput
            id="current_password"
            name="current_password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            disabled={isLoading}
            autoComplete="current-password"
            required
            data-testid="current-password-input"
          />
        </div>

        <div className="cb-glass-field" style={{ marginBottom: '1rem' }}>
          <div className="cb-glass-label-row">
            <label htmlFor="change_new_password" className="cb-glass-label">
              New Password
            </label>
          </div>
          <PasswordInput
            id="change_new_password"
            name="new_password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={isLoading}
            autoComplete="new-password"
            required
            data-testid="change-new-password-input"
          />
        </div>

        <div className="cb-glass-field" style={{ marginBottom: '1.25rem' }}>
          <div className="cb-glass-label-row">
            <label htmlFor="change_confirm_password" className="cb-glass-label">
              Confirm New Password
            </label>
          </div>
          <PasswordInput
            id="change_confirm_password"
            name="confirm_password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            disabled={isLoading}
            autoComplete="new-password"
            required
            data-testid="change-confirm-password-input"
          />
        </div>

        <button
          type="submit"
          className="cb-btn cb-btn-primary"
          disabled={isLoading}
          style={{ width: '100%' }}
        >
          {isLoading ? (
            <span className="cb-btn-spinner-wrap">
              <span className="cb-btn-spinner" aria-hidden="true" />
              Updating Password...
            </span>
          ) : (
            'Update Password'
          )}
        </button>
      </form>
    </div>
  );
};
