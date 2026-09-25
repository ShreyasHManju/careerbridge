import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../AppLayout';
import * as useAuthModule from '@/auth/useAuth';
import * as notificationsApi from '@/api/notifications';
import { User } from '@/types/auth';

const studentUser: User = {
  id: 1,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const recruiterUser: User = {
  id: 2,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const adminUser: User = {
  id: 3,
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

const setupAuthMock = (user: User | null) => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'mock-token' : null,
    isAuthenticated: Boolean(user),
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearAuthentication: vi.fn(),
    initializeSession: vi.fn(),
    clearError: vi.fn(),
  });
};

describe('AppLayout Role-Aware Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
  });

  it('renders "Experiences" link pointing to /app/experiences for student', () => {
    setupAuthMock(studentUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const expLink = screen.getByRole('link', { name: 'Experiences' });
    expect(expLink).toBeInTheDocument();
    expect(expLink).toHaveAttribute('href', '/app/experiences');

    // Student should not see recruiter/admin verification nav entries
    expect(screen.queryByRole('link', { name: 'Experience Verification' })).not.toBeInTheDocument();
  });

  it('renders "Experience Verification" link pointing to /app/recruiter/experiences/verification for recruiter', () => {
    setupAuthMock(recruiterUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const verifyLink = screen.getByRole('link', { name: 'Experience Verification' });
    expect(verifyLink).toBeInTheDocument();
    expect(verifyLink).toHaveAttribute('href', '/app/recruiter/experiences/verification');

    // Recruiter should not see student-only "Experiences" link
    expect(screen.queryByRole('link', { name: 'Experiences' })).not.toBeInTheDocument();
  });

  it('renders "Experience Verification" link pointing to /app/admin/experiences/verification for admin', () => {
    setupAuthMock(adminUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const verifyLink = screen.getByRole('link', { name: 'Experience Verification' });
    expect(verifyLink).toBeInTheDocument();
    expect(verifyLink).toHaveAttribute('href', '/app/admin/experiences/verification');

    // Admin should not see student-only "Experiences" link
    expect(screen.queryByRole('link', { name: 'Experiences' })).not.toBeInTheDocument();
  });

  it('renders "Passport" link pointing to /app/passport for student', () => {
    setupAuthMock(studentUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const passportLink = screen.getByRole('link', { name: 'Passport' });
    expect(passportLink).toBeInTheDocument();
    expect(passportLink).toHaveAttribute('href', '/app/passport');
  });

  it('does not expose student "Passport" link to recruiter or admin', () => {
    setupAuthMock(recruiterUser);

    const { unmount } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Passport' })).not.toBeInTheDocument();
    unmount();

    setupAuthMock(adminUser);
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Passport' })).not.toBeInTheDocument();
  });
});
