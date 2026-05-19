"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Filter, Home, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateConversation, canSendDirectMessage, searchConversationsByMessageContent } from "@/app/messages/message-actions";
import toast from "react-hot-toast";
import { ConversationWithDetails } from "@/types/messaging";
import { MessengerConversationList } from "./MessengerConversationList";
import { MessengerChatPanel } from "./MessengerChatPanel";
import { useCachedConversations, useCacheUpdater } from "@/lib/messaging/useMessageCache";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import type { NavbarUserProfile } from "@/lib/navbarHelpers";

interface MessengerLayoutProps {
  initialConversations: ConversationWithDetails[];
  currentUserId: string;
  selectedConversationId?: number;
  initialConversationDetails?: ConversationWithDetails | null;
  openMissionaryId?: number;
  initialUserProfile?: NavbarUserProfile | null;
  initialUnreadCount?: number;
}

export function MessengerLayout({
  initialConversations,
  currentUserId,
  selectedConversationId,
  initialConversationDetails = null,
  openMissionaryId,
  initialUserProfile = null,
  initialUnreadCount = 0,
}: MessengerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { conversations, isLoading, isSyncing, error, refetch } = useCachedConversations(initialConversations);
  const { updateConversation } = useCacheUpdater();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unread">("all");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [messageSearchSnippets, setMessageSearchSnippets] = useState<Record<number, string> | null>(null);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  useEffect(() => {
    if (openMissionaryId == null) return;
    let cancelled = false;
    (async () => {
      const eligibility = await canSendDirectMessage(openMissionaryId);
      if (cancelled) return;
      if (!eligibility.allowed) {
        toast.error(eligibility.reason || "Cannot send message");
        router.replace("/messages");
        return;
      }
      const result = await getOrCreateConversation(openMissionaryId);
      if (cancelled) return;
      if (result.success && result.data) {
        router.replace(`/messages/${result.data.id}`, { scroll: false });
      } else {
        toast.error(result.error || "Failed to open conversation");
        router.replace("/messages");
      }
    })();
    return () => { cancelled = true; };
  }, [openMissionaryId, router]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setMessageSearchSnippets(null);
      setIsSearchingMessages(false);
      return;
    }
    setIsSearchingMessages(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchConversationsByMessageContent(q);
      if (cancelled) return;
      if (result.success) {
        setMessageSearchSnippets(result.data);
      } else {
        setMessageSearchSnippets({});
      }
      setIsSearchingMessages(false);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredConversations = conversations
    .filter((conv) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const name = (conv.missionary_name ?? "").toLowerCase();
      const preview = (conv.last_message_preview ?? "").toLowerCase();
      const matchesNameOrPreview = name.includes(q) || preview.includes(q);
      const matchesFullHistory = messageSearchSnippets ? conv.id in messageSearchSnippets : false;
      const matchesFilter =
        filterType === "all" || (filterType === "unread" && conv.unread_count > 0);
      return (matchesNameOrPreview || matchesFullHistory) && matchesFilter;
    })
    .map((conv) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q || !messageSearchSnippets) return conv;
      const snippet = messageSearchSnippets[conv.id];
      if (!snippet) return conv;
      const name = (conv.missionary_name ?? "").toLowerCase();
      const preview = (conv.last_message_preview ?? "").toLowerCase();
      if (name.includes(q) || preview.includes(q)) return conv;
      return { ...conv, _searchSnippet: snippet };
    });

  // Close mobile sidebar when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      setIsMobileSidebarOpen(false);
    }
  }, [selectedConversationId]);

  // Real-time subscription for conversation updates
  useEffect(() => {
    const conversationIds = conversations.map((c) => c.id);

    const membersChannel = supabase
      .channel("conversation-members-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload: any) => {
          const member = payload.new as any;
          updateConversation(member.conversation_id, {
            unread_count: member.unread_count ?? 0,
          });
          refetch();
        }
      )
      .subscribe();

    let conversationsChannel: ReturnType<typeof supabase.channel> | null = null;
    if (conversationIds.length > 0) {
      conversationsChannel = supabase
        .channel("conversations-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
            filter: `id=in.(${conversationIds.join(",")})`,
          },
          (payload: any) => {
            const updatedConv = payload.new as any;
            updateConversation(updatedConv.id, {
              last_message_at: updatedConv.last_message_at,
              last_message_preview: updatedConv.last_message_preview,
              last_message_sender_id: updatedConv.last_message_sender_id,
            });
            refetch();
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(membersChannel);
      if (conversationsChannel) {
        supabase.removeChannel(conversationsChannel);
      }
    };
  }, [conversations.length, currentUserId, updateConversation, refetch]);

  const handleConversationSelect = (conversationId: number) => {
    router.push(`/messages/${conversationId}`, { scroll: false });
  };

  const isConversationSelected = pathname !== "/messages";

  return (
    <div className="h-screen w-full overflow-hidden bg-[#FAF9F6]">
      {/* Standard Harvest 21 Header */}
      <Navbar initialUserProfile={initialUserProfile} initialUnreadCount={initialUnreadCount} />
      
      {/* Messenger Layout - exact viewport height minus navbar, no bottom white space */}
      <div className="h-[calc(100vh-4rem)] mt-16 flex min-h-0 overflow-hidden bg-[#FAF9F6]">
      {/* Left Sidebar - Conversation List */}
      <div
        className={`
          ${isConversationSelected ? "hidden lg:flex" : "flex"}
          flex-col min-h-0 w-full lg:w-96 bg-[#000000] border-r border-[#2C2C2C]
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#2C2C2C]">
          <div className="flex items-center justify-between mb-4">
            <Link href="#" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-[#D3AF37] rounded-full flex items-center justify-center">
                <Home className="w-5 h-5 text-black" />
              </div>
              <h1 className="text-xl font-bold text-white">Messages</h1>
            </Link>
            {isSyncing && (
              <div title="Syncing...">
                <RefreshCw className="w-4 h-4 text-[#808080] animate-spin" />
              </div>
            )}
          </div>
          
          {error && (
            <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Search conversations - always hidden */}
          <div className="relative hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-[#2C2C2C] rounded-full text-sm text-white placeholder:text-[#808080] focus:outline-none focus:ring-2 focus:ring-brand-yellow/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#808080] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setFilterType("all")}
              className={`cursor-pointer px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === "all"
                  ? "bg-[#D3AF37] text-black"
                  : "bg-[#2C2C2C] text-[#808080] hover:bg-[#1A1A1A]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("unread")}
              className={`cursor-pointer px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === "unread"
                  ? "bg-[#D3AF37] text-black"
                  : "bg-[#2C2C2C] text-[#808080] hover:bg-[#1A1A1A]"
              }`}
            >
              Unread
              {conversations.filter((c) => c.unread_count > 0).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {conversations.filter((c) => c.unread_count > 0).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <MessengerConversationList
            conversations={filteredConversations}
            selectedConversationId={selectedConversationId}
            onConversationSelect={handleConversationSelect}
            searchQuery={searchQuery}
            isSearching={isSearchingMessages}
          />
        </div>
      </div>

      {/* Right Panel - Chat or Empty State */}
      <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isConversationSelected ? "flex" : "hidden lg:flex"}`}>
        {selectedConversationId ? (
          <MessengerChatPanel
            conversationId={selectedConversationId}
            currentUserId={currentUserId}
            onBack={() => router.push("/messages", { scroll: false })}
            initialConversation={initialConversationDetails}
          />
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-[#FAF9F6]">
            <div className="text-center px-4">
              <div className="w-24 h-24 mx-auto mb-4 bg-zinc-200/50 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">
                Select a conversation
              </h2>
              <p className="text-sm text-zinc-500 max-w-sm">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

