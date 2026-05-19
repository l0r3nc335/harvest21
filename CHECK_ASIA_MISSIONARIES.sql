-- Check all published Asia missionaries with their destination_country

SELECT 
  m.id,
  m.first_name,
  m.last_name,
  m.destination_country AS raw_iso,
  m.created_at,
  p.is_published,
  CASE 
    WHEN p.id IS NULL THEN 'NO PAGE'
    WHEN p.is_published = false THEN 'UNPUBLISHED'
    ELSE 'PUBLISHED'
  END AS page_status
FROM missionaries m
LEFT JOIN pages p ON p.organization_type = 'missionary' AND p.organization_id = m.id
WHERE p.is_published = true
  AND LOWER(TRIM(REGEXP_REPLACE(m.destination_country, '[^a-zA-Z]', '', 'g'))) IN (
    'bd', -- Bangladesh
    'bt', -- Bhutan
    'bn', -- Brunei
    'kh', -- Cambodia
    'cn', -- China
    'in', -- India
    'id', -- Indonesia
    'jp', -- Japan
    'kz', -- Kazakhstan
    'kg', -- Kyrgyzstan
    'la', -- Laos
    'my', -- Malaysia
    'mv', -- Maldives
    'mn', -- Mongolia
    'mm', -- Myanmar
    'np', -- Nepal
    'kp', -- North Korea
    'pk', -- Pakistan
    'ph', -- Philippines
    'sg', -- Singapore
    'kr', -- South Korea
    'lk', -- Sri Lanka
    'tw', -- Taiwan
    'tj', -- Tajikistan
    'th', -- Thailand
    'tl', -- Timor-Leste
    'tm', -- Turkmenistan
    'uz', -- Uzbekistan
    'vn', -- Vietnam
    'af', -- Afghanistan
    'am', -- Armenia
    'az', -- Azerbaijan
    'bh', -- Bahrain
    'cy', -- Cyprus
    'ge', -- Georgia
    'iq', -- Iraq
    'il', -- Israel
    'jo', -- Jordan
    'kw', -- Kuwait
    'lb', -- Lebanon
    'om', -- Oman
    'ps', -- Palestine
    'qa', -- Qatar
    'sa', -- Saudi Arabia
    'sy', -- Syria
    'tr', -- Turkey
    'ae', -- UAE
    'ye'  -- Yemen
  )
ORDER BY m.created_at DESC;
