"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Conversation, ConversationWithDetails } from "@/types/messaging";
import Image from "next/image";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";

interface ConversationListProps {
  initialConversations: ConversationWithDetails[];
  currentUserId: string;
  theme?: "light" | "dark";
}

export function ConversationList({
  initialConversations,
  currentUserId,
  theme = "dark",
}: ConversationListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>(initialConversations);
  const conversationIds = conversations.map((c) => c.id);

  useEffect(() => {
    if (conversationIds.length === 0) return;

    const channel = supabase
      .channel("conversations-list")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=in.(${conversationIds.join(",")})`,
        },
        (payload: { eventType: string; new: Partial<Conversation> }) => {
          const updatedConv = payload.new;
          setConversations((prev) => {
            const updated = prev.map((conv) =>
              conv.id === updatedConv.id
                ? { 
                    ...conv, 
                    last_message_at: updatedConv.last_message_at || conv.last_message_at,
                    last_message_preview: updatedConv.last_message_preview || conv.last_message_preview,
                    last_message_sender_id: updatedConv.last_message_sender_id || conv.last_message_sender_id,
                  }
                : conv
            );
            
            // Sort by last_message_at (most recent first)
            return updated.sort((a, b) => 
              new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload: { eventType: string; new: { conversation_id: number; unread_count: number } }) => {
          const updatedMember = payload.new;
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === updatedMember.conversation_id
                ? { ...conv, unread_count: updatedMember.unread_count }
                : conv
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationIds.join(','), currentUserId]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg font-semibold">No messages yet</p>
          <p className="text-sm mt-2">
            Visit a missionary&apos;s page and send them a message!
          </p>
        </div>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div className={isDark ? "divide-y divide-gray-800" : "divide-y divide-zinc-200"}>
      {conversations.map((conversation) => {
        const isUnread = conversation.unread_count > 0;
        const isLastMessageFromMe = conversation.last_message_sender_id === currentUserId;

        return (
          <button
            key={conversation.id}
            onClick={() => router.push(`/messages/${conversation.id}`)}
            className={`w-full p-4 transition-colors text-left flex gap-4 items-center cursor-pointer ${
              isDark ? "hover:bg-gray-900" : "hover:bg-zinc-50"
            }`}
          >
            <div className="relative shrink-0">
              <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0">
                <MissionaryProfileImage
                  src={conversation.missionary_profile_photo}
                  alt={conversation.missionary_name}
                  fill
                  className="object-cover"
                />
              </div>
              {isUnread && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#E1B94D] rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-black">
                    {conversation.unread_count}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3
                  className={`font-semibold truncate ${
                    isDark 
                      ? (isUnread ? "text-white" : "text-gray-300")
                      : (isUnread ? "text-zinc-900" : "text-zinc-700")
                  }`}
                >
                  {conversation.missionary_name}
                </h3>
                <span className={`text-xs shrink-0 ml-2 ${
                  isDark ? "text-gray-500" : "text-zinc-500"
                }`}>
                  {formatTime(conversation.last_message_at)}
                </span>
              </div>
              <p
                className={`text-sm truncate ${
                  isDark 
                    ? (isUnread ? "text-gray-300 font-medium" : "text-gray-500")
                    : (isUnread ? "text-zinc-600 font-medium" : "text-zinc-500")
                }`}
              >
                {isLastMessageFromMe && "You: "}
                {conversation.last_message_preview || "No messages yet"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

