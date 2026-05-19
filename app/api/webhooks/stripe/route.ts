import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getWebhookAdminClient, type WebhookAdminClient } from "@/lib/webhookAdminClient";
import {
  getOrCreateDonorFromBilling,
  getOrCreateDonorIdForUser,
  designationFromStripeMetadata,
  resolveMissionAgencyNameFromPageId,
} from "@/lib/donationHelpers";
import {
  persistHarvest21RecurringDonationForInvoice,
  resolveInvoiceIdForPaymentIntent,
} from "@/lib/stripeRecurringDonationPersist";
import { isStripeResourceMissingError } from "@/lib/stripeResourceMissing";
import { runOneTimeDonationReceiptAndNotify } from "@/lib/oneTimeDonationSideEffects";
import { reportServerError } from "@/lib/errorReporting";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

async function createCancellationNotification(
  supabase: WebhookAdminClient,
  pageId: number,
  amountDollars: number
) {
  const missionaryUserId = await getMissionaryUserIdFromPageId(supabase, pageId);
  if (!missionaryUserId) return;

  await supabase.from("notifications").insert({
    user_id: missionaryUserId,
    type: "recurring_donation_cancelled",
    title: "Recurring Donation Canceled",
    message: `A monthly recurring donation of $${amountDollars.toFixed(2)} has been canceled.`,
    related_entity_type: "page",
    related_entity_id: pageId,
  });
}

export async function POST(request: NextRequest) {
  if (!webhookSecret || !stripe) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    reportServerError(err, {
      path: "/api/webhooks/stripe",
      method: "POST",
      extra: { detail: "signature_verification_failed" },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getWebhookAdminClient();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const piFromEvent = event.data.object as Stripe.PaymentIntent;
        let pi: Stripe.PaymentIntent = piFromEvent;
        if (stripe && piFromEvent.id) {
          try {
            pi = await stripe.paymentIntents.retrieve(piFromEvent.id, { expand: ["invoice"] });
          } catch (e) {
            if (isStripeResourceMissingError(e)) {
              reportServerError(e, {
                path: "/api/webhooks/stripe",
                method: "POST",
                extra: {
                  detail: "payment_intent_not_found_in_account",
                  paymentIntentId: piFromEvent.id,
                },
              });
              pi = piFromEvent;
            } else {
              throw e;
            }
          }
        }
        if (stripe) {
          const invoiceIdFromPi = await resolveInvoiceIdForPaymentIntent(stripe, pi);
          if (invoiceIdFromPi) {
            const handledAsSubscription = await persistHarvest21RecurringDonationForInvoice(
              stripe,
              supabase,
              invoiceIdFromPi
            );
            if (handledAsSubscription) {
              return NextResponse.json({ received: true });
            }
          }
        }

        const existing = await supabase
          .from("page_donations")
          .select("id")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();

        const meta = pi.metadata || {};
        const baseCents = parseInt(meta.base_amount_cents || "0", 10);
        const pageId = meta.page_id ? parseInt(meta.page_id, 10) : null;
        const userId = meta.user_id || "";
        const piType = meta.type || "one_time";
        const designation = designationFromStripeMetadata(meta);
        const billingFirstName = (meta.billing_first_name || "").trim() || null;
        const billingLastName = (meta.billing_last_name || "").trim() || null;
        const billingEmail = (meta.billing_email || "").trim() || null;

        if (baseCents < 100 || !pageId || Number.isNaN(pageId)) {
          reportServerError(new Error("Missing or invalid metadata"), {
            path: "/api/webhooks/stripe",
            method: "POST",
            extra: {
              event: "payment_intent.succeeded",
              paymentIntentId: pi.id,
              hasPageId: Boolean(pageId),
              hasValidAmount: baseCents >= 100,
            },
          });
          return NextResponse.json({ received: true });
        }

        const missionAgencyName = await resolveMissionAgencyNameFromPageId(supabase, pageId);

        if (piType === "recurring") {
          return NextResponse.json({ received: true });
        }

        const amountDollars = baseCents / 100;
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

        let freshInsert = false;
        let inserted = existing.data;
        if (!inserted) {
          const { data: newDonation, error: insertError } = await supabase
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
              donor_first_name: billingFirstName,
              donor_last_name: billingLastName,
              donor_email: billingEmail,
            })
            .select("id")
            .single();
          if (insertError) {
            const pgCode = (insertError as { code?: string }).code;
            if (pgCode === "23505") {
              const { data: raceWinner } = await supabase
                .from("page_donations")
                .select("id")
                .eq("stripe_payment_intent_id", pi.id)
                .maybeSingle();
              if (raceWinner) {
                inserted = raceWinner;
                freshInsert = false;
              } else {
                return NextResponse.json({ received: true });
              }
            } else {
              reportServerError(insertError, {
                path: "/api/webhooks/stripe",
                method: "POST",
                extra: {
                  event: "payment_intent.succeeded",
                  step: "insert_page_donations",
                  paymentIntentId: pi.id,
                },
              });
              return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
            }
          } else {
            inserted = newDonation;
            freshInsert = true;
          }
        } else {
          await supabase
            .from("page_donations")
            .update({
              status: "Complete",
              mission_agency_name: missionAgencyName,
            })
            .eq("stripe_payment_intent_id", pi.id);
        }

        if (inserted && freshInsert) {
          await runOneTimeDonationReceiptAndNotify(supabase, {
            donationId: inserted.id,
            donorId,
            userId,
            amountDollars,
            pageId,
            baseCents,
            designation,
          });
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const existing = await supabase
          .from("page_donations")
          .select("id")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();
        if (existing.data) {
          await supabase
            .from("page_donations")
            .update({ status: "Failed" })
            .eq("stripe_payment_intent_id", pi.id);
        } else {
          const meta = pi.metadata || {};
          const pageId = meta.page_id ? parseInt(meta.page_id, 10) : null;
          const userId = meta.user_id || "";
          const failedDesignation = designationFromStripeMetadata(meta);
          const failedFirstName = (meta.billing_first_name || "").trim() || null;
          const failedLastName = (meta.billing_last_name || "").trim() || null;
          const failedEmail = (meta.billing_email || "").trim() || null;
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
          const baseCents = parseInt(meta.base_amount_cents || "0", 10);
          const amountDollars = baseCents >= 100 ? baseCents / 100 : 0;
          if (pageId && !Number.isNaN(pageId) && amountDollars > 0) {
            const failedMissionAgencyName = await resolveMissionAgencyNameFromPageId(supabase, pageId);
            await supabase.from("page_donations").insert({
              donor_id: donorId,
              page_id: pageId,
              amount: amountDollars,
              currency: "USD",
              transaction_ref: pi.id,
              status: "Failed",
              type: "one_time",
              stripe_payment_intent_id: pi.id,
              user_id: userId || null,
              designation: failedDesignation,
              mission_agency_name: failedMissionAgencyName,
              donor_first_name: failedFirstName,
              donor_last_name: failedLastName,
              donor_email: failedEmail,
            });
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (stripe) {
          await persistHarvest21RecurringDonationForInvoice(stripe, supabase, invoice.id);
        }
        break;
      }

      case "invoice_payment.paid":
        // Recurring donations are handled via invoice.paid → persistHarvest21RecurringDonationForInvoice
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const existing = await supabase
          .from("page_donations")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();
        if (existing.data) return NextResponse.json({ received: true });
        break;
      }

      case "customer.subscription.created":
        break;

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subId = subscription.id;
        const meta = subscription.metadata || {};
        const pageId = meta.page_id ? parseInt(meta.page_id, 10) : null;

        if (pageId && !Number.isNaN(pageId)) {
          const { data: lastDonation } = await supabase
            .from("page_donations")
            .select("amount")
            .eq("stripe_subscription_id", subId)
            .eq("status", "Complete")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const amount = lastDonation?.amount ?? 0;
          await createCancellationNotification(supabase, pageId, amount);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

        if (piId) {
          const { data: donation } = await supabase
            .from("page_donations")
            .select("id, status")
            .eq("stripe_payment_intent_id", piId)
            .maybeSingle();

          if (donation && donation.status !== "Refunded") {
            await supabase
              .from("page_donations")
              .update({ status: "Refunded" })
              .eq("id", donation.id);
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : (dispute.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

        if (piId) {
          const { data: donation } = await supabase
            .from("page_donations")
            .select("id, status")
            .eq("stripe_payment_intent_id", piId)
            .maybeSingle();

          if (donation && donation.status !== "Disputed") {
            await supabase
              .from("page_donations")
              .update({ status: "Disputed" })
              .eq("id", donation.id);
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    reportServerError(err, {
      path: "/api/webhooks/stripe",
      method: "POST",
      extra: { eventType: event?.type },
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
