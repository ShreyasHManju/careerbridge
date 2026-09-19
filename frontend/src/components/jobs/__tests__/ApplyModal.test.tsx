import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplyModal } from '../ApplyModal';
import { JobPosting, Application } from '@/types/job';
import * as applicationsApi from '@/api/applications';

const mockJob: JobPosting = {
  id: 1,
  recruiter_id: 10,
  title: 'Backend Engineer Intern',
  description: 'Python and FastAPI role.',
  opportunity_type: 'internship',
  company_name: 'CloudScale Inc',
  location: 'Remote',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'Python, FastAPI',
  minimum_qualification: 'B.S.',
  experience_required: '0-1 years',
  salary_min: 60000,
  salary_max: 80000,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockApplicationResponse: Application = {
  id: 101,
  job_posting_id: 1,
  student_id: 5,
  status: 'applied',
  cover_message: 'Excited for this opportunity!',
  resume_id: 12,
  created_at: '2026-09-19T12:00:00Z',
  updated_at: '2026-09-19T12:00:00Z',
};

describe('ApplyModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <ApplyModal
        isOpen={false}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders accessible dialog with job information and controls when open', () => {
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: /Apply for Backend Engineer Intern/i })).toBeInTheDocument();
    expect(screen.getByText(/CloudScale Inc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cover Note \/ Message/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 2000 characters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Application/i })).toBeInTheDocument();
  });

  it('updates live character counter as user types', () => {
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/Cover Note \/ Message/i);
    fireEvent.change(textarea, { target: { value: 'Hello world' } });

    expect(screen.getByText(/11 \/ 2000 characters/i)).toBeInTheDocument();
  });

  it('successfully submits application and shows success confirmation', async () => {
    const applySpy = vi.spyOn(applicationsApi, 'applyToJob').mockResolvedValueOnce(mockApplicationResponse);
    const onSuccessMock = vi.fn();

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
        onSuccess={onSuccessMock}
      />
    );

    const textarea = screen.getByLabelText(/Cover Note \/ Message/i);
    fireEvent.change(textarea, { target: { value: 'Excited for this opportunity!' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    expect(screen.getByText(/Submitting Application\.\.\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith(1, {
        cover_message: 'Excited for this opportunity!',
      });
      expect(onSuccessMock).toHaveBeenCalledWith(mockApplicationResponse);
      expect(screen.getByRole('status')).toHaveTextContent(/Application Submitted!/i);
    });
  });

  it('handles 400 missing resume error by displaying clear user error message', async () => {
    vi.spyOn(applicationsApi, 'applyToJob').mockRejectedValueOnce({
      status: 400,
      message: 'Please upload a resume before applying',
      detail: 'Please upload a resume before applying',
    });

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please upload a resume before applying');
    });
  });

  it('handles 409 duplicate application error by displaying clear error', async () => {
    vi.spyOn(applicationsApi, 'applyToJob').mockRejectedValueOnce({
      status: 409,
      message: 'You have already applied to this job posting',
      detail: 'You have already applied to this job posting',
    });

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('You have already applied to this job posting');
    });
  });

  it('handles 400 inactive job error by displaying clear error', async () => {
    vi.spyOn(applicationsApi, 'applyToJob').mockRejectedValueOnce({
      status: 400,
      message: 'Cannot apply to an inactive job posting',
      detail: 'Cannot apply to an inactive job posting',
    });

    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot apply to an inactive job posting');
    });
  });

  it('closes modal when Cancel button or Close button is clicked', () => {
    const onCloseMock = vi.fn();
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={onCloseMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText(/Close apply dialog/i));
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });

  it('closes modal when Escape key is pressed', () => {
    const onCloseMock = vi.fn();
    render(
      <ApplyModal
        isOpen={true}
        job={mockJob}
        onClose={onCloseMock}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
