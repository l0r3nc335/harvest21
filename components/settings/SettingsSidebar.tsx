"use client";

import { useState } from "react";
import { Home, User, Users, DollarSign, Shield, MessageSquare, Menu, X, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type SidebarItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

type SettingsSidebarProps = {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  items?: SidebarItem[];
  onLogout?: () => void;
  /** Rendered on the far right of the mobile header bar (e.g. notification bell). */
  mobileRightSlot?: React.ReactNode;
};

const defaultSidebarItems: SidebarItem[] = [
  {
    id: "account",
    label: "Account",
    icon: <Home className="w-5 h-5" />,
  },
  {
    id: "page-details",
    label: "Page Details",
    icon: <User className="w-5 h-5" />,
  },
  {
    id: "followers",
    label: "Followers",
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: "donations",
    label: "Donations",
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: "security",
    label: "Security",
    icon: <Shield className="w-5 h-5" />,
  },
];

const iconMap: Record<string, React.ReactNode> = {
  account: <Home className="w-5 h-5" />,
  "page-details": <User className="w-5 h-5" />,
  followers: <Users className="w-5 h-5" />,
  donations: <DollarSign className="w-5 h-5" />,
  messages: <MessageSquare className="w-5 h-5" />,
  security: <Shield className="w-5 h-5" />,
  following: <Users className="w-5 h-5" />,
};

export function SettingsSidebar({ activeTab, onTabChange, items, onLogout, mobileRightSlot }: SettingsSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sidebarItems = items || defaultSidebarItems;
  const itemsWithIcons = sidebarItems.map(item => ({
    ...item,
    icon: item.icon || iconMap[item.id],
  }));

  const handleTabChange = (tabId: string) => {
    onTabChange(tabId);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800 p-3 sm:p-4 flex items-center justify-between">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex cursor-pointer items-center gap-2 text-white transition-colors touch-manipulation hover:text-yellow-500"
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>
        {mobileRightSlot != null && (
          <div className="flex items-center justify-end shrink-0">
            {mobileRightSlot}
          </div>
        )}
      </div>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out flex flex-col shrink-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Settings navigation"
      >
        <div className="p-4 sm:p-5 lg:p-6 shrink-0 border-b border-zinc-800">
          <Link 
            href="/" 
            className="block focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-zinc-900 rounded"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Image 
              src="/logo.svg" 
              alt="Harvest 21" 
              width={200} 
              height={100} 
              className="w-auto h-10 sm:h-12 lg:h-14"
              priority
            />
          </Link>
        </div>
        <nav 
          className="space-y-1 p-3 sm:p-4 lg:p-5 flex-1 overflow-y-auto overscroll-contain"
          aria-label="Settings tabs"
        >
          {itemsWithIcons.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              data-cy={`tab-${item.id}`}
              className={`w-full cursor-pointer flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                activeTab === item.id
                  ? "bg-yellow-500 text-black font-medium shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700"
              }`}
              aria-current={activeTab === item.id ? "page" : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
        {onLogout && (
          <div className="p-3 sm:p-4 lg:p-5 border-t border-zinc-800 shrink-0">
            <button
              onClick={handleLogout}
              className="w-full cursor-pointer flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base touch-manipulation focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20"
            >
              <span className="shrink-0">
                <LogOut className="w-5 h-5" />
              </span>
              <span className="truncate">Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

