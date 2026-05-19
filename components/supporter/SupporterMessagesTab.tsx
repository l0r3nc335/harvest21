"use client";

import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationList } from "@/components/messaging/ConversationList";
import { getConversations } from "@/app/messages/message-actions";
import toast from "react-hot-toast";
import type { ConversationWithDetails } from "@/types/messaging";

interface SupporterMessagesTabProps {
  currentUserId: string;
}

export function SupporterMessagesTab({ currentUserId }: SupporterMessagesTabProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    const result = await getConversations();
    if (result.success) {
      setConversations(result.data);
    } else {
      toast.error(result.error || "Failed to load conversations");
    }
    setIsLoadingConversations(false);
  };

  const LoadingItems = () => (
    <>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
          <div className="w-14 h-14 rounded-full bg-zinc-200"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 rounded w-1/3"></div>
            <div className="h-3 bg-zinc-200 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
        <h2 className="text-xl sm:text-2xl font-bold text-white">Messages</h2>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-zinc-200">
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900">
            Your Conversations
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1">
            Message missionaries you follow
          </p>
        </div>

        {isLoadingConversations ? (
          <div className="divide-y divide-zinc-200">
            <LoadingItems />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400 mx-auto mb-3" />
            <p className="text-sm sm:text-base text-zinc-600 font-medium">
              No conversations yet
            </p>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Start a conversation with a missionary from their profile page
            </p>
          </div>
        ) : (
          <ConversationList
            initialConversations={conversations}
            currentUserId={currentUserId}
            theme="light"
          />
        )}
      </div>

      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2">
          How to Message Missionaries
        </h3>
        <ul className="text-xs sm:text-sm text-blue-800 space-y-1.5">
          <li>• Follow a missionary and wait for them to accept your request</li>
          <li>• Once accepted, visit their profile page</li>
          <li>• Click the "Direct Message" button to start a conversation</li>
          <li>• Your messages will appear here for easy access</li>
        </ul>
      </div>
    </div>
  );
}

