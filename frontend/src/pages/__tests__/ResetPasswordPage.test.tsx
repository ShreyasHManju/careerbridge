import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResetPasswordPage } from '../ResetPasswordPage';
import * as authApi from '@/api/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ResetPasswordPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('displays error notice when token is missing in search params', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No reset token found in URL. Please request a new password reset link'
    );
    expect(screen.queryByLabelText(/New Password/i)).not.toBeInTheDocument();
  });

  it('renders password fields when a token is provided in query params', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid-test-token-123']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
  });

  it('validates password length (minimum 8 chars)', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid-test-token-123']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters long.');
  });

  it('validates confirmation password match', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid-test-token-123']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'ValidPassword123!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'DifferentPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  });

  it('submits valid payload to API with extracted token and displays success state', async () => {
    const confirmSpy = vi.spyOn(authApi, 'confirmPasswordResetApi').mockResolvedValueOnce({
      message: 'Your password has been successfully reset.',
    });

    render(
      <MemoryRouter initialEntries={['/reset-password?token=secure-raw-token-abc']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'NewSecretPass123!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'NewSecretPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith({
        token: 'secure-raw-token-abc',
        new_password: 'NewSecretPass123!',
        confirm_password: 'NewSecretPass123!',
      });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Your password has been successfully reset.');
    expect(screen.getByRole('button', { name: /Sign In with New Password/i })).toBeInTheDocument();

    // Verify token is never written to localStorage or sessionStorage
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();

    // Click Sign In with New Password navigates to login
    fireEvent.click(screen.getByRole('button', { name: /Sign In with New Password/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('handles invalid or expired token API error', async () => {
    vi.spyOn(authApi, 'confirmPasswordResetApi').mockRejectedValueOnce({
      status: 400,
      message: 'Password reset link is invalid or has expired.',
    });

    render(
      <MemoryRouter initialEntries={['/reset-password?token=expired-token-xyz']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('new-password-input'), {
      target: { value: 'NewSecretPass123!' },
    });
    fireEvent.change(screen.getByTestId('confirm-password-input'), {
      target: { value: 'NewSecretPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Password reset link is invalid or has expired.'
      );
    });
  });
});
