'use client';

import React, { useState, useEffect } from 'react';
import { Users, Check, X, Loader2, Clock } from 'lucide-react';

interface FriendRequest {
  id: string;
  requester_id: string;
  requester_clerk_id: string;
  requester_username: string;
  requester_display_name: string;
  requester_avatar_url: string | null;
  request_message: string;
  created_at: string;
}

interface FriendRequestsPanelProps {
  currentUserClerkId: string;
  onRequestsChange?: () => void;
}

export default function FriendRequestsPanel({ currentUserClerkId, onRequestsChange }: FriendRequestsPanelProps) {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // Fetch pending friend requests
  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/messenger/get-pending-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userClerkId: currentUserClerkId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Failed to fetch friend requests');
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Accept friend request
  const acceptRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await fetch('/api/messenger/accept-friend-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          friendshipId: requestId,
          userClerkId: currentUserClerkId
        }),
      });

      if (response.ok) {
        // Remove accepted request from list
        setRequests(prev => prev.filter(req => req.id !== requestId));
        onRequestsChange?.();
        alert('Friend request accepted!');
      } else {
        const error = await response.text();
        alert(`Failed to accept request: ${error}`);
      }
    } catch (error) {
      console.error('Accept request error:', error);
      alert('Failed to accept friend request. Please try again.');
    } finally {
      setProcessingRequest(null);
    }
  };

  // Decline friend request (could implement if needed)
  const declineRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      // For now, just remove from UI - could implement decline API endpoint
      setRequests(prev => prev.filter(req => req.id !== requestId));
      alert('Friend request declined');
    } catch (error) {
      console.error('Decline request error:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUserClerkId]);

  if (loading) {
    return (
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="ml-2 text-gray-400 text-sm">Loading requests...</span>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="p-4 border-b border-gray-800">
        <div className="text-center py-2 text-gray-500 text-sm">
          No pending friend requests
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-800">
      <div className="p-3 bg-gray-950 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">
            Pending Requests ({requests.length})
          </span>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {requests.map((request) => (
          <div key={request.id} className="p-3 border-b border-gray-800 last:border-b-0 hover:bg-gray-900/50">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                {request.requester_avatar_url ? (
                  <img
                    src={request.requester_avatar_url}
                    alt={request.requester_username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {request.requester_username[0]?.toUpperCase() || '?'}
                  </span>
                )}
              </div>

              {/* Request Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{request.requester_username}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(request.created_at).toLocaleDateString()}
                  </span>
                </div>
                {request.requester_display_name && request.requester_display_name !== request.requester_username && (
                  <div className="text-xs text-gray-400">{request.requester_display_name}</div>
                )}
                {request.request_message && (
                  <div className="text-xs text-gray-300 mt-1 italic">
                    "{request.request_message}"
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => acceptRequest(request.id)}
                    disabled={processingRequest === request.id}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-xs transition-colors"
                  >
                    {processingRequest === request.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    <span>Accept</span>
                  </button>
                  <button
                    onClick={() => declineRequest(request.id)}
                    disabled={processingRequest === request.id}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded text-xs transition-colors"
                  >
                    <X className="w-3 h-3" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
