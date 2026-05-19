import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabaseServer";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export async function GET() {
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
    .select("id, stripe_account_id, payout_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!missionary) {
    return NextResponse.json({ error: "Missionary not found" }, { status: 404 });
  }

  if (!missionary.stripe_account_id) {
    return NextResponse.json({
      status: "not_started",
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
  }

  const account = await stripe.accounts.retrieve(missionary.stripe_account_id);

  let dbStatus: string;
  if (account.payouts_enabled) {
    dbStatus = "enabled";
  } else if (account.details_submitted) {
    dbStatus = "restricted";
  } else {
    dbStatus = "incomplete";
  }

  if (missionary.payout_status !== dbStatus) {
    await supabaseAdmin
      .from("missionaries")
      .update({
        payout_status: dbStatus,
        ...(dbStatus === "enabled" ? { payout_setup_completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", missionary.id);
  }

  return NextResponse.json({
    status: dbStatus,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  });
}
