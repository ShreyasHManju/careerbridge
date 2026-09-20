import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('validates required fields on client before submitting', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Register/i });
    fireEvent.click(submitBtn);

    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter both email and password.');
  });

  it('validates password minimum length (>= 6 chars)', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Register/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 6 characters long.');
  });

  it('submits valid registration payload to register API', async () => {
    mockRegister.mockResolvedValueOnce({
      id: 5,
      email: 'newstudent@example.com',
      role: 'student',
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Register/i });

    fireEvent.change(emailInput, { target: { value: '  newstudent@example.com  ' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'newstudent@example.com',
        password: 'Password123!',
        role: 'student',
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Account created successfully');
    });
  });
});
