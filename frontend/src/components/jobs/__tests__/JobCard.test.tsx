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

  it('renders student match badge with high tier for >= 75%', () => {
    const jobWithHighMatch: JobPosting = {
      ...mockJob,
      match_summary: {
        match_percentage: 85,
        total_required: 3,
        total_matched: 3,
        total_verified_matched: 2,
        total_missing: 0,
        matched_skills: [],
        missing_skills: [],
      },
    };

    render(
      <MemoryRouter>
        <JobCard job={jobWithHighMatch} userRole="student" />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('match-badge-1');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('🎯 85% Match');
    expect(badge).toHaveClass('cb-badge-match-high');
  });

  it('renders student match badge with medium tier for 50-74%', () => {
    const jobWithMediumMatch: JobPosting = {
      ...mockJob,
      match_summary: {
        match_percentage: 67,
        total_required: 3,
        total_matched: 2,
        total_verified_matched: 1,
        total_missing: 1,
        matched_skills: [],
        missing_skills: [],
      },
    };

    render(
      <MemoryRouter>
        <JobCard job={jobWithMediumMatch} userRole="student" />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('match-badge-1');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('🎯 67% Match');
    expect(badge).toHaveClass('cb-badge-match-medium');
  });

  it('renders student match badge with low tier for < 50%', () => {
    const jobWithLowMatch: JobPosting = {
      ...mockJob,
      match_summary: {
        match_percentage: 33,
        total_required: 3,
        total_matched: 1,
        total_verified_matched: 0,
        total_missing: 2,
        matched_skills: [],
        missing_skills: [],
      },
    };

    render(
      <MemoryRouter>
        <JobCard job={jobWithLowMatch} userRole="student" />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('match-badge-1');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('🎯 33% Match');
    expect(badge).toHaveClass('cb-badge-match-low');
  });

  it('does NOT render match badge for recruiters or admins even if match_summary is present', () => {
    const jobWithMatch: JobPosting = {
      ...mockJob,
      match_summary: {
        match_percentage: 100,
        total_required: 2,
        total_matched: 2,
        total_verified_matched: 1,
        total_missing: 0,
        matched_skills: [],
        missing_skills: [],
      },
    };

    const { rerender } = render(
      <MemoryRouter>
        <JobCard job={jobWithMatch} userRole="recruiter" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('match-badge-1')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <JobCard job={jobWithMatch} userRole="admin" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('match-badge-1')).not.toBeInTheDocument();
  });
});
