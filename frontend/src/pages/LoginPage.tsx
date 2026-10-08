import React, {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { GoogleLogin } from '@react-oauth/google';

import { useAuth } from '@/auth/useAuth';
import { ApiErrorResponse } from '@/types/api';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/ui/PasswordInput';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  const {
    login,
    loginWithGoogle,
    isLoading,
    error: authError,
    clearError,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (
      location.state as {
        from?: {
          pathname?: string;
        };
      }
    )?.from?.pathname || '/app';

  /**
   * Show session-expired message once.
   */
  useEffect(() => {
    try {
      if (sessionStorage.getItem('cb_session_expired') === 'true') {
        setSessionExpiredNotice(true);
        sessionStorage.removeItem('cb_session_expired');
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  /**
   * Rate-limit countdown.
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

  /**
   * Normal email/password login.
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    clearError();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    try {
      await login({
        email: trimmedEmail,
        password,
      });

      navigate(from, {
        replace: true,
      });
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;

      if (apiError.status === 429 && apiError.retry_after) {
        setCountdown(apiError.retry_after);
      }
    }
  };

  /**
   * Google authentication callback.
   *
   * Google returns an ID token credential.
   * That credential is sent to our backend.
   */
  const handleGoogleSuccess = async (credentialResponse: {
    credential?: string;
  }) => {
    clearError();
    setLocalError(null);

    if (!credentialResponse.credential) {
      setLocalError(
        'Google authentication failed: no credential received.'
      );
      return;
    }

    try {
      await loginWithGoogle(credentialResponse.credential);

      navigate(from, {
        replace: true,
      });
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;

      if (apiError.status === 409) {
        setLocalError(
          apiError.message ||
            'An account with this email already exists. Please sign in using your existing email and password.'
        );
      } else {
        setLocalError(
          apiError.message ||
            'Google sign-in failed. Please try again.'
        );
      }
    }
  };

  /**
   * Google authentication error.
   */
  const handleGoogleError = () => {
    clearError();

    setLocalError(
      'Google sign-in was unsuccessful. Please try again.'
    );
  };

  const displayedError = localError || authError;
  const isDisabled = isLoading || countdown !== null;

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your CareerBridge account"
      footer={
        <p className="cb-auth-switch-text">
          Don't have an account?{' '}
          <Link to="/register" className="cb-auth-link">
            Create an account
          </Link>
        </p>
      }
    >
      {/* Session Expired Alert */}
      {sessionExpiredNotice && (
        <div className="cb-glass-alert cb-glass-alert-warning" role="alert">
          <svg className="cb-alert-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Your session expired. Please sign in again.</span>
        </div>
      )}

      {/* Authentication / API Error Alert */}
      {displayedError && (
        <div className="cb-glass-alert cb-glass-alert-error" role="alert">
          <svg className="cb-alert-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{displayedError}</span>
        </div>
      )}

      {/* Rate Limit Countdown Alert */}
      {countdown !== null && (
        <div className="cb-glass-alert cb-glass-alert-warning" role="alert">
          <svg className="cb-alert-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Too many login attempts. Please wait {countdown} seconds.</span>
        </div>
      )}

      {/* Google Sign-In */}
      <div className="cb-glass-google-wrap">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap={false}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width="320"
        />
      </div>

      {/* Modern OR Divider */}
      <div className="cb-glass-divider" aria-hidden="true">
        <span className="cb-glass-divider-line" />
        <span className="cb-glass-divider-text">OR</span>
        <span className="cb-glass-divider-line" />
      </div>

      {/* Email / Password Form */}
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
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="cb-glass-input"
            />
          </div>
        </div>

        <div className="cb-glass-field">
          <div className="cb-glass-label-row">
            <label htmlFor="password" className="cb-glass-label">
              Password
            </label>
            <Link to="/forgot-password" className="cb-auth-link cb-auth-forgot-link">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            disabled={isDisabled}
            autoComplete="current-password"
            required
            className="cb-glass-input"
          />
        </div>

        <button
          type="submit"
          className="cb-glass-btn-primary"
          disabled={isDisabled}
        >
          {isLoading ? (
            <span className="cb-btn-spinner-wrap">
              <span className="cb-btn-spinner" aria-hidden="true" />
              Signing in...
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </AuthLayout>
  );
};
