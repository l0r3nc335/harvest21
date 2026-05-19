/**
 * Client-side cache for Messenger conversations
 * Implements stale-while-revalidate pattern with normalized data
 */

import { ConversationWithDetails, MessageWithSender } from "@/types/messaging";

interface CachedConversation {
  data: ConversationWithDetails;
  timestamp: number;
}

interface CachedMessages {
  messages: MessageWithSender[];
  pages: Map<number, MessageWithSender[]>; // page number -> messages
  hasMore: boolean;
  lastFetchedPage: number;
  timestamp: number;
}

interface ScrollPosition {
  conversationId: number;
  scrollTop: number;
  scrollHeight: number;
}

interface OptimisticMessage {
  tempId: number;
  conversationId: number;
  content: string;
  timestamp: number;
}

class MessageCache {
  private conversations: Map<number, CachedConversation> = new Map();
  private conversationList: ConversationWithDetails[] | null = null;
  private conversationListTimestamp: number = 0;
  private messages: Map<number, CachedMessages> = new Map();
  private scrollPositions: Map<number, ScrollPosition> = new Map();
  private optimisticMessages: Map<number, OptimisticMessage> = new Map();
  private inflightRequests: Map<string, AbortController> = new Map();
  
  // Config: 120s staleTime = no refetch on every thread switch; background revalidate when stale
  private readonly STALE_TIME = 120000;
  private readonly MAX_CONVERSATIONS = 100;
  private readonly MAX_MESSAGES_PER_THREAD = 500;
  private readonly PAGE_SIZE = 50;

  // Conversation List Cache
  getCachedConversationList(): ConversationWithDetails[] | null {
    if (!this.conversationList) return null;
    return [...this.conversationList];
  }

  setCachedConversationList(conversations: ConversationWithDetails[]): void {
    this.conversationList = conversations;
    this.conversationListTimestamp = Date.now();
    this.evictOldConversations();
  }

  isConversationListStale(): boolean {
    if (!this.conversationList) return true;
    return Date.now() - this.conversationListTimestamp > this.STALE_TIME;
  }

  updateConversationInList(conversationId: number, updates: Partial<ConversationWithDetails>): void {
    if (!this.conversationList) return;
    
    const index = this.conversationList.findIndex(c => c.id === conversationId);
    if (index !== -1) {
      this.conversationList[index] = { ...this.conversationList[index], ...updates };
      
      // Re-sort by last_message_at if it changed
      if (updates.last_message_at) {
        this.conversationList.sort((a, b) => 
          new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
      }
    }
  }

  // Single Conversation Cache
  getCachedConversation(conversationId: number): ConversationWithDetails | null {
    const cached = this.conversations.get(conversationId);
    if (!cached) return null;
    return { ...cached.data };
  }

  setCachedConversation(conversationId: number, conversation: ConversationWithDetails): void {
    this.conversations.set(conversationId, {
      data: conversation,
      timestamp: Date.now(),
    });
  }

  isConversationStale(conversationId: number): boolean {
    const cached = this.conversations.get(conversationId);
    if (!cached) return true;
    return Date.now() - cached.timestamp > this.STALE_TIME;
  }

  // Messages Cache
  getCachedMessages(conversationId: number): MessageWithSender[] | null {
    const cached = this.messages.get(conversationId);
    if (!cached) return null;
    return [...cached.messages];
  }

  setCachedMessages(conversationId: number, messages: MessageWithSender[]): void {
    const existing = this.messages.get(conversationId);
    
    this.messages.set(conversationId, {
      messages: this.deduplicateMessages(messages),
      pages: existing?.pages || new Map(),
      hasMore: existing?.hasMore ?? true,
      lastFetchedPage: existing?.lastFetchedPage ?? 0,
      timestamp: Date.now(),
    });

    this.evictOldMessages(conversationId);
  }

  appendMessage(conversationId: number, message: MessageWithSender): void {
    const cached = this.messages.get(conversationId);
    if (!cached) {
      this.setCachedMessages(conversationId, [message]);
      return;
    }

    // Check for duplicates
    if (cached.messages.some(m => m.id === message.id)) {
      return;
    }

    cached.messages.push(message);
    cached.timestamp = Date.now();
    this.evictOldMessages(conversationId);
  }

  prependMessages(conversationId: number, messages: MessageWithSender[]): void {
    const cached = this.messages.get(conversationId);
    if (!cached) {
      this.setCachedMessages(conversationId, messages);
      return;
    }

    const newMessages = messages.filter(
      newMsg => !cached.messages.some(existing => existing.id === newMsg.id)
    );

    cached.messages = [...newMessages, ...cached.messages];
    cached.timestamp = Date.now();
    this.evictOldMessages(conversationId);
  }

  replaceOptimisticMessage(conversationId: number, tempId: number, realMessage: MessageWithSender): void {
    const cached = this.messages.get(conversationId);
    if (!cached) return;

    const index = cached.messages.findIndex(m => m.id === tempId);
    if (index !== -1) {
      cached.messages[index] = realMessage;
    }

    this.optimisticMessages.delete(tempId);
  }

  removeMessage(conversationId: number, messageId: number): void {
    const cached = this.messages.get(conversationId);
    if (!cached) return;

    cached.messages = cached.messages.filter(m => m.id !== messageId);
  }

  updateMessage(conversationId: number, messageId: number, updates: Partial<MessageWithSender>): void {
    const cached = this.messages.get(conversationId);
    if (!cached) return;

    const index = cached.messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      cached.messages[index] = { ...cached.messages[index], ...updates };
    }
  }

  areMessagesStale(conversationId: number): boolean {
    const cached = this.messages.get(conversationId);
    if (!cached) return true;
    return Date.now() - cached.timestamp > this.STALE_TIME;
  }

  // Optimistic Messages
  addOptimisticMessage(tempId: number, conversationId: number, content: string): void {
    this.optimisticMessages.set(tempId, {
      tempId,
      conversationId,
      content,
      timestamp: Date.now(),
    });
  }

  getOptimisticMessage(tempId: number): OptimisticMessage | undefined {
    return this.optimisticMessages.get(tempId);
  }

  // Scroll Position
  saveScrollPosition(conversationId: number, scrollTop: number, scrollHeight: number): void {
    this.scrollPositions.set(conversationId, {
      conversationId,
      scrollTop,
      scrollHeight,
    });
  }

  getScrollPosition(conversationId: number): ScrollPosition | undefined {
    return this.scrollPositions.get(conversationId);
  }

  // Request Management (race condition prevention)
  startRequest(key: string): AbortController {
    // Cancel existing request with same key
    this.cancelRequest(key);

    const controller = new AbortController();
    this.inflightRequests.set(key, controller);
    return controller;
  }

  cancelRequest(key: string): void {
    const controller = this.inflightRequests.get(key);
    if (controller) {
      controller.abort();
      this.inflightRequests.delete(key);
    }
  }

  finishRequest(key: string): void {
    this.inflightRequests.delete(key);
  }

  // Utility Methods
  private deduplicateMessages(messages: MessageWithSender[]): MessageWithSender[] {
    const seen = new Set<number>();
    return messages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }

  private evictOldMessages(conversationId: number): void {
    const cached = this.messages.get(conversationId);
    if (!cached) return;

    if (cached.messages.length > this.MAX_MESSAGES_PER_THREAD) {
      // Keep the most recent messages
      cached.messages = cached.messages.slice(-this.MAX_MESSAGES_PER_THREAD);
    }
  }

  private evictOldConversations(): void {
    if (!this.conversationList || this.conversationList.length <= this.MAX_CONVERSATIONS) {
      return;
    }

    // Keep the most recent conversations
    this.conversationList = this.conversationList.slice(0, this.MAX_CONVERSATIONS);

    // Remove messages for evicted conversations
    const activeConversationIds = new Set(this.conversationList.map(c => c.id));
    for (const [id] of this.messages) {
      if (!activeConversationIds.has(id)) {
        this.messages.delete(id);
        this.scrollPositions.delete(id);
      }
    }
  }

  // Clear cache (e.g., on logout)
  clear(): void {
    this.conversations.clear();
    this.conversationList = null;
    this.conversationListTimestamp = 0;
    this.messages.clear();
    this.scrollPositions.clear();
    this.optimisticMessages.clear();
    this.inflightRequests.forEach(controller => controller.abort());
    this.inflightRequests.clear();
  }

  // Get cache stats (for debugging)
  getStats() {
    return {
      conversationsCount: this.conversations.size,
      conversationListLength: this.conversationList?.length ?? 0,
      messagesCount: this.messages.size,
      totalMessages: Array.from(this.messages.values()).reduce((sum, c) => sum + c.messages.length, 0),
      scrollPositionsCount: this.scrollPositions.size,
      optimisticMessagesCount: this.optimisticMessages.size,
      inflightRequestsCount: this.inflightRequests.size,
    };
  }
}

// Singleton instance
export const messageCache = new MessageCache();

