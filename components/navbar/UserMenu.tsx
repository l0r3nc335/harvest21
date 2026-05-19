"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Settings, LogOut, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
};

type UserMenuProps = {
  user: UserProfile;
  onLogout: () => void;
};

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showMyProfile = user.role !== 1 && user.role !== 2 && user.page_url;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex cursor-pointer items-center gap-2 rounded-full transition-all duration-200 ${
          isOpen 
            ? "ring-2 ring-[#FFD700]/50 scale-105" 
            : "hover:ring-2 hover:ring-[#FFD700]/30 hover:scale-105"
        }`}
      >
        {user.profile_photo_url ? (
          <Image
            src={user.profile_photo_url}
            alt={`${user.first_name} ${user.last_name}`}
            width={40}
            height={40}
            className="rounded-full object-cover ring-2 ring-white/20"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD700] to-[#E6B800] text-[#1A1A1A] font-semibold ring-2 ring-white/20 shadow-md">
            {user.first_name[0]}{user.last_name[0]}
          </div>
        )}
        <ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-fade-in">
          {/* User Profile Section */}
          <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
            <div className="flex items-center gap-3">
              {user.profile_photo_url ? (
                <Image
                  src={user.profile_photo_url}
                  alt={`${user.first_name} ${user.last_name}`}
                  width={48}
                  height={48}
                  className="rounded-full object-cover ring-2 ring-[#FFD700]/20"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD700] to-[#E6B800] text-[#1A1A1A] font-semibold text-lg ring-2 ring-[#FFD700]/20">
                  {user.first_name[0]}{user.last_name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-white truncate">
              {user.first_name} {user.last_name}
            </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            {showMyProfile && user.page_url && (
              <Link
                href={`/${user.page_url}`}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-zinc-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all duration-200 hover:scale-[1.02] group"
                onClick={() => setIsOpen(false)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white">My Profile</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">View your public page</div>
                </div>
              </Link>
            )}
            
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 hover:scale-[1.02] group"
              onClick={() => setIsOpen(false)}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/10 group-hover:bg-zinc-500/20 transition-colors shrink-0">
                <Settings className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 dark:text-white">Settings</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Manage your account</div>
              </div>
            </Link>

            <div className="border-t border-zinc-200 dark:border-zinc-800 my-2"></div>

            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm text-red-600 transition-all duration-200 hover:scale-[1.02] hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors shrink-0">
                <LogOut className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium text-red-600 dark:text-red-400">Sign Out</div>
                <div className="text-xs text-red-500/70 dark:text-red-400/70 truncate">Sign out of your account</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

