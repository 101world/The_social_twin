# VERCEL ENVIRONMENT VARIABLES SETUP GUIDE

## In your Vercel Dashboard > Settings > Environment Variables, add:

### Clerk Production (Replace with your actual live keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_LIVE_KEY
CLERK_SECRET_KEY=sk_live_YOUR_ACTUAL_LIVE_KEY  
CLERK_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_LIVE_WEBHOOK
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

### Supabase (Keep same)
NEXT_PUBLIC_SUPABASE_URL=https://tnlftxudmiryrgkajfun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTQxODEsImV4cCI6MjA3MDU3MDE4MX0.VEiU7iBh9LdjkT3fVvkfNJcT2haw4iQijj-rAxjqobc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk5NDE4MSwiZXhwIjoyMDcwNTcwMTgxfQ.80sKPr0NTPuGCwKhm3VZisadRdU1aQLkHFgfokyQcIk

### Razorpay Production (Replace with your actual live keys)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_YOUR_ACTUAL_LIVE_KEY
RAZORPAY_KEY_SECRET=YOUR_ACTUAL_LIVE_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_ACTUAL_LIVE_WEBHOOK_SECRET

### RunPod (Keep same)
RUNPOD_API_KEY=YOUR_RUNPOD_API_KEY

## Important Notes:
1. Set all variables for "Production" environment in Vercel
2. Make sure to update webhook URLs to point to your live domain
3. Test with small amounts first for Razorpay live mode
4. Keep your test environment variables for local development
