'use client';

import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, Loader2, Users } from 'lucide-react';

interface User {
  id: string;
  clerk_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  custom_status: string | null;
}

interface FriendSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserClerkId: string;
}

export default function FriendSearchModal({ isOpen, onClose, currentUserClerkId }: FriendSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');

  // Search users function
  const searchUsers = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/messenger/search-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm: term,
          currentUserClerkId,
          limitCount: 10
        }),
      });

      if (response.ok) {
        const users = await response.json();
        setSearchResults(users);
      } else {
        console.error('Search failed:', response.statusText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Send friend request function
  const sendFriendRequest = async (targetClerkId: string) => {
    setSendingRequest(targetClerkId);
    try {
      const response = await fetch('/api/messenger/send-friend-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requesterClerkId: currentUserClerkId,
          addresseeClerkId: targetClerkId,
          requestMessage: requestMessage.trim() || 'Hi! I\'d like to connect with you.'
        }),
      });

      if (response.ok) {
        // Remove user from search results after sending request
        setSearchResults(prev => prev.filter(user => user.clerk_id !== targetClerkId));
        setRequestMessage('');
        alert('Friend request sent successfully!');
      } else {
        const error = await response.text();
        alert(`Failed to send friend request: ${error}`);
      }
    } catch (error) {
      console.error('Friend request error:', error);
      alert('Failed to send friend request. Please try again.');
    } finally {
      setSendingRequest(null);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Add Friends</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username or email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
            />
          </div>
          
          {/* Optional message input */}
          <div className="mt-3">
            <input
              type="text"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Optional message (default: Hi! I'd like to connect with you.)"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 text-sm"
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="ml-2 text-gray-400">Searching...</span>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="p-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-medium">
                          {user.username[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    {/* Online indicator */}
                    {user.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{user.username}</span>
                      {user.is_online && (
                        <span className="text-xs text-green-400">Online</span>
                      )}
                    </div>
                    {user.display_name && user.display_name !== user.username && (
                      <div className="text-sm text-gray-400">{user.display_name}</div>
                    )}
                    {user.custom_status && (
                      <div className="text-xs text-gray-500">{user.custom_status}</div>
                    )}
                  </div>

                  {/* Add Friend Button */}
                  <button
                    onClick={() => sendFriendRequest(user.clerk_id)}
                    disabled={sendingRequest === user.clerk_id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                  >
                    {sendingRequest === user.clerk_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          ) : searchTerm.trim() ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Users className="w-12 h-12 mb-2 opacity-50" />
              <p>No users found for "{searchTerm}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Search className="w-12 h-12 mb-2 opacity-50" />
              <p>Start typing to search for users</p>
              <p className="text-sm mt-1">Search by username or email</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-950">
          <div className="text-xs text-gray-500 text-center">
            🔒 Black/White theme with deep blue highlights • Friend search ready
          </div>
        </div>
      </div>
    </div>
  );
}
