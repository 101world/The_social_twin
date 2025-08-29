-- Check what columns exist in media_generations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'media_generations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check a sample of actual data
SELECT id, user_id, type, status, 
       CASE WHEN result_url IS NOT NULL THEN 'HAS_RESULT_URL' ELSE 'NO_RESULT_URL' END as result_url_status,
       CASE WHEN media_url IS NOT NULL THEN 'HAS_MEDIA_URL' ELSE 'NO_MEDIA_URL' END as media_url_status,
       created_at
FROM media_generations 
WHERE user_id = 'user_2qOcWKMYj3X8vXJKSDx9J0yy7G6'
ORDER BY created_at DESC 
LIMIT 10;
