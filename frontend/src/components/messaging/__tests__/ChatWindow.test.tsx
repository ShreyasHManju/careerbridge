import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatWindow } from '../ChatWindow';
import { Conversation, Message } from '@/types/messaging';

const mockConv: Conversation = {
  id: 1,
  other_participant: {
    id: 2,
    full_name: 'Alice Recruiter',
    email: 'alice@recruiter.com',
    role: 'recruiter',
    company_name: 'Tech Inc',
  },
  last_message: null,
  created_at: '2026-09-20T09:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  unread_count: 0,
};

const mockMessages: Message[] = [
  {
    id: 10,
    conversation_id: 1,
    sender_id: 2,
    sender_email: 'alice@recruiter.com',
    body: 'Hi, are you available for a chat?',
    is_read: true,
    created_at: '2026-09-20T10:00:00Z',
    updated_at: '2026-09-20T10:00:00Z',
  },
  {
    id: 11,
    conversation_id: 1,
    sender_id: 1,
    sender_email: 'me@candidate.com',
    body: 'Yes, absolutely!',
    is_read: false,
    created_at: '2026-09-20T10:05:00Z',
    updated_at: '2026-09-20T10:05:00Z',
  },
];

describe('ChatWindow Component', () => {
  it('renders placeholder when conversation is null', () => {
    render(
      <ChatWindow
        conversation={null}
        messages={[]}
        currentUserId={1}
        connectionState="disconnected"
        isLoadingMessages={false}
        error={null}
        onRetry={vi.fn()}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByTestId('no-conversation-selected')).toBeInTheDocument();
  });

  it('renders chat header, message bubbles, and status pill', () => {
    render(
      <ChatWindow
        conversation={mockConv}
        messages={mockMessages}
        currentUserId={1}
        connectionState="connected"
        isLoadingMessages={false}
        error={null}
        onRetry={vi.fn()}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByText('Alice Recruiter')).toBeInTheDocument();
    expect(screen.getByText('Tech Inc')).toBeInTheDocument();
    expect(screen.getByTestId('ws-status-connected')).toBeInTheDocument();
    expect(screen.getByText('Hi, are you available for a chat?')).toBeInTheDocument();
    expect(screen.getByText('Yes, absolutely!')).toBeInTheDocument();
  });

  it('handles sending message and character limit', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(
      <ChatWindow
        conversation={mockConv}
        messages={mockMessages}
        currentUserId={1}
        connectionState="connected"
        isLoadingMessages={false}
        error={null}
        onRetry={vi.fn()}
        onSendMessage={onSend}
      />
    );

    const input = screen.getByTestId('chat-message-input');
    const sendBtn = screen.getByTestId('chat-send-btn');

    expect(sendBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Looking forward to it.' } });
    expect(sendBtn).not.toBeDisabled();
    expect(screen.getByText('22 / 5000')).toBeInTheDocument();

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Looking forward to it.');
    });
  });

  it('supports Enter to send message', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(
      <ChatWindow
        conversation={mockConv}
        messages={[]}
        currentUserId={1}
        connectionState="connected"
        isLoadingMessages={false}
        error={null}
        onRetry={vi.fn()}
        onSendMessage={onSend}
      />
    );

    const input = screen.getByTestId('chat-message-input');
    fireEvent.change(input, { target: { value: 'Quick reply' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Quick reply');
    });
  });
});
