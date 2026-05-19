import type { WebhookAdminClient } from "@/lib/webhookAdminClient";

export async function generateDonationReceiptNumber(
  supabase: WebhookAdminClient,
  donationId: number,
  donorId: number | null,
  amount: number,
  currency: string
): Promise<string> {
  const { data: rows } = await supabase
    .from("donation_receipts")
    .select("receipt_number")
    .eq("page_donation_id", donationId)
    .order("id", { ascending: false })
    .limit(1);
  const existing = rows?.[0];
  if (existing?.receipt_number) {
    return existing.receipt_number;
  }
  const receiptNumber = `H21-${Date.now()}-${donationId}`;
  const { error } = await supabase.from("donation_receipts").insert({
    page_donation_id: donationId,
    donor_id: donorId,
    amount,
    currency,
    receipt_number: receiptNumber,
  });
  if (!error) {
    return receiptNumber;
  }
  if (error.code === "23505") {
    const { data: retryRows } = await supabase
      .from("donation_receipts")
      .select("receipt_number")
      .eq("page_donation_id", donationId)
      .order("id", { ascending: false })
      .limit(1);
    const retry = retryRows?.[0];
    if (retry?.receipt_number) {
      return retry.receipt_number;
    }
    const receiptNumber2 = `H21-${Date.now()}-${donationId}-${Math.random().toString(36).slice(2, 10)}`;
    const { error: err2 } = await supabase.from("donation_receipts").insert({
      page_donation_id: donationId,
      donor_id: donorId,
      amount,
      currency,
      receipt_number: receiptNumber2,
    });
    if (!err2) {
      return receiptNumber2;
    }
    if (err2.code === "23505") {
      const { data: retry2Rows } = await supabase
        .from("donation_receipts")
        .select("receipt_number")
        .eq("page_donation_id", donationId)
        .order("id", { ascending: false })
        .limit(1);
      const r2 = retry2Rows?.[0];
      if (r2?.receipt_number) {
        return r2.receipt_number;
      }
    }
  }
  console.error("donation_receipts insert failed:", error);
  throw error;
}
