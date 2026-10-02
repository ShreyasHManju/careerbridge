import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import * as useAuthModule from '@/auth/useAuth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError, text }: { onSuccess: (res: { credential?: string }) => void; onError?: () => void; text?: string }) => (
    <div data-testid="google-login-container">
      <button
        type="button"
        onClick={() => onSuccess({ credential: 'mock-google-id-token-xyz' })}
        data-testid="google-login-button"
      >
        {text === 'continue_with' ? 'Continue with Google' : 'Sign in with Google'}
      </button>
      <button
        type="button"
        onClick={() => onError && onError()}
        data-testid="google-error-trigger"
      >
        Trigger Google Error
      </button>
      <button
        type="button"
        onClick={() => onSuccess({ credential: undefined })}
        data-testid="google-empty-credential-trigger"
      >
        Trigger Empty Credential
      </button>
    </div>
  ),
  useGoogleLogin: vi.fn(),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('LoginPage Component', () => {
  const mockLogin = vi.fn();
  const mockLoginWithGoogle = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      loginWithGoogle: mockLoginWithGoogle,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      user: null,
      token: null,
      isAuthenticated: false,
      register: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
    });
  });

  it('renders login form elements with accessible controls and register link', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create an account/i })).toBeInTheDocument();
  });

  it('validates required fields on client before calling login', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter both email and password.');
  });

  it('calls login API with trimmed email and password, then navigates on success', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 1,
      email: 'student@example.com',
      role: 'student',
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: '  student@example.com  ' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'Password123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'Password123!',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
    });
  });

  it('displays session expired alert if session was flagged in sessionStorage', () => {
    sessionStorage.setItem('cb_session_expired', 'true');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Your session expired');
    expect(sessionStorage.getItem('cb_session_expired')).toBeNull();
  });

  it('displays auth error message when authentication fails', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      loginWithGoogle: mockLoginWithGoogle,
      isLoading: false,
      error: 'Incorrect email or password',
      clearError: mockClearError,
      user: null,
      token: null,
      isAuthenticated: false,
      register: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password');
  });

  it('renders Google sign-in button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
  });

  it('invokes loginWithGoogle and navigates on successful Google login', async () => {
    mockLoginWithGoogle.mockResolvedValueOnce({
      id: 5,
      email: 'google.student@example.com',
      role: 'student',
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('google-login-button'));

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled();
      expect(mockLoginWithGoogle).toHaveBeenCalledWith('mock-google-id-token-xyz');
      expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
    });
  });

  it('handles Google authentication error when Google returns failure', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('google-error-trigger'));

    expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in was unsuccessful. Please try again.');
  });

  it('handles Google authentication error when empty credential is received', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('google-empty-credential-trigger'));

    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Google authentication failed: no credential received.');
  });

  it('toggles password visibility when toggle button is clicked', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/^Password$/i) as HTMLInputElement;
    const toggleBtn = screen.getByTestId('password-toggle-btn');

    expect(passwordInput.type).toBe('password');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');

    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Hide password');

    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('password');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show password');
  });
});
