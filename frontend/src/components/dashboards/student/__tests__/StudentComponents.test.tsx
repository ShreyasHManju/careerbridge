import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CareerHeader } from '../CareerHeader';
import { CareerJourneyTracker } from '../CareerJourneyTracker';
import { CareerActionList } from '../CareerActionList';
import { ApplicationJourney } from '../ApplicationJourney';
import { CareerEvidencePreview } from '../CareerEvidencePreview';
import { PassportBanner } from '../PassportBanner';
import { UpcomingCareerEvents } from '../UpcomingCareerEvents';
import { CareerInsightsCard } from '../CareerInsightsCard';
import { StudentDashboard } from '@/types/dashboard';
import { PassportResponse } from '@/types/passport';
import { User } from '@/types/auth';

const mockUser: User = {
  id: 10,
  email: 'alex@example.edu',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const mockDashboard: StudentDashboard = {
  total_applications: 5,
  applications_under_review: 2,
  shortlisted_applications: 1,
  accepted_applications: 1,
  saved_internships: 3,
  upcoming_interviews: 1,
  pending_offers: 1,
  offers_accepted: 1,
};

const mockPassport: PassportResponse = {
  identity: {
    user_id: 10,
    email: 'alex@example.edu',
    full_name: 'Alex Rivera',
    college: 'Metro Tech',
    degree: 'B.S. Software Eng',
    branch: 'Computer Science',
    graduation_year: 2026,
    bio: 'Software engineer building web apps',
    github_url: 'https://github.com/alex',
    linkedin_url: null,
    portfolio_url: null,
    profile_image_url: null,
    is_verified: true,
    created_at: '2026-01-01',
  },
  summary: {
    verified_experiences_count: 1,
    public_projects_count: 2,
    canonical_skills_count: 5,
    completed_milestones_count: 4,
    verified_evidence_count: 3,
    total_evaluations_count: 1,
  },
  verified_experiences: [],
  projects: [],
  skills: [],
  milestones: [],
  verified_evidence: [],
  resume: null,
  is_owner: true,
};

describe('Student Dashboard Modular Subcomponents', () => {
  describe('CareerHeader', () => {
    it('renders student name and verified badge', () => {
      const onRefresh = vi.fn();
      render(
        <CareerHeader
          user={mockUser}
          identity={mockPassport.identity}
          onRefresh={onRefresh}
        />
      );

      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      expect(screen.getByTitle('Verified Account')).toBeInTheDocument();
      expect(screen.getByText(/Comprehensive Profile/i)).toBeInTheDocument();
    });

    it('falls back to email prefix if full_name is absent', () => {
      const onRefresh = vi.fn();
      render(
        <CareerHeader
          user={mockUser}
          identity={null}
          onRefresh={onRefresh}
        />
      );

      expect(screen.getByText('alex')).toBeInTheDocument();
    });
  });

  describe('CareerJourneyTracker', () => {
    it('accurately identifies completed milestones from real data', () => {
      render(
        <MemoryRouter>
          <CareerJourneyTracker dashboard={mockDashboard} passport={mockPassport} />
        </MemoryRouter>
      );

      expect(screen.getByText('Career Journey')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Experiences')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Interviews')).toBeInTheDocument();
      expect(screen.getByText('Offers')).toBeInTheDocument();
      expect(screen.getByText(/1 accepted offer\(s\) • Credentialize to Passport/i)).toBeInTheDocument();
    });
  });

  describe('CareerActionList', () => {
    it('generates high-priority actions for pending offer review, accepted placement credentialing and scheduled interviews', () => {
      render(
        <MemoryRouter>
          <CareerActionList dashboard={mockDashboard} passport={mockPassport} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Review your pending job offer/i)).toBeInTheDocument();
      expect(screen.getByText(/Decision Required/i)).toBeInTheDocument();
      expect(screen.getByText(/Review Offer/i)).toBeInTheDocument();
      expect(screen.getByText(/Credentialize your accepted placement/i)).toBeInTheDocument();
      expect(screen.getByText(/Placement Credential/i)).toBeInTheDocument();
      expect(screen.getByText(/Add to Passport/i)).toBeInTheDocument();
      expect(screen.getByText(/Prepare for your upcoming interview/i)).toBeInTheDocument();
    });

    it('does not render placement credentialing card when accepted_applications is 0', () => {
      const dashboardNoOffers: StudentDashboard = {
        ...mockDashboard,
        accepted_applications: 0,
        pending_offers: 0,
      };

      render(
        <MemoryRouter>
          <CareerActionList dashboard={dashboardNoOffers} passport={mockPassport} />
        </MemoryRouter>
      );

      expect(screen.queryByText(/Review your pending job offer/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Credentialize your accepted placement/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Prepare for your upcoming interview/i)).toBeInTheDocument();
    });
  });

  describe('ApplicationJourney', () => {
    it('renders all stages with valid links and test ids', () => {
      render(
        <MemoryRouter>
          <ApplicationJourney dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('metric-total-applications')).toHaveAttribute('href', '/app/applications');
      expect(screen.getByTestId('metric-applications-under-review')).toHaveAttribute('href', '/app/applications?status=reviewing');
      expect(screen.getByTestId('metric-shortlisted-applications')).toHaveAttribute('href', '/app/applications?status=shortlisted');
      expect(screen.getByTestId('metric-upcoming-interviews')).toHaveAttribute('href', '/app/interviews');
      expect(screen.getByTestId('metric-pending-offers')).toHaveAttribute('href', '/app/applications?status=offered');
      expect(screen.getByTestId('metric-accepted-applications')).toHaveAttribute('href', '/app/applications?status=accepted');
      expect(screen.getByTestId('metric-saved-internships')).toHaveAttribute('href', '/app/saved-jobs');
    });
  });

  describe('CareerEvidencePreview & PassportBanner', () => {
    it('renders verified evidence metrics and passport banner CTA', () => {
      render(
        <MemoryRouter>
          <CareerEvidencePreview passport={mockPassport} />
          <PassportBanner />
        </MemoryRouter>
      );

      expect(screen.getByText('Verified Career Evidence')).toBeInTheDocument();
      expect(screen.getByText('Your Career Passport')).toBeInTheDocument();
      const passportLinks = screen.getAllByRole('link', { name: /View Career Passport/i });
      expect(passportLinks.length).toBe(2);
      expect(passportLinks[0]).toHaveAttribute('href', '/app/passport');
      expect(passportLinks[1]).toHaveAttribute('href', '/app/passport');
    });
  });

  describe('UpcomingCareerEvents', () => {
    it('renders interview count and quick navigation links', () => {
      render(
        <MemoryRouter>
          <UpcomingCareerEvents dashboard={mockDashboard} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('quick-link-jobs')).toHaveAttribute('href', '/app/jobs');
      expect(screen.getByTestId('quick-link-applications')).toHaveAttribute('href', '/app/applications');
      expect(screen.getByTestId('quick-link-interviews')).toHaveAttribute('href', '/app/interviews');
      expect(screen.getByTestId('quick-link-profile')).toHaveAttribute('href', '/app/student/profile');
    });
  });

  describe('CareerInsightsCard', () => {
    it('renders future-ready guidance with honest checklist state', () => {
      render(
        <MemoryRouter>
          <CareerInsightsCard hasSkills={true} hasProjects={true} hasExperiences={false} />
        </MemoryRouter>
      );

      expect(screen.getByText('Career Insights & Guidance')).toBeInTheDocument();
      expect(screen.getByText(/Personalized career insights, skill-gap analysis/i)).toBeInTheDocument();
    });
  });
});
