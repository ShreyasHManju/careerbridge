import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { UserRole } from '@/types/auth';
import { ApiErrorResponse } from '@/types/api';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const { register, isLoading, error: authError, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="cb-auth-card">
      <h2>Create Account</h2>
      <p className="cb-auth-desc">Join CareerBridge as a student or recruiter</p>

      {successNotice && (
        <div className="cb-alert cb-alert-success" role="alert">
          {successNotice}
        </div>
      )}

      {displayedError && (
        <div className="cb-alert cb-alert-danger" role="alert">
          {displayedError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="cb-form" noValidate>
        <div className="cb-form-group">
          <label htmlFor="reg-email">Email Address</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="candidate@university.edu"
            disabled={isLoading}
            required
            autoComplete="email"
            className="cb-input"
          />
        </div>

        <div className="cb-form-group">
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            disabled={isLoading}
            required
            autoComplete="new-password"
            className="cb-input"
          />
          <small className="cb-input-hint">
            Backend requires at least 6 characters (8+ recommended).
          </small>
        </div>

        <div className="cb-form-group">
          <label htmlFor="reg-role">Account Type</label>
          <select
            id="reg-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'student' | 'recruiter')}
            disabled={isLoading}
            className="cb-select"
          >
            <option value="student">Student / Candidate</option>
            <option value="recruiter">Employer / Recruiter</option>
          </select>
        </div>

        <button
          type="submit"
          className="cb-btn cb-btn-primary cb-btn-block"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <div className="cb-auth-footer">
        <p>
          Already registered?{' '}
          <Link to="/login" className="cb-link">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};
