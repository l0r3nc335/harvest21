-- Get all published missionaries with their details
SELECT 
  m.id,
  m.first_name,
  m.last_name,
  m.email,
  m.destination_country AS destination_iso,
  m.country_of_residence AS residence_iso,
  m.mission_status,
  m.created_at,
  p.id AS page_id,
  p.is_published,
  p.published_at
FROM missionaries m
INNER JOIN pages p 
  ON p.organization_type = 'missionary' 
  AND p.organization_id = m.id
WHERE p.is_published = true
ORDER BY m.created_at DESC;

-- Count by destination region
-- WITH published_missionaries AS (
--   SELECT 
--     m.id,
--     m.destination_country
--   FROM missionaries m
--   INNER JOIN pages p 
--     ON p.organization_type = 'missionary' 
--     AND p.organization_id = m.id
--   WHERE p.is_published = true
-- )
-- SELECT 
--   'Total Published' as region,
--   COUNT(*) as missionary_count
-- FROM published_missionaries;
