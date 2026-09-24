import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { InnovationProjectCard } from '../InnovationProjectCard';
import { InnovationProject } from '@/types/innovationProject';

const mockProject: InnovationProject = {
  id: 42,
  student_id: 10,
  title: 'Autonomous Rover Navigation',
  slug: 'autonomous-rover-navigation',
  short_description: 'Edge-computing autonomous path planner.',
  description: 'An end-to-end edge-computing navigation system built with ROS2 and PyTorch.',
  project_type: 'software',
  status: 'active',
  visibility: 'public',
  skills: 'Python, ROS2, PyTorch',
  structured_skills: [
    { id: 1, name: 'Python', slug: 'python', category: 'technical', is_verified: true, created_at: '2026-09-24T00:00:00Z' },
    { id: 2, name: 'PyTorch', slug: 'pytorch', category: 'technical', is_verified: true, created_at: '2026-09-24T00:00:00Z' },
  ],
  repository_url: 'https://github.com/student/rover',
  live_demo_url: 'https://rover.demo.app',
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
  owner_name: 'Jane Doe',
};

describe('InnovationProjectCard Component', () => {
  it('renders project metadata, badges, and author correctly', () => {
    render(
      <MemoryRouter>
        <InnovationProjectCard project={mockProject} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Autonomous Rover Navigation')).toBeInTheDocument();
    expect(screen.getByText('Edge-computing autonomous path planner.')).toBeInTheDocument();
    expect(screen.getByText('By Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders structured skills tags', () => {
    render(
      <MemoryRouter>
        <InnovationProjectCard project={mockProject} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('PyTorch')).toBeInTheDocument();
  });

  it('renders secure external repository and live demo links', () => {
    render(
      <MemoryRouter>
        <InnovationProjectCard project={mockProject} isOwner={false} />
      </MemoryRouter>
    );

    const repoLink = screen.getByTitle('View Repository');
    expect(repoLink).toHaveAttribute('href', 'https://github.com/student/rover');
    expect(repoLink).toHaveAttribute('target', '_blank');
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer');

    const demoLink = screen.getByTitle('View Live Demo');
    expect(demoLink).toHaveAttribute('href', 'https://rover.demo.app');
    expect(demoLink).toHaveAttribute('target', '_blank');
    expect(demoLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders owner actions when isOwner is true and triggers callbacks', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <MemoryRouter>
        <InnovationProjectCard
          project={mockProject}
          isOwner={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('🌐 Public')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /Edit Autonomous Rover Navigation/i });
    fireEvent.click(editBtn);
    expect(handleEdit).toHaveBeenCalledWith(mockProject);

    const deleteBtn = screen.getByRole('button', { name: /Delete Autonomous Rover Navigation/i });
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith(mockProject);
  });

  it('hides owner edit/delete actions when isOwner is false', () => {
    render(
      <MemoryRouter>
        <InnovationProjectCard project={mockProject} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });
});
