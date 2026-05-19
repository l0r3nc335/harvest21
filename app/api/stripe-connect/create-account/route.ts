import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabaseServer";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
  }

  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: missionary } = await supabaseAdmin
    .from("missionaries")
    .select("id, stripe_account_id, email, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!missionary) {
    return NextResponse.json({ error: "Missionary not found" }, { status: 404 });
  }

  let accountId = missionary.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: missionary.email || user.email || undefined,
      metadata: {
        missionary_id: String(missionary.id),
        user_id: user.id,
      },
      business_profile: {
        name: `${missionary.first_name} ${missionary.last_name}`,
      },
    });
    accountId = account.id;

    await supabaseAdmin
      .from("missionaries")
      .update({
        stripe_account_id: accountId,
        payout_status: "pending",
      })
      .eq("id", missionary.id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/settings?tab=account&payout=refresh`,
    return_url: `${baseUrl}/settings?tab=account&payout=complete`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
