"use client";

import { useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Radio } from "@/components/ui/Radio";
import { LoginModal } from "@/components/auth/LoginModal";
import {
  processingFeeCents,
  totalChargeCents,
  formatUsd,
} from "@/lib/stripeHelpers";
import toast from "react-hot-toast";

const SUGGESTED_AMOUNTS_CENTS = [2500, 5000, 10000];
const MIN_CENTS = 100;
const MAX_CENTS = 99999900;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DonateFormClientProps = {
  pageId?: number | null;
  missionaryName?: string | null;
  isLoggedIn?: boolean;
};

function getStripePromise() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  return loadStripe(key);
}

const stripePromise = getStripePromise();

function DonateFormInner({
  pageId,
  frequency,
  subscriptionId,
  onSuccess,
}: {
  pageId?: number | null;
  frequency: "one_time" | "monthly";
  subscriptionId?: string | null;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    try {
      const base = `${window.location.origin}/donate`;
      let returnUrl = pageId ? `${base}?page_id=${pageId}` : base;
      if (frequency === "monthly") {
        returnUrl += "&type=subscription";
        if (subscriptionId) returnUrl += `&subscription_id=${encodeURIComponent(subscriptionId)}`;
      }
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
      });
      if (error) {
        toast.error(error.message ?? "Payment failed");
        setIsSubmitting(false);
        return;
      }
      onSuccess();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button
        type="submit"
        variant="primary"
        disabled={!stripe || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Processing…" : "Donate"}
      </Button>
    </form>
  );
}

export function DonateFormClient({ pageId, missionaryName, isLoggedIn = false }: DonateFormClientProps) {
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(5000);
  const [customAmount, setCustomAmount] = useState("");
  const [designation, setDesignation] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [idempotencyKey] = useState<string>(() =>
    `donate-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const isMonthlyGate = !isLoggedIn && frequency === "monthly";

  if (!stripePromise) {
    return (
      <p className="text-zinc-400">Payment is not configured. Please try again later.</p>
    );
  }

  const amountCents =
    selectedAmountCents ??
    (customAmount.trim() ? Math.round(parseFloat(customAmount) * 100) : null);

  const isValidAmount =
    amountCents !== null &&
    amountCents >= MIN_CENTS &&
    amountCents <= MAX_CENTS &&
    !Number.isNaN(amountCents);

  const feeCents = amountCents != null ? processingFeeCents(amountCents) : 0;
  const totalCents = amountCents != null ? totalChargeCents(amountCents) : 0;

  const billingValid =
    isLoggedIn ||
    (email.trim().length > 0 &&
      EMAIL_REGEX.test(email.trim()) &&
      firstName.trim().length <= 100 &&
      lastName.trim().length <= 100);

  const handleConfirmAmount = async () => {
    if (!isValidAmount || amountCents == null) {
      toast.error("Enter a valid amount (min $1)");
      return;
    }
    if (!billingValid) {
      toast.error("Please enter your name and a valid email address.");
      return;
    }
    try {
      const body: Record<string, unknown> = {
        amountCents,
        pageId: pageId ?? null,
        idempotencyKey,
        frequency,
        designation: designation.trim().slice(0, 50) || null,
      };
      if (!isLoggedIn) {
        body.billing = {
          firstName: firstName.trim().slice(0, 100),
          lastName: lastName.trim().slice(0, 100),
          email: email.trim().slice(0, 254),
        };
      }
      const res = await fetch("/api/donate/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not start payment");
        return;
      }
      setClientSecret(data.clientSecret);
      if (data.subscriptionId) setSubscriptionId(data.subscriptionId);
    } catch {
      toast.error("Network error. Try again.");
    }
  };

  const options = {
    clientSecret: clientSecret ?? undefined,
    appearance: {
      theme: "night" as const,
      variables: {
        colorPrimary: "#D3AF37",
        colorBackground: "#0a0a0a",
        colorText: "#f5f5f5",
        colorDanger: "#ef4444",
        borderRadius: "8px",
      },
    },
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      {missionaryName && (
        <div className="space-y-1">
          <p className="text-zinc-400">
            Donating to <span className="text-white font-medium">{missionaryName}</span>
          </p>
          <p className="text-sm text-zinc-500">100% of your donation goes to this ministry.</p>
        </div>
      )}
      {!missionaryName && (
        <div className="space-y-1">
          <p className="text-zinc-400">Donate to <span className="text-white font-medium">Harvest 21 </span></p>
          <p className="text-sm text-zinc-500">100% of your donation goes to this ministry.</p>
        </div>
      )}
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-300">Frequency</p>
        <div className="flex gap-4">
          <Radio
            name="frequency"
            value="one_time"
            checked={frequency === "one_time"}
            onChange={() => setFrequency("one_time")}
            label="One-time"
            labelClassName="text-zinc-300"
          />
          <Radio
            name="frequency"
            value="monthly"
            checked={frequency === "monthly"}
            onChange={() => setFrequency("monthly")}
            label="Monthly"
            labelClassName="text-zinc-300"
          />
        </div>
        {frequency === "monthly" && isLoggedIn && (
          <p className="mt-2 text-xs text-zinc-500">
            Your card will be charged on the same day each month. You can cancel anytime from your account settings.
          </p>
        )}
        {isMonthlyGate && (
          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 space-y-4">
            <p className="text-sm text-zinc-300">
              Only logged-in users can donate monthly.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={() => setIsLoginModalOpen(true)}
                className="rounded-lg"
              >
                Log in
              </Button>
              <Link
                href={pageId ? `/signup?redirect=${encodeURIComponent(`/donate?page_id=${pageId}`)}` : "/signup?redirect=" + encodeURIComponent("/donate")}
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </div>

      {!isMonthlyGate && (
      <>
      {!isLoggedIn && (
      <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">Billing Information</p>
          <div>
            <label htmlFor="donate-first-name" className="sr-only">First name</label>
            <Input
              id="donate-first-name"
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="donate-last-name" className="sr-only">Last name</label>
            <Input
              id="donate-last-name"
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="donate-email" className="sr-only">Email</label>
            <Input
              id="donate-email"
              type="email"
              placeholder="Email (required)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
          </div>
      </div>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-zinc-300">Amount (USD)</p>
        <div className="w-fit">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_AMOUNTS_CENTS.map((cents) => (
              <Button
                key={cents}
                type="button"
                variant={selectedAmountCents === cents ? "primary" : "secondary"}
                className="rounded-full"
                onClick={() => {
                  setSelectedAmountCents(cents);
                  setCustomAmount("");
                }}
              >
                ${cents / 100}
              </Button>
            ))}
          </div>
          <div className="mt-3">
            <label htmlFor="custom-amount" className="block w-full">
            <span className="sr-only">Custom amount</span>
            <Input
              id="custom-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="Custom amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmountCents(null);
              }}
              className="w-full"
            />
          </label>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="donate-designation" className="block mb-1.5 text-sm font-medium text-zinc-300">
          Designation{" "}
          <span className="font-normal text-zinc-500">(Optional)</span>
        </label>
        <div className="relative">
          <Input
            id="donate-designation"
            type="text"
            placeholder="e.g. Kenya Church Plant, Vehicle Fund"
            value={designation}
            onChange={(e) => setDesignation(e.target.value.slice(0, 50))}
            maxLength={50}
            className="w-full pr-16"
          />
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${
              designation.length >= 45 ? "text-yellow-500" : "text-zinc-500"
            }`}
          >
            {designation.length}/50
          </span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          More room to support general ministry
        </p>
      </div>

      {amountCents != null && amountCents >= MIN_CENTS && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Donation amount</span>
            <span>{formatUsd(amountCents)}</span>
          </div>
          <div className="mt-2 flex justify-between text-zinc-400">
            <span>Processing fee (2.9% + $0.30)</span>
            <span>{formatUsd(feeCents)}</span>
          </div>
          <div className="mt-2 flex justify-between font-semibold text-white">
            <span>Total charged</span>
            <span>{formatUsd(totalCents)}</span>
          </div>
        </div>
      )}

      {!clientSecret ? (
        <Button
          type="button"
          variant="primary"
          disabled={!isValidAmount || !billingValid}
          onClick={handleConfirmAmount}
          className="w-full"
        >
          Continue to payment
        </Button>
      ) : (
        <Elements stripe={stripePromise} options={options}>
          <DonateFormInner
            pageId={pageId}
            frequency={frequency}
            subscriptionId={subscriptionId}
            onSuccess={() => setClientSecret(null)}
          />
        </Elements>
      )}
      </>
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
