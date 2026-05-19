"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { updateMissionaryDMSettings } from "@/app/messages/message-actions";
import { ConversationList } from "@/components/messaging/ConversationList";
import { getConversations } from "@/app/messages/message-actions";
import toast from "react-hot-toast";
import type { ConversationWithDetails } from "@/types/messaging";
import { MessagesConversationsSkeleton } from "@/components/settings/settings-tab-skeletons";

interface MessagesSettingsTabProps {
  missionaryId: number;
  currentUserId: string;
  allowDirectMessages: boolean;
}

export function MessagesSettingsTab({
  missionaryId,
  currentUserId,
  allowDirectMessages: initialAllowDM,
}: MessagesSettingsTabProps) {
  const [allowDirectMessages, setAllowDirectMessages] = useState(initialAllowDM);
  const [isSaving, setIsSaving] = useState(false);
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
    }
    setIsLoadingConversations(false);
  };

  const handleToggleDM = async () => {
    const newValue = !allowDirectMessages;
    setIsSaving(true);

    try {
      const result = await updateMissionaryDMSettings(newValue);
      if (result.success) {
        setAllowDirectMessages(newValue);
        toast.success(
          newValue
            ? "Direct messaging enabled"
            : "Direct messaging disabled"
        );
      } else {
        toast.error(result.error || "Failed to update settings");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 border border-zinc-200">
        <h2 className="text-xl font-semibold text-zinc-900 mb-4">
          Direct Message Settings
        </h2>
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-medium text-zinc-900 mb-2">
              Allow Direct Messages from Followers
            </h3>
            <p className="text-sm text-zinc-600">
              When enabled, accepted followers can send you private messages. 
              You can disable this at any time to take a break or set boundaries.
            </p>
          </div>
          
          <Button
            onClick={handleToggleDM}
            disabled={isSaving}
            variant={allowDirectMessages ? "primary" : "secondary"}
            className="min-w-[100px]"
          >
            {isSaving ? "..." : allowDirectMessages ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {!allowDirectMessages && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Direct messaging is currently disabled.</strong> Your followers 
              cannot send you new messages. Existing conversations are read-only for them.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900">
            Your Conversations
          </h2>
          <p className="text-sm text-zinc-600 mt-1">
            Manage your direct message conversations with supporters
          </p>
        </div>

        {isLoadingConversations ? (
          <MessagesConversationsSkeleton />
        ) : (
          <ConversationList
            initialConversations={conversations}
            currentUserId={currentUserId}
            theme="light"
          />
        )}
      </div>
    </div>
  );
}

