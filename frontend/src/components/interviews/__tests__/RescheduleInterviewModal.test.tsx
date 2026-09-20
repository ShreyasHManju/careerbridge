import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RescheduleInterviewModal } from '../RescheduleInterviewModal';
import * as interviewApi from '@/api/interviews';
import { Interview } from '@/types/interview';
import { ApiErrorResponse } from '@/types/api';

const mockExistingInterview: Interview = {
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

describe('RescheduleInterviewModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false or interview is null', () => {
    const { rerender } = render(
      <RescheduleInterviewModal
        isOpen={false}
        interview={mockExistingInterview}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('reschedule-interview-modal')).not.toBeInTheDocument();

    rerender(
      <RescheduleInterviewModal
        isOpen={true}
        interview={null}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('reschedule-interview-modal')).not.toBeInTheDocument();
  });

  it('initializes form fields with existing interview attributes', () => {
    render(
      <RescheduleInterviewModal
        isOpen={true}
        interview={mockExistingInterview}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('reschedule-interview-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Reschedule \/ Edit Interview/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration/i)).toHaveValue(45);
    expect(screen.getByLabelText(/Interview Type/i)).toHaveValue('online');
    expect(screen.getByLabelText(/Interview Status/i)).toHaveValue('scheduled');
    expect(screen.getByLabelText(/Meeting Link/i)).toHaveValue('https://meet.google.com/abc-defg-hij');
  });

  it('submits updated payload and fires onSuccess', async () => {
    const updatedMock: Interview = {
      ...mockExistingInterview,
      duration_minutes: 60,
      status: 'rescheduled',
    };

    const updateSpy = vi
      .spyOn(interviewApi, 'updateInterview')
      .mockResolvedValueOnce(updatedMock);

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <RescheduleInterviewModal
        isOpen={true}
        interview={mockExistingInterview}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const durationInput = screen.getByLabelText(/Duration/i);
    fireEvent.change(durationInput, { target: { value: '60' } });

    const submitBtn = screen.getByTestId('submit-update-interview-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          duration_minutes: 60,
          interview_type: 'online',
        })
      );
      expect(onSuccess).toHaveBeenCalledWith(updatedMock);
    });
  });

  it('handles 409 conflict error properly', async () => {
    const conflictError: ApiErrorResponse = {
      success: false,
      message: 'Student has a conflicting interview scheduled during this time window',
      error_code: 'RESOURCE_CONFLICT',
      status: 409,
    };

    vi.spyOn(interviewApi, 'updateInterview').mockRejectedValueOnce(conflictError);

    render(
      <RescheduleInterviewModal
        isOpen={true}
        interview={mockExistingInterview}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByTestId('submit-update-interview-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Scheduling Conflict/i);
    });
  });

  it('closes when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <RescheduleInterviewModal
        isOpen={true}
        interview={mockExistingInterview}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
