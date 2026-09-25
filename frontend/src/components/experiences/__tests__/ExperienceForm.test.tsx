import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExperienceForm } from '../ExperienceForm';
import { ExperienceRecord } from '@/types/experience';

const mockInitialExperience: ExperienceRecord = {
  id: 10,
  student_id: 1,
  title: 'Backend Engineer',
  organization_name: 'Tech Labs',
  experience_type: 'work',
  start_date: '2024-01-15',
  end_date: '2024-12-31',
  is_current: false,
  description: 'Built scalable backend microservices and data pipelines.',
  status: 'claimed',
  verification_source: 'self_claimed',
  innovation_project_id: 5,
  verifier_id: null,
  verifier_name: null,
  verified_at: null,
  verification_notes: null,
  skills: 'Go, PostgreSQL',
  structured_skills: [],
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

describe('ExperienceForm Component', () => {
  it('renders create mode form elements correctly', () => {
    render(<ExperienceForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('Add Experience Record')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title \/ Role/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Organization \/ Company \/ Lab/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Experience Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/I am currently working \/ active in this role/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Description & Responsibilities/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('submit-experience-btn')).toHaveTextContent('Add Experience');
  });

  it('populates initial data in edit mode', () => {
    render(
      <ExperienceForm
        initialData={mockInitialExperience}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Experience Record')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title \/ Role/i)).toHaveValue('Backend Engineer');
    expect(
      screen.getByLabelText(/Organization \/ Company \/ Lab/i)
    ).toHaveValue('Tech Labs');
    expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2024-01-15');
    expect(screen.getByLabelText(/End Date/i)).toHaveValue('2024-12-31');
    expect(
      screen.getByLabelText(/Description & Responsibilities/i)
    ).toHaveValue('Built scalable backend microservices and data pipelines.');
    expect(screen.getByTestId('submit-experience-btn')).toHaveTextContent('Update Experience');
  });

  it('validates required fields and min lengths on submit', async () => {
    const handleSubmit = vi.fn();
    render(<ExperienceForm onSubmit={handleSubmit} onCancel={vi.fn()} />);

    const submitBtn = screen.getByTestId('submit-experience-btn');
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Title must be at least 2 characters long.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Start date is required.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Description must be at least 10 characters long.')
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates that end date cannot precede start date', async () => {
    const handleSubmit = vi.fn();
    render(<ExperienceForm onSubmit={handleSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Title \/ Role/i), {
      target: { value: 'Frontend Dev' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2025-06-01' },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: '2025-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Description & Responsibilities/i), {
      target: { value: 'Built React apps with TypeScript.' },
    });

    fireEvent.click(screen.getByTestId('submit-experience-btn'));

    expect(
      await screen.findByText('End date cannot precede start date.')
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables and clears end date when current role checkbox is selected', () => {
    render(<ExperienceForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const endDateInput = screen.getByLabelText(/End Date/i);
    const currentCheckbox = screen.getByLabelText(
      /I am currently working \/ active in this role/i
    );

    fireEvent.change(endDateInput, { target: { value: '2025-12-31' } });
    expect(endDateInput).toHaveValue('2025-12-31');

    fireEvent.click(currentCheckbox);
    expect(currentCheckbox).toBeChecked();
    expect(endDateInput).toBeDisabled();
    expect(endDateInput).toHaveValue('');
  });

  it('submits valid payload and trims input values', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExperienceForm onSubmit={handleSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Title \/ Role/i), {
      target: { value: '  Software Engineer Intern  ' },
    });
    fireEvent.change(screen.getByLabelText(/Organization \/ Company \/ Lab/i), {
      target: { value: '  OpenAI Lab  ' },
    });
    fireEvent.change(screen.getByLabelText(/Experience Type/i), {
      target: { value: 'internship' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2025-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: '2025-06-01' },
    });
    fireEvent.change(screen.getByLabelText(/Description & Responsibilities/i), {
      target: {
        value: '  Developed neural network inference pipeline on GPUs with PyTorch.  ',
      },
    });

    fireEvent.click(screen.getByTestId('submit-experience-btn'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'Software Engineer Intern',
        organization_name: 'OpenAI Lab',
        experience_type: 'internship',
        start_date: '2025-01-01',
        end_date: '2025-06-01',
        is_current: false,
        description:
          'Developed neural network inference pipeline on GPUs with PyTorch.',
        skills: null,
        innovation_project_id: null,
      });
    });
  });

  it('does not expose internal verification or status controls to prevent forged status', () => {
    render(<ExperienceForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/verifier/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/verified at/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/verification source/i)).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(<ExperienceForm onSubmit={vi.fn()} onCancel={handleCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
