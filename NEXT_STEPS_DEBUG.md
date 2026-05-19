# Next Steps to Debug North America Data

## ✅ What I Did

1. **Added robust ISO normalization**:
   - Converts to lowercase
   - Removes special characters
   - Trims whitespace

2. **Added detailed logging**:
   - Shows total fetched
   - Shows how many matched
   - Shows how many skipped and why
   - Shows which regions were found instead

## 🔍 What YOU Need to Do

### Step 1: Check Supabase Logs

Go here: **https://supabase.com/dashboard/project/kstznftkyihjchkfkcah/functions/fetch_missionary_pages_by_region/logs**

Look for the latest log entry. You'll see something like:

```
🔍 FILTERING RESULTS FOR: north_america
   📥 Total fetched: 500
   ✅ Matched region: 4
   ⚠️ Skipped (no page): 0
   ⚠️ Skipped (no ISO mapping): 120
   ⚠️ Skipped (wrong region): 376
   📍 Wrong regions: Chile→south_america, Brazil→south_america, Kenya→africa, ...
```

This will tell us EXACTLY why missionaries aren't showing up!

### Step 2: Based on Logs, Here's What to Check

#### If "Skipped (no ISO mapping)" is HIGH:

**Problem**: Many missionaries have `destination_country` values that aren't in our ISO_TO_COUNTRY mapping.

**Solution**: Run this SQL to see what values need mapping:

```sql
SELECT DISTINCT 
  destination_country,
  COUNT(*) as count
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true
  AND destination_country IS NOT NULL
GROUP BY destination_country
ORDER BY count DESC;
```

Send me the results and I'll add them to the mapping!

#### If "Skipped (wrong region)" is HIGH:

**Problem**: Missionaries are mapped to the correct country, but that country is in a different region.

**Check the log**: Look at "Wrong regions" line. If you see:
- `Philippines→asia` - Good, that's correct
- `Mexico→south_america` - BAD! Should be north_america

This means we need to fix `COUNTRIES_BY_REGION` mapping.

#### If "Skipped (no page)" is HIGH:

**Problem**: Many missionaries don't have published pages.

**Solution**: Check your pages table:

```sql
SELECT COUNT(*) as total_pages
FROM pages
WHERE organization_type = 'missionary'
  AND is_published = true;
```

### Step 3: Quick Test - Check Your Data

Run this in Supabase SQL Editor:

```sql
-- Get sample of missionaries with their destination countries
SELECT 
  m.id,
  m.first_name,
  m.last_name,
  m.destination_country,
  m.country_of_residence,
  p.is_published,
  CASE
    WHEN m.destination_country SIMILAR TO '[a-z]{2}' THEN 'Valid ISO'
    WHEN m.destination_country IS NULL THEN 'NULL'
    ELSE 'Invalid Format: ' || m.destination_country
  END as status
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true
LIMIT 20;
```

This will show you if the format is correct or not.

### Step 4: Expected Format

Your `destination_country` should be **lowercase 2-letter ISO codes**:
- ✅ `"us"` - United States
- ✅ `"ca"` - Canada  
- ✅ `"mx"` - Mexico
- ❌ `"US"` - Uppercase (we handle this now, but check if there are many)
- ❌ `"USA"` - Full name (NOT supported)
- ❌ `"United States"` - Full name (NOT supported)
- ❌ `NULL` - No value

## 📝 Send Me This Info

After checking logs and running SQL, send me:

1. **From Supabase Logs**:
   - How many skipped (no ISO mapping)?
   - How many skipped (wrong region)?
   - What are the "Wrong regions" listed?

2. **From SQL Query**:
   - What are the actual `destination_country` values in your database?
   - Are there many NULLs?
   - Are there any weird formats?

Then I can fix the mapping immediately!

## 🚀 Current Status

- ✅ Functions deployed with better error handling
- ✅ Normalization handles uppercase, spaces, special chars
- ✅ Detailed logging shows exactly what's being skipped
- ⏳ Waiting for log analysis to identify root cause

## Expected Countries in North America

According to our mapping, North America should include:
- United States (us)
- Canada (ca)
- Mexico (mx)
- Greenland (gl)
- Bahamas (bs)
- Cuba (cu)
- Jamaica (jm)
- Haiti (ht)
- Dominican Republic (do)
- Puerto Rico (pr)

If your missionaries are going to these countries but not showing up, there's definitely a mapping issue we can fix!
