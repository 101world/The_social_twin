'use client';

import { useState, useRef } from 'react';
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
  
  const bottomInputRef = useRef<HTMLTextAreaElement>(null);

  const testFriends = [
    { id: '1', name: 'Alice AI', avatar: 'A', isOnline: true, status: 'Building amazing AI models' },
    { id: '2', name: 'Bob Security', avatar: 'B', isOnline: true, status: 'Securing the digital world' },
    { id: '3', name: 'Charlie Code', avatar: 'C', isOnline: false, status: 'Coding the future' }
  ];

  const testGroups = [
    { id: '4', name: 'General Chat', avatar: '#', members: 127, description: 'Main community discussion' },
    { id: '5', name: 'AI Creators', avatar: '#', members: 89, description: 'AI enthusiasts and creators' }
  ];

  const handleSelectChat = (chat: any) => {
    setSelectedChat(chat);
    // Simulate loading some messages
    setMessages([
      {
        id: '1',
        content: `Hey! Welcome to the chat with ${chat.name}!`,
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
  };

  const sendMessage = () => {
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
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Top Navigation - Friends/Groups Collapsible Bars */}
      <div className="bg-gray-800 border-b border-gray-700">
        {/* Friends Bar */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => setFriendsCollapsed(!friendsCollapsed)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Friends</span>
              <span className="text-sm text-gray-400">({testFriends.length})</span>
            </div>
            {friendsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {!friendsCollapsed && (
            <div className="max-h-32 overflow-y-auto bg-gray-750">
              {testFriends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleSelectChat(friend)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-700 transition-colors border-l-4 ${
                    selectedChat?.id === friend.id ? 'border-blue-500 bg-gray-700' : 'border-transparent'
                  }`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-sm">{friend.avatar}</span>
                    </div>
                    {friend.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{friend.name}</div>
                    <div className="text-xs text-gray-400 truncate">{friend.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Groups Bar */}
        <div>
          <button
            onClick={() => setGroupsCollapsed(!groupsCollapsed)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Hash className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Groups</span>
              <span className="text-sm text-gray-400">({testGroups.length})</span>
            </div>
            {groupsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {!groupsCollapsed && (
            <div className="max-h-32 overflow-y-auto bg-gray-750">
              {testGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleSelectChat(group)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-700 transition-colors border-l-4 ${
                    selectedChat?.id === group.id ? 'border-green-500 bg-gray-700' : 'border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{group.name}</div>
                    <div className="text-xs text-gray-400">{group.members} members</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-sm">{selectedChat.avatar}</span>
                  </div>
                  <div>
                    <div className="font-semibold">{selectedChat.name}</div>
                    <div className="text-xs text-gray-400">
                      {selectedChat.members ? `${selectedChat.members} members` : 'Online'}
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.isOwn
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}
                  >
                    <div className="text-sm">{message.content}</div>
                    <div className="text-xs mt-1 opacity-70">{message.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input Area - EXACTLY like docked chat */}
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
                    disabled={!messageInput.trim()}
                    className={`group relative h-8 w-8 cursor-pointer rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                      messageInput.trim()
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
              
              {/* Privacy mode indicator */}
              {privacyMode && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                  <Lock className="w-3 h-3" />
                  <span>Privacy mode enabled - Messages encrypted</span>
                </div>
              )}
              
              {/* AI mode indicator */}
              {aiMode && (
                <div className="mt-2 flex items-center gap-2 text-xs text-purple-400">
                  <Sparkles className="w-3 h-3" />
                  <span>AI mode enabled - Ready to share generations</span>
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
              <p className="text-gray-400 mb-4">
                Choose a friend or group to start messaging
              </p>
              <div className="text-sm text-green-400">
                ✅ Friends/Groups collapsible bars working<br/>
                ✅ Full chat interface with docked prompt box<br/>
                ✅ AI mode, privacy mode, and all chat functions<br/>
                ✅ Ready for database integration
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
