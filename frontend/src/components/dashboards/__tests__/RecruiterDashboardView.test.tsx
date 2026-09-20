import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterDashboardView } from '../RecruiterDashboardView';
import * as dashboardsApi from '@/api/dashboards';
import { RecruiterDashboard } from '@/types/dashboard';

const mockPopulatedDashboard: RecruiterDashboard = {
  active_internships: 4,
  total_applications: 32,
  applications_awaiting_review: 14,
  shortlisted_candidates: 6,
  scheduled_interviews: 5,
};

const mockZeroDashboard: RecruiterDashboard = {
  active_internships: 0,
  total_applications: 0,
  applications_awaiting_review: 0,
  shortlisted_candidates: 0,
  scheduled_interviews: 0,
};

describe('RecruiterDashboardView Component (Phase 22)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading indicator while fetching recruiter metrics', () => {
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading your recruiter dashboard metrics.../i)).toBeInTheDocument();
  });

  it('renders all five populated metrics correctly', async () => {
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /Recruiter Dashboard/i })).toBeInTheDocument();

    // 1. Active Internships
    const activeCard = screen.getByTestId('metric-active-internships');
    expect(activeCard).toHaveTextContent('4');
    expect(activeCard).toHaveTextContent(/Active Internships/i);

    // 2. Total Applications
    const totalAppCard = screen.getByTestId('metric-total-applications');
    expect(totalAppCard).toHaveTextContent('32');
    expect(totalAppCard).toHaveTextContent(/Total Applications/i);

    // 3. Awaiting Review
    const reviewCard = screen.getByTestId('metric-applications-awaiting-review');
    expect(reviewCard).toHaveTextContent('14');
    expect(reviewCard).toHaveTextContent(/Awaiting Review/i);

    // 4. Shortlisted Candidates
    const shortlistedCard = screen.getByTestId('metric-shortlisted-candidates');
    expect(shortlistedCard).toHaveTextContent('6');
    expect(shortlistedCard).toHaveTextContent(/Shortlisted Candidates/i);

    // 5. Scheduled Interviews
    const interviewsCard = screen.getByTestId('metric-scheduled-interviews');
    expect(interviewsCard).toHaveTextContent('5');
    expect(interviewsCard).toHaveTextContent(/Scheduled Interviews/i);
  });

  it('displays candidate review queue action spotlight when applications_awaiting_review > 0', async () => {
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('review-queue-spotlight')).toBeInTheDocument();
    });

    expect(screen.getByTestId('review-queue-spotlight')).toHaveTextContent('14');
    expect(screen.getByTestId('triage-review-queue-btn')).toHaveAttribute(
      'href',
      '/app/recruiter/applications'
    );
  });

  it('hides review queue action spotlight when applications_awaiting_review is 0', async () => {
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockResolvedValue(mockZeroDashboard);

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('review-queue-spotlight')).not.toBeInTheDocument();
  });

  it('renders zero numeric values correctly without treating them as empty', async () => {
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockResolvedValue(mockZeroDashboard);

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-active-internships')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-applications-awaiting-review')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-shortlisted-candidates')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-scheduled-interviews')).toHaveTextContent('0');
  });

  it('renders quick action navigation links with valid routes', async () => {
    vi.spyOn(dashboardsApi, 'getRecruiterDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('quick-link-applications')).toHaveAttribute('href', '/app/recruiter/applications');
    expect(screen.getByTestId('quick-link-interviews')).toHaveAttribute('href', '/app/recruiter/interviews');
    expect(screen.getByTestId('quick-link-jobs')).toHaveAttribute('href', '/app/jobs');
    expect(screen.getByTestId('quick-link-profile')).toHaveAttribute('href', '/app/recruiter/profile');
  });

  it('handles error state and allows successful retry', async () => {
    const apiSpy = vi
      .spyOn(dashboardsApi, 'getRecruiterDashboard')
      .mockRejectedValueOnce({
        success: false,
        message: 'Internal server error',
        status: 500,
      })
      .mockResolvedValueOnce(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <RecruiterDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();

    const retryBtn = screen.getByTestId('retry-recruiter-dashboard-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('recruiter-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-active-internships')).toHaveTextContent('4');
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});
