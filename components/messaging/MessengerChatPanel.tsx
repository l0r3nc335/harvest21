"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { MessengerMessageThread } from "./MessengerMessageThread";
import { ConversationSearchPanel } from "./ConversationSearchPanel";
import { useCachedMessages } from "@/lib/messaging/useMessageCache";
import { useConversationSearch } from "@/lib/messaging/useConversationSearch";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import Link from "next/link";
import type { ConversationWithDetails } from "@/types/messaging";

interface MessengerChatPanelProps {
  conversationId: number;
  currentUserId: string;
  onBack: () => void;
  initialConversation?: ConversationWithDetails | null;
}

export function MessengerChatPanel({
  conversationId,
  currentUserId,
  onBack,
  initialConversation = null,
}: MessengerChatPanelProps) {
  const {
    messages,
    conversation,
    isLoading,
    isSyncing,
  } = useCachedMessages(conversationId);

  const displayConversation = conversation ?? initialConversation;
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    isSearchMode,
    openSearch,
    closeSearch,
    results: searchResults,
    selectedResultIndex,
    selectResult,
    selectAndDismiss,
    nextResult,
    previousResult,
    highlightTargetId,
    scrollTrigger,
    highlightKeyword,
  } = useConversationSearch(messages);

  useEffect(() => {
    fetchCurrentUserPhoto();
  }, [currentUserId]);

  const fetchCurrentUserPhoto = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userData) return;

    const role = userData.role;

    if (role === 3) {
      const { data: missionaryData } = await supabase
        .from("missionaries")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (missionaryData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("profile_photo_url")
          .eq("organization_type", "missionary")
          .eq("organization_id", missionaryData.id)
          .single();
        setCurrentUserPhoto(pageData?.profile_photo_url || null);
      }
    } else if (role === 4) {
      const { data: supporterData } = await supabase
        .from("supporter_profiles")
        .select("profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setCurrentUserPhoto(supporterData?.profile_photo_url || null);
    } else if (role === 5) {
      // Agency - uses contact_user_id
      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id")
        .eq("contact_user_id", user.id)
        .single();

      if (agencyData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("profile_photo_url")
          .eq("organization_type", "agency")
          .eq("organization_id", agencyData.id)
          .single();
        setCurrentUserPhoto(pageData?.profile_photo_url || null);
      }
    } else if (role === 6) {
      // Church - uses contact_user_id
      const { data: churchData } = await supabase
        .from("churches")
        .select("id")
        .eq("contact_user_id", user.id)
        .single();

      if (churchData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("profile_photo_url")
          .eq("organization_type", "church")
          .eq("organization_id", churchData.id)
          .single();
        setCurrentUserPhoto(pageData?.profile_photo_url || null);
      }
    } else if (role === 7) {
      // College - uses contact_user_id
      const { data: collegeData } = await supabase
        .from("colleges")
        .select("id")
        .eq("contact_user_id", user.id)
        .single();

      if (collegeData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("profile_photo_url")
          .eq("organization_type", "college")
          .eq("organization_id", collegeData.id)
          .single();
        setCurrentUserPhoto(pageData?.profile_photo_url || null);
      }
    }
  };

  if (!displayConversation && isLoading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF9F6]">
        <div className="border-b border-zinc-200 p-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden cursor-pointer rounded-full p-2 transition-colors hover:bg-zinc-100"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-zinc-200 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-zinc-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-zinc-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500">Loading conversation...</div>
        </div>
      </div>
    );
  }

  if (!displayConversation) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <p className="text-zinc-900 font-medium">Conversation not found</p>
          <button
            onClick={onBack}
            className="mt-4 cursor-pointer text-sm text-[#D3AF37] hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF9F6]">
      <div className="border-b border-zinc-200 p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="lg:hidden cursor-pointer rounded-full p-2 transition-colors hover:bg-zinc-100"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-700" />
        </button>

        {displayConversation.missionary_page_url &&
        displayConversation.missionary_page_is_published ? (
          <Link
            href={`/${displayConversation.missionary_page_url}`}
            className="flex items-center gap-3 flex-1 hover:bg-zinc-50 rounded-lg p-2 -m-2 transition-colors"
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
              <MissionaryProfileImage
                src={displayConversation.missionary_profile_photo}
                alt={displayConversation.missionary_name || "Missionary"}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-semibold text-zinc-900 truncate">
                  {displayConversation.missionary_name || "Loading..."}
                </h2>
                {displayConversation.other_user_type && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-200 text-zinc-600 uppercase shrink-0">
                    {displayConversation.other_user_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {isSyncing ? "Syncing..." : "View profile"}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 flex-1 rounded-lg p-2 -m-2 cursor-default">
            <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
              <MissionaryProfileImage
                src={displayConversation.missionary_profile_photo}
                alt={displayConversation.missionary_name || "Missionary"}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-semibold text-zinc-900 truncate">
                  {displayConversation.missionary_name || "Loading..."}
                </h2>
                {displayConversation.other_user_type && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-200 text-zinc-600 uppercase shrink-0">
                    {displayConversation.other_user_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {isSyncing ? "Syncing..." : null}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={openSearch}
          className="shrink-0 cursor-pointer rounded-full p-2 transition-colors hover:bg-zinc-100"
          title="Search in conversation"
        >
          <Search className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        {isSearchMode && (
          <ConversationSearchPanel
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            selectedResultIndex={selectedResultIndex}
            onSelectResult={(index) => {
              selectAndDismiss(index);
            }}
            onNext={nextResult}
            onPrevious={previousResult}
            onClose={closeSearch}
          />
        )}

        <MessengerMessageThread
          conversationId={conversationId}
          initialMessages={messages}
          currentUserId={currentUserId}
          currentUserPhoto={currentUserPhoto}
          recipientName={displayConversation.missionary_name || ""}
          recipientPhoto={displayConversation.missionary_profile_photo}
          highlightTargetId={highlightTargetId}
          highlightKeyword={highlightKeyword}
          scrollTrigger={scrollTrigger}
        />
      </div>
    </div>
  );
}

