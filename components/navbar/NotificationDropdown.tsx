"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, Check } from "lucide-react";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/notificationHelpers";
import { supabase } from "@/lib/supabaseClient";
import type { Notification } from "@/types/follow";
import toast from "react-hot-toast";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'just now';
}

interface NotificationDropdownProps {
  unreadCount: number;
  onCountChange?: (count: number) => void;
  variant?: "desktop" | "mobile";
}

export function NotificationDropdown({ unreadCount: initialUnreadCount, onCountChange, variant = "desktop" }: NotificationDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const hasLoadedRef = useRef(false);

  // Initialize count from props and fetch fresh count immediately
  // Helper function to refresh notification count (using client-side for speed)
  const refreshCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      const newCount = count || 0;
      setUnreadCount(newCount);
      onCountChange?.(newCount);
      return newCount;
    } catch (error) {
      console.error("Error refreshing notification count:", error);
      return 0;
    }
  };

  // Initialize count from props and fetch fresh count immediately
  useEffect(() => {
    setUnreadCount(initialUnreadCount);
    // Fetch fresh count on mount
    refreshCount();
  }, [initialUnreadCount]);

  // Update ref when isOpen changes
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      // First time opening - show loader and fetch
      loadNotifications(true);
      hasLoadedRef.current = true;
    } else if (!isOpen) {
      // Reset when dropdown closes
      hasLoadedRef.current = false;
    }
  }, [isOpen]);

  // Real-time subscription to check for new notifications
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    async function setupRealtimeSubscription() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to notifications table changes for this user
      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to INSERT, UPDATE, DELETE
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload: { eventType: string; new?: any; old?: any }) => {
            console.log("🔔 Notification change detected:", payload.eventType);
            
            // Refresh notification count immediately
            await refreshCount();

            // If dropdown is open, reload notifications silently (no loader)
            if (isOpenRef.current) {
              loadNotifications(false);
            }
          }
        )
        .subscribe((status: string) => {
          console.log("🔔 Notifications realtime subscription status:", status);
        });

      // Also poll periodically as a fallback (every 5 seconds for faster updates)
      pollInterval = setInterval(async () => {
        await refreshCount();
        // Reload list if dropdown is open (silently, no loader)
        if (isOpenRef.current) {
          loadNotifications(false);
        }
      }, 15000); // Poll every 5 seconds for faster updates
    }

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []); // Empty deps - only setup once on mount

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const loadNotifications = async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true);
    }
    const result = await getUserNotifications(20);
    if (result.success && result.data) {
      setNotifications(result.data);
      const unread = result.data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
      onCountChange?.(unread);
    }
    if (showLoader) {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    const result = await markNotificationAsRead(notificationId);
    if (result.success) {
      await loadNotifications(false);
      await refreshCount();
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsRead();
    if (result.success) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      onCountChange?.(0);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "follow_request":
      case "missionary_follow_request":
        return "👤";
      case "follow_accepted":
      case "missionary_follow_accepted":
        return "✅";
      case "follow_rejected":
      case "missionary_follow_rejected":
        return "❌";
      case "message":
      case "direct_message":
        return "💬";
      case "donation_received":
        return "💰";
      case "recurring_donation_cancelled":
        return "🚫";
      case "missionary_update_letter":
        return "📄";
      case "missionary_photo":
        return "📷";
      case "missionary_video":
        return "🎥";
      case "missionary_prayer":
        return "🙏";
      case "missionary_text_update":
        return "✏️";
      case "message_report":
        return "🚨";
      default:
        return "🔔";
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if ((notification.type === "message" || notification.type === "direct_message") && notification.related_entity_id) {
      return `/messages/${notification.related_entity_id}`;
    }

    if (notification.type === "message_report") {
      return "/admin/message-reports";
    }
    
    // Follow request notifications (for the missionary being followed) → Followers tab
    if (notification.type === "follow_request") {
      return "/settings?tab=followers";
    }
    
    // Missionary follow request (missionary wants to follow this missionary) → Followers tab
    if (notification.type === "missionary_follow_request") {
      return "/settings?tab=followers";
    }
    
    // Follow accepted/rejected notifications (for the follower) → Following tab
    if (notification.type === "follow_accepted" || notification.type === "follow_rejected") {
      return "/settings?tab=following";
    }
    
    // Missionary follow accepted/rejected (for the missionary follower) → Following tab
    if (notification.type === "missionary_follow_accepted" || notification.type === "missionary_follow_rejected") {
      return "/settings?tab=following";
    }
    
    // Other follow-related notifications
    if (notification.type.startsWith("follow_") && notification.related_entity_type === "missionary") {
      return "/settings?tab=followers";
    }

    if (notification.type === "donation_received" || notification.type === "recurring_donation_cancelled") {
      return "/settings?tab=donations";
    }
    
    if (notification.type.startsWith("missionary_") && notification.page_url) {
      const meta = notification.content_metadata;
      if (meta?.tab && meta?.focus) {
        const q = new URLSearchParams();
        q.set("tab", meta.tab);
        q.set("focus", meta.focus);
        return `/${notification.page_url}?${q.toString()}`;
      }
      const contentType = notification.type.replace("missionary_", "");
      let tab = "";
      switch (contentType) {
        case "update_letter":
          tab = "update-letters";
          break;
        case "photo":
          tab = "photos";
          break;
        case "video":
          tab = "videos";
          break;
        case "prayer":
          tab = "prayer-wall";
          break;
        case "text_update":
          tab = "about";
          break;
        default:
          return `/${notification.page_url}`;
      }
      return `/${notification.page_url}?tab=${tab}`;
    }
    
    return null;
  };

  const getNotificationDisplay = (notification: Notification) => {
    if (notification.type === "direct_message") {
      const messageMatch = notification.message.match(/^(.+?) sent you a message$/);
      if (messageMatch) {
        const senderName = messageMatch[1];
        return {
          title: "New Message",
          message: `${senderName} sent you a message`,
        };
      }
    }
    return {
      title: notification.title,
      message: notification.message,
    };
  };

  const buttonContent = variant === "mobile" ? (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="relative flex cursor-pointer items-center justify-center p-2 text-white hover:text-brand-light-yellow transition-colors"
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  ) : (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="relative cursor-pointer p-2 text-brand-light-yellow hover:text-brand-light-yellow/80 transition-colors"
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {buttonContent}

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg shadow-xl z-50 max-h-[500px] flex flex-col"
          data-notification-dropdown-open
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2C2C2C]">
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="cursor-pointer text-xs text-brand-light-yellow hover:text-brand-light-yellow/80 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-light-yellow mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2C2C2C]">
                {notifications.map((notification) => {
                  const link = getNotificationLink(notification);
                  const display = getNotificationDisplay(notification);
                  
                  const handleNotificationClick = () => {
                    if (!notification.is_read) {
                      handleMarkAsRead(notification.id);
                    }
                    if (link) {
                      setIsOpen(false);
                      router.push(link);
                    }
                  };

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 transition-colors ${
                        link ? "cursor-pointer hover:bg-[#2C2C2C]" : ""
                      } ${!notification.is_read ? "bg-[#2C2C2C]/30" : ""}`}
                      onClick={handleNotificationClick}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white mb-1">
                            {display.title}
                          </p>
                          <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                            {display.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(new Date(notification.created_at))}
                            </span>
                            {!notification.is_read && (
                              <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification.id);
                                  }}
                                  className="flex cursor-pointer items-center gap-1 text-xs text-brand-light-yellow hover:text-brand-light-yellow/80"
                                >
                                  <Check className="h-3 w-3" />
                                  Mark read
                                </button>
                              )}
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-[#2C2C2C] text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  loadNotifications(false);
                }}
                className="cursor-pointer text-sm text-brand-light-yellow hover:text-brand-light-yellow/80 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

