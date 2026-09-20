import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleInterviewModal } from '../ScheduleInterviewModal';
import * as interviewApi from '@/api/interviews';
import { Interview } from '@/types/interview';
import { ApiErrorResponse } from '@/types/api';

const mockCreatedInterview: Interview = {
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
  notes: 'Prepare Python concepts',
  status: 'scheduled',
  created_at: '2026-09-19T15:00:00Z',
  updated_at: '2026-09-19T15:00:00Z',
};

describe('ScheduleInterviewModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ScheduleInterviewModal
        isOpen={false}
        applicationId={10}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('schedule-interview-modal')).not.toBeInTheDocument();
  });

  it('renders modal dialog and form controls when open', () => {
    render(
      <ScheduleInterviewModal
        isOpen={true}
        applicationId={10}
        candidateEmail="student@example.com"
        jobTitle="Full-Stack Engineer"
        companyName="Acme Corp"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('schedule-interview-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Schedule Interview/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Scheduled Date & Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Interview Type/i)).toBeInTheDocument();
  });

  it('submits valid form data and triggers onSuccess callback', async () => {
    const scheduleSpy = vi
      .spyOn(interviewApi, 'scheduleInterview')
      .mockResolvedValueOnce(mockCreatedInterview);

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <ScheduleInterviewModal
        isOpen={true}
        applicationId={10}
        candidateEmail="student@example.com"
        jobTitle="Full-Stack Engineer"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const dateInput = screen.getByLabelText(/Scheduled Date & Time/i);
    const durationInput = screen.getByLabelText(/Duration/i);
    const locationInput = screen.getByLabelText(/Meeting Link/i);
    const notesInput = screen.getByLabelText(/Notes & Agenda/i);

    fireEvent.change(dateInput, { target: { value: '2026-10-15T10:00' } });
    fireEvent.change(durationInput, { target: { value: '45' } });
    fireEvent.change(locationInput, { target: { value: 'https://meet.google.com/abc-defg-hij' } });
    fireEvent.change(notesInput, { target: { value: 'Prepare Python concepts' } });

    const submitBtn = screen.getByTestId('submit-schedule-interview-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(scheduleSpy).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          duration_minutes: 45,
          interview_type: 'online',
          location_or_link: 'https://meet.google.com/abc-defg-hij',
          notes: 'Prepare Python concepts',
        })
      );
      expect(onSuccess).toHaveBeenCalledWith(mockCreatedInterview);
    });
  });

  it('displays error alert on 409 scheduling conflict', async () => {
    const conflictError: ApiErrorResponse = {
      success: false,
      message: 'Recruiter has a conflicting interview scheduled during this time window',
      error_code: 'RESOURCE_CONFLICT',
      status: 409,
    };

    vi.spyOn(interviewApi, 'scheduleInterview').mockRejectedValueOnce(conflictError);

    render(
      <ScheduleInterviewModal
        isOpen={true}
        applicationId={10}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByTestId('submit-schedule-interview-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Scheduling Conflict/i);
    });
  });

  it('displays client validation error when duration is invalid', async () => {
    render(
      <ScheduleInterviewModal
        isOpen={true}
        applicationId={10}
        onClose={vi.fn()}
      />
    );

    const durationInput = screen.getByLabelText(/Duration/i);
    fireEvent.change(durationInput, { target: { value: '0' } });

    const submitBtn = screen.getByTestId('submit-schedule-interview-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Duration must be an integer between 1 and 480/i
      );
    });
  });

  it('closes when Cancel button or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <ScheduleInterviewModal
        isOpen={true}
        applicationId={10}
        onClose={onClose}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
