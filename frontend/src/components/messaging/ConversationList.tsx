/**
 * ConversationList Component
 * Renders the left-pane list of active conversations with search filtering,
 * unread badges, participant identities, and accessible selection.
 */

import React from 'react';
import { Conversation } from '@/types/messaging';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
  isLoading?: boolean;
  error?: string | null;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelectConversation,
  onNewConversation,
  isLoading = false,
  error = null,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = React.useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const onSearchChange = externalOnSearchChange || setInternalSearchQuery;
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = c.other_participant.full_name?.toLowerCase() || '';
    const email = c.other_participant.email.toLowerCase();
    const company = c.other_participant.company_name?.toLowerCase() || '';
    const lastMsg = c.last_message?.body.toLowerCase() || '';
    return (
      name.includes(q) ||
      email.includes(q) ||
      company.includes(q) ||
      lastMsg.includes(q)
    );
  });

  return (
    <aside className="cb-conversation-list-panel" aria-label="Conversations">
      <div className="cb-conv-header">
        <div className="cb-conv-header-top">
          <h2 className="cb-conv-title">Messages</h2>
          <button
            type="button"
            className="cb-btn cb-btn-primary cb-btn-sm"
            onClick={onNewConversation}
            data-testid="new-conversation-btn"
            aria-label="Start new conversation"
          >
            ✏️ New Message
          </button>
        </div>

        <div className="cb-conv-search-wrap">
          <input
            type="text"
            className="cb-input cb-input-sm cb-conv-search"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search conversations"
            data-testid="conversation-search-input"
          />
        </div>
      </div>

      <div className="cb-conv-body">
        {error && (
          <div className="cb-alert cb-alert-danger cb-conv-error" role="alert">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="cb-conv-loading" role="status" aria-live="polite">
            <div className="cb-spinner cb-spinner-sm" aria-hidden="true" />
            <p>Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="cb-conv-empty" data-testid="conversations-empty-state">
            <p className="cb-empty-title">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </p>
            <p className="cb-empty-desc">
              {searchQuery
                ? 'Try a different search keyword.'
                : 'Start a conversation with a candidate or recruiter.'}
            </p>
          </div>
        ) : (
          <ul className="cb-conv-items" role="listbox" aria-label="Conversation list">
            {filteredConversations.map((conv) => {
              const isSelected = selectedId === conv.id;
              const participant = conv.other_participant;
              const displayName =
                participant.full_name || participant.company_name || participant.email;
              const subTitle =
                participant.company_name && participant.full_name
                  ? `${participant.company_name} • ${participant.role}`
                  : participant.role;

              return (
                <li
                  key={conv.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  className={`cb-conv-item ${isSelected ? 'cb-conv-item-active' : ''} ${
                    conv.unread_count > 0 ? 'cb-conv-item-unread' : ''
                  }`}
                  onClick={() => onSelectConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectConversation(conv.id);
                    }
                  }}
                  data-testid={`conversation-item-${conv.id}`}
                >
                  <div className="cb-conv-item-avatar">
                    <span className="cb-conv-avatar-text">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="cb-conv-item-content">
                    <div className="cb-conv-item-row-top">
                      <span className="cb-conv-item-name">{displayName}</span>
                      {conv.last_message && (
                        <span className="cb-conv-item-time">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="cb-conv-item-subtitle">{subTitle}</div>

                    <div className="cb-conv-item-row-bottom">
                      <p className="cb-conv-item-snippet">
                        {conv.last_message
                          ? conv.last_message.body
                          : 'No messages yet'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span
                          className="cb-badge cb-badge-unread cb-conv-unread-badge"
                          data-testid={`unread-count-${conv.id}`}
                          aria-label={`${conv.unread_count} unread messages`}
                        >
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
