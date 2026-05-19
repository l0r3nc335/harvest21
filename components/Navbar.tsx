"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Bell, Search, Menu, X, Settings, LogOut, User, Plus, FileText, Image as ImageIcon, Video, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoginModal } from "@/components/auth/LoginModal";
import { ContentMenu } from "@/components/navbar/ContentMenu";
import { UserMenu } from "@/components/navbar/UserMenu";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";
import { UpdateLetterUploadModal } from "@/components/update-letter/UpdateLetterUploadModal";
import { PhotoUploadModal } from "@/components/photo/PhotoUploadModal";
import { VideoUploadModal } from "@/components/video/VideoUploadModal";
import { PrayerForm } from "@/components/prayer/PrayerForm";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";
import { createPrayer, type PrayerFormData } from "@/lib/prayerActions";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { globalSearch } from "@/lib/search/globalSearch";
import { GlobalSearchResults } from "@/components/search/GlobalSearchResults";
import type { GlobalSearchResponse } from "@/types/search";

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
};

type NavbarProps = {
  initialUserProfile?: UserProfile | null;
  readOnly?: boolean;
  initialUnreadCount?: number;
};

const RESERVED_PATHS = new Set(["admin", "settings", "login", "api", "auth", "missionaries", "donate", ""]);

export function Navbar({ initialUserProfile = null, readOnly = false, initialUnreadCount = 0 }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialUserProfile);
  const [pageId, setPageId] = useState<number | null>(null);
  const [isLoadingPageId, setIsLoadingPageId] = useState(false);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [prayerPostFb, setPrayerPostFb] = useState(false);
  const [prayerPostIg, setPrayerPostIg] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/user-profile', {
        cache: 'no-store',
      });
      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
        return true;
      } else {
        setUserProfile(null);
        return false;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
      return false;
    }
  }, []);

  useEffect(() => {
    setUserProfile(initialUserProfile);
  }, [initialUserProfile]);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedSearchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const results = await globalSearch(debouncedSearchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults(null);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults(null);
      }
    };

    performSearch();
  }, [debouncedSearchQuery]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await fetchUserProfile();
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        try {
          await fetch("/api/auth/signout", {
            method: "POST",
            credentials: "same-origin",
          });
        } catch {
          /* ignore */
        }
        setUserProfile(null);
        setUnreadCount(0);
        setPageId(null);
        router.refresh();
      }
    });

    const handleLoginSuccess = async () => {
      setIsLoginModalOpen(false);
      await fetchUserProfile();
      router.refresh();
    };

    window.addEventListener('user-logged-in', handleLoginSuccess);

    if (!initialUserProfile) {
      fetchUserProfile();
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('user-logged-in', handleLoginSuccess);
    };
  }, [router, initialUserProfile, fetchUserProfile]);

  const userId = userProfile?.id;

  useEffect(() => {
    const fetchPageId = async () => {
      if (!userId) {
        setPageId(null);
        return;
      }
      
      setIsLoadingPageId(true);
      try {
        const response = await fetch("/api/get-page-id");
        if (!response.ok) {
          setPageId(null);
          return;
        }
        const data = await response.json();
        setPageId(data?.pageId || null);
      } catch (error) {
        console.error("Error fetching page ID:", error);
        setPageId(null);
      } finally {
        setIsLoadingPageId(false);
      }
    };

    fetchPageId();
  }, [userId]);

  const performLogout = useCallback(async () => {
    setUserProfile(null);
    setUnreadCount(0);
    setPageId(null);
    const response = await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!response.ok) console.warn("Server signout returned error");
    await supabase.auth.signOut();
  }, []);

  // On home page with ?logout=1: perform logout then remove param (used after redirect-from-unpublished)
  useEffect(() => {
    if (typeof window === "undefined" || pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") !== "1") return;
    const run = async () => {
      await performLogout();
      window.history.replaceState({}, "", "/");
    };
    run();
  }, [pathname, performLogout]);

  const handleLogout = async () => {
    const toastId = toast.loading("Signing out...");

    try {
      // If on a public-page-like path (single segment), redirect first immediately so we don't wait for API; logout on home.
      const segment = pathname?.replace(/^\/+|\/+$/g, "") || "";
      const singleSegment = segment && !segment.includes("/") && !RESERVED_PATHS.has(segment);
      if (singleSegment) {
        toast.success("Signing out...", { id: toastId });
        window.location.href = "/?logout=1";
        return;
      }

      await performLogout();
      toast.success("Successfully signed out!", { id: toastId });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to sign out. Please try again.", { id: toastId });
      await fetchUserProfile();
    }
  };

  const handleOpenLetter = () => {
    setIsMobileMenuOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setIsLetterModalOpen(true);
  };

  const handleOpenPhoto = () => {
    setIsMobileMenuOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setIsPhotoModalOpen(true);
  };

  const handleOpenVideo = () => {
    setIsMobileMenuOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setIsVideoModalOpen(true);
  };

  const handleOpenPrayer = () => {
    setIsMobileMenuOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setPrayerPostFb(false);
    setPrayerPostIg(false);
    setIsPrayerModalOpen(true);
  };

  const handlePrayerSubmit = async (formData: PrayerFormData) => {
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }

    const result = await createPrayer(pageId, formData, {
      postToFacebook: prayerPostFb,
      postToInstagram: prayerPostIg,
    });
    if (result.success) {
      toast.success("Prayer request posted successfully!");
      setIsPrayerModalOpen(false);
      setPrayerPostFb(false);
      setPrayerPostIg(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("content-updated"));
      }
      router.refresh();
    } else {
      toast.error(result.error || "Failed to post prayer request");
    }
  };


  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#000000] border-b border-[#000000]">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src="/logo.svg"
                alt="Harvest Logo"
                width={157}
                height={30}
                priority
                className="h-6 w-auto sm:h-8"
              />
            </Link>

              <div className="hidden md:flex items-center flex-1 max-w-md">
                <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search missionaries, agencies, churches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full bg-[#2C2C2C] pl-4 pr-12 py-3 text-sm text-white placeholder:text-[#808080] outline-none focus:ring-2 focus:ring-brand-yellow/50 transition-all"
                />
                <button 
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-light-yellow transition-all hover:brightness-90"
                  onClick={() => {
                    if (searchQuery.trim()) {
                      globalSearch(searchQuery).then(setSearchResults);
                    }
                  }}
                >
                  <Search className="h-4 w-4 text-[#1A1A1A]" />
                </button>
                
                {(searchResults !== null || isSearching) && (
                  <GlobalSearchResults
                    results={searchResults || { agencies: [], missionaries: [], churches: [], total: 0 }}
                    query={searchQuery}
                    isLoading={isSearching}
                    onClose={() => {
                      setSearchResults(null);
                      setSearchQuery("");
                    }}
                  />
                )}
              </div>
            </div>

              <div className="flex md:hidden items-center flex-1 min-w-0">
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full bg-[#2C2C2C] pl-3 pr-10 py-2 text-xs sm:text-sm text-white placeholder:text-[#808080] outline-none focus:ring-2 focus:ring-brand-yellow/50 transition-all"
                  />
                  <button 
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-light-yellow transition-all hover:brightness-90 sm:h-8 sm:w-8"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        globalSearch(searchQuery).then(setSearchResults);
                      }
                    }}
                  >
                    <Search className="h-3 w-3 sm:h-4 sm:w-4 text-[#1A1A1A]" />
                  </button>
                  
                  {(searchResults !== null || isSearching) && (
                    <GlobalSearchResults
                      results={searchResults || { agencies: [], missionaries: [], churches: [], total: 0 }}
                      query={searchQuery}
                      isLoading={isSearching}
                      onClose={() => {
                        setSearchResults(null);
                        setSearchQuery("");
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 shrink-0">
              {!readOnly && userProfile ? (
                <>
                  {/* Show Upload button only for Missionaries (role 3) */}
                  {userProfile.role === 3 && (
                    <>
                      <ContentMenu pageId={pageId} isLoadingPageId={isLoadingPageId} />
                    </>
                  )}

                  <NotificationDropdown 
                    unreadCount={unreadCount} 
                    onCountChange={setUnreadCount}
                  />

                  <UserMenu user={userProfile} onLogout={handleLogout} />
                </>
              ) : !readOnly ? (
                <>
                  <Link href="/signup">
                    <Button
                      variant="primary"
                      className="rounded-sm bg-brand-light-yellow px-6 py-2.5 text-sm font-medium text-black hover:brightness-90 focus:ring-2 focus:ring-brand-yellow/50"
                    >
                      Sign Up
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="rounded-sm border border-brand-light-yellow bg-[#000000] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1A1A1A] focus:ring-2 focus:ring-brand-yellow/50"
                  >
                    Log In
                  </Button>
                </>
              ) : null}
            </div>

            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-brand-light-yellow hover:text-brand-light-yellow/80 transition-colors"
                aria-label="Menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <>
        <div 
          className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden ${
            isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        <div
          className={`
            fixed top-0 right-0 h-full bg-[#000000] border-l border-[#2C2C2C] shadow-xl z-50
            w-[85%] sm:w-[400px]
            transition-transform duration-300 ease-in-out
            overflow-y-auto
            md:hidden
            ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}
          `}
        >
          <div className="sticky top-0 bg-[#000000] border-b border-[#2C2C2C] px-4 py-4 flex items-center justify-end z-10">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1 rounded hover:bg-[#1A1A1A] text-brand-light-yellow hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
                </button>
              </div>

          <div className="p-4 space-y-4">
              {!readOnly && userProfile ? (
              <>
                <div className="border-b border-[#2C2C2C] pb-4">
                  <div className="flex items-center gap-3">
                    {userProfile.profile_photo_url ? (
                      <Image
                        src={userProfile.profile_photo_url}
                        alt={`${userProfile.first_name} ${userProfile.last_name}`}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFD700] text-[#1A1A1A] font-medium text-lg">
                        {userProfile.first_name[0]}{userProfile.last_name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {userProfile.first_name} {userProfile.last_name}
                      </p>
                      <p className="text-sm text-[#808080] truncate">{userProfile.email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {userProfile.role !== 1 && userProfile.role !== 2 && (
                    <Link 
                      href={`/${userProfile.page_url}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-md text-white hover:bg-[#1A1A1A] transition-colors"
                    >
                      <User className="h-5 w-5" />
                      <span className="text-sm font-medium">My Profile</span>
                    </Link>
                  )}

                  <NotificationDropdown 
                    unreadCount={unreadCount} 
                    onCountChange={setUnreadCount}
                    variant="mobile"
                  />

                  <Link
                    href="/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-white hover:bg-[#1A1A1A] transition-colors"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>

                  {/* Show Upload section only for Missionaries (role 3) */}
                  {userProfile.role === 3 && (
                    <div className="border-t border-[#2C2C2C] pt-4 mt-4">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 px-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFD700]/10">
                            <Plus className="h-4 w-4 text-[#FFD700]" />
                          </div>
                          <span className="text-sm font-semibold text-white">Upload Content</span>
                        </div>
                        <p className="text-xs text-[#808080] px-4 mt-1">Share updates with your supporters</p>
                      </div>
                      <div className="space-y-1">
                        <button
                          onClick={handleOpenLetter}
                          disabled={isLoadingPageId || !pageId}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] group"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                            <FileText className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">Update Letter</div>
                            <div className="text-xs text-[#808080]">Share written updates</div>
                          </div>
                        </button>
                        <button
                          onClick={handleOpenPhoto}
                          disabled={isLoadingPageId || !pageId}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] group"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                            <ImageIcon className="h-5 w-5 text-purple-400" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">Photos</div>
                            <div className="text-xs text-[#808080]">Upload photo galleries</div>
                          </div>
                        </button>
                        <button
                          onClick={handleOpenVideo}
                          disabled={isLoadingPageId || !pageId}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] group"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                            <Video className="h-5 w-5 text-red-400" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">Videos</div>
                            <div className="text-xs text-[#808080]">Share video content</div>
                          </div>
                        </button>
                        <button
                          onClick={handleOpenPrayer}
                          disabled={isLoadingPageId || !pageId}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] group"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                            <Heart className="h-5 w-5 text-pink-400" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">Prayer Request</div>
                            <div className="text-xs text-[#808080]">Request prayer support</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-[#2C2C2C] pt-3 mt-3">
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-md bg-red-600 px-4 py-3 text-white transition-colors hover:bg-red-700"
                  >
                      <LogOut className="h-5 w-5" />
                      <span className="text-sm font-medium">Sign Out</span>
                  </button>
                  </div>
                </div>
              </>
              ) : !readOnly ? (
              <div className="space-y-3 pt-4">
                  <Link 
                    href="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block"
                  >
                    <Button
                      variant="primary"
                      className="w-full rounded-sm bg-brand-light-yellow px-6 py-3 text-sm font-medium text-black hover:brightness-90"
                    >
                      Sign Up
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsLoginModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full rounded-sm border border-brand-light-yellow bg-[#000000] px-6 py-3 text-sm font-medium text-white hover:bg-[#1A1A1A]"
                  >
                    Log In
                  </Button>
                </div>
              ) : null}
          </div>
        </div>
      </>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />

      {pageId && (
        <>
          <UpdateLetterUploadModal
            isOpen={isLetterModalOpen}
            onClose={() => setIsLetterModalOpen(false)}
            pageId={pageId}
            onSuccess={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("content-updated"));
              }
              router.refresh();
            }}
          />

          <PhotoUploadModal
            isOpen={isPhotoModalOpen}
            onClose={() => setIsPhotoModalOpen(false)}
            pageId={pageId}
            onSuccess={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("content-updated"));
              }
              router.refresh();
            }}
          />

          <VideoUploadModal
            isOpen={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
            pageId={pageId}
            onSuccess={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("content-updated"));
              }
              router.refresh();
            }}
          />

          <PrayerForm
            isOpen={isPrayerModalOpen}
            onClose={() => setIsPrayerModalOpen(false)}
            onSubmit={handlePrayerSubmit}
            footerSlot={
              <SocialCrossPostCheckboxes
                pageId={pageId}
                contentMode="text-only"
                postToFacebook={prayerPostFb}
                postToInstagram={prayerPostIg}
                onChangeFacebook={setPrayerPostFb}
                onChangeInstagram={setPrayerPostIg}
                disabled={false}
              />
            }
          />
        </>
      )}
    </>
  );
}
