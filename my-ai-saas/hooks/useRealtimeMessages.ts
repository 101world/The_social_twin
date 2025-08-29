'use client';

import { useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

interface UseRealtimeMessagesProps {
  roomId: string | null;
  currentUserClerkId: string;
  onNewMessage: (message: any) => void;
  onMessageUpdate: (message: any) => void;
  onMessageDelete: (messageId: string) => void;
}

export const useRealtimeMessages = ({
  roomId,
  currentUserClerkId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete
}: UseRealtimeMessagesProps) => {
  const subscriptionRef = useRef<any>(null);

  // Create Supabase client at runtime to avoid build-time environment variable access
  const supabase = useMemo(() => {
    // Only create if we have the environment variables available
    if (typeof window !== 'undefined') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (url && key) {
        return createClient(url, key);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!roomId || !supabase) return;

    // Clean up previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Set up new subscription for the current room
    subscriptionRef.current = supabase
      .channel(`messages_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messenger_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          // Fetch the complete message with sender info
          const { data: messageWithSender, error } = await supabase
            .from('messenger_messages')
            .select(`
              id,
              content,
              message_type,
              ai_generation_data,
              media_urls,
              reply_to_id,
              created_at,
              updated_at,
              sender:messenger_users!messenger_messages_sender_id_fkey (
                id,
                clerk_id,
                username,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && messageWithSender) {
            const sender = Array.isArray(messageWithSender.sender) ? messageWithSender.sender[0] : messageWithSender.sender;
            
            const formattedMessage = {
              id: messageWithSender.id,
              content: messageWithSender.content,
              messageType: messageWithSender.message_type,
              aiGenerationData: messageWithSender.ai_generation_data,
              mediaUrls: messageWithSender.media_urls,
              replyToId: messageWithSender.reply_to_id,
              timestamp: new Date(messageWithSender.created_at).toLocaleTimeString(),
              createdAt: messageWithSender.created_at,
              isOwn: sender?.clerk_id === currentUserClerkId,
              sender: {
                id: sender?.id,
                clerkId: sender?.clerk_id,
                username: sender?.username,
                displayName: sender?.display_name,
                avatarUrl: sender?.avatar_url
              }
            };

            onNewMessage(formattedMessage);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messenger_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          onMessageUpdate(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messenger_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          onMessageDelete(payload.old.id);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔔 Real-time subscription active for room ${roomId}`);
        }
      });

    // Cleanup function
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        console.log(`🔕 Unsubscribed from room ${roomId}`);
      }
    };
  }, [roomId, currentUserClerkId, onNewMessage, onMessageUpdate, onMessageDelete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    isConnected: subscriptionRef.current?.state === 'subscribed'
  };
};
