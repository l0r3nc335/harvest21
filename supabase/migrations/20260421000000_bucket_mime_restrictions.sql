BEGIN;

-- Restrict the h21-dev bucket to only safe, non-executable MIME types.
-- SVG is explicitly excluded (stored-XSS vector via embedded <script>).
-- file_size_limit is 100 MB to cover video uploads; individual code paths
-- enforce tighter per-category ceilings (see lib/uploadValidation.ts).

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf'
  ],
  file_size_limit = 104857600
WHERE id = 'h21-dev';

COMMIT;
