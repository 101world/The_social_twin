// Quick test to verify Supabase messenger connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tnlftxudmiryrgkajfun.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubGZ0eHVkbWlyeXJna2FqZnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTQxODEsImV4cCI6MjA3MDU3MDE4MX0.VEiU7iBh9LdjkT3fVvkfNJcT2haw4iQijj-rAxjqobc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMessengerTables() {
  console.log('🔍 Testing Supabase messenger connection...');
  
  try {
    // Test 1: Check if messenger_users table exists
    console.log('\n📋 Test 1: Checking messenger_users table...');
    const { data: users, error: usersError } = await supabase
      .from('messenger_users')
      .select('*')
      .limit(5);
    
    if (usersError) {
      console.error('❌ messenger_users table error:', usersError.message);
    } else {
      console.log('✅ messenger_users table found!');
      console.log('Users count:', users?.length || 0);
      if (users?.length > 0) {
        console.log('Sample user:', users[0]);
      }
    }

    // Test 2: Check if functions exist
    console.log('\n🔧 Test 2: Checking messenger_get_friends function...');
    const { data: friendsTest, error: friendsError } = await supabase
      .rpc('messenger_get_friends', { user_clerk_id: 'test_user_1' });
    
    if (friendsError) {
      console.error('❌ messenger_get_friends function error:', friendsError.message);
    } else {
      console.log('✅ messenger_get_friends function works!');
      console.log('Friends returned:', friendsTest?.length || 0);
    }

    // Test 3: Check messenger_chat_rooms
    console.log('\n🏠 Test 3: Checking messenger_chat_rooms table...');
    const { data: rooms, error: roomsError } = await supabase
      .from('messenger_chat_rooms')
      .select('*')
      .limit(5);
    
    if (roomsError) {
      console.error('❌ messenger_chat_rooms table error:', roomsError.message);
    } else {
      console.log('✅ messenger_chat_rooms table found!');
      console.log('Rooms count:', rooms?.length || 0);
    }

    console.log('\n🎉 Test completed! Check results above.');
    
  } catch (error) {
    console.error('💥 Connection test failed:', error);
  }
}

testMessengerTables();
