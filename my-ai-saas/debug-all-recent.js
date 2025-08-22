// Check for ANY recent generations to see if the car generation exists
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentGenerations() {
  console.log('\n🔍 Checking ALL recent generations (last 20 records)\n');
  
  // Check for any recent generations
  const { data: recentGens, error } = await supabase
    .from('media_generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error querying recent generations:', error);
    return;
  }

  console.log(`Found ${recentGens?.length || 0} total recent generations:`);
  
  if (recentGens && recentGens.length > 0) {
    recentGens.forEach((gen, index) => {
      const isCarRelated = gen.prompt?.toLowerCase().includes('car') || 
                          gen.prompt?.toLowerCase().includes('parallax');
      
      console.log(`\n${index + 1}. ${isCarRelated ? '🚗 [POSSIBLE MATCH]' : ''}`);
      console.log(`   ID: ${gen.id}`);
      console.log(`   User: ${gen.user_id}`);
      console.log(`   Created: ${gen.created_at}`);
      console.log(`   Type: ${gen.type}`);
      console.log(`   Status: ${gen.status || 'N/A'}`);
      console.log(`   Prompt: "${gen.prompt}"`);
      console.log(`   Result URL: ${gen.result_url || 'N/A'}`);
      console.log(`   Error: ${gen.error_message || 'N/A'}`);
    });
  } else {
    console.log('   No records found in media_generations table at all!');
  }

  // Also check pending status specifically
  console.log('\n--- CHECKING PENDING GENERATIONS ---');
  const { data: pending, error: pendingError } = await supabase
    .from('media_generations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (pendingError) {
    console.error('Error querying pending generations:', pendingError);
  } else {
    console.log(`Found ${pending?.length || 0} pending generations:`);
    if (pending && pending.length > 0) {
      pending.forEach((gen, index) => {
        console.log(`\n${index + 1}. PENDING:`);
        console.log(`   ID: ${gen.id}`);
        console.log(`   User: ${gen.user_id}`);
        console.log(`   Created: ${gen.created_at}`);
        console.log(`   Prompt: "${gen.prompt}"`);
      });
    }
  }
}

checkRecentGenerations().catch(console.error);
