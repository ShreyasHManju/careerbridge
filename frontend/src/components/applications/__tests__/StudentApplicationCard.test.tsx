import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentApplicationCard } from '../StudentApplicationCard';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';

const mockApplication: Application = {
  id: 10,
  job_posting_id: 42,
  student_id: 5,
  status: 'reviewing',
  cover_message: 'I have 2 years of React experience and love building accessible UIs.',
  created_at: '2026-09-19T10:30:00Z',
  updated_at: '2026-09-19T11:00:00Z',
};

const mockJob: JobPosting = {
  id: 42,
  recruiter_id: 3,
  title: 'Frontend Engineer Intern',
  description: 'Join our UI team.',
  opportunity_type: 'internship',
  company_name: 'TechBridge Corp',
  location: 'San Francisco, CA',
  is_remote: true,
  employment_type: 'full_time',
  skills: 'React, TypeScript',
  minimum_qualification: 'Pursuing BS in CS',
  experience_required: '1+ years',
  salary_min: 60000,
  salary_max: 80000,
  application_deadline: '2026-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
};

describe('StudentApplicationCard Component', () => {
  it('renders all application and resolved job metadata correctly', () => {
    render(
      <MemoryRouter>
        <StudentApplicationCard application={mockApplication} job={mockJob} />
      </MemoryRouter>
    );

    expect(screen.getByText('Frontend Engineer Intern')).toBeInTheDocument();
    expect(screen.getByText('TechBridge Corp')).toBeInTheDocument();
    expect(screen.getByText('Reviewing')).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA \(Remote\)/)).toBeInTheDocument();
    expect(screen.getByText(/Applied on Sep 19, 2026/)).toBeInTheDocument();
    expect(
      screen.getByText('I have 2 years of React experience and love building accessible UIs.')
    ).toBeInTheDocument();

    const viewDetailsLink = screen.getByRole('link', { name: /View Opportunity Details/i });
    expect(viewDetailsLink).toHaveAttribute('href', '/app/jobs/42');
  });

  it('handles missing job metadata gracefully with fallback values', () => {
    render(
      <MemoryRouter>
        <StudentApplicationCard application={mockApplication} job={null} />
      </MemoryRouter>
    );

    expect(screen.getByText('Opportunity #42')).toBeInTheDocument();
    expect(screen.getByText('Hiring Organization')).toBeInTheDocument();
    expect(screen.getByText('Reviewing')).toBeInTheDocument();
  });

  it('omits cover message section when application.cover_message is null', () => {
    const appWithoutCover: Application = {
      ...mockApplication,
      cover_message: null,
    };

    render(
      <MemoryRouter>
        <StudentApplicationCard application={appWithoutCover} job={mockJob} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Your Cover Note:/i)).not.toBeInTheDocument();
  });

  it('does not render any withdrawal or cancellation buttons', () => {
    render(
      <MemoryRouter>
        <StudentApplicationCard application={mockApplication} job={mockJob} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
