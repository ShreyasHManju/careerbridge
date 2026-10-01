import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import {
  loginApi,
  getMeApi,
  registerApi,
  healthCheckApi,
  rootPingApi,
  googleLoginApi,
} from '../auth';

describe('Auth API service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('googleLoginApi', () => {
    it('calls POST /auth/google with Google ID token credential', async () => {
      const mockResponse = {
        access_token: 'careerbridge-jwt-token-google-123',
        token_type: 'bearer',
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        data: mockResponse,
      });

      const credential = 'mock-google-id-token-abc';
      const result = await googleLoginApi(credential);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/auth/google', {
        credential: 'mock-google-id-token-abc',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('loginApi', () => {
    it('calls POST /auth/login with credentials and returns login response', async () => {
      const mockResponse = {
        access_token: 'careerbridge-jwt-token-local-123',
        token_type: 'bearer',
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        data: mockResponse,
      });

      const result = await loginApi({
        email: 'user@example.com',
        password: 'Password123!',
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/auth/login', {
        email: 'user@example.com',
        password: 'Password123!',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getMeApi', () => {
    it('calls GET /auth/me and returns current user', async () => {
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        role: 'student' as const,
        is_active: true,
        is_verified: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        data: mockUser,
      });

      const result = await getMeApi();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });
  });

  describe('registerApi', () => {
    it('calls POST /users and returns created user', async () => {
      const mockUser = {
        id: 2,
        email: 'newuser@example.com',
        role: 'student' as const,
        is_active: true,
        is_verified: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        data: mockUser,
      });

      const result = await registerApi({
        email: 'newuser@example.com',
        password: 'Password123!',
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/users', {
        email: 'newuser@example.com',
        password: 'Password123!',
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('healthCheckApi and rootPingApi', () => {
    it('calls health check endpoint', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        data: { status: 'healthy', database: 'connected' },
      });

      const result = await healthCheckApi();
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('healthy');
    });

    it('calls root ping endpoint', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        data: { message: 'CareerBridge API', status: 'ok' },
      });

      const result = await rootPingApi();
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('ok');
    });
  });
});
