import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, getRootUrl } from '../client';
import { healthCheckApi } from '../auth';
import { tokenStorage } from '@/utils/tokenStorage';

describe('apiClient', () => {
  beforeEach(() => {
    tokenStorage.clearToken();
    vi.restoreAllMocks();
  });

  it('attaches Authorization Bearer header when access token is stored', async () => {
    tokenStorage.setToken('sample-jwt-token');

    const requestHandler = (apiClient.interceptors.request as any).handlers[0]?.fulfilled;
    expect(requestHandler).toBeDefined();

    const config = await requestHandler({
      headers: {},
    });

    expect(config.headers.Authorization).toBe('Bearer sample-jwt-token');
  });

  it('does not attach Authorization header when no token is present', async () => {
    const requestHandler = (apiClient.interceptors.request as any).handlers[0]?.fulfilled;
    expect(requestHandler).toBeDefined();

    const config = await requestHandler({
      headers: {},
    });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('normalizes structured backend error envelopes', async () => {
    const mockBackendError = {
      response: {
        status: 422,
        data: {
          success: false,
          message: 'Request validation failed.',
          error_code: 'VALIDATION_ERROR',
          detail: [{ loc: ['body', 'password'], msg: 'String should have at least 6 characters' }],
        },
      },
    };

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler(mockBackendError)).rejects.toEqual({
      success: false,
      message: 'Request validation failed.',
      error_code: 'VALIDATION_ERROR',
      detail: [{ loc: ['body', 'password'], msg: 'String should have at least 6 characters' }],
      status: 422,
    });
  });

  it('dispatches auth:unauthorized event on authenticated request with TOKEN_EXPIRED', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('auth:unauthorized', eventSpy);

    const mock401Error = {
      config: { url: '/auth/me' },
      response: {
        status: 401,
        data: {
          success: false,
          message: 'Authentication token has expired',
          error_code: 'TOKEN_EXPIRED',
          detail: 'Authentication token has expired',
        },
      },
    };

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler(mock401Error)).rejects.toMatchObject({
      status: 401,
      error_code: 'TOKEN_EXPIRED',
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const customEvent = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(customEvent.detail.error_code).toBe('TOKEN_EXPIRED');

    window.removeEventListener('auth:unauthorized', eventSpy);
  });

  it('dispatches auth:unauthorized event on authenticated request with INVALID_TOKEN', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('auth:unauthorized', eventSpy);

    const mockInvalidTokenError = {
      config: { url: '/auth/me' },
      response: {
        status: 401,
        data: {
          success: false,
          message: 'Invalid authentication token',
          error_code: 'INVALID_TOKEN',
          detail: 'Invalid authentication token',
        },
      },
    };

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler(mockInvalidTokenError)).rejects.toMatchObject({
      status: 401,
      error_code: 'INVALID_TOKEN',
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const customEvent = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(customEvent.detail.error_code).toBe('INVALID_TOKEN');

    window.removeEventListener('auth:unauthorized', eventSpy);
  });

  it('does NOT dispatch auth:unauthorized event on failed login attempt (POST /auth/login)', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('auth:unauthorized', eventSpy);

    const mockLoginFailedError = {
      config: { url: '/auth/login' },
      response: {
        status: 401,
        data: {
          success: false,
          message: 'Incorrect email or password',
          error_code: 'AUTHENTICATION_REQUIRED',
          detail: 'Incorrect email or password',
        },
      },
    };

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler(mockLoginFailedError)).rejects.toMatchObject({
      status: 401,
      error_code: 'AUTHENTICATION_REQUIRED',
    });

    // CRITICAL: Failed login credentials MUST NOT trigger global session expiration
    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener('auth:unauthorized', eventSpy);
  });

  it('preserves 403 Forbidden without dispatching unauthorized logout', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('auth:unauthorized', eventSpy);

    const mock403Error = {
      response: {
        status: 403,
        data: {
          success: false,
          message: 'Permission denied for this role',
          error_code: 'FORBIDDEN',
        },
      },
    };

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler(mock403Error)).rejects.toMatchObject({
      status: 403,
      error_code: 'FORBIDDEN',
    });

    // 403 must NOT trigger global logout event
    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener('auth:unauthorized', eventSpy);
  });

  it('extracts Retry-After header on 429 Too Many Requests', async () => {
    const mock429Error = {
      response: {
        status: 429,
        headers: {
          'retry-after': '45',
        },
        data: {
          success: false,
          message: 'Too many login attempts. Please wait 45 seconds.',
          error_code: 'RATE_LIMIT_EXCEEDED',
        },
      },
    };

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler(mock429Error)).rejects.toEqual({
      success: false,
      message: 'Too many login attempts. Please wait 45 seconds.',
      error_code: 'RATE_LIMIT_EXCEEDED',
      detail: undefined,
      status: 429,
      retry_after: 45,
    });
  });

  describe('getRootUrl and Health Probe Routing', () => {
    it('strips /api/v1 prefix from the configured base URL to form root probe paths', () => {
      expect(getRootUrl('/health')).toMatch(/\/health$/);
      expect(getRootUrl('/health')).not.toContain('/api/v1/health');
      expect(getRootUrl('/')).toMatch(/\/$/);
    });

    it('healthCheckApi dispatches request to root health probe rather than /api/v1/health', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'ok', database: 'connected', service: 'CareerBridge API' },
      } as any);

      const result = await healthCheckApi();

      expect(result.status).toBe('ok');
      expect(getSpy).toHaveBeenCalledTimes(1);

      const requestedUrl = getSpy.mock.calls[0][0];
      const requestConfig = getSpy.mock.calls[0][1];

      expect(requestedUrl).toMatch(/\/health$/);
      expect(requestedUrl).not.toContain('/api/v1');
      expect(requestConfig?.baseURL).toBe('');
    });
  });
});
