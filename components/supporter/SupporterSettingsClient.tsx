"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Users, Shield, MessageSquare, CreditCard } from "lucide-react";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { SupporterProfileTab } from "./SupporterProfileTab";
import { FollowingTab } from "./FollowingTab";
import { SupporterMessagesTab } from "./SupporterMessagesTab";
import { SupporterDonationsTab } from "./SupporterDonationsTab";
import { MissionarySecurityTab } from "@/components/settings/MissionarySecurityTab";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";
import type { SupporterProfile } from "@/types/supporter";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

type TabType = "account" | "following" | "messages" | "donations" | "security";

interface SupporterSettingsClientProps {
  profile: SupporterProfile;
  initialTab?: string;
  initialUnreadCount?: number;
}

export function SupporterSettingsClient({ profile, initialTab = "account", initialUnreadCount = 0 }: SupporterSettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || "account");
  
  // Sync activeTab with URL parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["account", "following", "messages", "donations", "security"].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to log out");
    }
  };

  return (
    <div className="flex min-h-screen bg-black overflow-hidden">
      <SettingsSidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => setActiveTab(tab as TabType)} 
        onLogout={handleLogout}
        mobileRightSlot={<NotificationDropdown unreadCount={initialUnreadCount} variant="mobile" />}
        items={[
          { id: "account", label: "Account", icon: <User className="w-5 h-5" /> },
          { id: "following", label: "Following", icon: <Users className="w-5 h-5" /> },
          { id: "messages", label: "Messages", icon: <MessageSquare className="w-5 h-5" /> },
          { id: "donations", label: "Donations", icon: <CreditCard className="w-5 h-5" /> },
          { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
        ]} 
      />

      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 mt-12 lg:mt-0 lg:ml-64 lg:pt-6 overflow-y-auto h-screen">
        <div className="hidden lg:flex flex-row items-center justify-end w-full">
          <NotificationDropdown unreadCount={initialUnreadCount} variant="desktop" />
        </div>
        <div className="w-auto">
          {activeTab === "account" && <SupporterProfileTab initialProfile={profile} />}
          {activeTab === "following" && <FollowingTab />}
          {activeTab === "messages" && <SupporterMessagesTab currentUserId={profile.user_id} />}
          {activeTab === "donations" && <SupporterDonationsTab />}
          {activeTab === "security" && <MissionarySecurityTab />}
        </div>
      </div>
    </div>
  );
}

