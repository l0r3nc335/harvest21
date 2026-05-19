-- Check ALL missionaries (published and unpublished) with Oceania destination
SELECT 
  m.id,
  m.first_name,
  m.last_name,
  m.destination_country,
  m.created_at,
  p.is_published,
  CASE 
    WHEN p.id IS NULL THEN 'NO PAGE'
    WHEN p.is_published = false THEN 'UNPUBLISHED'
    ELSE 'PUBLISHED'
  END AS status
FROM missionaries m
LEFT JOIN pages p ON p.organization_type = 'missionary' AND p.organization_id = m.id
WHERE LOWER(TRIM(REGEXP_REPLACE(m.destination_country, '[^a-zA-Z]', '', 'g'))) IN (
  'au',  -- Australia
  'nz',  -- New Zealand
  'pg',  -- Papua New Guinea
  'fj',  -- Fiji
  'ws',  -- Samoa
  'to',  -- Tonga
  'vu',  -- Vanuatu
  'sb',  -- Solomon Islands
  'ck',  -- Cook Islands
  'nu',  -- Niue
  'tk',  -- Tokelau
  'wf',  -- Wallis and Futuna
  'nc',  -- New Caledonia
  'pf',  -- French Polynesia
  'pn',  -- Pitcairn Islands
  'pw',  -- Palau
  'tv',  -- Tuvalu
  'nr',  -- Nauru
  'ki',  -- Kiribati
  'mh',  -- Marshall Islands
  'fm'   -- Micronesia
)
ORDER BY p.is_published DESC, m.created_at DESC;
