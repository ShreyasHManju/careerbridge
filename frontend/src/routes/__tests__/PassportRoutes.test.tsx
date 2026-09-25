import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as passportApi from '@/api/passport';
import * as notificationsApi from '@/api/notifications';
import { User } from '@/types/auth';
import { PassportResponse } from '@/types/passport';

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

const mockPassport: PassportResponse = {
  identity: {
    user_id: 1,
    email: 'student@example.com',
    full_name: 'Alex Morgan',
    college: 'MIT',
    degree: 'B.S.',
    branch: 'CS',
    graduation_year: 2026,
    bio: 'Software engineer.',
    github_url: null,
    linkedin_url: null,
    portfolio_url: null,
    profile_image_url: null,
    is_verified: true,
    created_at: '2026-09-20T00:00:00Z',
  },
  summary: {
    verified_experiences_count: 1,
    public_projects_count: 1,
    canonical_skills_count: 1,
    completed_milestones_count: 1,
  },
  verified_experiences: [],
  projects: [],
  skills: [],
  milestones: [],
  resume: null,
  is_owner: true,
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

describe('Experience Passport Routing and Role Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
    vi.spyOn(passportApi, 'getMyPassport').mockResolvedValue(mockPassport);
    vi.spyOn(passportApi, 'getStudentPassport').mockResolvedValue({
      ...mockPassport,
      is_owner: false,
    });
  });

  describe('/app/passport (Student Owner Route)', () => {
    it('allows authenticated student to access /app/passport and calls getMyPassport()', async () => {
      setupAuthMock(studentUser);
      const getMySpy = vi.spyOn(passportApi, 'getMyPassport');
      const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport');

      render(
        <MemoryRouter initialEntries={['/app/passport']}>
          <App />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
      expect(getMySpy).toHaveBeenCalledTimes(1);
      expect(getStudentSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId('passport-owner-badge')).toHaveTextContent('Your Passport');
    });

    it('denies recruiter from accessing student-only /app/passport and redirects to /app', () => {
      setupAuthMock(recruiterUser);

      render(
        <MemoryRouter initialEntries={['/app/passport']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('passport-page')).not.toBeInTheDocument();
    });

    it('denies unauthenticated user and redirects to /login', () => {
      setupAuthMock(null);

      render(
        <MemoryRouter initialEntries={['/app/passport']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('passport-page')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  describe('/app/recruiter/passport/:studentId (Recruiter Route)', () => {
    it('allows recruiter to view student passport at /app/recruiter/passport/123 and calls getStudentPassport(123)', async () => {
      setupAuthMock(recruiterUser);
      const getMySpy = vi.spyOn(passportApi, 'getMyPassport');
      const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport');

      render(
        <MemoryRouter initialEntries={['/app/recruiter/passport/123']}>
          <App />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
      expect(getStudentSpy).toHaveBeenCalledTimes(1);
      expect(getStudentSpy).toHaveBeenCalledWith(123);
      expect(getMySpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId('passport-owner-badge')).not.toBeInTheDocument();
    });

    it('denies student from accessing recruiter route /app/recruiter/passport/1 and redirects to /app', () => {
      setupAuthMock(studentUser);

      render(
        <MemoryRouter initialEntries={['/app/recruiter/passport/1']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('passport-page')).not.toBeInTheDocument();
    });
  });

  describe('/app/passport/:studentId (Authenticated Read-Only Route)', () => {
    it('allows authenticated student to view candidate passport at /app/passport/456 and calls getStudentPassport(456)', async () => {
      setupAuthMock(studentUser);
      const getMySpy = vi.spyOn(passportApi, 'getMyPassport');
      const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport');

      render(
        <MemoryRouter initialEntries={['/app/passport/456']}>
          <App />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
      expect(getStudentSpy).toHaveBeenCalledTimes(1);
      expect(getStudentSpy).toHaveBeenCalledWith(456);
      expect(getMySpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId('passport-owner-badge')).not.toBeInTheDocument();
    });

    it('allows admin to view candidate passport at /app/passport/789 and calls getStudentPassport(789)', async () => {
      setupAuthMock(adminUser);
      const getStudentSpy = vi.spyOn(passportApi, 'getStudentPassport');

      render(
        <MemoryRouter initialEntries={['/app/passport/789']}>
          <App />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('passport-page')).toBeInTheDocument();
      expect(getStudentSpy).toHaveBeenCalledWith(789);
    });

    it('displays error message and supports retry when candidate passport fetch fails', async () => {
      setupAuthMock(recruiterUser);
      const getStudentSpy = vi
        .spyOn(passportApi, 'getStudentPassport')
        .mockRejectedValueOnce({ message: 'Candidate student not found.' })
        .mockResolvedValueOnce({ ...mockPassport, is_owner: false });

      render(
        <MemoryRouter initialEntries={['/app/recruiter/passport/999']}>
          <App />
        </MemoryRouter>
      );

      expect(await screen.findByTestId('passport-error')).toBeInTheDocument();
      expect(screen.getByText('Candidate student not found.')).toBeInTheDocument();

      // Click Retry
      const retryButton = screen.getByTestId('passport-retry-button');
      fireEvent.click(retryButton);

      expect(await screen.findByTestId('passport-content')).toBeInTheDocument();
      expect(getStudentSpy).toHaveBeenCalledTimes(2);
      expect(getStudentSpy).toHaveBeenCalledWith(999);
    });
  });
});
