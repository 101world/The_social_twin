-- ===================================================================
-- USER ISOLATION VERIFICATION SCRIPT
-- Run this after creating the generations table to verify perfect security
-- ===================================================================

-- 1. Check all tables have RLS enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as "RLS_Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'generations', 
    'user_credits', 
    'free_credit_claims',
    'media_generations',
    'chat_topics',
    'chat_messages'
)
ORDER BY tablename;

-- 2. Check user isolation policies exist
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd as "Operation",
    CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✅ User Isolated'
        WHEN qual LIKE '%true%' AND roles::text LIKE '%service_role%' THEN '🔧 Service Role'
        ELSE '⚠️ Check Policy'
    END as "Security_Status"
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN (
    'generations', 
    'user_credits', 
    'free_credit_claims',
    'media_generations',
    'chat_topics',
    'chat_messages'
)
ORDER BY tablename, policyname;

-- 3. Check table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name = 'user_id' THEN '🔑 User Key'
        WHEN column_name LIKE '%_at' THEN '📅 Timestamp'
        WHEN column_name = 'id' THEN '🆔 Primary Key'
        ELSE '📝 Data Field'
    END as "Field_Type"
FROM information_schema.columns 
WHERE table_name = 'generations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===================================================================
-- EXPECTED RESULTS FOR PERFECT ISOLATION:
-- 
-- 1. All tables should show RLS_Enabled = true
-- 2. Each table should have:
--    - User isolation policy (auth.uid()::text = user_id)
--    - Service role policy (for API operations)
-- 3. All user-data tables should have user_id column
-- ===================================================================
