"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Upload, CheckCircle, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import { approveOrganizationPage } from "@/lib/organizationPreviewActions";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";

type OrganizationInlinePreviewProps = {
  organization: {
    id: number;
    name: string;
  };
  page: {
    id: number;
    page_url: string;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    is_published: boolean;
    published_at: string | null;
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
  organizationType: "college" | "agency" | "church";
  onBack: () => void;
  readOnly?: boolean;
  isAdmin?: boolean;
};

type TabType = "about" | "updates" | "gallery";

export function OrganizationInlinePreview({
  organization,
  page,
  media,
  donations,
  organizationType,
  onBack,
  readOnly = false,
  isAdmin = true,
}: OrganizationInlinePreviewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [isApproving, setIsApproving] = useState(false);
  
  const supportPercentage = donations && donations.totalPledged > 0 
    ? (donations.totalReceived / donations.totalPledged) * 100 
    : 0;
  const totalReceived = donations?.totalReceived || 0;
  const isPublished = page.is_published;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveOrganizationPage(organizationType, page.id);
      if (result.success) {
        toast.success(result.message || "Page approved and published!");
        // Go back to settings after approval
        if (onBack) {
          onBack();
        } else {
          // Otherwise navigate to admin page
          const getEntityPath = () => {
            switch (organizationType) {
              case "college":
                return "colleges";
              case "agency":
                return "agencies";
              case "church":
                return "churches";
              default:
                return "";
            }
          };
          router.push(`/admin/${getEntityPath()}/${organization.id}`);
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

  const images = media.filter((m) => m.media_type === "image");
  const videos = media.filter((m) => m.media_type === "video");

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

  const getEntityPath = () => {
    switch (organizationType) {
      case "college":
        return "colleges";
      case "agency":
        return "agencies";
      case "church":
        return "churches";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-[#f5f5f5]">
      {/* Warning Banner for Admin Preview (only if not published) */}
      {!isPublished && (
        <div className="bg-yellow-500/15 border-b border-yellow-500/40 px-6 py-2 text-center text-sm text-yellow-100">
          <p>
            This page isn&apos;t published yet. Only admins can see this preview.
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

        {/* Admin Controls - Overlay on top of banner */}
        <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
          <Button 
            variant="secondary" 
            size="sm" 
            className="bg-black/50 text-[#f5f5f5] border border-white/20 hover:bg-black/70" 
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
          {!isPublished && isAdmin && (
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
          {isPublished && isAdmin && (
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

        {/* Set Banner Photo Button */}
        {!readOnly && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                router.push(`/admin/${getEntityPath()}/${organization.id}?tab=page-details`);
              }}
              className="pointer-events-auto bg-black/60 text-[#f5f5f5] border border-white/20 hover:bg-black/70"
            >
              <Upload className="mr-2 h-4 w-4" />
              Set Banner Photo
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w px-5 pb-0">
        {/* Profile Card Section - Separate Row */}
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
                  {!readOnly && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-[#E1B94D] text-black hover:bg-[#d4a639]"
                        onClick={() => {
                          router.push(`/admin/${getEntityPath()}/${organization.id}?tab=page-details`);
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Photo
                      </Button>
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
              {donations && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm font-medium text-white">
                    <span className="text-base font-semibold text-white">
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
              {!readOnly && (
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
              )}
            </div>
          </div>
        </div>

        {/* Content Section - Separate Row */}
        <div className="w-full">
            {/* Tabs */}
            <div className="mb-8 mt-8 flex items-center justify-center overflow-x-auto bg-black/40 px-4 py-3 shadow-inner backdrop-blur">
              <nav className="flex min-w-full items-center justify-start gap-10 text-sm font-semibold uppercase tracking-wide">
                {[
                  { id: "about" as TabType, label: "About" },
                  { id: "updates" as TabType, label: "Updates" },
                  { id: "gallery" as TabType, label: "Gallery" },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="group relative cursor-pointer px-1 py-1 text-center"
                    >
                      <span
                        className={`transition-colors duration-200 ${
                          isActive ? "text-white" : "text-[#a0a0a0] group-hover:text-[#E1B94D]"
                        }`}
                      >
                        {tab.label}
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

            {/* Tab Content */}
            <div className="space-y-8">
              {activeTab === "about" && (
                <section className="rounded-3xl border border-white/10 bg-[#050505] px-8 py-10 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.8)]">
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
                </section>
              )}

              {activeTab === "updates" && (
                <section className="rounded-3xl border border-white/10 bg-[#050505] px-8 py-12 text-center text-[#a0a0a0] shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]">
                  No updates available yet.
                </section>
              )}

              {activeTab === "gallery" && (
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
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

