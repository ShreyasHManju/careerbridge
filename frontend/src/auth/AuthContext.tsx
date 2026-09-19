import React, { createContext, useCallback, useEffect, useState } from 'react';
import { AuthState, LoginRequest, RegisterRequest, User } from '@/types/auth';
import { getMeApi, loginApi, registerApi } from '@/api/auth';
import { tokenStorage } from '@/utils/tokenStorage';
import { ApiErrorResponse } from '@/types/api';

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => void;
  clearAuthentication: () => void;
  initializeSession: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => tokenStorage.getToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear all local authentication credentials and state.
   */
  const clearAuthentication = useCallback(() => {
    tokenStorage.clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  /**
   * User-triggered logout action.
   */
  const logout = useCallback(() => {
    clearAuthentication();
    setError(null);
  }, [clearAuthentication]);

  /**
   * Handle expired or invalid tokens:
   * 1. Preserves unsaved form draft state where practical
   * 2. Clears authentication credentials
   * 3. Sets descriptive error
   */
  const handleExpiredToken = useCallback(() => {
    try {
      sessionStorage.setItem('cb_session_expired', 'true');
    } catch {
      // Ignore storage errors in restricted contexts
    }
    clearAuthentication();
    setError('Your session has expired. Please log in again.');
  }, [clearAuthentication]);

  /**
   * Initialize session on initial mount:
   * Validates stored JWT against GET /api/v1/auth/me
   */
  const initializeSession = useCallback(async () => {
    const existingToken = tokenStorage.getToken();
    if (!existingToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const currentUser = await getMeApi();
      setUser(currentUser);
      setTokenState(existingToken);
      setError(null);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const status = apiError?.status;

      if (status === 401) {
        // Backend explicitly rejected the token as expired or invalid
        if (apiError?.error_code === 'TOKEN_EXPIRED') {
          handleExpiredToken();
        } else {
          clearAuthentication();
          setError(apiError?.message || 'Authentication session is invalid. Please log in.');
        }
      } else {
        // Network failure, 500, 503, 403, 429
        // CRITICAL: Preserve stored token so temporary outages do not destroy active session!
        setTokenState(existingToken);
        const fallbackMsg =
          status && status >= 500
            ? 'Service is temporarily unavailable. Your session is preserved.'
            : 'Unable to reach the server. Please check your network connection.';
        setError(apiError?.message || fallbackMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthentication, handleExpiredToken]);

  /**
   * Authenticate user:
   * 1. Calls POST /api/v1/auth/login
   * 2. Stores access token in tokenStorage
   * 3. Calls GET /api/v1/auth/me
   * 4. Updates reactive state
   */
  const login = useCallback(
    async (credentials: LoginRequest): Promise<User> => {
      setIsLoading(true);
      setError(null);
      try {
        const loginResponse = await loginApi(credentials);
        tokenStorage.setToken(loginResponse.access_token);
        setTokenState(loginResponse.access_token);

        const currentUser = await getMeApi();
        setUser(currentUser);
        return currentUser;
      } catch (err: unknown) {
        const apiError = err as ApiErrorResponse;
        const message = apiError.message || 'Login failed. Please check your credentials.';
        setError(message);
        clearAuthentication();
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [clearAuthentication]
  );

  /**
   * Register new user account:
   * Calls POST /api/v1/users
   */
  const register = useCallback(async (payload: RegisterRequest): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const newUser = await registerApi(payload);
      return newUser;
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const message = apiError.message || 'Registration failed.';
      setError(message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Listen for global 'auth:unauthorized' events dispatched by the API client
  useEffect(() => {
    const onUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<ApiErrorResponse>;
      if (customEvent.detail?.error_code === 'TOKEN_EXPIRED') {
        handleExpiredToken();
      } else {
        clearAuthentication();
      }
    };

    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized);
    };
  }, [clearAuthentication, handleExpiredToken]);

  // Initial session hydration
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    error,
    login,
    register,
    logout,
    clearAuthentication,
    initializeSession,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
