import { createClient } from "@supabase/supabase-js";

// Create a Supabase client. If a Clerk JWT is provided, attach it for RLS.
export function createSupabaseClient(jwt?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      },
    }
  );
}

// Server-side admin client using service role key (bypasses RLS). Do NOT expose to client.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}
