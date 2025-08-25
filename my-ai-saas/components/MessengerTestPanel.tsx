'use client';

import React, { useState } from 'react';
import { Users, Send, Check, Search, MessageCircle } from 'lucide-react';

export default function MessengerTestPanel() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runComprehensiveTest = async () => {
    setIsRunning(true);
    clearResults();
    addResult('🚀 Starting comprehensive messenger test...');

    try {
      // Test 1: Register test users
      addResult('📝 Testing user registration...');
      const testUsers = [
        { clerkId: 'test_user_1', username: 'alice_test', displayName: 'Alice Test', email: 'alice@test.com' },
        { clerkId: 'test_user_2', username: 'bob_test', displayName: 'Bob Test', email: 'bob@test.com' }
      ];

      for (const user of testUsers) {
        try {
          const response = await fetch('/api/messenger/register-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
          });
          
          if (response.ok) {
            addResult(`✅ Registered user: ${user.username}`);
          } else {
            addResult(`❌ Failed to register user: ${user.username}`);
          }
        } catch (error) {
          addResult(`❌ Error registering user ${user.username}: ${error}`);
        }
      }

      // Test 2: Search users
      addResult('🔍 Testing user search...');
      try {
        const searchResponse = await fetch('/api/messenger/search-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchTerm: 'test',
            currentUserClerkId: 'test_user_1',
            limitCount: 10
          }),
        });
        
        if (searchResponse.ok) {
          const users = await searchResponse.json();
          addResult(`✅ Found ${users.length} users in search`);
        } else {
          addResult('❌ User search failed');
        }
      } catch (error) {
        addResult(`❌ Search error: ${error}`);
      }

      // Test 3: Send friend request
      addResult('👥 Testing friend request...');
      try {
        const friendRequestResponse = await fetch('/api/messenger/send-friend-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterClerkId: 'test_user_1',
            addresseeClerkId: 'test_user_2',
            requestMessage: 'Test friend request!'
          }),
        });
        
        if (friendRequestResponse.ok) {
          addResult('✅ Friend request sent successfully');
        } else {
          const error = await friendRequestResponse.text();
          addResult(`❌ Friend request failed: ${error}`);
        }
      } catch (error) {
        addResult(`❌ Friend request error: ${error}`);
      }

      // Test 4: Get pending requests
      addResult('📬 Testing pending requests...');
      try {
        const pendingResponse = await fetch('/api/messenger/get-pending-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userClerkId: 'test_user_2' }),
        });
        
        if (pendingResponse.ok) {
          const requests = await pendingResponse.json();
          addResult(`✅ Found ${requests.length} pending requests`);
          
          // Test 5: Accept friend request (if any)
          if (requests.length > 0) {
            addResult('🤝 Testing friend request acceptance...');
            const acceptResponse = await fetch('/api/messenger/accept-friend-request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                friendshipId: requests[0].id,
                userClerkId: 'test_user_2'
              }),
            });
            
            if (acceptResponse.ok) {
              addResult('✅ Friend request accepted successfully');
            } else {
              addResult('❌ Failed to accept friend request');
            }
          }
        } else {
          addResult('❌ Failed to get pending requests');
        }
      } catch (error) {
        addResult(`❌ Pending requests error: ${error}`);
      }

      // Test 6: Get friends list
      addResult('👫 Testing friends list...');
      try {
        const friendsResponse = await fetch('/api/messenger/get-friends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userClerkId: 'test_user_1' }),
        });
        
        if (friendsResponse.ok) {
          const friends = await friendsResponse.json();
          addResult(`✅ Found ${friends.length} friends`);
        } else {
          addResult('❌ Failed to get friends list');
        }
      } catch (error) {
        addResult(`❌ Friends list error: ${error}`);
      }

      // Test 7: Create DM room
      addResult('💬 Testing DM room creation...');
      try {
        const dmResponse = await fetch('/api/messenger/get-or-create-dm-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user1ClerkId: 'test_user_1',
            user2ClerkId: 'test_user_2'
          }),
        });
        
        if (dmResponse.ok) {
          const dmData = await dmResponse.json();
          addResult(`✅ DM room created: ${dmData.roomId}`);
          
          // Test 8: Send message
          addResult('📨 Testing message sending...');
          const messageResponse = await fetch('/api/messenger/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderClerkId: 'test_user_1',
              roomId: dmData.roomId,
              content: 'Hello! This is a test message.',
              messageType: 'text'
            }),
          });
          
          if (messageResponse.ok) {
            addResult('✅ Message sent successfully');
            
            // Test 9: Get messages
            addResult('📖 Testing message retrieval...');
            const getMessagesResponse = await fetch('/api/messenger/get-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: dmData.roomId,
                limit: 50,
                offset: 0
              }),
            });
            
            if (getMessagesResponse.ok) {
              const messages = await getMessagesResponse.json();
              addResult(`✅ Retrieved ${messages.length} messages`);
            } else {
              addResult('❌ Failed to retrieve messages');
            }
          } else {
            let sendErr = '';
            try { sendErr = await messageResponse.text(); } catch {}
            addResult(`❌ Failed to send message${sendErr ? `: ${sendErr}` : ''}`);
          }
        } else {
          let errText = '';
          try { errText = await dmResponse.text(); } catch {}
          addResult(`❌ Failed to create DM room${errText ? `: ${errText}` : ''}`);
        }
      } catch (error) {
        addResult(`❌ DM room error: ${error}`);
      }

      addResult('🎉 Comprehensive test completed!');
    } catch (error) {
      addResult(`💥 Test suite error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Messenger System Test Panel</h2>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            onClick={runComprehensiveTest}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isRunning 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRunning ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{isRunning ? 'Running Tests...' : 'Run All Tests'}</span>
          </button>

          <button
            onClick={clearResults}
            className="flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-gray-300 transition-colors"
          >
            <span>Clear Results</span>
          </button>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
          <div className="text-sm text-gray-300 space-y-1">
            {testResults.length > 0 ? (
              testResults.map((result, index) => (
                <div key={index} className="font-mono text-xs">
                  {result}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                Click "Run All Tests" to test the complete messenger system
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <strong>What this tests:</strong> User registration, search, friend requests, acceptance, 
          friends list, DM room creation, message sending/receiving. Perfect for live testing!
        </div>
      </div>
    </div>
  );
}
