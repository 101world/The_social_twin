'use client';

import { useState } from 'react';
import { UserIcon, SparklesIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

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

interface ChatMessageProps {
  message: Message;
  mediaGenerations?: MediaGeneration[];
}

export default function ChatMessage({ message, mediaGenerations = [] }: ChatMessageProps) {
  const [imageError, setImageError] = useState<string | null>(null);

  const getRoleIcon = () => {
    switch (message.role) {
      case 'user':
        return <UserIcon className="h-6 w-6 text-gray-600" />;
      case 'ai':
        return <SparklesIcon className="h-6 w-6 text-purple-600" />;
      case 'system':
        return <div className="h-6 w-6 rounded-full bg-gray-400 flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>;
      default:
        return <UserIcon className="h-6 w-6 text-gray-600" />;
    }
  };

  const getRoleName = () => {
    switch (message.role) {
      case 'user':
        return 'You';
      case 'ai':
        return 'AI Assistant';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  const getRoleColor = () => {
    switch (message.role) {
      case 'user':
        return 'bg-gray-50 border-gray-200';
      case 'ai':
        return 'bg-purple-50 border-purple-200';
      case 'system':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <PhotoIcon className="h-4 w-4" />;
      case 'video':
        return <VideoCameraIcon className="h-4 w-4" />;
      case 'image-modify':
        return <PhotoIcon className="h-4 w-4" />;
      default:
        return <PhotoIcon className="h-4 w-4" />;
    }
  };

  const getMediaTypeLabel = (type: string) => {
    switch (type) {
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'image-modify':
        return 'Modified Image';
      default:
        return type;
    }
  };

  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${getRoleColor()}`}>
      <div className="flex-shrink-0">
        {getRoleIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-gray-900">{getRoleName()}</span>
          <span className="text-sm text-gray-500">{formatTime(message.created_at)}</span>
        </div>
        
        {/* Message Content */}
        <div className="text-gray-800 whitespace-pre-wrap">{message.content}</div>
        
        {/* Media Generations */}
        {mediaGenerations.length > 0 && (
          <div className="mt-3 space-y-3">
            {mediaGenerations.map((media) => (
              <div key={media.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  {getMediaIcon(media.type)}
                  <span className="text-sm font-medium text-gray-700">
                    {getMediaTypeLabel(media.type)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(media.created_at)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Prompt:</strong> {media.prompt}
                </div>
                
                {media.status === 'pending' && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                    <span className="text-sm">Generating...</span>
                  </div>
                )}
                
                {media.status === 'processing' && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm">Processing...</span>
                  </div>
                )}
                
                {media.status === 'completed' && media.result_url && (
                  <div className="space-y-2">
                    {media.type === 'image' || media.type === 'image-modify' ? (
                      <img
                        src={media.result_url}
                        alt={media.prompt}
                        className="max-w-full h-auto rounded-lg border"
                        onError={() => setImageError(media.id)}
                      />
                    ) : media.type === 'video' ? (
                      <video
                        src={media.result_url}
                        controls
                        className="max-w-full h-auto rounded-lg border"
                        poster={media.thumbnail_url}
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : null}
                    
                    {imageError === media.id && (
                      <div className="text-red-500 text-sm">
                        Failed to load image
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <a
                        href={media.result_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        View Full Size
                      </a>
                      <a
                        href={media.result_url}
                        download
                        className="text-sm text-green-600 hover:text-green-800 underline"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                )}
                
                {media.status === 'failed' && (
                  <div className="text-red-600 text-sm">
                    <strong>Error:</strong> {media.error_message || 'Generation failed'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Message Metadata */}
        {message.metadata && (
          <div className="mt-2 text-xs text-gray-500">
            {message.metadata.model && (
              <span className="mr-2">Model: {message.metadata.model}</span>
            )}
            {message.metadata.tokens && (
              <span>Tokens: {message.metadata.tokens}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
