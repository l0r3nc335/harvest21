"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Banknote } from "lucide-react";
import toast from "react-hot-toast";

type PayoutStatus = "not_started" | "pending" | "enabled" | "restricted" | "incomplete";

export function PayoutSetupSection() {
  const [status, setStatus] = useState<PayoutStatus>("not_started");
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stripe-connect/account-status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status as PayoutStatus);
        }
      } catch {
        console.error("Failed to fetch payout status");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSetupPayouts = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/stripe-connect/create-account", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to start payout setup");
        setIsRedirecting(false);
      }
    } catch {
      toast.error("Network error");
      setIsRedirecting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "enabled":
        return <Badge variant="success">Payouts Enabled</Badge>;
      case "pending":
        return <Badge variant="warning">Pending Verification</Badge>;
      case "restricted":
        return <Badge variant="warning">Restricted</Badge>;
      case "incomplete":
        return <Badge variant="danger">Incomplete</Badge>;
      default:
        return <Badge variant="default">Not Started</Badge>;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case "enabled":
        return "Your payout account is fully set up. You are eligible to receive donation payouts.";
      case "pending":
        return "Your payout setup is pending verification by Stripe.";
      case "restricted":
        return "Your account has been verified but payouts are currently restricted. Please complete any outstanding requirements.";
      case "incomplete":
        return "Your payout setup is incomplete. Please complete the Stripe onboarding process to receive payouts.";
      default:
        return "Connect your bank account through Stripe to receive donation payouts securely.";
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-zinc-200 rounded dark:bg-zinc-800" />
          <div className="h-4 w-full bg-zinc-200 rounded dark:bg-zinc-800" />
          <div className="h-10 w-40 bg-zinc-200 rounded dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 mb-4">
        <Banknote className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Payout Setup</h3>
        {getStatusBadge()}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        {getStatusMessage()}
      </p>

      {status !== "enabled" && (
        <Button
          variant="primary"
          onClick={handleSetupPayouts}
          disabled={isRedirecting}
          className="bg-[#D3AF37] text-black hover:bg-[#C19E2E]"
        >
          {isRedirecting
            ? "Redirecting to Stripe…"
            : status === "not_started"
            ? "Set Up Payouts"
            : "Complete Payout Setup"}
        </Button>
      )}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        All banking and identity information is collected directly by Stripe. Harvest 21 never sees or stores your bank details.
      </p>
    </div>
  );
}
