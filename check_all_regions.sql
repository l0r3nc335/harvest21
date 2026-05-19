-- Count published missionaries by region
WITH published_missionaries AS (
  SELECT m.*
  FROM missionaries m
  JOIN pages p ON p.organization_type = 'missionary' AND p.organization_id = m.id
  WHERE p.is_published = true
)
SELECT 
  COUNT(*) as total_published,
  COUNT(CASE WHEN destination_country IS NOT NULL THEN 1 END) as with_destination
FROM published_missionaries;
