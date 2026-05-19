"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Copy, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import type { Transaction } from "@/types/transaction";

type TransactionDetailModalProps = {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStripeDashboardUrl(t: Transaction): string | null {
  if (t.stripe_payment_intent_id) {
    return `https://dashboard.stripe.com/payments/${t.stripe_payment_intent_id}`;
  }
  if (t.stripe_subscription_id) {
    return `https://dashboard.stripe.com/subscriptions/${t.stripe_subscription_id}`;
  }
  if (t.stripe_invoice_id) {
    return `https://dashboard.stripe.com/invoices/${t.stripe_invoice_id}`;
  }
  return null;
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string | number | undefined | null;
  onCopy?: () => void;
}) {
  const display = value != null ? String(value) : "—";
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-500 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-zinc-900 truncate">{display}</span>
        {onCopy && value != null && (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
}: TransactionDetailModalProps) {
  if (!transaction) return null;

  const stripeUrl = getStripeDashboardUrl(transaction);

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details" size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-zinc-700">
            #{transaction.transaction_number}
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                transaction.status === "COMPLETE"
                  ? "success"
                  : transaction.status === "FAILED" || transaction.status === "CANCELLED"
                    ? "danger"
                    : "warning"
              }
            >
              {transaction.status}
            </Badge>
            <Badge variant="default" className="bg-zinc-100 text-zinc-800">
              {transaction.type}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50 p-4 space-y-0">
          <DetailRow
            label="Transaction #"
            value={transaction.transaction_number}
            onCopy={() => handleCopy("Transaction #", transaction.transaction_number)}
          />
          <DetailRow label="Date" value={formatDate(transaction.date)} />
          <DetailRow label="Donor Name" value={transaction.donor_name} />
          <DetailRow
            label="Donor Email"
            value={transaction.donor_email}
            onCopy={
              transaction.donor_email
                ? () => handleCopy("Donor Email", transaction.donor_email!)
                : undefined
            }
          />
          <DetailRow label="Recipient" value={transaction.recipient_name} />
        </div>

        {transaction.designation && (
          <div className="rounded-lg bg-zinc-50 p-4 space-y-0">
            <DetailRow label="Designation" value={transaction.designation} />
          </div>
        )}

        <div className="rounded-lg bg-zinc-50 p-4 space-y-0">
          <h3 className="text-sm font-medium text-zinc-700 mb-2">Amounts</h3>
          <DetailRow label="Donation Amount" value={formatCurrency(transaction.received)} />
          <DetailRow
            label="Processing Fee"
            value={
              transaction.processing_fee != null
                ? formatCurrency(transaction.processing_fee)
                : undefined
            }
          />
          <DetailRow
            label="Total Charged"
            value={
              transaction.processing_fee != null
                ? formatCurrency(transaction.received + transaction.processing_fee)
                : undefined
            }
          />
        </div>

        {(transaction.stripe_payment_intent_id ||
          transaction.stripe_subscription_id ||
          transaction.stripe_invoice_id) && (
          <div className="rounded-lg bg-zinc-50 p-4 space-y-0">
            <h3 className="text-sm font-medium text-zinc-700 mb-2">Stripe</h3>
            {transaction.stripe_payment_intent_id && (
              <DetailRow
                label="Payment Intent"
                value={transaction.stripe_payment_intent_id}
                onCopy={() =>
                  handleCopy("Payment Intent", transaction.stripe_payment_intent_id!)
                }
              />
            )}
            {transaction.stripe_subscription_id && (
              <DetailRow
                label="Subscription"
                value={transaction.stripe_subscription_id}
                onCopy={() =>
                  handleCopy("Subscription", transaction.stripe_subscription_id!)
                }
              />
            )}
            {transaction.stripe_invoice_id && (
              <DetailRow
                label="Invoice"
                value={transaction.stripe_invoice_id}
                onCopy={() => handleCopy("Invoice", transaction.stripe_invoice_id!)}
              />
            )}
          </div>
        )}

        {stripeUrl && (
          <a
            href={stripeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View in Stripe Dashboard
          </a>
        )}
      </div>
    </Modal>
  );
}
