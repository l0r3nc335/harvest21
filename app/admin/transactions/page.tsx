import { TransactionsPageClient } from "@/components/admin/TransactionsPage";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { Transaction } from "@/types/transaction";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getTransactions(): Promise<Transaction[]> {
  noStore();
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  const { data: donations, error } = await supabase
    .from("page_donations")
    .select(
      "id, amount, currency, status, type, created_at, transaction_ref, stripe_payment_intent_id, stripe_subscription_id, stripe_invoice_id, donor_id, page_id, designation, mission_agency_name, donor_first_name, donor_last_name, donor_email, donation_receipts!donation_receipts_page_donation_id_fkey(receipt_number, sent_at), donors(id, first_name, last_name, email), pages(name, organization_type, organization_id)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }

  const STRIPE_FEE_PERCENT = 0.029;
  const STRIPE_FEE_FIXED = 0.30;

  return (donations || []).map((d: Record<string, unknown>) => {
    const donor = d.donors as { id?: number; first_name?: string; last_name?: string; email?: string } | null;
    const page = d.pages as { name?: string; organization_type?: string } | null;
    const receiptRows = d.donation_receipts as { receipt_number?: string; sent_at?: string | null }[] | null;
    const receipt = receiptRows && receiptRows.length > 0 ? receiptRows[0] : null;
    const amount = (d.amount as number) || 0;
    const fee = Math.round((amount * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) * 100) / 100;
    const net = amount;
    const status = (d.status as string) || "Pending";

    // Prefer the direct billing fields saved on the donation, fall back to joined donor record
    const firstName = (d.donor_first_name as string) || donor?.first_name || "";
    const lastName = (d.donor_last_name as string) || donor?.last_name || "";
    const donorName = `${firstName} ${lastName}`.trim();
    const donorEmail = (d.donor_email as string) || donor?.email || "";

    const typeMap: Record<string, Transaction["type"]> = {
      one_time: "DONATION",
      recurring: "DONATION",
      Refunded: "REFUND",
      Disputed: "REFUND",
    };

    const statusMap: Record<string, Transaction["status"]> = {
      Complete: "COMPLETE",
      Failed: "FAILED",
      Pending: "PENDING",
      Refunded: "COMPLETE",
      Disputed: "FAILED",
    };

    return {
      id: String(d.id),
      transaction_number: (d.transaction_ref as string) || `TXN-${d.id}`,
      date: d.created_at as string,
      donor_id: donor ? String(donor.id) : "",
      donor_name: donorName || undefined,
      donor_email: donorEmail || undefined,
      received: amount,
      base_amount: amount,
      processing_fee: fee,
      gross_amount: amount,
      net_amount: net,
      type: status === "Refunded" || status === "Disputed" ? "REFUND" : (typeMap[(d.type as string)] || "DONATION"),
      donation_type: (d.type as string) === "recurring" ? "recurring" : "one_time",
      status: statusMap[status] || "PENDING",
      recipient_id: d.page_id ? String(d.page_id) : "",
      recipient_name: page?.name || "Harvest 21",
      mission_agency_name: (d.mission_agency_name as string | null) ?? null,
      payment_method: "Card",
      designation: (d.designation as string | null) ?? null,
      created_at: d.created_at as string,
      stripe_payment_intent_id: (d.stripe_payment_intent_id as string) || undefined,
      stripe_subscription_id: (d.stripe_subscription_id as string) || undefined,
      stripe_invoice_id: (d.stripe_invoice_id as string) || undefined,
      receipt_id: receipt?.receipt_number || undefined,
      receipt_sent_at: receipt?.sent_at ?? undefined,
    };
  });
}

function LoadingFallback() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-8 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="h-10 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
          <div className="h-10 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
          <div className="h-10 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                  <div className="h-3 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                </div>
                <div className="h-6 w-20 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function TransactionsData() {
  const transactions = await getTransactions();
  return <TransactionsPageClient initialTransactions={transactions} />;
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TransactionsData />
    </Suspense>
  );
}
