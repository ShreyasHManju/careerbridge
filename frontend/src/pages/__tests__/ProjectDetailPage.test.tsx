import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectDetailPage } from '../ProjectDetailPage';
import * as api from '@/api/innovationProjects';
import * as useAuthModule from '@/auth/useAuth';
import {
  InnovationProject,
  ProjectMilestoneListResponse,
} from '@/types/innovationProject';
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

const mockMilestonesListResponse: ProjectMilestoneListResponse = {
  items: [
    {
      id: 101,
      innovation_project_id: 42,
      title: 'Phase 1: Hardware Specifications',
      description: 'Select drone motors and flight controller.',
      status: 'completed',
      display_order: 1,
      due_date: '2026-10-01T00:00:00Z',
      completed_at: '2026-09-24T00:00:00Z',
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    },
    {
      id: 102,
      innovation_project_id: 42,
      title: 'Phase 2: Simulation Environment',
      description: 'Gazebo setup and node bridge.',
      status: 'in_progress',
      display_order: 2,
      due_date: '2026-11-01T00:00:00Z',
      completed_at: null,
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    },
  ],
  total: 2,
  completed: 1,
  progress_percentage: 50,
};

const emptyMilestonesResponse: ProjectMilestoneListResponse = {
  items: [],
  total: 0,
  completed: 0,
  progress_percentage: 0,
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

describe('ProjectDetailPage Integration (Milestone 2.0-C Phase 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state and then renders full project details with milestones and progress', async () => {
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
    vi.spyOn(api, 'getProjectMilestones').mockResolvedValueOnce(mockMilestonesListResponse);

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

    // Verify milestone progress and items
    expect(await screen.findByText('Execution Milestones & Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('(1 of 2 completed)')).toBeInTheDocument();
    expect(screen.getByText('Phase 1: Hardware Specifications')).toBeInTheDocument();
    expect(screen.getByText('Phase 2: Simulation Environment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add Milestone$/i })).toBeInTheDocument();
  });

  it('renders clean empty state when project has 0 milestones', async () => {
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
    vi.spyOn(api, 'getProjectMilestones').mockResolvedValueOnce(emptyMilestonesResponse);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(await screen.findByTestId('milestones-empty')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('(0 of 0 completed)')).toBeInTheDocument();
  });

  it('renders milestone loading error and allows retry', async () => {
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
    vi.spyOn(api, 'getProjectMilestones')
      .mockRejectedValueOnce(new Error('Network error loading milestones'))
      .mockResolvedValueOnce(mockMilestonesListResponse);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(await screen.findByTestId('milestones-error')).toBeInTheDocument();
    expect(screen.getByText(/Network error loading milestones/i)).toBeInTheDocument();

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /Retry Loading Milestones/i }));

    expect(await screen.findByText('Phase 1: Hardware Specifications')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('hides owner milestone actions and Add Milestone button for non-owner viewers', async () => {
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
    vi.spyOn(api, 'getProjectMilestones').mockResolvedValueOnce(mockMilestonesListResponse);

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(await screen.findByText('Phase 1: Hardware Specifications')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /^Add Milestone$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('allows owner to open modal and create a new milestone', async () => {
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
    vi.spyOn(api, 'getProjectMilestones')
      .mockResolvedValueOnce(emptyMilestonesResponse)
      .mockResolvedValueOnce({
        items: [
          {
            id: 103,
            innovation_project_id: 42,
            title: 'Phase 1: Architecture Plan',
            description: 'Define nodes and topics',
            status: 'todo',
            display_order: 1,
            due_date: '2026-10-20T00:00:00Z',
            completed_at: null,
            created_at: '2026-09-24T00:00:00Z',
            updated_at: '2026-09-24T00:00:00Z',
          },
        ],
        total: 1,
        completed: 0,
        progress_percentage: 0,
      });

    const createSpy = vi.spyOn(api, 'createProjectMilestone').mockResolvedValueOnce({
      id: 103,
      innovation_project_id: 42,
      title: 'Phase 1: Architecture Plan',
      description: 'Define nodes and topics',
      status: 'todo',
      display_order: 1,
      due_date: '2026-10-20T00:00:00Z',
      completed_at: null,
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    });

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /^Add Milestone$/i });
    fireEvent.click(addBtn);

    const modal = screen.getByRole('dialog', { name: /Add New Milestone/i });
    expect(modal).toBeInTheDocument();

    fireEvent.change(within(modal).getByLabelText(/Milestone Title/i), {
      target: { value: 'Phase 1: Architecture Plan' },
    });
    fireEvent.change(within(modal).getByLabelText(/Deliverables & Description/i), {
      target: { value: 'Define nodes and topics' },
    });

    fireEvent.click(within(modal).getByRole('button', { name: /^Add Milestone$/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          title: 'Phase 1: Architecture Plan',
          description: 'Define nodes and topics',
        })
      );
      expect(screen.getByText('Phase 1: Architecture Plan')).toBeInTheDocument();
    });
  });

  it('allows owner to edit an existing milestone', async () => {
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
    vi.spyOn(api, 'getProjectMilestones')
      .mockResolvedValueOnce(mockMilestonesListResponse)
      .mockResolvedValueOnce({
        ...mockMilestonesListResponse,
        items: [
          mockMilestonesListResponse.items[0],
          {
            ...mockMilestonesListResponse.items[1],
            title: 'Phase 2: Advanced Gazebo Simulation',
          },
        ],
      });

    const updateSpy = vi.spyOn(api, 'updateProjectMilestone').mockResolvedValueOnce({
      ...mockMilestonesListResponse.items[1],
      title: 'Phase 2: Advanced Gazebo Simulation',
    });

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Phase 2: Simulation Environment')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /Edit Phase 2: Simulation Environment/i });
    fireEvent.click(editBtn);

    expect(screen.getByRole('dialog', { name: /Edit Project Milestone/i })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Milestone Title/i);
    expect(titleInput).toHaveValue('Phase 2: Simulation Environment');

    fireEvent.change(titleInput, { target: { value: 'Phase 2: Advanced Gazebo Simulation' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Milestone/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        42,
        102,
        expect.objectContaining({
          title: 'Phase 2: Advanced Gazebo Simulation',
        })
      );
      expect(screen.getByText('Phase 2: Advanced Gazebo Simulation')).toBeInTheDocument();
    });
  });

  it('allows owner to toggle milestone completion status', async () => {
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
    vi.spyOn(api, 'getProjectMilestones')
      .mockResolvedValueOnce(mockMilestonesListResponse)
      .mockResolvedValueOnce({
        items: [
          mockMilestonesListResponse.items[0],
          {
            ...mockMilestonesListResponse.items[1],
            status: 'completed',
            completed_at: '2026-09-24T12:00:00Z',
          },
        ],
        total: 2,
        completed: 2,
        progress_percentage: 100,
      });

    const updateSpy = vi.spyOn(api, 'updateProjectMilestone').mockResolvedValueOnce({
      ...mockMilestonesListResponse.items[1],
      status: 'completed',
      completed_at: '2026-09-24T12:00:00Z',
    });

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Phase 2: Simulation Environment')).toBeInTheDocument();

    const completeBtn = screen.getByRole('button', {
      name: /Mark Phase 2: Simulation Environment as completed/i,
    });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(42, 102, { status: 'completed' });
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('(2 of 2 completed)')).toBeInTheDocument();
    });
  });

  it('allows owner to delete a milestone via confirmation dialog and cancellation preserves milestone', async () => {
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
    vi.spyOn(api, 'getProjectMilestones')
      .mockResolvedValueOnce(mockMilestonesListResponse)
      .mockResolvedValueOnce({
        items: [mockMilestonesListResponse.items[0]],
        total: 1,
        completed: 1,
        progress_percentage: 100,
      });

    const deleteSpy = vi.spyOn(api, 'deleteProjectMilestone').mockResolvedValueOnce();

    render(
      <MemoryRouter initialEntries={['/app/projects/42']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Phase 2: Simulation Environment')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', {
      name: /Delete Phase 2: Simulation Environment/i,
    });
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete milestone/i)
    ).toBeInTheDocument();

    // Test cancellation
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();

    // Reopen and confirm deletion
    fireEvent.click(deleteBtn);
    const confirmDeleteBtn = screen.getByRole('button', { name: /Delete Milestone/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(42, 102);
      expect(screen.queryByText('Phase 2: Simulation Environment')).not.toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('(1 of 1 completed)')).toBeInTheDocument();
    });
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
