import { apiClient, getRootUrl } from './client';
import { LoginRequest, LoginResponse, RegisterRequest, User } from '@/types/auth';

/**
 * Authentication API Service
 * Calls real FastAPI backend routes documented in docs/frontend/api-contract.md
 */

/**
 * Authenticate credentials and receive a 30-minute JWT access token.
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
