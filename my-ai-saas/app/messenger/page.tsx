'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import Link from 'next/link';
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
  BellOff
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'voice';
  reactions?: { emoji: string; userId: string }[];
  encrypted?: boolean;
}

interface Conversation {
  id: string;
  type: 'friend' | 'community';
  name: string;
  avatar?: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isPrivate: boolean;
  isPinned: boolean;
}

interface Community {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  memberCount: number;
  isPrivate: boolean;
  role: 'owner' | 'admin' | 'member';
}

export default function MessengerPage() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  
  // Main state
  const [activeSection, setActiveSection] = useState<'friends' | 'community'>('friends');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Friends & Conversations
  const [friends, setFriends] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friendRequests, setFriendRequests] = useState<User[]>([]);
  
  // Communities
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI state
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock data for development
  useEffect(() => {
    // Mock friends data
    setFriends([
      { id: '1', username: 'alice_crypto', avatar: '/api/placeholder/32/32', isOnline: true },
      { id: '2', username: 'bob_dev', avatar: '/api/placeholder/32/32', isOnline: false, lastSeen: '2 hours ago' },
      { id: '3', username: 'charlie_design', avatar: '/api/placeholder/32/32', isOnline: true },
    ]);
    
    // Mock conversations
    setConversations([
      {
        id: '1',
        type: 'friend',
        name: 'Alice Crypto',
        avatar: '/api/placeholder/40/40',
        participants: [{ id: '1', username: 'alice_crypto', isOnline: true }],
        lastMessage: { id: '1', senderId: '1', content: 'Hey! How\'s the new project going?', timestamp: '2 min ago', type: 'text' },
        unreadCount: 2,
        isPrivate: true,
        isPinned: true
      },
      {
        id: '2',
        type: 'community',
        name: 'AI Developers',
        avatar: '/api/placeholder/40/40',
        participants: [],
        lastMessage: { id: '2', senderId: '2', content: 'New update is live!', timestamp: '1 hour ago', type: 'text' },
        unreadCount: 0,
        isPrivate: false,
        isPinned: false
      }
    ]);
    
    // Mock communities
    setCommunities([
      { id: '1', name: 'AI Developers', description: 'Discuss AI and ML projects', memberCount: 1250, isPrivate: false, role: 'member' },
      { id: '2', name: 'Crypto Privacy', description: 'Privacy-focused cryptocurrency discussions', memberCount: 890, isPrivate: true, role: 'admin' },
      { id: '3', name: '101World Updates', description: 'Official announcements and updates', memberCount: 5600, isPrivate: false, role: 'member' }
    ]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: user?.id || 'current-user',
      content: messageInput,
      timestamp: new Date().toISOString(),
      type: 'text',
      encrypted: privacyMode
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageInput('');
    
    // Here you would send to Supabase/backend
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-gray-400 mb-6">Please sign in to access the messenger</p>
          <Link href="/sign-in" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} text-white flex`}>
      {/* Sidebar */}
      <div className={`w-80 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              101Messenger
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPrivacyMode(!privacyMode)}
                className={`p-2 rounded-lg transition-colors ${
                  privacyMode 
                    ? 'bg-green-600 text-white' 
                    : darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title="Privacy Mode"
              >
                <Shield className="w-4 h-4" />
              </button>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {/* Section Tabs */}
          <div className="flex bg-gray-700 rounded-lg p-1">
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
              onClick={() => setActiveSection('community')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeSection === 'community'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Community
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={activeSection === 'friends' ? 'Search friends...' : 'Search communities...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
              } border focus:outline-none focus:border-blue-500`}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeSection === 'friends' ? (
            <div>
              {/* Add Friend Button */}
              <div className="px-4 mb-4">
                <button
                  onClick={() => setShowFriendSearch(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </button>
              </div>

              {/* Friend Requests */}
              {friendRequests.length > 0 && (
                <div className="px-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Friend Requests</h3>
                  {friendRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <img src={request.avatar} alt="" className="w-8 h-8 rounded-full" />
                        <span className="text-sm">{request.username}</span>
                      </div>
                      <div className="flex gap-1">
                        <button className="px-2 py-1 bg-blue-600 text-xs rounded">Accept</button>
                        <button className="px-2 py-1 bg-gray-600 text-xs rounded">Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Conversations */}
              <div className="px-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Conversations</h3>
                {conversations.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors ${
                      selectedConversation?.id === conversation.id
                        ? 'bg-blue-600'
                        : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                    }`}
                  >
                    <div className="relative">
                      <img src={conversation.avatar} alt="" className="w-10 h-10 rounded-full" />
                      {conversation.isPinned && (
                        <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{conversation.name}</span>
                        <span className="text-xs text-gray-400">{conversation.lastMessage?.timestamp}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 truncate">
                          {conversation.lastMessage?.content}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Your Communities</h3>
              {communities.map(community => (
                <div key={community.id} className="p-3 rounded-lg bg-gray-700 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{community.name}</span>
                          {community.role === 'owner' && <Crown className="w-3 h-3 text-yellow-500" />}
                          {community.role === 'admin' && <Zap className="w-3 h-3 text-blue-500" />}
                          {community.isPrivate && <Lock className="w-3 h-3 text-green-500" />}
                        </div>
                        <p className="text-xs text-gray-400">{community.memberCount} members</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300">{community.description}</p>
                </div>
              ))}
              
              {/* Join Community Button */}
              <button className="w-full py-2 px-4 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-400 transition-colors">
                + Join a Community
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <button className="lg:hidden">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img src={selectedConversation.avatar} alt="" className="w-10 h-10 rounded-full" />
                <div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedConversation.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedConversation.type === 'friend' ? 'Online' : `${selectedConversation.participants.length} members`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                  <Phone className="w-5 h-5" />
                </button>
                <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                  <Video className="w-5 h-5" />
                </button>
                <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.senderId === user?.id
                      ? 'bg-blue-600 text-white'
                      : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs opacity-70">{message.timestamp}</span>
                      {message.encrypted && <Lock className="w-3 h-3 opacity-70" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className={`p-4 border-t ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2">
                <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={privacyMode ? "Encrypted message..." : "Type a message..."}
                    className={`w-full px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                    } border focus:outline-none focus:border-blue-500 pr-24`}
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                    {privacyMode && <Lock className="w-4 h-4 text-green-500" />}
                    <button className={`p-1 rounded transition-colors ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}
                  className={`p-2 rounded-lg transition-colors ${
                    messageInput.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Select a conversation
              </h3>
              <p className="text-gray-400">
                Choose a friend or community to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
