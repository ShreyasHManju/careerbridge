import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { confirmPasswordResetApi } from '@/api/auth';
import { ApiErrorResponse } from '@/types/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isTokenMissing = !token.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (isTokenMissing) {
      setLocalError('Invalid or missing password reset token. Please request a new reset link.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setLocalError('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await confirmPasswordResetApi({
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Clear password fields immediately
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage(
        response.message ||
          'Your password has been successfully reset. Please sign in with your new password.'
      );
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      setLocalError(
        apiError.message ||
          'Failed to reset password. The link may have expired or already been used. Please request a new reset link.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Set a secure password for your CareerBridge account."
      footer={
        <p className="cb-auth-switch-text">
          Remember your password?{' '}
          <Link to="/login" className="cb-auth-link">
            Return to sign in
          </Link>
        </p>
      }
    >
      {/* Missing Token Alert */}
      {isTokenMissing && (
        <div className="cb-glass-alert cb-glass-alert-error" role="alert">
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
          <span>
            No reset token found in URL. Please request a new password reset link from the{' '}
            <Link to="/forgot-password" className="cb-auth-link">
              Forgot Password page
            </Link>
            .
          </span>
        </div>
      )}

      {/* Error Alert */}
      {localError && (
        <div className="cb-glass-alert cb-glass-alert-error" role="alert">
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
          <span>{localError}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="cb-glass-alert cb-glass-alert-success" role="alert">
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

      {!successMessage && !isTokenMissing ? (
        <form className="cb-glass-form" onSubmit={handleSubmit} noValidate>
          <div className="cb-glass-field">
            <div className="cb-glass-label-row">
              <label htmlFor="new_password" className="cb-glass-label">
                New Password
              </label>
            </div>
            <PasswordInput
              id="new_password"
              name="new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={isLoading}
              autoComplete="new-password"
              required
              data-testid="new-password-input"
            />
          </div>

          <div className="cb-glass-field">
            <div className="cb-glass-label-row">
              <label htmlFor="confirm_password" className="cb-glass-label">
                Confirm New Password
              </label>
            </div>
            <PasswordInput
              id="confirm_password"
              name="confirm_password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              disabled={isLoading}
              autoComplete="new-password"
              required
              data-testid="confirm-password-input"
            />
          </div>

          <button
            type="submit"
            className="cb-glass-btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="cb-btn-spinner-wrap">
                <span className="cb-btn-spinner" aria-hidden="true" />
                Resetting Password...
              </span>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      ) : successMessage ? (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            className="cb-glass-btn-primary"
            onClick={() => navigate('/login')}
          >
            Sign In with New Password
          </button>
        </div>
      ) : null}
    </AuthLayout>
  );
};
