import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminHeader } from '../AdminHeader';
import { GovernanceActionCenter } from '../GovernanceActionCenter';
import { PlatformHealthSnapshot } from '../PlatformHealthSnapshot';
import { MonthlyRegistrationChart } from '../MonthlyRegistrationChart';
import { TrustSafetyPulse } from '../TrustSafetyPulse';
import { AdminQuickActions } from '../AdminQuickActions';
import { AdminDashboard } from '@/types/dashboard';

const mockDashboard: AdminDashboard = {
  total_students: 150,
  total_companies: 30,
  verified_companies: 20, // 10 unverified
  published_internships: 42,
  total_applications: 320,
  application_success_rate: 22.4,
  total_offers_extended: 40,
  total_offers_accepted: 32,
  offer_acceptance_rate: 80.0,
  monthly_registrations: [
    { month: '2026-07', count: 30 },
    { month: '2026-08', count: 60 },
  ],
};

const mockAllVerifiedDashboard: AdminDashboard = {
  ...mockDashboard,
  total_companies: 25,
  verified_companies: 25, // 0 unverified
  total_offers_extended: 30,
  total_offers_accepted: 24,
  offer_acceptance_rate: 80.0,
};

const mockZeroDashboard: AdminDashboard = {
  total_students: 0,
  total_companies: 0,
  verified_companies: 0,
  published_internships: 0,
  total_applications: 0,
  application_success_rate: 0.0,
  total_offers_extended: 0,
  total_offers_accepted: 0,
  offer_acceptance_rate: 0.0,
  monthly_registrations: [],
};

describe('Admin Career OS Components', () => {
  describe('AdminHeader', () => {
    it('renders title, governance badge, and handles refresh action', () => {
      const onRefresh = vi.fn();

      render(
        <AdminHeader
          selectedYear={2026}
          isUpdatingYear={false}
          onRefresh={onRefresh}
        />
      );

      expect(
        screen.getByRole('heading', { level: 1, name: /Administrative Platform Dashboard/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/System Administrator/i)).toBeInTheDocument();

      const refreshBtn = screen.getByTestId('refresh-admin-dashboard-btn');
      expect(refreshBtn).not.toBeDisabled();
      fireEvent.click(refreshBtn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('displays updating indicator when isUpdatingYear is true', () => {
      render(
        <AdminHeader
          selectedYear={2026}
          isUpdatingYear={true}
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByTestId('refresh-admin-dashboard-btn')).toBeDisabled();
      expect(screen.getByText(/Refreshing.../i)).toBeInTheDocument();
    });
  });

  describe('GovernanceActionCenter', () => {
    it('surfaces unverified organizations alert when unverified companies exist', () => {
      render(
        <MemoryRouter>
          <GovernanceActionCenter dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Platform Governance Action Center/i })).toBeInTheDocument();
      expect(screen.getByText(/10 Unverified/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Review Queue/i })).toHaveAttribute(
        'href',
        '/app/admin/recruiters?is_verified=false'
      );
      expect(screen.getByRole('link', { name: /Moderate Postings/i })).toHaveAttribute(
        'href',
        '/app/admin/jobs'
      );
      expect(screen.getByRole('link', { name: /Review Claims/i })).toHaveAttribute(
        'href',
        '/app/admin/experience-verification'
      );
    });

    it('displays all verified status when unverified companies is 0', () => {
      render(
        <MemoryRouter>
          <GovernanceActionCenter dashboard={mockAllVerifiedDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByText(/All Verified/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Manage Recruiters/i })).toHaveAttribute(
        'href',
        '/app/admin/recruiters'
      );
    });
  });

  describe('PlatformHealthSnapshot', () => {
    it('renders all 9 metric cards and formatted success and acceptance rates', () => {
      render(
        <MemoryRouter>
          <PlatformHealthSnapshot dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('metric-total-students')).toHaveTextContent('150');
      expect(screen.getByTestId('metric-total-companies')).toHaveTextContent('30');
      expect(screen.getByTestId('metric-verified-companies')).toHaveTextContent('20');
      expect(screen.getByTestId('metric-published-internships')).toHaveTextContent('42');
      expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('320');
      expect(screen.getByTestId('metric-application-success-rate')).toHaveTextContent('22.4%');
      expect(screen.getByTestId('metric-total-offers-extended')).toHaveTextContent('40');
      expect(screen.getByTestId('metric-total-offers-accepted')).toHaveTextContent('32');
      expect(screen.getByTestId('metric-offer-acceptance-rate')).toHaveTextContent('80.0%');

      expect(screen.getByTestId('metric-total-students')).toHaveAttribute('href', '/app/admin/users?role=student');
      expect(screen.getByTestId('metric-total-companies')).toHaveAttribute('href', '/app/admin/users?role=recruiter');
      expect(screen.getByTestId('metric-verified-companies')).toHaveAttribute('href', '/app/admin/recruiters?is_verified=true');
      expect(screen.getByTestId('metric-published-internships')).toHaveAttribute('href', '/app/admin/jobs?is_active=true');
      expect(screen.getByTestId('metric-total-applications')).toHaveAttribute('href', '/app/admin/jobs');
      expect(screen.getByTestId('metric-total-offers-extended')).toHaveAttribute('href', '/app/admin/jobs');
      expect(screen.getByTestId('metric-total-offers-accepted')).toHaveAttribute('href', '/app/admin/jobs');
    });
  });

  describe('MonthlyRegistrationChart', () => {
    it('renders proportional monthly registration bars', () => {
      const onYearChange = vi.fn();

      render(
        <MonthlyRegistrationChart
          monthlyRegistrations={mockDashboard.monthly_registrations}
          selectedYear={2026}
          isUpdatingYear={false}
          onYearChange={onYearChange}
        />
      );

      expect(screen.getByTestId('monthly-registrations-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-row-2026-07')).toBeInTheDocument();
      expect(screen.getByTestId('bar-count-2026-07')).toHaveTextContent('30 users');

      expect(screen.getByTestId('bar-row-2026-08')).toBeInTheDocument();
      expect(screen.getByTestId('bar-count-2026-08')).toHaveTextContent('60 users');
      expect(screen.getByTestId('bar-fill-2026-08')).toHaveStyle({ width: '100%' });
    });

    it('handles year input validation and submission', () => {
      const onYearChange = vi.fn();

      render(
        <MonthlyRegistrationChart
          monthlyRegistrations={mockDashboard.monthly_registrations}
          selectedYear={2026}
          isUpdatingYear={false}
          onYearChange={onYearChange}
        />
      );

      const yearInput = screen.getByTestId('period-year-input');
      const applyBtn = screen.getByTestId('apply-year-btn');

      // Invalid year
      fireEvent.change(yearInput, { target: { value: '1800' } });
      fireEvent.click(applyBtn);
      expect(screen.getByRole('alert')).toHaveTextContent(/between 2000 and 2100/i);
      expect(onYearChange).not.toHaveBeenCalled();

      // Valid year
      fireEvent.change(yearInput, { target: { value: '2025' } });
      fireEvent.click(applyBtn);
      expect(onYearChange).toHaveBeenCalledWith(2025);
    });

    it('renders empty state when monthlyRegistrations is empty', () => {
      render(
        <MonthlyRegistrationChart
          monthlyRegistrations={mockZeroDashboard.monthly_registrations}
          selectedYear={2026}
          isUpdatingYear={false}
          onYearChange={vi.fn()}
        />
      );

      expect(screen.getByTestId('chart-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No user registration data recorded for calendar year 2026/i)).toBeInTheDocument();
    });
  });

  describe('TrustSafetyPulse', () => {
    it('renders trust and safety multi-tier loop steps', () => {
      render(
        <MemoryRouter>
          <TrustSafetyPulse />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Ecosystem Trust & Verification Loop/i })).toBeInTheDocument();
      expect(screen.getByText(/1. Employer Vetting/i)).toBeInTheDocument();
      expect(screen.getByText(/2. Opportunity Audit/i)).toBeInTheDocument();
      expect(screen.getByText(/3. Experience Verification/i)).toBeInTheDocument();
    });
  });

  describe('AdminQuickActions', () => {
    it('renders all 4 governance action links', () => {
      render(
        <MemoryRouter>
          <AdminQuickActions />
        </MemoryRouter>
      );

      expect(screen.getByTestId('quick-link-admin-users')).toHaveAttribute('href', '/app/admin/users');
      expect(screen.getByTestId('quick-link-admin-recruiters')).toHaveAttribute('href', '/app/admin/recruiters');
      expect(screen.getByTestId('quick-link-admin-jobs')).toHaveAttribute('href', '/app/admin/jobs');
      expect(screen.getByTestId('quick-link-admin-experiences')).toHaveAttribute(
        'href',
        '/app/admin/experience-verification'
      );
    });
  });
});
