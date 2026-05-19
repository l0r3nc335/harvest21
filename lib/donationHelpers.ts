import Stripe from "stripe";
import { getWebhookAdminClient, type WebhookAdminClient } from "@/lib/webhookAdminClient";
import { persistHarvest21RecurringDonationForInvoice } from "@/lib/stripeRecurringDonationPersist";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export async function isPaymentIntentSucceeded(paymentIntentId: string): Promise<boolean> {
  if (!stripe || !paymentIntentId) return false;
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  return pi.status === "succeeded";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function omitStripeDesignationKeys(
  meta: Record<string, string | undefined> | null | undefined
): Record<string, string> {
  if (!meta) return {};
  const { designation: _d, h21_designation: _h, ...rest } = meta as Record<string, string>;
  void _d;
  void _h;
  return rest;
}

export function designationFromStripeMetadata(
  meta: Record<string, string | undefined> | null | undefined
): string | null {
  if (!meta) return null;
  const v = (meta.h21_designation ?? "").trim().slice(0, 50);
  return v || null;
}

export function recurringDesignationFromStripe(
  subscriptionMetadata: Stripe.Metadata | null | undefined,
  invoice: Stripe.Invoice
): string | null {
  const fromSub = (subscriptionMetadata?.h21_designation ?? "").trim().slice(0, 50);
  if (fromSub) return fromSub;
  const snap = invoice.parent?.subscription_details?.metadata as
    | Record<string, string>
    | undefined;
  const fromSnap = (snap?.h21_designation ?? "").trim().slice(0, 50);
  if (fromSnap) return fromSnap;
  const inv = invoice.metadata as Record<string, string> | undefined;
  const fromInv = (inv?.h21_designation ?? "").trim().slice(0, 50);
  if (fromInv) return fromInv;
  return null;
}

export async function resolveMissionAgencyNameFromPageId(
  supabase: WebhookAdminClient,
  pageId: number
): Promise<string | null> {
  if (!pageId || Number.isNaN(pageId)) return null;

  const { data: page } = await supabase
    .from("pages")
    .select("organization_id, organization_type")
    .eq("id", pageId)
    .maybeSingle();
  if (!page || page.organization_type !== "missionary") return null;

  const { data: missionary } = await supabase
    .from("missionaries")
    .select("agency_id")
    .eq("id", page.organization_id)
    .maybeSingle();
  if (!missionary?.agency_id) return null;

  const { data: agency } = await supabase
    .from("agencies")
    .select("name")
    .eq("id", missionary.agency_id)
    .maybeSingle();

  const name = (agency?.name ?? "").trim();
  return name || null;
}

export type BillingInfo = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

const BILLING_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function resolveBillingForAuthenticatedUser(
  supabase: WebhookAdminClient,
  userId: string,
  authEmail: string | null | undefined
): Promise<{ firstName: string; lastName: string; email: string } | null> {
  if (!userId) return null;

  const { data: donor } = await supabase
    .from("donors")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (donor?.email?.trim()) {
    return {
      firstName: (donor.first_name ?? "").trim().slice(0, 100),
      lastName: (donor.last_name ?? "").trim().slice(0, 100),
      email: donor.email.trim().slice(0, 254),
    };
  }

  const { data: supporter } = await supabase
    .from("supporter_profiles")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (supporter?.email?.trim()) {
    return {
      firstName: (supporter.first_name ?? "").trim().slice(0, 100),
      lastName: (supporter.last_name ?? "").trim().slice(0, 100),
      email: supporter.email.trim().slice(0, 254),
    };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (userRow?.email?.trim()) {
    return {
      firstName: (userRow.first_name ?? "").trim().slice(0, 100),
      lastName: (userRow.last_name ?? "").trim().slice(0, 100),
      email: userRow.email.trim().slice(0, 254),
    };
  }

  const e = authEmail?.trim();
  if (e && BILLING_EMAIL_REGEX.test(e)) {
    return { firstName: "", lastName: "", email: e.slice(0, 254) };
  }

  return null;
}

async function linkDonorByEmailOrInsert(
  supabase: WebhookAdminClient,
  userId: string,
  firstName: string,
  lastName: string,
  emailRaw: string | null | undefined
): Promise<number | null> {
  const email = emailRaw?.trim();
  if (!email) return null;

  const { data: byEmail } = await supabase
    .from("donors")
    .select("id, user_id")
    .eq("email", email)
    .maybeSingle();

  if (byEmail?.id) {
    if (!byEmail.user_id || byEmail.user_id === userId) {
      await supabase
        .from("donors")
        .update({
          user_id: userId,
          first_name: firstName.slice(0, 100) || "Unknown",
          last_name: lastName.slice(0, 100),
        })
        .eq("id", byEmail.id);
      return byEmail.id;
    }
    return null;
  }

  const { data: inserted, error } = await supabase
    .from("donors")
    .insert({
      user_id: userId,
      first_name: firstName.slice(0, 100) || "Unknown",
      last_name: lastName.slice(0, 100),
      email,
    })
    .select("id")
    .single();

  if (inserted?.id) return inserted.id;

  if (error) {
    const { data: race } = await supabase
      .from("donors")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    if (race?.id && (!race.user_id || race.user_id === userId)) {
      await supabase
        .from("donors")
        .update({
          user_id: userId,
          first_name: firstName.slice(0, 100) || "Unknown",
          last_name: lastName.slice(0, 100),
        })
        .eq("id", race.id);
      return race.id;
    }
  }

  return null;
}

/** Used by Stripe webhooks and recurring sync when the donor row is keyed by auth user_id. */
export async function getOrCreateDonorIdForUser(
  supabase: WebhookAdminClient,
  userId: string
): Promise<number | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("donors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.id) return data.id;

  const { data: supporter } = await supabase
    .from("supporter_profiles")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (supporter) {
    return linkDonorByEmailOrInsert(
      supabase,
      userId,
      supporter.first_name,
      supporter.last_name,
      supporter.email
    );
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!userRow) return null;

  return linkDonorByEmailOrInsert(
    supabase,
    userId,
    userRow.first_name || "Unknown",
    userRow.last_name || "",
    userRow.email
  );
}

export async function getOrCreateDonorFromBilling(
  supabase: WebhookAdminClient,
  billing: BillingInfo
): Promise<number | null> {
  const email = billing.email?.trim();
  if (!email) return null;

  const firstName = (billing.firstName ?? "Unknown").slice(0, 100);
  const lastName = (billing.lastName ?? "").slice(0, 100);

  const { data: existing } = await supabase
    .from("donors")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: inserted } = await supabase
    .from("donors")
    .insert({
      user_id: null,
      first_name: firstName || "Unknown",
      last_name: lastName,
      email,
    })
    .select("id")
    .single();

  if (inserted?.id) return inserted.id;

  const { data: retry } = await supabase
    .from("donors")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return retry?.id ?? null;
}

export async function ensureDonationFromPaymentIntent(
  paymentIntentId: string
): Promise<void> {
  console.log("[ensureDonation] called with", paymentIntentId);
  if (!stripe || !paymentIntentId) {
    console.error("[ensureDonation] missing stripe or paymentIntentId");
    return;
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  console.log("[ensureDonation] pi.status:", pi.status, "metadata:", pi.metadata);

  if (pi.status !== "succeeded") return;

  const supabase = getWebhookAdminClient();
  const existing = await supabase
    .from("page_donations")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existing.data) {
    console.log("[ensureDonation] record already exists, id:", existing.data.id);
    const desFromMeta = designationFromStripeMetadata(pi.metadata || undefined);
    const pageIdFromMeta = pi.metadata?.page_id ? parseInt(pi.metadata.page_id, 10) : null;
    const missionAgencyName =
      pageIdFromMeta && !Number.isNaN(pageIdFromMeta)
        ? await resolveMissionAgencyNameFromPageId(supabase, pageIdFromMeta)
        : null;
    if (desFromMeta) {
      await supabase
        .from("page_donations")
        .update({ designation: desFromMeta, mission_agency_name: missionAgencyName })
        .eq("stripe_payment_intent_id", paymentIntentId);
    } else if (missionAgencyName) {
      await supabase
        .from("page_donations")
        .update({ mission_agency_name: missionAgencyName })
        .eq("stripe_payment_intent_id", paymentIntentId);
    }
    const { error: updErr } = await supabase
      .from("page_donations")
      .update({
        donor_first_name: (pi.metadata?.billing_first_name || "").trim() || null,
        donor_last_name: (pi.metadata?.billing_last_name || "").trim() || null,
        donor_email: (pi.metadata?.billing_email || "").trim() || null,
      })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .is("donor_first_name", null);
    if (updErr) console.error("[ensureDonation] update error:", updErr);
    return;
  }

  const meta = pi.metadata || {};
  const baseCents = parseInt(meta.base_amount_cents || "0", 10);
  const pageId = meta.page_id ? parseInt(meta.page_id, 10) : null;
  const userId = meta.user_id || "";
  const designation = designationFromStripeMetadata(meta);
  const donorFirstName = (meta.billing_first_name || "").trim() || null;
  const donorLastName = (meta.billing_last_name || "").trim() || null;
  const donorEmail = (meta.billing_email || "").trim() || null;

  console.log("[ensureDonation] parsed:", { baseCents, pageId, userId, designation, donorFirstName, donorLastName, donorEmail });

  if (baseCents < 100 || !pageId || Number.isNaN(pageId)) {
    console.error("[ensureDonation] invalid metadata — aborting. baseCents:", baseCents, "pageId:", pageId);
    return;
  }

  const missionAgencyName = await resolveMissionAgencyNameFromPageId(supabase, pageId);

  let donorId: number | null = null;
  if (userId) {
    donorId = await getOrCreateDonorIdForUser(supabase, userId);
  } else {
    const billing: BillingInfo = {
      firstName: meta.billing_first_name,
      lastName: meta.billing_last_name,
      email: meta.billing_email,
    };
    donorId = await getOrCreateDonorFromBilling(supabase, billing);
  }

  const amountDollars = baseCents / 100;
  console.log("[ensureDonation] inserting donation:", { pageId, amountDollars, donorId, designation, donorFirstName });

  const { data: inserted, error: insertError } = await supabase
    .from("page_donations")
    .insert({
      donor_id: donorId,
      page_id: pageId,
      amount: amountDollars,
      currency: "USD",
      transaction_ref: pi.id,
      status: "Complete",
      type: "one_time",
      stripe_payment_intent_id: pi.id,
      user_id: userId || null,
      designation,
      mission_agency_name: missionAgencyName,
      donor_first_name: donorFirstName,
      donor_last_name: donorLastName,
      donor_email: donorEmail,
    })
    .select("id")
    .single();

  if (insertError) {
    const pgCode = (insertError as { code?: string }).code;
    if (pgCode === "23505") {
      console.log("[ensureDonation] row already exists for PI, skipping");
      return;
    }
    console.error("[ensureDonation] INSERT FAILED:", insertError);
  } else {
    console.log("[ensureDonation] inserted successfully, id:", inserted?.id);
  }
}

/**
 * @deprecated Use syncRecurringDonationBySubscriptionId when subscription_id is available in the URL.
 */
export async function ensureRecurringDonationFromPaymentIntent(
  paymentIntentId: string
): Promise<void> {
  await syncDonationAfterSuccessfulRedirect(paymentIntentId);
}

export type DonateSuccessKind = "recurring" | "one_time";

/**
 * Primary path for monthly donations after redirect.
 * Uses the subscription ID (passed in return URL) to find the latest paid invoice directly —
 * avoiding the PI→invoice lookup which is unreliable in Stripe SDK v20+.
 */
export async function syncRecurringDonationBySubscriptionId(
  subscriptionId: string
): Promise<DonateSuccessKind> {
  if (!stripe || !subscriptionId) return "one_time";
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    const invRaw = (subscription as Stripe.Subscription & {
      latest_invoice?: string | Stripe.Invoice | null;
    }).latest_invoice;
    if (!invRaw) {
      console.error("syncRecurringDonation: no latest_invoice on subscription", subscriptionId);
      return "recurring";
    }
    const invoiceId = typeof invRaw === "string" ? invRaw : invRaw.id;
    const supabase = getWebhookAdminClient();
    await persistHarvest21RecurringDonationForInvoice(stripe, supabase, invoiceId);
    return "recurring";
  } catch (e) {
    console.error("syncRecurringDonationBySubscriptionId failed:", e);
    return "recurring";
  }
}

/**
 * Fallback path: detects subscription (invoice-backed) PIs when subscription_id is not in URL.
 * Note: Stripe SDK v20+ removed `invoice` from PaymentIntent types; this tries expand as fallback.
 */
export async function syncDonationAfterSuccessfulRedirect(
  paymentIntentId: string
): Promise<DonateSuccessKind> {
  if (!stripe || !paymentIntentId) return "one_time";
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["invoice"],
    });
    if (pi.status !== "succeeded") return "one_time";

    const supabase = getWebhookAdminClient();
    const piExt = pi as Stripe.PaymentIntent & {
      invoice?: string | Stripe.Invoice | null;
    };
    if (piExt.invoice) {
      const invoiceId = typeof piExt.invoice === "string" ? piExt.invoice : piExt.invoice.id;
      const handled = await persistHarvest21RecurringDonationForInvoice(stripe, supabase, invoiceId);
      if (handled) return "recurring";
    }

    await ensureDonationFromPaymentIntent(paymentIntentId);
    return "one_time";
  } catch (e) {
    console.error("syncDonationAfterSuccessfulRedirect failed:", e);
    return "one_time";
  }
}
