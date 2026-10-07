-- Lesson videos may be larger than other documents and images.
-- 100 MiB = 100 × 1024 × 1024 bytes.

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'learning-videos';
