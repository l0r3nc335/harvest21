import Stripe from "stripe";
import type { WebhookAdminClient } from "@/lib/webhookAdminClient";
import {
  getOrCreateDonorFromBilling,
  getOrCreateDonorIdForUser,
  omitStripeDesignationKeys,
  recurringDesignationFromStripe,
  resolveMissionAgencyNameFromPageId,
} from "@/lib/donationHelpers";
import { generateDonationReceiptNumber } from "@/lib/donationReceipt";
import {
  isStripeResourceMissingError,
  stripePaymentIntentRetrieveOrNull,
  stripeSubscriptionRetrieveOrNull,
} from "@/lib/stripeResourceMissing";
import { sendDonationReceiptEmail } from "@/lib/stripeDonationEmails";

function getPaymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const pi = (invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null })
    .payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return (pi as Stripe.PaymentIntent).id;
  return null;
}

async function resolvePaymentIntentIdFromInvoice(
  stripeClient: Stripe,
  invoice: Stripe.Invoice
): Promise<string | null> {
  const fromInvoice = getPaymentIntentIdFromInvoice(invoice);
  if (fromInvoice) return fromInvoice;

  const legacy = invoice as Stripe.Invoice & {
    charge?: string | Stripe.Charge | null;
  };
  const ch = legacy.charge;
  const chargeId =
    typeof ch === "string" ? ch : ch && typeof ch === "object" && "id" in ch ? ch.id : null;
  if (!chargeId) return null;

  let charge: Stripe.Charge;
  try {
    charge = await stripeClient.charges.retrieve(chargeId);
  } catch (e) {
    if (isStripeResourceMissingError(e)) return null;
    throw e;
  }
  const pi = charge.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return pi.id;
  return null;
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (details?.subscription) {
    const sub = details.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object" && "id" in sub) {
      return (sub as Stripe.Subscription).id;
    }
  }
  const legacy = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  if (typeof legacy.subscription === "string") return legacy.subscription;
  if (
    legacy.subscription &&
    typeof legacy.subscription === "object" &&
    "id" in legacy.subscription
  ) {
    return legacy.subscription.id;
  }
  for (const line of invoice.lines?.data ?? []) {
    const s = line.subscription;
    if (typeof s === "string") return s;
    if (s && typeof s === "object" && "id" in s) return s.id;
  }
  return null;
}

function mergeSubscriptionSnapshotMetadata(
  invoice: Stripe.Invoice,
  base: Stripe.Metadata | null
): Stripe.Metadata {
  const out: Record<string, string> = { ...(base || {}) };
  const snap = invoice.parent?.subscription_details?.metadata;
  if (snap) {
    for (const [k, v] of Object.entries(snap)) {
      if (v != null && String(v) !== "") out[k] = String(v);
    }
  }
  return out;
}

const HARVEST21_INVOICE_EXPAND: string[] = [
  "payment_intent",
  "lines.data.subscription",
  "parent.subscription_details.subscription",
];

async function retrieveInvoiceExpanded(
  stripeClient: Stripe,
  invoiceId: string
): Promise<Stripe.Invoice | null> {
  const attempts: string[][] = [
    HARVEST21_INVOICE_EXPAND,
    ["payment_intent", "lines.data.subscription"],
    ["payment_intent"],
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      return await stripeClient.invoices.retrieve(invoiceId, {
        expand: attempts[i],
      });
    } catch (e) {
      if (isStripeResourceMissingError(e)) {
        console.warn(
          "Stripe invoice not found for STRIPE_SECRET_KEY (test/live or account mismatch)",
          invoiceId
        );
        return null;
      }
      if (i === attempts.length - 1) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("invoice retrieve expand failed, retrying simpler", msg);
    }
  }
  return null;
}

async function getMissionaryUserIdFromPageId(
  supabase: WebhookAdminClient,
  pageId: number
): Promise<string | null> {
  const { data: page } = await supabase
    .from("pages")
    .select("organization_id, organization_type")
    .eq("id", pageId)
    .single();
  if (!page || page.organization_type !== "missionary") return null;
  const { data: missionary } = await supabase
    .from("missionaries")
    .select("user_id")
    .eq("id", page.organization_id)
    .single();
  return missionary?.user_id ?? null;
}

async function createDonationNotification(
  supabase: WebhookAdminClient,
  pageId: number,
  amountCents: number,
  donationType: string,
  designation?: string
) {
  const missionaryUserId = await getMissionaryUserIdFromPageId(supabase, pageId);
  if (!missionaryUserId) return;

  const netDollars = (amountCents / 100).toFixed(2);
  const typeLabel = donationType === "recurring" ? "monthly recurring" : "one-time";
  const designationSuffix = designation ? ` — Designation: "${designation}"` : "";

  await supabase.from("notifications").insert({
    user_id: missionaryUserId,
    type: "donation_received",
    title: "Donation Received",
    message: `A ${typeLabel} donation of $${netDollars} (net) has been received.${designationSuffix}`,
    related_entity_type: "page",
    related_entity_id: pageId,
  });
}

/**
 * Webhook invoice objects are often thin (no lines/parent). Always re-fetch with expand.
 * Returns true if this invoice is for a subscription payment (skip one-time PI handling).
 */
export async function persistHarvest21RecurringDonationForInvoice(
  stripeClient: Stripe,
  supabase: WebhookAdminClient,
  invoiceId: string
): Promise<boolean> {
  const invoice = await retrieveInvoiceExpanded(stripeClient, invoiceId);
  if (!invoice) {
    return true;
  }

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return false;

  const existing = await supabase
    .from("page_donations")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();
  if (existing.data) {
    return true;
  }

  const piId = await resolvePaymentIntentIdFromInvoice(stripeClient, invoice);
  if (piId) {
    const { data: rowByPi } = await supabase
      .from("page_donations")
      .select("id, stripe_invoice_id")
      .eq("stripe_payment_intent_id", piId)
      .maybeSingle();
    if (rowByPi?.id) {
      if (rowByPi.stripe_invoice_id === invoice.id) {
        return true;
      }
      const subscriptionRow = await stripeSubscriptionRetrieveOrNull(stripeClient, subscriptionId);
      if (!subscriptionRow) {
        return true;
      }
      const mergedDes = recurringDesignationFromStripe(subscriptionRow.metadata, invoice);
      await supabase
        .from("page_donations")
        .update({
          type: "recurring",
          stripe_subscription_id: subscriptionId,
          stripe_invoice_id: invoice.id,
          transaction_ref: invoice.id,
          ...(mergedDes != null ? { designation: mergedDes } : {}),
        })
        .eq("id", rowByPi.id);
      return true;
    }
  }

  let meta = mergeSubscriptionSnapshotMetadata(invoice, invoice.metadata);
  let subscription: Stripe.Subscription | null = null;
  if (subscriptionId) {
    subscription = await stripeSubscriptionRetrieveOrNull(stripeClient, subscriptionId);
    if (subscription) {
      meta = { ...meta, ...subscription.metadata };
    }
  }

  if (piId) {
    const piForDesignation = await stripePaymentIntentRetrieveOrNull(stripeClient, piId);
    if (piForDesignation) {
      meta = { ...omitStripeDesignationKeys(piForDesignation.metadata), ...meta };
    }
  }

  const designation = recurringDesignationFromStripe(subscription?.metadata, invoice);

  const pageId = meta.page_id ? parseInt(meta.page_id, 10) : null;
  if (!pageId || Number.isNaN(pageId)) {
    console.warn("persist recurring: missing page_id in metadata", invoice.id, {
      subscriptionId,
      metaKeys: Object.keys(meta),
    });
    return true;
  }

  const baseCentsParsed = meta.base_amount_cents
    ? parseInt(meta.base_amount_cents, 10)
    : NaN;
  const paidDollars = invoice.amount_paid ? invoice.amount_paid / 100 : 0;
  const amountDollars =
    !Number.isNaN(baseCentsParsed) && baseCentsParsed >= 100
      ? baseCentsParsed / 100
      : paidDollars;
  if (amountDollars <= 0) return true;
  const missionAgencyName = await resolveMissionAgencyNameFromPageId(supabase, pageId);

  const userId = meta.user_id || "";
  let donorId: number | null;
  if (userId) {
    donorId = await getOrCreateDonorIdForUser(supabase, userId);
  } else {
    donorId = await getOrCreateDonorFromBilling(supabase, {
      firstName: meta.billing_first_name,
      lastName: meta.billing_last_name,
      email: meta.billing_email,
    });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("page_donations")
    .insert({
      donor_id: donorId,
      page_id: pageId,
      amount: amountDollars,
      currency: "USD",
      transaction_ref: invoice.id,
      status: "Complete",
      type: "recurring",
      stripe_subscription_id: subscriptionId,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: piId || null,
      user_id: userId || null,
      designation,
      mission_agency_name: missionAgencyName,
    })
    .select("id")
    .single();

  if (insertError) {
    const pgCode = (insertError as { code?: string }).code;
    if (pgCode === "23505") return true;
    console.error("page_donations insert failed (subscription invoice):", insertError);
  }

  if (inserted) {
    const recurringReceiptNumber = await generateDonationReceiptNumber(
      supabase,
      inserted.id,
      donorId,
      amountDollars,
      "USD"
    );
    const baseCents = meta.base_amount_cents
      ? parseInt(meta.base_amount_cents, 10)
      : Math.round(amountDollars * 100);
    await createDonationNotification(supabase, pageId, baseCents, "recurring", designation ?? undefined);
    try {
      await sendDonationReceiptEmail(
        supabase,
        userId,
        donorId,
        amountDollars,
        pageId,
        recurringReceiptNumber,
        inserted.id,
        designation ?? undefined
      );
    } catch (e) {
      console.error("Failed to send donor receipt email:", e);
    }
  }

  return true;
}

export async function getInvoiceIdFromPaymentIntent(
  stripeClient: Stripe,
  pi: Stripe.PaymentIntent
): Promise<string | null> {
  const ext = pi as Stripe.PaymentIntent & {
    invoice?: string | Stripe.Invoice | null;
  };
  if (ext.invoice) {
    return typeof ext.invoice === "string" ? ext.invoice : ext.invoice.id;
  }
  const full = await stripePaymentIntentRetrieveOrNull(stripeClient, pi.id, {
    expand: ["invoice"],
  });
  if (!full) {
    return null;
  }
  const inv = full as Stripe.PaymentIntent & {
    invoice?: string | Stripe.Invoice | null;
  };
  if (!inv.invoice) return null;
  return typeof inv.invoice === "string" ? inv.invoice : inv.invoice.id;
}

/**
 * When the PI object has no invoice link yet (webhook race), find the invoice by
 * listing the customer's invoices or walking recent subscriptions' latest_invoice.
 */
export async function resolveInvoiceIdForPaymentIntent(
  stripeClient: Stripe,
  pi: Stripe.PaymentIntent
): Promise<string | null> {
  const fromPi = await getInvoiceIdFromPaymentIntent(stripeClient, pi);
  if (fromPi) return fromPi;

  const customerRaw = pi.customer;
  const customerId =
    typeof customerRaw === "string" ? customerRaw : customerRaw?.id ?? null;
  if (!customerId) return null;

  const statuses: Stripe.InvoiceListParams.Status[] = ["draft", "open", "paid"];
  for (const status of statuses) {
    const { data: invoices } = await stripeClient.invoices.list({
      customer: customerId,
      status,
      limit: 40,
    });
    for (const inv of invoices) {
      if (getPaymentIntentIdFromInvoice(inv) === pi.id) return inv.id;
    }
  }

  const { data: subs } = await stripeClient.subscriptions.list({
    customer: customerId,
    limit: 15,
    status: "all",
    expand: ["data.latest_invoice"],
  });
  for (const sub of subs) {
    const li = sub.latest_invoice;
    if (!li) continue;
    let inv: Stripe.Invoice;
    try {
      inv =
        typeof li === "object"
          ? (li as Stripe.Invoice)
          : await stripeClient.invoices.retrieve(li, { expand: ["payment_intent"] });
    } catch (e) {
      if (isStripeResourceMissingError(e)) {
        continue;
      }
      throw e;
    }
    if (getPaymentIntentIdFromInvoice(inv) === pi.id) return inv.id;
  }

  return null;
}
