import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageBubble } from '../MessageBubble';
import { Message } from '@/types/messaging';

const mockMessage: Message = {
  id: 101,
  conversation_id: 1,
  sender_id: 2,
  sender_email: 'jane@example.com',
  body: 'Hello, this is a test message with <script>alert("xss")</script>!',
  is_read: true,
  created_at: '2026-09-20T10:30:00Z',
  updated_at: '2026-09-20T10:30:00Z',
};

describe('MessageBubble Component', () => {
  it('renders sent message aligned right without sender label', () => {
    render(<MessageBubble message={mockMessage} isOwnMessage={true} />);

    const bubble = screen.getByTestId('message-bubble-101');
    expect(bubble).toBeInTheDocument();
    expect(bubble.className).toContain('cb-msg-own');

    // Should NOT render sender email for own messages
    expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();

    // Plain text rendering should include script tags as text, NOT executed
    expect(
      screen.getByText('Hello, this is a test message with <script>alert("xss")</script>!')
    ).toBeInTheDocument();

    // Read receipt checkmark
    expect(screen.getByLabelText('Read')).toBeInTheDocument();
  });

  it('renders received message aligned left with sender label', () => {
    const unreadMessage: Message = { ...mockMessage, is_read: false };
    render(<MessageBubble message={unreadMessage} isOwnMessage={false} />);

    const bubble = screen.getByTestId('message-bubble-101');
    expect(bubble).toBeInTheDocument();
    expect(bubble.className).toContain('cb-msg-other');

    // Sender email visible
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();

    // No read receipt checkmark for other's messages
    expect(screen.queryByLabelText('Read')).not.toBeInTheDocument();
  });
});
