/**
 * Messaging TypeScript Definitions
 * Strictly aligned with CareerBridge backend Messaging Pydantic schemas.
 */

export interface ParticipantSummary {
  id: number;
  email: string;
  role: string;
  full_name?: string | null;
  company_name?: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_email?: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  updated_at: string;
}

export interface Conversation {
  id: number;
  created_at: string;
  updated_at: string;
  other_participant: ParticipantSummary;
  last_message?: Message | null;
  unread_count: number;
}

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
}

export interface MessageListResponse {
  items: Message[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateConversationPayload {
  other_user_id: number;
  initial_message?: string;
}

export interface SendMessagePayload {
  body: string;
}

export interface MarkReadResponse {
  conversation_id: number;
  marked_read_count: number;
}

export type WebSocketConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface WSNewMessageEvent {
  type: 'new_message';
  message: Message;
}

export interface WSMessagesReadEvent {
  type: 'messages_read';
  conversation_id: number;
  reader_id: number;
  marked_read_count: number;
  read_at: string;
}

export interface WSMessageReadEvent {
  type: 'message_read';
  conversation_id: number;
  message_id: number;
  reader_id: number;
  read_at?: string | null;
}

export interface WSPongEvent {
  type: 'pong';
}

export interface WSErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type WebSocketEvent =
  | WSNewMessageEvent
  | WSMessagesReadEvent
  | WSMessageReadEvent
  | WSPongEvent
  | WSErrorEvent;
