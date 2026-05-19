"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Shield,
  Target,
  Globe2,
  Briefcase,
  MapPin,
  Layers3,
  Sparkles,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import toast from "react-hot-toast";
import { approveOrganizationPage } from "@/lib/organizationPreviewActions";
import { ChurchMissionariesTab } from "@/components/church/ChurchMissionariesTab";
import { fetchFreshAgencyOurMissionaries } from "@/app/agency/our-missionaries-tab-actions";
import { Footer } from "@/components/Footer";
import type { AgencyAboutUsContent } from "@/types/agency";

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

interface AgencyPublicViewProps {
  agency: {
    id: number;
    name: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
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
    banner_photo_url: string | null;
    short_quote: string | null;
    template_content: string | null; // JSON with 7 fixed sections
    video_hashed_id: string | null;
    is_published: boolean;
    page_template?: string | null;
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
    page_url: string;
    profile_photo_url: string | null;
    page_name?: string | null;
    follower_status?: string;
  }>;
  initialUserProfile?: UserProfile | null;
  isAdminPreview?: boolean;
  onBack?: () => void;
  viewOnlyWrapper?: boolean;
}

export function AgencyPublicView({
  agency,
  page,
  media: _media,
  missionaries = [],
  initialUserProfile = null,
  isAdminPreview = false,
  onBack,
  viewOnlyWrapper = false,
}: AgencyPublicViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [tabMissionaries, setTabMissionaries] = useState(missionaries ?? []);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    setTabMissionaries(missionaries ?? []);
  }, [missionaries]);

  const isPublished = page.is_published;
  const isActualAdmin = initialUserProfile?.role === 1 || initialUserProfile?.role === 2;

  // Handle admin approval (MA-LP-008)
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveOrganizationPage("agency", page.id);
      if (result.success) {
        toast.success(result.message || "Agency page approved and published!");
        if (isAdminPreview && onBack) {
          onBack();
        } else if (isAdminPreview) {
          router.push(`/admin/agencies/${agency.id}`);
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

  // Parse About Us content (7 fixed sections - MA-LP-006)
  let aboutUsContent: AgencyAboutUsContent | null = null;
  try {
    aboutUsContent = page.template_content ? JSON.parse(page.template_content) : null;
  } catch (e) {
    console.error("Failed to parse agency about content:", e);
  }

  // 7 Fixed Section Labels for Agencies (MA-LP-006)
  const SECTION_LABELS = {
    who_we_are: "Personal Bio",
    mission_vision: "Mission / Vision",
    what_we_do: "What We Do",
    where_we_serve: "Where We Serve",
    how_we_operate: "How We Operate",
    values: "Values",
    contact_information: "Contact Information",
  };

  return (
    <>
      <div className="min-h-screen w-full bg-black text-[#f5f5f5] overflow-x-hidden overflow-y-visible">
        {!isAdminPreview && <Navbar initialUserProfile={initialUserProfile} />}

        <div className={isAdminPreview ? "mx-auto" : "mt-16 mx-auto"}>
          {/* Warning Banner for Admin Preview (only if not published) */}
          {isAdminPreview && !isPublished && (
            <div className="bg-yellow-500/15 border-b border-yellow-500/40 px-6 py-2 text-center text-sm text-yellow-100">
              <p>This page isn&apos;t published yet. Only admins can see this preview.</p>
            </div>
          )}

          {/* Top Banner Section - full viewport width */}
          <div className={isAdminPreview ? "relative w-full overflow-hidden bg-linear-to-b from-[#E1B94D] to-black" : "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden bg-linear-to-b from-[#E1B94D] to-black"}>
            {/* Banner Image Container */}
            <div className="relative h-[280px] sm:h-[300px] md:h-[380px] lg:h-[450px] w-full">
              {page.banner_photo_url ? (
                <Image
                  src={page.banner_photo_url}
                  alt={`${agency.name} Banner`}
                  fill
                  className="object-cover object-center"
                  sizes="100%"
                  priority
                />
              ) : (
                <div className="absolute inset-0 bg-linear-to-b from-[#E1B94D] to-black" />
              )}
              {/* Gradient only at bottom for text readability; rest of banner shows at full brightness */}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_45%,transparent_70%)]" />
            </div>

            {/* Agency Name Overlay - Bottom Left on Banner (same as Church) */}
            <div className="absolute inset-0 flex items-end justify-start px-8 pb-4 lg:pb-8">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                    {agency.name}
                  </h1>
                  {agency.is_managed_by_harvest21 && (
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
                  {(agency.address || agency.city || agency.country) && (
                    <span>
                      {[
                        agency.address,
                        agency.city,
                        agency.country
                      ].filter(Boolean).join(', ')}
                    </span>
                  )}
                  
                  {/* Phone Number */}
                  {agency.phone_number && (
                    <a 
                      href={`tel:${agency.phone_number}`}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      {agency.phone_number.startsWith('+') ? agency.phone_number : `+${agency.phone_number}`}
                    </a>
                  )}
                  
                  {/* Website */}
                  {agency.website && (
                    <a 
                      href={agency.website.startsWith('http') ? agency.website : `https://${agency.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-500 text-blue-400 transition-colors cursor-pointer"
                    >
                      {agency.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Controls Overlay (MA-LP-008) */}
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

          {/* Tabs (MA-LP-001, MA-LP-013) - Directly Below Banner */}
          <div className="mx-auto px-2">
            <div className="flex items-center justify-center overflow-x-auto border-white/10 bg-black/40 px-4 py-3 shadow-inner backdrop-blur">
              <nav className="flex min-w-full items-center justify-start gap-10 text-sm font-semibold uppercase tracking-wide">
                {[
                  { id: "about" as TabType, label: "About" },
                  { id: "missionaries" as TabType, label: "Our Missionaries" },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={async () => {
                        setActiveTab(tab.id);
                        if (tab.id === "missionaries") {
                          try {
                            const res = await fetchFreshAgencyOurMissionaries(agency.id);
                            if (res.success) {
                              setTabMissionaries(res.missionaries);
                            } else if (res.error) {
                              toast.error(res.error);
                            }
                          } catch {
                            toast.error("Could not load missionaries. Please try again.");
                          }
                        }
                      }}
                      className="group relative cursor-pointer px-1 py-1 text-center"
                    >
                      <span
                        className={`transition-colors duration-200 gap-2 whitespace-nowrap ${
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
          </div>

          {/* Tab Content */}
          <div className="mx-auto px-4 lg:px-5 space-y-8 mt-4">
            {activeTab === "about" && (
              <section className="md:px-4 pb-8 pt-0">
                {/* Background Video (MA-LP-007) */}
                {page.video_hashed_id && (
                  <div className="mb-12 aspect-video w-full max-w-4xl mx-auto rounded-lg overflow-hidden bg-zinc-900">
                    <video
                      src={page.video_hashed_id}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* About Us Content - 7 Fixed Sections (MA-LP-006) styled like missionary about cards (masonry columns) */}
                {aboutUsContent ? (
                  <div className="mx-auto columns-1 md:columns-2 space-y-6 md:space-y-0">
                    {/* Mission / Vision */}
                    {aboutUsContent.mission_vision && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
                                <Target className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Mission / Vision</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.mission_vision}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* What We Do */}
                    {aboutUsContent.what_we_do && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/40">
                                <Briefcase className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">What We Do</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.what_we_do}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Where We Serve */}
                    {aboutUsContent.where_we_serve && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/40">
                                <Globe2 className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Where We Serve</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.where_we_serve}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* How We Operate */}
                    {aboutUsContent.how_we_operate && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-400/40">
                                <Layers3 className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">How We Operate</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.how_we_operate}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Values */}
                    {aboutUsContent.values && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/40">
                                <Sparkles className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Values</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.values}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Contact Information */}
                    {aboutUsContent.contact_information && (
                      <section className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
                        <div className="flex items-start gap-4">
                          <div>
                            <div className="mt-1 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 shadow-lg shadow-zinc-400/40">
                                <Mail className="h-5 w-5 text-black" />
                              </div>
                              <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                                <span className="text-xl font-semibold text-white">Contact Information</span>
                              </div>
                            </div>
                            <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                              {aboutUsContent.contact_information}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-zinc-400 py-12">
                    <p>No content available yet.</p>
                  </div>
                )}
              </section>
            )}

            {activeTab === "missionaries" && (
              <>
                {tabMissionaries && tabMissionaries.length > 0 ? (
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
                      churchName={agency.name}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-zinc-500">No missionaries to display yet.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

