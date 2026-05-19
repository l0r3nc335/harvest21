# Debugging North America Data Issue

## Current Status
- Function deployed with 2000 row limit
- Added detailed logging to track skipped missionaries

## How to Debug

### 1. Check Supabase Function Logs
Go to: https://supabase.com/dashboard/project/kstznftkyihjchkfkcah/functions/fetch_missionary_pages_by_region/logs

Look for the latest logs after calling the north_america endpoint. You'll see:

```
📊 Region: north_america, Fetched: X missionaries
🔍 Region: north_america
   ✅ Matched: X
   ⚠️ Skipped (no page): X
   ⚠️ Skipped (no country mapping): X
   ⚠️ Skipped (wrong region): X
   📍 Wrong regions found: [countries mapped to wrong regions]
```

### 2. Check Your Database Directly

Run this query in your Supabase SQL Editor:

```sql
-- Check how many missionaries you actually have
SELECT COUNT(*) as total_missionaries 
FROM missionaries;

-- Check how many have published pages
SELECT COUNT(*) as with_pages
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true;

-- Check destination_country values for North America
SELECT 
  destination_country,
  country_of_residence,
  COUNT(*) as count
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true
  AND (
    LOWER(destination_country) IN ('us', 'usa', 'ca', 'canada', 'mx', 'mexico')
    OR LOWER(country_of_residence) IN ('us', 'usa', 'ca', 'canada', 'mx', 'mexico')
  )
GROUP BY destination_country, country_of_residence;
```

### 3. Common Issues & Solutions

#### Issue 1: Wrong ISO Code Format
**Problem**: `destination_country` = `"USA"` instead of `"us"`

**Check**:
```sql
SELECT DISTINCT destination_country 
FROM missionaries 
WHERE destination_country IS NOT NULL
ORDER BY destination_country;
```

**Solution**: Update ISO_TO_COUNTRY mapping or normalize in code:
```typescript
const iso = (m.destination_country || m.country_of_residence || "").toLowerCase().trim();
```

#### Issue 2: Missing Entries in ISO_TO_COUNTRY
**Problem**: Some ISO codes not in mapping

**Check logs for**: `⚠️ No country found for ISO: xxx`

**Solution**: Add missing codes to `iso_to_country.ts`

#### Issue 3: Countries Not in COUNTRIES_BY_REGION
**Problem**: Country name exists but not in north_america list

**Check logs for**: `📍 Wrong regions found: Country→region`

**Solution**: Add to north_america list in `iso_to_country.ts`:
```typescript
north_america: [
  "United States",
  "Canada",
  "Mexico",
  // Add missing ones here
]
```

### 4. Quick Fix for Common ISO Variations

If you find your database has variations like:
- `"US"`, `"USA"`, `"us"` for United States
- `"CA"`, `"CAN"`, `"ca"` for Canada

Add these to `iso_to_country.ts`:

```typescript
export const ISO_TO_COUNTRY = {
  // ... existing codes ...
  
  // US variations
  "us": "United States",
  "USA": "United States",
  "usa": "United States",
  "US": "United States",
  
  // Canada variations  
  "ca": "Canada",
  "CA": "Canada",
  "CAN": "Canada",
  "can": "Canada",
  
  // Mexico variations
  "mx": "Mexico",
  "MX": "Mexico",
  "MEX": "Mexico",
  "mex": "Mexico",
}
```

### 5. Test After Changes

```bash
# Test the function
curl "https://kstznftkyihjchkfkcah.supabase.co/functions/v1/fetch_missionary_pages_by_region?region=north_america&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  | jq '{total: .total, returned: (.data | length)}'
```

## Current Configuration

- **Query limit**: 2000 missionaries
- **Regions supported**: north_america, south_america, europe, africa, asia, australia
- **ISO mapping**: See `iso_to_country.ts`

## Next Steps

1. Check Supabase logs (link above)
2. Run SQL queries to inspect your data
3. Based on logs, identify the issue:
   - Missing ISO codes?
   - Wrong country names?
   - Countries not in region list?
4. Update `iso_to_country.ts` accordingly
5. Redeploy function
6. Test again

## Contact Points

If you need to update the mapping files:
- `supabase/functions/fetch_missionary_pages_by_region/iso_to_country.ts`
- `supabase/functions/fetch_missionaries_overview/iso_to_country.ts`

Make sure to deploy after changes:
```bash
supabase functions deploy fetch_missionary_pages_by_region --no-verify-jwt
supabase functions deploy fetch_missionaries_overview --no-verify-jwt
```
