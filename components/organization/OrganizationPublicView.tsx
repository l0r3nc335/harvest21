"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Play, CheckCircle, XCircle, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import toast from "react-hot-toast";
import { TemplateRenderer } from "@/components/templates";
import { deserializeTemplateContent } from "@/lib/templates/contentHelpers";
import { getTemplate, getDefaultTemplate } from "@/lib/templates";
import { Footer } from "@/components/Footer";
import { MissionaryCard } from "@/components/MissionaryCard";
import { ChurchMissionariesTab } from "@/components/church/ChurchMissionariesTab";
import { fetchFreshChurchOurMissionaries } from "@/app/church/our-missionaries-tab-actions";
import { followChurch, unfollowChurch } from "@/app/admin/churches/actions";
import { approveOrganizationPage } from "@/lib/organizationPreviewActions";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";
import type { ChurchAboutUsContent, ChurchFollowerStatus } from "@/types/church";

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
};

type OrganizationPublicViewProps = {
  organization: {
    id: number;
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone_number?: string | null;
    website?: string | null;
    email?: string | null;
    contact_user_id?: string | null;
  };
  page: {
    id: number;
    page_url: string;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    is_published: boolean;
    published_at: string | null;
    page_template?: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    created_at: string;
  }>;
  donations?: {
    totalPledged: number;
    totalReceived: number;
  };
  organizationType: "college" | "agency" | "church" | "donor";
  initialUserProfile?: UserProfile | null;
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    destination_country?: string | null;
    country_of_residence: string | null;
    is_managed_by_harvest21?: boolean;
    page_url: string;
    profile_photo_url: string | null;
    page_name?: string | null;
  }>;
  followerStatus?: ChurchFollowerStatus;
  followerCount?: number;
  isOwner?: boolean;
  isAdminPreview?: boolean;
  onBack?: () => void;
};

type TabType = "about" | "missionaries" | "updates" | "gallery";

export function OrganizationPublicView({
  organization,
  page,
  media,
  donations,
  organizationType,
  initialUserProfile = null,
  missionaries = [],
  followerStatus = "none",
  followerCount = 0,
  isOwner = false,
  isAdminPreview = false,
  onBack,
}: OrganizationPublicViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [tabMissionaries, setTabMissionaries] = useState(missionaries ?? []);

  useEffect(() => {
    setTabMissionaries(missionaries ?? []);
  }, [missionaries]);

  // Church-specific state
  const isChurch = organizationType === "church";
  const [currentFollowerStatus, setCurrentFollowerStatus] = useState<ChurchFollowerStatus>(followerStatus);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  
  const isLoggedIn = !!initialUserProfile;
  const isAcceptedFollower = currentFollowerStatus === "accepted";
  const canViewMissionaries = isOwner || isAcceptedFollower;
  
  const supportPercentage = donations && donations.totalPledged > 0 
    ? (donations.totalReceived / donations.totalPledged) * 100 
    : 0;
  const totalReceived = donations?.totalReceived || 0;
  const isPublished = page.is_published;

  const images = media.filter((m) => m.media_type === "image");
  const videos = media.filter((m) => m.media_type === "video");
  
  // Parse About Us content for churches (7 fixed sections)
  let aboutUsContent: ChurchAboutUsContent | null = null;
  if (isChurch && page.template_content) {
    try {
      aboutUsContent = JSON.parse(page.template_content);
    } catch (e) {
      console.error("Failed to parse church about content:", e);
    }
  }
  
  // Follow button handler for churches
  const handleFollowClick = async () => {
    if (!isChurch) return;
    
    if (!isLoggedIn) {
      toast.error("Please log in to follow this church");
      router.push("/login");
      return;
    }

    if (currentFollowerStatus === "accepted") {
      setShowUnfollowConfirm(true);
      return;
    }

    if (currentFollowerStatus === "pending") {
      toast("Your follow request is pending approval", { icon: "⏳" });
      return;
    }

    setIsFollowProcessing(true);
    try {
      const result = await followChurch(organization.id);
      if (result.success) {
        setCurrentFollowerStatus("pending");
        toast.success("Follow request sent! Awaiting church approval.");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send follow request");
      }
    } catch (error) {
      console.error("Error following church:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsFollowProcessing(false);
    }
  };

  // Unfollow handler for churches
  const handleUnfollow = async () => {
    if (!isChurch) return;
    
    setIsFollowProcessing(true);
    setShowUnfollowConfirm(false);
    try {
      const result = await unfollowChurch(organization.id);
      if (result.success) {
        setCurrentFollowerStatus("none");
        toast.success("You have unfollowed this church");
        if (activeTab === "missionaries") {
          setActiveTab("about");
        }
        router.refresh();
      } else {
        toast.error(result.error || "Failed to unfollow");
      }
    } catch (error) {
      console.error("Error unfollowing church:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsFollowProcessing(false);
    }
  };

  // Follow button styles and text for churches
  const getFollowButtonConfig = () => {
    if (!isChurch) return null;
    
    switch (currentFollowerStatus) {
      case "pending":
        return {
          text: "Pending",
          icon: <Clock className="w-4 h-4" />,
          className: "rounded-full border-2 lg:border border-yellow-600 bg-yellow-600 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white shadow-lg lg:shadow-sm hover:bg-yellow-700 transition-all hover:scale-105 lg:hover:scale-100 disabled:opacity-70",
          disabled: true,
        };
      case "accepted":
        return {
          text: "Following",
          icon: <CheckCircle className="w-4 h-4" />,
          className: "rounded-full border-2 lg:border border-green-600 bg-green-600 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white shadow-lg lg:shadow-sm hover:bg-green-700 transition-all hover:scale-105 lg:hover:scale-100",
          disabled: false,
        };
      case "rejected":
        return {
          text: "Follow",
          icon: null,
          className: "rounded-full border-2 lg:border border-[#E1B94D] lg:border-[#E1B94D]/60 bg-[#E1B94D] px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-black shadow-lg lg:shadow-sm hover:bg-[#d4a639] transition-all hover:scale-105 lg:hover:scale-100",
          disabled: false,
        };
      default:
        return {
          text: "Follow",
          icon: null,
          className: "rounded-full border-2 lg:border border-[#E1B94D] lg:border-[#E1B94D]/60 bg-[#E1B94D] px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-black shadow-lg lg:shadow-sm hover:bg-[#d4a639] transition-all hover:scale-105 lg:hover:scale-100",
          disabled: false,
        };
    }
  };

  const followButtonConfig = getFollowButtonConfig();
  
  // Handle tab change with access control for churches; missionaries list refetched when tab opens
  const handleTabChange = async (tab: TabType) => {
    if (isChurch && tab === "missionaries" && !canViewMissionaries) {
      toast.error("You must be an accepted follower to view missionaries");
      return;
    }
    setActiveTab(tab);
    if (tab === "missionaries" && isChurch && canViewMissionaries) {
      try {
        const res = await fetchFreshChurchOurMissionaries(organization.id, {
          allowManagedNoContact: false,
        });
        if (res.success) {
          setTabMissionaries(res.missionaries);
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Could not load missionaries. Please try again.");
      }
    }
  };

  const isYouTubeUrl = (url: string) => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/.test(url);
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return url;
  };

  const isVimeoUrl = (url: string) => {
    return /vimeo\.com\/(\d+)/.test(url);
  };

  const getVimeoEmbedUrl = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match && match[1]) {
      return `https://player.vimeo.com/video/${match[1]}`;
    }
    return url;
  };

  return (
    <div className="min-h-screen w-full bg-black text-[#f5f5f5]">
      {!isAdminPreview && <Navbar initialUserProfile={initialUserProfile} />}
      
      <div className={isAdminPreview ? "mx-auto" : "mt-16 mx-auto"}>
        {/* Banner Section - Match ChurchPublicView for churches */}
        {isChurch ? (
          <div className="relative w-full">
            {/* Banner Image */}
            <div className="relative h-[280px] sm:h-[300px] md:h-[380px] lg:h-[450px] w-full">
              {page.banner_photo_url ? (
                <Image
                  src={page.banner_photo_url}
                  alt={organization.name}
                  fill
                  className="object-cover object-center"
                  sizes="100vw"
                  priority
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-zinc-800" />
              )}
              {/* Gradient only at bottom for text readability; rest of banner shows at full brightness */}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_45%,transparent_70%)]" />
            </div>
          </div>
        ) : (
          <>
            {/* Warning Banner for Unpublished (should not show in public, but just in case) */}
            {!isPublished && (
              <div className="bg-yellow-500/15 border-b border-yellow-500/40 px-6 py-2 text-center text-sm text-yellow-100">
                <p>
                  This page isn&apos;t published yet.
                </p>
              </div>
            )}

            {/* Top Banner Section */}
            <div className="relative w-full overflow-hidden bg-linear-to-b from-[#E1B94D] to-black">
              {/* Banner Image Container - Fixed Height with Responsive Breakpoints */}
              <div className="relative h-[500px] w-full sm:h-[500px] lg:h-[700px]">
                {page.banner_photo_url ? (
                  <Image
                    src={page.banner_photo_url}
                    alt="Banner"
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-linear-to-b from-[#E1B94D] to-black" />
                )}
              </div>
            </div>
          </>
        )}

        {/* Organization Info Section */}
        {isChurch ? (
          <div className="relative z-10 -mt-32 sm:-mt-36 md:-mt-40 lg:-mt-56 w-full">
            <div className="mx-auto px-6 lg:px-12">
              <div className="flex flex-col items-start gap-6">
                {/* Organization Name */}
                <div className="w-full">
                  <h1 className="text-4xl lg:text-6xl font-bold text-white text-left">
                    {organization.name}
                  </h1>
                </div>

                {/* Short Quote and Action Buttons - Aligned horizontally */}
                <div className="flex flex-row gap-4 items-center flex-wrap w-full">
                  {/* Short Quote */}
                  {page.short_quote && (
                    <p className="text-lg lg:text-xl italic text-zinc-300">
                      &ldquo;{page.short_quote}&rdquo;
                    </p>
                  )}
                  {/* Action Buttons - Follow button for churches, plus Encourage, Tell Others, Donate */}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-3 items-center">
                      {followButtonConfig && (
                        <Button
                          onClick={handleFollowClick}
                          disabled={isOwner || isAdminPreview || isFollowProcessing || followButtonConfig.disabled}
                          className={followButtonConfig.className}
                        >
                          {followButtonConfig.icon && (
                            <span className="mr-2">{followButtonConfig.icon}</span>
                          )}
                          {followButtonConfig.text}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        disabled={isOwner}
                        className="rounded-full border border-white/20 bg-black px-6 py-2 text-sm font-semibold text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (!isOwner) {
                            toast.success("Encourage functionality coming soon!");
                          }
                        }}
                      >
                        Encourage
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={isOwner}
                        className="rounded-full border border-white/20 bg-black px-6 py-2 text-sm font-semibold text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (!isOwner && typeof window !== "undefined") {
                            const url = `${window.location.origin}/${page.page_url}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied to clipboard!");
                          }
                        }}
                      >
                        Tell Others
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={isOwner}
                        className="rounded-full border border-white/20 bg-black px-6 py-2 text-sm font-semibold text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (!isOwner) {
                            toast.success("Donate functionality coming soon!");
                          }
                        }}
                      >
                        Donate
                      </Button>
                    </div>
                    {isAcceptedFollower && followerCount > 0 && (
                      <p className="text-xs text-center text-zinc-400">
                        {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w px-5 pb-0">
            {/* Profile Card Section - Separate Row (for non-churches) */}
            <div className="relative z-10 -mt-80  w-full">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-start items-center  lg:gap-12">
                {/* Profile Card */}
                <div className="w-full max-w-xs rounded-2xl bg-white p-8 text-zinc-900 shadow-[0_25px_70px_-35px_rgba(0,0,0,0.8)]">
                  {/* Profile Photo */}
                  <div className="group relative mb-6 w-full overflow-hidden rounded-2xl shadow-lg">
                    <div className="relative w-full overflow-hidden rounded-2xl border border-black/5 bg-zinc-200">
                      {page.profile_photo_url ? (
                        <div className="relative h-0 w-full pb-[100%]">
                          <Image
                            src={page.profile_photo_url}
                            alt={organization.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 80vw, 320px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[260px] w-full items-center justify-center bg-zinc-300 text-5xl font-semibold text-zinc-500">
                          {organization.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div className="space-y-1 text-center">
                    <h1 className="text-2xl font-semibold text-black">{organization.name}</h1>
                  </div>
                </div>

                {/* Support Progress and Action Buttons - Right Side */}
                <div className="flex flex-1 flex-col gap-6 sm:w-full">
                  {/* Support Progress */}
                  {donations && donations.totalPledged > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm font-medium text-white">
                        <span className=" text-8xl font-semibold text-white">
                          {Math.round(supportPercentage)}%
                        </span>
                        <span className="tracking-wide">Support Level</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-[#e5e5e5]">
                        <div
                          className="h-full rounded-full bg-[#3b82f6] transition-all duration-500"
                          style={{ width: `${supportPercentage}%` }}
                        />
                      </div>
                      {totalReceived > 0 && (
                        <p className="text-xs text-zinc-400">
                          ${totalReceived.toLocaleString()} received
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 max-w">
                    <Button
                      variant="secondary"
                      className="rounded-full border border-[#E1B94D]/60 bg-[#E1B94D] px-6 py-2 text-sm font-semibold text-black shadow-sm hover:bg-[#d4a639]"
                      onClick={() => {
                        toast.success("Follow functionality coming soon!");
                      }}
                    >
                      Follow
                    </Button>
                    <Button
                      variant="secondary"
                      className="rounded-full border border-white/20 bg-black px-6 py-2 text-sm font-semibold text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D]"
                      onClick={() => {
                        toast.success("Encourage functionality coming soon!");
                      }}
                    >
                      Encourage
                    </Button>
                    <Button
                      variant="secondary"
                      className="rounded-full border border-white/20 bg-black px-6 py-2 text-sm font-semibold text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D]"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          const url = `${window.location.origin}/${page.page_url}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Link copied to clipboard!");
                        }
                      }}
                    >
                      Tell Others
                    </Button>
                    <Button
                      variant="secondary"
                      className="rounded-full border border-white/20 bg-black px-6 py-2 text-sm font-semibold text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D]"
                      onClick={() => {
                        toast.success("Donate functionality coming soon!");
                      }}
                    >
                      Donate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="mx-auto px-6 lg:px-12">
          <div 
            className="mb-8 mt-8 flex items-center justify-center overflow-x-auto border-white/10 bg-black/40 px-4 py-3 shadow-inner backdrop-blur"
            onWheel={(e) => {
              // Allow vertical scrolling to pass through
              // Only prevent default for horizontal scrolling if shift is held
              if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                // Vertical scroll - let it bubble up to the page
                return;
              }
              // Horizontal scroll with shift - allow it
            }}
          >
            <nav className="flex min-w-full items-center justify-start gap-10 text-sm font-semibold uppercase tracking-wide">
              {(isChurch ? [
                { id: "about" as TabType, label: "About Us" },
                { id: "missionaries" as TabType, label: "Our Missionaries" },
              ] : [
                // Non-church tabs: About, Updates, Gallery
                { id: "about" as TabType, label: "About" },
                { id: "updates" as TabType, label: "Updates" },
                { id: "gallery" as TabType, label: "Gallery" },
              ]).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className="group relative cursor-pointer px-1 py-1 text-center"
                  >
                    <span
                      className={`transition-colors duration-200 flex items-center gap-2 whitespace-nowrap ${
                        isActive ? "text-white" : "text-[#a0a0a0] group-hover:text-[#E1B94D]"
                      }`}
                    >
                      {tab.label}
                      {isChurch && tab.id === "missionaries" && !canViewMissionaries && (
                        <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full normal-case">
                          Followers Only
                        </span>
                      )}
                    </span>
                    <span
                      className={`absolute left-0 right-0 -bottom-2 h-0.5 rounded-full transition-all duration-300 ${
                        isActive ? "bg-[#E1B94D]" : "bg-transparent group-hover:bg-[#E1B94D]/60"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mx-auto px-6 lg:px-12 space-y-8">
          {/* About Us Tab */}
          {activeTab === "about" && (
            <div className="mt-12 space-y-12">
              {isChurch ? (
                <>
                  {/* Optional Video */}
                  {page.video_hashed_id && (
                    <div className="w-full max-w-4xl mx-auto">
                      <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-[#0a0a0a] shadow-2xl ring-1 ring-white/10">
                        <video
                          src={page.video_hashed_id}
                          className="w-full h-full object-contain"
                          controls
                          playsInline
                        />
                      </div>
                    </div>
                  )}

                  {/* Fixed About Us Sections */}
                  {aboutUsContent ? (
                    <div className="mx-auto space-y-10">
                      {/* Who We Are */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Personal Bio</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.who_we_are}
                        </div>
                      </section>

                      {/* Our Mission */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.our_mission}
                        </div>
                      </section>

                      {/* Our Vision */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Our Vision</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.our_vision}
                        </div>
                      </section>

                      {/* What We Believe */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">What We Believe</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.what_we_believe}
                        </div>
                      </section>

                      {/* Our Ministries */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Our Ministries</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.our_ministries}
                        </div>
                      </section>

                      {/* Join Us */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Join Us</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.join_us}
                        </div>
                      </section>

                      {/* Contact Us */}
                      <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {aboutUsContent.contact_us}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-zinc-500">About Us content is being prepared...</p>
                    </div>
                  )}
                </>
              ) : (
                <section className="rounded-3xl border border-white/10 bg-[#050505] px-8 py-10 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.8)]">
                  {page.template_content ? (
                    (() => {
                      const templateState = deserializeTemplateContent(page.template_content);
                      if (templateState) {
                        const pageTemplate = page.page_template || "default";
                        const template = getDefaultTemplate();
                        const variant =
                          pageTemplate === "simple" ? "default" : "missionaryAbout";
                        return (
                          <div className="template-content prose prose-invert max-w-none">
                            <TemplateRenderer
                              template={template}
                              content={templateState.fields}
                              videoUrl={page.video_hashed_id}
                              variant={variant}
                            />
                          </div>
                        );
                      }
                      return null;
                    })()
                  ) : (
                    <div className="space-y-6 text-base leading-relaxed">
                      {page.short_quote && (
                        <p className="text-xl font-semibold text-white">
                          &ldquo;{page.short_quote}&rdquo;
                        </p>
                      )}
                      {page.intro_text && (
                        <div
                          className="prose prose-invert max-w-none text-[#f5f5f5]"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(page.intro_text) }}
                        />
                      )}
                      {page.about_text && (
                        <div
                          className="prose prose-invert max-w-none text-[#f5f5f5]"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(page.about_text) }}
                        />
                      )}
                      {!page.intro_text && !page.about_text && (
                        <p className="text-[#a0a0a0]">No content available yet.</p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* Our Missionaries Tab (for churches only) */}
          {isChurch && activeTab === "missionaries" && (
            <>
              {canViewMissionaries ? (
                tabMissionaries && tabMissionaries.length > 0 ? (
                  <ChurchMissionariesTab
                    missionaries={tabMissionaries.map((m) => ({
                      id: m.id,
                      first_name: m.first_name,
                      last_name: m.last_name,
                      destination_country: m.destination_country,
                      country_of_residence: m.country_of_residence,
                      is_managed_by_harvest21: m.is_managed_by_harvest21,
                      page_url: m.page_url,
                      profile_photo_url: m.profile_photo_url,
                      page_name: m.page_name,
                    }))}
                    isLoggedIn={isLoggedIn}
                    userRole={initialUserProfile?.role || null}
                  />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-zinc-500">No missionaries to display yet.</p>
                  </div>
                )
              ) : (
                // Access Denied Message
                <div className="max-w-2xl mx-auto text-center py-16">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8">
                    <XCircle className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-3">
                      Followers Only Content
                    </h3>
                    <p className="text-zinc-400 mb-6">
                      This content is only available to accepted followers of this church.
                    </p>
                    <Button
                      onClick={handleFollowClick}
                      disabled={isFollowProcessing}
                      className="rounded-full border-2 border-[#E1B94D] bg-[#E1B94D] px-8 py-2.5 text-sm font-bold text-black shadow-lg hover:bg-[#d4a639] transition-all hover:scale-105"
                    >
                      {!isLoggedIn ? "Log In to Follow" : currentFollowerStatus === "pending" ? "Request Pending" : "Follow Church"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Updates Tab */}
          {activeTab === "updates" && (
            <div className="mt-12">
              <section className="rounded-3xl border border-white/10 bg-[#050505] px-8 py-12 text-center text-[#a0a0a0] shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]">
                No updates available yet.
              </section>
            </div>
          )}

          {/* Gallery Tab */}
          {activeTab === "gallery" && (
            <div className="mt-12">
              <section className="rounded-3xl border border-white/10 bg-[#050505] px-8 py-10 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]">
                {images.length === 0 && videos.length === 0 ? (
                  <div className="py-10 text-center text-[#a0a0a0]">
                    No media uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {images.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Images</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {images.map((image) => (
                            <div
                              key={image.id}
                              className="group relative h-[300px] w-full overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-lg"
                            >
                              <Image
                                src={image.media_url}
                                alt="Gallery image"
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="300px"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {videos.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Videos</h3>
                        <div className="grid grid-cols-1 gap-6">
                          {videos.map((video) => (
                            <div key={video.id} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-black/50 shadow-lg">
                              <div className="relative w-full" style={{ paddingBottom: "50%" }}>
                                <div className="absolute inset-0">
                                  {isYouTubeUrl(video.media_url) ? (
                                    <iframe
                                      src={getYouTubeEmbedUrl(video.media_url)}
                                      title="Video"
                                      className="h-full w-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : isVimeoUrl(video.media_url) ? (
                                    <iframe
                                      src={getVimeoEmbedUrl(video.media_url)}
                                      title="Video"
                                      className="h-full w-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : (
                                    <video
                                      src={video.media_url}
                                      controls
                                      className="h-full w-full object-contain"
                                    />
                                  )}
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                                    <Play className="h-9 w-9 text-white/85" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Unfollow Confirmation Modal (for churches only) */}
      {isChurch && showUnfollowConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 rounded-lg p-6 max-w-md w-full border border-zinc-800">
            <h3 className="text-xl font-bold text-white mb-3">Unfollow Church?</h3>
            <p className="text-zinc-400 mb-6">
              You will lose access to this church&apos;s missionary directory.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleUnfollow}
                disabled={isFollowProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Unfollow
              </Button>
              <Button
                onClick={() => setShowUnfollowConfirm(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

