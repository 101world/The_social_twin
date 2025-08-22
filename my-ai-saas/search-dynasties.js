const { createSupabaseAdminClient } = require('./lib/supabase');

async function findUserGeneration() {
  const supabase = createSupabaseAdminClient();
  const userId = 'user_31bGWlhyPTrdmtIkEwkGlhoxtU9';
  
  console.log('🔍 Searching for user:', userId);
  console.log('Looking for dynasties prompt...\n');
  
  // Search for the specific dynasties prompt
  const { data, error } = await supabase
    .from('media_generations')
    .select('*')
    .eq('user_id', userId)
    .ilike('prompt', '%dynasties%')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Found dynasties generation:');
    data.forEach((gen, i) => {
      console.log(`${i+1}. ID: ${gen.id}`);
      console.log(`   Prompt: ${gen.prompt}`);
      console.log(`   Status: ${gen.status}`);
      console.log(`   Created: ${gen.created_at}`);
      console.log(`   Result URL: ${gen.result_url || 'NONE'}`);
      console.log(`   Generation Params:`, JSON.stringify(gen.generation_params, null, 2));
      console.log('');
    });
  } else {
    console.log('❌ No dynasties generation found');
    
    // Search for ANY generation from this user
    const { data: allGens, error: allError } = await supabase
      .from('media_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (allGens && allGens.length > 0) {
      console.log('\nBut found these other generations from this user:');
      allGens.forEach((gen, i) => {
        console.log(`${i+1}. "${gen.prompt?.substring(0, 50)}..." (${gen.status}) - ${gen.created_at}`);
      });
    } else {
      console.log('No generations found for this user at all');
    }
  }
}

findUserGeneration().catch(console.error);
