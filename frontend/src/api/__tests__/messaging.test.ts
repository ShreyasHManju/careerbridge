/**
 * Unit Tests for Messaging API Service Module (Phase F-09)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import * as messagingApi from '../messaging';
import {
  Conversation,
  ConversationListResponse,
  MarkReadResponse,
  Message,
  MessageListResponse,
} from '@/types/messaging';

const mockConversation: Conversation = {
  id: 10,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T11:00:00Z',
  other_participant: {
    id: 5,
    email: 'recruiter@company.com',
    role: 'recruiter',
    full_name: 'John Recruiter',
    company_name: 'Acme Corp',
  },
  last_message: {
    id: 101,
    conversation_id: 10,
    sender_id: 5,
    sender_email: 'recruiter@company.com',
    body: 'Looking forward to the interview.',
    is_read: false,
    created_at: '2026-09-20T11:00:00Z',
    updated_at: '2026-09-20T11:00:00Z',
  },
  unread_count: 1,
};

const mockMessage: Message = {
  id: 101,
  conversation_id: 10,
  sender_id: 5,
  sender_email: 'recruiter@company.com',
  body: 'Looking forward to the interview.',
  is_read: false,
  created_at: '2026-09-20T11:00:00Z',
  updated_at: '2026-09-20T11:00:00Z',
};

describe('Messaging API Services', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConversations', () => {
    it('dispatches GET to /conversations and returns conversation list', async () => {
      const mockResponse: ConversationListResponse = {
        items: [mockConversation],
        total: 1,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

      const result = await messagingApi.getConversations();

      expect(getSpy).toHaveBeenCalledWith('/conversations');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(10);
    });

    it('propagates 401 Unauthorized error when not authenticated', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue({
        status: 401,
        message: 'Authentication required',
      });

      await expect(messagingApi.getConversations()).rejects.toMatchObject({
        status: 401,
        message: 'Authentication required',
      });
    });
  });

  describe('createConversation', () => {
    it('dispatches POST to /conversations with other_user_id and initial_message', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: mockConversation });

      const result = await messagingApi.createConversation({
        other_user_id: 5,
        initial_message: 'Hi there',
      });

      expect(postSpy).toHaveBeenCalledWith('/conversations', {
        other_user_id: 5,
        initial_message: 'Hi there',
      });
      expect(result.id).toBe(10);
    });

    it('propagates 404 error when target user does not exist', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue({
        status: 404,
        message: 'Target user not found',
      });

      await expect(
        messagingApi.createConversation({ other_user_id: 9999 })
      ).rejects.toMatchObject({ status: 404 });
    });

    it('propagates 422 error on self-messaging or invalid user ID', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue({
        status: 422,
        message: 'Cannot start conversation with yourself',
      });

      await expect(
        messagingApi.createConversation({ other_user_id: 1 })
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('getConversation', () => {
    it('dispatches GET to /conversations/:id and returns conversation', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockConversation });

      const result = await messagingApi.getConversation(10);

      expect(getSpy).toHaveBeenCalledWith('/conversations/10');
      expect(result.id).toBe(10);
    });

    it('propagates 403 error on unauthorized non-participant access', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue({
        status: 403,
        message: 'Not authorized for this conversation',
      });

      await expect(messagingApi.getConversation(999)).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe('getConversationMessages', () => {
    it('dispatches GET to /conversations/:id/messages with pagination parameters', async () => {
      const mockList: MessageListResponse = {
        items: [mockMessage],
        total: 1,
        page: 1,
        page_size: 50,
        total_pages: 1,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockList });

      const result = await messagingApi.getConversationMessages(10, 1, 50);

      expect(getSpy).toHaveBeenCalledWith('/conversations/10/messages', {
        params: { page: 1, page_size: 50 },
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('sendMessage', () => {
    it('dispatches POST to /conversations/:id/messages with payload body', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: mockMessage });

      const result = await messagingApi.sendMessage(10, {
        body: 'Looking forward to the interview.',
      });

      expect(postSpy).toHaveBeenCalledWith('/conversations/10/messages', {
        body: 'Looking forward to the interview.',
      });
      expect(result.id).toBe(101);
    });

    it('propagates 422 error on empty or oversized message body', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue({
        status: 422,
        message: 'Message body cannot be empty',
      });

      await expect(
        messagingApi.sendMessage(10, { body: '' })
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('markConversationRead', () => {
    it('dispatches PATCH to /conversations/:id/read and returns marked count', async () => {
      const mockReadResp: MarkReadResponse = {
        conversation_id: 10,
        marked_read_count: 2,
      };
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: mockReadResp });

      const result = await messagingApi.markConversationRead(10);

      expect(patchSpy).toHaveBeenCalledWith('/conversations/10/read');
      expect(result.marked_read_count).toBe(2);
    });
  });

  describe('markMessageRead', () => {
    it('dispatches PATCH to /messages/:id/read and returns updated message', async () => {
      const readMsg = { ...mockMessage, is_read: true };
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: readMsg });

      const result = await messagingApi.markMessageRead(101);

      expect(patchSpy).toHaveBeenCalledWith('/messages/101/read');
      expect(result.is_read).toBe(true);
    });
  });
});
