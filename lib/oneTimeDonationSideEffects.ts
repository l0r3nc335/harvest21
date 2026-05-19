import type { WebhookAdminClient } from "@/lib/webhookAdminClient";
import { generateDonationReceiptNumber } from "@/lib/donationReceipt";
import { sendDonationReceiptEmail } from "@/lib/stripeDonationEmails";

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

async function insertMissionaryDonationNotification(
  supabase: WebhookAdminClient,
  pageId: number,
  amountCents: number,
  designation?: string
) {
  const missionaryUserId = await getMissionaryUserIdFromPageId(supabase, pageId);
  if (!missionaryUserId) return;

  const netDollars = (amountCents / 100).toFixed(2);
  const designationSuffix = designation ? ` — Designation: "${designation}"` : "";

  await supabase.from("notifications").insert({
    user_id: missionaryUserId,
    type: "donation_received",
    title: "Donation Received",
    message: `A one-time donation of $${netDollars} (net) has been received.${designationSuffix}`,
    related_entity_type: "page",
    related_entity_id: pageId,
  });
}

export async function runOneTimeDonationReceiptAndNotify(
  supabase: WebhookAdminClient,
  args: {
    donationId: number;
    donorId: number | null;
    userId: string;
    amountDollars: number;
    pageId: number;
    baseCents: number;
    designation: string | null | undefined;
  }
): Promise<void> {
  const { donationId, donorId, userId, amountDollars, pageId, baseCents, designation } = args;
  const receiptNumber = await generateDonationReceiptNumber(
    supabase,
    donationId,
    donorId,
    amountDollars,
    "USD"
  );
  await insertMissionaryDonationNotification(supabase, pageId, baseCents, designation ?? undefined);
  try {
    await sendDonationReceiptEmail(
      supabase,
      userId,
      donorId,
      amountDollars,
      pageId,
      receiptNumber,
      donationId,
      designation ?? undefined
    );
  } catch (e) {
    console.error("Failed to send donor receipt email:", e);
  }
}
