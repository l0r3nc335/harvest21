import Link from "next/link";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import { Footer } from "@/components/Footer";
import { getSupabaseServer } from "@/lib/supabaseServer";
import {
  isPaymentIntentSucceeded,
  syncDonationAfterSuccessfulRedirect,
  syncRecurringDonationBySubscriptionId,
} from "@/lib/donationHelpers";
import { DonateFormClient } from "@/components/donate/DonateFormClient";

async function getPageAndMissionaryName(pageId: string | null) {
  if (!pageId) return { pageId: null as number | null, missionaryName: null as string | null };
  const id = parseInt(pageId, 10);
  if (Number.isNaN(id)) return { pageId: null, missionaryName: null };
  const supabase = await getSupabaseServer();
  const { data: page } = await supabase
    .from("pages")
    .select("id, organization_id")
    .eq("id", id)
    .eq("organization_type", "missionary")
    .eq("is_published", true)
    .single();
  if (!page) return { pageId: null, missionaryName: null };
  const { data: missionary } = await supabase
    .from("missionaries_public")
    .select("first_name, last_name")
    .eq("id", page.organization_id)
    .single();
  const missionaryName = missionary
    ? `${missionary.first_name ?? ""} ${missionary.last_name ?? ""}`.trim() || null
    : null;
  return { pageId: page.id, missionaryName };
}

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ page_id?: string; success?: string; payment_intent?: string; type?: string; redirect_status?: string; subscription_id?: string }>;
}) {
  const params = await searchParams;
  const { pageId, missionaryName } = await getPageAndMissionaryName(params.page_id ?? null);
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const redirectStatus = params.redirect_status;

  if (redirectStatus === "succeeded" && params.payment_intent && await isPaymentIntentSucceeded(params.payment_intent)) {
    let successKind: "recurring" | "one_time";
    if (params.subscription_id) {
      successKind = await syncRecurringDonationBySubscriptionId(params.subscription_id);
    } else {
      successKind = await syncDonationAfterSuccessfulRedirect(params.payment_intent);
    }
    return (
      <div className="flex min-h-screen flex-col bg-[#000000]">
        <NavbarWrapper />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              {successKind === "recurring"
                ? "Thank you for setting up your monthly donation!"
                : "Thank you for your donation!"}
            </h1>
            <p className="mb-8 text-lg text-zinc-300">
              {successKind === "recurring"
                ? "Your monthly donation has been set up successfully. You will be charged on the same day each month."
                : "Your generous contribution has been received successfully."}
              {missionaryName && (
                <span className="block mt-2">
                  Your support for <span className="font-medium text-white">{missionaryName}</span> makes a real difference.
                </span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-yellow-500 px-6 py-3 text-sm font-medium text-black hover:bg-yellow-600 transition-colors"
              >
                Return to Home
              </Link>
              {pageId && (
                <Link
                  href={`/donate?page_id=${pageId}`}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
                >
                  Make Another Donation
                </Link>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col bg-[#000000]">
      <NavbarWrapper />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          Donate
          </h1>
          <DonateFormClient pageId={pageId} missionaryName={missionaryName} isLoggedIn={isLoggedIn} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
