-- FIRST: Check what tables and columns actually exist
-- Run this first to see the current structure

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name LIKE '%user%' OR table_name LIKE '%messenger%'
ORDER BY table_name, ordinal_position;
