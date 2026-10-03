import React from 'react';
import { Notification } from '@/types/notification';

export const getNotificationDestination = (type: string, role?: string): string | null => {
  switch (type) {
    case 'application_submitted':
      return role === 'recruiter' ? '/app/recruiter/applications?status=applied' : '/app/applications';
    case 'application_status_changed':
      return role === 'student' ? '/app/applications' : '/app/recruiter/applications';
    case 'interview_scheduled':
    case 'interview_rescheduled':
    case 'interview_cancelled':
      return role === 'student' ? '/app/interviews' : '/app/recruiter/interviews';
    case 'project_evaluation_submitted':
      return '/app/passport';
    case 'job_invitation_received':
      return '/app/invitations';
    case 'job_invitation_responded':
      return role === 'recruiter' ? '/app/recruiter/candidates' : '/app/invitations';
    case 'message_received':
      return '/app/messages';
    case 'recruiter_verification_changed':
      return '/app/recruiter/profile';
    case 'experience_verification_changed':
      return '/app/experiences';
    case 'job_moderation_changed':
      return role === 'admin' ? '/app/admin/jobs' : '/app/recruiter/jobs';
    default:
      return null;
  }
};

export const isActionRequired = (type: string, role?: string): boolean => {
  switch (type) {
    case 'job_invitation_received':
      return true;
    case 'application_submitted':
      return role === 'recruiter';
    case 'interview_scheduled':
    case 'interview_rescheduled':
    case 'interview_cancelled':
      return true;
    case 'project_evaluation_submitted':
      return true;
    case 'experience_verification_changed':
      return true;
    case 'job_invitation_responded':
      return role === 'recruiter';
    default:
      return false;
  }
};

export const getNotificationCTA = (type: string, role?: string): string | null => {
  switch (type) {
    case 'job_invitation_received':
      return 'Accept / Decline';
    case 'application_submitted':
      return role === 'recruiter' ? 'Review Application' : 'View Application';
    case 'application_status_changed':
      return 'View Application';
    case 'interview_scheduled':
    case 'interview_rescheduled':
    case 'interview_cancelled':
      return 'View Interview';
    case 'project_evaluation_submitted':
      return 'Review Passport';
    case 'experience_verification_changed':
      return 'View Experience';
    case 'job_invitation_responded':
      return role === 'recruiter' ? 'View Candidate' : 'View Invitations';
    case 'message_received':
      return 'Open Conversation';
    case 'recruiter_verification_changed':
      return 'View Profile';
    case 'job_moderation_changed':
      return role === 'admin' ? 'Moderate Jobs' : 'View Jobs';
    default:
      return null;
  }
};

export const formatRelativeTimestamp = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

export const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'application_submitted':
    case 'application_status_changed':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'interview_scheduled':
    case 'interview_rescheduled':
    case 'interview_cancelled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'project_evaluation_submitted':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      );
    case 'job_invitation_received':
    case 'job_invitation_responded':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    case 'experience_verification_changed':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'message_received':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'recruiter_verification_changed':
    case 'job_moderation_changed':
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
  }
};

export interface NotificationItemProps {
  notification: Notification;
  userRole?: string;
  onNavigate?: (destination: string) => void;
  onMarkAsRead?: (id: number) => void;
  isMarkingRead?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  userRole,
  onNavigate,
  onMarkAsRead,
  isMarkingRead = false,
}) => {
  const destination = getNotificationDestination(notification.notification_type, userRole);
  const actionRequired = isActionRequired(notification.notification_type, userRole);
  const ctaLabel = getNotificationCTA(notification.notification_type, userRole);

  const handleClick = () => {
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (destination && onNavigate) {
      onNavigate(destination);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <li
      className={`cb-notification-item ${notification.is_read ? 'cb-read' : 'cb-unread'} ${
        destination ? 'cb-notification-actionable' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={destination ? 0 : undefined}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className="cb-notification-item-content">
        <div className="cb-notification-item-header">
          <div className="cb-notification-icon-title-wrap">
            <span className={`cb-notification-type-icon cb-type-${notification.notification_type}`}>
              <NotificationIcon type={notification.notification_type} />
            </span>
            <span className="cb-notification-item-title">{notification.title}</span>
          </div>
          <div className="cb-notification-badges-wrap">
            {actionRequired ? (
              <span className="cb-action-tag cb-action-required" data-testid="action-required-badge">
                Action Required
              </span>
            ) : (
              <span className="cb-action-tag cb-action-info">
                Info
              </span>
            )}
            {!notification.is_read ? (
              <span className="cb-status-badge cb-badge-unread">Unread</span>
            ) : (
              <span className="cb-status-badge cb-badge-read">Read</span>
            )}
          </div>
        </div>

        <p className="cb-notification-item-message">{notification.message}</p>

        <div className="cb-notification-item-footer">
          <time className="cb-notification-time" dateTime={notification.created_at}>
            {formatRelativeTimestamp(notification.created_at)}
          </time>

          <div className="cb-notification-actions-group">
            {ctaLabel && destination && (
              <button
                type="button"
                className="cb-btn cb-btn-secondary cb-btn-xs cb-notification-cta-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                aria-label={`${ctaLabel} for ${notification.title}`}
              >
                {ctaLabel} →
              </button>
            )}

            {!notification.is_read && onMarkAsRead && (
              <button
                type="button"
                className="cb-btn-link cb-item-mark-read-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
                disabled={isMarkingRead}
                aria-label={`Mark "${notification.title}" as read`}
              >
                {isMarkingRead ? 'Marking...' : 'Mark as read'}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};
