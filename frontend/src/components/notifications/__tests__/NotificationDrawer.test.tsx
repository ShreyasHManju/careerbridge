import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotificationDrawer, getNotificationDestination } from '../NotificationDrawer';
import * as notificationsApi from '@/api/notifications';
import * as useAuthModule from '@/auth/useAuth';
import { Notification, NotificationPreference } from '@/types/notification';

const renderDrawer = (props = {}) => {
  return render(
    <MemoryRouter>
      <NotificationDrawer {...props} />
    </MemoryRouter>
  );
};

const mockUnreadNotification: Notification = {
  id: 101,
  user_id: 1,
  notification_type: 'application_submitted',
  title: 'Application Received',
  message: 'Your application for Backend Engineer was received.',
  is_read: false,
  created_at: '2026-09-20T08:30:00Z',
  read_at: null,
};

const mockReadNotification: Notification = {
  id: 102,
  user_id: 1,
  notification_type: 'job_moderation_changed',
  title: 'Job Approved',
  message: 'Your job posting has been approved by admin.',
  is_read: true,
  created_at: '2026-09-19T12:00:00Z',
  read_at: '2026-09-19T13:00:00Z',
};

describe('NotificationDrawer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'user@example.com',
        role: 'student',
        is_active: true,
        is_verified: true,
        created_at: '',
        updated_at: '',
      },
      isAuthenticated: true,
      isLoading: false,
      token: 'valid-token',
      error: null,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders notification bell button with unread count badge and accessibility attributes on mount', async () => {
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 2 });

    renderDrawer();

    const bellBtn = await screen.findByRole('button', { name: /Notifications \(2 unread\)/i });
    expect(bellBtn).toBeInTheDocument();
    expect(bellBtn).toHaveAttribute('aria-expanded', 'false');
    expect(bellBtn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(bellBtn).toHaveAttribute('aria-controls', 'cb-notifications-panel');
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('2');
  });

  it('renders 99+ badge when unread count exceeds 99', async () => {
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 120 });

    renderDrawer();

    const bellBtn = await screen.findByRole('button', { name: /Notifications \(120 unread\)/i });
    expect(bellBtn).toBeInTheDocument();
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('99+');
  });

  it('opens panel and loads notifications when bell button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 1 });
    vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValue({
      items: [mockUnreadNotification, mockReadNotification],
      page: 1,
      page_size: 20,
      total: 2,
      total_pages: 1,
    });

    renderDrawer();

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    await user.click(bellBtn);

    expect(bellBtn).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: /Notifications/i });
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('id', 'cb-notifications-panel');
    expect(panel).toHaveAttribute('aria-labelledby', 'cb-notifications-heading');

    expect(await screen.findByText('Application Received')).toBeInTheDocument();
    expect(screen.getByText('Job Approved')).toBeInTheDocument();

    // Verify status text badges (accessible, non-color-only)
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('closes panel and restores focus to bell button when Escape key is pressed or close button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
    vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
    });

    renderDrawer();

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    await user.click(bellBtn);

    expect(screen.getByRole('region', { name: /Notifications/i })).toBeInTheDocument();

    // Close via close button
    const closeBtn = screen.getByRole('button', { name: /Close notifications/i });
    await user.click(closeBtn);

    expect(screen.queryByRole('region', { name: /Notifications/i })).not.toBeInTheDocument();

    // Re-open and close via Escape key
    await user.click(bellBtn);
    expect(screen.getByRole('region', { name: /Notifications/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: /Notifications/i })).not.toBeInTheDocument();
    expect(bellBtn).toHaveFocus();
  });

  it('filters by unread notifications when Unread tab is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 1 });
    const getNotificationsSpy = vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValueOnce({
      items: [mockUnreadNotification, mockReadNotification],
      page: 1,
      page_size: 20,
      total: 2,
      total_pages: 1,
    }).mockResolvedValueOnce({
      items: [mockUnreadNotification],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    });

    renderDrawer();

    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    await screen.findByText('Application Received');

    // Click Unread tab
    const unreadTab = screen.getByRole('tab', { name: /^Unread/i });
    await user.click(unreadTab);

    await waitFor(() => {
      expect(getNotificationsSpy).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        unread_only: true,
      });
    });
  });

  it('marks a single notification as read in All mode using backend response and syncs count', async () => {
    const user = userEvent.setup();
    const countSpy = vi.spyOn(notificationsApi, 'getUnreadCount')
      .mockResolvedValueOnce({ unread_count: 1 }) // initial
      .mockResolvedValueOnce({ unread_count: 1 }) // on open
      .mockResolvedValueOnce({ unread_count: 0 }); // after mark read
    vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValue({
      items: [mockUnreadNotification],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    });
    const markSpy = vi.spyOn(notificationsApi, 'markNotificationAsRead').mockResolvedValue({
      ...mockUnreadNotification,
      is_read: true,
      read_at: '2026-09-20T09:00:00Z',
    });

    renderDrawer();

    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    await screen.findByText('Application Received');

    const markBtn = screen.getByRole('button', { name: /Mark "Application Received" as read/i });
    await user.click(markBtn);

    expect(markSpy).toHaveBeenCalledWith(101);

    // Item displays as Read with backend data
    await waitFor(() => {
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mark "Application Received" as read/i })).not.toBeInTheDocument();
      expect(countSpy).toHaveBeenCalledTimes(3);
    });
  });

  it('removes item from list when marked as read while Unread filter is active', async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, 'getUnreadCount')
      .mockResolvedValueOnce({ unread_count: 1 })
      .mockResolvedValueOnce({ unread_count: 1 })
      .mockResolvedValueOnce({ unread_count: 1 })
      .mockResolvedValueOnce({ unread_count: 0 });
    vi.spyOn(notificationsApi, 'getNotifications')
      .mockResolvedValueOnce({
        items: [mockUnreadNotification, mockReadNotification],
        page: 1,
        page_size: 20,
        total: 2,
        total_pages: 1,
      })
      .mockResolvedValueOnce({
        items: [mockUnreadNotification],
        page: 1,
        page_size: 20,
        total: 1,
        total_pages: 1,
      });
    vi.spyOn(notificationsApi, 'markNotificationAsRead').mockResolvedValue({
      ...mockUnreadNotification,
      is_read: true,
      read_at: '2026-09-20T09:00:00Z',
    });

    renderDrawer();

    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    await screen.findByText('Application Received');

    // Switch to Unread filter
    await user.click(screen.getByRole('tab', { name: /^Unread/i }));
    await screen.findByText('Application Received');

    // Mark as read
    const markBtn = screen.getByRole('button', { name: /Mark "Application Received" as read/i });
    await user.click(markBtn);

    // Unread list should now be empty
    await waitFor(() => {
      expect(screen.queryByText('Application Received')).not.toBeInTheDocument();
      expect(screen.getByText('No unread notifications')).toBeInTheDocument();
    });
  });

  it('re-fetches backend state after mark-all-as-read and clears unread list', async () => {
    const user = userEvent.setup();
    const countSpy = vi.spyOn(notificationsApi, 'getUnreadCount')
      .mockResolvedValueOnce({ unread_count: 1 }) // mount
      .mockResolvedValueOnce({ unread_count: 1 }) // open
      .mockResolvedValueOnce({ unread_count: 1 }) // unread tab
      .mockResolvedValueOnce({ unread_count: 0 }) // refetch after mark all
      .mockResolvedValueOnce({ unread_count: 0 }); // final sync

    const getNotificationsSpy = vi.spyOn(notificationsApi, 'getNotifications')
      .mockResolvedValueOnce({
        items: [mockUnreadNotification],
        page: 1,
        page_size: 20,
        total: 1,
        total_pages: 1,
      }) // open
      .mockResolvedValueOnce({
        items: [mockUnreadNotification],
        page: 1,
        page_size: 20,
        total: 1,
        total_pages: 1,
      }) // unread tab
      .mockResolvedValueOnce({
        items: [],
        page: 1,
        page_size: 20,
        total: 0,
        total_pages: 0,
      }); // refetch after mark-all

    const markAllSpy = vi.spyOn(notificationsApi, 'markAllNotificationsAsRead').mockResolvedValue({
      marked_read_count: 1,
    });

    renderDrawer();

    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    await screen.findByText('Application Received');

    // Switch to Unread
    await user.click(screen.getByRole('tab', { name: /^Unread/i }));

    const markAllBtn = screen.getByRole('button', { name: /Mark all notifications as read/i });
    await user.click(markAllBtn);

    expect(markAllSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(getNotificationsSpy).toHaveBeenCalledTimes(3);
      expect(countSpy).toHaveBeenCalled();
      expect(screen.getByText('No unread notifications')).toBeInTheDocument();
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  it('displays empty state when there are no notifications', async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
    vi.spyOn(notificationsApi, 'getNotifications').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
    });

    renderDrawer();

    await user.click(screen.getByRole('button', { name: /Notifications/i }));

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('displays error message and allows retry on failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 1 });
    vi.spyOn(notificationsApi, 'getNotifications')
      .mockRejectedValueOnce({
        success: false,
        message: 'Failed to retrieve notification records',
        error_code: 'INTERNAL_SERVER_ERROR',
        status: 500,
      })
      .mockResolvedValueOnce({
        items: [mockUnreadNotification],
        page: 1,
        page_size: 20,
        total: 1,
        total_pages: 1,
      });

    renderDrawer();

    await user.click(screen.getByRole('button', { name: /Notifications/i }));

    expect(await screen.findByText('Failed to retrieve notification records')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Application Received')).toBeInTheDocument();
  });

  describe('Deep-linking destination logic', () => {
    it('returns correct destinations based on notification type and role', () => {
      expect(getNotificationDestination('application_submitted', 'recruiter')).toBe('/app/recruiter/applications');
      expect(getNotificationDestination('application_submitted', 'student')).toBe('/app/applications');
      expect(getNotificationDestination('application_status_changed', 'student')).toBe('/app/applications');
      expect(getNotificationDestination('application_status_changed', 'recruiter')).toBe('/app/recruiter/applications');
      expect(getNotificationDestination('recruiter_verification_changed', 'recruiter')).toBe('/app/recruiter/profile');
      expect(getNotificationDestination('job_moderation_changed', 'recruiter')).toBe('/app/recruiter/jobs');
      expect(getNotificationDestination('interview_scheduled', 'student')).toBe('/app/interviews');
      expect(getNotificationDestination('interview_scheduled', 'recruiter')).toBe('/app/recruiter/interviews');
      expect(getNotificationDestination('message_received', 'student')).toBe('/app/messages');
    });

    it('returns null and remains safe for unknown/unsupported notification types', () => {
      expect(getNotificationDestination('unknown_future_type', 'student')).toBeNull();
      expect(getNotificationDestination('', 'recruiter')).toBeNull();
    });
  });

  describe('Notification Preferences UI', () => {
    const mockPref: NotificationPreference = {
      id: 1,
      user_id: 1,
      email_notifications: true,
      frequency: 'instant',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    };

    it('loads and displays preferences when preferences tab is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
      const getPrefSpy = vi.spyOn(notificationsApi, 'getNotificationPreferences').mockResolvedValue(mockPref);

      renderDrawer();

      await user.click(screen.getByRole('button', { name: /Notifications/i }));
      const prefTab = screen.getByTestId('notification-preferences-tab');
      await user.click(prefTab);

      expect(getPrefSpy).toHaveBeenCalled();
      expect(await screen.findByTestId('preferences-panel')).toBeInTheDocument();
      expect(screen.getByTestId('freq-instant-radio')).toBeChecked();
      expect(screen.getByTestId('email-notif-checkbox')).toBeChecked();
    });

    it('updates frequency and email preference settings with success feedback', async () => {
      const user = userEvent.setup();
      vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
      vi.spyOn(notificationsApi, 'getNotificationPreferences').mockResolvedValue(mockPref);
      const updatePrefSpy = vi.spyOn(notificationsApi, 'updateNotificationPreferences').mockResolvedValue({
        ...mockPref,
        frequency: 'digest',
      });

      renderDrawer();

      await user.click(screen.getByRole('button', { name: /Notifications/i }));
      await user.click(screen.getByTestId('notification-preferences-tab'));

      const digestRadio = await screen.findByTestId('freq-digest-radio');
      await user.click(digestRadio);

      expect(updatePrefSpy).toHaveBeenCalledWith({ frequency: 'digest' });
      expect(await screen.findByText(/Preferences saved: "Daily Digest" active/i)).toBeInTheDocument();
    });

    it('handles preference update error gracefully', async () => {
      const user = userEvent.setup();
      vi.spyOn(notificationsApi, 'getUnreadCount').mockResolvedValue({ unread_count: 0 });
      vi.spyOn(notificationsApi, 'getNotificationPreferences').mockResolvedValue(mockPref);
      vi.spyOn(notificationsApi, 'updateNotificationPreferences').mockRejectedValue({
        message: 'Network error updating preferences',
      });

      renderDrawer();

      await user.click(screen.getByRole('button', { name: /Notifications/i }));
      await user.click(screen.getByTestId('notification-preferences-tab'));

      const digestRadio = await screen.findByTestId('freq-digest-radio');
      await user.click(digestRadio);

      expect(await screen.findByText('Network error updating preferences')).toBeInTheDocument();
    });
  });
});
