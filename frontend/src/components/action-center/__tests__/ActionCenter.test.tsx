import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActionCenter } from '../ActionCenter';
import { ActionCenterItem } from '../ActionCenterItem';
import { ActionCenterBadge } from '../ActionCenterBadge';
import { ActionItem } from '@/types/actionCenter';

const mockActions: ActionItem[] = [
  {
    id: 'act-1',
    title: 'Interview Preparation',
    description: 'You have an upcoming interview round tomorrow.',
    destination: '/app/interviews',
    ctaLabel: 'View Interviews',
    priority: 'urgent',
    category: 'interview',
    count: 1,
    badgeText: 'Urgent Action',
    sourceDomain: 'student',
    notificationType: 'interview_scheduled',
  },
  {
    id: 'act-2',
    title: 'Verify Candidate Claims',
    description: 'Review pending supervisor verifications.',
    destination: '/app/admin/experience-verification',
    ctaLabel: 'Review Claims',
    priority: 'high',
    category: 'experience_verification',
    count: 5,
    badgeText: 'High Priority',
    sourceDomain: 'admin',
    notificationType: 'experience_verification_changed',
  },
  {
    id: 'act-3',
    title: 'Candidate Triage',
    description: '12 new applications waiting for recruiter review.',
    destination: '/app/recruiter/applications?status=applied',
    ctaLabel: 'Triage Queue',
    priority: 'standard',
    category: 'application',
    count: 12,
    badgeText: 'Active Queue',
    sourceDomain: 'recruiter',
    notificationType: 'application_submitted',
  },
];

describe('Action Center Shared Presentation Layer', () => {
  describe('ActionCenterBadge', () => {
    it('renders priority badge and count correctly', () => {
      render(<ActionCenterBadge priority="urgent" count={3} label="Urgent Action" />);
      const badge = screen.getByTestId('action-center-badge');
      expect(badge).toHaveClass('cb-badge-urgent');
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Urgent Action')).toBeInTheDocument();
    });

    it('renders default label based on priority when none is provided', () => {
      const { rerender } = render(<ActionCenterBadge priority="high" />);
      expect(screen.getByText('High Priority')).toBeInTheDocument();

      rerender(<ActionCenterBadge priority="standard" />);
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('ActionCenterItem', () => {
    it('renders item title, description, and deep link', () => {
      render(
        <MemoryRouter>
          <ActionCenterItem action={mockActions[0]} />
        </MemoryRouter>
      );

      const itemCard = screen.getByTestId('action-center-item-act-1');
      expect(itemCard).toHaveClass('cb-action-priority-urgent');
      expect(screen.getByText('Interview Preparation')).toBeInTheDocument();
      expect(screen.getByText(/You have an upcoming interview round tomorrow/i)).toBeInTheDocument();

      const link = screen.getByRole('link', { name: /View Interviews/i });
      expect(link).toHaveAttribute('href', '/app/interviews');
    });

    it('renders appropriate icons for diverse categories', () => {
      const { rerender } = render(
        <MemoryRouter>
          <ActionCenterItem
            action={{
              id: 'job-mod',
              title: 'Job Moderation',
              description: 'Review flag on job posting',
              destination: '/app/admin/jobs',
              ctaLabel: 'Moderate',
              priority: 'high',
              category: 'job_moderation',
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Job Moderation')).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <ActionCenterItem
            action={{
              id: 'user-gov',
              title: 'User Governance',
              description: 'Manage deactivated account',
              destination: '/app/admin/users',
              ctaLabel: 'Manage',
              priority: 'standard',
              category: 'user_governance',
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('User Governance')).toBeInTheDocument();
    });
  });

  describe('ActionCenter Container', () => {
    it('renders header, subtitle, and list of actions', () => {
      render(
        <MemoryRouter>
          <ActionCenter
            actions={mockActions}
            config={{
              title: 'Today Operations',
              subtitle: 'Operational items requiring attention',
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 2, name: /Today Operations/i })).toBeInTheDocument();
      expect(screen.getByText(/Operational items requiring attention/i)).toBeInTheDocument();
      expect(screen.getByTestId('action-center-list')).toBeInTheDocument();
      expect(screen.getAllByRole('link').length).toBe(3);
    });

    it('limits displayed items when maxItems is specified', () => {
      render(
        <MemoryRouter>
          <ActionCenter
            actions={mockActions}
            config={{
              maxItems: 2,
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('action-center-item-act-1')).toBeInTheDocument();
      expect(screen.getByTestId('action-center-item-act-2')).toBeInTheDocument();
      expect(screen.queryByTestId('action-center-item-act-3')).not.toBeInTheDocument();
    });

    it('renders empty state when actions array is empty', () => {
      render(
        <MemoryRouter>
          <ActionCenter
            actions={[]}
            config={{
              emptyTitle: 'No Pending Actions',
              emptyDescription: 'Everything is up to date in your workspace.',
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('action-center-empty')).toBeInTheDocument();
      expect(screen.getByText('No Pending Actions')).toBeInTheDocument();
      expect(screen.getByText('Everything is up to date in your workspace.')).toBeInTheDocument();
    });

    it('renders loading state when isLoading is true', () => {
      render(
        <MemoryRouter>
          <ActionCenter actions={mockActions} isLoading={true} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('action-center-loading')).toBeInTheDocument();
    });
  });
});
