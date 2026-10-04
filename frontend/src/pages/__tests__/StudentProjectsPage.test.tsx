import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentProjectsPage } from '../StudentProjectsPage';
import * as api from '@/api/innovationProjects';
import { InnovationProject } from '@/types/innovationProject';

const mockProjects: InnovationProject[] = [
  {
    id: 1,
    student_id: 10,
    title: 'Autonomous Drone Swarm',
    slug: 'autonomous-drone-swarm',
    short_description: 'Cooperative drone swarm mapping',
    description: 'ROS2 and PyTorch edge-based decentralized swarm controller.',
    project_type: 'software',
    status: 'active',
    visibility: 'public',
    skills: 'Python, ROS2, PyTorch',
    structured_skills: [
      { id: 1, name: 'Python', slug: 'python', category: 'technical', is_verified: true, created_at: '2026-09-24T00:00:00Z' },
    ],
    repository_url: 'https://github.com/student/drone',
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
  {
    id: 2,
    student_id: 10,
    title: 'FPGA Accelerator',
    slug: 'fpga-accelerator',
    description: 'Hardware matrix multiplier in Verilog.',
    project_type: 'hardware',
    status: 'draft',
    visibility: 'private',
    skills: 'Verilog',
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
];

describe('StudentProjectsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state initially and then renders project cards', async () => {
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce(mockProjects);

    render(
      <MemoryRouter>
        <StudentProjectsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.getByText('FPGA Accelerator')).toBeInTheDocument();
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
  });

  it('displays error state on API failure and retries on button click', async () => {
    vi.spyOn(api, 'getMyProjects')
      .mockRejectedValueOnce(new Error('Network error loading projects'))
      .mockResolvedValueOnce(mockProjects);

    render(
      <MemoryRouter>
        <StudentProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText(/Network error loading projects/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
  });

  it('displays empty state when student has no projects', async () => {
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <StudentProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/You have not created any projects yet/i)).toBeInTheDocument();
  });

  it('opens Create Project modal and adds newly published project to list', async () => {
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce(mockProjects);
    const newProject: InnovationProject = {
      id: 3,
      student_id: 10,
      title: 'Brain-Computer Interface',
      slug: 'brain-computer-interface',
      description: 'EEG signal processor and classifier with TensorFlow.',
      project_type: 'research',
      status: 'active',
      visibility: 'public',
      skills: 'TensorFlow, Python',
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
    };
    const createSpy = vi.spyOn(api, 'createProject').mockResolvedValueOnce(newProject);

    render(
      <MemoryRouter>
        <StudentProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ New Project/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Project Title/i), { target: { value: 'Brain-Computer Interface' } });
    fireEvent.change(screen.getByLabelText(/Detailed Description/i), {
      target: { value: 'EEG signal processor and classifier with TensorFlow.' },
    });
    fireEvent.change(screen.getByLabelText(/Project Category/i), { target: { value: 'research' } });

    fireEvent.click(screen.getByRole('button', { name: /Publish Project/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Brain-Computer Interface')).toBeInTheDocument();
      expect(screen.getByText(/published successfully/i)).toBeInTheDocument();
    });
  });

  it('opens Delete confirmation modal and removes deleted project from list', async () => {
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce(mockProjects);
    const deleteSpy = vi.spyOn(api, 'deleteProject').mockResolvedValueOnce();

    render(
      <MemoryRouter>
        <StudentProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /Delete Autonomous Drone Swarm/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Delete Project/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Autonomous Drone Swarm')).not.toBeInTheDocument();
      expect(screen.getByText(/has been deleted/i)).toBeInTheDocument();
    });
  });

  it('filters projects by status tabs', async () => {
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce(mockProjects);

    render(
      <MemoryRouter>
        <StudentProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.getByText('FPGA Accelerator')).toBeInTheDocument();

    // Click Drafts tab
    fireEvent.click(screen.getByRole('button', { name: /Drafts/i }));
    expect(screen.getByText('FPGA Accelerator')).toBeInTheDocument();
    expect(screen.queryByText('Autonomous Drone Swarm')).not.toBeInTheDocument();

    // Click Active tab
    fireEvent.click(screen.getByRole('button', { name: /Active/i }));
    expect(screen.getByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.queryByText('FPGA Accelerator')).not.toBeInTheDocument();
  });

  it('automatically opens project creator modal and pre-populates skills, title, and description when navigated from skill-gap CTA', async () => {
    vi.spyOn(api, 'getMyProjects').mockResolvedValueOnce(mockProjects);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/app/student/projects',
            state: {
              openCreateModal: true,
              prefilledSkills: 'Python, FastAPI',
              jobTitle: 'Backend Developer',
            },
          },
        ]}
      >
        <StudentProjectsPage />
      </MemoryRouter>
    );

    // 1. Modal opens automatically
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Create Innovation Project')).toBeInTheDocument();

    // 2. Pre-populated skills in SkillTagInput inside the dialog
    expect(within(dialog).getByText('Python')).toBeInTheDocument();
    expect(within(dialog).getByText('FastAPI')).toBeInTheDocument();

    // 3. Pre-populated title scaffolding
    const titleInput = screen.getByLabelText(/Project Title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Project demonstrating Python, FastAPI for Backend Developer');

    // 4. Pre-populated description scaffolding
    const descInput = screen.getByLabelText(/Detailed Description/i) as HTMLTextAreaElement;
    expect(descInput.value).toContain(
      'Targeted innovation project designed to demonstrate competencies in Python, FastAPI for the Backend Developer role.'
    );

    // 5. User can edit pre-populated values
    fireEvent.change(titleInput, { target: { value: 'Custom Microservice Gateway' } });
    expect(titleInput.value).toBe('Custom Microservice Gateway');

    fireEvent.change(descInput, { target: { value: 'Custom detailed description of the microservice.' } });
    expect(descInput.value).toBe('Custom detailed description of the microservice.');
  });
});
