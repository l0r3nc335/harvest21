import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { fetchHomepageBanners, fetchHomepageSettings } from "./fetchActions";
import { fetchFooterContent } from "./footerActions";
import { HomepageSettingsClient } from "@/components/admin/HomepageSettingsClient";

async function HomepageSettingsData() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const [
    bannersResult,
    settingsResult,
    aboutUsResult,
    statementResult,
    donateResult,
    faqResult,
    contactResult,
    privacyResult,
    termsResult,
  ] = await Promise.all([
    fetchHomepageBanners(),
    fetchHomepageSettings(),
    fetchFooterContent("about_us"),
    fetchFooterContent("statement_of_faith"),
    fetchFooterContent("donate"),
    fetchFooterContent("faq"),
    fetchFooterContent("contact_us"),
    fetchFooterContent("privacy_policy"),
    fetchFooterContent("terms_of_use"),
  ]);

  if (!bannersResult.success || !settingsResult.success) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
          <p className="text-red-500">
            {bannersResult.error || settingsResult.error || "Failed to load data"}
          </p>
        </div>
      </div>
    );
  }

  const footerContent = {
    about_us: aboutUsResult.success ? aboutUsResult.data : null,
    statement_of_faith: statementResult.success ? statementResult.data : null,
    donate: donateResult.success ? donateResult.data : null,
    faq: faqResult.success ? faqResult.data : null,
    contact_us: contactResult.success ? contactResult.data : null,
    privacy_policy: privacyResult.success ? privacyResult.data : null,
    terms_of_use: termsResult.success ? termsResult.data : null,
  };

  return (
    <HomepageSettingsClient
      banners={bannersResult.data || []}
      settings={settingsResult.data!}
      footerContent={footerContent}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-zinc-200 rounded w-1/4"></div>
        <div className="h-64 bg-zinc-200 rounded"></div>
      </div>
    </div>
  );
}

export default async function HomepageSettingsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomepageSettingsData />
    </Suspense>
  );
}
