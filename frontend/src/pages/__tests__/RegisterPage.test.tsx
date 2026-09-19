import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';
import * as useAuthModule from '@/auth/useAuth';

describe('RegisterPage', () => {
  const mockRegister = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      user: null,
      token: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
    });
  });

  it('renders public registration role selector with only student and recruiter options', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const roleSelect = screen.getByLabelText(/Account Type/i) as HTMLSelectElement;
    expect(roleSelect).toBeInTheDocument();

    const options = Array.from(roleSelect.options).map((opt) => opt.value);

    // Must offer student and recruiter
    expect(options).toContain('student');
    expect(options).toContain('recruiter');

    // CRITICAL: Must NEVER offer admin on public self-registration form
    expect(options).not.toContain('admin');
    expect(options).toHaveLength(2);
  });

  it('does not contain any admin option text in the DOM', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Administrator/i)).not.toBeInTheDocument();
  });
});
