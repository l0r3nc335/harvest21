"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import toast from "react-hot-toast";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";
import {
  getPasswordCompositionFailure,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
  passwordStrengthMessage,
} from "@/lib/passwordPolicy";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (!t) {
      setValidToken(false);
      setVerifying(false);
      return;
    }
    setToken(t);
    setValidToken(true);
    setVerifying(false);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(passwordStrengthMessage({ ok: false, reason: "too_short" }));
      return;
    }

    const compositionFail = getPasswordCompositionFailure(newPassword);
    if (compositionFail) {
      toast.error(passwordStrengthMessage({ ok: false, reason: compositionFail }));
      return;
    }

    if (!passwordValid) {
      toast.error(
        `${PASSWORD_REQUIREMENTS_TEXT} Use the strength meter until it shows valid.`
      );
      return;
    }

    if (!token) {
      toast.error("Missing reset token");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Updating password...");

    try {
      const res = await fetchWithCsrf("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        toast.error(
          typeof data?.message === "string"
            ? data.message
            : "Could not update password.",
          { id: toastId }
        );
        return;
      }

      toast.success("Password updated successfully!", { id: toastId });
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch {
      toast.error("An unexpected error occurred", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Verifying...</h2>
          <p className="text-zinc-600">Please wait while we verify your reset link.</p>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✕</span>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Invalid or Expired Link</h2>
          <p className="text-zinc-600 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link href="/forgot-password">
            <Button className="w-full bg-[#FFD700] hover:bg-[#E6B800] text-[#1A1A1A]">
              Request New Link
            </Button>
          </Link>
          <Link href="/" className="block mt-4 text-sm text-[#7BAFD4] hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Set New Password</h2>
        <p className="text-sm text-zinc-600">
          {PASSWORD_REQUIREMENTS_TEXT} Avoid reusing passwords from other sites.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="newPassword" className="block text-sm text-zinc-900">
            New Password
          </label>
          <div className="relative">
            <Input
              id="newPassword"
              name="newPassword"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              minLength={PASSWORD_MIN_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
              disabled={loading}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <PasswordStrengthMeter
            password={newPassword}
            minLength={PASSWORD_MIN_LENGTH}
            onValidityChange={setPasswordValid}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm text-zinc-900">
            Confirm New Password
          </label>
          <div className="relative">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              minLength={PASSWORD_MIN_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
              disabled={loading}
            >
              {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p className="text-sm text-red-600">Passwords do not match</p>
        )}

        <Button
          type="submit"
          className="w-full bg-[#FFD700] hover:bg-[#E6B800] text-[#1A1A1A]"
          disabled={loading || newPassword !== confirmPassword || !passwordValid}
        >
          Change Password
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

