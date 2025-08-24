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

// Fetch RunPod config from DB (admin client required to bypass RLS reliably)
export async function getRunpodConfig() {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('runpod_config').select('*').eq('scope', 'global').maybeSingle();
    if (error) throw error;
    return data || null;
  } catch {
    return null;
  }
}

export function pickRunpodUrlFromConfig(opts: {
  provided?: string | null;
  mode?: 'text' | 'image' | 'image-modify' | 'video';
  config?: any | null;
}): string | undefined {
  const { provided, mode = 'image', config } = opts || {};
  
  // First priority: user-provided URL (e.g., from localStorage)
  if (provided && typeof provided === 'string' && provided.trim()) return provided;
  
  // Second priority: admin config from database
  if (config) {
    const cfgByMode = {
      text: config.text_url,
      image: config.image_url,
      'image-modify': config.image_modify_url || config.image_url,
      video: config.video_url,
    };
    
    const adminUrl = cfgByMode[mode];
    if (adminUrl && typeof adminUrl === 'string' && adminUrl.trim()) {
      return adminUrl;
    }
  }
  
  // Third priority: environment variables (fallback)
  const envByMode = {
    text: process.env.NEXT_PUBLIC_RUNPOD_TEXT_URL,
    image: process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL,
    'image-modify': process.env.NEXT_PUBLIC_RUNPOD_IMAGE_MODIFY_URL || process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL,
    video: process.env.NEXT_PUBLIC_RUNPOD_VIDEO_URL,
  } as Record<string, string | undefined>;
  
  return envByMode[mode];
}
