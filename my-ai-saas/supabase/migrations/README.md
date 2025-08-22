Run this migration to add missing columns used by the background worker and the new save-to-library flow.

Options:

1) Supabase SQL Editor
   - Open your Supabase project dashboard -> SQL Editor -> New query.
   - Paste the contents of `20250822_add_media_generation_columns.sql` and run.

2) Supabase CLI (locally)
   - Install supabase CLI: https://supabase.com/docs/guides/cli
   - Run: `supabase db query supabase/migrations/20250822_add_media_generation_columns.sql`

This migration is non-destructive and uses IF NOT EXISTS so it is safe to re-run.
