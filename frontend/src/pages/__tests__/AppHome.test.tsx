import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppHome } from '../AppHome';
import * as useAuthModule from '@/auth/useAuth';
import * as dashboardsApi from '@/api/dashboards';
import { User } from '@/types/auth';

const mockStudentUser: User = {
  id: 1,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 2,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockAdminUser: User = {
  id: 3,
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

function setupAuth(user: User | null, isLoading = false) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'valid-token' : null,
    isAuthenticated: !!user,
    isLoading,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearAuthentication: vi.fn(),
    initializeSession: vi.fn(),
    clearError: vi.fn(),
  });
}

describe('AppHome Role-Based Dashboard Landing (Phase 22)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state while authentication session is resolving', () => {
    setupAuth(null, true);

    render(
      <MemoryRouter>
        <AppHome />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading your dashboard.../i)).toBeInTheDocument();
  });

  it('renders StudentDashboardView for authenticated student users', async () => {
    setupAuth(mockStudentUser);
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockResolvedValue({
      total_applications: 5,
      applications_under_review: 2,
      shortlisted_applications: 1,
      accepted_applications: 0,
      saved_internships: 3,
      upcoming_interviews: 1,
    });

    render(
      <MemoryRouter>
        <AppHome />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /Student Dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('5');
  });

  it('renders RecruiterDashboardView for authenticated recruiter users', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockResolvedValue({
      active_internships: 3,
      total_applications: 20,
      applications_awaiting_review: 8,
      shortlisted_candidates: 4,
      scheduled_interviews: 2,
    });

    render(
      <MemoryRouter>
        <AppHome />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /Recruiter Dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId('metric-active-internships')).toHaveTextContent('3');
    expect(screen.getByTestId('metric-applications-awaiting-review')).toHaveTextContent('8');
  });

  it('renders AdminDashboardView for authenticated administrator users', async () => {
    setupAuth(mockAdminUser);
    vi.spyOn(dashboardsApi, 'getAdminDashboard').mockResolvedValue({
      total_students: 100,
      total_companies: 20,
      verified_companies: 15,
      published_internships: 25,
      total_applications: 250,
      application_success_rate: 15.0,
      monthly_registrations: [{ month: '2026-09', count: 50 }],
    });

    render(
      <MemoryRouter>
        <AppHome />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /Administrative Platform Dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId('metric-total-students')).toHaveTextContent('100');
    expect(screen.getByTestId('metric-application-success-rate')).toHaveTextContent('15.0%');
  });
});
