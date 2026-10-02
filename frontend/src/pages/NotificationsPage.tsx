import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import {
  Notification,
  NotificationType,
  NotificationPreference,
  NotificationFrequency,
} from '@/types/notification';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/api/notifications';
import { getNotificationDestination } from '@/components/notifications/NotificationDrawer';
import { ApiErrorResponse } from '@/types/api';

type TabType = 'all' | 'unread' | 'preferences';

const TYPE_METADATA: Record<NotificationType, { label: string; icon: string; category: string }> = {
  interview_scheduled: { label: 'Interview Scheduled', icon: '📅', category: 'interviews' },
  interview_rescheduled: { label: 'Interview Rescheduled', icon: '🔄', category: 'interviews' },
  interview_cancelled: { label: 'Interview Cancelled', icon: '🚫', category: 'interviews' },
  application_submitted: { label: 'Application Received', icon: '📄', category: 'applications' },
  application_status_changed: { label: 'Application Status', icon: '⚡', category: 'applications' },
  message_received: { label: 'Direct Message', icon: '💬', category: 'messages' },
  project_evaluation_submitted: { label: 'Project Evaluation', icon: '⭐', category: 'projects' },
  recruiter_verification_changed: { label: 'Recruiter Verification', icon: '🛡️', category: 'account' },
  job_moderation_changed: { label: 'Job Moderation', icon: '📋', category: 'account' },
};

const formatFullTimestamp = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return dateString;
  }
};

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Data state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mutation states
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [markingReadId, setMarkingReadId] = useState<number | null>(null);

  // Preference state
  const [preference, setPreference] = useState<NotificationPreference | null>(null);
  const [isSavingPref, setIsSavingPref] = useState<boolean>(false);
  const [prefSuccessMessage, setPrefSuccessMessage] = useState<string | null>(null);

  // Fetch unread count
  const fetchUnread = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.unread_count);
    } catch {
      // Quiet background failure
    }
  }, []);

  // Fetch paginated notifications
  const fetchNotificationList = useCallback(async () => {
    if (activeTab === 'preferences') return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await getNotifications({
        page,
        page_size: pageSize,
        unread_only: activeTab === 'unread',
      });
      setNotifications(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
      await fetchUnread();
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(apiErr?.message || 'Unable to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, pageSize, fetchUnread]);

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getNotificationPreferences();
      setPreference(res);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(apiErr?.message || 'Failed to load notification preferences.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data based on tab & page
  useEffect(() => {
    if (activeTab === 'preferences') {
      fetchPreferences();
    } else {
      fetchNotificationList();
    }
  }, [activeTab, page, fetchNotificationList, fetchPreferences]);

  // Periodic polling for freshness
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchUnread();
    }, 30000);

    const handleFocus = () => {
      fetchUnread();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUnread]);

  // Handle Mark Single as Read
  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMarkingReadId(id);
    try {
      const updated = await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
      await fetchUnread();
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(apiErr?.message || 'Failed to mark notification as read.');
    } finally {
      setMarkingReadId(null);
    }
  };

  // Handle Mark All as Read
  const handleMarkAll = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    setErrorMessage(null);
    try {
      await markAllNotificationsAsRead();
      await fetchNotificationList();
      await fetchUnread();
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(apiErr?.message || 'Failed to mark all notifications as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Handle Save Preferences
  const handleSaveFrequency = async (frequency: NotificationFrequency) => {
    setIsSavingPref(true);
    setPrefSuccessMessage(null);
    setErrorMessage(null);
    try {
      const updated = await updateNotificationPreferences({ frequency });
      setPreference(updated);
      setPrefSuccessMessage(
        `Frequency updated to "${frequency === 'instant' ? 'Instant Delivery' : 'Daily Digest'}".`
      );
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(apiErr?.message || 'Failed to update preferences.');
    } finally {
      setIsSavingPref(false);
    }
  };

  const handleToggleEmail = async (enabled: boolean) => {
    setIsSavingPref(true);
    setPrefSuccessMessage(null);
    setErrorMessage(null);
    try {
      const updated = await updateNotificationPreferences({ email_notifications: enabled });
      setPreference(updated);
      setPrefSuccessMessage(`Email notifications ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(apiErr?.message || 'Failed to update email preferences.');
    } finally {
      setIsSavingPref(false);
    }
  };

  // Handle Navigation on Click
  const handleNotificationClick = (item: Notification) => {
    const destination = getNotificationDestination(item.notification_type, user?.role);
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (destination) {
      navigate(destination);
    }
  };

  // Filter items by category and search keyword client-side on current page
  const filteredNotifications = notifications.filter((item) => {
    if (selectedCategory !== 'all') {
      const meta = TYPE_METADATA[item.notification_type];
      if (!meta || meta.category !== selectedCategory) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchMessage = item.message.toLowerCase().includes(q);
      if (!matchTitle && !matchMessage) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="cb-page-container" data-testid="notifications-page">
      {/* Header */}
      <header className="cb-page-header">
        <div>
          <h1 className="cb-page-title">Notifications</h1>
          <p className="cb-page-subtitle">
            Stay informed on your interview schedules, application reviews, and direct messages.
          </p>
        </div>
        <div className="cb-page-header-actions">
          {unreadCount > 0 && activeTab !== 'preferences' && (
            <button
              type="button"
              className="cb-btn cb-btn-secondary cb-btn-sm"
              onClick={handleMarkAll}
              disabled={isMarkingAll || isLoading}
              data-testid="mark-all-read-page-btn"
            >
              {isMarkingAll ? 'Marking All...' : '✓ Mark all as read'}
            </button>
          )}
        </div>
      </header>

      {/* Error Alert */}
      {errorMessage && (
        <div className="cb-alert cb-alert-danger" role="alert" style={{ marginBottom: '1.25rem' }}>
          <span>{errorMessage}</span>
          <button
            type="button"
            className="cb-btn cb-btn-sm cb-btn-secondary"
            onClick={() => {
              if (activeTab === 'preferences') fetchPreferences();
              else fetchNotificationList();
            }}
            style={{ marginLeft: '1rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls / Tabs Bar */}
      <div className="cb-interviews-controls-bar">
        <div className="cb-tab-group" role="tablist" aria-label="Notification view tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`cb-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setPage(1);
            }}
          >
            All Notifications
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'unread'}
            className={`cb-tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('unread');
              setPage(1);
            }}
          >
            Unread
            {unreadCount > 0 && (
              <span className="cb-tab-counter-badge" data-testid="unread-tab-counter">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preferences'}
            className={`cb-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('preferences');
            }}
          >
            Delivery Preferences
          </button>
        </div>

        {activeTab !== 'preferences' && (
          <div className="cb-interviews-filters-group">
            {/* Category Filter */}
            <div className="cb-filter-item">
              <label htmlFor="notification-category-filter" className="sr-only">
                Filter by Category
              </label>
              <select
                id="notification-category-filter"
                className="cb-select cb-select-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by notification category"
              >
                <option value="all">All Categories</option>
                <option value="interviews">📅 Interviews</option>
                <option value="applications">📄 Applications</option>
                <option value="messages">💬 Messages</option>
                <option value="projects">⭐ Project Evaluations</option>
                <option value="account">🛡️ Account & Verification</option>
              </select>
            </div>

            {/* Keyword Search */}
            <div className="cb-filter-item">
              <label htmlFor="notification-search-input" className="sr-only">
                Search notifications
              </label>
              <input
                id="notification-search-input"
                type="search"
                className="cb-input cb-input-sm"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search notifications"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="cb-notifications-main-content">
        {/* TAB 1 & 2: Notifications List */}
        {activeTab !== 'preferences' && (
          <>
            {isLoading ? (
              <div
                className="cb-loading-container"
                data-testid="notifications-loading"
                style={{ padding: '3rem 1rem', textAlign: 'center' }}
              >
                <div className="cb-spinner" aria-hidden="true" />
                <p style={{ marginTop: '0.75rem', color: '#64748b' }}>
                  Loading your notifications...
                </p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div
                className="cb-empty-state-card"
                data-testid="notifications-empty-state"
                style={{
                  textAlign: 'center',
                  padding: '3.5rem 1.5rem',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>
                  🔔
                </span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
                  {activeTab === 'unread'
                    ? 'No unread notifications'
                    : 'You have no notifications yet'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {activeTab === 'unread'
                    ? 'All notifications have been reviewed. You are all caught up!'
                    : 'When hiring teams schedule interviews, update applications, or send messages, they will appear here.'}
                </p>
              </div>
            ) : (
              <div className="cb-notifications-list-container" data-testid="notifications-list">
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {filteredNotifications.map((item) => {
                    const meta = TYPE_METADATA[item.notification_type] || {
                      label: item.notification_type,
                      icon: '🔔',
                      category: 'general',
                    };
                    const dest = getNotificationDestination(item.notification_type, user?.role);

                    return (
                      <li
                        key={item.id}
                        data-testid={`notification-card-${item.id}`}
                        onClick={() => handleNotificationClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleNotificationClick(item);
                          }
                        }}
                        tabIndex={dest ? 0 : undefined}
                        role={dest ? 'button' : undefined}
                        style={{
                          background: item.is_read ? '#ffffff' : '#f0fdf4',
                          border: `1px solid ${item.is_read ? '#e2e8f0' : '#86efac'}`,
                          borderLeft: `4px solid ${item.is_read ? '#cbd5e1' : '#10b981'}`,
                          borderRadius: '10px',
                          padding: '1.25rem',
                          cursor: dest ? 'pointer' : 'default',
                          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                          boxShadow: item.is_read
                            ? '0 1px 3px rgba(15,23,42,0.04)'
                            : '0 4px 12px rgba(16,185,129,0.08)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '1rem',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            {/* Type badge & timestamp */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                marginBottom: '0.375rem',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>{meta.icon}</span> {meta.label}
                              </span>
                              {!item.is_read ? (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                  }}
                                  role="status"
                                >
                                  Unread
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: '#94a3b8',
                                  }}
                                >
                                  Read
                                </span>
                              )}
                              <time
                                dateTime={item.created_at}
                                style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}
                              >
                                {formatFullTimestamp(item.created_at)}
                              </time>
                            </div>

                            {/* Title & Message */}
                            <h3
                              style={{
                                fontSize: '1rem',
                                fontWeight: item.is_read ? 600 : 700,
                                color: '#0f172a',
                                margin: '0 0 0.25rem 0',
                              }}
                            >
                              {item.title}
                            </h3>
                            <p
                              style={{
                                fontSize: '0.875rem',
                                color: '#475569',
                                margin: '0 0 0.5rem 0',
                                lineHeight: 1.5,
                              }}
                            >
                              {item.message}
                            </p>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderTop: '1px solid #f1f5f9',
                            paddingTop: '0.75rem',
                            marginTop: '0.5rem',
                          }}
                        >
                          <div>
                            {dest && (
                              <span
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  color: '#2563eb',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                View related item →
                              </span>
                            )}
                          </div>
                          <div>
                            {!item.is_read && (
                              <button
                                type="button"
                                className="cb-btn cb-btn-secondary cb-btn-sm"
                                onClick={(e) => handleMarkAsRead(item.id, e)}
                                disabled={markingReadId === item.id}
                                aria-label={`Mark "${item.title}" as read`}
                                data-testid={`mark-read-btn-${item.id}`}
                              >
                                {markingReadId === item.id ? 'Marking...' : 'Mark as read'}
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div
                    className="cb-pagination-bar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '1.5rem',
                      padding: '0.75rem 1rem',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, totalItems)} of {totalItems} notifications
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="cb-btn cb-btn-secondary cb-btn-sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || isLoading}
                        data-testid="notifications-prev-page"
                      >
                        ← Previous
                      </button>
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          alignSelf: 'center',
                          padding: '0 0.5rem',
                        }}
                      >
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className="cb-btn cb-btn-secondary cb-btn-sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || isLoading}
                        data-testid="notifications-next-page"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 3: Delivery Preferences */}
        {activeTab === 'preferences' && (
          <div
            className="cb-card"
            data-testid="notification-preferences-card"
            style={{
              maxWidth: '650px',
              padding: '2rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
              Notification Delivery Preferences
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Control how frequently you receive alert notifications and digest summaries.
            </p>

            {prefSuccessMessage && (
              <div
                className="cb-alert cb-alert-success"
                role="status"
                style={{ marginBottom: '1.25rem' }}
                data-testid="pref-success-alert"
              >
                {prefSuccessMessage}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Frequency Selection */}
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}
                >
                  Delivery Frequency
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      border: `1px solid ${preference?.frequency === 'instant' ? '#3b82f6' : '#e2e8f0'}`,
                      background: preference?.frequency === 'instant' ? '#eff6ff' : '#ffffff',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      flex: 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="notification-frequency"
                      value="instant"
                      checked={preference?.frequency === 'instant'}
                      onChange={() => handleSaveFrequency('instant')}
                      disabled={isSavingPref}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.875rem' }}>Instant Delivery</strong>
                      <small style={{ color: '#64748b' }}>Receive alerts immediately as events happen.</small>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      border: `1px solid ${preference?.frequency === 'digest' ? '#3b82f6' : '#e2e8f0'}`,
                      background: preference?.frequency === 'digest' ? '#eff6ff' : '#ffffff',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      flex: 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="notification-frequency"
                      value="digest"
                      checked={preference?.frequency === 'digest'}
                      onChange={() => handleSaveFrequency('digest')}
                      disabled={isSavingPref}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.875rem' }}>Daily Digest</strong>
                      <small style={{ color: '#64748b' }}>Group non-urgent notifications into a daily digest.</small>
                    </div>
                  </label>
                </div>
              </div>

              {/* Email Notifications Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '0.875rem', color: '#0f172a' }}>
                    Email Notifications
                  </strong>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Send transactional email alerts for scheduled interviews and application updates.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preference?.email_notifications ?? true}
                  onChange={(e) => handleToggleEmail(e.target.checked)}
                  disabled={isSavingPref}
                  aria-label="Toggle email notifications"
                  data-testid="toggle-email-notifications-checkbox"
                  style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
