import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { requestPasswordResetApi } from '@/api/auth';
import { ApiErrorResponse } from '@/types/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  /**
   * Rate-limit countdown timer.
   */
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((previous) =>
        previous !== null && previous > 1 ? previous - 1 : null
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLocalError('Please enter your email address.');
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await requestPasswordResetApi({
        email: normalizedEmail,
      });

      // Always show generic enumeration-safe success message
      setSuccessMessage(
        response.message ||
          'If an account is associated with this email, a password reset link has been dispatched. Please check your inbox and spam folder.'
      );
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;

      if (apiError.status === 429 && apiError.retry_after) {
        setCountdown(apiError.retry_after);
        setLocalError(
          `Too many reset attempts. Please wait ${apiError.retry_after} seconds before trying again.`
        );
      } else {
        setLocalError(
          apiError.message ||
            'Unable to process password reset request. Please try again later.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || countdown !== null;

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email address to receive password reset instructions."
      footer={
        <p className="cb-auth-switch-text">
          Remember your password?{' '}
          <Link to="/login" className="cb-auth-link">
            Return to sign in
          </Link>
        </p>
      }
    >
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

      {/* Rate Limit Countdown Alert */}
      {countdown !== null && (
        <div className="cb-glass-alert cb-glass-alert-warning" role="alert">
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
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Please wait {countdown} seconds before submitting again.</span>
        </div>
      )}

      {!successMessage ? (
        <form className="cb-glass-form" onSubmit={handleSubmit} noValidate>
          <div className="cb-glass-field">
            <label htmlFor="email" className="cb-glass-label">
              Email Address
            </label>
            <div className="cb-glass-input-box">
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="candidate@university.edu"
                disabled={isDisabled}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="cb-glass-input"
              />
            </div>
          </div>

          <button
            type="submit"
            className="cb-glass-btn-primary"
            disabled={isDisabled}
          >
            {isLoading ? (
              <span className="cb-btn-spinner-wrap">
                <span className="cb-btn-spinner" aria-hidden="true" />
                Sending Link...
              </span>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>
      ) : (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/login" className="cb-glass-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </div>
      )}
    </AuthLayout>
  );
};
