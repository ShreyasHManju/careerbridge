import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterInterviewsPage } from '../RecruiterInterviewsPage';
import * as interviewApi from '@/api/interviews';
import { Interview } from '@/types/interview';

const mockRecruiterInterviews: Interview[] = [
  {
    id: 201,
    application_id: 15,
    recruiter_id: 2,
    student_id: 5,
    job_id: 10,
    job_title: 'Full-Stack Software Engineer',
    company_name: 'AlphaTech Innovations',
    candidate_email: 'candidate1@example.com',
    recruiter_email: 'recruiter@alphatech.com',
    scheduled_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    duration_minutes: 45,
    interview_type: 'online',
    location_or_link: 'https://meet.google.com/abc-defg-hij',
    notes: 'Technical coding round',
    status: 'scheduled',
    created_at: '2026-09-19T10:00:00Z',
    updated_at: '2026-09-19T10:00:00Z',
  },
  {
    id: 202,
    application_id: 16,
    recruiter_id: 2,
    student_id: 7,
    job_id: 10,
    job_title: 'Full-Stack Software Engineer',
    company_name: 'AlphaTech Innovations',
    candidate_email: 'candidate2@example.com',
    recruiter_email: 'recruiter@alphatech.com',
    scheduled_at: new Date(Date.now() + 86400000 * 4).toISOString(),
    duration_minutes: 60,
    interview_type: 'in_person',
    location_or_link: 'Main Office, Room 101',
    notes: 'Leadership review',
    status: 'scheduled',
    created_at: '2026-09-19T11:00:00Z',
    updated_at: '2026-09-19T11:00:00Z',
  },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <RecruiterInterviewsPage />
    </MemoryRouter>
  );
};

describe('RecruiterInterviewsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then displays candidate interviews', async () => {
    vi.spyOn(interviewApi, 'getRecruiterInterviews').mockResolvedValueOnce(
      mockRecruiterInterviews
    );

    renderComponent();

    expect(screen.getByText(/Loading candidate interviews.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('candidate1@example.com')).toBeInTheDocument();
      expect(screen.getByText('candidate2@example.com')).toBeInTheDocument();
    });
  });

  it('marks an interview as completed and updates UI feedback', async () => {
    vi.spyOn(interviewApi, 'getRecruiterInterviews').mockResolvedValueOnce(
      mockRecruiterInterviews
    );

    const completedMock: Interview = {
      ...mockRecruiterInterviews[0],
      status: 'completed',
    };

    const updateSpy = vi
      .spyOn(interviewApi, 'updateInterview')
      .mockResolvedValueOnce(completedMock);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('candidate1@example.com')).toBeInTheDocument();
    });

    const markCompleteBtns = screen.getAllByRole('button', { name: /Mark Completed/i });
    fireEvent.click(markCompleteBtns[0]);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(201, { status: 'completed' });
      expect(screen.getByTestId('interview-action-success-alert')).toBeInTheDocument();
      expect(screen.getByText(/marked as completed/i)).toBeInTheDocument();
    });
  });

  it('cancels an interview when recruiter confirms prompt', async () => {
    vi.spyOn(interviewApi, 'getRecruiterInterviews').mockResolvedValueOnce(
      mockRecruiterInterviews
    );

    const cancelledMock: Interview = {
      ...mockRecruiterInterviews[0],
      status: 'cancelled',
    };

    const cancelSpy = vi
      .spyOn(interviewApi, 'cancelInterview')
      .mockResolvedValueOnce(cancelledMock);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('candidate1@example.com')).toBeInTheDocument();
    });

    const cancelBtns = screen.getAllByRole('button', { name: /Cancel Interview/i });
    fireEvent.click(cancelBtns[0]);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(201);
      expect(screen.getByText(/cancelled successfully/i)).toBeInTheDocument();
    });
  });

  it('opens reschedule modal and updates interview upon submit', async () => {
    vi.spyOn(interviewApi, 'getRecruiterInterviews').mockResolvedValueOnce(
      mockRecruiterInterviews
    );

    const rescheduledMock: Interview = {
      ...mockRecruiterInterviews[0],
      duration_minutes: 90,
      status: 'rescheduled',
    };

    vi.spyOn(interviewApi, 'updateInterview').mockResolvedValueOnce(rescheduledMock);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('candidate1@example.com')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole('button', { name: /Reschedule \/ Edit/i });
    fireEvent.click(editBtns[0]);

    // Reschedule modal opens
    expect(screen.getByTestId('reschedule-interview-modal')).toBeInTheDocument();

    const durationInput = screen.getByLabelText(/Duration/i);
    fireEvent.change(durationInput, { target: { value: '90' } });

    const saveBtn = screen.getByTestId('submit-update-interview-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/updated successfully/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when recruiter has no interviews', async () => {
    vi.spyOn(interviewApi, 'getRecruiterInterviews').mockResolvedValueOnce([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-interviews-empty-state')).toBeInTheDocument();
    });
  });
});
