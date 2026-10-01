import '@testing-library/jest-dom';
import React from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock @react-oauth/google globally for tests
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError, text }: { onSuccess: (res: { credential?: string }) => void; onError?: () => void; text?: string }) => {
    return React.createElement(
      'div',
      { 'data-testid': 'google-login-container' },
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSuccess({ credential: 'mock-google-id-token-xyz' }),
          'data-testid': 'google-login-button',
        },
        text === 'continue_with' ? 'Continue with Google' : 'Sign in with Google'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onError && onError(),
          'data-testid': 'google-error-trigger',
        },
        'Trigger Google Error'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSuccess({ credential: undefined }),
          'data-testid': 'google-empty-credential-trigger',
        },
        'Trigger Empty Credential'
      )
    );
  },
  useGoogleLogin: vi.fn(),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Automatically clean up DOM after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
