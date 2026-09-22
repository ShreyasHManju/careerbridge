/**
 * Component & Integration Tests for MessagesPage (Phase F-09)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MessagesPage } from '../MessagesPage';
import * as messagingApi from '@/api/messaging';
import * as authHook from '@/auth/useAuth';
import { Conversation, Message } from '@/types/messaging';
import { User } from '@/types/auth';

const mockUser: User = {
  id: 1,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockConversation1: Conversation = {
  id: 10,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T11:00:00Z',
  other_participant: {
    id: 5,
    email: 'recruiter@company.com',
    role: 'recruiter',
    full_name: 'Jane Recruiter',
    company_name: 'Acme Corp',
  },
  last_message: {
    id: 101,
    conversation_id: 10,
    sender_id: 5,
    sender_email: 'recruiter@company.com',
    body: 'We reviewed your resume and would like to chat.',
    is_read: false,
    created_at: '2026-09-20T11:00:00Z',
    updated_at: '2026-09-20T11:00:00Z',
  },
  unread_count: 1,
};

const mockConversation2: Conversation = {
  id: 20,
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T12:00:00Z',
  other_participant: {
    id: 6,
    email: 'recruiter2@tech.io',
    role: 'recruiter',
    full_name: 'Bob Hiring',
    company_name: 'Tech Innovations',
  },
  last_message: {
    id: 201,
    conversation_id: 20,
    sender_id: 1,
    sender_email: 'student@example.com',
    body: 'Thank you for the opportunity!',
    is_read: true,
    created_at: '2026-09-18T12:00:00Z',
    updated_at: '2026-09-18T12:00:00Z',
  },
  unread_count: 0,
};

const mockMessage1: Message = {
  id: 101,
  conversation_id: 10,
  sender_id: 5,
  sender_email: 'recruiter@company.com',
  body: 'We reviewed your resume and would like to chat.',
  is_read: false,
  created_at: '2026-09-20T11:00:00Z',
  updated_at: '2026-09-20T11:00:00Z',
};

const mockMessage2: Message = {
  id: 102,
  conversation_id: 10,
  sender_id: 1,
  sender_email: 'student@example.com',
  body: 'Thank you! I am available anytime this week.',
  is_read: true,
  created_at: '2026-09-20T11:05:00Z',
  updated_at: '2026-09-20T11:05:00Z',
};

describe('MessagesPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authHook, 'useAuth').mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      token: 'fake-token',
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('displays loading state while conversations are being fetched', () => {
    vi.spyOn(messagingApi, 'getConversations').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading conversations.../i)).toBeInTheDocument();
  });

  it('renders empty state when user has 0 conversations', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [],
      total: 0,
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      expect(screen.getByText('Select a Conversation')).toBeInTheDocument();
    });
  });

  it('renders populated conversation list with participant identities and last message snippets', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [mockConversation1, mockConversation2],
      total: 2,
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
      expect(screen.getByText('Bob Hiring')).toBeInTheDocument();
      expect(
        screen.getByText('We reviewed your resume and would like to chat.')
      ).toBeInTheDocument();
      expect(screen.getByTestId('unread-count-10')).toHaveTextContent('1');
    });
  });

  it('filters conversation list by search query keyword', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [mockConversation1, mockConversation2],
      total: 2,
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('conversation-search-input');
    fireEvent.change(searchInput, { target: { value: 'Tech Innovations' } });

    expect(screen.queryByText('Jane Recruiter')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Hiring')).toBeInTheDocument();
  });

  it('loads message history and marks as read when conversation is selected', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [mockConversation1],
      total: 1,
    });
    const getMessagesSpy = vi.spyOn(messagingApi, 'getConversationMessages').mockResolvedValue({
      items: [mockMessage1, mockMessage2],
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    const markReadSpy = vi.spyOn(messagingApi, 'markConversationRead').mockResolvedValue({
      conversation_id: 10,
      marked_read_count: 1,
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
    });

    // Click conversation
    fireEvent.click(screen.getByTestId('conversation-item-10'));

    await waitFor(() => {
      expect(getMessagesSpy).toHaveBeenCalledWith(10, 1, 100);
      expect(markReadSpy).toHaveBeenCalledWith(10);
      expect(screen.getByText('Thank you! I am available anytime this week.')).toBeInTheDocument();
    });
  });

  it('sends message via HTTP and appends to thread', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [mockConversation1],
      total: 1,
    });
    vi.spyOn(messagingApi, 'getConversationMessages').mockResolvedValue({
      items: [mockMessage1],
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(messagingApi, 'markConversationRead').mockResolvedValue({
      conversation_id: 10,
      marked_read_count: 0,
    });

    const sentMessage: Message = {
      id: 103,
      conversation_id: 10,
      sender_id: 1,
      sender_email: 'student@example.com',
      body: 'I am ready for the technical assessment.',
      is_read: false,
      created_at: '2026-09-20T11:10:00Z',
      updated_at: '2026-09-20T11:10:00Z',
    };
    const sendSpy = vi.spyOn(messagingApi, 'sendMessage').mockResolvedValue(sentMessage);

    render(
      <MemoryRouter initialEntries={['/app/messages?conversationId=10']}>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-message-input')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('chat-message-input');
    fireEvent.change(textarea, {
      target: { value: 'I am ready for the technical assessment.' },
    });

    const sendBtn = screen.getByTestId('chat-send-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(10, {
        body: 'I am ready for the technical assessment.',
      });
      expect(
        screen.getByText('I am ready for the technical assessment.')
      ).toBeInTheDocument();
    });
  });

  it('opens NewConversationModal and creates a new conversation', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [],
      total: 0,
    });
    const createSpy = vi.spyOn(messagingApi, 'createConversation').mockResolvedValue(mockConversation1);
    vi.spyOn(messagingApi, 'getConversationMessages').mockResolvedValue({
      items: [mockMessage1],
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(messagingApi, 'markConversationRead').mockResolvedValue({
      conversation_id: 10,
      marked_read_count: 0,
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('new-conversation-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('new-conversation-btn'));

    expect(screen.getByTestId('new-conversation-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('target-user-id-input'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByTestId('initial-message-input'), {
      target: { value: 'Hello from modal' },
    });

    fireEvent.submit(screen.getByTestId('new-conversation-modal').querySelector('form')!);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        other_user_id: 5,
        initial_message: 'Hello from modal',
      });
      expect(screen.getAllByText('Jane Recruiter').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles deep-link ?userId=5 and selects existing conversation', async () => {
    vi.spyOn(messagingApi, 'getConversations').mockResolvedValue({
      items: [mockConversation1],
      total: 1,
    });
    vi.spyOn(messagingApi, 'getConversationMessages').mockResolvedValue({
      items: [mockMessage1],
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(messagingApi, 'markConversationRead').mockResolvedValue({
      conversation_id: 10,
      marked_read_count: 0,
    });

    render(
      <MemoryRouter initialEntries={['/app/messages?userId=5']}>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
      expect(screen.getByText('We reviewed your resume and would like to chat.')).toBeInTheDocument();
    });
  });
});
