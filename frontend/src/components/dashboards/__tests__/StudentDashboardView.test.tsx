import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboardView } from '../StudentDashboardView';
import * as dashboardsApi from '@/api/dashboards';
import * as passportApi from '@/api/passport';
import { StudentDashboard } from '@/types/dashboard';
import { PassportResponse } from '@/types/passport';

const mockPopulatedDashboard: StudentDashboard = {
  total_applications: 8,
  applications_under_review: 3,
  shortlisted_applications: 2,
  accepted_applications: 1,
  saved_internships: 5,
  upcoming_interviews: 2,
  pending_offers: 1,
  offers_accepted: 1,
};

const mockZeroDashboard: StudentDashboard = {
  total_applications: 0,
  applications_under_review: 0,
  shortlisted_applications: 0,
  accepted_applications: 0,
  saved_internships: 0,
  upcoming_interviews: 0,
  pending_offers: 0,
  offers_accepted: 0,
};

const mockPassportData: PassportResponse = {
  identity: {
    user_id: 1,
    email: 'student@example.com',
    full_name: 'Shreyas Manju',
    college: 'University Institute of Technology',
    degree: 'B.Tech',
    branch: 'Computer Science',
    graduation_year: 2026,
    bio: 'Aspiring software engineer interested in distributed systems.',
    github_url: 'https://github.com/shreyas',
    linkedin_url: 'https://linkedin.com/in/shreyas',
    portfolio_url: 'https://shreyas.dev',
    profile_image_url: null,
    is_verified: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  summary: {
    verified_experiences_count: 2,
    public_projects_count: 3,
    canonical_skills_count: 8,
    completed_milestones_count: 6,
    verified_evidence_count: 4,
    total_evaluations_count: 2,
    average_project_score: 92.5,
  },
  verified_experiences: [],
  projects: [],
  skills: [],
  milestones: [],
  verified_evidence: [],
  resume: null,
  is_owner: true,
};

describe('StudentDashboardView Component (Career OS)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(passportApi, 'getMyPassport').mockResolvedValue(mockPassportData);
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
    expect(acceptedCard).toHaveTextContent(/Accepted & Credentialed/i);

    // 5. Saved Internships
    const savedCard = screen.getByTestId('metric-saved-internships');
    expect(savedCard).toHaveTextContent('5');
    expect(savedCard).toHaveTextContent(/Saved Opportunities/i);

    // 6. Upcoming Interviews
    const interviewsCard = screen.getByTestId('metric-upcoming-interviews');
    expect(interviewsCard).toHaveTextContent('2');
    expect(interviewsCard).toHaveTextContent(/Upcoming Interviews/i);

    // 7. Pending Offers
    const pendingOfferCard = screen.getByTestId('metric-pending-offers');
    expect(pendingOfferCard).toHaveTextContent('1');
    expect(pendingOfferCard).toHaveTextContent(/Offers Received/i);
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
    expect(screen.getByTestId('metric-pending-offers')).toHaveTextContent('0');
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

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('renders metric cards as accessible links with appropriate destinations and query filters', async () => {
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await screen.findByTestId('student-dashboard-view');

    expect(screen.getByTestId('metric-total-applications')).toHaveAttribute('href', '/app/applications');
    expect(screen.getByTestId('metric-applications-under-review')).toHaveAttribute('href', '/app/applications?status=reviewing');
    expect(screen.getByTestId('metric-shortlisted-applications')).toHaveAttribute('href', '/app/applications?status=shortlisted');
    expect(screen.getByTestId('metric-upcoming-interviews')).toHaveAttribute('href', '/app/interviews');
    expect(screen.getByTestId('metric-pending-offers')).toHaveAttribute('href', '/app/applications?status=offered');
    expect(screen.getByTestId('metric-accepted-applications')).toHaveAttribute('href', '/app/applications?status=accepted');
    expect(screen.getByTestId('metric-saved-internships')).toHaveAttribute('href', '/app/saved-jobs');
  });

  it('renders Student Career OS sections including Career Journey, Actions, Evidence, and Passport', async () => {
    vi.spyOn(dashboardsApi, 'getStudentDashboard').mockResolvedValue(mockPopulatedDashboard);

    render(
      <MemoryRouter>
        <StudentDashboardView />
      </MemoryRouter>
    );

    await screen.findByTestId('student-dashboard-view');

    // Personalized greeting & Passport name
    expect(screen.getByText(/Shreyas Manju/i)).toBeInTheDocument();

    // Section headings
    expect(screen.getByRole('heading', { level: 2, name: /Career Journey/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /What should I do next\?/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Application Journey & Funnel/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Verified Career Evidence/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Your Career Passport/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Career Insights & Guidance/i })).toBeInTheDocument();

    // Real Passport summary counts rendered
    expect(screen.getByText(/Innovation Projects/i)).toBeInTheDocument();
    expect(screen.getByText(/Documented Skills/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Experiences/i)).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });
});
