import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentApplicationCard } from '../StudentApplicationCard';
import { Application } from '@/types/application';
import { JobPosting } from '@/types/job';
import { Interview } from '@/types/interview';
import * as experiencesApi from '@/api/experiences';

const mockApplication: Application = {
  id: 10,
  job_posting_id: 42,
  student_id: 5,
  status: 'reviewing',
  cover_message: 'I have 2 years of React experience and love building accessible UIs.',
  created_at: '2026-09-19T10:30:00Z',
  updated_at: '2026-09-19T11:00:00Z',
};

const mockShortlistedApp: Application = {
  ...mockApplication,
  status: 'shortlisted',
};

const mockAcceptedApp: Application = {
  ...mockApplication,
  status: 'accepted',
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

const mockScheduledOnlineInterview: Interview = {
  id: 101,
  application_id: 10,
  recruiter_id: 3,
  student_id: 5,
  job_id: 42,
  job_title: 'Frontend Engineer Intern',
  company_name: 'TechBridge Corp',
  candidate_email: 'student@example.com',
  recruiter_email: 'recruiter@techbridge.com',
  scheduled_at: '2026-10-15T14:00:00Z',
  duration_minutes: 45,
  interview_type: 'online',
  location_or_link: 'https://meet.google.com/abc-defg-hij',
  notes: 'Prepare a 5-min demo of your React portfolio project.',
  status: 'scheduled',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

const mockInPersonInterview: Interview = {
  id: 102,
  application_id: 10,
  recruiter_id: 3,
  student_id: 5,
  job_id: 42,
  job_title: 'Frontend Engineer Intern',
  company_name: 'TechBridge Corp',
  candidate_email: 'student@example.com',
  recruiter_email: 'recruiter@techbridge.com',
  scheduled_at: '2026-10-16T11:00:00Z',
  duration_minutes: 60,
  interview_type: 'in_person',
  location_or_link: 'Building 4, Floor 3, Conference Room B',
  notes: 'Bring a photo ID for building security.',
  status: 'scheduled',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

const mockCompletedInterview: Interview = {
  ...mockScheduledOnlineInterview,
  id: 103,
  status: 'completed',
};

const mockCancelledInterview: Interview = {
  ...mockScheduledOnlineInterview,
  id: 104,
  status: 'cancelled',
};

const mockRescheduledInterview: Interview = {
  ...mockScheduledOnlineInterview,
  id: 105,
  status: 'rescheduled',
  scheduled_at: '2026-10-20T15:30:00Z',
  location_or_link: 'https://zoom.us/j/987654321',
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

  // ==========================================================================
  // PHASE 4 STEP 3 TESTS
  // ==========================================================================

  describe('Phase 4 Step 3: Interview Preview & Direct Join Action', () => {
    it('A. displays upcoming interview preview with date, duration, format, location, notes, and status', () => {
      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interview={mockScheduledOnlineInterview}
          />
        </MemoryRouter>
      );

      const previewBanner = screen.getByTestId('app-interview-preview-10');
      expect(previewBanner).toBeInTheDocument();
      expect(screen.getByText('Upcoming Interview')).toBeInTheDocument();
      expect(screen.getByText(/45 min/)).toBeInTheDocument();
      expect(screen.getByText(/Online Video/)).toBeInTheDocument();
      expect(screen.getByText('https://meet.google.com/abc-defg-hij')).toBeInTheDocument();
      expect(
        screen.getByText('Prepare a 5-min demo of your React portfolio project.')
      ).toBeInTheDocument();
      expect(screen.getByRole('status', { name: /Interview status: Scheduled/i })).toBeInTheDocument();
    });

    it('B. displays "Join Online Meeting 🎥" action with valid URL when interview has online meeting link', () => {
      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interview={mockScheduledOnlineInterview}
          />
        </MemoryRouter>
      );

      const joinBtn = screen.getByTestId('join-interview-btn-10');
      expect(joinBtn).toBeInTheDocument();
      expect(joinBtn).toHaveTextContent(/Join Online Meeting 🎥/);
      expect(joinBtn).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
      expect(joinBtn).toHaveAttribute('target', '_blank');
      expect(joinBtn).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('C. handles in-person interview without meeting URL: does not render join button but displays interview info and navigation', () => {
      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interview={mockInPersonInterview}
          />
        </MemoryRouter>
      );

      // Join button should NOT exist because location is not an HTTP URL
      expect(screen.queryByTestId('join-interview-btn-10')).not.toBeInTheDocument();

      // Interview preview should still be shown
      expect(screen.getByTestId('app-interview-preview-10')).toBeInTheDocument();
      expect(screen.getByText('Building 4, Floor 3, Conference Room B')).toBeInTheDocument();
      expect(screen.getByText(/In-Person/)).toBeInTheDocument();

      // Navigation link to interviews remains available
      const viewInterviewsLink = screen.getByRole('link', { name: /View Interviews/i });
      expect(viewInterviewsLink).toHaveAttribute('href', '/app/interviews');
    });

    it('D. does not display join button or upcoming preview for completed or cancelled interviews', () => {
      const { rerender } = render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interview={mockCompletedInterview}
          />
        </MemoryRouter>
      );

      // Completed interview: no upcoming preview, no join button
      expect(screen.queryByTestId('app-interview-preview-10')).not.toBeInTheDocument();
      expect(screen.queryByTestId('join-interview-btn-10')).not.toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interview={mockCancelledInterview}
          />
        </MemoryRouter>
      );

      // Cancelled interview: no upcoming preview, no join button
      expect(screen.queryByTestId('app-interview-preview-10')).not.toBeInTheDocument();
      expect(screen.queryByTestId('join-interview-btn-10')).not.toBeInTheDocument();
    });

    it('E. handles rescheduled interview correctly with updated join link and status', () => {
      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interview={mockRescheduledInterview}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('app-interview-preview-10')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: /Interview status: Rescheduled/i })).toBeInTheDocument();

      const joinBtn = screen.getByTestId('join-interview-btn-10');
      expect(joinBtn).toBeInTheDocument();
      expect(joinBtn).toHaveAttribute('href', 'https://zoom.us/j/987654321');
    });

    it('F. resolves active upcoming interview from interviews array prop', () => {
      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
            interviews={[mockCancelledInterview, mockScheduledOnlineInterview]}
          />
        </MemoryRouter>
      );

      // Should pick the active scheduled interview over the cancelled one
      expect(screen.getByTestId('app-interview-preview-10')).toBeInTheDocument();
      expect(screen.getByTestId('join-interview-btn-10')).toHaveAttribute(
        'href',
        'https://meet.google.com/abc-defg-hij'
      );
    });
  });

  // ==========================================================================
  // ACCEPTED APPLICATION ? EXPERIENCE PASSPORT TESTS
  // ==========================================================================

  describe('Accepted Application ? Experience Passport', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('shows Add to Experience Passport action only for accepted applications', () => {
      const { rerender } = render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockAcceptedApp}
            job={mockJob}
          />
        </MemoryRouter>
      );

      expect(
        screen.getByTestId('create-experience-btn-10')
      ).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockShortlistedApp}
            job={mockJob}
          />
        </MemoryRouter>
      );

      expect(
        screen.queryByTestId('create-experience-btn-10')
      ).not.toBeInTheDocument();
    });

    it('does not show Experience Passport action for non-accepted applications', () => {
      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockApplication}
            job={mockJob}
          />
        </MemoryRouter>
      );

      expect(
        screen.queryByTestId('create-experience-btn-10')
      ).not.toBeInTheDocument();
    });

    it('creates an Experience Passport record from an accepted application', async () => {
      const createSpy = vi
        .spyOn(experiencesApi, 'createExperienceFromAcceptedApplication')
        .mockResolvedValue({
          id: 501,
        } as never);

      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockAcceptedApp}
            job={mockJob}
          />
        </MemoryRouter>
      );

      const button = screen.getByTestId('create-experience-btn-10');

      await button.click();

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(10);

      expect(
        await screen.findByTestId('experience-created-10')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'This accepted opportunity has been added to your Experience Passport.'
        )
      ).toBeInTheDocument();
    });

    it('prevents duplicate Experience Passport creation after success', async () => {
      const createSpy = vi
        .spyOn(experiencesApi, 'createExperienceFromAcceptedApplication')
        .mockResolvedValue({
          id: 501,
        } as never);

      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockAcceptedApp}
            job={mockJob}
          />
        </MemoryRouter>
      );

      const button = screen.getByTestId('create-experience-btn-10');

      await button.click();
      expect(
        await screen.findByTestId('experience-created-10')
      ).toBeInTheDocument();

      expect(button).toBeDisabled();

      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('displays an error when Experience Passport creation fails', async () => {
      vi.spyOn(
        experiencesApi,
        'createExperienceFromAcceptedApplication'
      ).mockRejectedValue(new Error('Failed to create experience'));

      render(
        <MemoryRouter>
          <StudentApplicationCard
            application={mockAcceptedApp}
            job={mockJob}
          />
        </MemoryRouter>
      );

      const button = screen.getByTestId('create-experience-btn-10');

      await button.click();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to create experience'
      );

      expect(
        screen.queryByTestId('experience-created-10')
      ).not.toBeInTheDocument();
    });
  });
});