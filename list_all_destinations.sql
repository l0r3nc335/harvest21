-- List all unique destination_country codes from published missionaries
SELECT 
  DISTINCT LOWER(TRIM(REGEXP_REPLACE(m.destination_country, '[^a-zA-Z]', '', 'g'))) as iso_code,
  m.destination_country as original_value,
  COUNT(*) as missionary_count
FROM missionaries m
JOIN pages p ON p.organization_type = 'missionary' AND p.organization_id = m.id
WHERE p.is_published = true
GROUP BY m.destination_country
ORDER BY missionary_count DESC, iso_code;
