-- Keep every admin upload type consistent and suitable for mobile use.
-- 15 MiB = 15 × 1024 × 1024 bytes.

UPDATE storage.buckets
SET file_size_limit = 15728640
WHERE id IN (
  'forms',
  'circular-files',
  'event-media',
  'learning-videos',
  'announcement-images'
);
