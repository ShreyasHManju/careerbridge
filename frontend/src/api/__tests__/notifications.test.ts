import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../notifications';
import {
  Notification,
  NotificationPagination,
  NotificationUnreadCount,
  NotificationMarkAllRead,
} from '@/types/notification';
import { ApiErrorResponse } from '@/types/api';

const mockNotification1: Notification = {
  id: 1,
  user_id: 10,
  notification_type: 'application_status_changed',
  title: 'Application Status Updated',
  message: 'Your application for Frontend Intern was moved to review.',
  is_read: false,
  created_at: '2026-09-20T10:00:00Z',
  read_at: null,
};

const mockNotification2: Notification = {
  id: 2,
  user_id: 10,
  notification_type: 'interview_scheduled',
  title: 'Interview Scheduled',
  message: 'An interview has been scheduled for tomorrow at 10:00 AM.',
  is_read: true,
  created_at: '2026-09-19T15:30:00Z',
  read_at: '2026-09-19T16:00:00Z',
};

const mockPagination: NotificationPagination = {
  items: [mockNotification1, mockNotification2],
  page: 1,
  page_size: 10,
  total: 2,
  total_pages: 1,
};

describe('Notifications API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNotifications', () => {
    it('fetches paginated notifications without parameters by default', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPagination,
      });

      const result = await getNotifications();

      expect(getSpy).toHaveBeenCalledWith('/notifications', { params: {} });
      expect(result).toEqual(mockPagination);
      expect(result.items).toHaveLength(2);
    });

    it('passes pagination and unread_only filter parameters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          items: [mockNotification1],
          page: 2,
          page_size: 5,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await getNotifications({
        page: 2,
        page_size: 5,
        unread_only: true,
      });

      expect(getSpy).toHaveBeenCalledWith('/notifications', {
        params: {
          page: 2,
          page_size: 5,
          unread_only: true,
        },
      });
      expect(result.items).toHaveLength(1);
    });

    it('caps page_size at 100 max', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockPagination,
      });

      await getNotifications({ page_size: 150 });

      expect(getSpy).toHaveBeenCalledWith('/notifications', {
        params: { page_size: 100 },
      });
    });

    it('propagates 401 unauthorized error', async () => {
      const mock401Error: ApiErrorResponse = {
        success: false,
        message: 'Could not validate credentials',
        error_code: 'AUTHENTICATION_REQUIRED',
        status: 401,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock401Error);

      await expect(getNotifications()).rejects.toEqual(mock401Error);
    });
  });

  describe('getUnreadCount', () => {
    it('dispatches GET to /notifications/unread-count and returns count', async () => {
      const mockCount: NotificationUnreadCount = { unread_count: 3 };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockCount,
      });

      const result = await getUnreadCount();

      expect(getSpy).toHaveBeenCalledWith('/notifications/unread-count');
      expect(result).toEqual({ unread_count: 3 });
    });

    it('propagates 500 error on server failure', async () => {
      const mock500Error: ApiErrorResponse = {
        success: false,
        message: 'Internal server error',
        error_code: 'INTERNAL_SERVER_ERROR',
        status: 500,
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(mock500Error);

      await expect(getUnreadCount()).rejects.toEqual(mock500Error);
    });
  });

  describe('markNotificationAsRead', () => {
    it('dispatches PATCH to /notifications/:id/read and returns updated notification', async () => {
      const updatedNotification: Notification = {
        ...mockNotification1,
        is_read: true,
        read_at: '2026-09-20T10:05:00Z',
      };
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: updatedNotification,
      });

      const result = await markNotificationAsRead(1);

      expect(patchSpy).toHaveBeenCalledWith('/notifications/1/read');
      expect(result.is_read).toBe(true);
      expect(result.read_at).toBe('2026-09-20T10:05:00Z');
    });

    it('propagates 404 when notification does not exist or belong to user', async () => {
      const mock404Error: ApiErrorResponse = {
        success: false,
        message: 'Notification not found',
        error_code: 'NOT_FOUND',
        status: 404,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mock404Error);

      await expect(markNotificationAsRead(999)).rejects.toEqual(mock404Error);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('dispatches PATCH to /notifications/read-all and returns marked count', async () => {
      const mockMarkAll: NotificationMarkAllRead = { marked_read_count: 4 };
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: mockMarkAll,
      });

      const result = await markAllNotificationsAsRead();

      expect(patchSpy).toHaveBeenCalledWith('/notifications/read-all');
      expect(result).toEqual({ marked_read_count: 4 });
    });

    it('propagates structured error when request fails', async () => {
      const mockError: ApiErrorResponse = {
        success: false,
        message: 'Database unavailable',
        error_code: 'INTERNAL_SERVER_ERROR',
        status: 503,
      };

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(mockError);

      await expect(markAllNotificationsAsRead()).rejects.toEqual(mockError);
    });
  });
});
