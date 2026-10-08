import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import * as authApi from '@/api/auth';

describe('ForgotPasswordPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form, email field, submit button, and login link', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Forgot Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to sign in/i })).toHaveAttribute('href', '/login');
  });

  it('rejects empty email submission with validation error', async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your email address.');
  });

  it('rejects malformed email submission with validation error', async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.');
  });

  it('normalizes email (trims and lowercases) before sending to API', async () => {
    const requestSpy = vi.spyOn(authApi, 'requestPasswordResetApi').mockResolvedValueOnce({
      message: 'If an account is associated with this email, a password reset link has been dispatched.',
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: '  Candidate@University.EDU  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith({
        email: 'candidate@university.edu',
      });
    });
  });

  it('displays generic enumeration-safe success message without revealing account existence', async () => {
    vi.spyOn(authApi, 'requestPasswordResetApi').mockResolvedValueOnce({
      message: 'If an account is associated with this email, a password reset link has been dispatched. Please check your inbox and spam folder.',
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'unknown.user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'If an account is associated with this email, a password reset link has been dispatched. Please check your inbox and spam folder.'
      );
    });

    // Form inputs replaced by success state with link back to sign in
    expect(screen.queryByLabelText(/Email Address/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Sign In/i })).toHaveAttribute('href', '/login');
  });

  it('handles 429 rate limit error with countdown and informative message', async () => {
    vi.spyOn(authApi, 'requestPasswordResetApi').mockRejectedValueOnce({
      status: 429,
      message: 'Too many requests. Please wait before retrying.',
      retry_after: 60,
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'rate.limit@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Too many reset attempts\. Please wait 60 seconds/i)).toBeInTheDocument();
    });
  });

  it('handles general API errors gracefully', async () => {
    vi.spyOn(authApi, 'requestPasswordResetApi').mockRejectedValueOnce({
      status: 500,
      message: 'Service unavailable. Please try again later.',
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'candidate@university.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable. Please try again later.');
    });
  });
});
