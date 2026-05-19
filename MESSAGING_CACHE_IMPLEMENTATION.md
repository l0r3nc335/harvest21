# Messenger Caching System - Implementation Guide

## Overview
A comprehensive client-side caching system for the Messenger feature implementing stale-while-revalidate pattern with optimistic updates, real-time merging, and scroll position preservation.

## Architecture

### Core Components

#### 1. **MessageCache Class** (`lib/messaging/messageCache.ts`)
Singleton cache manager that handles all data storage and retrieval.

**Features:**
- Normalized cache keyed by conversationId and messageId
- LRU eviction (max 100 conversations, 500 messages per thread)
- Request cancellation to prevent race conditions
- Scroll position preservation per conversation
- Optimistic message tracking with reconciliation

**Key Methods:**
```typescript
// Conversation List
getCachedConversationList(): ConversationWithDetails[] | null
setCachedConversationList(conversations): void
updateConversationInList(conversationId, updates): void
isConversationListStale(): boolean

// Messages
getCachedMessages(conversationId): MessageWithSender[] | null
appendMessage(conversationId, message): void
replaceOptimisticMessage(conversationId, tempId, realMessage): void

// Request Management
startRequest(key): AbortController
cancelRequest(key): void

// Cleanup
clear(): void // Call on logout
```

#### 2. **React Hooks** (`lib/messaging/useMessageCache.ts`)

**useCachedConversations()**
```typescript
const { 
  conversations,      // Current conversation list
  isLoading,          // Initial load
  isSyncing,          // Background refetch
  isStale,            // Data needs refresh
  error,              // Error message
  refetch             // Manual refresh
} = useCachedConversations();
```

**Behavior:**
1. Instantly returns cached data if available
2. Shows loading only on first visit
3. Background revalidation if stale (>30s)
4. Auto-sorts by last_message_at
5. Cancels in-flight requests on unmount

**useCachedMessages(conversationId)**
```typescript
const { 
  messages,           // Message array for conversation
  conversation,       // Conversation details
  isLoading,          // Initial load
  isSyncing,          // Background refetch
  isStale,            // Data needs refresh
  error,              // Error message
  refetch             // Manual refresh
} = useCachedMessages(conversationId);
```

**Behavior:**
1. Instant render of cached messages
2. Cancels previous conversation's request when switching
3. Background revalidation if stale
4. Prevents race conditions with request keys

**useScrollPosition(conversationId)**
```typescript
const {
  scrollContainerRef, // Attach to scroll container
  saveScroll,         // Call on scroll
  restoreScroll,      // Call after render
  isNearBottom        // Check if should auto-scroll
} = useScrollPosition(conversationId);
```

**useCacheUpdater()**
```typescript
const {
  updateConversation,           // Update conversation metadata
  appendMessage,                // Add new message
  replaceOptimisticMessage,     // Replace temp message with real one
  updateMessage,                // Edit message
  removeMessage                 // Delete message
} = useCacheUpdater();
```

## Implementation Status

### ✅ Completed
1. **Core Cache Infrastructure**
   - MessageCache class with all CRUD operations
   - Request cancellation system
   - Memory limits and LRU eviction
   - Optimistic message tracking

2. **React Hooks**
   - useCachedConversations with stale-while-revalidate
   - useCachedMessages with race condition prevention
   - useScrollPosition for scroll preservation
   - useCacheUpdater for real-time updates

3. **MessengerLayout Integration**
   - Uses useCachedConversations
   - Real-time updates merge into cache
   - Syncing indicator in header
   - Error handling with toast

### 🚧 In Progress
4. **MessengerChatPanel Integration**
   - Needs to use useCachedMessages
   - Implement scroll position restoration
   - Handle loading/syncing states

5. **MessengerMessageThread Integration**
   - Optimistic send implementation
   - Real-time message merging with deduplication
   - Auto-scroll only when near bottom
   - Scroll position saving on unmount

6. **Edge Cases**
   - Offline indicator and retry logic
   - Message editing/deletion support
   - Pagination with cached pages
   - Infinite scroll

## Usage Examples

### Example 1: Component Using Cached Conversations
```typescript
function ConversationSidebar() {
  const { conversations, isLoading, isSyncing } = useCachedConversations();
  
  if (isLoading) return <LoadingSkeleton />;
  
  return (
    <div>
      {isSyncing && <SyncIndicator />}
      {conversations.map(conv => <ConversationItem key={conv.id} {...conv} />)}
    </div>
  );
}
```

### Example 2: Component Using Cached Messages
```typescript
function ChatPanel({ conversationId }) {
  const { messages, isLoading, isSyncing } = useCachedMessages(conversationId);
  const { scrollContainerRef, restoreScroll, isNearBottom } = useScrollPosition(conversationId);
  
  useEffect(() => {
    restoreScroll();
  }, [messages.length]);
  
  return (
    <div ref={scrollContainerRef}>
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
    </div>
  );
}
```

### Example 3: Real-time Update Integration
```typescript
function MessagesPage() {
  const { updateConversation, appendMessage } = useCacheUpdater();
  
  useEffect(() => {
    const channel = supabase.channel('messages')
      .on('INSERT', 'messages', (payload) => {
        const message = payload.new;
        appendMessage(message.conversation_id, enrichMessage(message));
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, []);
}
```

## Next Steps

### High Priority
1. Update MessengerChatPanel to use useCachedMessages
2. Update MessengerMessageThread for optimistic sends
3. Implement scroll position restoration
4. Add auto-scroll logic (only when near bottom)

### Medium Priority
5. Add offline detection and retry logic
6. Implement message editing/deletion
7. Add pagination support
8. Test rapid conversation switching

### Low Priority
9. Add cache statistics dashboard (debug mode)
10. Implement cache persistence to localStorage
11. Add telemetry for cache hit rates
12. Performance profiling

## Testing Checklist

- [ ] Navigate between conversations rapidly - no stale data shown
- [ ] Send message while offline - shows in UI, syncs when online
- [ ] Receive message in background thread - sidebar updates, unread increments
- [ ] Receive message in open thread - appends, unread stays 0
- [ ] Auto-scroll works only when near bottom
- [ ] Scroll position preserved when switching conversations
- [ ] Optimistic message replaced correctly with server response
- [ ] Duplicate messages never appear
- [ ] Memory doesn't grow unbounded (check with 200+ conversations)
- [ ] Logout clears all cached data
- [ ] Race conditions don't cause wrong data to display
- [ ] Network errors don't blank the UI

## Performance Metrics

**Target Metrics:**
- Cache hit rate: >80%
- Time to interactive (cached): <100ms
- Time to interactive (uncached): <500ms
- Memory usage: <50MB for 100 conversations
- Scroll position accuracy: 100%

## Security Considerations

1. **Clear cache on logout** - Implemented in `messageCache.clear()`
2. **No sensitive data in localStorage** - Cache is memory-only
3. **User isolation** - Cache keys include userId implicitly via server actions
4. **XSS prevention** - All content sanitized before rendering

## Troubleshooting

### Issue: Seeing stale data
- Check `isStale` flag in hook result
- Verify STALE_TIME setting (default 30s)
- Call `refetch()` manually to force refresh

### Issue: Messages duplicating
- Check optimistic message reconciliation logic
- Verify real-time subscription deduplication
- Check message ID uniqueness

### Issue: Memory growing
- Verify LRU eviction is working (check with `messageCache.getStats()`)
- Check for memory leaks in subscriptions
- Ensure `clear()` is called on logout

### Issue: Scroll jumping
- Verify scrollContainerRef is attached correctly
- Check restoreScroll() is called after render
- Ensure saveScroll() is called on unmount

## API Reference

See inline JSDoc comments in source files for detailed API documentation.

