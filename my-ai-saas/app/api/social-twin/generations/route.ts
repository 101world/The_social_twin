import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const userId = request.headers.get('X-User-Id');
    
    console.log('🔍 Library API: Received request for user:', userId);
    
    if (!userId) {
      console.log('❌ Library API: No user ID provided');
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Fetch ALL user generations - show everything regardless of saveToLibrary flag
    const { data, error } = await supabase
      .from('media_generations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed') // Only show completed generations
      .or('result_url.not.is.null,media_url.not.is.null') // Must have either result_url OR media_url
      .order('created_at', { ascending: false }); // No limit - show ALL generations

    if (error) {
      console.error('💥 Supabase error in library API:', error);
      return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
    }

    console.log(`📊 Found ${data?.length || 0} completed generations with result_url for user ${userId}`);
    console.log('📋 Sample data (first item):', data?.[0] ? {
      id: data[0].id,
      type: data[0].type,
      status: data[0].status,
      result_url: data[0].result_url?.substring(0, 50) + '...',
      created_at: data[0].created_at
    } : 'No data');
    
    // Process data to convert storage URLs to signed URLs
    const processedData = await Promise.all((data || []).map(async (item) => {
      let displayUrl = item.media_url || item.result_url;
      
      // Convert storage URLs to signed URLs
      if (displayUrl && displayUrl.startsWith('storage:')) {
        try {
          const storagePath = displayUrl.replace(/^storage:/, '');
          const [bucket, ...pathParts] = storagePath.split('/');
          const path = pathParts.join('/');
          
          const { data: signedUrlData, error: signedError } = await getSupabaseClient().storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
          
          if (!signedError && signedUrlData?.signedUrl) {
            displayUrl = signedUrlData.signedUrl;
            console.log('✅ Converted storage URL to signed URL for item:', item.id);
          } else {
            console.error('❌ Failed to create signed URL:', signedError);
          }
        } catch (storageError) {
          console.error('💥 Storage URL conversion error:', storageError);
        }
      }
      
      return {
        ...item,
        // Use display_url for frontend, keep original URLs for reference
        display_url: displayUrl,
        media_url: displayUrl, // Update media_url for backward compatibility
        is_permanent: displayUrl?.startsWith('storage:') || displayUrl?.includes('supabase')
      };
    }));
    
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('💥 API error in library endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
