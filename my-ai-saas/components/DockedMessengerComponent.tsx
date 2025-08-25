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
  Plus,
  ChevronDown,
  ChevronRight,
  Star,
  Hash,
  X,
  Image,
  FileText,
  Sparkles,
  Upload,
  Camera,
  Volume2,
  VolumeX
} from 'lucide-react';

interface MessengerUser {
  id: string;
  clerk_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_online: boolean;
  last_seen: string;
  custom_status?: string;
  is_favorite?: boolean;
  custom_nickname?: string;
}

interface ChatRoom {
  id: string;
  room_type: 'direct' | 'group';
  name?: string;
  description?: string;
  avatar_url?: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  participants?: any[];
  last_message?: any;
  unread_count?: number;
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'ai_generation' | 'system';
  ai_generation_data?: any;
  media_urls?: string[];
  reply_to_id?: string;
  reactions?: any[];
  is_edited: boolean;
  created_at: string;
  sender?: MessengerUser;
}

interface AIGenerationShare {
  type: 'text' | 'image' | 'video';
  prompt: string;
  result_url?: string;
  metadata?: any;
}

export default function DockedMessengerComponent() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [supabase, setSupabase] = useState<any>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const [friendsCollapsed, setFriendsCollapsed] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  
  // Chat State
  const [friends, setFriends] = useState<MessengerUser[]>([]);
  const [groups, setGroups] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Discovery
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MessengerUser[]>([]);
  
  // AI Integration State
  const [aiMode, setAiMode] = useState(false);
  const [generationToShare, setGenerationToShare] = useState<AIGenerationShare | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Privacy & Settings
  const [privacyMode, setPrivacyMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bottomInputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Supabase client-side only
  useEffect(() => {
    console.log('🔍 Messenger Debug - Initializing Supabase...');
    console.log('- Window check:', typeof window !== 'undefined');
    console.log('- User check:', !!user);
    console.log('- Supabase check:', !!supabase);
    
    if (typeof window !== 'undefined' && user && !supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      console.log('- Env URL:', supabaseUrl ? 'Found' : 'Missing');
      console.log('- Env Key:', supabaseKey ? 'Found' : 'Missing');
      
      if (supabaseUrl && supabaseKey) {
        console.log('✅ Creating Supabase client...');
        const supabaseClient = createClient(supabaseUrl, supabaseKey);
        setSupabase(supabaseClient);
      } else {
        console.error('❌ Missing Supabase environment variables!');
      }
    }
  }, [user, supabase]);

  // Initialize user and load data
  useEffect(() => {
    console.log('🔍 Messenger Debug - User initialization...');
    console.log('- User exists:', !!user);
    console.log('- Supabase exists:', !!supabase);
    
    if (user && supabase) {
      console.log('✅ Starting user initialization...');
      initializeUser();
    }
  }, [user, supabase]);

  const initializeUser = async () => {
    console.log('🚀 initializeUser called');
    if (!user || !supabase) {
      console.log('❌ Missing user or supabase in initializeUser');
      return;
    }
    
    try {
      console.log('🔑 Getting Clerk token...');
      const token = await getToken({ template: 'supabase' });
      console.log('Token received:', !!token);
      
      if (token) {
        console.log('🔐 Setting Supabase session...');
        supabase.auth.setSession({
          access_token: token,
          refresh_token: '',
        });
      }

      console.log('👤 Calling messenger_upsert_user...');
      // Upsert user with enhanced profile
      const { error } = await supabase.rpc('messenger_upsert_user', {
        p_clerk_id: user.id,
        p_username: user.username || user.firstName || 'User',
        p_display_name: user.fullName,
        p_email: user.primaryEmailAddress?.emailAddress,
        p_avatar_url: user.imageUrl
      });

      if (error) {
        console.error('❌ Error initializing user:', error);
      } else {
        console.log('✅ User initialized successfully!');
        console.log('📋 Loading friends and groups...');
        loadFriends();
        loadGroups();
      }
    } catch (error) {
      console.error('❌ Error with authentication:', error);
    }
  };

  // Discovery: search users (including suggestions when query is empty)
  useEffect(() => {
    const run = async () => {
      if (!supabase || !user) return;
      setSearching(true);
      try {
        const { data, error } = await supabase.rpc('messenger_search_users', {
          search_term: searchQuery || '',
          current_user_clerk_id: user.id,
          limit_count: 10
        });
        if (error) {
          console.error('❌ Search error:', error);
          setSearchResults([]);
        } else {
          const mapped: MessengerUser[] = (data || []).map((u: any) => ({
            id: u.id,
            clerk_id: u.clerk_id,
            username: u.username || 'user',
            display_name: u.display_name || u.username,
            avatar_url: u.avatar_url || '',
            is_online: false,
            last_seen: new Date().toISOString(),
            custom_status: undefined,
            is_favorite: false,
            custom_nickname: undefined,
          }));
          setSearchResults(mapped);
        }
      } finally {
        setSearching(false);
      }
    };

    // Debounce 250ms
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [searchQuery, supabase, user]);

  const loadFriends = async () => {
    console.log('📋 loadFriends called');
    if (!supabase || !user) {
      console.log('❌ Missing supabase or user in loadFriends');
      return;
    }
    
    try {
      console.log('🔍 Calling messenger_get_friends...');
      const { data, error } = await supabase.rpc('messenger_get_friends', {
        user_clerk_id: user.id
      });

      if (error) {
        console.error('❌ Error loading friends:', error);
      } else {
        console.log('✅ Friends loaded:', data?.length || 0);
        setFriends(data || []);
      }
    } catch (error) {
      console.error('❌ Error loading friends:', error);
    }
  };

  const loadGroups = async () => {
    if (!supabase || !user) return;
    try {
      const { data, error } = await supabase
        .from('messenger_chat_rooms')
        .select(`
          *,
          participants:messenger_room_participants(
            user_id,
            role,
            is_active,
            user:messenger_users(*)
          )
        `)
        .eq('room_type', 'group')
        .in('id', [
          // Subquery to get room IDs where user is a participant
        ]);

      if (error) {
        console.error('Error loading groups:', error);
      } else {
        setGroups(data || []);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadMessages = async (roomId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('messenger_messages')
      .select(`
        *,
        sender:messenger_users(*)
      `)
      .eq('room_id', roomId)
      .eq('is_deleted', false)
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
      const { data, error } = await supabase.rpc('messenger_send_message', {
        sender_clerk_id: user.id,
        room_id: selectedRoom.id,
        content: messageInput.trim(),
        message_type: aiMode ? 'ai_generation' : 'text',
        ai_generation_data: generationToShare ? {
          type: generationToShare.type,
          prompt: generationToShare.prompt,
          result_url: generationToShare.result_url
        } : null
      });

      if (!error) {
        setMessageInput('');
        setIsTyping(false);
        setAiMode(false);
        setGenerationToShare(null);
        loadMessages(selectedRoom.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startDirectMessage = async (friend: MessengerUser) => {
    if (!user || !supabase) return;
    
    try {
      const { data: roomId, error } = await supabase.rpc('messenger_get_or_create_dm_room', {
        user1_clerk_id: user.id,
        user2_clerk_id: friend.clerk_id
      });

      if (!error && roomId) {
        const { data: roomData } = await supabase
          .from('messenger_chat_rooms')
          .select(`
            *,
            participants:messenger_room_participants(
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
          table: 'messenger_messages',
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

  // Share AI generation function (to be called from main chat)
  const shareAIGeneration = (generation: AIGenerationShare) => {
    setGenerationToShare(generation);
    setShowShareModal(true);
  };

  // Expose function globally for main chat to use
  useEffect(() => {
    (window as any).shareToMessenger = shareAIGeneration;
    return () => {
      delete (window as any).shareToMessenger;
    };
  }, []);

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
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Top Navigation - Friends/Groups Collapsible Bars */}
      <div className="bg-gray-800 border-b border-gray-700">
        {/* Friends Bar */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => {
              setActiveTab('friends');
              setFriendsCollapsed(!friendsCollapsed);
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Friends</span>
              <span className="text-sm text-gray-400">({friends.length})</span>
            </div>
            {friendsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {!friendsCollapsed && (
            <div className="max-h-64 overflow-y-auto bg-gray-750">
              {/* Discovery search */}
              <div className="px-3 pt-3 pb-2 sticky top-0 bg-gray-750 border-b border-gray-700">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search people..."
                    className="w-full pl-8 pr-2 py-1.5 text-sm rounded bg-gray-700 border border-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* When there are no accepted friends, show discovery results */}
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => startDirectMessage(friend)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 transition-colors border-l-4 border-transparent hover:border-blue-500"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <span className="text-sm">{friend.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {friend.is_online && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {friend.custom_nickname || friend.display_name || friend.username}
                        </span>
                        {friend.is_favorite && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                      </div>
                      {friend.custom_status && (
                        <p className="text-xs text-gray-400 truncate">{friend.custom_status}</p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-2">
                  <div className="text-xs text-gray-400 px-1 pb-2">People</div>
                  {searching && (
                    <div className="py-6 text-center text-gray-400">Searching…</div>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <div className="py-6 text-center text-gray-400">
                      <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No people found</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {searchResults.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <span className="text-sm">{p.username.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.display_name || p.username}</div>
                          <div className="text-xs text-gray-400 truncate">@{p.username}</div>
                        </div>
                        <button
                          onClick={() => startDirectMessage(p)}
                          className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500"
                        >Start DM</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Groups Bar */}
        <div>
          <button
            onClick={() => {
              setActiveTab('groups');
              setGroupsCollapsed(!groupsCollapsed);
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Hash className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Groups</span>
              <span className="text-sm text-gray-400">({groups.length})</span>
            </div>
            {groupsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {!groupsCollapsed && (
            <div className="max-h-32 overflow-y-auto bg-gray-750">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setSelectedRoom(group);
                      loadMessages(group.id);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 transition-colors border-l-4 border-transparent hover:border-green-500"
                  >
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{group.name}</span>
                        {group.is_private && <Lock className="w-3 h-3 text-gray-400" />}
                      </div>
                      {group.description && (
                        <p className="text-xs text-gray-400 truncate">{group.description}</p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-gray-400">
                  <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No groups yet</p>
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
                    {selectedRoom.room_type === 'group' ? (
                      <Hash className="w-4 h-4" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">
                      {selectedRoom.name || 
                        selectedRoom.participants?.find(p => p.user.clerk_id !== user?.id)?.user.display_name ||
                        'Chat'
                      }
                    </div>
                    <div className="text-xs text-gray-400">
                      {selectedRoom.room_type === 'group' 
                        ? `${selectedRoom.participants?.length || 0} members`
                        : 'Online'
                      }
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2 rounded-lg hover:bg-gray-700"
                    title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
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
                    {/* AI Generation Display */}
                    {message.message_type === 'ai_generation' && message.ai_generation_data && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-yellow-400" />
                          <span className="text-xs font-medium">AI Generation</span>
                        </div>
                        {message.ai_generation_data.result_url && (
                          <div className="mb-2">
                            {message.ai_generation_data.type === 'image' ? (
                              <img 
                                src={message.ai_generation_data.result_url} 
                                alt="AI Generated" 
                                className="max-w-full rounded border"
                              />
                            ) : message.ai_generation_data.type === 'video' ? (
                              <video 
                                src={message.ai_generation_data.result_url} 
                                controls 
                                className="max-w-full rounded border"
                              />
                            ) : null}
                          </div>
                        )}
                        <div className="text-xs opacity-75">
                          <strong>Prompt:</strong> {message.ai_generation_data.prompt}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-sm">{message.content}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Area - Exactly like docked chat */}
            <div 
              className="p-4 border-t border-gray-700 bg-gray-800"
              style={{
                boxShadow: isTyping 
                  ? '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)' 
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
                  className="flex-1 resize-none rounded-lg p-3 pr-10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-0 bg-gray-700 text-white placeholder-gray-400 min-h-[40px] max-h-[120px]"
                  style={{ fontSize: '14px' }}
                />
                
                {/* Action buttons in 2x2 grid exactly like docked chat */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Top row: Send + AI */}
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() && !generationToShare}
                    className={`group relative h-8 w-8 cursor-pointer rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                      messageInput.trim() || generationToShare
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                        : 'bg-gray-600 text-gray-400'
                    }`}
                    title="Send message"
                  >
                    <Send className="w-4 h-4 text-white group-hover:text-gray-400" />
                  </button>
                  <button 
                    onClick={() => setAiMode(!aiMode)}
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      aiMode
                        ? 'bg-purple-500/20 scale-110 ring-2 ring-purple-500/30'
                        : 'hover:bg-gray-700 hover:scale-105'
                    }`}
                    title="AI Mode - Share generations"
                  >
                    <Sparkles className={`w-3 h-3 transition-colors ${aiMode ? 'text-purple-400' : 'text-current'}`} />
                  </button>
                  
                  {/* Bottom row: Privacy + Attach */}
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
                  <button className="p-2 rounded border transition-colors bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600" title="Attach file">
                    <Paperclip className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              {/* Generation preview */}
              {generationToShare && (
                <div className="mt-3 p-3 bg-gray-700 rounded-lg border border-purple-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium">Ready to share: {generationToShare.type}</span>
                    </div>
                    <button 
                      onClick={() => setGenerationToShare(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-300">{generationToShare.prompt}</div>
                </div>
              )}
              
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
                Choose a friend or group to start messaging
              </p>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setFriendsCollapsed(false)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2 mx-auto"
                >
                  <Users className="w-4 h-4" />
                  Browse friends
                </button>
                <button
                  onClick={() => setGroupsCollapsed(false)}
                  className="text-green-400 hover:text-green-300 text-sm flex items-center gap-2 mx-auto"
                >
                  <Hash className="w-4 h-4" />
                  Join groups
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal for AI Generations */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share to Messenger</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {generationToShare && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">{generationToShare.type} generation</span>
                </div>
                <div className="text-sm text-gray-300 mb-3">{generationToShare.prompt}</div>
                
                {generationToShare.result_url && (
                  <div className="mb-3">
                    {generationToShare.type === 'image' ? (
                      <img 
                        src={generationToShare.result_url} 
                        alt="Preview" 
                        className="max-w-full h-32 object-cover rounded border"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-gray-300">Choose destination:</h4>
              {friends.slice(0, 3).map(friend => (
                <button
                  key={friend.id}
                  onClick={() => {
                    startDirectMessage(friend);
                    setShowShareModal(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-700"
                >
                  <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-xs">{friend.username.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm">{friend.display_name || friend.username}</span>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
