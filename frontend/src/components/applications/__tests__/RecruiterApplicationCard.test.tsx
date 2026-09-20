import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterApplicationCard } from '../RecruiterApplicationCard';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';

const mockApplication: Application = {
  id: 201,
  job_posting_id: 15,
  student_id: 8,
  status: 'applied',
  cover_message: 'Experienced with backend systems and databases.',
  created_at: '2026-09-19T09:00:00Z',
  updated_at: '2026-09-19T09:00:00Z',
};

const mockJob: JobPosting = {
  id: 15,
  recruiter_id: 1,
  title: 'Backend Platform Engineer',
  description: 'Build robust scalable services.',
  opportunity_type: 'job',
  company_name: 'Apex Innovations',
  location: 'Austin, TX',
  is_remote: false,
  employment_type: 'full_time',
  skills: 'Python, FastAPI, PostgreSQL',
  minimum_qualification: 'BS degree',
  experience_required: '2+ years',
  salary_min: 90000,
  salary_max: 120000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
};

describe('RecruiterApplicationCard Component', () => {
  it('renders application details and initial status selector', () => {
    render(
      <MemoryRouter>
        <RecruiterApplicationCard
          application={mockApplication}
          job={mockJob}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Application #201')).toBeInTheDocument();
    expect(screen.getByText('Candidate #8')).toBeInTheDocument();
    expect(screen.getByText('Backend Platform Engineer')).toBeInTheDocument();
    expect(screen.getByText('Apex Innovations')).toBeInTheDocument();
    expect(screen.getByText('Experienced with backend systems and databases.')).toBeInTheDocument();

    const select = screen.getByLabelText(/Change status for Application #201/i) as HTMLSelectElement;
    expect(select.value).toBe('applied');
    expect(select.options).toHaveLength(5);
  });

  it('invokes onStatusChange when recruiter selects a new status', async () => {
    const onStatusChangeMock = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <RecruiterApplicationCard
          application={mockApplication}
          job={mockJob}
          onStatusChange={onStatusChangeMock}
        />
      </MemoryRouter>
    );

    const select = screen.getByLabelText(/Change status for Application #201/i);
    fireEvent.change(select, { target: { value: 'reviewing' } });

    expect(onStatusChangeMock).toHaveBeenCalledWith(201, 'reviewing');
  });

  it('displays error alert and reverts select value when status update fails', async () => {
    const onStatusChangeMock = vi.fn().mockRejectedValueOnce({
      detail: 'Permission denied: Not enough permissions to update this application',
    });

    render(
      <MemoryRouter>
        <RecruiterApplicationCard
          application={mockApplication}
          job={mockJob}
          onStatusChange={onStatusChangeMock}
        />
      </MemoryRouter>
    );

    const select = screen.getByLabelText(/Change status for Application #201/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'shortlisted' } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(
        'Permission denied: Not enough permissions to update this application'
      );
    });

    // Verify select was reverted back to 'applied'
    expect(select.value).toBe('applied');
  });

  it('disables select when isUpdating is true', () => {
    render(
      <MemoryRouter>
        <RecruiterApplicationCard
          application={mockApplication}
          job={mockJob}
          onStatusChange={vi.fn()}
          isUpdating={true}
        />
      </MemoryRouter>
    );

    const select = screen.getByLabelText(/Change status for Application #201/i);
    expect(select).toBeDisabled();
  });
});
