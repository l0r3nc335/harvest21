"use client";

import Link from "next/link";
import { ConversationWithDetails } from "@/types/messaging";
import { usePrefetchMessages } from "@/lib/messaging/useMessageCache";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { HighlightedMessageContent } from "./HighlightedMessageContent";
import { MessageSquare } from "lucide-react";

interface MessengerConversationListProps {
  conversations: ConversationWithDetails[];
  selectedConversationId?: number;
  onConversationSelect: (conversationId: number) => void;
  searchQuery: string;
  isSearching?: boolean;
}

export function MessengerConversationList({
  conversations,
  selectedConversationId,
  onConversationSelect,
  searchQuery,
  isSearching = false,
}: MessengerConversationListProps) {
  const { prefetchConversation } = usePrefetchMessages();
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

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  if (isSearching && searchQuery && conversations.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 items-center animate-pulse">
            <div className="w-14 h-14 rounded-full bg-[#2C2C2C] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[#2C2C2C] rounded w-2/5" />
              <div className="h-3 bg-[#2C2C2C] rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <MessageSquare className="w-16 h-16 text-[#808080] mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">
          {searchQuery ? "No results found" : "No conversations yet"}
        </h3>
        <p className="text-sm text-[#808080] max-w-xs">
          {searchQuery
            ? "Try searching with a different keyword"
            : "Start a conversation with a missionary from their profile page"}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#2C2C2C]" data-cy="list-conversations">
      {conversations.map((conversation) => {
        const isSelected = conversation.id === selectedConversationId;
        const isUnread = conversation.unread_count > 0;
        const isLastMessageFromMe =
          conversation.last_message_sender_id === conversation.supporter_id;

        return (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            scroll={false}
            onMouseEnter={() => prefetchConversation(conversation.id)}
            onClick={(e) => {
              onConversationSelect(conversation.id);
            }}
            className={`w-full p-4 flex gap-3 items-center transition-colors cursor-pointer border-l-2 ${
              isSelected
                ? "bg-[#1A1A1A] border-l-[#D3AF37]"
                : "border-l-transparent hover:bg-[#1A1A1A] active:bg-[#1A1A1A]"
            }`}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative w-14 h-14 rounded-full overflow-hidden">
                <MissionaryProfileImage
                  src={conversation.missionary_profile_photo}
                  alt={conversation.missionary_name}
                  fill
                  className="object-cover"
                />
              </div>
              {/* Unread Badge */}
              {isUnread && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#D3AF37] rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-black">
                    {conversation.unread_count}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-baseline justify-between mb-1">
                <h3
                  className={`font-semibold truncate ${
                    isUnread ? "text-white" : "text-[#E5E5E5]"
                  }`}
                >
                  <HighlightedMessageContent
                    content={conversation.missionary_name}
                    highlightKeyword={searchQuery || null}
                  />
                </h3>
                <span className="text-xs text-[#808080] ml-2 shrink-0">
                  {formatTime(conversation.last_message_at)}
                </span>
              </div>
              <p
                className={`text-sm truncate ${
                  isUnread ? "text-[#E5E5E5] font-medium" : "text-[#808080]"
                }`}
              >
                {(() => {
                  const snippet = (conversation as any)._searchSnippet as string | undefined;
                  const previewText = snippet || conversation.last_message_preview || "No messages yet";
                  return (
                    <>
                      {!snippet && isLastMessageFromMe && (
                        <span className="text-[#808080]">You: </span>
                      )}
                      <HighlightedMessageContent
                        content={previewText}
                        highlightKeyword={searchQuery || null}
                      />
                    </>
                  );
                })()}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

