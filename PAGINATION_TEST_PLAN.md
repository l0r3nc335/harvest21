# Pagination Fix - Test Plan & Debugging Checklist

## Summary of Changes

### Root Causes Fixed (Confidence: 90%+)

1. **No deterministic ordering** - Added `ORDER BY created_at DESC, id DESC`
2. **In-memory limiting** - Now limits at SQL level during fetch
3. **Missing pagination** - Implemented cursor-based pagination
4. **Unstable results** - Consistent ordering guarantees stable pagination

### Files Changed

1. `supabase/functions/fetch_missionaries_overview/index.ts` - Rewritten with proper ordering
2. `supabase/functions/fetch_missionaries_by_region_cursor/index.ts` - New cursor-based pagination
3. `supabase/functions/fetch_missionary_pages_by_region/index.ts` - Added ordering
4. `app/actions/missionaryActions.ts` - New server actions
5. `app/page.tsx` - Updated to use new actions

## How It Works Now

### Initial Load (Home Page)
- Fetches with deterministic order: `created_at DESC, id DESC`
- Limits to 10 per region while maintaining order
- Total limit of 60 items prevents over-fetching
- Each region gets up to 10 items from the ordered stream

### Pagination (Region-Specific Pages)
- Uses cursor-based pagination with `(created_at, id)` tuple
- No duplicates or gaps
- Cursor format: `{ created_at: "ISO-8601", id: 123 }`
- Query: `WHERE (created_at < cursor_created_at) OR (created_at = cursor_created_at AND id < cursor_id)`

## SQL-Level Verification

### 1. Check Database Ordering

```sql
-- Verify missionaries have created_at timestamps
SELECT 
  id, 
  first_name, 
  last_name, 
  created_at,
  destination_country
FROM missionaries
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**Expected**: All rows have `created_at`, ordered newest to oldest.  
**If NULL**: Run migration to add timestamps:

```sql
UPDATE missionaries 
SET created_at = NOW() - (random() * INTERVAL '365 days')
WHERE created_at IS NULL;
```

### 2. Verify 10-Per-Region Logic

```sql
-- Test getting 10 per region manually
WITH ranked AS (
  SELECT 
    m.*,
    ROW_NUMBER() OVER (
      PARTITION BY m.destination_country 
      ORDER BY m.created_at DESC, m.id DESC
    ) as rn
  FROM missionaries m
  INNER JOIN pages p ON p.organization_id = m.id
  WHERE p.organization_type = 'missionary'
    AND p.is_published = true
)
SELECT 
  destination_country,
  COUNT(*) as count
FROM ranked
WHERE rn <= 10
GROUP BY destination_country;
```

**Expected**: Each country/region has exactly 10 or fewer items.

### 3. Test Cursor Logic

```sql
-- Get first page
WITH first_page AS (
  SELECT 
    m.id,
    m.first_name,
    m.last_name,
    m.created_at
  FROM missionaries m
  INNER JOIN pages p ON p.organization_id = m.id
  WHERE p.organization_type = 'missionary'
    AND p.is_published = true
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT 10
)
SELECT * FROM first_page;

-- Then get next page using last row's cursor
-- Replace CURSOR_TIMESTAMP and CURSOR_ID with actual values from last row above
SELECT 
  m.id,
  m.first_name,
  m.last_name,
  m.created_at
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true
  AND (
    m.created_at < 'CURSOR_TIMESTAMP'::timestamptz
    OR (m.created_at = 'CURSOR_TIMESTAMP'::timestamptz AND m.id < CURSOR_ID)
  )
ORDER BY m.created_at DESC, m.id DESC
LIMIT 10;
```

**Expected**: No overlap between pages, no gaps.

## Edge Function Testing

### 1. Test Overview Function

```bash
# Set your Supabase project URL
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
AUTH_TOKEN="YOUR_USER_JWT"

curl -X POST "$SUPABASE_URL/functions/v1/fetch_missionaries_overview" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "North America": [...10 items...],
  "South America": [...10 items...],
  "Europe": [...10 items...],
  "Africa": [...10 items...],
  "Asia": [...10 items...],
  "Australia": [...10 items...]
}
```

**Verify**:
- Each region has ≤ 10 items
- Items are ordered by `created_at DESC, id DESC`
- Total items ≤ 60

### 2. Test Cursor Pagination

```bash
# First page (cursor mode)
curl "$SUPABASE_URL/functions/v1/fetch_missionary_pages_by_region?region=north_america&limit=10&cursor_created_at=&cursor_id=" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Response will include nextCursor
# Use it for the next page:
curl "$SUPABASE_URL/functions/v1/fetch_missionary_pages_by_region?region=north_america&limit=10&cursor_created_at=2025-01-15T12:00:00Z&cursor_id=123" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected**:
- First page: 10 items + `nextCursor`
- Second page: Next 10 items, no overlap
- Last page: `nextCursor: null`, `hasMore: false`

### 3. Test Region-Specific Pagination (Page/Offset Mode)

```bash
# Traditional pagination
curl "$SUPABASE_URL/functions/v1/fetch_missionary_pages_by_region?region=africa&page=1&limit=20" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected**:
```json
{
  "page": 1,
  "limit": 20,
  "total": 150,
  "total_pages": 8,
  "region": "africa",
  "data": [...]
}
```

**Note**: Function supports both modes:
- **Page/Offset mode**: Use `page` and `limit` params
- **Cursor mode**: Use `cursor_created_at` and `cursor_id` params

## Client-Side Testing

### 1. Home Page Load

**Test**: Visit `/` (home page)

**Verify**:
- [ ] Each continent section shows ≤ 10 missionaries
- [ ] No missing continents with data
- [ ] No duplicate entries
- [ ] All profile photos load
- [ ] Click "View All" navigates to region page

**Debug Commands**:
```bash
# Check server logs
npm run dev

# Check browser console for errors
# Open DevTools → Console
```

### 2. Region Page Pagination

**Test**: Visit `/missionaries/africa` or any region

**Verify**:
- [ ] Page 1 loads correctly
- [ ] Pagination controls appear
- [ ] Clicking "Next" loads page 2 without duplicates
- [ ] No missionaries appear on multiple pages
- [ ] Last page shows correct total

**Manual Check**:
1. Note first 5 missionaries on page 1
2. Go to page 2
3. Verify none of those 5 appear on page 2
4. Go back to page 1
5. Verify same 5 missionaries appear

### 3. Filtering + Sorting

**Test**: Apply filters on home page

**Verify**:
- [ ] Continent filter works
- [ ] Country filter shows correct countries
- [ ] Status filter works
- [ ] Support level filter works
- [ ] Sorting maintains consistency

## Performance Testing

### 1. Query Performance

```sql
EXPLAIN ANALYZE
SELECT m.id, m.first_name, m.created_at
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true
ORDER BY m.created_at DESC, m.id DESC
LIMIT 60;
```

**Target**: < 100ms execution time

**If Slow**: Add indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_missionaries_created_at_id 
ON missionaries(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pages_org_type_published 
ON pages(organization_type, is_published, organization_id);
```

### 2. Load Testing

Use browser DevTools Network tab:

**Expected**:
- Initial page load: < 2s
- Edge function response: < 500ms
- Pagination click: < 300ms

## Common Issues & Fixes

### Issue 1: Missing created_at Timestamps

**Symptom**: Inconsistent ordering, random results

**Fix**:
```sql
ALTER TABLE missionaries 
ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE missionaries 
SET created_at = NOW() - (random() * INTERVAL '365 days')
WHERE created_at IS NULL;
```

### Issue 2: Duplicate Entries Across Pages

**Symptom**: Same missionary on pages 1 and 2

**Cause**: Unstable sort (multiple rows with same created_at)

**Fix**: Already implemented - uses `(created_at, id)` compound ordering

### Issue 3: Some Regions Show < 10 Items

**Symptom**: Africa shows 7 items but there are 50 African missionaries

**Possible Causes**:
1. Unpublished pages
2. NULL destination_country
3. Wrong ISO code mapping

**Debug**:
```sql
SELECT 
  m.destination_country,
  COUNT(*) as total,
  COUNT(CASE WHEN p.is_published THEN 1 END) as published
FROM missionaries m
LEFT JOIN pages p ON p.organization_id = m.id AND p.organization_type = 'missionary'
GROUP BY m.destination_country
ORDER BY total DESC;
```

### Issue 4: Wrong Region Assignment

**Symptom**: USA missionary appears in Asia

**Debug**: Check `iso_to_country.ts` mapping

```typescript
// Verify ISO code
console.log(ISO_TO_COUNTRY['us']); // Should be "United States"
console.log(getRegionForCountry("United States")); // Should be "north_america"
```

## Deployment Checklist

Before deploying to production:

- [ ] Run all SQL verification queries
- [ ] Test edge functions in Supabase dashboard
- [ ] Test home page load
- [ ] Test region-specific pages
- [ ] Test pagination (pages 1, 2, last)
- [ ] Test with authenticated user
- [ ] Test with anonymous user
- [ ] Check browser console for errors
- [ ] Verify no RLS policy errors
- [ ] Check server logs for warnings

## Rollback Plan

If issues occur after deployment:

1. Revert edge function to previous version:
```bash
cd supabase
git checkout HEAD~1 functions/fetch_missionaries_overview/
supabase functions deploy fetch_missionaries_overview
```

2. Revert Next.js changes:
```bash
git checkout HEAD~1 app/page.tsx app/actions/
npm run build
```

## Success Criteria

✅ **Must Have**:
- Every continent shows exactly 10 missionaries (or all available if < 10)
- No missing continents with data
- No duplicate entries
- Pagination works without gaps
- Page load < 2s

✅ **Nice to Have**:
- Cursor-based pagination implemented
- Query time < 100ms
- Indexed for performance
- Client-side filtering smooth

## Confidence Assessment

| Aspect | Confidence | Reason |
|--------|-----------|--------|
| Deterministic ordering | 95% | Uses compound (created_at, id) sort |
| 10-per-region limit | 90% | Logic tested, counts in stream |
| No duplicates/gaps | 90% | Cursor-based pagination with tuple comparison |
| All countries correct region | 85% | Depends on ISO_TO_COUNTRY mapping completeness |
| Performance | 80% | May need indexes in production |

## Next Steps

If confidence < 85% after testing:

1. Add database indexes
2. Create SQL function for atomic 10-per-region
3. Add integration tests
4. Monitor production logs
5. Set up alerting for > 10 items per region
