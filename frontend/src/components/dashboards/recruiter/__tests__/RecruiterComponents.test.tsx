import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterHeader } from '../RecruiterHeader';
import { HiringActionCenter } from '../HiringActionCenter';
import { RecruitmentFunnel } from '../RecruitmentFunnel';
import { ActiveJobsSnapshot } from '../ActiveJobsSnapshot';
import { TalentEvidencePulse } from '../TalentEvidencePulse';
import { RecruiterQuickActions } from '../RecruiterQuickActions';
import { RecruiterDashboard } from '@/types/dashboard';

const mockDashboard: RecruiterDashboard = {
  active_internships: 3,
  total_applications: 24,
  applications_awaiting_review: 8,
  shortlisted_candidates: 5,
  scheduled_interviews: 2,
};

const mockZeroDashboard: RecruiterDashboard = {
  active_internships: 0,
  total_applications: 0,
  applications_awaiting_review: 0,
  shortlisted_candidates: 0,
  scheduled_interviews: 0,
};

describe('Recruiter Career OS Components', () => {
  describe('RecruiterHeader', () => {
    it('renders title, verified badge, and buttons', () => {
      const onExport = vi.fn();
      const onRefresh = vi.fn();
      const onDismissToast = vi.fn();

      render(
        <RecruiterHeader
          totalApplications={24}
          isExporting={false}
          exportToast={null}
          onExport={onExport}
          onRefresh={onRefresh}
          onDismissToast={onDismissToast}
        />
      );

      expect(screen.getByRole('heading', { level: 1, name: /Recruiter Dashboard/i })).toBeInTheDocument();
      expect(screen.getByText(/Verified Employer/i)).toBeInTheDocument();

      const exportBtn = screen.getByTestId('dashboard-export-apps-btn');
      expect(exportBtn).not.toBeDisabled();
      fireEvent.click(exportBtn);
      expect(onExport).toHaveBeenCalledTimes(1);

      const refreshBtn = screen.getByTestId('refresh-recruiter-dashboard-btn');
      fireEvent.click(refreshBtn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('disables export button when total applications is 0 or is exporting', () => {
      const onExport = vi.fn();
      const onRefresh = vi.fn();
      const onDismissToast = vi.fn();

      const { rerender } = render(
        <RecruiterHeader
          totalApplications={0}
          isExporting={false}
          exportToast={null}
          onExport={onExport}
          onRefresh={onRefresh}
          onDismissToast={onDismissToast}
        />
      );

      expect(screen.getByTestId('dashboard-export-apps-btn')).toBeDisabled();

      rerender(
        <RecruiterHeader
          totalApplications={10}
          isExporting={true}
          exportToast={null}
          onExport={onExport}
          onRefresh={onRefresh}
          onDismissToast={onDismissToast}
        />
      );

      expect(screen.getByTestId('dashboard-export-apps-btn')).toBeDisabled();
      expect(screen.getByText(/Exporting.../i)).toBeInTheDocument();
    });

    it('displays and dismisses export toast', () => {
      const onExport = vi.fn();
      const onRefresh = vi.fn();
      const onDismissToast = vi.fn();

      render(
        <RecruiterHeader
          totalApplications={24}
          isExporting={false}
          exportToast="Export completed successfully"
          onExport={onExport}
          onRefresh={onRefresh}
          onDismissToast={onDismissToast}
        />
      );

      expect(screen.getByTestId('dashboard-export-toast')).toBeInTheDocument();
      expect(screen.getByText('Export completed successfully')).toBeInTheDocument();

      const dismissBtn = screen.getByLabelText('Dismiss toast');
      fireEvent.click(dismissBtn);
      expect(onDismissToast).toHaveBeenCalledTimes(1);
    });
  });

  describe('HiringActionCenter', () => {
    it('renders all 5 metric cards and triage alert when reviews are pending', () => {
      render(
        <MemoryRouter>
          <HiringActionCenter dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('review-queue-spotlight')).toHaveTextContent('8');
      expect(screen.getByTestId('metric-active-internships')).toHaveTextContent('3');
      expect(screen.getByTestId('metric-total-applications')).toHaveTextContent('24');
      expect(screen.getByTestId('metric-applications-awaiting-review')).toHaveTextContent('8');
      expect(screen.getByTestId('metric-shortlisted-candidates')).toHaveTextContent('5');
      expect(screen.getByTestId('metric-scheduled-interviews')).toHaveTextContent('2');

      // Recommended hiring actions
      expect(screen.getByText(/Candidate Evaluation Queue/i)).toBeInTheDocument();
      expect(screen.getByText(/Technical Interview Operations/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified Talent Discovery/i)).toBeInTheDocument();
    });

    it('hides triage alert when reviews count is 0', () => {
      render(
        <MemoryRouter>
          <HiringActionCenter dashboard={mockZeroDashboard} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('review-queue-spotlight')).not.toBeInTheDocument();
    });
  });

  describe('RecruitmentFunnel', () => {
    it('renders calculated conversion rates and visual progress bars', () => {
      render(
        <MemoryRouter>
          <RecruitmentFunnel dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('recruiter-funnel-section')).toBeInTheDocument();
      expect(screen.getByText(/Candidate Conversion & Pipeline Funnel/i)).toBeInTheDocument();
      expect(screen.getByText(/Evaluation Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Shortlist Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Interview Scheduling Rate/i)).toBeInTheDocument();

      // 24 total, 8 awaiting => 16 reviewed => 67%
      expect(screen.getByText('67%')).toBeInTheDocument();
      // 5 shortlisted / 24 => 21%
      expect(screen.getByText('21%')).toBeInTheDocument();
      // 2 interviews / 24 => 8%
      expect(screen.getByText('8%')).toBeInTheDocument();
    });

    it('renders empty state when total applications is 0', () => {
      render(
        <MemoryRouter>
          <RecruitmentFunnel dashboard={mockZeroDashboard} />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/No applications received yet. As candidates apply to your active listings/i)
      ).toBeInTheDocument();
    });
  });

  describe('ActiveJobsSnapshot', () => {
    it('renders active roles, applicant pool, and average metrics', () => {
      render(
        <MemoryRouter>
          <ActiveJobsSnapshot dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Active Opportunities & Listings/i })).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('24')).toBeInTheDocument();
      expect(screen.getByText('8.0')).toBeInTheDocument(); // 24 / 3 = 8.0
    });

    it('renders prompt to publish when active listings is 0', () => {
      render(
        <MemoryRouter>
          <ActiveJobsSnapshot dashboard={mockZeroDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByText(/You have no active opportunities published/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Publish New Opportunity/i })).toHaveAttribute(
        'href',
        '/app/recruiter/jobs'
      );
    });
  });

  describe('TalentEvidencePulse', () => {
    it('renders verified passport, rubric, and experience verification features', () => {
      render(
        <MemoryRouter>
          <TalentEvidencePulse />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Verified Talent Evidence & Identity/i })).toBeInTheDocument();
      expect(screen.getByText(/Verified Experience Passports/i)).toBeInTheDocument();
      expect(screen.getByText(/Project Rubric Evaluations/i)).toBeInTheDocument();
      expect(screen.getByText(/Experience Verifications/i)).toBeInTheDocument();
    });
  });

  describe('RecruiterQuickActions', () => {
    it('renders all 5 quick navigation action links', () => {
      render(
        <MemoryRouter>
          <RecruiterQuickActions />
        </MemoryRouter>
      );

      expect(screen.getByTestId('quick-link-candidates')).toHaveAttribute('href', '/app/recruiter/candidates');
      expect(screen.getByTestId('quick-link-applications')).toHaveAttribute('href', '/app/recruiter/applications');
      expect(screen.getByTestId('quick-link-jobs')).toHaveAttribute('href', '/app/jobs');
      expect(screen.getByTestId('quick-link-interviews')).toHaveAttribute('href', '/app/recruiter/interviews');
      expect(screen.getByTestId('quick-link-profile')).toHaveAttribute('href', '/app/recruiter/profile');
    });
  });
});
