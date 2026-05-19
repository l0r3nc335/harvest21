"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { MessengerLayout } from "./MessengerLayout";
import type { ConversationWithDetails } from "@/types/messaging";
import type { NavbarUserProfile } from "@/lib/navbarHelpers";

interface MessagesShellProps {
  initialConversations: ConversationWithDetails[];
  currentUserId: string;
  initialUserProfile: NavbarUserProfile | null;
  initialUnreadCount: number;
}

export function MessagesShell({
  initialConversations,
  currentUserId,
  initialUserProfile,
  initialUnreadCount,
}: MessagesShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const match = pathname?.match(/^\/messages\/(\d+)$/);
  const selectedConversationId = match ? parseInt(match[1], 10) : undefined;
  const openParam = searchParams?.get("open");
  const openMissionaryId =
    openParam && /^\d+$/.test(openParam) ? parseInt(openParam, 10) : undefined;

  return (
    <MessengerLayout
      initialConversations={initialConversations}
      currentUserId={currentUserId}
      selectedConversationId={selectedConversationId}
      openMissionaryId={openMissionaryId}
      initialUserProfile={initialUserProfile}
      initialUnreadCount={initialUnreadCount}
    />
  );
}
