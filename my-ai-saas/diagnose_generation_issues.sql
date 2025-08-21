-- ===================================================================
-- GENERATION SYSTEM DIAGNOSTIC SCRIPT
-- Run this to identify and fix any remaining chat/generation issues
-- ===================================================================

-- 1. Check if generations table exists with correct structure
SELECT 
    'generations_table_check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generations') 
        THEN '✅ Table exists'
        ELSE '❌ Table missing - Run complete_generations_fix.sql'
    END as status;

-- 2. Check required columns exist
SELECT 
    'required_columns_check' as check_type,
    string_agg(
        CASE 
            WHEN column_name IN ('id', 'user_id', 'type', 'prompt', 'result_url', 'content', 'duration_seconds', 'metadata', 'created_at', 'updated_at') 
            THEN '✅ ' || column_name
            ELSE '❓ ' || column_name
        END, 
        ', ' ORDER BY ordinal_position
    ) as status
FROM information_schema.columns 
WHERE table_name = 'generations' 
AND table_schema = 'public';

-- 3. Check missing required columns
SELECT 
    'missing_columns_check' as check_type,
    CASE 
        WHEN missing_cols = '' THEN '✅ All required columns present'
        ELSE '❌ Missing: ' || missing_cols
    END as status
FROM (
    SELECT string_agg(required_col, ', ') as missing_cols
    FROM (
        SELECT unnest(ARRAY['id', 'user_id', 'type', 'prompt', 'result_url', 'content', 'duration_seconds', 'metadata', 'created_at', 'updated_at']) as required_col
    ) req
    WHERE required_col NOT IN (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'generations' 
        AND table_schema = 'public'
    )
) missing;

-- 4. Check RLS is enabled
SELECT 
    'rls_check' as check_type,
    CASE 
        WHEN rowsecurity THEN '✅ RLS enabled'
        ELSE '❌ RLS disabled - Security risk!'
    END as status
FROM pg_tables 
WHERE tablename = 'generations' 
AND schemaname = 'public';

-- 5. Check user isolation policies exist
SELECT 
    'user_isolation_check' as check_type,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ User isolation policies present'
        ELSE '❌ Missing user isolation policies'
    END as status
FROM pg_policies 
WHERE tablename = 'generations' 
AND schemaname = 'public';

-- 6. Check related tables for chat system
SELECT 
    'chat_tables_check' as check_type,
    string_agg(
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t.table_name)
            THEN '✅ ' || t.table_name
            ELSE '❌ ' || t.table_name
        END,
        ', '
    ) as status
FROM (VALUES 
    ('chat_topics'),
    ('chat_messages'), 
    ('media_generations'),
    ('user_credits'),
    ('free_credit_claims')
) t(table_name);

-- ===================================================================
-- COMMON ISSUES AND SOLUTIONS
-- ===================================================================

-- If you see "❌ Table missing":
-- → Run the complete_generations_fix.sql script

-- If you see "❌ Missing: duration_seconds":
-- → The old table is incomplete, drop it and recreate:
-- DROP TABLE IF EXISTS public.generations;
-- → Then run complete_generations_fix.sql

-- If you see "❌ RLS disabled":
-- → Run: ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- If you see "❌ Missing user isolation policies":
-- → Run the complete_generations_fix.sql script for policies
-- ===================================================================
