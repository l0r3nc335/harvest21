"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const toastId = toast.loading("Sending reset email...");

    try {
      const response = await fetch("/api/send-reset-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Reset email sent! Check your inbox.", { id: toastId });
        setEmailSent(true);
      } else {
        toast.error(data.message || "Failed to send reset email", { id: toastId });
      }
    } catch (error) {
      console.error("Error sending reset email:", error);
      toast.error("An unexpected error occurred", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Check Your Email</h2>
          <p className="text-zinc-600 mb-6">
            If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <p className="text-sm text-zinc-500 mb-6">
            Didn&apos;t receive the email? Check your spam folder or try again.
          </p>
          <Button
            onClick={() => setEmailSent(false)}
            variant="secondary"
            className="w-full mb-4"
          >
            Try Another Email
          </Button>
          <Link href="/" className="text-sm text-[#7BAFD4] hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Forgot Password?</h2>
        <p className="text-sm text-zinc-600">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm text-zinc-900">
            Email Address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-[#FFD700] hover:bg-[#E6B800] text-[#1A1A1A]"
          disabled={loading}
        >
          Send Reset Link
        </Button>

        <div className="text-center">
          <Link href="/" className="text-sm text-[#7BAFD4] hover:underline">
            Back to Home
          </Link>
        </div>
      </form>
    </div>
  );
}

