import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { UserRole } from '@/types/auth';
import { ApiErrorResponse } from '@/types/api';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/ui/PasswordInput';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const { register, isLoading, error: authError, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setSuccessNotice(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    // Backend enforces min_length=6 in app/schemas/user.py
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    try {
      await register({
        email: trimmedEmail,
        password,
        role,
      });

      setSuccessNotice('Account created successfully! Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      setLocalError(apiError.message || 'Registration failed.');
    }
  };

  const displayedError = localError || authError;

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join CareerBridge as a student or recruiter"
      footer={
        <p className="cb-auth-switch-text">
          Already registered?{' '}
          <Link to="/login" className="cb-auth-link">
            Sign in here
          </Link>
        </p>
      }
    >
      {/* Success Alert */}
      {successNotice && (
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
          <span>{successNotice}</span>
        </div>
      )}

      {/* Error Alert */}
      {displayedError && (
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
          <span>{displayedError}</span>
        </div>
      )}

      {/* Registration Form */}
      <form className="cb-glass-form" onSubmit={handleSubmit} noValidate>
        <div className="cb-glass-field">
          <label htmlFor="reg-email" className="cb-glass-label">
            Email Address
          </label>
          <div className="cb-glass-input-box">
            <input
              id="reg-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@university.edu"
              disabled={isLoading}
              required
              autoComplete="email"
              className="cb-glass-input"
            />
          </div>
        </div>

        <div className="cb-glass-field">
          <div className="cb-glass-label-row">
            <label htmlFor="reg-password" className="cb-glass-label">
              Password
            </label>
          </div>
          <PasswordInput
            id="reg-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            disabled={isLoading}
            required
            autoComplete="new-password"
            className="cb-glass-input"
          />
          <small className="cb-glass-field-hint">
            Backend requires at least 6 characters (8+ recommended).
          </small>
        </div>

        <div className="cb-glass-field">
          <label htmlFor="reg-role" className="cb-glass-label">
            Account Type
          </label>
          <div className="cb-glass-input-box">
            <select
              id="reg-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isLoading}
              className="cb-glass-select"
            >
              <option value="student">Student / Candidate</option>
              <option value="recruiter">Employer / Recruiter</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="cb-glass-btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="cb-btn-spinner-wrap">
              <span className="cb-btn-spinner" aria-hidden="true" />
              Creating Account...
            </span>
          ) : (
            'Register'
          )}
        </button>
      </form>
    </AuthLayout>
  );
};
