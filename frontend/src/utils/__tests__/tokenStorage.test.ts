import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from '../tokenStorage';

describe('tokenStorage utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(tokenStorage.getToken()).toBeNull();
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('correctly saves and retrieves a JWT access token', () => {
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-payload';
    tokenStorage.setToken(testToken);

    expect(tokenStorage.getToken()).toBe(testToken);
    expect(tokenStorage.hasToken()).toBe(true);
  });

  it('correctly clears the stored token', () => {
    tokenStorage.setToken('test-token');
    expect(tokenStorage.hasToken()).toBe(true);

    tokenStorage.clearToken();
    expect(tokenStorage.getToken()).toBeNull();
    expect(tokenStorage.hasToken()).toBe(false);
  });
});
