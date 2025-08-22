const { createClient } = require('@supabase/supabase-js');

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
  }
  return createClient(url, key);
}

async function fixPendingGenerations() {
  const supabase = createSupabaseAdminClient();
  
  console.log('Fetching pending generations...');
  
  // Get all pending generations
  const { data: pending, error: fetchError } = await supabase
    .from('media_generations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
    
  if (fetchError) {
    console.error('Error fetching pending generations:', fetchError);
    return;
  }
  
  console.log(`Found ${pending.length} pending generations`);
  
  if (pending.length === 0) {
    console.log('No pending generations to fix');
    return;
  }
  
  // Show first few for verification
  console.log('\nFirst few pending generations:');
  pending.slice(0, 5).forEach((gen, i) => {
    console.log(`${i + 1}. ID: ${gen.id}`);
    console.log(`   User: ${gen.user_id}`);
    console.log(`   Prompt: ${gen.prompt}`);
    console.log(`   Created: ${gen.created_at}`);
    console.log(`   Status: ${gen.status}`);
    console.log(`   Has generation_params: ${!!gen.generation_params}`);
    if (gen.generation_params && gen.generation_params.result_urls) {
      console.log(`   Result URLs available: ${gen.generation_params.result_urls.length}`);
    }
    console.log('');
  });
  
  // For generations that have result_urls in generation_params but no result_url,
  // we can mark them as completed
  let updated = 0;
  
  for (const gen of pending) {
    try {
      const params = gen.generation_params || {};
      const resultUrls = params.result_urls || [];
      
      if (resultUrls.length > 0) {
        // Use the first result URL as the main result_url
        const firstUrl = resultUrls[0];
        
        const { error: updateError } = await supabase
          .from('media_generations')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_url: firstUrl,
            thumbnail_url: firstUrl, // Use same URL for thumbnail
            generation_params: {
              ...params,
              saved_to_library: false // Mark as not saved since these are RunPod URLs
            }
          })
          .eq('id', gen.id);
          
        if (updateError) {
          console.error(`Error updating generation ${gen.id}:`, updateError);
        } else {
          console.log(`✓ Updated generation ${gen.id} (${gen.prompt.substring(0, 30)}...)`);
          updated++;
        }
      } else {
        console.log(`- Skipping generation ${gen.id} - no result URLs available`);
      }
    } catch (e) {
      console.error(`Error processing generation ${gen.id}:`, e);
    }
  }
  
  console.log(`\nCompleted! Updated ${updated} generations from pending to completed.`);
  console.log('These should now appear in the Generated tab.');
}

// Run the fix
fixPendingGenerations().catch(console.error);
