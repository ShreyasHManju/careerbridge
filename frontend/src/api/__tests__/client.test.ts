import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
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

  it('dispatches auth:unauthorized event on 401 without attempting refresh token', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('auth:unauthorized', eventSpy);

    const mock401Error = {
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
});
