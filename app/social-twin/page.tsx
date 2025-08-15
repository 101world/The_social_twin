'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { PaperAirplaneIcon, PhotoIcon, VideoCameraIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import ChatTopicSelector from '@/components/ChatTopicSelector';
import ChatMessage from '@/components/ChatMessage';
import CreditDisplay from '@/components/CreditDisplay';

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  created_at: string;
  metadata?: any;
}

interface MediaGeneration {
  id: string;
  type: 'image' | 'video' | 'image-modify';
  prompt: string;
  result_url?: string;
  thumbnail_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
}

interface Topic {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  message_count: number;
}

export default function SocialTwinPage() {
  const { isSignedIn, userId } = useAuth();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mediaGenerations, setMediaGenerations] = useState<MediaGeneration[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [runPodUrls, setRunPodUrls] = useState({
    text: '',
    image: '',
    video: '',
    'image-modify': ''
  });
  const [generationMode, setGenerationMode] = useState<'text' | 'image' | 'video' | 'image-modify'>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load RunPod URLs from localStorage
    const savedUrls = localStorage.getItem('runPodUrls');
    if (savedUrls) {
      try {
        setRunPodUrls(JSON.parse(savedUrls));
      } catch (error) {
        console.error('Error parsing saved RunPod URLs:', error);
      }
    }

    // Load default topic if none selected
    if (!selectedTopicId) {
      loadDefaultTopic();
    }
  }, []);

  useEffect(() => {
    if (selectedTopicId) {
      loadMessages();
      loadMediaGenerations();
    }
  }, [selectedTopicId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadDefaultTopic = async () => {
    try {
      const response = await fetch('/api/topics');
      if (response.ok) {
        const topics = await response.json();
        if (topics.length > 0) {
          setSelectedTopicId(topics[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading default topic:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedTopicId) return;
    
    try {
      const response = await fetch(`/api/topics/${selectedTopicId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadMediaGenerations = async () => {
    if (!selectedTopicId) return;
    
    try {
      const response = await fetch(`/api/topics/${selectedTopicId}/media`);
      if (response.ok) {
        const data = await response.json();
        setMediaGenerations(data.media || []);
      }
    } catch (error) {
      console.error('Error loading media generations:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopicId(topicId);
    setMessages([]);
    setMediaGenerations([]);
  };

  const handleTopicCreate = async (title: string, description?: string) => {
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      
      if (response.ok) {
        const newTopic = await response.json();
        setSelectedTopicId(newTopic.id);
        // Refresh topics list will be handled by ChatTopicSelector
      }
    } catch (error) {
      console.error('Error creating topic:', error);
    }
  };

  const handleTopicDelete = async (topicId: string) => {
    try {
      const response = await fetch(`/api/topics/${topicId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        if (selectedTopicId === topicId) {
          setSelectedTopicId(null);
          setMessages([]);
          setMediaGenerations([]);
        }
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
    }
  };

  const handleTopicUpdate = async (topicId: string, title: string, description?: string) => {
    try {
      const response = await fetch(`/api/topics/${topicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      
      if (response.ok) {
        // Refresh topics list will be handled by ChatTopicSelector
      }
    } catch (error) {
      console.error('Error updating topic:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedTopicId || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // Add user message
      const userResponse = await fetch(`/api/topics/${selectedTopicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage, role: 'user' })
      });

      if (!userResponse.ok) {
        throw new Error('Failed to send message');
      }

      const userMsg = await userResponse.json();
      setMessages(prev => [...prev, userMsg]);

      // Handle different generation modes
      if (generationMode === 'text') {
        // Generate AI text response
        await generateTextResponse(userMessage);
      } else {
        // Generate media
        await generateMedia(userMessage, generationMode);
      }

      // Refresh messages and media
      await loadMessages();
      await loadMediaGenerations();
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Sorry, there was an error processing your request. Please try again.',
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTextResponse = async (prompt: string) => {
    try {
      // Simulate AI response (replace with actual AI API call)
      const aiResponse = await fetch(`/api/topics/${selectedTopicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: `This is a simulated AI response to: "${prompt}". In production, this would call your AI service.`, 
          role: 'ai' 
        })
      });

      if (aiResponse.ok) {
        const aiMsg = await aiResponse.json();
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
    }
  };

  const generateMedia = async (prompt: string, type: 'image' | 'video' | 'image-modify') => {
    try {
      const response = await fetch(`/api/topics/${selectedTopicId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          prompt,
          generationParams: {
            runPodUrl: runPodUrls[type],
            // Add other parameters as needed
          }
        })
      });

      if (response.ok) {
        const mediaGen = await response.json();
        setMediaGenerations(prev => [...prev, mediaGen]);
      } else {
        const errorData = await response.json();
        if (errorData.error === 'Insufficient credits') {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `Insufficient credits. You need ${errorData.required} credits but have ${errorData.available}.`,
            created_at: new Date().toISOString()
          }]);
        }
      }
    } catch (error) {
      console.error('Error generating media:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const saveRunPodUrls = () => {
    localStorage.setItem('runPodUrls', JSON.stringify(runPodUrls));
    setShowSettings(false);
  };

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Sign In</h1>
          <p className="text-gray-600">You need to be signed in to access the Social Twin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Topics */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Chat Topics</h2>
          <p className="text-sm text-gray-500">Organize your conversations</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <ChatTopicSelector
            selectedTopicId={selectedTopicId}
            onTopicSelect={handleTopicSelect}
            onTopicCreate={handleTopicCreate}
            onTopicDelete={handleTopicDelete}
            onTopicUpdate={handleTopicUpdate}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Social Twin</h1>
              <p className="text-sm text-gray-500">
                {selectedTopicId ? 'AI-powered conversations and media generation' : 'Select a topic to start chatting'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <CreditDisplay showDetails={false} />
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Settings"
              >
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">RunPod Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Generation URL</label>
                  <input
                    type="text"
                    value={runPodUrls.text}
                    onChange={(e) => setRunPodUrls(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="https://your-runpod-endpoint.com/text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image Generation URL</label>
                  <input
                    type="text"
                    value={runPodUrls.image}
                    onChange={(e) => setRunPodUrls(prev => ({ ...prev, image: e.target.value }))}
                    placeholder="https://your-runpod-endpoint.com/image"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video Generation URL</label>
                  <input
                    type="text"
                    value={runPodUrls.video}
                    onChange={(e) => setRunPodUrls(prev => ({ ...prev, video: e.target.value }))}
                    placeholder="https://your-runpod-endpoint.com/video"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image Modification URL</label>
                  <input
                    type="text"
                    value={runPodUrls['image-modify']}
                    onChange={(e) => setRunPodUrls(prev => ({ ...prev, 'image-modify': e.target.value }))}
                    placeholder="https://your-runpod-endpoint.com/modify"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveRunPodUrls}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save Configuration
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedTopicId ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Topic Selected</h3>
              <p className="text-gray-500">Choose a topic from the sidebar or create a new one to start chatting.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start a Conversation</h3>
              <p className="text-gray-500">Send a message below to begin chatting with your AI assistant.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                // Find media generations for this message (by timestamp proximity)
                const messageTime = new Date(message.created_at).getTime();
                const relatedMedia = mediaGenerations.filter(media => {
                  const mediaTime = new Date(media.created_at).getTime();
                  return Math.abs(messageTime - mediaTime) < 60000; // Within 1 minute
                });

                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    mediaGenerations={relatedMedia}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {selectedTopicId && (
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              {/* Generation Mode Selector */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setGenerationMode('text')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    generationMode === 'text'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  💬 Text
                </button>
                <button
                  onClick={() => setGenerationMode('image')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    generationMode === 'image'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🖼️ Image
                </button>
                <button
                  onClick={() => setGenerationMode('image-modify')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    generationMode === 'image-modify'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ✏️ Modify
                </button>
                <button
                  onClick={() => setGenerationMode('video')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    generationMode === 'video'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🎥 Video
                </button>
              </div>

              {/* Input Field */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Type your ${generationMode === 'text' ? 'message' : generationMode} prompt here...`}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                  <div className="absolute right-3 top-3 text-xs text-gray-400">
                    {generationMode === 'text' && '1 credit'}
                    {generationMode === 'image' && '5 credits'}
                    {generationMode === 'image-modify' && '3 credits'}
                    {generationMode === 'video' && '10 credits'}
                  </div>
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : generationMode === 'text' ? (
                    <PaperAirplaneIcon className="h-4 w-4" />
                  ) : generationMode === 'image' || generationMode === 'image-modify' ? (
                    <PhotoIcon className="h-4 w-4" />
                  ) : (
                    <VideoCameraIcon className="h-4 w-4" />
                  )}
                  {isLoading ? 'Processing...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
