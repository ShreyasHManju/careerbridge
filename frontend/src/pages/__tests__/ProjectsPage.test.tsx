import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsPage } from '../ProjectsPage';
import * as api from '@/api/innovationProjects';
import { InnovationProjectPaginationResponse } from '@/types/innovationProject';

const mockProjectsResponse: InnovationProjectPaginationResponse = {
  items: [
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
      skills: 'Python, ROS2',
      structured_skills: [
        { id: 1, name: 'Python', slug: 'python', category: 'technical', is_verified: true, created_at: '2026-09-24T00:00:00Z' },
      ],
      created_at: '2026-09-24T00:00:00Z',
      updated_at: '2026-09-24T00:00:00Z',
      owner_name: 'Jane Doe',
    },
  ],
  page: 1,
  page_size: 9,
  total: 1,
  total_pages: 1,
};

describe('ProjectsPage (Public Project Exploration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then displays public project cards', async () => {
    vi.spyOn(api, 'getProjects').mockResolvedValueOnce(mockProjectsResponse);

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('explore-loading')).toBeInTheDocument();

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();
    expect(screen.getByText('Explore Innovation Projects')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 public innovation projects/i)).toBeInTheDocument();
  });

  it('displays empty state when no projects match filters', async () => {
    vi.spyOn(api, 'getProjects').mockResolvedValueOnce({
      items: [],
      page: 1,
      page_size: 9,
      total: 0,
      total_pages: 0,
    });

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('explore-empty')).toBeInTheDocument();
    expect(screen.getByText('No Projects Found')).toBeInTheDocument();
  });

  it('dispatches search filters on form submission', async () => {
    const getProjectsSpy = vi.spyOn(api, 'getProjects').mockResolvedValue(mockProjectsResponse);

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Autonomous Drone Swarm')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search projects by title/i), {
      target: { value: 'Swarm' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => {
      expect(getProjectsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Swarm',
        })
      );
    });
  });
});
