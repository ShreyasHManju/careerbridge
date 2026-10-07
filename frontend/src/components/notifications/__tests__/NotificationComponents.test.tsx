import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationItem, getNotificationDestination, isActionRequired, getNotificationCTA } from '../NotificationItem';
import { NotificationBadge } from '../NotificationBadge';
import { NotificationPreferencesTab } from '../NotificationPreferencesTab';
import * as notificationsApi from '@/api/notifications';
import { Notification, NotificationPreference } from '@/types/notification';

const mockNotification: Notification = {
  id: 201,
  user_id: 1,
  notification_type: 'job_invitation_received',
  title: 'Interview Opportunity at Acme Corp',
  message: 'You have been invited to apply for Senior Frontend Engineer.',
  is_read: false,
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  read_at: null,
};

const mockReadNotification: Notification = {
  id: 202,
  user_id: 1,
  notification_type: 'experience_verification_changed',
  title: 'Experience Verified',
  message: "Your experience at 'Acme Corp' has been verified!",
  is_read: true,
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  read_at: new Date().toISOString(),
};

describe('NotificationItem Component', () => {
  it('renders notification title, message, and unread state correctly', () => {
    render(<NotificationItem notification={mockNotification} userRole="student" />);

    expect(screen.getByText('Interview Opportunity at Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('You have been invited to apply for Senior Frontend Engineer.')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByTestId('action-required-badge')).toHaveTextContent('Action Required');
    expect(screen.getByText('Accept / Decline →')).toBeInTheDocument();
  });

  it('renders read state and info tag for informational notifications', () => {
    render(<NotificationItem notification={mockReadNotification} userRole="student" />);

    expect(screen.getByText('Experience Verified')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('View Experience →')).toBeInTheDocument();
  });

  it('handles item click to trigger onNavigate and onMarkAsRead for unread notification', async () => {
    const user = userEvent.setup();
    const handleNavigate = vi.fn();
    const handleMarkAsRead = vi.fn();

    render(
      <NotificationItem
        notification={mockNotification}
        userRole="student"
        onNavigate={handleNavigate}
        onMarkAsRead={handleMarkAsRead}
      />
    );

    const item = screen.getByTestId('notification-item-201');
    await user.click(item);

    expect(handleMarkAsRead).toHaveBeenCalledWith(201);
    expect(handleNavigate).toHaveBeenCalledWith('/app/invitations');
  });

  it('handles CTA button click specifically', async () => {
    const user = userEvent.setup();
    const handleNavigate = vi.fn();
    const handleMarkAsRead = vi.fn();

    render(
      <NotificationItem
        notification={mockNotification}
        userRole="student"
        onNavigate={handleNavigate}
        onMarkAsRead={handleMarkAsRead}
      />
    );

    const ctaBtn = screen.getByRole('button', { name: /Accept \/ Decline/i });
    await user.click(ctaBtn);

    expect(handleMarkAsRead).toHaveBeenCalledWith(201);
    expect(handleNavigate).toHaveBeenCalledWith('/app/invitations');
  });

  it('handles mark-as-read link click without calling onNavigate', async () => {
    const user = userEvent.setup();
    const handleNavigate = vi.fn();
    const handleMarkAsRead = vi.fn();

    render(
      <NotificationItem
        notification={mockNotification}
        userRole="student"
        onNavigate={handleNavigate}
        onMarkAsRead={handleMarkAsRead}
      />
    );

    const markReadBtn = screen.getByRole('button', { name: /Mark "Interview Opportunity at Acme Corp" as read/i });
    await user.click(markReadBtn);

    expect(handleMarkAsRead).toHaveBeenCalledWith(201);
    expect(handleNavigate).not.toHaveBeenCalled();
  });

  it('keyboard Enter triggers item action', async () => {
    const user = userEvent.setup();
    const handleNavigate = vi.fn();
    const handleMarkAsRead = vi.fn();

    render(
      <NotificationItem
        notification={mockNotification}
        userRole="student"
        onNavigate={handleNavigate}
        onMarkAsRead={handleMarkAsRead}
      />
    );

    const item = screen.getByTestId('notification-item-201');
    item.focus();
    await user.keyboard('{Enter}');

    expect(handleMarkAsRead).toHaveBeenCalledWith(201);
    expect(handleNavigate).toHaveBeenCalledWith('/app/invitations');
  });
});

describe('NotificationDeepLink Logic & Action Classification', () => {
  it('correctly maps all 12 notification types to destinations', () => {
    expect(getNotificationDestination('application_submitted', 'recruiter')).toBe('/app/recruiter/applications?status=applied');
    expect(getNotificationDestination('application_submitted', 'student')).toBe('/app/applications');
    expect(getNotificationDestination('application_status_changed', 'student')).toBe('/app/applications');
    expect(getNotificationDestination('interview_scheduled', 'student')).toBe('/app/interviews');
    expect(getNotificationDestination('interview_rescheduled', 'student')).toBe('/app/interviews');
    expect(getNotificationDestination('interview_cancelled', 'recruiter')).toBe('/app/recruiter/interviews');
    expect(getNotificationDestination('project_evaluation_submitted', 'student')).toBe('/app/passport');
    expect(getNotificationDestination('job_invitation_received', 'student')).toBe('/app/invitations');
    expect(getNotificationDestination('job_invitation_responded', 'recruiter')).toBe('/app/recruiter/candidates');
    expect(getNotificationDestination('experience_verification_changed', 'student')).toBe('/app/experiences');
    expect(getNotificationDestination('message_received', 'student')).toBe('/app/messages');
    expect(getNotificationDestination('recruiter_verification_changed', 'recruiter')).toBe('/app/recruiter/profile');
    expect(getNotificationDestination('job_moderation_changed', 'recruiter')).toBe('/app/recruiter/jobs');
    expect(getNotificationDestination('job_moderation_changed', 'admin')).toBe('/app/admin/jobs');
    expect(getNotificationDestination('offer_received', 'student')).toBe('/app/applications?status=offered');
    expect(getNotificationDestination('offer_accepted', 'recruiter')).toBe('/app/recruiter/applications?status=accepted');
    expect(getNotificationDestination('offer_rejected', 'recruiter')).toBe('/app/recruiter/applications?status=rejected');
    expect(getNotificationDestination('offer_withdrawn', 'student')).toBe('/app/applications');
  });

  it('correctly identifies action-required vs informational notification types', () => {
    expect(isActionRequired('job_invitation_received', 'student')).toBe(true);
    expect(isActionRequired('offer_received', 'student')).toBe(true);
    expect(isActionRequired('offer_received', 'recruiter')).toBe(false);
    expect(isActionRequired('offer_accepted', 'recruiter')).toBe(false);
    expect(isActionRequired('application_submitted', 'recruiter')).toBe(true);
    expect(isActionRequired('application_submitted', 'student')).toBe(false);
    expect(isActionRequired('project_evaluation_submitted', 'student')).toBe(true);
    expect(isActionRequired('experience_verification_changed', 'student')).toBe(true);
    expect(isActionRequired('application_status_changed', 'student')).toBe(false);
    expect(isActionRequired('message_received', 'student')).toBe(false);
  });

  it('correctly supplies contextual CTAs', () => {
    expect(getNotificationCTA('job_invitation_received', 'student')).toBe('Accept / Decline');
    expect(getNotificationCTA('offer_received', 'student')).toBe('Review Offer');
    expect(getNotificationCTA('offer_received', 'recruiter')).toBe('View Offer');
    expect(getNotificationCTA('offer_accepted', 'recruiter')).toBe('View Application');
    expect(getNotificationCTA('application_submitted', 'recruiter')).toBe('Review Application');
    expect(getNotificationCTA('project_evaluation_submitted', 'student')).toBe('Review Passport');
    expect(getNotificationCTA('experience_verification_changed', 'student')).toBe('View Experience');
    expect(getNotificationCTA('job_invitation_responded', 'recruiter')).toBe('View Candidate');
  });
});

describe('NotificationBadge Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders controlled unread count correctly', () => {
    render(<NotificationBadge count={5} />);
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('5');
  });

  it('renders null when count is 0 and showZero is false', () => {
    const { container } = render(<NotificationBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders 0 when showZero is true', () => {
    render(<NotificationBadge count={0} showZero={true} />);
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('0');
  });

  it('renders 99+ when count exceeds maxCount', () => {
    render(<NotificationBadge count={150} maxCount={99} />);
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('99+');
  });

  it('fetches unread count automatically when controlled count is undefined', async () => {
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 7 });

    render(<NotificationBadge />);

    expect(await screen.findByTestId('unread-badge')).toHaveTextContent('7');
  });

  it('handles fetch API error safely without crashing', async () => {
    vi.spyOn(notificationsApi, 'getUnreadCount').mockRejectedValue(new Error('Network error'));

    const { container } = render(<NotificationBadge />);
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});

describe('NotificationPreferencesTab Component', () => {
  const mockPref: NotificationPreference = {
    id: 1,
    user_id: 1,
    email_notifications: true,
    frequency: 'instant',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  it('renders preference controls with current values', () => {
    render(
      <NotificationPreferencesTab
        preference={mockPref}
        onFrequencyChange={vi.fn()}
        onEmailToggle={vi.fn()}
        isSaving={false}
      />
    );

    expect(screen.getByTestId('preferences-panel')).toBeInTheDocument();
    expect(screen.getByTestId('freq-instant-radio')).toBeChecked();
    expect(screen.getByTestId('freq-digest-radio')).not.toBeChecked();
    expect(screen.getByTestId('email-notif-checkbox')).toBeChecked();
  });

  it('calls onFrequencyChange when digest option is clicked', async () => {
    const user = userEvent.setup();
    const handleFrequencyChange = vi.fn();

    render(
      <NotificationPreferencesTab
        preference={mockPref}
        onFrequencyChange={handleFrequencyChange}
        onEmailToggle={vi.fn()}
        isSaving={false}
      />
    );

    const digestRadio = screen.getByTestId('freq-digest-radio');
    await user.click(digestRadio);

    expect(handleFrequencyChange).toHaveBeenCalledWith('digest');
  });

  it('calls onEmailToggle when checkbox is clicked', async () => {
    const user = userEvent.setup();
    const handleEmailToggle = vi.fn();

    render(
      <NotificationPreferencesTab
        preference={mockPref}
        onFrequencyChange={vi.fn()}
        onEmailToggle={handleEmailToggle}
        isSaving={false}
      />
    );

    const emailCheckbox = screen.getByTestId('email-notif-checkbox');
    await user.click(emailCheckbox);

    expect(handleEmailToggle).toHaveBeenCalledWith(false);
  });

  it('displays success and error messages appropriately', () => {
    render(
      <NotificationPreferencesTab
        preference={mockPref}
        onFrequencyChange={vi.fn()}
        onEmailToggle={vi.fn()}
        isSaving={false}
        successMessage="Preferences saved successfully"
        errorMessage="Failed to update preference"
      />
    );

    expect(screen.getByText('Preferences saved successfully')).toBeInTheDocument();
    expect(screen.getByText('Failed to update preference')).toBeInTheDocument();
  });
});
