import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '@/utils/tokenStorage';
import { ApiErrorResponse } from '@/types/api';

/**
 * CareerBridge Centralized Axios API Client
 *
 * Configured according to docs/frontend/api-contract.md:
 * - Base URL from VITE_API_BASE_URL (defaults to /api/v1)
 * - Injects Authorization: Bearer <token>
 * - Normalizes backend error envelopes { success, message, error_code, detail }
 * - Dispatches 'auth:unauthorized' on 401 (access-token-only; NO refresh tokens)
 * - Captures Retry-After on 429 rate limiting
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Authorization Bearer Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Normalize Structured Errors & Handle Auth Failure
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;

    // Build normalized ApiErrorResponse
    let normalizedError: ApiErrorResponse = {
      success: false,
      message: 'An unexpected network error occurred. Please try again.',
      error_code: 'UNKNOWN_ERROR',
      status,
    };

    if (data && typeof data === 'object') {
      // Backend structured error envelope format: { success, message, error_code, detail }
      normalizedError = {
        success: false,
        message: typeof data.message === 'string' ? data.message : error.message || 'Request failed',
        error_code: typeof data.error_code === 'string' ? data.error_code : 'INTERNAL_SERVER_ERROR',
        detail: data.detail as ApiErrorResponse['detail'],
        status,
      };
    } else if (error.message) {
      normalizedError.message = error.message;
    }

    // Capture Retry-After header on 429 Too Many Requests
    if (status === 429 && error.response?.headers) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        normalizedError.retry_after = parseInt(String(retryAfter), 10) || 60;
      }
    }

    // Handle 401 Unauthorized:
    // CareerBridge uses ACCESS-TOKEN-ONLY authentication.
    // There is no refresh-token endpoint and no refresh logic.
    // Notify the application layer to clear authentication and redirect.
    if (status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('auth:unauthorized', {
            detail: normalizedError,
          })
        );
      }
    }

    return Promise.reject(normalizedError);
  }
);
