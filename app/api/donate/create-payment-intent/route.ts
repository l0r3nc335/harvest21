import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer, type SupabaseServerClient } from "@/lib/supabaseServer";
import {
  getOrCreateDonorIdForUser,
  resolveBillingForAuthenticatedUser,
} from "@/lib/donationHelpers";
import { totalChargeCents } from "@/lib/stripeHelpers";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { createPaymentIntentSchema, parseBody } from "@/lib/validations";
import { logSecurityEvent } from "@/lib/securityLogger";
import { reportServerError } from "@/lib/errorReporting";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

async function getOrCreateStripeCustomer(
  stripeInstance: Stripe,
  supabaseAdmin: SupabaseServerClient,
  userId: string,
  email: string
): Promise<string> {
  const { data: donor } = await supabaseAdmin
    .from("donors")
    .select("id, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (donor?.stripe_customer_id) {
    try {
      await stripeInstance.customers.retrieve(donor.stripe_customer_id);
      return donor.stripe_customer_id;
    } catch {
      await supabaseAdmin
        .from("donors")
        .update({ stripe_customer_id: null })
        .eq("id", donor.id);
    }
  }

  const customer = await stripeInstance.customers.create({
    email,
    metadata: { user_id: userId },
  });

  if (donor) {
    await supabaseAdmin
      .from("donors")
      .update({ stripe_customer_id: customer.id })
      .eq("id", donor.id);
  } else {
    const donorId = await getOrCreateDonorIdForUser(supabaseAdmin, userId);
    if (donorId) {
      await supabaseAdmin
        .from("donors")
        .update({ stripe_customer_id: customer.id })
        .eq("id", donorId);
    }
  }

  return customer.id;
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
  }
  try {
    // Security: durable rate limiting (Upstash Redis when configured)
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "payment");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/donate/create-payment-intent", method: "POST" });
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const supabase = await getSupabaseServer();
    const supabaseAdmin = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    const rawBody = await request.json();
    const parsed = parseBody(createPaymentIntentSchema, rawBody);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", { ip, path: "/api/donate/create-payment-intent", detail: parsed.error });
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { amountCents, pageId, idempotencyKey, frequency, billing, designation } = parsed.data;

    const sanitizedDesignation = typeof designation === "string"
      ? designation.trim().slice(0, 50)
      : "";

    const totalCents = totalChargeCents(amountCents);
    const donationType = frequency === "monthly" ? "recurring" : "one_time";

    let resolvedBilling: { firstName: string; lastName: string; email: string } | null = null;
    if (user) {
      resolvedBilling = await resolveBillingForAuthenticatedUser(
        supabaseAdmin,
        user.id,
        user.email
      );
      if (!resolvedBilling) {
        return NextResponse.json(
          { error: "Add an email to your account before donating." },
          { status: 400 }
        );
      }
    }

    if (donationType === "recurring") {
      if (!user) {
        return NextResponse.json(
          { error: "Monthly donations require a logged-in account." },
          { status: 401 }
        );
      }

      const customerId = await getOrCreateStripeCustomer(
        stripe,
        supabaseAdmin,
        user.id,
        resolvedBilling!.email
      );
      const subMeta: Record<string, string> = {
        base_amount_cents: String(amountCents),
        page_id: pageId != null ? String(pageId) : "",
        type: "recurring",
        user_id: user.id,
        billing_first_name: resolvedBilling!.firstName,
        billing_last_name: resolvedBilling!.lastName,
        billing_email: resolvedBilling!.email,
      };
      subMeta.designation = sanitizedDesignation;
      subMeta.h21_designation = sanitizedDesignation;

      const price = await stripe.prices.create({
        unit_amount: totalCents,
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: pageId ? `Monthly donation (Page ${pageId})` : "Monthly donation to Harvest 21",
        },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
        metadata: subMeta,
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice | undefined;
      if (!invoice) {
        return NextResponse.json({ error: "No invoice created" }, { status: 500 });
      }
      const invoiceObj = invoice as Stripe.Invoice & {
        confirmation_secret?: { client_secret?: string } | null;
      };
      let clientSecret =
        invoiceObj.confirmation_secret?.client_secret ?? null;
      if (!clientSecret) {
        const paymentIntentRef = (invoice as { payment_intent?: string | Stripe.PaymentIntent | null }).payment_intent;
        let pi: Stripe.PaymentIntent | null = null;
        if (paymentIntentRef && typeof paymentIntentRef === "object") {
          pi = paymentIntentRef as Stripe.PaymentIntent;
        } else if (typeof paymentIntentRef === "string") {
          pi = await stripe.paymentIntents.retrieve(paymentIntentRef);
        }
        clientSecret = pi?.client_secret ?? null;
      }
      if (!clientSecret && typeof invoice === "object" && "id" in invoice) {
        const retrieved = await stripe.invoices.retrieve(invoice.id, {
          expand: ["confirmation_secret", "payment_intent"],
        });
        const retr = retrieved as Stripe.Invoice & {
          confirmation_secret?: { client_secret?: string } | null;
          payment_intent?: string | Stripe.PaymentIntent | null;
        };
        let piSecret: string | null = null;
        if (typeof retr.payment_intent === "object" && retr.payment_intent) {
          piSecret = retr.payment_intent.client_secret ?? null;
        } else if (typeof retr.payment_intent === "string") {
          const pi = await stripe.paymentIntents.retrieve(retr.payment_intent);
          piSecret = pi.client_secret ?? null;
        }
        clientSecret =
          retr.confirmation_secret?.client_secret ?? piSecret ?? null;
      }
      if (!clientSecret) {
        return NextResponse.json(
          { error: "Payment setup incomplete. Please try again." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        clientSecret,
        subscriptionId: subscription.id,
      });
    }

    const userId = user?.id ?? "";
    let billingEmail: string;
    let billingFirstName: string;
    let billingLastName: string;
    if (user && resolvedBilling) {
      billingEmail = resolvedBilling.email;
      billingFirstName = resolvedBilling.firstName;
      billingLastName = resolvedBilling.lastName;
    } else {
      const guestEmail = billing?.email?.trim();
      if (!guestEmail || !EMAIL_REGEX.test(guestEmail)) {
        return NextResponse.json(
          { error: "Valid email is required." },
          { status: 400 }
        );
      }
      billingEmail = guestEmail.slice(0, 254);
      billingFirstName = (billing?.firstName ?? "").trim().slice(0, 100);
      billingLastName = (billing?.lastName ?? "").trim().slice(0, 100);
    }

    const meta: Record<string, string> = {
      base_amount_cents: String(amountCents),
      page_id: pageId != null ? String(pageId) : "",
      user_id: userId,
      type: "one_time",
      billing_email: billingEmail,
      billing_first_name: billingFirstName,
      billing_last_name: billingLastName,
    };
    meta.designation = sanitizedDesignation;
    meta.h21_designation = sanitizedDesignation;

    const idemKey =
      typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? idempotencyKey
        : user
          ? `pi-${user.id}-${Date.now()}-${amountCents}`
          : `pi-guest-${Date.now()}-${amountCents}-${pageId ?? 0}`;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: meta,
      },
      { idempotencyKey: idemKey }
    );

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    const { incidentId } = reportServerError(err, {
      path: "/api/donate/create-payment-intent",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Payment setup failed", incidentId },
      { status: 500 }
    );
  }
}
