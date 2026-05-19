"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { messageCache } from "./messageCache";
import { getConversations, getConversationDetails, getMessages } from "@/app/messages/message-actions";
import { ConversationWithDetails, MessageWithSender } from "@/types/messaging";

interface UseCachedConversationsResult {
  conversations: ConversationWithDetails[];
  isLoading: boolean;
  isStale: boolean;
  isSyncing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCachedConversations(initialConversations?: ConversationWithDetails[]): UseCachedConversationsResult {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const mountedRef = useRef(true);

  const fetchConversations = useCallback(async (showLoading = true) => {
    const requestKey = "conversations-list";
    messageCache.startRequest(requestKey);

    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsSyncing(true);
      }
      setError(null);

      const result = await getConversations();

      if (!mountedRef.current) return;

      if (result.success) {
        messageCache.setCachedConversationList(result.data);
        setConversations(result.data);
        setIsStale(false);
      } else {
        setError(result.error || "Failed to load conversations");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!mountedRef.current) return;
      console.error("Error fetching conversations:", err);
      setError("Network error");
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsSyncing(false);
      }
      messageCache.finishRequest(requestKey);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!messageCache.getCachedConversationList() && initialConversations?.length) {
      messageCache.setCachedConversationList(initialConversations);
      setConversations(initialConversations);
      setIsLoading(false);
      if (messageCache.isConversationListStale()) {
        fetchConversations(false);
      }
      return () => {
        mountedRef.current = false;
        messageCache.cancelRequest("conversations-list");
      };
    }

    const cached = messageCache.getCachedConversationList();
    if (cached) {
      setConversations(cached);
      setIsLoading(false);
      setIsStale(messageCache.isConversationListStale());

      if (messageCache.isConversationListStale()) {
        fetchConversations(false);
      }
    } else {
      fetchConversations(true);
    }

    return () => {
      mountedRef.current = false;
      messageCache.cancelRequest("conversations-list");
    };
  }, [fetchConversations, initialConversations]);

  return {
    conversations,
    isLoading,
    isStale,
    isSyncing,
    error,
    refetch: () => fetchConversations(false),
  };
}

interface UseCachedMessagesResult {
  messages: MessageWithSender[];
  conversation: ConversationWithDetails | null;
  isLoading: boolean;
  isStale: boolean;
  isSyncing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCachedMessages(conversationId: number): UseCachedMessagesResult {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const mountedRef = useRef(true);
  const conversationIdRef = useRef(conversationId);

  const fetchData = useCallback(async (showLoading = true) => {
    const requestKey = `conversation-${conversationId}`;
    messageCache.startRequest(requestKey);

    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsSyncing(true);
      }
      setError(null);

      const [convResult, messagesResult] = await Promise.all([
        getConversationDetails(conversationId),
        getMessages(conversationId),
      ]);

      if (!mountedRef.current || conversationIdRef.current !== conversationId) {
        return;
      }

      if (convResult.success && convResult.data) {
        messageCache.setCachedConversation(conversationId, convResult.data);
        setConversation(convResult.data);
      }

      if (messagesResult.success) {
        messageCache.setCachedMessages(conversationId, messagesResult.data);
        setMessages(messagesResult.data);
        setIsStale(false);
      } else {
        setError(messagesResult.error || "Failed to load messages");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!mountedRef.current || conversationIdRef.current !== conversationId) {
        return;
      }
      console.error("Error fetching conversation data:", err);
      setError("Network error");
    } finally {
      if (mountedRef.current && conversationIdRef.current === conversationId) {
        setIsLoading(false);
        setIsSyncing(false);
      }
      messageCache.finishRequest(requestKey);
    }
  }, [conversationId]);

  useEffect(() => {
    const prevId = conversationIdRef.current;
    conversationIdRef.current = conversationId;
    mountedRef.current = true;

    messageCache.cancelRequest(`conversation-${prevId}`);

    const cachedConv = messageCache.getCachedConversation(conversationId);
    const cachedMsgs = messageCache.getCachedMessages(conversationId);

    if (cachedConv && cachedMsgs) {
      setConversation(cachedConv);
      setMessages(cachedMsgs);
      setIsLoading(false);
      setError(null);
      const convStale = messageCache.isConversationStale(conversationId);
      const msgsStale = messageCache.areMessagesStale(conversationId);
      setIsStale(convStale || msgsStale);
      if (convStale || msgsStale) {
        fetchData(false);
      }
    } else {
      setConversation(null);
      setMessages([]);
      fetchData(true);
    }

    return () => {
      mountedRef.current = false;
      messageCache.cancelRequest(`conversation-${conversationId}`);
    };
  }, [conversationId, fetchData]);

  return {
    messages,
    conversation,
    isLoading,
    isStale,
    isSyncing,
    error,
    refetch: () => fetchData(false),
  };
}

// Hook for scroll position management
export function useScrollPosition(conversationId: number) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const saveScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight } = scrollContainerRef.current;
      messageCache.saveScrollPosition(conversationId, scrollTop, scrollHeight);
    }
  }, [conversationId]);

  const restoreScroll = useCallback(() => {
    const saved = messageCache.getScrollPosition(conversationId);
    if (saved && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = saved.scrollTop;
    }
  }, [conversationId]);

  const isNearBottom = useCallback((): boolean => {
    if (!scrollContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const threshold = 100; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  return {
    scrollContainerRef,
    saveScroll,
    restoreScroll,
    isNearBottom,
  };
}

// Hook for cache updates (use with real-time subscriptions)
export function useCacheUpdater() {
  const updateConversation = useCallback((conversationId: number, updates: Partial<ConversationWithDetails>) => {
    messageCache.updateConversationInList(conversationId, updates);
  }, []);

  const appendMessage = useCallback((conversationId: number, message: MessageWithSender) => {
    messageCache.appendMessage(conversationId, message);
  }, []);

  const replaceOptimisticMessage = useCallback((conversationId: number, tempId: number, realMessage: MessageWithSender) => {
    messageCache.replaceOptimisticMessage(conversationId, tempId, realMessage);
  }, []);

  const updateMessage = useCallback((conversationId: number, messageId: number, updates: Partial<MessageWithSender>) => {
    messageCache.updateMessage(conversationId, messageId, updates);
  }, []);

  const removeMessage = useCallback((conversationId: number, messageId: number) => {
    messageCache.removeMessage(conversationId, messageId);
  }, []);

  return {
    updateConversation,
    appendMessage,
    replaceOptimisticMessage,
    updateMessage,
    removeMessage,
  };
}

export function usePrefetchMessages() {
  const prefetchConversation = useCallback(async (conversationId: number) => {
    const cachedConv = messageCache.getCachedConversation(conversationId);
    const cachedMsgs = messageCache.getCachedMessages(conversationId);
    
    const convStale = !cachedConv || messageCache.isConversationStale(conversationId);
    const msgsStale = !cachedMsgs || messageCache.areMessagesStale(conversationId);
    
    if (convStale || msgsStale) {
      const requestKey = `prefetch-conversation-${conversationId}`;
      const controller = messageCache.startRequest(requestKey);
      
      try {
        const promises = [];
        
        if (convStale) {
          promises.push(getConversationDetails(conversationId));
        }
        if (msgsStale) {
          promises.push(getMessages(conversationId));
        }
        
        const results = await Promise.all(promises);
        
        let resultIndex = 0;
        if (convStale) {
          const convResult = results[resultIndex++] as Awaited<ReturnType<typeof getConversationDetails>>;
          if (convResult.success && convResult.data) {
            messageCache.setCachedConversation(conversationId, convResult.data);
          }
        }
        if (msgsStale) {
          const msgsResult = results[resultIndex] as Awaited<ReturnType<typeof getMessages>>;
          if (msgsResult.success) {
            messageCache.setCachedMessages(conversationId, msgsResult.data);
          }
        }
      } catch (err) {
        console.error("Prefetch error:", err);
      } finally {
        messageCache.finishRequest(requestKey);
      }
    }
  }, []);
  
  return { prefetchConversation };
}

