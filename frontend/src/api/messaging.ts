/**
 * Messaging API Service Module (Phase F-09)
 * Communicates with CareerBridge FastAPI Messaging REST Endpoints (`/api/v1/conversations`, `/api/v1/messages`).
 */

import { apiClient } from './client';
import {
  Conversation,
  ConversationListResponse,
  CreateConversationPayload,
  MarkReadResponse,
  Message,
  MessageListResponse,
  SendMessagePayload,
} from '@/types/messaging';

/**
 * List all active conversations for the authenticated user.
 */
export async function getConversations(): Promise<ConversationListResponse> {
  const response = await apiClient.get<ConversationListResponse>('/conversations');
  return response.data;
}

/**
 * Start a new direct one-to-one conversation or retrieve an existing one.
 */
export async function createConversation(
  payload: CreateConversationPayload
): Promise<Conversation> {
  const response = await apiClient.post<Conversation>('/conversations', payload);
  return response.data;
}

/**
 * Retrieve metadata and details of a single conversation.
 */
export async function getConversation(conversationId: number): Promise<Conversation> {
  const response = await apiClient.get<Conversation>(`/conversations/${conversationId}`);
  return response.data;
}

/**
 * Retrieve chronological paginated messages for a conversation.
 */
export async function getConversationMessages(
  conversationId: number,
  page: number = 1,
  pageSize: number = 50
): Promise<MessageListResponse> {
  const response = await apiClient.get<MessageListResponse>(
    `/conversations/${conversationId}/messages`,
    {
      params: {
        page,
        page_size: pageSize,
      },
    }
  );
  return response.data;
}

/**
 * Send a message to a conversation via HTTP REST (primary or fallback).
 */
export async function sendMessage(
  conversationId: number,
  payload: SendMessagePayload
): Promise<Message> {
  const response = await apiClient.post<Message>(
    `/conversations/${conversationId}/messages`,
    payload
  );
  return response.data;
}

/**
 * Mark all incoming unread messages in a conversation as read.
 */
export async function markConversationRead(
  conversationId: number
): Promise<MarkReadResponse> {
  const response = await apiClient.patch<MarkReadResponse>(
    `/conversations/${conversationId}/read`
  );
  return response.data;
}

/**
 * Mark an individual message as read.
 */
export async function markMessageRead(messageId: number): Promise<Message> {
  const response = await apiClient.patch<Message>(`/messages/${messageId}/read`);
  return response.data;
}
