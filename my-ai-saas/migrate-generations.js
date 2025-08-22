const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateGenerationsToMediaGenerations() {
  console.log('🔄 Migrating generations from old table to new media_generations table...\n');
  
  // Get a default topic ID to use for all migrated items
  const { data: topicData } = await supabase
    .from('chat_topics')
    .select('id')
    .limit(1)
    .single();
  
  const defaultTopicId = topicData?.id || 'ec0dcd44-182a-4ea6-ba1c-fcb45d24157c'; // Fallback to known ID
  console.log(`Using topic ID: ${defaultTopicId} for migrated generations\n`);
  
  // Get all generations from old table
  const { data: oldGenerations, error: fetchError } = await supabase
    .from('generations')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (fetchError) {
    console.error('❌ Error fetching old generations:', fetchError);
    return;
  }
  
  if (!oldGenerations || oldGenerations.length === 0) {
    console.log('✅ No old generations to migrate');
    return;
  }
  
  console.log(`Found ${oldGenerations.length} generations to migrate:`);
  
  const migratedGenerations = [];
  
  for (const gen of oldGenerations) {
    const migratedGen = {
      id: gen.id, // Keep the same ID
      user_id: gen.user_id,
      topic_id: defaultTopicId, // Use existing topic ID
      type: gen.type,
      prompt: gen.prompt,
      result_url: gen.result_url || gen.image_url, // Handle both field names
      thumbnail_url: gen.image_url, // Use image_url as thumbnail
      status: gen.result_url || gen.image_url ? 'completed' : 'pending',
      created_at: gen.created_at,
      completed_at: gen.result_url || gen.image_url ? gen.created_at : null,
      generation_params: {
        ...gen.metadata,
        duration_seconds: gen.duration_seconds,
        legacy_migration: true,
        original_table: 'generations'
      }
    };
    
    migratedGenerations.push(migratedGen);
    
    console.log(`- ${gen.prompt?.substring(0, 50)}... (${gen.type}) - ${gen.created_at}`);
  }
  
  console.log(`\n📤 Inserting ${migratedGenerations.length} generations into media_generations table...`);
  
  // Insert into new table with upsert to avoid duplicates
  const { data: insertedData, error: insertError } = await supabase
    .from('media_generations')
    .upsert(migratedGenerations, { onConflict: 'id' })
    .select('id, prompt');
    
  if (insertError) {
    console.error('❌ Error inserting into media_generations:', insertError);
    return;
  }
  
  console.log(`✅ Successfully migrated ${insertedData?.length || 0} generations to media_generations table`);
  
  if (insertedData && insertedData.length > 0) {
    console.log('\nMigrated generations:');
    insertedData.forEach((gen, i) => {
      console.log(`${i+1}. ${gen.prompt?.substring(0, 60)}... (ID: ${gen.id.slice(0, 8)}...)`);
    });
  }
  
  console.log('\n🎉 Migration completed! The Generated tab should now show all historical generations.');
}

migrateGenerationsToMediaGenerations().catch(console.error);
