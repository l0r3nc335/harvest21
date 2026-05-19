"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { User, Users, Shield } from "lucide-react";
import { AdminAccountTab } from "./AdminAccountTab";
import { AdminSecurityTab } from "./AdminSecurityTab";
import { FollowingTab } from "@/components/supporter/FollowingTab";

type UserData = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number;
};

type TabType = "account" | "following" | "security";

type AdminSettingsClientProps = {
  user: UserData;
};

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User className="w-5 h-5" /> },
  { id: "following", label: "Following", icon: <Users className="w-5 h-5" /> },
  { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
];

export function AdminSettingsClient({ user }: AdminSettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("account");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["account", "following", "security"].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  const setTab = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <div className="flex gap-1 border-b border-zinc-200 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[#D3AF37] text-[#D3AF37]"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "account" && <AdminAccountTab user={user} />}
        {activeTab === "following" && <FollowingTab variant="light" />}
        {activeTab === "security" && <AdminSecurityTab />}
      </div>
    </div>
  );
}

