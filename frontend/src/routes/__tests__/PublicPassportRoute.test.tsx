import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as passportApi from '@/api/passport';
import * as notificationsApi from '@/api/notifications';

describe('Public Passport Route Resolution (/p/:shareToken)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders PublicPassportPage on /p/:shareToken without requiring authentication', async () => {
    const getPublicSpy = vi.spyOn(passportApi, 'getPublicPassport').mockResolvedValueOnce({
      full_name: 'Sophia Williams',
      institution: 'Stanford University',
      major: 'Computer Science',
      degree: 'B.S.',
      graduation_year: 2026,
      bio: 'Verified student profile',
      avatar_url: null,
      contact_info: null,
      verification_summary: {
        issuer: 'CareerBridge',
        verification_status: 'VERIFIED',
        verified_at: '2026-09-01T00:00:00Z',
        verified_placements_count: 1,
        verified_projects_count: 2,
        total_verified_skills: 3,
      },
      verified_skills: [],
      experience_timeline: [],
      featured_projects: [],
    });

    render(
      <MemoryRouter initialEntries={['/p/cb_share_public_token_456']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('public-passport-page')).toBeInTheDocument();
    expect(getPublicSpy).toHaveBeenCalledWith('cb_share_public_token_456');
    expect(screen.getByTestId('public-passport-name')).toHaveTextContent('Sophia Williams');
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
