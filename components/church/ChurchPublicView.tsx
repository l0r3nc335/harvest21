"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Shield,
  Target,
  Eye,
  ScrollText,
  Users,
  HandHeart,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import toast from "react-hot-toast";
import { followChurch, unfollowChurch } from "@/app/admin/churches/actions";
import { cancelFollowRequest } from "@/app/settings/following-actions";
import { approveOrganizationPage } from "@/lib/organizationPreviewActions";
import { ChurchMissionariesTab } from "@/components/church/ChurchMissionariesTab";
import { fetchFreshChurchOurMissionaries } from "@/app/church/our-missionaries-tab-actions";
import { Footer } from "@/components/Footer";
import type { ChurchAboutUsContent, ChurchFollowerStatus } from "@/types/church";

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
  page_name?: string | null;
};

type TabType = "about" | "missionaries";

interface ChurchPublicViewProps {
  church: {
    id: number;
    name: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    phone_number?: string | null;
    website?: string | null;
    email?: string | null;
    contact_user_id?: string | null;
    is_managed_by_harvest21?: boolean;
  };
  page: {
    id: number;
    page_url: string;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    template_content: string | null; // JSON with 7 fixed sections
    video_hashed_id: string | null;
    is_published: boolean;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    description?: string | null;
    thumbnail_url?: string | null;
  }>;
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    destination_country?: string | null;
    country_of_residence: string | null;
    is_managed_by_harvest21?: boolean;
    page_url: string | null;
    profile_photo_url: string | null;
    page_name?: string | null;
    is_published?: boolean;
    follower_status?: string;
  }>;
  initialUserProfile?: UserProfile | null;
  followerStatus?: ChurchFollowerStatus;
  followerCount?: number;
  isAdminPreview?: boolean;
  isOwner?: boolean;
  onBack?: () => void;
  viewOnlyWrapper?: boolean;
}

export function ChurchPublicView({
  church,
  page,
  media = [],
  missionaries = [],
  initialUserProfile = null,
  followerStatus = "none",
  followerCount = 0,
  isAdminPreview = false,
  isOwner = false,
  onBack,
  viewOnlyWrapper = false,
}: ChurchPublicViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [tabMissionaries, setTabMissionaries] = useState(missionaries ?? []);

  useEffect(() => {
    setTabMissionaries(missionaries ?? []);
  }, [missionaries]);
  const [currentFollowerStatus, setCurrentFollowerStatus] = useState<ChurchFollowerStatus>(followerStatus);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const isLoggedIn = !!initialUserProfile;
  const isAcceptedFollower = currentFollowerStatus === "accepted";
  const isPublished = page.is_published;
  const isActualAdmin = initialUserProfile?.role === 1 || initialUserProfile?.role === 2;
  const isManagedNoContact = church.contact_user_id == null;
  const canViewMissionaries = isOwner || isAcceptedFollower || isManagedNoContact;

  // Handle admin approval
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveOrganizationPage("church", page.id);
      if (result.success) {
        toast.success(result.message || "Church page approved and published!");
        if (isAdminPreview && onBack) {
          onBack();
        } else if (isAdminPreview) {
          router.push(`/admin/churches/${church.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.message || "Failed to approve page");
        setIsApproving(false);
      }
    } catch (error) {
      console.error("Error approving page:", error);
      toast.error("Failed to approve page");
      setIsApproving(false);
    }
  };

  // Parse About Us content (7 fixed sections - CHLP-004)
  let aboutUsContent: ChurchAboutUsContent | null = null;
  try {
    aboutUsContent = page.template_content ? JSON.parse(page.template_content) : null;
  } catch (e) {
    console.error("Failed to parse church about content:", e);
  }

  // Handle tab change with access control (CHLP-010); missionaries list always refetched from server
  const handleTabChange = async (tab: TabType) => {
    if (tab === "missionaries" && !canViewMissionaries) {
      toast.error("You must be an accepted follower to view missionaries");
      return;
    }
    setActiveTab(tab);
    if (tab === "missionaries" && canViewMissionaries) {
      try {
        const res = await fetchFreshChurchOurMissionaries(church.id);
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

  // Follow button handler (CHLP-003)
  const handleFollowClick = async () => {
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
      // Cancel the pending follow request
      setIsFollowProcessing(true);
      try {
        const result = await cancelFollowRequest("church", church.id);
        if (result.success) {
          setCurrentFollowerStatus("none");
          toast.success("Follow request cancelled");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to cancel request");
        }
      } catch (error) {
        console.error("Error cancelling follow request:", error);
        toast.error("An error occurred. Please try again.");
      } finally {
        setIsFollowProcessing(false);
      }
      return;
    }

    setIsFollowProcessing(true);
    try {
      const result = await followChurch(church.id);
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

  // Unfollow handler
  const handleUnfollow = async () => {
    setIsFollowProcessing(true);
    setShowUnfollowConfirm(false);
    try {
      const result = await unfollowChurch(church.id);
      if (result.success) {
        setCurrentFollowerStatus("none");
        toast.success("You have unfollowed this church");
        // If on missionaries tab, switch back to about
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

  // Follow button styles and text (CHLP-003)
  // Mobile: compact button under web address (~1/4 smaller, ~same width as About Us)
  const getFollowButtonConfig = () => {
    const mobileBase = "rounded-full border text-xs font-semibold px-3 py-1.5 w-fit min-w-[72px]";
    switch (currentFollowerStatus) {
      case "pending":
        return {
          text: "Pending",
          icon: <Clock className="w-4 h-4" />,
          mobileIcon: <Clock className="w-3 h-3" />,
          className: "rounded-full border-2 lg:border border-yellow-600 bg-yellow-600 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white shadow-lg lg:shadow-sm hover:bg-yellow-700 transition-all hover:scale-105 lg:hover:scale-100",
          mobileClassName: `${mobileBase} border-yellow-600 bg-yellow-600 text-white hover:bg-yellow-700`,
          disabled: false,
        };
      case "accepted":
        return {
          text: "Following",
          icon: <CheckCircle className="w-4 h-4" />,
          mobileIcon: <CheckCircle className="w-3 h-3" />,
          className: "rounded-full border-2 lg:border border-green-600 bg-green-600 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white shadow-lg lg:shadow-sm hover:bg-green-700 transition-all hover:scale-105 lg:hover:scale-100",
          mobileClassName: `${mobileBase} border-green-600 bg-green-600 text-white hover:bg-green-700`,
          disabled: false,
        };
      case "rejected":
        return {
          text: "Follow",
          icon: null,
          mobileIcon: null,
          className: "rounded-full border-2 lg:border border-[#E1B94D] lg:border-[#E1B94D]/60 bg-[#E1B94D] px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-black shadow-lg lg:shadow-sm hover:bg-[#d4a639] transition-all hover:scale-105 lg:hover:scale-100",
          mobileClassName: `${mobileBase} border-[#E1B94D] bg-[#E1B94D] text-black hover:bg-[#d4a639]`,
          disabled: false,
        };
      default:
        return {
          text: "Follow",
          icon: null,
          mobileIcon: null,
          className: "rounded-full border-2 lg:border border-[#E1B94D] lg:border-[#E1B94D]/60 bg-[#E1B94D] px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-black shadow-lg lg:shadow-sm hover:bg-[#d4a639] transition-all hover:scale-105 lg:hover:scale-100",
          mobileClassName: `${mobileBase} border-[#E1B94D] bg-[#E1B94D] text-black hover:bg-[#d4a639]`,
          disabled: false,
        };
    }
  };

  const followButtonConfig = getFollowButtonConfig();

  return (
    <>
      <div className="min-h-screen w-full bg-black text-[#f5f5f5] overflow-x-hidden overflow-y-visible">
        {!isAdminPreview && <Navbar initialUserProfile={initialUserProfile} />}
        
        <div className={isAdminPreview ? "mx-auto" : "mt-16 mx-auto"}>

          {/* Church Identity Banner (CHLP-002) */}
          <div className="relative w-full">
            {/* Banner Image */}
            <div className="relative h-[280px] sm:h-[300px] md:h-[380px] lg:h-[450px] w-full">
              {page.banner_photo_url ? (
                <Image
                  src={page.banner_photo_url}
                  alt={church.name}
                  fill
                  className="object-cover object-center"
                  sizes="100%"
                  priority
                />
              ) : (
                <div className="h-full w-full bg-linear-to-br from-zinc-900 to-zinc-800" />
              )}
              {/* Gradient only at bottom for text readability; rest of banner shows at full brightness */}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_45%,transparent_70%)]" />
            </div>

            {/* Church Information Overlay - Bottom Left on Banner */}
            <div className="absolute inset-0 flex items-end justify-start px-6 pb-4 lg:pb-8 lg:px-6 ">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                    {church.name}
                  </h1>
                  {church.is_managed_by_harvest21 && (
                    <span
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 shrink-0"
                      role="status"
                      aria-label="Managed by Harvest21"
                    >
                      <Shield className="h-5 w-4 shrink-0 text-[#E1B94D]" aria-hidden />
                      <span className="text-sm font-medium text-zinc-400">Managed by</span>
                      <Image src="/icon.svg" alt="Harvest21" width={100} height={51} className="h-5 w-auto shrink-0" />
                    </span>
                  )}
                  {/* Desktop: Follow button next to church name */}
                  {!isOwner && !isManagedNoContact && (
                    <div className="hidden lg:flex flex-col gap-1 mt-1">
                      <Button
                        onClick={handleFollowClick}
                        disabled={isAdminPreview || isFollowProcessing || followButtonConfig.disabled}
                        className={followButtonConfig.className}
                      >
                        {followButtonConfig.icon && (
                          <span className="mr-2">{followButtonConfig.icon}</span>
                        )}
                        {followButtonConfig.text}
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Short Quote */}
                {page.short_quote && (
                  <p className="text-sm sm:text-lg lg:text-lg text-white/90">
                    {page.short_quote}
                  </p>
                )}

                {/* Contact Information - Responsive Layout */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-y-2 sm:gap-y-1 sm:gap-x-4 text-sm sm:text-lg lg:text-lg text-white/80">
                  {/* Address */}
                  {(church.address || church.city || church.state || church.country) && (
                    <span>
                      {[
                        church.address,
                        [church.city, church.state].filter(Boolean).join(', '),
                        church.country
                      ].filter(Boolean).join(', ')}
                    </span>
                  )}
                  
                  {/* Phone Number */}
                  {church.phone_number && (
                    <a 
                      href={`tel:${church.phone_number}`}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      {church.phone_number.startsWith('+') ? church.phone_number : `+${church.phone_number}`}
                    </a>
                  )}
                  
                  {/* Website + Mobile Follow button (Follow under web address on mobile) */}
                  <div className="flex flex-col items-start gap-1.5">
                    {church.website && (
                      <a 
                        href={church.website.startsWith('http') ? church.website : `https://${church.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 text-blue-400 transition-colors cursor-pointer"
                      >
                        {church.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {/* Mobile: Follow button under web address */}
                    {!isOwner && !isManagedNoContact && (
                      <div className="lg:hidden self-start">
                        <Button
                          onClick={handleFollowClick}
                          disabled={isAdminPreview || isFollowProcessing || followButtonConfig.disabled}
                          className={followButtonConfig.mobileClassName}
                        >
                          {(() => {
                            const icon = followButtonConfig.mobileIcon ?? followButtonConfig.icon;
                            return icon ? <span className="mr-1.5">{icon}</span> : null;
                          })()}
                          {followButtonConfig.text}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Controls - Overlay on top of banner */}
            {isAdminPreview && !viewOnlyWrapper && (
              <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
                {onBack ? (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-black/50 text-[#f5f5f5] border border-white/20 hover:bg-black/70" 
                    onClick={onBack}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Settings
                  </Button>
                ) : null}
                {!isPublished && isActualAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="bg-[#E1B94D] text-black hover:bg-[#d4a639] border border-black/10"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {isApproving ? "Approving..." : "Approve This Page"}
                  </Button>
                )}
                {isPublished && isActualAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const publicUrl = `/${page.page_url}`;
                      window.open(publicUrl, "_blank");
                    }}
                    className="bg-[#E1B94D] text-black hover:bg-[#d4a639] border border-black/10"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Public Page
                  </Button>
                )}
              </div>
            )}

            {!isAdminPreview && !isPublished && (
              <div className="absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/80 px-5 py-2 text-sm text-white shadow-lg">
                This page is not yet published.
              </div>
            )}

          </div>

          {/* Tabs Navigation (CHLP-001) - Directly Below Banner */}
          <div className="mx-auto">
            <div 
              className="flex items-center justify-center overflow-x-auto border-white/10 bg-black/40 px-6 py-3 shadow-inner backdrop-blur"
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
                {[
                  { id: "about" as TabType, label: "About Us" },
                  { id: "missionaries" as TabType, label: "Our Missionaries" },
                ].map((tab) => {
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
                        {tab.id === "missionaries" && !canViewMissionaries && (
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
          <div className="mx-auto px-4 lg:px-5 space-y-8 mt-4">
            {/* About Us Tab (CHLP-004) */}
            {activeTab === "about" && (
              <div className="md:px-4 pb-8 pt-0">
                {/* Optional Video */}
                {page.video_hashed_id && (
                  <div className="w-full max-w-4xl mx-auto mb-2.5">
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

                {/* Fixed About Us Sections styled like missionary about cards (masonry columns) */}
                {aboutUsContent ? (
                  <div className="mx-auto columns-1 md:columns-2 space-y-6 md:space-y-0">
                    {/* Our Mission */}
                    {aboutUsContent.our_mission && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
                                <Target className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Our Mission</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.our_mission}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Our Vision */}
                    {aboutUsContent.our_vision && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/40">
                                <Eye className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Our Vision</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.our_vision}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* What We Believe */}
                    {aboutUsContent.what_we_believe && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-400/40">
                                <ScrollText className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">What We Believe</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.what_we_believe}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Our Ministries */}
                    {aboutUsContent.our_ministries && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/40">
                                <Users className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Our Ministries</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.our_ministries}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Join Us */}
                    {aboutUsContent.join_us && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/40">
                                <HandHeart className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Join Us</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.join_us}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Contact Us */}
                    {aboutUsContent.contact_us && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 shadow-lg shadow-zinc-400/40">
                                <Mail className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Contact Us</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.contact_us}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-zinc-500">About Us content is being prepared...</p>
                  </div>
                )}
              </div>
            )}

            {/* Our Missionaries Tab (CHLP-009, CHLP-011) - Grid layout with search, filters, and pagination */}
            {activeTab === "missionaries" && (
              <>
                {canViewMissionaries ? (
                  tabMissionaries && tabMissionaries.length > 0 ? (
                    <div className="mx-auto max-w-7xl px-4 py-1 sm:px-6 lg:px-8">
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
                        follower_status: m.follower_status,
                      }))}
                      isLoggedIn={!!initialUserProfile}
                      userRole={initialUserProfile?.role ?? null}
                      churchName={church.name}
                    />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-zinc-500">No missionaries to display yet.</p>
                    </div>
                  )
                ) : (
                  // Access Denied Message (CHLP-010)
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

          </div>
        </div>

        <Footer />
      </div>

      {/* Unfollow Confirmation Modal */}
      {showUnfollowConfirm && (
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
    </>
  );
}

