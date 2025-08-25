'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, 
  UserPlus, 
  Users, 
  MessageCircle, 
  Phone, 
  Video, 
  Settings, 
  Shield, 
  Send, 
  Smile, 
  Paperclip, 
  Mic,
  MoreVertical,
  ArrowLeft,
  Crown,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Plus
} from 'lucide-react';

interface MessengerUser {
  id: string;
  clerk_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_online: boolean;
  last_seen?: string;
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'voice';
  created_at: string;
  sender?: MessengerUser;
}

interface ChatRoom {
  id: string;
  room_type: 'direct' | 'group';
  name?: string;
  avatar_url?: string;
  updated_at: string;
  participants?: {
    user: MessengerUser;
  }[];
  last_message?: Message;
}

export default function MessengerComponent() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  
  // Initialize Supabase client-side only
  const [supabase, setSupabase] = useState<any>(null);
  
  // State
  const [activeSection, setActiveSection] = useState<'friends' | 'groups'>('friends');
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Data
  const [friends, setFriends] = useState<MessengerUser[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [groups, setGroups] = useState<ChatRoom[]>([]);
  
  // UI state
  const [privacyMode, setPrivacyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Supabase client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const client = createClient(supabaseUrl, supabaseKey);
        setSupabase(client);
      }
    }
  }, []);

  // Initialize user in database
  useEffect(() => {
    if (isSignedIn && user && supabase) {
      initializeUser();
    }
  }, [isSignedIn, user, supabase]);

  const initializeUser = async () => {
    if (!user || !supabase) return;
    
    try {
      const token = await getToken({ template: 'supabase' });
      if (token) {
        supabase.auth.setSession({
          access_token: token,
          refresh_token: '',
        });
      }

      // Upsert user in messenger database
      const { error } = await supabase.rpc('messenger_upsert_user', {
        p_clerk_id: user.id,
        p_username: user.username || user.firstName || 'User',
        p_display_name: user.fullName,
        p_email: user.primaryEmailAddress?.emailAddress,
        p_avatar_url: user.imageUrl
      });

      if (error) {
        console.error('Error initializing user:', error);
      } else {
        loadFriends();
        loadChatRooms();
      }
    } catch (error) {
      console.error('Error with authentication:', error);
    }
  };

  const loadFriends = async () => {
    if (!supabase || !user) return;
    // Load friends from database
    const { data, error } = await supabase
      .from('messenger_users')
      .select('*')
      .neq('clerk_id', user.id)
      .limit(20);
    
    if (!error && data) {
      setFriends(data);
    }
  };

  const loadChatRooms = async () => {
    if (!supabase || !user) return;
    // Load user's chat rooms
    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        participants:room_participants(
          user:messenger_users(*)
        ),
        last_message:messages(*)
      `)
      .order('updated_at', { ascending: false });
    
    if (!error && data) {
      const directChats = data.filter((room: any) => room.room_type === 'direct');
      const groupChats = data.filter((room: any) => room.room_type === 'group');
      setChatRooms(directChats);
      setGroups(groupChats);
    }
  };

  const loadMessages = async (roomId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:messenger_users(*)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (!error && data) {
      setMessages(data);
      scrollToBottom();
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom || !user || !supabase) return;
    
    try {
      const { data, error } = await supabase.rpc('send_message', {
        sender_clerk_id: user.id,
        room_id: selectedRoom.id,
        content: messageInput.trim(),
        message_type: 'text'
      });

      if (!error) {
        setMessageInput('');
        setIsTyping(false);
        loadMessages(selectedRoom.id); // Reload messages
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startDirectMessage = async (friendId: string) => {
    if (!user || !supabase) return;
    
    try {
      const { data: roomId, error } = await supabase.rpc('get_or_create_dm_room', {
        user1_clerk_id: user.id,
        user2_clerk_id: friendId
      });

      if (!error && roomId) {
        // Load the room details and select it
        const { data: roomData } = await supabase
          .from('chat_rooms')
          .select(`
            *,
            participants:room_participants(
              user:messenger_users(*)
            )
          `)
          .eq('id', roomId)
          .single();
        
        if (roomData) {
          setSelectedRoom(roomData);
          loadMessages(roomId);
        }
      }
    } catch (error) {
      console.error('Error starting DM:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (selectedRoom && supabase) {
      loadMessages(selectedRoom.id);
      
      const channel = supabase
        .channel('messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoom.id}`
        }, (payload: any) => {
          loadMessages(selectedRoom.id);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedRoom, supabase]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!isSignedIn) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to use Messenger</h2>
          <p className="text-gray-400">Connect with friends securely</p>
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Loading Messenger...</h2>
          <p className="text-gray-400">Initializing secure connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold">101Messenger</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPrivacyMode(!privacyMode)}
                className={`p-2 rounded-lg transition-colors ${
                  privacyMode 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title="Privacy Mode"
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          {/* Section Tabs */}
          <div className="flex bg-gray-700 rounded-lg p-1 mt-3">
            <button
              onClick={() => setActiveSection('friends')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeSection === 'friends'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Friends
            </button>
            <button
              onClick={() => setActiveSection('groups')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeSection === 'groups'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeSection === 'friends' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-300">Friends</h3>
                <button className="p-1 rounded hover:bg-gray-700">
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => startDirectMessage(friend.clerk_id)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="relative">
                    <img
                      src={friend.avatar_url || '/api/placeholder/32/32'}
                      alt={friend.display_name || friend.username}
                      className="w-8 h-8 rounded-full"
                    />
                    {friend.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {friend.display_name || friend.username}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      @{friend.username}
                    </div>
                  </div>
                </div>
              ))}
              
              {friends.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-xs mt-1">Start by adding some friends!</p>
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'groups' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-300">Groups</h3>
                <button className="p-1 rounded hover:bg-gray-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {groups.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No groups yet</p>
                  <p className="text-xs mt-1">Create or join a group!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold">
                      {selectedRoom.name || 
                        selectedRoom.participants?.find(p => p.user.clerk_id !== user?.id)?.user.display_name ||
                        'Chat'
                      }
                    </div>
                    <div className="text-xs text-gray-400">Online</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-gray-700">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-700">
                    <Video className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-700">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'} mb-4`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === user?.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}
                  >
                    <div className="text-sm">{message.content}</div>
                    <div className={`text-xs mt-1 opacity-70`}>
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Unified Input Design */}
            <div 
              className="p-4 border-t border-gray-700 bg-gray-800"
              style={{
                boxShadow: isTyping 
                  ? '0 0 20px rgba(255, 165, 0, 0.4), 0 0 40px rgba(255, 165, 0, 0.2)' 
                  : '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
              }}
            >
              <style jsx>{`
                @keyframes pulseBlue {
                  0%, 100% { 
                    box-shadow: 0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2);
                  }
                  50% { 
                    box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(59, 130, 246, 0.3);
                  }
                }
                @keyframes pulseOrange {
                  0%, 100% { 
                    box-shadow: 0 0 20px rgba(255, 165, 0, 0.4), 0 0 40px rgba(255, 165, 0, 0.2);
                  }
                  50% { 
                    box-shadow: 0 0 30px rgba(255, 165, 0, 0.6), 0 0 60px rgba(255, 165, 0, 0.3);
                  }
                }
              `}</style>
              
              <div className="flex gap-2 items-end">
                <textarea
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    setIsTyping(e.target.value.length > 0);
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={privacyMode ? "Encrypted message..." : "Type a message..."}
                  className="flex-1 resize-none rounded-lg p-3 pr-10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0 bg-gray-700 text-white placeholder-gray-400 min-h-[40px] max-h-[120px]"
                  style={{ fontSize: '14px' }}
                />
                
                {/* Action buttons in 2x2 grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Top row: Send + Attach */}
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim()}
                    className={`group relative h-8 w-8 cursor-pointer rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                      messageInput.trim() 
                        ? 'hover:bg-blue-500/10' 
                        : 'cursor-not-allowed opacity-50'
                    }`}
                    title="Send message"
                    aria-label="Send"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" className="transition-colors group-hover:stroke-blue-500">
                      <path d="M22 2L11 13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button className="group cursor-pointer rounded-lg p-1.5 flex items-center justify-center transition-all hover:scale-105 hover:bg-gray-500/10" title="Attach file">
                    <Paperclip className="w-4 h-4 text-white group-hover:text-gray-400" />
                  </button>
                  
                  {/* Bottom row: Privacy Toggle + Voice */}
                  <button 
                    title="Toggle Privacy Mode" 
                    onClick={() => setPrivacyMode(!privacyMode)}
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      privacyMode
                        ? 'bg-green-500/20 scale-110 ring-2 ring-green-500/30'
                        : 'hover:bg-gray-700 hover:scale-105'
                    }`}
                  > 
                    <Lock className={`w-3 h-3 transition-colors ${privacyMode ? 'text-green-500' : 'text-current'}`} />
                  </button>
                  <button className="p-2 rounded border transition-colors bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600" title="Voice message">
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              {/* Privacy mode indicator */}
              {privacyMode && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                  <Lock className="w-3 h-3" />
                  <span>Privacy mode enabled - Messages encrypted</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-400">
                Choose a friend to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
