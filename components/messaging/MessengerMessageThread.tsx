"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendMessage, markConversationAsRead, reportMessage } from "@/app/messages/message-actions";
import toast from "react-hot-toast";
import type { Message, MessageWithSender } from "@/types/messaging";
import { Send, Smile } from "lucide-react";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { HighlightedMessageContent } from "./HighlightedMessageContent";

interface MessengerMessageThreadProps {
  conversationId: number;
  initialMessages: MessageWithSender[];
  currentUserId: string;
  currentUserPhoto: string | null;
  recipientName: string;
  recipientPhoto: string | null;
  highlightTargetId?: number | null;
  highlightKeyword?: string | null;
  scrollTrigger?: number;
}

export function MessengerMessageThread({
  conversationId,
  initialMessages,
  currentUserId,
  currentUserPhoto,
  recipientName,
  recipientPhoto,
  highlightTargetId = null,
  highlightKeyword = null,
  scrollTrigger = 0,
}: MessengerMessageThreadProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [reportModal, setReportModal] = useState<{ messageId?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevConversationId = useRef(conversationId);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const setMessageRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) messageRefs.current.set(id, el);
    else messageRefs.current.delete(id);
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const skipAutoScrollRef = useRef(false);

  useEffect(() => {
    if (highlightTargetId == null) return;
    skipAutoScrollRef.current = true;
    const timer = setTimeout(() => {
      const el = messageRefs.current.get(highlightTargetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightTargetId, scrollTrigger]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (prevConversationId.current !== conversationId) {
      setMessages(initialMessages);
      prevConversationId.current = conversationId;
    } else {
      setMessages(initialMessages);
    }
  }, [conversationId, initialMessages]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    markConversationAsRead(conversationId);
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async (payload: { eventType: string; new: Message }) => {
          const newMsg = payload.new;
          if (payload.eventType !== "INSERT" || newMsg.conversation_id !== conversationId) {
            return;
          }

          const { data: sender } = await supabase
            .from("users")
            .select("first_name, last_name")
            .eq("user_id", newMsg.sender_id)
            .single();

          const enrichedMessage: MessageWithSender = {
            ...newMsg,
            sender_first_name: sender?.first_name || "",
            sender_last_name: sender?.last_name || "",
            sender_name: sender ? `${sender.first_name} ${sender.last_name}` : "Unknown",
            is_current_user: newMsg.sender_id === currentUserId,
          };

          setMessages((prev) => {
            // Check if message already exists
            if (prev.some((m) => m.id === enrichedMessage.id)) {
              return prev;
            }
            
            // If it's from current user, look for optimistic message to replace
            if (newMsg.sender_id === currentUserId) {
              const optimisticIndex = prev.findIndex(
                (m) =>
                  m.is_current_user &&
                  m.content === enrichedMessage.content &&
                  Math.abs(new Date(m.created_at).getTime() - new Date(enrichedMessage.created_at).getTime()) < 5000
              );
              
              if (optimisticIndex !== -1) {
                // Replace optimistic message with real one
                const updated = [...prev];
                updated[optimisticIndex] = enrichedMessage;
                return updated;
              }
            }
            
            return [...prev, enrichedMessage];
          });

          if (newMsg.sender_id !== currentUserId) {
            markConversationAsRead(conversationId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = newMessage.trim();
    if (!content || isSending) return;

    if (content.length > 5000) {
      toast.error("Message too long (max 5000 characters)");
      return;
    }

    setIsSending(true);
    const optimisticMessage: MessageWithSender = {
      id: Date.now(),
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender_first_name: "",
      sender_last_name: "",
      sender_name: "You",
      is_current_user: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const result = await sendMessage({
        conversationId,
        content,
      });

      if (!result.success) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        toast.error(result.error || "Failed to send message");
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const openReportModal = (messageId?: number) => {
    setReportModal({ messageId });
  };

  const handleReportConfirm = async () => {
    if (!reportModal) return;
    const { messageId } = reportModal;

    const result = await reportMessage({
      conversationId,
      messageId,
      reportType: messageId ? "message" : "conversation",
    });

    if (result.success) {
      toast.success("Report submitted. Thank you.");
      setReportModal(null);
    } else {
      toast.error(result.error || "Failed to submit report");
      throw new Error(result.error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // Group messages by date and consecutive sender
  const groupedMessages: Array<{
    date: string;
    messages: Array<{
      messages: MessageWithSender[];
      sender: "me" | "them";
    }>;
  }> = [];

  let currentDate = "";
  let currentGroup: MessageWithSender[] = [];
  let currentSender: "me" | "them" | null = null;

  messages.forEach((message, index) => {
    const messageDate = formatDate(message.created_at);
    const sender = message.is_current_user ? "me" : "them";

    // New date separator
    if (messageDate !== currentDate) {
      if (currentGroup.length > 0) {
        const lastDateGroup = groupedMessages[groupedMessages.length - 1];
        if (lastDateGroup) {
          lastDateGroup.messages.push({
            messages: currentGroup,
            sender: currentSender!,
          });
        }
      }

      groupedMessages.push({
        date: messageDate,
        messages: [],
      });
      currentDate = messageDate;
      currentGroup = [message];
      currentSender = sender;
    }
    // Same sender, group together
    else if (sender === currentSender) {
      currentGroup.push(message);
    }
    // Different sender, start new group
    else {
      groupedMessages[groupedMessages.length - 1].messages.push({
        messages: currentGroup,
        sender: currentSender!,
      });
      currentGroup = [message];
      currentSender = sender;
    }

    // Last message
    if (index === messages.length - 1) {
      groupedMessages[groupedMessages.length - 1].messages.push({
        messages: currentGroup,
        sender: currentSender!,
      });
    }
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
              <MissionaryProfileImage
                src={recipientPhoto}
                alt={recipientName}
                width={64}
                height={64}
                className="rounded-full"
              />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">
              {recipientName}
            </h3>
            <p className="text-sm text-zinc-500">
              Start the conversation with {recipientName.split(" ")[0]}
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((dateGroup, dateIndex) => (
              <div key={dateIndex}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="px-3 py-1 bg-zinc-100 rounded-full">
                    <span className="text-xs font-medium text-zinc-600">
                      {dateGroup.date}
                    </span>
                  </div>
                </div>

                {/* Message Groups */}
                {dateGroup.messages.map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    className={`flex gap-2 mb-2 ${
                      group.sender === "me" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Avatar for recipient (them) - left side */}
                    {group.sender === "them" && (
                      <div className="shrink-0 self-end mb-1">
                        <div className="relative w-7 h-7 rounded-full overflow-hidden">
                          <MissionaryProfileImage
                            src={recipientPhoto}
                            alt={recipientName}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}

                    {/* Message Bubbles */}
                    <div className={`flex flex-col gap-0.5 max-w-[70%] ${group.sender === "me" ? "items-end" : "items-start"}`}>
                      {group.messages.map((message, msgIndex) => {
                        const isBubbleHighlighted = highlightTargetId === message.id;
                        return (
                        <div
                          key={message.id}
                          ref={(el) => setMessageRef(message.id, el)}
                          className={`flex flex-col ${group.sender === "me" ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`px-4 py-2 rounded-2xl w-fit transition-all duration-500 ${
                              group.sender === "me"
                                ? "bg-[#D3AF37] text-black"
                                : "bg-zinc-100 text-zinc-900"
                            } ${
                              msgIndex === 0 && group.sender === "them"
                                ? "rounded-tl-sm"
                                : msgIndex === 0 && group.sender === "me"
                                ? "rounded-tr-sm"
                                : ""
                            } ${
                              isBubbleHighlighted
                                ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-200/50"
                                : ""
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              <HighlightedMessageContent
                                content={message.content}
                                highlightKeyword={highlightKeyword}
                              />
                            </p>
                          </div>
                          {/* Show timestamp on last message of group */}
                          {msgIndex === group.messages.length - 1 && (
                            <div
                              className={`flex items-center gap-2 mt-1 px-2 text-xs text-zinc-400 ${
                                group.sender === "me" ? "justify-end" : "justify-start"
                              }`}
                            >
                              <span>{formatTime(message.created_at)}</span>
                              {group.sender === "them" && typeof message.id === "number" && message.id < 1e12 && (
                                <button
                                  onClick={() => openReportModal(message.id)}
                                  className="cursor-pointer hover:text-red-500 transition-colors"
                                  title="Report this message"
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    {/* Avatar for current user (me) - right side */}
                    {group.sender === "me" && (
                      <div className="shrink-0 self-end mb-1">
                        <div className="relative w-7 h-7 rounded-full overflow-hidden">
                          <MissionaryProfileImage
                            src={currentUserPhoto}
                            alt="You"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-200 p-4">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="flex-1 bg-zinc-100 rounded-full px-4 py-2 flex items-center gap-2">
            <button
              type="button"
              className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-700"
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-zinc-900 placeholder-zinc-500 max-h-[120px]"
              rows={1}
              disabled={isSending}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="shrink-0 rounded-full bg-[#D3AF37] p-3 text-black transition-colors hover:bg-[#E1B94D] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="flex justify-between items-center mt-2 px-1">
          <p className="text-xs text-zinc-400">
            {newMessage.length}/5000 characters
          </p>
          <button
            onClick={() => openReportModal()}
            className="text-xs text-zinc-400 cursor-pointer hover:text-red-500 transition-colors"
          >
            Report conversation
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={reportModal !== null}
        onClose={() => setReportModal(null)}
        onConfirm={handleReportConfirm}
        title="Report"
        message={
          reportModal?.messageId
            ? "Report this message as inappropriate?"
            : "Report this entire conversation?"
        }
        confirmText="Report"
        cancelText="Cancel"
        variant="danger"
        loadingText="Submitting report..."
      />
    </div>
  );
}

