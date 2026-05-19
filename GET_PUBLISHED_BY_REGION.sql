-- Get all published missionaries grouped by destination country
-- This helps you see exactly which countries have missionaries

SELECT 
  LOWER(TRIM(REGEXP_REPLACE(m.destination_country, '[^a-zA-Z]', '', 'g'))) as normalized_iso,
  m.destination_country as original_iso,
  COUNT(*) as missionary_count,
  STRING_AGG(m.first_name || ' ' || m.last_name, ', ' ORDER BY m.created_at DESC) as missionaries
FROM missionaries m
INNER JOIN pages p 
  ON p.organization_type = 'missionary' 
  AND p.organization_id = m.id
WHERE p.is_published = true
  AND m.destination_country IS NOT NULL
GROUP BY m.destination_country
ORDER BY missionary_count DESC, normalized_iso;

-- Total count
-- SELECT COUNT(*) as total_published_missionaries
-- FROM missionaries m
-- INNER JOIN pages p 
--   ON p.organization_type = 'missionary' 
--   AND p.organization_id = m.id
-- WHERE p.is_published = true;
