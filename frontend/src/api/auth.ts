import { apiClient, getRootUrl } from './client';
import {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
  PasswordResetConfirmRequest,
  PasswordResetConfirmResponse,
  PasswordResetRequest,
  PasswordResetResponse,
  RegisterRequest,
  User,
} from '@/types/auth';

/**
 * Authentication API Service
 * Calls real FastAPI backend routes documented in docs/frontend/api-contract.md
 */

/**
 * Authenticate credentials and receive a JWT access token.
 * Route: POST /api/v1/auth/login
 */
export async function loginApi(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return response.data;
}

/**
 * Retrieve authenticated user profile and assigned role.
 * Route: GET /api/v1/auth/me
 */
export async function getMeApi(): Promise<User> {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
}

/**
 * Register a new user account.
 * Route: POST /api/v1/users
 */
export async function registerApi(payload: RegisterRequest): Promise<User> {
  const response = await apiClient.post<User>('/users', payload);
  return response.data;
}

/**
 * Request a password reset link.
 * Route: POST /api/v1/auth/password-reset/request
 */
export async function requestPasswordResetApi(
  payload: PasswordResetRequest
): Promise<PasswordResetResponse> {
  const response = await apiClient.post<PasswordResetResponse>(
    '/auth/password-reset/request',
    payload
  );
  return response.data;
}

/**
 * Confirm password reset using a time-sensitive token.
 * Route: POST /api/v1/auth/password-reset/confirm
 */
export async function confirmPasswordResetApi(
  payload: PasswordResetConfirmRequest
): Promise<PasswordResetConfirmResponse> {
  const response = await apiClient.post<PasswordResetConfirmResponse>(
    '/auth/password-reset/confirm',
    payload
  );
  return response.data;
}

/**
 * Change password for authenticated user.
 * Route: POST /api/v1/auth/change-password
 */
export async function changePasswordApi(
  payload: ChangePasswordRequest
): Promise<ChangePasswordResponse> {
  const response = await apiClient.post<ChangePasswordResponse>(
    '/auth/change-password',
    payload
  );
  return response.data;
}

/**
 * Health probe for system and database connectivity.
 * Route: GET /health (Root probe outside /api/v1 prefix)
 */
export async function healthCheckApi(): Promise<{ status: string; database?: string; service?: string }> {
  const url = getRootUrl('/health');
  const response = await apiClient.get<{ status: string; database?: string; service?: string }>(url, {
    baseURL: '',
  });
  return response.data;
}

/**
 * Root service ping.
 * Route: GET / (Root probe outside /api/v1 prefix)
 */
export async function rootPingApi(): Promise<{ message: string; status: string }> {
  const url = getRootUrl('/');
  const response = await apiClient.get<{ message: string; status: string }>(url, {
    baseURL: '',
  });
  return response.data;
}

/**
 * Authenticate using a Google OAuth ID token.
 * Route: POST /api/v1/auth/google
 */
export async function googleLoginApi(credential: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/google', {
    credential,
  });
  return response.data;
}