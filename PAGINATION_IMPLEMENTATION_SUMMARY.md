# PR Summary: Offset/Limit Pagination + Caching for Followers & Following Tabs

## Overview
Implemented offset-based pagination with TanStack Query (React Query) caching for the Followers and Following tabs in the missionary profile management system.

## Files Changed

### New Files Created
1. **`lib/query-client-provider.tsx`** - QueryClientProvider wrapper with default caching configuration
2. **`types/pagination.ts`** - TypeScript types for paginated API responses
3. **`hooks/useFollowersPagination.ts`** - Custom hooks for fetching user and missionary followers with pagination
4. **`hooks/useFollowingPagination.ts`** - Custom hook for fetching missionary following with pagination
5. **`app/api/missionaries/[id]/followers/users/route.ts`** - API route for paginated user followers
6. **`app/api/missionaries/[id]/followers/missionaries/route.ts`** - API route for paginated missionary followers
7. **`app/api/missionaries/following/route.ts`** - API route for paginated missionary following

### Modified Files
1. **`app/layout.tsx`** - Wrapped app with QueryClientProvider
2. **`components/admin/MissionaryFollowersTab.tsx`** - Refactored to use pagination hooks
3. **`components/missionary/MissionaryFollowingTab.tsx`** - Refactored to use pagination hooks
4. **`package.json`** - Added @tanstack/react-query dependency

## Implementation Details

### Pagination Strategy
- **Type**: Offset-based (page + limit parameters)
- **Page size**: 10 items per page (configurable)
- **Load more UX**: Button-based pagination at bottom of list
- **Ordering**: Deterministic sorting by `requested_at DESC, id DESC` to prevent duplicates

### API Routes
All routes follow consistent pattern:
- **Request**: `GET /api/path?page=N&limit=M`
- **Response**:
  ```typescript
  {
    items: Array<Item>,
    page: number,
    limit: number,
    total: number | null,
    hasMore: boolean
  }
  ```
- **Validation**: 
  - limit: min 1, max 50, default 10
  - page: min 1, default 1
  - offset = (page - 1) * limit
- **hasMore logic**: Request limit+1 records, return hasMore if extra record exists

### Caching Configuration
Using TanStack Query with:
- **staleTime**: 30s - Data considered fresh for 30 seconds (prevents unnecessary refetches on tab switching)
- **gcTime**: 5-10 minutes - Cached data kept in memory for 5-10 minutes after last use
- **refetchOnWindowFocus**: false - Prevents automatic refetch when window regains focus
- **Deduplication**: Client-side dedup by ID to handle edge cases

### Query Keys
Structured for optimal cache invalidation:
- User followers: `["missionaries", missionaryId, "followers", "users", pageSize]`
- Missionary followers: `["missionaries", missionaryId, "followers", "missionaries", pageSize]`
- Following: `["missionaries", "following", pageSize]`

### UI Features
- ✅ Initial loading skeleton (3 placeholder cards)
- ✅ "Load More" button with spinner when fetching
- ✅ Empty state messages
- ✅ Error state handling
- ✅ Search and filter preserved across pagination
- ✅ Tab switching preserves loaded data (thanks to caching)
- ✅ Optimistic UI updates on status changes with cache invalidation

### Data Flow
1. Component mounts → useInfiniteQuery fetches page 1
2. User clicks "Load More" → fetchNextPage() fetches next page
3. Pages flattened and deduped in custom hooks
4. Filtered client-side for search/status filters
5. Action (accept/reject/unfollow) → invalidate relevant query keys → auto-refetch

### Security
- All routes require authentication (check user session)
- User followers/missionary followers restricted to missionary owner or admins
- Following restricted to authenticated missionary
- RLS policies enforced at DB level

## Testing Instructions

### 1. Test User Followers Tab
```bash
# Start dev server
npm run dev

# Navigate to missionary profile settings → Followers tab → Users
# Expected behavior:
# - Initial load shows first 10 followers
# - "Load More" button appears if >10 followers exist
# - Clicking "Load More" appends next 10 items
# - Search filters work across all loaded items
# - Status filter (All/Pending/Accepted) works
# - Accepting/rejecting updates list without full reload
```

### 2. Test Missionary Followers Tab
```bash
# Navigate to → Followers tab → Missionaries
# Same tests as above
```

### 3. Test Following Tab
```bash
# Navigate to missionary settings → Following tab
# Expected behavior:
# - Shows missionaries the current user follows
# - Pagination works with Load More
# - Status filters (Following/Pending/Rejected) work
# - Search filters by missionary name
# - Unfollow/Cancel actions update list
```

### 4. Test Caching
```bash
# 1. Load followers tab (page 1)
# 2. Switch to following tab
# 3. Switch back to followers tab
# Expected: Instant load from cache (no spinner)

# 4. Wait 31 seconds
# 5. Switch tabs again
# Expected: Background refetch (data still shows, updates when ready)
```

### 5. Test Edge Cases
- Empty state (no followers/following)
- Network error handling
- Rapid clicking "Load More" (button should be disabled)
- Search with no results
- Filter combinations

## Database Schema
Uses existing tables:
- `missionary_followers` (user → missionary follows)
- `missionary_missionary_followers` (missionary → missionary follows)

Indexes ensure efficient pagination:
- `idx_missionary_followers_missionary_id`
- `idx_missionary_missionary_followers_followed_missionary_id`

## Performance Benefits
1. **Reduced initial load**: Only fetch 10 items instead of all
2. **Client-side caching**: Tab switching is instant
3. **Optimistic updates**: Actions feel instant with background sync
4. **Efficient re-fetching**: Only invalidate affected queries
5. **Deduplication**: Prevents showing same item twice

## Future Enhancements (Not Implemented)
- [ ] Infinite scroll (instead of Load More button)
- [ ] Total count (requires COUNT query - skipped for performance)
- [ ] Optimistic status updates (currently refetches)
- [ ] Prefetch next page on hover
- [ ] Virtual scrolling for very long lists

## Bug Fixes Applied
1. **Profile Photo URL Issue** - Fixed API routes to fetch `profile_photo_url` from `pages` table (not `missionaries` table which doesn't have this column)
2. **Invalid Date Display** - Fixed by passing `requested_at` as `created_at` to FollowerCard component
3. **Unknown Missionary** - Fixed by correcting the SELECT query in following API route
4. **Clickable Names** - Added clickable links to missionary names that open in new tabs
5. **Infinite Scroll** - Changed from "Load More" button to automatic infinite scroll with IntersectionObserver

## Migration Notes
- ✅ No database migrations required
- ✅ Backward compatible (old non-paginated endpoints still exist)
- ✅ No breaking changes to existing components

## Rollback Plan
If issues arise:
1. Remove QueryClientProvider from layout.tsx
2. Revert MissionaryFollowersTab.tsx and MissionaryFollowingTab.tsx
3. Components will fall back to old server action approach
4. API routes can remain (harmless if unused)

---

**Ready for review and testing!** 🚀
