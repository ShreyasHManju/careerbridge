import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboardView } from '../StudentDashboardView';
import * as dashboardsApi from '@/api/dashboards';
import { StudentDashboard } from '@/types/dashboard';

const mockPopulatedDashboard: StudentDashboard = {
  total_applications: 8,
  applications_under_review: 3,
  shortlisted_applications: 2,
  accepted_applications: 1,
  saved_internships: 5,
  upcoming_interviews: 2,
};

const mockZeroDashboard: StudentDashboard = {
  total_applications: 0,
  applications_under_review: 0,
  shortlisted_applications: 0,
  accepted_applications: 0,
  saved_internships: 0,
  upcoming_interviews: 0,
};

describe('StudentDashboardView Component (Phase 22)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading indicator while fetching dashboard metrics', () => {
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading your student dashboard metrics.../i)).toBeInTheDocument();
  });

  it('renders all six populated metrics correctly', async () => {
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /Student Dashboard/i })).toBeInTheDocument();

    // 1. Total Applications
    const totalAppCard = screen.getByTestId('metric-total-applications');
    expect(totalAppCard).toHaveTextContent('8');
    expect(totalAppCard).toHaveTextContent(/Total Applications/i);

    // 2. Under Review
    const underReviewCard = screen.getByTestId('metric-applications-under-review');
    expect(underReviewCard).toHaveTextContent('3');
    expect(underReviewCard).toHaveTextContent(/Under Review/i);

    // 3. Shortlisted
    const shortlistedCard = screen.getByTestId('metric-shortlisted-applications');
    expect(shortlistedCard).toHaveTextContent('2');
    expect(shortlistedCard).toHaveTextContent(/Shortlisted/i);

    // 4. Accepted
    const acceptedCard = screen.getByTestId('metric-accepted-applications');
    expect(acceptedCard).toHaveTextContent('1');
    expect(acceptedCard).toHaveTextContent(/Accepted Offers/i);

    // 5. Saved Internships
    const savedCard = screen.getByTestId('metric-saved-internships');
    expect(savedCard).toHaveTextContent('5');
    expect(savedCard).toHaveTextContent(/Saved Opportunities/i);

    // 6. Upcoming Interviews
    const interviewsCard = screen.getByTestId('metric-upcoming-interviews');
    expect(interviewsCard).toHaveTextContent('2');
    expect(interviewsCard).toHaveTextContent(/Upcoming Interviews/i);
  });

  it('renders zero numeric values correctly without treating them as empty/missing', async () => {
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockResolvedValue(mockZeroDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-applications-under-review')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-shortlisted-applications')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-accepted-applications')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-saved-internships')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-upcoming-interviews')).toHaveTextContent('0');
  });

  it('renders all quick action navigation links with valid routes', async () => {
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('quick-link-jobs')).toHaveAttribute('href', '/app/jobs');
    expect(screen.getByTestId('quick-link-applications')).toHaveAttribute('href', '/app/applications');
    expect(screen.getByTestId('quick-link-interviews')).toHaveAttribute('href', '/app/interviews');
    expect(screen.getByTestId('quick-link-profile')).toHaveAttribute('href', '/app/student/profile');
  });

  it('handles error state and allows successful retry', async () => {
    const apiSpy = vi
      .spyOn(dashboardsApi, 'getStudentDashboard')
      .mockRejectedValueOnce({
        success: false,
        message: 'Network error occurred',
        status: 500,
      })
      .mockResolvedValueOnce(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Network error occurred/i)).toBeInTheDocument();

    const retryBtn = screen.getByTestId('retry-student-dashboard-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('8');
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('triggers refresh when refresh button is clicked', async () => {
    const apiSpy = vi
      .spyOn(dashboardsApi, 'getStudentDashboard')
      .mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard-view')).toBeInTheDocument();
    });

    expect(apiSpy).toHaveBeenCalledTimes(1);

    const refreshBtn = screen.getByTestId('refresh-student-dashboard-btn');
    fireEvent.click(refreshBtn);

    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});
