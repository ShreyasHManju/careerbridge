import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectEvidenceModal } from '../ProjectEvidenceModal';
import { ProjectEvidence, ProjectMilestone } from '@/types/innovationProject';

const mockMilestones: ProjectMilestone[] = [
  {
    id: 101,
    innovation_project_id: 1,
    title: 'Milestone Alpha',
    status: 'completed',
    display_order: 1,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
];

const mockExistingEvidence: ProjectEvidence = {
  id: 42,
  innovation_project_id: 1,
  milestone_id: 101,
  title: 'Existing Demo',
  description: 'A walkthrough video recording',
  evidence_type: 'video',
  url: 'https://youtube.com/watch?v=12345',
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
};

describe('ProjectEvidenceModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ProjectEvidenceModal
        isOpen={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders in create mode with empty fields', () => {
    render(
      <ProjectEvidenceModal
        isOpen={true}
        milestones={mockMilestones}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Attach Evidence Artifact/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Evidence Title/i)).toHaveValue('');
    expect(screen.getByLabelText(/Artifact URL/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /Attach Evidence/i })).toBeInTheDocument();
  });

  it('renders in edit mode prefilled with initialData', () => {
    render(
      <ProjectEvidenceModal
        isOpen={true}
        initialData={mockExistingEvidence}
        milestones={mockMilestones}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Edit Evidence Artifact/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Evidence Title/i)).toHaveValue('Existing Demo');
    expect(screen.getByLabelText(/Artifact URL/i)).toHaveValue('https://youtube.com/watch?v=12345');
    expect(screen.getByLabelText(/Artifact Category/i)).toHaveValue('video');
    expect(screen.getByLabelText(/Attach to Milestone/i)).toHaveValue('101');
    expect(screen.getByRole('button', { name: /Update Artifact/i })).toBeInTheDocument();
  });

  it('validates required fields and shows error on invalid input', async () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectEvidenceModal
        isOpen={true}
        onSubmit={handleSubmit}
        onClose={vi.fn()}
      />
    );

    // Enter single char title
    fireEvent.change(screen.getByLabelText(/Evidence Title/i), {
      target: { value: 'A' },
    });
    fireEvent.change(screen.getByLabelText(/Artifact URL/i), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Attach Evidence/i }));

    expect(await screen.findByText(/Title must be at least 2 characters long/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();

    // Invalid URL format (missing scheme)
    fireEvent.change(screen.getByLabelText(/Evidence Title/i), {
      target: { value: 'Valid Title' },
    });
    fireEvent.change(screen.getByLabelText(/Artifact URL/i), {
      target: { value: 'not-a-valid-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Attach Evidence/i }));

    expect(await screen.findByText(/URL must start with a valid URI scheme/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits valid payload and triggers onClose', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ProjectEvidenceModal
        isOpen={true}
        milestones={mockMilestones}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    fireEvent.change(screen.getByLabelText(/Evidence Title/i), {
      target: { value: 'Live Cloud Demo' },
    });
    fireEvent.change(screen.getByLabelText(/Artifact Category/i), {
      target: { value: 'demo' },
    });
    fireEvent.change(screen.getByLabelText(/Artifact URL/i), {
      target: { value: 'https://demo.careerbridge.io' },
    });
    fireEvent.change(screen.getByLabelText(/Description & Technical Context/i), {
      target: { value: 'Hosted live cluster with observability dashboard.' },
    });
    fireEvent.change(screen.getByLabelText(/Attach to Milestone/i), {
      target: { value: '101' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Attach Evidence/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'Live Cloud Demo',
        evidence_type: 'demo',
        url: 'https://demo.careerbridge.io',
        description: 'Hosted live cluster with observability dashboard.',
        milestone_id: 101,
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
