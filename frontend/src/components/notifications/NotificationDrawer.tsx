import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Notification, NotificationPreference, NotificationFrequency } from '@/types/notification';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/api/notifications';
import { ApiErrorResponse } from '@/types/api';

interface NotificationDrawerProps {
  className?: string;
}

type DrawerTab = 'all' | 'unread' | 'preferences';

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [markingReadId, setMarkingReadId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preference state
  const [preference, setPreference] = useState<NotificationPreference | null>(null);
  const [isSavingPref, setIsSavingPref] = useState<boolean>(false);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch unread count from backend
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.unread_count);
    } catch {
      // Quiet failure for background count badge
    }
  }, []);

  // Fetch notifications list from backend
  const fetchNotificationsList = useCallback(async (filterUnread: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getNotifications({
        page: 1,
        page_size: 20,
        unread_only: filterUnread,
      });
      setNotifications(res.items);
      // Synchronize unread count from backend
      const countRes = await getUnreadCount();
      setUnreadCount(countRes.unread_count);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr?.message || 'Unable to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getNotificationPreferences();
      setPreference(res);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr?.message || 'Failed to load notification preferences.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On initial mount, fetch unread count
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // When drawer opens or active tab changes
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'preferences') {
        fetchPreferences();
      } else {
        fetchNotificationsList(activeTab === 'unread');
      }
    }
  }, [isOpen, activeTab, fetchNotificationsList, fetchPreferences]);

  // Handle click outside and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        bellButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleMarkAsRead = async (id: number) => {
    setMarkingReadId(id);
    setError(null);
    try {
      const updated = await markNotificationAsRead(id);
      if (activeTab === 'unread') {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
      } else {
        setNotifications((prev) =>
          prev.map((item) => (item.id === id ? updated : item))
        );
      }
      await fetchUnreadCount();
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr?.message || 'Failed to mark notification as read.');
    } finally {
      setMarkingReadId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    setError(null);
    try {
      await markAllNotificationsAsRead();
      await fetchNotificationsList(activeTab === 'unread');
      await fetchUnreadCount();
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr?.message || 'Failed to mark all notifications as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handlePreferenceChange = async (frequency: NotificationFrequency) => {
    setIsSavingPref(true);
    setPrefSuccess(null);
    setError(null);

    try {
      const updated = await updateNotificationPreferences({ frequency });
      setPreference(updated);
      setPrefSuccess(`Preferences saved: "${frequency === 'instant' ? 'Instant Delivery' : 'Daily Digest'}" active.`);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr?.message || 'Failed to update notification preferences.');
    } finally {
      setIsSavingPref(false);
    }
  };

  const handleEmailToggle = async (enabled: boolean) => {
    setIsSavingPref(true);
    setPrefSuccess(null);
    setError(null);

    try {
      const updated = await updateNotificationPreferences({ email_notifications: enabled });
      setPreference(updated);
      setPrefSuccess(`Email notifications ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setError(apiErr?.message || 'Failed to update email preferences.');
    } finally {
      setIsSavingPref(false);
    }
  };

  const formatTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const bellAriaLabel = unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';

  return (
    <div className={`cb-notification-center ${className}`} ref={containerRef}>
      <button
        ref={bellButtonRef}
        type="button"
        className="cb-notification-bell-btn"
        onClick={handleToggle}
        aria-label={bellAriaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="cb-notifications-panel"
      >
        <svg
          className="cb-bell-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="cb-notification-badge" data-testid="unread-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="cb-notifications-panel"
          className="cb-notification-dropdown"
          role="region"
          aria-labelledby="cb-notifications-heading"
          aria-modal="false"
        >
          {/* Header */}
          <div className="cb-notification-header">
            <div className="cb-notification-title-wrap">
              <h3 id="cb-notifications-heading" className="cb-notification-heading">
                Notifications
              </h3>
              {unreadCount > 0 && activeTab !== 'preferences' && (
                <span className="cb-notification-count-tag" data-testid="unread-count-tag">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="cb-notification-header-actions">
              {unreadCount > 0 && activeTab !== 'preferences' && (
                <button
                  type="button"
                  className="cb-btn-link cb-mark-all-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll || isLoading}
                  aria-label="Mark all notifications as read"
                >
                  {isMarkingAll ? 'Marking...' : 'Mark all as read'}
                </button>
              )}
              <button
                type="button"
                className="cb-notification-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filter Bar / Tabs */}
          <div className="cb-notification-filter-bar" role="tablist">
            <button
              type="button"
              role="tab"
              className={`cb-notification-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
              aria-selected={activeTab === 'all'}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              className={`cb-notification-filter-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
              aria-selected={activeTab === 'unread'}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <button
              type="button"
              role="tab"
              className={`cb-notification-filter-tab ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
              aria-selected={activeTab === 'preferences'}
              data-testid="notification-preferences-tab"
            >
              ⚙️ Preferences
            </button>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="cb-notification-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-xs"
                onClick={() =>
                  activeTab === 'preferences'
                    ? fetchPreferences()
                    : fetchNotificationsList(activeTab === 'unread')
                }
              >
                Retry
              </button>
            </div>
          )}

          {prefSuccess && activeTab === 'preferences' && (
            <div className="cb-alert cb-alert-success cb-notification-success-alert" role="status">
              {prefSuccess}
            </div>
          )}

          {/* Body */}
          <div className="cb-notification-body">
            {isLoading ? (
              <div className="cb-notification-loading" role="status" aria-live="polite">
                <div className="cb-spinner cb-spinner-sm" aria-hidden="true" />
                <p>Loading...</p>
              </div>
            ) : activeTab === 'preferences' ? (
              /* Notification Preferences Settings Panel */
              <div className="cb-notification-preferences-panel" data-testid="preferences-panel">
                <div className="cb-pref-section">
                  <h4 className="cb-pref-section-title">Delivery Frequency</h4>
                  <p className="cb-pref-section-desc">
                    Choose how often you receive status and update notifications.
                  </p>

                  <div className="cb-pref-options">
                    <label className="cb-radio-label">
                      <input
                        type="radio"
                        name="notification-frequency"
                        value="instant"
                        checked={preference?.frequency === 'instant'}
                        onChange={() => handlePreferenceChange('instant')}
                        disabled={isSavingPref}
                        data-testid="freq-instant-radio"
                      />
                      <div className="cb-radio-text">
                        <span className="cb-radio-title">⚡ Instant</span>
                        <span className="cb-radio-sub">Receive notifications immediately in real time.</span>
                      </div>
                    </label>

                    <label className="cb-radio-label">
                      <input
                        type="radio"
                        name="notification-frequency"
                        value="digest"
                        checked={preference?.frequency === 'digest'}
                        onChange={() => handlePreferenceChange('digest')}
                        disabled={isSavingPref}
                        data-testid="freq-digest-radio"
                      />
                      <div className="cb-radio-text">
                        <span className="cb-radio-title">📬 Daily Digest</span>
                        <span className="cb-radio-sub">Consolidate periodic updates into a digest.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="cb-pref-section">
                  <h4 className="cb-pref-section-title">Email Notifications</h4>
                  <p className="cb-pref-section-desc">
                    Send transactional confirmation and status update emails.
                  </p>
                  <label className="cb-checkbox-wrapper cb-pref-email-toggle">
                    <input
                      type="checkbox"
                      className="cb-checkbox"
                      checked={preference?.email_notifications ?? true}
                      onChange={(e) => handleEmailToggle(e.target.checked)}
                      disabled={isSavingPref}
                      data-testid="email-notif-checkbox"
                    />
                    <span>Enable transactional email notifications</span>
                  </label>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="cb-notification-empty">
                <svg
                  className="cb-empty-icon"
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
                <p className="cb-empty-title">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="cb-empty-desc">
                  {activeTab === 'unread'
                    ? 'You have caught up with all your notifications.'
                    : 'We will notify you here when application or interview updates occur.'}
                </p>
              </div>
            ) : (
              <ul className="cb-notification-list" role="list">
                {notifications.map((item) => (
                  <li
                    key={item.id}
                    className={`cb-notification-item ${item.is_read ? 'cb-read' : 'cb-unread'}`}
                  >
                    <div className="cb-notification-item-content">
                      <div className="cb-notification-item-header">
                        <span className="cb-notification-item-title">{item.title}</span>
                        {!item.is_read ? (
                          <span className="cb-status-badge cb-badge-unread">Unread</span>
                        ) : (
                          <span className="cb-status-badge cb-badge-read">Read</span>
                        )}
                      </div>
                      <p className="cb-notification-item-message">{item.message}</p>
                      <div className="cb-notification-item-footer">
                        <time className="cb-notification-time" dateTime={item.created_at}>
                          {formatTimestamp(item.created_at)}
                        </time>
                        {!item.is_read && (
                          <button
                            type="button"
                            className="cb-btn-link cb-item-mark-read-btn"
                            onClick={() => handleMarkAsRead(item.id)}
                            disabled={markingReadId === item.id}
                            aria-label={`Mark "${item.title}" as read`}
                          >
                            {markingReadId === item.id ? 'Marking...' : 'Mark as read'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
