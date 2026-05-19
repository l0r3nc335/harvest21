"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendMessage, markConversationAsRead, reportMessage } from "@/app/messages/message-actions";
import toast from "react-hot-toast";
import type { Message, MessageWithSender } from "@/types/messaging";
import Image from "next/image";

interface MessageThreadProps {
  conversationId: number;
  initialMessages: MessageWithSender[];
  currentUserId: string;
  currentUserPhoto: string | null;
  recipientName: string;
  recipientPhoto: string | null;
}

export function MessageThread({
  conversationId,
  initialMessages,
  currentUserId,
  currentUserPhoto,
  recipientName,
  recipientPhoto,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    markConversationAsRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    console.log(`🔌 Setting up realtime for conversation ${conversationId} as user ${currentUserId}`);
    
    const channel = supabase
      .channel(`conversation:${conversationId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async (payload: { eventType: string; new: Message }) => {
          console.log("📨 Realtime event received (all messages):", payload.eventType, payload);
          
          const newMsg = payload.new;
          if (payload.eventType !== "INSERT" || newMsg.conversation_id !== conversationId) {
            console.log("⏭️ Skipping - wrong event type or conversation");
            return;
          }
          
          console.log("✅ Message is for this conversation, processing...");
          
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
            if (prev.some((m) => m.id === enrichedMessage.id)) {
              console.log("⚠️ Message already exists, skipping");
              return prev;
            }
            
            const optimisticMatch = prev.find(
              (m) => 
                m.is_current_user && 
                m.content === enrichedMessage.content &&
                Math.abs(new Date(m.created_at).getTime() - new Date(enrichedMessage.created_at).getTime()) < 5000
            );
            
            if (optimisticMatch) {
              console.log("🔄 Replacing optimistic message with real one");
              return prev.map((m) => 
                m.id === optimisticMatch.id ? enrichedMessage : m
              );
            }
            
            console.log("✅ Adding new message to thread");
            return [...prev, enrichedMessage];
          });

          if (newMsg.sender_id !== currentUserId) {
            markConversationAsRead(conversationId);
          }
        }
      )
      .subscribe((status: string) => {
        console.log(`🔌 Realtime subscription status: ${status}`);
      });

    return () => {
      console.log("🔌 Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = newMessage.trim();
    if (!content) return;

    if (content.length > 5000) {
      toast.error("Message too long (max 5000 characters)");
      return;
    }

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
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleReport = async (messageId?: number) => {
    const confirmed = confirm(
      messageId 
        ? "Report this message as inappropriate?" 
        : "Report this entire conversation?"
    );

    if (!confirmed) return;

    const result = await reportMessage({
      conversationId,
      messageId,
      reportType: messageId ? "message" : "conversation",
    });

    if (result.success) {
      toast.success("Report submitted. Thank you.");
    } else {
      toast.error(result.error || "Failed to submit report");
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <p className="text-lg">No messages yet</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_current_user ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex gap-3 max-w-[70%] ${
                  message.is_current_user ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div className="flex-shrink-0">
                  {message.is_current_user ? (
                    currentUserPhoto ? (
                      <div className="relative w-8 h-8 rounded-full overflow-hidden">
                        <Image
                          src={currentUserPhoto}
                          alt="You"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#E1B94D] flex items-center justify-center text-black text-sm font-semibold">
                        You
                      </div>
                    )
                  ) : recipientPhoto ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden">
                      <Image
                        src={recipientPhoto}
                        alt={recipientName}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-semibold">
                      {recipientName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      message.is_current_user
                        ? "bg-[#E1B94D] text-black"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                      message.is_current_user ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span>{formatTime(message.created_at)}</span>
                    {!message.is_current_user && (
                      <button
                        onClick={() => handleReport(message.id)}
                        className="hover:text-red-500 transition-colors"
                        title="Report this message"
                      >
                        Report
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-800 p-4">
        <form onSubmit={handleSend} className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#E1B94D] max-h-[150px]"
            rows={1}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-6 py-3 bg-[#E1B94D] text-black font-semibold rounded-lg hover:bg-[#d4a639] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">
            {newMessage.length}/5000 characters
          </p>
          <button
            onClick={() => handleReport()}
            className="text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            Report conversation
          </button>
        </div>
      </div>
    </div>
  );
}

