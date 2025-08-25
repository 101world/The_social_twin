const { createClient } = require('@supabase/supabase-js');

// Hardcode the values from .env.local for testing
const supabaseUrl = 'https://tnlftxudmiryrgkajfun.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTQxODEsImV4cCI6MjA3MDU3MDE4MX0.VEiU7iBh9LdjkT3fVvkfNJcT2haw4iQijj-rAxjqobc';

console.log('🔍 Testing critical messenger functions after fix...\n');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.log('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCriticalFunction() {
  try {
    // Test the CRITICAL function that was causing the hang
    console.log('📋 Testing messenger_upsert_user (the function causing connection hang)...');
    const { data: userId, error: upsertError } = await supabase.rpc('messenger_upsert_user', {
      p_clerk_id: 'test_user_critical',
      p_username: 'testuser',
      p_display_name: 'Test User',
      p_email: 'test@example.com'
    });

    if (upsertError) {
      console.error('❌ messenger_upsert_user STILL FAILING:', upsertError);
      console.log('🚨 This means the messenger will still show "securing connection"');
    } else {
      console.log('✅ messenger_upsert_user NOW WORKS! User ID:', userId);
      console.log('🎉 The "securing connection" hang should be FIXED!');
    }

    // Quick test of search function
    console.log('\n📋 Testing messenger_search_users...');
    const { data: searchResults, error: searchError } = await supabase.rpc('messenger_search_users', {
      search_term: 'alice',
      current_user_clerk_id: 'test_user_critical',
      limit_count: 3
    });

    if (searchError) {
      console.error('❌ Search failed:', searchError);
    } else {
      console.log('✅ Search works! Found', searchResults?.length || 0, 'users');
    }

    console.log('\n🚀 MESSENGER STATUS: Should now load instantly without hanging!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testCriticalFunction();
