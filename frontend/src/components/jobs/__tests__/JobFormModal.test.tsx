import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobFormModal } from '../JobFormModal';
import * as jobsApi from '@/api/jobs';
import { JobPosting } from '@/types/job';
import { ApiErrorResponse } from '@/types/api';

const mockExistingJob: JobPosting = {
  id: 42,
  recruiter_id: 10,
  title: 'Senior Software Engineer',
  description: 'Design and implement robust backend services in Python and Go.',
  opportunity_type: 'job',
  company_name: 'Nexus Corp',
  location: 'Seattle, WA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'Python, Docker, Kubernetes',
  minimum_qualification: 'B.S. in CS',
  experience_required: '3+ years',
  salary_min: 120000,
  salary_max: 160000,
  application_deadline: '2026-12-31T23:59:00Z',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

describe('JobFormModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <JobFormModal
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Create mode correctly with accessible dialog attributes and default values', () => {
    render(
      <JobFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        defaultCompanyName="Acme Global"
      />
    );

    const dialog = screen.getByTestId('job-form-modal');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'job-form-modal-title');

    expect(screen.getByRole('heading', { level: 2, name: /Create New Job Posting/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Job Title/i)).toHaveValue('');
    expect(screen.getByLabelText(/Company Name/i)).toHaveValue('Acme Global');
    expect(screen.getByLabelText(/Opportunity Type/i)).toHaveValue('job');
    expect(screen.getByLabelText(/Employment Type/i)).toHaveValue('full_time');
    expect(screen.getByLabelText(/Description/i)).toHaveValue('');
    expect(screen.getByLabelText(/Active \(Published\)/i)).toBeChecked();
    expect(screen.getByTestId('job-form-submit-btn')).toHaveTextContent('Create Posting');
  });

  it('renders Edit mode correctly with prepopulated initialJob data', () => {
    render(
      <JobFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        initialJob={mockExistingJob}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: /Edit Job Posting/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Job Title/i)).toHaveValue('Senior Software Engineer');
    expect(screen.getByLabelText(/Company Name/i)).toHaveValue('Nexus Corp');
    expect(screen.getByLabelText(/Location/i)).toHaveValue('Seattle, WA');
    expect(screen.getByLabelText(/Remote Opportunity/i)).toBeChecked();
    expect(screen.getByLabelText(/Description/i)).toHaveValue(mockExistingJob.description);
    expect(screen.getByLabelText(/Required Skills/i)).toHaveValue('Python, Docker, Kubernetes');
    expect(screen.getByLabelText(/Minimum Salary/i)).toHaveValue(120000);
    expect(screen.getByLabelText(/Maximum Salary/i)).toHaveValue(160000);
    expect(screen.getByTestId('job-form-submit-btn')).toHaveTextContent('Save Changes');
  });

  it('validates required fields on submit without calling API', async () => {
    const createSpy = vi.spyOn(jobsApi, 'createJob');
    render(
      <JobFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    expect(createSpy).not.toHaveBeenCalled();
    expect(await screen.findByTestId('title-error')).toHaveTextContent('Title is required.');
    expect(screen.getByTestId('company_name-error')).toHaveTextContent('Company name is required.');
    expect(screen.getByTestId('description-error')).toHaveTextContent('Description is required.');
  });

  it('validates field length constraints (title < 2 chars, description < 10 chars)', async () => {
    const user = userEvent.setup();
    render(
      <JobFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/Job Title/i), 'A');
    await user.type(screen.getByLabelText(/Company Name/i), 'B');
    await user.type(screen.getByLabelText(/Description/i), 'Short');

    await user.click(screen.getByTestId('job-form-submit-btn'));

    expect(await screen.findByTestId('title-error')).toHaveTextContent('Title must be at least 2 characters.');
    expect(screen.getByTestId('company_name-error')).toHaveTextContent('Company name must be at least 2 characters.');
    expect(screen.getByTestId('description-error')).toHaveTextContent('Description must be at least 10 characters.');
  });

  it('validates salary_min and salary_max relationships', async () => {
    const user = userEvent.setup();
    render(
      <JobFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/Job Title/i), 'Full Stack Dev');
    await user.type(screen.getByLabelText(/Company Name/i), 'TechCorp');
    await user.type(screen.getByLabelText(/Description/i), 'This is a long valid description of the role.');
    await user.type(screen.getByLabelText(/Minimum Salary/i), '100000');
    await user.type(screen.getByLabelText(/Maximum Salary/i), '50000');

    await user.click(screen.getByTestId('job-form-submit-btn'));

    expect(await screen.findByTestId('salary_max-error')).toHaveTextContent('Maximum salary cannot be less than minimum salary.');
  });

  it('submits valid payload in Create mode and calls onSuccess and onClose', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const createdJobResult: JobPosting = {
      ...mockExistingJob,
      id: 99,
      title: 'Cloud DevOps Intern',
      opportunity_type: 'internship',
      company_name: 'CloudScale Inc',
      description: 'Assist with CI/CD infrastructure and cloud deployment automation.',
      is_remote: true,
      salary_min: 40000,
      salary_max: 55000,
    };

    const createSpy = vi.spyOn(jobsApi, 'createJob').mockResolvedValueOnce(createdJobResult);

    render(
      <JobFormModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await user.type(screen.getByLabelText(/Job Title/i), 'Cloud DevOps Intern');
    await user.type(screen.getByLabelText(/Company Name/i), 'CloudScale Inc');
    await user.selectOptions(screen.getByLabelText(/Opportunity Type/i), 'internship');
    await user.type(
      screen.getByLabelText(/Description/i),
      'Assist with CI/CD infrastructure and cloud deployment automation.'
    );
    await user.click(screen.getByLabelText(/Remote Opportunity/i));
    await user.type(screen.getByLabelText(/Minimum Salary/i), '40000');
    await user.type(screen.getByLabelText(/Maximum Salary/i), '55000');

    await user.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cloud DevOps Intern',
        company_name: 'CloudScale Inc',
        opportunity_type: 'internship',
        description: 'Assist with CI/CD infrastructure and cloud deployment automation.',
        is_remote: true,
        salary_min: 40000,
        salary_max: 55000,
      })
    );

    expect(handleSuccess).toHaveBeenCalledWith(createdJobResult);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('submits valid payload in Edit mode and calls updateJob with jobId', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const updatedResult: JobPosting = {
      ...mockExistingJob,
      title: 'Principal Software Engineer',
    };

    const updateSpy = vi.spyOn(jobsApi, 'updateJob').mockResolvedValueOnce(updatedResult);

    render(
      <JobFormModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        initialJob={mockExistingJob}
      />
    );

    const titleInput = screen.getByLabelText(/Job Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Principal Software Engineer');

    await user.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    expect(updateSpy).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        title: 'Principal Software Engineer',
      })
    );

    expect(handleSuccess).toHaveBeenCalledWith(updatedResult);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays backend structured error when create/update fails', async () => {
    const user = userEvent.setup();
    const errorResponse: ApiErrorResponse = {
      success: false,
      message: 'You have exceeded the maximum active job posting limit.',
      error_code: 'LIMIT_EXCEEDED',
      status: 400,
    };

    vi.spyOn(jobsApi, 'createJob').mockRejectedValueOnce(errorResponse);

    render(
      <JobFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/Job Title/i), 'Lead Architect');
    await user.type(screen.getByLabelText(/Company Name/i), 'Tech Systems');
    await user.type(screen.getByLabelText(/Description/i), 'Lead architectural design of systems.');

    await user.click(screen.getByTestId('job-form-submit-btn'));

    expect(await screen.findByTestId('job-form-error')).toHaveTextContent(
      'You have exceeded the maximum active job posting limit.'
    );
  });

  it('closes modal when cancel button, close button, backdrop, or Escape key is triggered', async () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <JobFormModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />
    );

    // Cancel button
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Close 'x' button
    fireEvent.click(screen.getByLabelText(/Close job form dialog/i));
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(3);

    // Backdrop click
    const backdrop = screen.getByRole('presentation');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(4);

    rerender(
      <JobFormModal
        isOpen={false}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />
    );
  });
});
