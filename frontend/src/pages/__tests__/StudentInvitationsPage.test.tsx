import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentInvitationsPage } from '../StudentInvitationsPage';
import * as invitationsApi from '@/api/invitations';
import { JobInvitation } from '@/types/invitation';

const mockInvitations: JobInvitation[] = [
  {
    id: 1,
    job_id: 101,
    recruiter_id: 20,
    student_id: 5,
    message: 'We were impressed by your distributed systems project! Please apply.',
    status: 'pending',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    job_posting: {
      id: 101,
      title: 'Distributed Systems Engineer',
      company_name: 'Apex Global Tech',
      location: 'Remote',
      is_remote: true,
      opportunity_type: 'job',
      is_active: true,
    },
    recruiter: {
      id: 20,
      full_name: 'Sarah Connor',
      company_name: 'Apex Global Tech',
    },
  },
  {
    id: 2,
    job_id: 102,
    recruiter_id: 21,
    student_id: 5,
    message: 'Join our cloud infrastructure team.',
    status: 'accepted',
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-21T10:00:00Z',
    responded_at: '2026-08-21T10:00:00Z',
    job_posting: {
      id: 102,
      title: 'Cloud Architect Intern',
      company_name: 'Quantum Byte Inc',
      location: 'Atlanta, GA',
      is_remote: false,
      opportunity_type: 'internship',
      is_active: true,
    },
    recruiter: {
      id: 21,
      full_name: 'Miles Dyson',
      company_name: 'Quantum Byte Inc',
    },
  },
];

describe('StudentInvitationsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders page header, tabs, and list of invitations', async () => {
    vi.spyOn(invitationsApi, 'getStudentInvitations').mockResolvedValue(mockInvitations);

    render(
      <MemoryRouter>
        <StudentInvitationsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Job Invitations' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('filter-tab-all')).toHaveTextContent('All (2)');
      expect(screen.getByTestId('filter-tab-pending')).toHaveTextContent('Pending 1');
      expect(screen.getByText('Distributed Systems Engineer')).toBeInTheDocument();
      expect(screen.getByText('Cloud Architect Intern')).toBeInTheDocument();
      expect(screen.getByText(/"We were impressed by your distributed systems project! Please apply."/)).toBeInTheDocument();
    });
  });

  it('2. filters invitations by status tab', async () => {
    vi.spyOn(invitationsApi, 'getStudentInvitations').mockResolvedValue(mockInvitations);

    render(
      <MemoryRouter>
        <StudentInvitationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Distributed Systems Engineer')).toBeInTheDocument();
    });

    const pendingTab = screen.getByTestId('filter-tab-pending');
    fireEvent.click(pendingTab);

    expect(screen.getByText('Distributed Systems Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Cloud Architect Intern')).not.toBeInTheDocument();

    const acceptedTab = screen.getByTestId('filter-tab-accepted');
    fireEvent.click(acceptedTab);

    expect(screen.queryByText('Distributed Systems Engineer')).not.toBeInTheDocument();
    expect(screen.getByText('Cloud Architect Intern')).toBeInTheDocument();
  });

  it('3. accepts a pending invitation and shows success toast and apply button', async () => {
    vi.spyOn(invitationsApi, 'getStudentInvitations').mockResolvedValue(mockInvitations);

    const respondSpy = vi.spyOn(invitationsApi, 'respondToJobInvitation').mockResolvedValue({
      ...mockInvitations[0],
      status: 'accepted',
      responded_at: '2026-09-02T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <StudentInvitationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('accept-invite-btn-1')).toBeInTheDocument();
    });

    const acceptBtn = screen.getByTestId('accept-invite-btn-1');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith(1, { status: 'accepted' });
      expect(screen.getByTestId('invitation-toast-alert')).toHaveTextContent(
        'Invitation accepted! You can now proceed to submit your application.'
      );
      expect(screen.getByTestId('apply-now-btn-1')).toBeInTheDocument();
    });
  });

  it('4. declines a pending invitation', async () => {
    vi.spyOn(invitationsApi, 'getStudentInvitations').mockResolvedValue(mockInvitations);

    const respondSpy = vi.spyOn(invitationsApi, 'respondToJobInvitation').mockResolvedValue({
      ...mockInvitations[0],
      status: 'declined',
      responded_at: '2026-09-02T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <StudentInvitationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('decline-invite-btn-1')).toBeInTheDocument();
    });

    const declineBtn = screen.getByTestId('decline-invite-btn-1');
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith(1, { status: 'declined' });
      expect(screen.getByTestId('invitation-toast-alert')).toHaveTextContent('Invitation declined.');
    });
  });

  it('5. renders error state when API fails', async () => {
    vi.spyOn(invitationsApi, 'getStudentInvitations').mockRejectedValue({
      detail: 'Failed to fetch student invitations',
    });

    render(
      <MemoryRouter>
        <StudentInvitationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('invitations-error-alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch student invitations')).toBeInTheDocument();
    });
  });

  it('6. renders empty state when no invitations exist', async () => {
    vi.spyOn(invitationsApi, 'getStudentInvitations').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <StudentInvitationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('invitations-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Invitations Found')).toBeInTheDocument();
    });
  });
});
