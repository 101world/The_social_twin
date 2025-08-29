const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentGenerations() {
  try {
    console.log('🔍 Checking recent generations...');

    const { data: generations, error } = await supabase
      .from('media_generations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!generations || generations.length === 0) {
      console.log('📭 No generations found in database');
      return;
    }

    console.log('📋 Recent generations:');
    generations.forEach((gen, i) => {
      console.log(`${i + 1}. ${gen.type} - ${gen.status} - ${gen.created_at}`);
      console.log(`   Result URL: ${gen.result_url || 'None'}`);
      console.log(`   Media URL: ${gen.media_url || 'None'}`);

      if (gen.generation_params) {
        const params = gen.generation_params;
        console.log(`   Saved to R2: ${params.saved_to_r2 ? '✅' : '❌'}`);
        if (params.r2_url) {
          console.log(`   R2 URL: ${params.r2_url}`);
        }
        if (params.original_runpod_url) {
          console.log(`   Original URL: ${params.original_runpod_url}`);
        }
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRecentGenerations();
