# GitHub Secrets Setup for Automated News Scraping

## IMPORTANT: Supabase Key Configuration

⚠️ **Current Issue**: The provided key is an `anon` key (for client-side use). For the automated news scraper to work, we need the `service_role` key.

### Get the Service Role Key:
1. Go to: https://supabase.com/dashboard/project/tnlftxudmiryrgkajfun/settings/api
2. Copy the **service_role** key (starts with `eyJ...` and is longer than anon key)
3. Use that key in Step 1 below

### Alternative: Fix Database Permissions
If you want to use the current anon key, run the SQL in `fix-supabase-policies.sql` in your Supabase SQL editor first.

## Step 1: Add Secrets to GitHub Repository

1. Go to your repository: https://github.com/101world/The_social_twin
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** for each of the following:

### Secret 1: NEXT_PUBLIC_SUPABASE_URL
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://tnlftxudmiryrgkajfun.supabase.co`

### Secret 2: SUPABASE_SERVICE_ROLE_KEY
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `[YOUR_SERVICE_ROLE_KEY_HERE]` (get from Supabase dashboard)
- **Current anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTQxODEsImV4cCI6MjA3MDU3MDE4MX0.VEiU7iBh9LdjkT3fVvkfNJcT2haw4iQijj-rAxjqobc`

## Step 2: Test the Automation

After adding the secrets, you can:

1. **Manual Test**: Go to Actions tab → Select "Fresh News Sync Every 10 Minutes" → Click "Run workflow"
2. **Automatic**: The workflow will run every 10 minutes automatically

## Step 3: Vercel Deployment

The Vercel deployment should happen automatically when you push changes to main branch. Your latest commit with the news scraping system is already pushed.

## Verification

- ✅ GitHub Actions workflow configured
- ✅ Fresh news scraper script created
- ✅ Time-based sorting implemented
- ✅ Clean UI with weather widget
- 🔄 **NEXT**: Add the secrets above to enable automation

Once secrets are added, your news platform will automatically update every 10 minutes with fresh content!
