import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardView } from '../AdminDashboardView';
import * as dashboardsApi from '@/api/dashboards';
import { AdminDashboard } from '@/types/dashboard';

const mockAdminDashboard: AdminDashboard = {
  total_students: 142,
  total_companies: 28,
  verified_companies: 22,
  published_internships: 35,
  total_applications: 310,
  application_success_rate: 18.5,
  monthly_registrations: [
    { month: '2026-08', count: 45 },
    { month: '2026-09', count: 68 },
  ],
};

const mockZeroAdminDashboard: AdminDashboard = {
  total_students: 0,
  total_companies: 0,
  verified_companies: 0,
  published_internships: 0,
  total_applications: 0,
  application_success_rate: 0.0,
  monthly_registrations: [],
};

const mockSingleMonthAdminDashboard: AdminDashboard = {
  ...mockAdminDashboard,
  monthly_registrations: [{ month: '2026-01', count: 12 }],
};

describe('AdminDashboardView Component (Phase 22)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state while retrieving platform analytics', () => {
    vi.spyOn(dashboardsApi, 'getAdminDashboard').mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading platform-wide administrative metrics/i)).toBeInTheDocument();
  });

  it('renders all platform KPIs and formatted success rate', async () => {
    vi.spyOn(dashboardsApi, 'getAdminDashboard').mockResolvedValue(mockAdminDashboard);

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /Administrative Platform Dashboard/i })).toBeInTheDocument();

    expect(screen.getByTestId('metric-total-students')).toHaveTextContent('142');
    expect(screen.getByTestId('metric-total-companies')).toHaveTextContent('28');
    expect(screen.getByTestId('metric-verified-companies')).toHaveTextContent('22');
    expect(screen.getByTestId('metric-published-internships')).toHaveTextContent('35');
    expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('310');
    expect(screen.getByTestId('metric-application-success-rate')).toHaveTextContent('18.5%');
  });

  it('renders monthly registration proportional bars correctly', async () => {
    vi.spyOn(dashboardsApi, 'getAdminDashboard').mockResolvedValue(mockAdminDashboard);

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monthly-registrations-chart')).toBeInTheDocument();
    });

    // Check August row
    const augRow = screen.getByTestId('bar-row-2026-08');
    expect(augRow).toBeInTheDocument();
    expect(screen.getByTestId('bar-count-2026-08')).toHaveTextContent('45 users');

    // Check September row
    const sepRow = screen.getByTestId('bar-row-2026-09');
    expect(sepRow).toBeInTheDocument();
    expect(screen.getByTestId('bar-count-2026-09')).toHaveTextContent('68 users');

    // September has max count (68) -> bar width is 100%
    const sepFill = screen.getByTestId('bar-fill-2026-09');
    expect(sepFill).toHaveStyle({ width: '100%' });

    // August is (45 / 68) -> ~66%
    const augFill = screen.getByTestId('bar-fill-2026-08');
    expect(augFill).toHaveStyle({ width: '66%' });
  });

  it('renders single-month registration data without division errors', async () => {
    vi.spyOn(dashboardsApi, 'getAdminDashboard').mockResolvedValue(mockSingleMonthAdminDashboard);

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('bar-row-2026-01')).toBeInTheDocument();
    });

    expect(screen.getByTestId('bar-count-2026-01')).toHaveTextContent('12 users');
    expect(screen.getByTestId('bar-fill-2026-01')).toHaveStyle({ width: '100%' });
  });

  it('renders empty state message when monthly_registrations is empty', async () => {
    vi.spyOn(dashboardsApi, 'getAdminDashboard').mockResolvedValue(mockZeroAdminDashboard);

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/No user registration data recorded/i)).toBeInTheDocument();
  });

  it('handles year filter submission with validation and API refetch', async () => {
    const apiSpy = vi
      .spyOn(dashboardsApi, 'getAdminDashboard')
      .mockResolvedValue(mockAdminDashboard);

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard-view')).toBeInTheDocument();
    });

    const yearInput = screen.getByTestId('period-year-input');
    const applyBtn = screen.getByTestId('apply-year-btn');

    // Enter invalid year
    fireEvent.change(yearInput, { target: { value: '1850' } });
    fireEvent.click(applyBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/between 2000 and 2100/i);

    // Enter valid year
    fireEvent.change(yearInput, { target: { value: '2025' } });
    fireEvent.click(applyBtn);

    expect(apiSpy).toHaveBeenCalledWith(2025);
  });

  it('handles error state and allows retry', async () => {
    const apiSpy = vi
      .spyOn(dashboardsApi, 'getAdminDashboard')
      .mockRejectedValueOnce({
        success: false,
        message: 'Database query timeout',
        status: 503,
      })
      .mockResolvedValueOnce(mockAdminDashboard);

    render(
      <MemoryRouter>
        <AdminDashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Database query timeout/i)).toBeInTheDocument();

    const retryBtn = screen.getByTestId('retry-admin-dashboard-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-total-students')).toHaveTextContent('142');
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});
