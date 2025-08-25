// Browser-side test for messenger connection
// This simulates exactly what the messenger component does

const testMessengerConnection = async () => {
  console.log('🔍 Testing messenger connection from browser perspective...');
  
  try {
    // Get the same environment variables the component uses
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('Environment check:');
    console.log('- Supabase URL:', supabaseUrl ? 'Found' : 'MISSING');
    console.log('- Supabase Key:', supabaseKey ? 'Found' : 'MISSING');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Environment variables missing!');
      return;
    }
    
    // Create Supabase client exactly like the component
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test the exact function call that's failing
    console.log('🧪 Testing messenger_upsert_user call...');
    
    const testUserId = 'test_browser_' + Date.now();
    const { data: userId, error: upsertError } = await supabase.rpc('messenger_upsert_user', {
      p_clerk_id: testUserId,
      p_username: 'testuser',
      p_display_name: 'Test User',
      p_email: 'test@example.com'
    });
    
    if (upsertError) {
      console.error('❌ messenger_upsert_user FAILED:', upsertError);
      console.error('This is why the messenger shows "securing connection"');
    } else {
      console.log('✅ messenger_upsert_user SUCCESS:', userId);
      console.log('The function works - issue might be elsewhere');
    }
    
    // Test basic table access
    console.log('🧪 Testing basic table access...');
    const { data: users, error: tableError } = await supabase
      .from('messenger_users')
      .select('*')
      .limit(3);
      
    if (tableError) {
      console.error('❌ Table access FAILED:', tableError);
    } else {
      console.log('✅ Table access SUCCESS:', users?.length || 0, 'users found');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
};

testMessengerConnection();
