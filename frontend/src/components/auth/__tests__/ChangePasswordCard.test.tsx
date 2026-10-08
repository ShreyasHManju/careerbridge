import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChangePasswordCard } from '../ChangePasswordCard';
import * as authApi from '@/api/auth';
import * as useAuthModule from '@/auth/useAuth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ChangePasswordCard Component', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'student@example.com',
        role: 'student',
        is_active: true,
        is_verified: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      token: 'jwt-token-123',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders all required form fields and action button', () => {
    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    expect(screen.getByTestId('current-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('change-new-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('change-confirm-password-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Password/i })).toBeInTheDocument();
  });

  it('validates current password required', async () => {
    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your current password.');
  });

  it('validates new password length (minimum 8 chars)', async () => {
    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('current-password-input'), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-new-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByTestId('change-confirm-password-input'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('New password must be at least 8 characters long.');
  });

  it('validates that new password must differ from current password', async () => {
    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('current-password-input'), {
      target: { value: 'SamePassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-new-password-input'), {
      target: { value: 'SamePassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-confirm-password-input'), {
      target: { value: 'SamePassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'New password must be different from your current password.'
    );
  });

  it('validates confirmation mismatch', async () => {
    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('current-password-input'), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-new-password-input'), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-confirm-password-input'), {
      target: { value: 'Mismatch123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match.');
  });

  it('handles incorrect current password from API', async () => {
    vi.spyOn(authApi, 'changePasswordApi').mockRejectedValueOnce({
      status: 400,
      message: 'Incorrect current password.',
    });

    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('current-password-input'), {
      target: { value: 'WrongOldPassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-new-password-input'), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.change(screen.getByTestId('change-confirm-password-input'), {
      target: { value: 'NewPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect current password.');
    });
  });

  it('submits valid payload, clears inputs, logs out, and redirects to login on success', async () => {
    const changeSpy = vi.spyOn(authApi, 'changePasswordApi').mockResolvedValueOnce({
      message: 'Password changed successfully.',
    });

    render(
      <MemoryRouter>
        <ChangePasswordCard />
      </MemoryRouter>
    );

    const currentInput = screen.getByTestId('current-password-input') as HTMLInputElement;
    const newInput = screen.getByTestId('change-new-password-input') as HTMLInputElement;
    const confirmInput = screen.getByTestId('change-confirm-password-input') as HTMLInputElement;

    fireEvent.change(currentInput, {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(newInput, {
      target: { value: 'NewBrandPass123!' },
    });
    fireEvent.change(confirmInput, {
      target: { value: 'NewBrandPass123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith({
        current_password: 'OldPassword123!',
        new_password: 'NewBrandPass123!',
        confirm_password: 'NewBrandPass123!',
      });
    });

    // Success alert displayed
    expect(screen.getByRole('alert')).toHaveTextContent('Password changed successfully.');

    // Fields cleared
    expect(currentInput.value).toBe('');
    expect(newInput.value).toBe('');
    expect(confirmInput.value).toBe('');

    // Local authentication cleared via logout()
    expect(mockLogout).toHaveBeenCalled();
  });
});
