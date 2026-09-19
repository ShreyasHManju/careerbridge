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

  describe('initializeSession error handling and token preservation', () => {
    it('clears token and sets session expired when initializeSession encounters 401 TOKEN_EXPIRED', async () => {
      tokenStorage.setToken('expired-jwt');
      vi.spyOn(authApi, 'getMeApi').mockRejectedValue({
        success: false,
        message: 'Token has expired',
        error_code: 'TOKEN_EXPIRED',
        status: 401,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      expect(tokenStorage.getToken()).toBeNull();
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(sessionStorage.getItem('cb_session_expired')).toBe('true');
    });

    it('clears token when initializeSession encounters 401 INVALID_TOKEN', async () => {
      tokenStorage.setToken('invalid-jwt');
      vi.spyOn(authApi, 'getMeApi').mockRejectedValue({
        success: false,
        message: 'Invalid authentication token',
        error_code: 'INVALID_TOKEN',
        status: 401,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      expect(tokenStorage.getToken()).toBeNull();
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid authentication token');
    });

    it('PRESERVES stored token when initializeSession encounters 500 Internal Server Error', async () => {
      tokenStorage.setToken('valid-jwt-server-down');
      vi.spyOn(authApi, 'getMeApi').mockRejectedValue({
        success: false,
        message: 'Internal server error',
        error_code: 'INTERNAL_SERVER_ERROR',
        status: 500,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      // Token MUST NOT be wiped from localStorage
      expect(tokenStorage.getToken()).toBe('valid-jwt-server-down');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Internal server error');
    });

    it('PRESERVES stored token when initializeSession encounters 503 Service Unavailable', async () => {
      tokenStorage.setToken('valid-jwt-service-unavailable');
      vi.spyOn(authApi, 'getMeApi').mockRejectedValue({
        success: false,
        message: 'Database connectivity failure',
        error_code: 'SERVICE_UNAVAILABLE',
        status: 503,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      // Token MUST NOT be wiped from localStorage
      expect(tokenStorage.getToken()).toBe('valid-jwt-service-unavailable');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Database connectivity failure');
    });

    it('PRESERVES stored token when initializeSession encounters a network failure', async () => {
      tokenStorage.setToken('valid-jwt-network-failure');
      vi.spyOn(authApi, 'getMeApi').mockRejectedValue({
        success: false,
        message: 'Network Error',
        error_code: 'NETWORK_ERROR',
        status: undefined,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      // Token MUST NOT be wiped on offline or network glitch
      expect(tokenStorage.getToken()).toBe('valid-jwt-network-failure');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Network Error');
    });

    it('PRESERVES stored token when initializeSession encounters 403 Forbidden', async () => {
      tokenStorage.setToken('valid-jwt-forbidden');
      vi.spyOn(authApi, 'getMeApi').mockRejectedValue({
        success: false,
        message: 'Account disabled or restricted',
        error_code: 'FORBIDDEN',
        status: 403,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
      });

      // 403 must NOT wipe the token
      expect(tokenStorage.getToken()).toBe('valid-jwt-forbidden');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Account disabled or restricted');
    });
  });
});
