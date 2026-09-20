import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InterviewCard } from '../InterviewCard';
import { Interview } from '@/types/interview';

const baseInterview: Interview = {
  id: 1,
  application_id: 10,
  recruiter_id: 2,
  student_id: 5,
  job_id: 3,
  job_title: 'Full-Stack Software Engineering Intern',
  company_name: 'Acme Innovations Ltd',
  candidate_email: 'student@example.com',
  recruiter_email: 'recruiter@acme.com',
  scheduled_at: '2026-10-15T10:00:00Z',
  duration_minutes: 45,
  interview_type: 'online',
  location_or_link: 'https://meet.google.com/abc-defg-hij',
  notes: 'Technical screening round',
  status: 'scheduled',
  created_at: '2026-09-19T15:00:00Z',
  updated_at: '2026-09-19T15:00:00Z',
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('InterviewCard Component', () => {
  it('renders all core interview details accurately', () => {
    renderWithRouter(<InterviewCard interview={baseInterview} role="student" />);

    expect(screen.getByText('Full-Stack Software Engineering Intern')).toBeInTheDocument();
    expect(screen.getByText('Acme Innovations Ltd')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText(/Online Video/i)).toBeInTheDocument();
    expect(screen.getByText('Technical screening round')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Scheduled');
  });

  it('renders Join Interview link with secure target and rel attributes for online interviews', () => {
    renderWithRouter(<InterviewCard interview={baseInterview} role="student" />);

    const joinLink = screen.getByRole('link', { name: /Join interview for Full-Stack/i });
    expect(joinLink).toBeInTheDocument();
    expect(joinLink).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
    expect(joinLink).toHaveAttribute('target', '_blank');
    expect(joinLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders in-person location as plain text without link', () => {
    const inPersonInterview: Interview = {
      ...baseInterview,
      interview_type: 'in_person',
      location_or_link: 'Building 4, Conference Room B',
    };

    renderWithRouter(<InterviewCard interview={inPersonInterview} role="student" />);

    expect(screen.getByText(/In-Person/i)).toBeInTheDocument();
    expect(screen.getByText('Building 4, Conference Room B')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Join interview/i })).not.toBeInTheDocument();
  });

  it('displays candidate email in recruiter view and recruiter contact in student view', () => {
    const { rerender } = renderWithRouter(
      <InterviewCard interview={baseInterview} role="recruiter" />
    );
    expect(screen.getByText('Candidate')).toBeInTheDocument();
    expect(screen.getByText('student@example.com')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <InterviewCard interview={baseInterview} role="student" />
      </MemoryRouter>
    );
    expect(screen.getByText('Recruiter Contact')).toBeInTheDocument();
    expect(screen.getByText('recruiter@acme.com')).toBeInTheDocument();
  });

  it('renders recruiter actions for scheduled and rescheduled interviews', () => {
    const onReschedule = vi.fn();
    const onMarkComplete = vi.fn();
    const onCancel = vi.fn();

    renderWithRouter(
      <InterviewCard
        interview={baseInterview}
        role="recruiter"
        onReschedule={onReschedule}
        onMarkComplete={onMarkComplete}
        onCancel={onCancel}
      />
    );

    const rescheduleBtn = screen.getByRole('button', { name: /Reschedule \/ Edit/i });
    const completeBtn = screen.getByRole('button', { name: /Mark Completed/i });
    const cancelBtn = screen.getByRole('button', { name: /Cancel Interview/i });

    expect(rescheduleBtn).toBeInTheDocument();
    expect(completeBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(rescheduleBtn);
    expect(onReschedule).toHaveBeenCalledWith(baseInterview);

    fireEvent.click(completeBtn);
    expect(onMarkComplete).toHaveBeenCalledWith(baseInterview);

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledWith(baseInterview);
  });

  it('does NOT render recruiter actions when in student role', () => {
    const onReschedule = vi.fn();
    renderWithRouter(
      <InterviewCard
        interview={baseInterview}
        role="student"
        onReschedule={onReschedule}
      />
    );

    expect(screen.queryByRole('button', { name: /Reschedule \/ Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Interview/i })).not.toBeInTheDocument();
  });

  it('does NOT render recruiter action buttons when interview is cancelled or completed', () => {
    const cancelledInterview: Interview = {
      ...baseInterview,
      status: 'cancelled',
    };

    renderWithRouter(
      <InterviewCard
        interview={cancelledInterview}
        role="recruiter"
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Reschedule \/ Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Interview/i })).not.toBeInTheDocument();
  });

  it('disables action buttons when isMutating is true', () => {
    renderWithRouter(
      <InterviewCard
        interview={baseInterview}
        role="recruiter"
        onReschedule={vi.fn()}
        onMarkComplete={vi.fn()}
        onCancel={vi.fn()}
        isMutating={true}
      />
    );

    expect(screen.getByRole('button', { name: /Reschedule \/ Edit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Mark Completed/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel Interview/i })).toBeDisabled();
  });
});
