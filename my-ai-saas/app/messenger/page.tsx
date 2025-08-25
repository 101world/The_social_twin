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
  
  // UI state - Force dark mode for clean look
  const [darkMode] = useState(true);
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
    <div className="h-screen bg-gray-900 text-white flex">
      {/* Clean Vertical Sidebar - Friends & Groups */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Minimalist Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white">
              Messenger
            </h1>
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
              <button
                onClick={() => setNotifications(!notifications)}
                className="p-2 rounded-lg transition-colors bg-gray-700 text-gray-400 hover:bg-gray-600"
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
              Groups
            </button>
          </div>
        </div>

        {/* Clean Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={activeSection === 'friends' ? 'Search friends...' : 'Search groups...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 border-gray-600 text-white border focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Vertical Content - Friends & Groups */}
        <div className="flex-1 overflow-y-auto">
          {activeSection === 'friends' ? (
            <div>
              {/* Add Friend Button */}
              <div className="px-4 mb-4">
                <button
                  onClick={() => {/* TODO: Add friend search functionality */}}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
                        : 'hover:bg-gray-700'
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
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Your Groups</h3>
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
              
              {/* Join Group Button */}
              <button className="w-full py-2 px-4 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-400 transition-colors">
                + Join a Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clean Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Clean Chat Header */}
            <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="lg:hidden">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img src={selectedConversation.avatar} alt="" className="w-10 h-10 rounded-full" />
                <div>
                  <h3 className="font-semibold text-white">
                    {selectedConversation.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedConversation.type === 'friend' ? 'Online' : `${selectedConversation.participants.length} members`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg transition-colors hover:bg-gray-700">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-lg transition-colors hover:bg-gray-700">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-lg transition-colors hover:bg-gray-700">
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
                      : 'bg-gray-700 text-white'
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

            {/* Unified Chat Input Design */}
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
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      sendMessage(); 
                    } 
                  }}
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" className="transition-colors group-hover:stroke-gray-400">
                      <path d="M21.44 11.05L12.25 20.24a7 7 0 11-9.9-9.9L11.54 1.15a5 5 0 017.07 7.07L9.42 17.41a3 3 0 01-4.24-4.24L13.4 4.95" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" className={`transition-colors ${privacyMode ? 'stroke-green-500' : 'stroke-current'}`}>
                      <path d="M12 1v2m0 18v2m10-11h-2M4 12H2m15.364-7.364l-1.414 1.414M7.05 17.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 6.05L5.636 4.636M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button className="p-2 rounded border transition-colors bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600" title="Voice message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2"/>
                    </svg>
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
              <h3 className="text-xl font-semibold mb-2 text-white">
                Select a conversation
              </h3>
              <p className="text-gray-400">
                Choose a friend or group to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
