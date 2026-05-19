-- Run these queries in your Supabase SQL Editor to find missing missionaries

-- 1. Check how many missionaries have NULL destination_country
SELECT 
  COUNT(*) as total_missionaries,
  COUNT(destination_country) as with_destination,
  COUNT(*) - COUNT(destination_country) as null_destination
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = true;

-- 2. Check unpublished missionary pages
SELECT 
  COUNT(DISTINCT m.id) as missionaries_with_unpublished_pages
FROM missionaries m
INNER JOIN pages p ON p.organization_id = m.id
WHERE p.organization_type = 'missionary'
  AND p.is_published = false;

-- 3. Check missionaries without any page at all
SELECT 
  COUNT(*) as missionaries_without_pages
FROM missionaries m
LEFT JOIN pages p ON p.organization_id = m.id AND p.organization_type = 'missionary'
WHERE p.id IS NULL;

-- 4. If you're expecting US missionaries, check country_of_residence too
SELECT 
  m.id,
  m.first_name,
  m.last_name,
  m.destination_country,
  m.country_of_residence,
  p.is_published
FROM missionaries m
LEFT JOIN pages p ON p.organization_id = m.id AND p.organization_type = 'missionary'
WHERE (
  LOWER(m.destination_country) IN ('us', 'ca', 'mx', 'gl') 
  OR LOWER(m.country_of_residence) IN ('us', 'ca', 'mx', 'gl')
)
ORDER BY p.is_published DESC NULLS LAST;

-- 5. Summary by published status
SELECT 
  CASE 
    WHEN p.is_published = true THEN 'Published'
    WHEN p.is_published = false THEN 'Unpublished'
    ELSE 'No Page'
  END as status,
  COUNT(DISTINCT m.id) as count
FROM missionaries m
LEFT JOIN pages p ON p.organization_id = m.id AND p.organization_type = 'missionary'
GROUP BY p.is_published
ORDER BY status;
