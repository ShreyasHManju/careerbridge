import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectDetailPage } from '../ProjectDetailPage';
import * as api from '@/api/innovationProjects';
import * as useAuthModule from '@/auth/useAuth';
import { InnovationProject } from '@/types/innovationProject';
import { User } from '@/types/auth';

const mockProject: InnovationProject = {
  id: 42,
  student_id: 10,
  title: 'Autonomous Drone Swarm',
  slug: 'autonomous-drone-swarm',
  short_description: 'Cooperative drone swarm mapping',
  description: 'ROS2 and PyTorch edge-based decentralized swarm controller architecture.',
  project_type: 'software',
  status: 'active',
  visibility: 'public',
  skills: 'Python, ROS2, PyTorch',
  structured_skills: [
    { id: 1, name: 'Python', slug: 'python', category: 'technical', is_verified: true, created_at: '2026-09-24T00:00:00Z' },
  ],
  repository_url: 'https://github.com/student/drone',
  live_demo_url: 'https://drone.demo.io',
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
  owner_name: 'Test Student',
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

describe('ProjectDetailPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state and then renders full project details', async () => {
    setupAuth({
      id: 10,
      email: 'student@cb.io',
      role: 'student',
      is_active: true,
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    });
    vi.spyOn(api, 'getProjectById').mockResolvedValueOnce(mockProject);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('detail-loading')).toBeInTheDocument();

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.getByText('Cooperative drone swarm mapping')).toBeInTheDocument();
    expect(screen.getByText(/ROS2 and PyTorch edge-based/i)).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete project/i })).toBeInTheDocument();
  });

  it('hides edit and delete buttons for non-owner user', async () => {
    setupAuth({
      id: 99,
      email: 'other@cb.io',
      role: 'student',
      is_active: true,
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    });
    vi.spyOn(api, 'getProjectById').mockResolvedValueOnce(mockProject);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete project/i })).not.toBeInTheDocument();
  });

  it('displays 404 / unavailable error state when project is not found', async () => {
    setupAuth({
      id: 10,
      email: 'student@cb.io',
      role: 'student',
      is_active: true,
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    });
    vi.spyOn(api, 'getProjectById').mockRejectedValueOnce({
      response: { status: 404, data: { detail: 'Project not found' } },
    });

    render(
      <MemoryRouter initialEntries={['/app/projects/999']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('detail-error')).toBeInTheDocument();
    expect(screen.getByText(/not found or you do not have permission/i)).toBeInTheDocument();
  });
});
