import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConversationList } from '../ConversationList';
import { Conversation } from '@/types/messaging';

const mockConversations: Conversation[] = [
  {
    id: 1,
    other_participant: {
      id: 2,
      full_name: 'Alice Recruiter',
      email: 'alice@recruiter.com',
      role: 'recruiter',
      company_name: 'Acme Corp',
    },
    last_message: {
      id: 10,
      conversation_id: 1,
      sender_id: 2,
      body: 'Can you interview tomorrow?',
      is_read: false,
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T10:00:00Z',
    },
    created_at: '2026-09-20T09:00:00Z',
    updated_at: '2026-09-20T10:00:00Z',
    unread_count: 2,
  },
  {
    id: 2,
    other_participant: {
      id: 3,
      full_name: 'Bob Candidate',
      email: 'bob@candidate.com',
      role: 'job_seeker',
    },
    last_message: null,
    created_at: '2026-09-19T09:00:00Z',
    updated_at: '2026-09-19T09:00:00Z',
    unread_count: 0,
  },
];

describe('ConversationList Component', () => {
  it('renders conversations list and filters by search query', () => {
    const onSelect = vi.fn();
    const onNew = vi.fn();

    render(
      <ConversationList
        conversations={mockConversations}
        selectedId={1}
        onSelectConversation={onSelect}
        onNewConversation={onNew}
      />
    );

    expect(screen.getByText('Alice Recruiter')).toBeInTheDocument();
    expect(screen.getByText('Bob Candidate')).toBeInTheDocument();
    expect(screen.getByLabelText('2 unread messages')).toBeInTheDocument();

    // Filter by search
    const searchInput = screen.getByTestId('conversation-search-input');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice Recruiter')).toBeInTheDocument();
    expect(screen.queryByText('Bob Candidate')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Bob Candidate')).toBeInTheDocument();
  });

  it('handles item selection and new conversation button click', () => {
    const onSelect = vi.fn();
    const onNew = vi.fn();

    render(
      <ConversationList
        conversations={mockConversations}
        selectedId={null}
        onSelectConversation={onSelect}
        onNewConversation={onNew}
      />
    );

    fireEvent.click(screen.getByTestId('conversation-item-2'));
    expect(onSelect).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByTestId('new-conversation-btn'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no conversations exist', () => {
    render(
      <ConversationList
        conversations={[]}
        selectedId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
      />
    );

    expect(screen.getByTestId('conversations-empty-state')).toBeInTheDocument();
  });
});
