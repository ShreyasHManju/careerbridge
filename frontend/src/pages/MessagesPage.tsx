/**
 * MessagesPage Component (Phase F-09)
 * Primary messaging dashboard with two-pane responsive layout, deep-linking,
 * real-time WebSocket sync, and HTTP fallback.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Conversation, Message } from '@/types/messaging';
import * as messagingApi from '@/api/messaging';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ChatWindow } from '@/components/messaging/ChatWindow';
import { NewConversationModal } from '@/components/messaging/NewConversationModal';

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState<boolean>(false);
  const [initialModalUserId, setInitialModalUserId] = useState<number | null>(null);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setConvError(null);
    try {
      const resp = await messagingApi.getConversations();
      setConversations(resp.items);
      return resp.items;
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setConvError(errorObj?.message || 'Failed to load conversations.');
      return [];
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations().then((loadedConvs) => {
      const convIdParam = searchParams.get('conversationId');
      const userIdParam = searchParams.get('userId');

      if (convIdParam) {
        const parsed = parseInt(convIdParam, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setSelectedConvId(parsed);
          return;
        }
      }

      if (userIdParam) {
        const parsedUserId = parseInt(userIdParam, 10);
        if (!isNaN(parsedUserId) && parsedUserId > 0) {
          const existing = loadedConvs.find(
            (c) => c.other_participant?.id === parsedUserId
          );
          if (existing) {
            setSelectedConvId(existing.id);
            setSearchParams({ conversationId: String(existing.id) });
          } else {
            setInitialModalUserId(parsedUserId);
            setIsNewConvModalOpen(true);
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConversations]);

  // Load message history when selected conversation changes
  const fetchMessages = useCallback(async (convId: number) => {
    setIsLoadingMessages(true);
    setMessagesError(null);
    try {
      const resp = await messagingApi.getConversationMessages(convId, 1, 100);
      setMessages(resp.items);

      // Mark unread messages as read
      try {
        await messagingApi.markConversationRead(convId);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
        );
      } catch {
        // Ignore read-receipt error in background
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setMessagesError(errorObj?.message || 'Failed to load message thread.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, fetchMessages]);

  // Handle incoming real-time WebSocket events
  const handleIncomingMessage = useCallback(
    (newMsg: Message) => {
      if (newMsg.conversation_id === selectedConvId) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // If message is from other user, mark as read
        if (newMsg.sender_id !== user?.id) {
          messagingApi.markConversationRead(newMsg.conversation_id).catch(() => {});
        }
      }

      // Update conversation list preview & unread counts
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === newMsg.conversation_id);
        if (existingIdx >= 0) {
          const updatedConv = {
            ...prev[existingIdx],
            last_message: newMsg,
            updated_at: newMsg.created_at,
            unread_count:
              newMsg.conversation_id === selectedConvId || newMsg.sender_id === user?.id
                ? 0
                : prev[existingIdx].unread_count + 1,
          };
          const next = [...prev];
          next.splice(existingIdx, 1);
          return [updatedConv, ...next];
        } else {
          // New conversation appeared
          fetchConversations();
          return prev;
        }
      });
    },
    [selectedConvId, user?.id, fetchConversations]
  );

  const handleMessagesReadEvent = useCallback((event: { conversation_id: number }) => {
    if (event.conversation_id === selectedConvId) {
      setMessages((prev) =>
        prev.map((m) => (!m.is_read ? { ...m, is_read: true } : m))
      );
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === event.conversation_id ? { ...c, unread_count: 0 } : c
      )
    );
  }, [selectedConvId]);

  const handleSingleMessageReadEvent = useCallback(
    (event: { conversation_id: number; message_id: number }) => {
      if (event.conversation_id === selectedConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.message_id ? { ...m, is_read: true } : m
          )
        );
      }
    },
    [selectedConvId]
  );

  // Hook into WebSocket
  const { connectionState, sendMessage: wsSend } = useWebSocket({
    conversationId: selectedConvId,
    onNewMessage: handleIncomingMessage,
    onMessagesRead: handleMessagesReadEvent,
    onMessageRead: handleSingleMessageReadEvent,
    enabled: Boolean(selectedConvId),
  });

  // Sending a message: try WebSocket first; if offline, fallback to HTTP REST
  const handleSendMessage = async (body: string) => {
    if (!selectedConvId) return;

    if (connectionState === 'connected') {
      const sentViaWs = wsSend(body);
      if (sentViaWs) {
        return;
      }
    }

    // HTTP REST Fallback
    const newMsg = await messagingApi.sendMessage(selectedConvId, { body });
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedConvId);
      if (idx >= 0) {
        const updated = {
          ...prev[idx],
          last_message: newMsg,
          updated_at: newMsg.created_at,
        };
        const next = [...prev];
        next.splice(idx, 1);
        return [updated, ...next];
      }
      return prev;
    });
  };

  const handleSelectConversation = (id: number) => {
    setSelectedConvId(id);
    setSearchParams({ conversationId: String(id) });
  };

  const handleBackToConversations = () => {
    setSelectedConvId(null);
    setSearchParams({});
  };

  const handleNewConversationSuccess = (newConv: Conversation) => {
    setConversations((prev) => {
      if (prev.some((c) => c.id === newConv.id)) {
        return prev.map((c) => (c.id === newConv.id ? newConv : c));
      }
      return [newConv, ...prev];
    });
    setSelectedConvId(newConv.id);
    setSearchParams({ conversationId: String(newConv.id) });
  };

  const selectedConversation =
    conversations.find((c) => c.id === selectedConvId) || null;

  return (
    <div className="cb-messages-page-container" data-testid="messages-page">
      <div className={`cb-messages-layout ${selectedConvId ? 'cb-has-selected-conv' : ''}`}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConvId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => {
            setInitialModalUserId(null);
            setIsNewConvModalOpen(true);
          }}
          isLoading={isLoadingConversations}
          error={convError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <ChatWindow
          conversation={selectedConversation}
          messages={messages}
          currentUserId={user?.id || null}
          isLoadingMessages={isLoadingMessages}
          error={messagesError}
          onRetry={() => selectedConvId && fetchMessages(selectedConvId)}
          onSendMessage={handleSendMessage}
          connectionState={connectionState}
          onBack={handleBackToConversations}
        />
      </div>

      <NewConversationModal
        isOpen={isNewConvModalOpen}
        onClose={() => setIsNewConvModalOpen(false)}
        onSuccess={handleNewConversationSuccess}
        initialUserId={initialModalUserId}
      />
    </div>
  );
};
