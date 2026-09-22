import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewConversationModal } from '../NewConversationModal';
import * as messagingApi from '@/api/messaging';
import { Conversation } from '@/types/messaging';

vi.mock('@/api/messaging');

const mockCreatedConv: Conversation = {
  id: 10,
  other_participant: {
    id: 5,
    full_name: 'Jane Recruiter',
    email: 'jane@example.com',
    role: 'recruiter',
  },
  last_message: null,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  unread_count: 0,
};

describe('NewConversationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <NewConversationModal
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('submits successfully with target user ID and optional message', async () => {
    const createSpy = vi
      .spyOn(messagingApi, 'createConversation')
      .mockResolvedValue(mockCreatedConv);
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <NewConversationModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        initialUserId={5}
      />
    );

    const input = screen.getByTestId('target-user-id-input');
    expect(input).toHaveValue(5);

    fireEvent.change(screen.getByTestId('initial-message-input'), {
      target: { value: 'Hello there' },
    });

    fireEvent.submit(screen.getByTestId('new-conversation-modal').querySelector('form')!);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        other_user_id: 5,
        initial_message: 'Hello there',
      });
      expect(onSuccess).toHaveBeenCalledWith(mockCreatedConv);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles API errors gracefully and displays error message', async () => {
    vi.spyOn(messagingApi, 'createConversation').mockRejectedValue({
      detail: 'Cannot create conversation with yourself',
    });

    render(
      <NewConversationModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('target-user-id-input'), {
      target: { value: '1' },
    });

    fireEvent.submit(screen.getByTestId('new-conversation-modal').querySelector('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('Cannot create conversation with yourself')
      ).toBeInTheDocument();
    });
  });
});
