import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { StudentInterviewsPage } from '../StudentInterviewsPage';
import * as interviewApi from '@/api/interviews';
import { Interview } from '@/types/interview';
import { ApiErrorResponse } from '@/types/api';

const mockStudentInterviews: Interview[] = [
  {
    id: 101,
    application_id: 1,
    recruiter_id: 2,
    student_id: 5,
    job_id: 10,
    job_title: 'Full-Stack Software Engineer',
    company_name: 'AlphaTech Innovations',
    candidate_email: 'student@example.com',
    recruiter_email: 'recruiter@alphatech.com',
    scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days in future
    duration_minutes: 45,
    interview_type: 'online',
    location_or_link: 'https://meet.google.com/abc-defg-hij',
    notes: 'System design and algorithms',
    status: 'scheduled',
    created_at: '2026-09-19T10:00:00Z',
    updated_at: '2026-09-19T10:00:00Z',
  },
  {
    id: 102,
    application_id: 2,
    recruiter_id: 3,
    student_id: 5,
    job_id: 12,
    job_title: 'React Frontend Developer',
    company_name: 'BetaGlobal Systems',
    candidate_email: 'student@example.com',
    recruiter_email: 'recruiter@betaglobal.com',
    scheduled_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days in past
    duration_minutes: 30,
    interview_type: 'in_person',
    location_or_link: 'Tech Park, Building 2',
    notes: 'Behavioral round',
    status: 'completed',
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-14T10:00:00Z',
  },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <StudentInterviewsPage />
    </MemoryRouter>
  );
};

describe('StudentInterviewsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then displays populated interviews', async () => {
    vi.spyOn(interviewApi, 'getMyInterviews').mockResolvedValueOnce(mockStudentInterviews);

    renderComponent();

    expect(screen.getByText(/Loading your interviews.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('AlphaTech Innovations')).toBeInTheDocument();
    });
  });

  it('switches between Upcoming and Past & Completed tabs correctly', async () => {
    vi.spyOn(interviewApi, 'getMyInterviews').mockResolvedValueOnce(mockStudentInterviews);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
    });

    // Default is Upcoming tab -> Past interview is not shown
    expect(screen.queryByText('React Frontend Developer')).not.toBeInTheDocument();

    // Switch to Past tab
    const pastTab = screen.getByRole('tab', { name: /Past & Completed/i });
    fireEvent.click(pastTab);

    expect(screen.getByText('React Frontend Developer')).toBeInTheDocument();
    expect(screen.queryByText('Full-Stack Software Engineer')).not.toBeInTheDocument();

    // Switch to All tab
    const allTab = screen.getByRole('tab', { name: /All/i });
    fireEvent.click(allTab);

    expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('React Frontend Developer')).toBeInTheDocument();
  });

  it('filters interviews by keyword search', async () => {
    vi.spyOn(interviewApi, 'getMyInterviews').mockResolvedValueOnce(mockStudentInterviews);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Search interviews/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentRole' } });

    expect(screen.getByTestId('student-interviews-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('Full-Stack Software Engineer')).not.toBeInTheDocument();
  });

  it('renders empty state when student has zero interviews', async () => {
    vi.spyOn(interviewApi, 'getMyInterviews').mockResolvedValueOnce([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('student-interviews-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/You do not have any interviews scheduled yet/i)).toBeInTheDocument();
    });
  });

  it('displays error alert with retry button when API fails', async () => {
    const apiError: ApiErrorResponse = {
      success: false,
      message: 'Failed to fetch interviews',
      error_code: 'INTERNAL_SERVER_ERROR',
      status: 500,
    };

    const getSpy = vi.spyOn(interviewApi, 'getMyInterviews').mockRejectedValueOnce(apiError);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch interviews/i)).toBeInTheDocument();
    });

    // Click retry
    getSpy.mockResolvedValueOnce(mockStudentInterviews);
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Software Engineer')).toBeInTheDocument();
    });
  });
});
