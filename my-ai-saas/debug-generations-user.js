// Quick script to check generations for specific user
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserGenerations() {
  const userId = 'user_31bGWlhyPTrdmtIkEwkGlhoxtU9';
  
  console.log(`\n🔍 Checking generations for user: ${userId}\n`);
  
  // First, search for the specific dynasties prompt
  console.log('--- SEARCHING FOR DYNASTIES PROMPT ---');
  const { data: dynastiesGens, error: dynastiesError } = await supabase
    .from('media_generations')
    .select('*')
    .eq('user_id', userId)
    .ilike('prompt', '%dynasties%')
    .order('created_at', { ascending: false });

  if (dynastiesError) {
    console.error('Error searching for dynasties:', dynastiesError);
  } else {
    console.log(`Found ${dynastiesGens?.length || 0} dynasties generations:`);
    
    if (dynastiesGens && dynastiesGens.length > 0) {
      dynastiesGens.forEach((gen, index) => {
        console.log(`\n${index + 1}. ID: ${gen.id}`);
        console.log(`   Created: ${gen.created_at}`);
        console.log(`   Type: ${gen.type}`);
        console.log(`   Status: ${gen.status || 'N/A'}`);
        console.log(`   Prompt: ${gen.prompt}`);
        console.log(`   Result URL: ${gen.result_url || 'N/A'}`);
        console.log(`   Thumbnail: ${gen.thumbnail_url || 'N/A'}`);
        console.log(`   Generation Params:`, gen.generation_params ? 'YES' : 'NO');
        if (gen.generation_params) {
          console.log(`   Params Detail:`, JSON.stringify(gen.generation_params, null, 2));
        }
      });
    } else {
      console.log('   No dynasties generations found');
    }
  }

  // Check media_generations table (primary)
  console.log('\n--- ALL MEDIA_GENERATIONS FOR USER ---');
  const { data: mediaGens, error: mediaError } = await supabase
    .from('media_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (mediaError) {
    console.error('Error querying media_generations:', mediaError);
  } else {
    console.log(`Found ${mediaGens?.length || 0} records in media_generations:`);
    
    if (mediaGens && mediaGens.length > 0) {
      mediaGens.forEach((gen, index) => {
        console.log(`\n${index + 1}. ID: ${gen.id}`);
        console.log(`   Created: ${gen.created_at}`);
        console.log(`   Type: ${gen.type}`);
        console.log(`   Status: ${gen.status || 'N/A'}`);
        console.log(`   Prompt: ${gen.prompt?.substring(0, 100)}${gen.prompt?.length > 100 ? '...' : ''}`);
        console.log(`   Result URL: ${gen.result_url || 'N/A'}`);
        console.log(`   Thumbnail: ${gen.thumbnail_url || 'N/A'}`);
      });
    } else {
      console.log('   No records found in media_generations');
    }
  }

  // Check generations table (fallback)
  console.log('\n--- GENERATIONS TABLE (fallback) ---');
  const { data: legacyGens, error: legacyError } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (legacyError) {
    console.error('Error querying generations:', legacyError);
  } else {
    console.log(`Found ${legacyGens?.length || 0} records in generations table:`);
    
    if (legacyGens && legacyGens.length > 0) {
      legacyGens.forEach((gen, index) => {
        console.log(`\n${index + 1}. ID: ${gen.id}`);
        console.log(`   Created: ${gen.created_at}`);
        console.log(`   Prompt: ${gen.prompt?.substring(0, 100)}${gen.prompt?.length > 100 ? '...' : ''}`);
        console.log(`   Image URL: ${gen.image_url || 'N/A'}`);
      });
    } else {
      console.log('   No records found in generations table');
    }
  }

  // Look for recent generations with "car" or "parallax" keywords
  console.log('\n--- SEARCHING FOR RECENT CAR/PARALLAX GENERATIONS ---');
  const { data: recentCar, error: carError } = await supabase
    .from('media_generations')
    .select('*')
    .ilike('prompt', '%car%')
    .or('prompt.ilike.%parallax%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (carError) {
    console.error('Error searching for car/parallax:', carError);
  } else {
    console.log(`Found ${recentCar?.length || 0} recent car/parallax generations:`);
    
    if (recentCar && recentCar.length > 0) {
      recentCar.forEach((gen, index) => {
        console.log(`\n${index + 1}. User: ${gen.user_id}`);
        console.log(`   Created: ${gen.created_at}`);
        console.log(`   Status: ${gen.status || 'N/A'}`);
        console.log(`   Prompt: ${gen.prompt}`);
        console.log(`   Result: ${gen.result_url || 'N/A'}`);
      });
    }
  }
}

checkUserGenerations().catch(console.error);
