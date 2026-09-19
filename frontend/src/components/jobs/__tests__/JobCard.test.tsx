import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JobCard } from '../JobCard';
import { JobPosting } from '@/types/job';

const mockJob: JobPosting = {
  id: 1,
  recruiter_id: 10,
  title: 'Full Stack Engineer Intern',
  description: 'Exciting frontend and backend engineering internship.',
  opportunity_type: 'internship',
  company_name: 'TechFlow Systems',
  location: 'San Francisco, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, TypeScript, Python',
  minimum_qualification: 'Pursuing B.S. in CS',
  experience_required: '0-1 years',
  salary_min: 50000,
  salary_max: 70000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

describe('JobCard Component', () => {
  it('renders all essential job information correctly', () => {
    render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="student" />
      </MemoryRouter>
    );

    expect(screen.getByText('Full Stack Engineer Intern')).toBeInTheDocument();
    expect(screen.getByText('TechFlow Systems')).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('Internship')).toBeInTheDocument();
    expect(screen.getByText('Full-time')).toBeInTheDocument();
    expect(screen.getByText(/Exciting frontend and backend engineering internship/)).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('$50,000 - $70,000')).toBeInTheDocument();
  });

  it('links to the job detail page', () => {
    render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="student" />
      </MemoryRouter>
    );

    const titleLink = screen.getByRole('link', { name: /Full Stack Engineer Intern/i });
    expect(titleLink).toHaveAttribute('href', '/app/jobs/1');

    const detailsBtn = screen.getByRole('link', { name: /View Details/i });
    expect(detailsBtn).toHaveAttribute('href', '/app/jobs/1');
  });

  it('renders student-only actions (Save, Apply) when user is a student', () => {
    render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="student" isSaved={false} />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Save job Full Stack Engineer Intern/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply/i })).toBeInTheDocument();
  });

  it('does NOT render student-only actions when user is recruiter or admin', () => {
    const { rerender } = render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="recruiter" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply/i })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="admin" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply/i })).not.toBeInTheDocument();
  });

  it('triggers onToggleSave callback when student clicks save button', () => {
    const onToggleSaveMock = vi.fn();
    render(
      <MemoryRouter>
        <JobCard
          job={mockJob}
          userRole="student"
          isSaved={false}
          onToggleSave={onToggleSaveMock}
        />
      </MemoryRouter>
    );

    const saveBtn = screen.getByRole('button', { name: /Save job Full Stack Engineer Intern/i });
    fireEvent.click(saveBtn);

    expect(onToggleSaveMock).toHaveBeenCalledTimes(1);
    expect(onToggleSaveMock).toHaveBeenCalledWith(1);
  });

  it('renders Saved state correctly when isSaved is true', () => {
    render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="student" isSaved={true} />
      </MemoryRouter>
    );

    const savedBtn = screen.getByRole('button', { name: /Unsave job Full Stack Engineer Intern/i });
    expect(savedBtn).toHaveTextContent('★ Saved');
    expect(savedBtn).toHaveClass('cb-btn-saved');
  });

  it('disables save button and shows loading text while isSaving is true', () => {
    render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="student" isSaving={true} />
      </MemoryRouter>
    );

    const saveBtn = screen.getByRole('button', { name: /Save job Full Stack Engineer Intern/i });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveTextContent('Saving...');
  });

  it('triggers onApply callback when student clicks Apply button', () => {
    const onApplyMock = vi.fn();
    render(
      <MemoryRouter>
        <JobCard job={mockJob} userRole="student" onApply={onApplyMock} />
      </MemoryRouter>
    );

    const applyBtn = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyBtn);

    expect(onApplyMock).toHaveBeenCalledTimes(1);
    expect(onApplyMock).toHaveBeenCalledWith(mockJob);
  });
});
