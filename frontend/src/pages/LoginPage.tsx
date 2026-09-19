import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiErrorResponse } from '@/types/api';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<boolean>(false);

  const { login, isLoading, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/app';

  // Check if redirected because of session expiration
  useEffect(() => {
    try {
      if (sessionStorage.getItem('cb_session_expired') === 'true') {
        setSessionExpiredNotice(true);
        sessionStorage.removeItem('cb_session_expired');
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Handle 429 countdown
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      if (apiError.status === 429 && apiError.retry_after) {
        setCountdown(apiError.retry_after);
      }
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="cb-auth-card">
      <h2>Welcome Back</h2>
      <p className="cb-auth-desc">Sign in to your CareerBridge account</p>

      {sessionExpiredNotice && (
        <div className="cb-alert cb-alert-warning" role="alert">
          Your session expired after 30 minutes. Please sign in again.
        </div>
      )}

      {displayedError && (
        <div className="cb-alert cb-alert-danger" role="alert">
          {displayedError}
        </div>
      )}

      {countdown !== null && (
        <div className="cb-alert cb-alert-warning" role="alert">
          Too many login attempts. Please wait {countdown} seconds before retrying.
        </div>
      )}

      <form onSubmit={handleSubmit} className="cb-form" noValidate>
        <div className="cb-form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            disabled={isLoading || countdown !== null}
            required
            autoComplete="username"
            className="cb-input"
          />
        </div>

        <div className="cb-form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading || countdown !== null}
            required
            autoComplete="current-password"
            className="cb-input"
          />
        </div>

        <button
          type="submit"
          className="cb-btn cb-btn-primary cb-btn-block"
          disabled={isLoading || countdown !== null}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="cb-auth-footer">
        <p>
          Don't have an account?{' '}
          <Link to="/register" className="cb-link">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
