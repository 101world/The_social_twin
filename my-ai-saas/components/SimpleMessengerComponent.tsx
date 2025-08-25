'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  MessageCircle,
  Users,
  ChevronDown,
  ChevronRight,
  Send,
} from 'lucide-react';
import FriendSearchModal from './FriendSearchModal';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';

// Enhanced messenger component with full chat interface
export default function SimpleMessengerComponent() {
  const { user } = useUser();
  const [friendsCollapsed, setFriendsCollapsed] = useState(true); // top slim bar collapsed by default
  const [friendsOpen, setFriendsOpen] = useState(false); // dropdown panel toggle
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  // Minimal mode: remove AI/privacy/sound toggles
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [isSimpleMode, setIsSimpleMode] = useState(true); // Force simple mode layout (no left split)
  
  // Use real Clerk ID when available; fallback for local testing
  const currentUserClerkId = user?.id ?? 'test_user_1';
  
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

  // No fake friends

  // Load real friends from database
  const loadFriends = async () => {
    try {
      const response = await fetch('/api/messenger/get-friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userClerkId: currentUserClerkId }),
      });

      if (response.ok) {
        const friendsData = await response.json(); // array
        const realFriends = (friendsData || []).map((f: any) => ({
          id: f.id,
          name: f.displayName || f.username || f.display_name || f.username,
          avatar: f.avatarUrl ? undefined : (f.displayName || f.username || 'U')[0].toUpperCase(),
          avatarUrl: f.avatarUrl || f.avatar_url,
          isOnline: !!f.isOnline || !!f.is_online,
          status: f.customStatus || f.custom_status || (f.isOnline || f.is_online ? 'Online' : 'Offline'),
          clerkId: f.clerkId || f.clerk_id,
        }));
        setFriends(realFriends);
      } else {
        console.error('Failed to load friends');
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Load friends on component mount
  useEffect(() => {
    loadFriends();
  }, []);

  // Monitor simpleMode from parent page (but keep messenger in simple mode UI)
  useEffect(() => {
    const checkSimpleMode = () => {
      if (typeof window !== 'undefined' && (window as any).__getSimpleMode) {
        const currentSimpleMode = (window as any).__getSimpleMode();
        setIsSimpleMode(true); // do not split layout; keep single column
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
      const response = await fetch('/api/messenger/get-or-create-dm-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1ClerkId: currentUserClerkId,
          user2ClerkId: userClerkId,
        }),
      });

      if (response.ok) {
        const chatData = await response.json(); // { roomId }
        const roomId = chatData.roomId;
        setCurrentRoomId(roomId);
        setMessages([]); // Clear messages, real-time will populate
        setLoadingMessages(true);
        
        // Load existing messages
        const messagesResponse = await fetch('/api/messenger/get-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, limit: 50, offset: 0 }),
        });
        
        if (messagesResponse.ok) {
          const data = await messagesResponse.json(); // array
          const formatted = (data || []).map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            timestamp: new Date(msg.createdAt || msg.created_at).toLocaleTimeString(),
            createdAt: msg.createdAt || msg.created_at,
            isOwn: (msg.sender?.clerkId || msg.sender?.clerk_id) === currentUserClerkId,
          }));
          setMessages(formatted);
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
      }
      // Note: No need to reload messages - real-time subscription will handle the new message
    } catch (error) {
      console.error('Send message error:', error);
      setMessageInput(messageContent);
  // keep minimal UI; no alert
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
      // No test fallback
      setCurrentRoomId(null);
    }
    setFriendsOpen(false);
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
      {/* Main Chat Area - full width, no left split */}
      <div className={`flex-1 flex flex-col min-h-0 relative ${isSimpleMode ? 'w-full' : ''}`}>
        {/* Slim Friends top bar */}
        <div className="flex items-center justify-between h-9 px-3 border-b border-gray-800 bg-black">
          <button
            onClick={() => { setFriendsOpen(!friendsOpen); setFriendsCollapsed(!friendsCollapsed); }}
            className="inline-flex items-center gap-2 text-xs text-white hover:opacity-90"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends</span>
            {friendsCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="text-[10px] text-gray-500">{friends.length}</span>
          </button>

          <button
            onClick={() => setShowFriendSearch(true)}
            className="text-[11px] text-black bg-white/90 hover:bg-white px-2 py-1 rounded"
            title="Add Friend"
          >
            Add
          </button>
        </div>

        {/* Friends dropdown panel (vertical list) */}
        {friendsOpen && (
          <div className="border-b border-gray-800 bg-black max-h-56 overflow-y-auto">
            {loadingFriends ? (
              <div className="flex items-center justify-center py-3 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Loading friends…
              </div>
            ) : friends.length > 0 ? (
              friends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleSelectChat(friend)}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-900 transition-colors ${selectedChat?.id === friend.id ? 'bg-gray-900' : ''}`}
                >
                  <div className="relative">
                    <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center">
                      {friend.avatarUrl ? (
                        <img src={friend.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <span className="text-[11px] text-white">{friend.avatar}</span>
                      )}
                    </div>
                    {friend.isOnline && <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full border border-black" />}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white leading-tight">{friend.name}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">{friend.status}</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-500">No friends yet.</div>
            )}
          </div>
        )}
        {selectedChat ? (
          <div className="flex flex-col h-full">
            {/* Chat Header (minimal) */}
            <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-black">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  {selectedChat?.avatarUrl ? (
                    <img src={selectedChat.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-sm text-white">{selectedChat?.avatar}</span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm text-white">{selectedChat?.name}</div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-white' : 'bg-gray-600'}`} />
                      {isConnected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Container - Uses same structure as chat tab */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-black text-[14px]" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}>
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
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                        message.isOwn
                          ? 'bg-white text-black'
                          : 'bg-gray-800 text-white border border-gray-700'
                      }`}
                    >
                      <div className="text-sm">{message.content}</div>
                      <div className="text-[11px] mt-1 opacity-70">{message.timestamp}</div>
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

            {/* FIXED PROMPT BOX (identical sizing to chat tab style) */}
            <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800" style={{ zIndex: 20 }}>
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
                    placeholder="Type a message..."
                    className="flex-1 resize-none rounded-lg p-2 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 border border-gray-700 bg-black text-white placeholder-gray-400 min-h-[44px] max-h-[120px] text-[13px]"
                    rows={1}
                  />
                  
                  {/* Send button only (minimal) */}
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sendingMessage}
                    className={`h-10 px-3 rounded-lg transition-all text-sm ${
                      messageInput.trim() && !sendingMessage
                        ? 'bg-white text-black' : 'bg-gray-800 text-gray-400'
                    }`}
                    title={sendingMessage ? 'Sending...' : 'Send message'}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-black">
            {/* Empty messages area */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm mx-auto p-6">
                <MessageCircle className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-40" />
                <h3 className="text-lg font-medium mb-1 text-white">Select a conversation</h3>
                <p className="text-sm text-gray-400">Choose a friend to start messaging</p>
              </div>
            </div>
            {/* Fixed prompt visible but disabled until chat selected */}
            <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800" style={{ zIndex: 20 }}>
              <div className="max-w-4xl mx-auto p-4">
                <div className="flex items-start gap-3">
                  <textarea
                    ref={bottomInputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Select a conversation to type"
                    disabled
                    className="flex-1 resize-none rounded-lg p-2 border border-gray-800 bg-black text-gray-500 placeholder-gray-600 min-h-[44px] max-h-[120px] text-[13px]"
                    rows={1}
                  />
                  <button disabled className="h-10 px-3 rounded-lg bg-gray-800 text-gray-500 text-sm">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
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
    </>
  );
}
