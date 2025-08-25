const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCriticalFunctions() {
  console.log('🔍 Testing critical messenger functions that were missing...\n');

  try {
    // Test 1: messenger_upsert_user (THE CRITICAL ONE causing the hang)
    console.log('📋 Test 1: Testing messenger_upsert_user function...');
    const { data: userId, error: upsertError } = await supabase.rpc('messenger_upsert_user', {
      p_clerk_id: 'test_user_critical',
      p_username: 'testuser',
      p_display_name: 'Test User',
      p_email: 'test@example.com'
    });

    if (upsertError) {
      console.error('❌ messenger_upsert_user failed:', upsertError);
    } else {
      console.log('✅ messenger_upsert_user works! User ID:', userId);
    }

    // Test 2: messenger_search_users
    console.log('\n📋 Test 2: Testing messenger_search_users function...');
    const { data: searchResults, error: searchError } = await supabase.rpc('messenger_search_users', {
      search_term: 'alice',
      current_user_clerk_id: 'test_user_critical',
      limit_count: 5
    });

    if (searchError) {
      console.error('❌ messenger_search_users failed:', searchError);
    } else {
      console.log('✅ messenger_search_users works!');
      console.log('Found users:', searchResults?.length || 0);
      if (searchResults && searchResults.length > 0) {
        console.log('Sample result:', searchResults[0]);
      }
    }

    // Test 3: messenger_send_friend_request
    console.log('\n📋 Test 3: Testing messenger_send_friend_request function...');
    const { data: friendRequestId, error: requestError } = await supabase.rpc('messenger_send_friend_request', {
      requester_clerk_id: 'test_user_critical',
      addressee_clerk_id: 'test_user_1', // Alice
      request_message: 'Hey, let\'s be friends!'
    });

    if (requestError) {
      console.error('❌ messenger_send_friend_request failed:', requestError);
    } else {
      console.log('✅ messenger_send_friend_request works! Request ID:', friendRequestId);
    }

    // Test 4: messenger_get_pending_requests
    console.log('\n📋 Test 4: Testing messenger_get_pending_requests function...');
    const { data: pendingRequests, error: pendingError } = await supabase.rpc('messenger_get_pending_requests', {
      user_clerk_id: 'test_user_1' // Check Alice's pending requests
    });

    if (pendingError) {
      console.error('❌ messenger_get_pending_requests failed:', pendingError);
    } else {
      console.log('✅ messenger_get_pending_requests works!');
      console.log('Pending requests:', pendingRequests?.length || 0);
      if (pendingRequests && pendingRequests.length > 0) {
        console.log('Sample request:', pendingRequests[0]);
      }
    }

    // Test 5: messenger_get_or_create_dm_room
    console.log('\n📋 Test 5: Testing messenger_get_or_create_dm_room function...');
    const { data: roomId, error: roomError } = await supabase.rpc('messenger_get_or_create_dm_room', {
      user1_clerk_id: 'test_user_critical',
      user2_clerk_id: 'test_user_1'
    });

    if (roomError) {
      console.error('❌ messenger_get_or_create_dm_room failed:', roomError);
    } else {
      console.log('✅ messenger_get_or_create_dm_room works! Room ID:', roomId);
    }

    console.log('\n🎉 All critical functions test completed!');
    console.log('🚀 The messenger should now work without "securing connection" hang!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testCriticalFunctions();
