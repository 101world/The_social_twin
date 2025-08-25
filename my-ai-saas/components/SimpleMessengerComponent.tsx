'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  Users, 
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
import MessengerTestPanel from './MessengerTestPanel';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';

// Enhanced messenger component with full chat interface
export default function SimpleMessengerComponent() {
  const [friendsCollapsed, setFriendsCollapsed] = useState(false);
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
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [isSimpleMode, setIsSimpleMode] = useState(true); // Track docked layout mode
  
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
        console.log('📞 Real friends loaded:', friendsData);
        
        // Combine real friends with test friends for demo
        const allFriends = [
          ...friendsData.friends.map((f: any) => ({
            id: f.id,
            name: f.display_name || f.username,
            avatar: f.avatar_url ? undefined : (f.display_name || f.username)[0].toUpperCase(),
            avatarUrl: f.avatar_url,
            isOnline: true, // Could be dynamic based on last_seen
            status: f.bio || 'Online',
            clerkId: f.clerk_id // Add clerk_id for real messaging
          })),
          ...testFriends
        ];
        
        setFriends(allFriends);
      } else {
        console.error('Failed to load friends');
        // Fall back to test friends
        setFriends(testFriends);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      // Fall back to test friends
      setFriends(testFriends);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Load friends on component mount
  useEffect(() => {
    loadFriends();
  }, []);

  // Monitor simpleMode from parent page
  useEffect(() => {
    const checkSimpleMode = () => {
      if (typeof window !== 'undefined' && (window as any).__getSimpleMode) {
        const currentSimpleMode = (window as any).__getSimpleMode();
        setIsSimpleMode(currentSimpleMode);
      }
    };

    // Check initially
    checkSimpleMode();

    // Poll for changes every 100ms
    const interval = setInterval(checkSimpleMode, 100);

    return () => clearInterval(interval);
  }, []);

  // Start real chat with a user
  const startChatWithUser = async (userClerkId: string) => {
    try {
      const response = await fetch('/api/messenger/start-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1ClerkId: currentUserClerkId,
          user2ClerkId: userClerkId,
        }),
      });

      if (response.ok) {
        const chatData = await response.json();
        console.log('💬 Chat started:', chatData);
        setCurrentRoomId(chatData.roomId);
        setMessages([]); // Clear messages, real-time will populate
        setLoadingMessages(true);
        
        // Load existing messages
        const messagesResponse = await fetch('/api/messenger/get-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: chatData.roomId }),
        });
        
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          console.log('📩 Messages loaded:', messagesData);
          
          const formattedMessages = messagesData.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            messageType: msg.message_type,
            timestamp: new Date(msg.created_at).toLocaleTimeString(),
            createdAt: msg.created_at,
            isOwn: msg.sender?.clerk_id === currentUserClerkId,
            sender: {
              id: msg.sender?.id,
              clerkId: msg.sender?.clerk_id,
              username: msg.sender?.username,
              displayName: msg.sender?.display_name,
              avatarUrl: msg.sender?.avatar_url
            }
          }));
          
          setMessages(formattedMessages);
        }
      } else {
        console.error('Failed to start chat');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Send real message to database
  const sendRealMessage = async () => {
    if (!messageInput.trim() || !currentRoomId || sendingMessage) return;
    
    const messageContent = messageInput;
    setMessageInput('');
    setIsTyping(false);
    setSendingMessage(true);
    
    try {
      const response = await fetch('/api/messenger/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: currentRoomId,
          senderClerkId: currentUserClerkId,
          content: messageContent,
          messageType: 'text',
        }),
      });

      if (!response.ok) {
        // Restore message input on failure
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
    <>
      <div className="h-full bg-black text-white flex">
      {/* Desktop: Friends Sidebar on Left - Only in full width mode (not simpleMode) */}
      {!isSimpleMode && (
        <div className="hidden lg:flex w-80 bg-gray-900 border-r border-gray-800 flex-col">
          {/* Friends Section Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Friends</span>
              <span className="text-sm text-gray-400">({friends.length})</span>
            </div>
          </div>
          
          {/* Friend Requests Panel */}
          <FriendRequestsPanel 
            currentUserClerkId={currentUserClerkId}
            onRequestsChange={() => {
              loadFriends();
              console.log('Friend requests updated - refreshing friends list');
            }}
          />
          
          {/* Friends List */}
          <div className="flex-1 overflow-y-auto bg-gray-900">
            {loadingFriends ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-gray-400">Loading friends...</span>
              </div>
            ) : friends.length > 0 ? (
              friends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleSelectChat(friend)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition-colors border-l-4 ${
                    selectedChat?.id === friend.id ? 'border-white bg-gray-800' : 'border-transparent'
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
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-black"></div>
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
          
          {/* Add Friend Button at Bottom - Removed grey background */}
          <div className="p-4 bg-gray-900">
            <button
              onClick={() => setShowFriendSearch(true)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Add Friend
            </button>
          </div>
        </div>
      )}

      {/* Mobile/Docked Layout - Collapsible Friends Section */}
      {isSimpleMode && (
        <div className="bg-black border-b border-gray-800">
          <button
            onClick={() => setFriendsCollapsed(!friendsCollapsed)}
            className="w-full flex items-center justify-between p-4 text-white hover:bg-gray-900 transition-colors"
          >
            <span className="font-medium">Friends</span>
            {friendsCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
          </button>
          
          {!friendsCollapsed && (
            <div>
              {/* Friend Requests Panel */}
              <FriendRequestsPanel 
                currentUserClerkId={currentUserClerkId}
                onRequestsChange={() => {
                  loadFriends();
                  console.log('Friend requests updated - refreshing friends list');
                }}
              />
              
              {/* Friends List */}
              <div className="max-h-32 overflow-y-auto bg-gray-900">
                {loadingFriends ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-gray-400">Loading friends...</span>
                  </div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleSelectChat(friend)}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition-colors border-l-4 ${
                        selectedChat?.id === friend.id ? 'border-white bg-gray-800' : 'border-transparent'
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
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-black"></div>
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
      )}

      {/* Main Chat Area - Positioned to match chat tab structure */}
      <div className="flex-1 flex flex-col min-h-0 relative">
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

            {/* Messages Container - Uses same structure as chat tab */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-black" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
                          ? 'bg-white text-black'
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

            {/* FIXED PROMPT BOX - Positioned exactly like chat tab */}
            <div className="lg:fixed lg:bottom-0 lg:left-80 lg:right-0 absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800">
              <div className="max-w-4xl mx-auto p-4">
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
                    className="flex-1 resize-none rounded-lg p-3 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 border border-gray-700 bg-gray-900 text-white placeholder-gray-400 min-h-[48px] max-h-[120px]"
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
                          ? 'bg-white text-black shadow-lg' 
                          : 'bg-gray-700 text-gray-400'
                      }`}
                      title={sendingMessage ? "Sending..." : "Send message"}
                    >
                      {sendingMessage ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                    <button 
                      onClick={() => setAiMode(!aiMode)}
                      className={`h-10 w-10 rounded-lg transition-all duration-300 flex items-center justify-center ${
                        aiMode
                          ? 'bg-white/20 scale-110 ring-2 ring-white/30'
                          : 'hover:bg-gray-800 hover:scale-105 bg-gray-700'
                      }`}
                      title="AI Mode - Share generations"
                    >
                      <Sparkles className={`w-4 h-4 transition-colors ${aiMode ? 'text-white' : 'text-white'}`} />
                    </button>
                    
                    {/* Bottom row: Privacy + Attach */}
                    <button 
                      title="Toggle Privacy Mode" 
                      onClick={() => setPrivacyMode(!privacyMode)}
                      className={`h-10 w-10 rounded-lg transition-all duration-300 flex items-center justify-center ${
                        privacyMode
                          ? 'bg-white/20 scale-110 ring-2 ring-white/30'
                          : 'hover:bg-gray-800 hover:scale-105 bg-gray-700'
                      }`}
                    > 
                      <Lock className={`w-4 h-4 transition-colors ${privacyMode ? 'text-white' : 'text-white'}`} />
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
                      <div className="flex items-center gap-2 text-xs text-white">
                        <Lock className="w-3 h-3" />
                        <span>Privacy mode enabled - Messages encrypted</span>
                      </div>
                    )}
                    {aiMode && (
                      <div className="flex items-center gap-2 text-xs text-white">
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
                Choose a friend to start messaging
              </p>
              <div className="mt-6 space-y-3">
                <button 
                  onClick={() => setShowFriendSearch(true)}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Start New Chat
                </button>
                <button 
                  onClick={() => setShowFriendSearch(true)}
                  className="w-full px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Find Friends
                </button>
                <button 
                  onClick={() => setShowTestPanel(true)}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
                >
                  🧪 Test All Functions
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-4">
                ✅ Black/White theme - No blue colors<br/>
                ✅ Friends sidebar on desktop<br/>
                ✅ Centered prompt box with proper width<br/>
                ✅ Groups functionality removed
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <FriendSearchModal
        isOpen={showFriendSearch}
        onClose={() => setShowFriendSearch(false)}
        currentUserClerkId={currentUserClerkId}
      />

      {showTestPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Messenger System Test Panel</h2>
              <button
                onClick={() => setShowTestPanel(false)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <MessengerTestPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
