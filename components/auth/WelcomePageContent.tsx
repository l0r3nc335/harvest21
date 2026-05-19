"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";
import {
  getPasswordCompositionFailure,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
  passwordStrengthMessage,
} from "@/lib/passwordPolicy";
import { supabase } from "@/lib/supabaseClient";

export default function WelcomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-4">Invalid Activation Link</h1>
          <p className="text-zinc-600 mb-6">
            This activation link is invalid or has expired. Please contact support for assistance.
          </p>
          <Button onClick={() => router.push("/")} variant="primary">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < PASSWORD_MIN_LENGTH) {
      toast.error(passwordStrengthMessage({ ok: false, reason: "too_short" }));
      return;
    }

    const compositionFail = getPasswordCompositionFailure(password);
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

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchWithCsrf("/api/activate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Failed to activate account");
        return;
      }

      const email = data.email as string | null;
      if (!email) {
        toast.success("Account activated. Please sign in.");
        router.push("/login");
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.error(signInError.message || "Failed to sign in");
        return;
      }

      if (signInData.session) {
        toast.success("Account activated successfully! Redirecting...");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("user-logged-in"));
        }
        setTimeout(() => {
          router.push("/settings");
        }, 1500);
      }
    } catch (error) {
      const msg =
        error instanceof Error && error.message.includes("CSRF")
          ? "Please refresh the page and try again."
          : "An unexpected error occurred";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Welcome to Harvest21!</h1>
          <p className="text-zinc-600">Set your password to activate your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              New Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <PasswordStrengthMeter
              password={password}
              minLength={PASSWORD_MIN_LENGTH}
              onValidityChange={setPasswordValid}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !passwordValid}
            className="w-full"
          >
            {isSubmitting ? "Activating..." : "Activate Account"}
          </Button>
        </form>

        <p className="text-xs text-zinc-500 text-center mt-6">
          Need help? Contact us at{" "}
          <a href="mailto:support@harvest21.com" className="text-blue-500 hover:underline">
            support@harvest21.com
          </a>
        </p>
      </div>
    </div>
  );
}
