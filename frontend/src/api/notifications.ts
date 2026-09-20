import { apiClient } from './client';
import {
  Notification,
  NotificationPagination,
  NotificationUnreadCount,
  NotificationMarkAllRead,
  NotificationFilters,
} from '@/types/notification';

/**
 * Notifications API Service Module
 * Aligned with backend router: /api/v1/notifications
 */

/**
 * List notifications for the authenticated user with optional pagination and unread filtering.
 */
export async function getNotifications(
  filters: NotificationFilters = {}
): Promise<NotificationPagination> {
  const params: Record<string, string | number | boolean> = {};

  if (filters.page && filters.page >= 1) {
    params.page = filters.page;
  }
  if (filters.page_size && filters.page_size >= 1) {
    params.page_size = Math.min(filters.page_size, 100);
  }
  if (typeof filters.unread_only === 'boolean') {
    params.unread_only = filters.unread_only;
  }

  const response = await apiClient.get<NotificationPagination>('/notifications', { params });
  return response.data;
}

/**
 * Get total count of unread notifications for the authenticated user.
 */
export async function getUnreadCount(): Promise<NotificationUnreadCount> {
  const response = await apiClient.get<NotificationUnreadCount>('/notifications/unread-count');
  return response.data;
}

/**
 * Mark all unread notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsRead(): Promise<NotificationMarkAllRead> {
  const response = await apiClient.patch<NotificationMarkAllRead>('/notifications/read-all');
  return response.data;
}

/**
 * Mark a specific notification as read by ID.
 */
export async function markNotificationAsRead(notificationId: number): Promise<Notification> {
  const response = await apiClient.patch<Notification>(`/notifications/${notificationId}/read`);
  return response.data;
}
