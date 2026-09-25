import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as experiencesApi from '@/api/experiences';
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

describe('Verified Experience Routing and Role Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValue({ items: [], total: 0 });
  });

  describe('/app/experiences (Student Route)', () => {
    it('allows student access to /app/experiences', () => {
      setupAuthMock(studentUser);

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('student-experiences-page')).toBeInTheDocument();
      expect(screen.queryByText(/403 — Access Denied/i)).not.toBeInTheDocument();
    });

    it('denies recruiter access to /app/experiences with 403', () => {
      setupAuthMock(recruiterUser);

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
      expect(screen.queryByTestId('student-experiences-page')).not.toBeInTheDocument();
    });

    it('denies admin access to /app/experiences with 403', () => {
      setupAuthMock(adminUser);

      render(
        <MemoryRouter initialEntries={['/app/experiences']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
      expect(screen.queryByTestId('student-experiences-page')).not.toBeInTheDocument();
    });
  });

  describe('/app/recruiter/experiences/verification (Recruiter Route)', () => {
    it('allows recruiter access to /app/recruiter/experiences/verification', () => {
      setupAuthMock(recruiterUser);

      render(
        <MemoryRouter initialEntries={['/app/recruiter/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('recruiter-verification-page')).toBeInTheDocument();
      expect(screen.queryByText(/403 — Access Denied/i)).not.toBeInTheDocument();
    });

    it('denies student access to /app/recruiter/experiences/verification with 403', () => {
      setupAuthMock(studentUser);

      render(
        <MemoryRouter initialEntries={['/app/recruiter/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
      expect(screen.queryByTestId('recruiter-verification-page')).not.toBeInTheDocument();
    });
  });

  describe('/app/admin/experiences/verification (Admin Route)', () => {
    it('allows admin access to /app/admin/experiences/verification', () => {
      setupAuthMock(adminUser);

      render(
        <MemoryRouter initialEntries={['/app/admin/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('admin-experience-verification-page')).toBeInTheDocument();
      expect(screen.queryByText(/403 — Access Denied/i)).not.toBeInTheDocument();
    });

    it('denies student access to /app/admin/experiences/verification with 403', () => {
      setupAuthMock(studentUser);

      render(
        <MemoryRouter initialEntries={['/app/admin/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
      expect(screen.queryByTestId('admin-experience-verification-page')).not.toBeInTheDocument();
    });

    it('denies recruiter access to /app/admin/experiences/verification with 403', () => {
      setupAuthMock(recruiterUser);

      render(
        <MemoryRouter initialEntries={['/app/admin/experiences/verification']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
      expect(screen.queryByTestId('admin-experience-verification-page')).not.toBeInTheDocument();
    });
  });
});
