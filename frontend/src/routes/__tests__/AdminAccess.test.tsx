import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as adminApi from '@/api/admin';
import { User } from '@/types/auth';

vi.mock('@/api/admin');

const mockAdminUser: User = {
  id: 1,
  email: 'admin@careerbridge.io',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockStudentUser: User = {
  id: 2,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 3,
  email: 'recruiter@company.com',
  role: 'recruiter',
  is_active: true,
  is_verified: false,
  created_at: '2026-09-03T10:00:00Z',
  updated_at: '2026-09-03T10:00:00Z',
};

function setupAuthMock(user: User | null) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'fake-token' : null,
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
}

describe('Admin Routes & Navigation Access Control (Phase F-11)', () => {
  it('allows administrator to access /app/admin/users and renders navigation', async () => {
    setupAuthMock(mockAdminUser);
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 0,
    });

    render(
      <MemoryRouter initialEntries={['/app/admin/users']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('User Account Administration')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recruiter Verification' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Job Moderation' })).toBeInTheDocument();
  });

  it('allows administrator to access /app/admin/recruiters', async () => {
    setupAuthMock(mockAdminUser);
    vi.spyOn(adminApi, 'getAdminRecruiters').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 0,
    });

    render(
      <MemoryRouter initialEntries={['/app/admin/recruiters']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Recruiter Organization Verification')).toBeInTheDocument();
  });

  it('allows administrator to access /app/admin/jobs', async () => {
    setupAuthMock(mockAdminUser);
    vi.spyOn(adminApi, 'getAdminJobs').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 0,
    });

    render(
      <MemoryRouter initialEntries={['/app/admin/jobs']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Job & Internship Moderation')).toBeInTheDocument();
  });

  it('blocks student from accessing /app/admin/users and hides admin navigation links', () => {
    setupAuthMock(mockStudentUser);

    render(
      <MemoryRouter initialEntries={['/app/admin/users']}>
        <App />
      </MemoryRouter>
    );

    // Should redirect to /app and NOT show Admin page
    expect(screen.queryByText('User Account Administration')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'User Management' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Recruiter Verification' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Job Moderation' })).not.toBeInTheDocument();
  });

  it('blocks recruiter from accessing /app/admin/jobs', () => {
    setupAuthMock(mockRecruiterUser);

    render(
      <MemoryRouter initialEntries={['/app/admin/jobs']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText('Job & Internship Moderation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Job Moderation' })).not.toBeInTheDocument();
  });
});
