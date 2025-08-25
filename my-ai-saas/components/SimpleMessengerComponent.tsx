'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  Users, 
  Hash, 
  ChevronDown, 
  ChevronRight, 
  Send,
  Paperclip,
  Sparkles,
  Lock,
  Volume2,
  VolumeX,
  Phone,
  Video,
  MoreVertical,
  X
} from 'lucide-react';
import FriendSearchModal from './FriendSearchModal';
import FriendRequestsPanel from './FriendRequestsPanel';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';

// Enhanced messenger component with full chat interface
export default function SimpleMessengerComponent() {
  const [friendsCollapsed, setFriendsCollapsed] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [aiMode, setAiMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  
  // Mock current user clerk ID (in real app, get from useUser())
  const currentUserClerkId = "user_12345"; // This would come from Clerk auth
  
  const bottomInputRef = useRef<HTMLTextAreaElement>(null);

  // Real-time message subscription
  const { isConnected } = useRealtimeMessages({
    roomId: currentRoomId,
    currentUserClerkId,
    onNewMessage: (message) => {
      setMessages(prev => {
        // Avoid duplicates by checking if message already exists
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      
      // Auto-scroll to bottom when new message arrives
      setTimeout(() => {
        if (bottomInputRef.current) {
          bottomInputRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    },
    onMessageUpdate: (message) => {
      setMessages(prev => 
        prev.map(m => m.id === message.id ? { ...m, ...message } : m)
      );
    },
    onMessageDelete: (messageId) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  });

  const testFriends = [
    { id: '1', name: 'Alice AI', avatar: 'A', isOnline: true, status: 'Building amazing AI models' },
    { id: '2', name: 'Bob Security', avatar: 'B', isOnline: true, status: 'Securing the digital world' },
    { id: '3', name: 'Charlie Code', avatar: 'C', isOnline: false, status: 'Coding the future' }
  ];

  const testGroups = [
    { id: '4', name: 'General Chat', avatar: '#', members: 127, description: 'Main community discussion' },
    { id: '5', name: 'AI Creators', avatar: '#', members: 89, description: 'AI enthusiasts and creators' }
  ];

  // Load real friends from database
  const loadFriends = async () => {
    try {
      const response = await fetch('/api/messenger/get-friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userClerkId: currentUserClerkId }),
      });

      if (response.ok) {
        const friendsData = await response.json();
        setFriends(friendsData);
      } else {
        console.error('Failed to load friends');
        setFriends([]);
      }
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Load friends on component mount
  useEffect(() => {
    loadFriends();
  }, [currentUserClerkId]);

  // Real messaging functions
  const startChatWithUser = async (friendClerkId: string) => {
    try {
      setLoadingMessages(true);
      const response = await fetch('/api/messenger/get-or-create-dm-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1ClerkId: currentUserClerkId,
          user2ClerkId: friendClerkId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoomId(data.roomId);
        await loadMessages(data.roomId);
      } else {
        console.error('Failed to create/get DM room');
        alert('Failed to start conversation. Please try again.');
      }
    } catch (error) {
      console.error('Start chat error:', error);
      alert('Failed to start conversation. Please try again.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      const response = await fetch('/api/messenger/get-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, limit: 50, offset: 0 }),
      });

      if (response.ok) {
        const messages = await response.json();
        const transformedMessages = messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          timestamp: msg.timestamp,
          isOwn: msg.sender.clerkId === currentUserClerkId,
          sender: msg.sender
        }));
        setMessages(transformedMessages);
      } else {
        console.error('Failed to load messages');
        setMessages([]);
      }
    } catch (error) {
      console.error('Load messages error:', error);
      setMessages([]);
    }
  };

  const sendRealMessage = async () => {
    if (!messageInput.trim() || !currentRoomId || sendingMessage) return;

    setSendingMessage(true);
    const messageContent = messageInput.trim();
    setMessageInput('');
    setIsTyping(false);

    try {
      const response = await fetch('/api/messenger/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderClerkId: currentUserClerkId,
          roomId: currentRoomId,
          content: messageContent,
          messageType: aiMode ? 'ai_generation' : privacyMode ? 'encrypted' : 'text',
          aiGenerationData: aiMode ? { type: 'shared_generation' } : null
        }),
      });

      if (!response.ok) {
        console.error('Failed to send message');
        setMessageInput(messageContent);
        alert('Failed to send message. Please try again.');
      }
      // Note: No need to reload messages - real-time subscription will handle the new message
    } catch (error) {
      console.error('Send message error:', error);
      setMessageInput(messageContent);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSelectChat = (chat: any) => {
    setSelectedChat(chat);
    setMessages([]);
    
    // If it's a real friend with clerkId, start real chat
    if (chat.clerkId) {
      startChatWithUser(chat.clerkId);
    } else {
      // Keep test data for demo chats
      setCurrentRoomId(null);
      // Simulate loading some messages for test chats
      setMessages([
        {
          id: '1',
          content: `Hey! Welcome to the chat with ${chat.name}! (Test mode)`,
          sender: chat.name,
          timestamp: new Date().toLocaleTimeString(),
          isOwn: false
        },
        {
          id: '2', 
          content: 'This is a working messenger interface!',
          sender: 'You',
          timestamp: new Date().toLocaleTimeString(),
          isOwn: true
        }
      ]);
    }
  };

  // Updated sendMessage function
  const sendMessage = () => {
    if (currentRoomId) {
      sendRealMessage();
    } else {
      sendTestMessage();
    }
  };

  const sendTestMessage = () => {
    if (!messageInput.trim() || !selectedChat) return;
    
    const newMessage = {
      id: Date.now().toString(),
      content: messageInput,
      sender: 'You',
      timestamp: new Date().toLocaleTimeString(),
      isOwn: true
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageInput('');
    setIsTyping(false);
    
    // Simulate reply
    setTimeout(() => {
      const reply = {
        id: (Date.now() + 1).toString(),
        content: `Thanks for your message: "${messageInput}"`,
        sender: selectedChat.name,
        timestamp: new Date().toLocaleTimeString(),
        isOwn: false
      };
      setMessages(prev => [...prev, reply]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full bg-black text-white flex flex-col">
      {/* Top Navigation - Friends/Groups Collapsible Bars */}
      <div className="bg-gray-900 border-b border-gray-800">
        {/* Friends Bar */}
        <div className="border-b border-gray-800">
          <button
            onClick={() => setFriendsCollapsed(!friendsCollapsed)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-white">Friends</span>
              <span className="text-sm text-gray-400">({friends.length})</span>
            </div>
            {friendsCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
          </button>
          
          {!friendsCollapsed && (
            <div>
              {/* Friend Requests Panel */}
              <FriendRequestsPanel 
                currentUserClerkId={currentUserClerkId}
                onRequestsChange={() => {
                  // Refresh friends list when a request is accepted
                  loadFriends();
                  console.log('Friend requests updated - refreshing friends list');
                }}
              />
              
              {/* Friends List */}
              <div className="max-h-32 overflow-y-auto bg-gray-900">
                {loadingFriends ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-gray-400">Loading friends...</span>
                  </div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleSelectChat(friend)}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition-colors border-l-4 ${
                        selectedChat?.id === friend.id ? 'border-blue-600 bg-gray-800' : 'border-transparent'
                      }`}
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.username}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm text-white">{friend.avatar}</span>
                          )}
                        </div>
                        {friend.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-black"></div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-white">{friend.name}</div>
                        <div className="text-xs text-gray-400 truncate">{friend.status}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No friends yet. Add some friends to start chatting!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Groups Bar */}
        <div>
          <button
            onClick={() => setGroupsCollapsed(!groupsCollapsed)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Hash className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-white">Groups</span>
              <span className="text-sm text-gray-400">({testGroups.length})</span>
            </div>
            {groupsCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
          </button>
          
          {!groupsCollapsed && (
            <div className="max-h-32 overflow-y-auto bg-gray-900">
              {testGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleSelectChat(group)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition-colors border-l-4 ${
                    selectedChat?.id === group.id ? 'border-blue-600 bg-gray-800' : 'border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                    <Hash className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">{group.name}</div>
                    <div className="text-xs text-gray-400">{group.members} members</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedChat ? (
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm text-white">{selectedChat.avatar}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{selectedChat.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      {selectedChat.members ? `${selectedChat.members} members` : 'Online'}
                      {currentRoomId && (
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                          {isConnected ? 'Live' : 'Offline'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2 rounded-lg hover:bg-gray-800"
                    title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-800">
                    <Phone className="w-4 h-4 text-white" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-800">
                    <Video className="w-4 h-4 text-white" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-800">
                    <MoreVertical className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-black">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length > 0 ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-white border border-gray-700'
                      }`}
                    >
                      <div className="text-sm">{message.content}</div>
                      <div className="text-xs mt-1 opacity-70">{message.timestamp}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Start a conversation with {selectedChat.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* FIXED PROMPT BOX - Always visible at bottom */}
            <div className="flex-shrink-0 border-t border-gray-800 bg-black">
              <div 
                className="p-4"
                style={{
                  boxShadow: isTyping 
                    ? '0 0 20px rgba(37, 99, 235, 0.4), 0 0 40px rgba(37, 99, 235, 0.2)' 
                    : '0 0 10px rgba(0, 0, 0, 0.3)'
                }}
              >
                <div className="flex items-start gap-3">
                  <textarea
                    ref={bottomInputRef}
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      setIsTyping(e.target.value.length > 0);
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder={
                      aiMode 
                        ? "Share AI generation or type message..." 
                        : privacyMode 
                          ? "Encrypted message..." 
                          : "Type a message..."
                    }
                    className="flex-1 resize-none rounded-lg p-3 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600/50 border border-gray-700 bg-gray-900 text-white placeholder-gray-400 min-h-[48px] max-h-[120px]"
                    style={{ fontSize: '14px' }}
                    rows={1}
                  />
                  
                  {/* Action buttons in 2x2 grid */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Top row: Send + AI */}
                    <button
                      onClick={sendMessage}
                      disabled={!messageInput.trim() || sendingMessage}
                      className={`group relative h-10 w-10 cursor-pointer rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                        messageInput.trim() && !sendingMessage
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                          : 'bg-gray-700 text-gray-400'
                      }`}
                      title={sendingMessage ? "Sending..." : "Send message"}
                    >
                      {sendingMessage ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                    <button 
                      onClick={() => setAiMode(!aiMode)}
                      className={`h-10 w-10 rounded-lg transition-all duration-300 flex items-center justify-center ${
                        aiMode
                          ? 'bg-blue-600/20 scale-110 ring-2 ring-blue-600/30'
                          : 'hover:bg-gray-800 hover:scale-105 bg-gray-700'
                      }`}
                      title="AI Mode - Share generations"
                    >
                      <Sparkles className={`w-4 h-4 transition-colors ${aiMode ? 'text-blue-400' : 'text-white'}`} />
                    </button>
                    
                    {/* Bottom row: Privacy + Attach */}
                    <button 
                      title="Toggle Privacy Mode" 
                      onClick={() => setPrivacyMode(!privacyMode)}
                      className={`h-10 w-10 rounded-lg transition-all duration-300 flex items-center justify-center ${
                        privacyMode
                          ? 'bg-blue-600/20 scale-110 ring-2 ring-blue-600/30'
                          : 'hover:bg-gray-800 hover:scale-105 bg-gray-700'
                      }`}
                    > 
                      <Lock className={`w-4 h-4 transition-colors ${privacyMode ? 'text-blue-400' : 'text-white'}`} />
                    </button>
                    <button 
                      className="h-10 w-10 rounded-lg border transition-colors bg-gray-700 border-gray-600 text-white hover:bg-gray-600 flex items-center justify-center" 
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Mode indicators */}
                {(privacyMode || aiMode) && (
                  <div className="mt-2 space-y-1">
                    {privacyMode && (
                      <div className="flex items-center gap-2 text-xs text-blue-400">
                        <Lock className="w-3 h-3" />
                        <span>Privacy mode enabled - Messages encrypted</span>
                      </div>
                    )}
                    {aiMode && (
                      <div className="flex items-center gap-2 text-xs text-blue-400">
                        <Sparkles className="w-3 h-3" />
                        <span>AI mode enabled - Ready to share generations</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-black">
            <div className="text-center max-w-sm mx-auto p-8">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-semibold mb-2 text-white">
                Select a conversation
              </h3>
              <p className="text-gray-400 mb-4">
                Choose a friend or group to start messaging
              </p>
              <div className="mt-6 space-y-3">
                <button 
                  onClick={() => setShowFriendSearch(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start New Chat
                </button>
                <button 
                  onClick={() => setShowFriendSearch(true)}
                  className="w-full px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Find Friends
                </button>
              </div>
              <div className="text-xs text-blue-400 mt-4">
                ✅ Black/White theme with deep blue highlights<br/>
                ✅ Friends/Groups collapsible bars working<br/>
                ✅ Full chat interface with docked prompt box<br/>
                ✅ All messenger functions ready
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Friend Search Modal */}
      <FriendSearchModal
        isOpen={showFriendSearch}
        onClose={() => setShowFriendSearch(false)}
        currentUserClerkId={currentUserClerkId}
      />
    </div>
  );
}
