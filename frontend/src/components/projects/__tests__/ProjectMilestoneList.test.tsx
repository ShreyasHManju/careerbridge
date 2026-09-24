import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectMilestoneList } from '../ProjectMilestoneList';
import { ProjectMilestone } from '@/types/innovationProject';

const mockMilestones: ProjectMilestone[] = [
  {
    id: 1,
    innovation_project_id: 10,
    title: 'Phase 2: Simulation Environment',
    description: 'Setup Gazebo world and ROS2 bridge nodes.',
    status: 'in_progress',
    display_order: 2,
    due_date: '2026-11-01T00:00:00Z',
    completed_at: null,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
  {
    id: 2,
    innovation_project_id: 10,
    title: 'Phase 1: Hardware Specifications',
    description: 'Select drone motors, ESCs, and flight controller.',
    status: 'completed',
    display_order: 1,
    due_date: '2026-10-01T00:00:00Z',
    completed_at: '2026-09-24T00:00:00Z',
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
  {
    id: 3,
    innovation_project_id: 10,
    title: 'Phase 3: Field Deployment',
    description: null,
    status: 'todo',
    display_order: 3,
    due_date: null,
    completed_at: null,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
];

describe('ProjectMilestoneList Component', () => {
  it('renders empty state for owner with add button', () => {
    const handleAdd = vi.fn();
    render(
      <ProjectMilestoneList
        milestones={[]}
        isOwner={true}
        onAddMilestone={handleAdd}
      />
    );

    expect(screen.getByTestId('milestones-empty')).toBeInTheDocument();
    expect(screen.getByText(/Define measurable execution steps/i)).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /Add first milestone/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });

  it('renders empty state for viewer without add button', () => {
    render(<ProjectMilestoneList milestones={[]} isOwner={false} />);
    expect(screen.getByTestId('milestones-empty')).toBeInTheDocument();
    expect(screen.getByText(/No execution milestones have been published/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add first milestone/i })).not.toBeInTheDocument();
  });

  it('sorts milestones by display_order ascending', () => {
    render(<ProjectMilestoneList milestones={mockMilestones} isOwner={false} />);

    const titles = screen.getAllByRole('heading', { level: 4 });
    expect(titles[0]).toHaveTextContent('Phase 1: Hardware Specifications');
    expect(titles[1]).toHaveTextContent('Phase 2: Simulation Environment');
    expect(titles[2]).toHaveTextContent('Phase 3: Field Deployment');
  });

  it('renders optional fields (description, due date, completed_at) properly when present and hides when absent', () => {
    render(<ProjectMilestoneList milestones={mockMilestones} isOwner={false} />);

    expect(screen.getByText('Select drone motors, ESCs, and flight controller.')).toBeInTheDocument();
    expect(screen.getByText(/Completed:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Due:/i)).toHaveLength(2);

    const item3 = screen.getByTestId('milestone-item-3');
    expect(item3.querySelector('.cb-milestone-desc')).toBeNull();
    expect(item3.querySelector('.cb-milestone-due')).toBeNull();
    expect(item3.querySelector('.cb-milestone-completed-at')).toBeNull();
  });

  it('renders owner actions and triggers action callbacks', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();
    const handleToggle = vi.fn();

    render(
      <ProjectMilestoneList
        milestones={mockMilestones}
        isOwner={true}
        onEditMilestone={handleEdit}
        onDeleteMilestone={handleDelete}
        onToggleStatus={handleToggle}
      />
    );

    const editBtns = screen.getAllByRole('button', { name: /Edit /i });
    expect(editBtns.length).toBe(3);
    fireEvent.click(editBtns[0]);
    expect(handleEdit).toHaveBeenCalledWith(mockMilestones[1]); // sorted index 0 is mockMilestones[1]

    const deleteBtns = screen.getAllByRole('button', { name: /Delete /i });
    expect(deleteBtns.length).toBe(3);
    fireEvent.click(deleteBtns[0]);
    expect(handleDelete).toHaveBeenCalledWith(mockMilestones[1]);

    const reopenBtn = screen.getByRole('button', { name: /Mark Phase 1: Hardware Specifications as in progress/i });
    fireEvent.click(reopenBtn);
    expect(handleToggle).toHaveBeenCalledWith(mockMilestones[1], 'in_progress');

    const completeBtn = screen.getByRole('button', { name: /Mark Phase 2: Simulation Environment as completed/i });
    fireEvent.click(completeBtn);
    expect(handleToggle).toHaveBeenCalledWith(mockMilestones[0], 'completed');
  });

  it('hides owner action buttons for non-owner viewers', () => {
    render(<ProjectMilestoneList milestones={mockMilestones} isOwner={false} />);

    expect(screen.queryByRole('button', { name: /Edit /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark /i })).not.toBeInTheDocument();
  });
});
