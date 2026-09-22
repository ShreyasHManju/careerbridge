/**
 * Notification TypeScript Definitions
 * Strictly aligned with CareerBridge backend Notification Pydantic schemas.
 */

export type NotificationType =
  | 'application_submitted'
  | 'application_status_changed'
  | 'recruiter_verification_changed'
  | 'job_moderation_changed'
  | 'interview_scheduled'
  | 'interview_rescheduled'
  | 'interview_cancelled'
  | 'message_received';

export interface Notification {
  id: number;
  user_id: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationPagination {
  items: Notification[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface NotificationUnreadCount {
  unread_count: number;
}

export interface NotificationMarkAllRead {
  marked_read_count: number;
}

export interface NotificationFilters {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}

export type NotificationFrequency = 'instant' | 'digest';

export interface NotificationPreference {
  id: number | null;
  user_id: number;
  frequency: NotificationFrequency;
  email_notifications: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NotificationPreferenceUpdate {
  frequency?: NotificationFrequency;
  email_notifications?: boolean;
}
