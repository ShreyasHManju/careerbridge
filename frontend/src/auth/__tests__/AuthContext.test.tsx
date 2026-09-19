import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, AuthContext } from '../AuthContext';
import { tokenStorage } from '@/utils/tokenStorage';
import * as authApi from '@/api/auth';
import { User } from '@/types/auth';

const mockUser: User = {
  id: 10,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: false,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

// Test consumer component
const TestConsumer: React.FC = () => {
  const auth = React.useContext(AuthContext)!;

  return (
    <div>
      <span data-testid="auth-status">{auth.isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      <span data-testid="loading-status">{auth.isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="user-email">{auth.user?.email || 'none'}</span>
      <span data-testid="auth-error">{auth.error || 'none'}</span>
      <button onClick={() => auth.login({ email: 'student@example.com', password: 'password123' })}>
        Log In
      </button>
      <button onClick={() => auth.logout()}>Log Out</button>
    </div>
  );
};

describe('AuthContext & AuthProvider', () => {
  beforeEach(() => {
    tokenStorage.clearToken();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts unauthenticated when no stored token exists', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('none');
  });

  it('initializes session when a valid token is found in tokenStorage', async () => {
    tokenStorage.setToken('valid-existing-jwt');
    vi.spyOn(authApi, 'getMeApi').mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('student@example.com');
  });

  it('performs full login workflow: calls loginApi, stores token, calls getMeApi', async () => {
    vi.spyOn(authApi, 'loginApi').mockResolvedValue({
      access_token: 'new-login-token-123',
      token_type: 'bearer',
    });
    vi.spyOn(authApi, 'getMeApi').mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
    });

    // Click Login
    act(() => {
      screen.getByText('Log In').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('student@example.com');
    });

    expect(tokenStorage.getToken()).toBe('new-login-token-123');
  });

  it('clears token and resets user state upon logout', async () => {
    tokenStorage.setToken('existing-jwt');
    vi.spyOn(authApi, 'getMeApi').mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    act(() => {
      screen.getByText('Log Out').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('none');
    expect(tokenStorage.getToken()).toBeNull();
  });

  it('handles TOKEN_EXPIRED event by purging credentials and flagging session expiration', async () => {
    tokenStorage.setToken('expired-jwt');
    vi.spyOn(authApi, 'getMeApi').mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // Simulate 401 TOKEN_EXPIRED event from API client
    act(() => {
      window.dispatchEvent(
        new CustomEvent('auth:unauthorized', {
          detail: {
            success: false,
            message: 'Authentication token has expired',
            error_code: 'TOKEN_EXPIRED',
            status: 401,
          },
        })
      );
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(tokenStorage.getToken()).toBeNull();
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Your session has expired');
    expect(sessionStorage.getItem('cb_session_expired')).toBe('true');
  });
});
