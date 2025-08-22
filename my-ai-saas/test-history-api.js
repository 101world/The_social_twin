// Test the history API directly
const { createSupabaseAdminClient } = require('./lib/supabase');

async function testHistoryAPI() {
  console.log('🔍 Testing history API logic directly...\n');
  
  const userId = 'user_31bGWlhyPTrdmTlkEwkGlhoxtU9';
  const limit = 10;
  
  const supabase = createSupabaseAdminClient();
  
  // Same query as history API
  let query = supabase
    .from('media_generations')
    .select('id,type,prompt,result_url,thumbnail_url,generation_params,created_at,topic_id,status,error_message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  
  if (error) {
    console.error('❌ Database Error:', error);
    return;
  }
  
  console.log(`✅ Found ${data?.length || 0} total generations for user ${userId}\n`);
  
  if (data && data.length > 0) {
    data.forEach((item, index) => {
      console.log(`${index + 1}. ID: ${item.id.slice(0, 8)}...`);
      console.log(`   Type: ${item.type}`);
      console.log(`   Status: ${item.status || 'N/A'}`);
      console.log(`   Prompt: ${item.prompt?.substring(0, 60)}${item.prompt?.length > 60 ? '...' : ''}`);
      console.log(`   Result URL: ${item.result_url ? 'YES' : 'NO'}`);
      console.log(`   Thumbnail URL: ${item.thumbnail_url ? 'YES' : 'NO'}`);
      console.log(`   Created: ${item.created_at}`);
      console.log('');
    });
  }
  
  // Check status distribution
  const statusCounts = {};
  data?.forEach(item => {
    const status = item.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  console.log('📊 Status Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
}

testHistoryAPI().catch(console.error);
