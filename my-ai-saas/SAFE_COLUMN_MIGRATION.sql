-- ============================================================================
-- SAFE COLUMN MIGRATION - EXECUTE THIS FIRST
-- ============================================================================
-- This script safely adds missing columns to existing tables
-- Run this BEFORE running COMPLETE_EVERYTHING_SETUP.sql
-- ============================================================================

-- Add missing columns to plan_pricing table if they don't exist
DO $$ 
BEGIN
    -- Add image_generation_time column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'image_generation_time'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN image_generation_time INTEGER DEFAULT 30;
        RAISE NOTICE 'Added image_generation_time column';
    END IF;

    -- Add video_generation_time column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'video_generation_time'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN video_generation_time INTEGER DEFAULT 450;
        RAISE NOTICE 'Added video_generation_time column';
    END IF;

    -- Add max_images_per_month column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'max_images_per_month'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN max_images_per_month INTEGER;
        RAISE NOTICE 'Added max_images_per_month column';
    END IF;

    -- Add max_videos_per_month column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'max_videos_per_month'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN max_videos_per_month INTEGER;
        RAISE NOTICE 'Added max_videos_per_month column';
    END IF;

    -- Add features column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'features'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN features JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added features column';
    END IF;

    -- Add plan_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN plan_type TEXT DEFAULT 'monthly';
        RAISE NOTICE 'Added plan_type column';
    END IF;

    -- Add billing_cycle column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_pricing' 
        AND column_name = 'billing_cycle'
    ) THEN
        ALTER TABLE public.plan_pricing 
        ADD COLUMN billing_cycle TEXT DEFAULT 'monthly';
        RAISE NOTICE 'Added billing_cycle column';
    END IF;

END $$;

-- Show the updated table structure
SELECT 'Updated plan_pricing table structure:' AS info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'plan_pricing' 
ORDER BY ordinal_position;

-- ============================================================================
-- MIGRATION COMPLETE - NOW RUN COMPLETE_EVERYTHING_SETUP.sql
-- ============================================================================
