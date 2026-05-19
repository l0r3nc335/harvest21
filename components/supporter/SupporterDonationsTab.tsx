"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { getDonationsForDonor, cancelRecurringDonation } from "@/app/settings/actions";
import { formatUsd } from "@/lib/stripeHelpers";
import toast from "react-hot-toast";

type DonorDonation = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  type: string;
  created_at: string;
  transaction_ref: string;
  stripe_subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  pageName: string | null;
  designation: string | null;
};

export function SupporterDonationsTab() {
  const [donations, setDonations] = useState<DonorDonation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<DonorDonation | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const result = await getDonationsForDonor();
      if (result.success) {
        setDonations(result.data as DonorDonation[]);
      }
      setIsLoading(false);
    })();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCancel = async () => {
    if (!cancelTarget?.stripe_subscription_id) return;
    setIsCanceling(true);
    const result = await cancelRecurringDonation(cancelTarget.stripe_subscription_id);
    if (result.success) {
      toast.success("Recurring donation canceled");
      const updated = await getDonationsForDonor();
      if (updated.success) setDonations(updated.data as DonorDonation[]);
    } else {
      toast.error(result.message || "Failed to cancel");
    }
    setIsCanceling(false);
    setCancelTarget(null);
  };

  const handleExportCSV = () => {
    const rows = [
      ["Date", "Recipient", "Designation", "Amount", "Type", "Status"],
      ...donations.map((d) => [
        formatDate(d.created_at),
        d.pageName ?? "",
        d.designation ?? "",
        formatUsd(Math.round(d.amount * 100)),
        d.type === "recurring" ? "Monthly" : "One-time",
        d.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-donations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Complete":
        return <Badge variant="success">Complete</Badge>;
      case "Failed":
        return <Badge variant="danger">Failed</Badge>;
      case "Refunded":
        return <Badge variant="warning">Refunded</Badge>;
      case "Disputed":
        return <Badge variant="danger">Disputed</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">My Donations</h2>
        {donations.length > 0 && (
          <Button variant="secondary" onClick={handleExportCSV} className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : donations.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">You haven&apos;t made any donations yet.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {donations.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-100">{d.pageName ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{d.designation ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-100">
                      {formatUsd(Math.round(d.amount * 100))}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {d.type === "recurring" ? "Monthly" : "One-time"}
                    </td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(d.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {d.type === "recurring" && d.stripe_subscription_id && d.status === "Complete" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                          onClick={() => setCancelTarget(d)}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {donations.map((d) => (
              <div key={d.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{d.pageName ?? "—"}</p>
                    {d.designation ? (
                      <p className="text-xs text-zinc-500 mt-0.5">Designation: {d.designation}</p>
                    ) : null}
                    <p className="text-xs text-zinc-400">{formatDate(d.created_at)}</p>
                  </div>
                  {getStatusBadge(d.status)}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {formatUsd(Math.round(d.amount * 100))}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {d.type === "recurring" ? "Monthly" : "One-time"}
                    </p>
                  </div>
                  {d.type === "recurring" && d.stripe_subscription_id && d.status === "Complete" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => setCancelTarget(d)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Recurring Donation"
        variant="dark"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Are you sure you want to cancel your monthly donation of{" "}
            <span className="font-medium text-white">
              {cancelTarget ? formatUsd(Math.round(cancelTarget.amount * 100)) : ""}
            </span>{" "}
            to{" "}
            <span className="font-medium text-white">
              {cancelTarget?.pageName ?? cancelTarget?.designation ?? "this ministry"}
            </span>
            ?
            No future charges will occur.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={isCanceling}>
              Keep Donating
            </Button>
            <Button
              variant="primary"
              onClick={handleCancel}
              disabled={isCanceling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCanceling ? "Canceling…" : "Yes, Cancel"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
