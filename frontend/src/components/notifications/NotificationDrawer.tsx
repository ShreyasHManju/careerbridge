import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
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
import { NotificationItem, getNotificationDestination, isActionRequired } from './NotificationItem';
import { NotificationBadge } from './NotificationBadge';
import { NotificationPreferencesTab } from './NotificationPreferencesTab';

export { getNotificationDestination, isActionRequired };

interface NotificationDrawerProps {
  className?: string;
}

export type DrawerTab = 'all' | 'action_required' | 'unread' | 'preferences';

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // On initial mount & periodically, sync unread count
  useEffect(() => {
    fetchUnreadCount();

    // Poll every 30 seconds
    const intervalId = window.setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    // Refresh on window focus
    const handleFocus = () => {
      fetchUnreadCount();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
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

  const handleNavigate = (destination: string) => {
    navigate(destination);
    setIsOpen(false);
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'action_required') {
      return isActionRequired(item.notification_type, user?.role);
    }
    if (activeTab === 'unread') {
      return !item.is_read;
    }
    return true;
  });

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
        <NotificationBadge count={unreadCount} />
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
              className={`cb-notification-filter-tab ${activeTab === 'action_required' ? 'active' : ''}`}
              onClick={() => setActiveTab('action_required')}
              aria-selected={activeTab === 'action_required'}
              data-testid="notification-action-tab"
            >
              Action Required
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
              Preferences
            </button>
          </div>

          {/* Feedback Banners */}
          {error && activeTab !== 'preferences' && (
            <div className="cb-notification-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-xs"
                onClick={() => fetchNotificationsList(activeTab === 'unread')}
              >
                Retry
              </button>
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
              <NotificationPreferencesTab
                preference={preference}
                onFrequencyChange={handlePreferenceChange}
                onEmailToggle={handleEmailToggle}
                isSaving={isSavingPref}
                successMessage={prefSuccess}
                errorMessage={error}
                onRetry={fetchPreferences}
              />
            ) : filteredNotifications.length === 0 ? (
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
                  {activeTab === 'action_required'
                    ? 'No actions required'
                    : activeTab === 'unread'
                    ? 'No unread notifications'
                    : 'No notifications yet'}
                </p>
                <p className="cb-empty-desc">
                  {activeTab === 'action_required'
                    ? 'You are all caught up on pending action items.'
                    : activeTab === 'unread'
                    ? 'You have caught up with all your notifications.'
                    : 'We will notify you here when application, interview, or verification updates occur.'}
                </p>
              </div>
            ) : (
              <ul className="cb-notification-list" role="list">
                {filteredNotifications.map((item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    userRole={user?.role}
                    onNavigate={handleNavigate}
                    onMarkAsRead={handleMarkAsRead}
                    isMarkingRead={markingReadId === item.id}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Dropdown Footer */}
          <footer className="cb-notification-dropdown-footer">
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm cb-btn-block"
              onClick={() => {
                setIsOpen(false);
                navigate('/app/notifications');
              }}
              data-testid="view-all-notifications-btn"
            >
              View all notifications →
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};
