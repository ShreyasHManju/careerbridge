import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectMilestoneModal } from '../ProjectMilestoneModal';
import { ProjectMilestone } from '@/types/innovationProject';

const mockMilestone: ProjectMilestone = {
  id: 42,
  innovation_project_id: 1,
  title: 'Setup Database Schemas',
  description: 'Design PostgreSQL schemas and initial Alembic migrations.',
  status: 'in_progress',
  display_order: 1,
  due_date: '2026-08-15T00:00:00.000Z',
  completed_at: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

describe('ProjectMilestoneModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ProjectMilestoneModal
        isOpen={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders create mode with empty form and accessible modal attributes', () => {
    render(
      <ProjectMilestoneModal
        isOpen={true}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /Add New Milestone/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Add New Milestone/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Milestone Title/i)).toHaveValue('');
    expect(screen.getByLabelText(/Execution Status/i)).toHaveValue('todo');
    expect(screen.getByLabelText(/Display Order/i)).toHaveValue(0);
    expect(screen.getByRole('button', { name: /Add Milestone/i })).toBeInTheDocument();
  });

  it('renders edit mode prefilled with initial milestone data', () => {
    render(
      <ProjectMilestoneModal
        isOpen={true}
        initialData={mockMilestone}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /Edit Project Milestone/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Milestone Title/i)).toHaveValue('Setup Database Schemas');
    expect(screen.getByLabelText(/Deliverables & Description/i)).toHaveValue(
      'Design PostgreSQL schemas and initial Alembic migrations.'
    );
    expect(screen.getByLabelText(/Execution Status/i)).toHaveValue('in_progress');
    expect(screen.getByLabelText(/Display Order/i)).toHaveValue(1);
    expect(screen.getByLabelText(/Target Due Date/i)).toHaveValue('2026-08-15');
    expect(screen.getByRole('button', { name: /Update Milestone/i })).toBeInTheDocument();
  });

  it('validates title minimum length and requiredness', async () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectMilestoneModal
        isOpen={true}
        onSubmit={handleSubmit}
        onClose={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText(/Milestone Title/i);
    fireEvent.change(titleInput, { target: { value: 'a' } });

    const submitBtn = screen.getByRole('button', { name: /Add Milestone/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Title must be at least 2 characters long.'
    );
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('accepts past due dates as valid project execution history', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ProjectMilestoneModal
        isOpen={true}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    const titleInput = screen.getByLabelText(/Milestone Title/i);
    fireEvent.change(titleInput, { target: { value: 'Past Milestone' } });

    const dueDateInput = screen.getByLabelText(/Target Due Date/i);
    fireEvent.change(dueDateInput, { target: { value: '2020-01-01' } });

    const submitBtn = screen.getByRole('button', { name: /Add Milestone/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Past Milestone',
          due_date: new Date('2020-01-01').toISOString(),
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays API error when submission fails', async () => {
    const handleSubmit = vi.fn().mockRejectedValue({
      response: { data: { detail: 'Project milestone limit reached.' } },
    });

    render(
      <ProjectMilestoneModal
        isOpen={true}
        onSubmit={handleSubmit}
        onClose={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText(/Milestone Title/i);
    fireEvent.change(titleInput, { target: { value: 'Valid Milestone Title' } });

    const submitBtn = screen.getByRole('button', { name: /Add Milestone/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Project milestone limit reached.'
    );
  });

  it('triggers onClose when Cancel button or Close X button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ProjectMilestoneModal
        isOpen={true}
        onSubmit={vi.fn()}
        onClose={handleClose}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
