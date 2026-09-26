import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import * as useAuthModule from '@/auth/useAuth';
import * as api from '@/api/innovationProjects';
import { User } from '@/types/auth';
import { InnovationProject, InnovationProjectPaginationResponse } from '@/types/innovationProject';

const mockStudentUser: User = {
  id: 10,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 20,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockProject: InnovationProject = {
  id: 42,
  student_id: 10,
  title: 'Autonomous Drone Swarm',
  slug: 'autonomous-drone-swarm',
  short_description: 'Cooperative drone swarm mapping',
  description: 'ROS2 and PyTorch edge-based decentralized swarm controller.',
  project_type: 'software',
  status: 'active',
  visibility: 'public',
  skills: 'Python, ROS2',
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
  owner_name: 'Test Student',
};

const mockPagination: InnovationProjectPaginationResponse = {
  items: [mockProject],
  page: 1,
  page_size: 10,
  total: 1,
  total_pages: 1,
};

function setupAuth(user: User | null) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'valid-token' : null,
    isAuthenticated: !!user,
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

describe('Project Routing & Role-Based Access (Phase 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves student projects page for authenticated student on /app/projects', async () => {
    setupAuth(mockStudentUser);
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce([mockProject]);

    render(
      <MemoryRouter initialEntries={['/app/projects']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('Autonomous Drone Swarm')).toBeInTheDocument();
  });

  it('blocks non-student (recruiter) from accessing student-only /app/projects with 403 Forbidden', () => {
    setupAuth(mockRecruiterUser);

    render(
      <MemoryRouter initialEntries={['/app/projects']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/403 — Access Denied/i)).toBeInTheDocument();
    expect(screen.getByText(/Your account \(recruiter\) does not have permission/i)).toBeInTheDocument();
  });

  it('resolves project exploration for all authenticated roles on /app/explore-projects', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(api, 'getProjects').mockResolvedValueOnce(mockPagination);

    render(
      <MemoryRouter initialEntries={['/app/explore-projects']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText('Explore Innovation Projects')).toBeInTheDocument();
    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
  });

  it('resolves project detail page for all authenticated roles on /app/projects/:projectId', async () => {
    setupAuth(mockRecruiterUser);
    vi.spyOn(api, 'getProjectById').mockResolvedValueOnce(mockProject);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.getByText('Cooperative drone swarm mapping')).toBeInTheDocument();
  });

  it('redirects unauthenticated visitor attempting to access project route to /login', () => {
    setupAuth(null);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to your CareerBridge account/i)).toBeInTheDocument();
  });
});
