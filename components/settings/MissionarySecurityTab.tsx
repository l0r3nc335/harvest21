"use client";

import { useState } from "react";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";
import {
  getPasswordCompositionFailure,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
  passwordStrengthMessage,
} from "@/lib/passwordPolicy";

export function MissionarySecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
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

    setIsSaving(true);
    const toastId = toast.loading("Updating password...");

    try {
      const res = await fetchWithCsrf("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        toast.error(
          typeof data?.message === "string"
            ? data.message
            : "Failed to update password",
          { id: toastId }
        );
        return;
      }

      toast.success("Password updated successfully!", { id: toastId });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordValid(false);
    } catch {
      toast.error("An unexpected error occurred", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
        <h2 className="text-xl sm:text-2xl font-bold text-white">Security Settings</h2>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900 mb-3 sm:mb-4">Change Password</h3>
          <p className="text-xs sm:text-sm text-zinc-600 mb-4 sm:mb-6">
            Update your password to keep your account secure. Make sure to use a strong password.
          </p>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                Current Password
              </label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="pr-10 text-sm"
                  data-cy="input-currentPassword"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-400 hover:text-zinc-600"
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordValid(false);
                  }}
                  placeholder="Enter your new password"
                  className="pr-10 text-sm"
                  data-cy="input-newPassword"
                  minLength={PASSWORD_MIN_LENGTH}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-400 hover:text-zinc-600"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
              <PasswordStrengthMeter
                password={newPassword}
                minLength={PASSWORD_MIN_LENGTH}
                onValidityChange={setPasswordValid}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 mb-1.5 sm:mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-400 hover:text-zinc-600"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleChangePassword}
                disabled={isSaving || !passwordValid}
                className="bg-[#D3AF37] text-white hover:bg-[#c19d2d] text-xs sm:text-sm"
                data-cy="button-save-security"
              >
                {isSaving ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-zinc-900 mb-2">Two-Factor Authentication</h3>
        <p className="text-xs sm:text-sm text-zinc-600 mb-3 sm:mb-4">
          Add an extra layer of security to your account by enabling two-factor authentication.
        </p>
        <Button variant="secondary" disabled className="text-xs sm:text-sm">
          Coming Soon
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-zinc-900 mb-2">Active Sessions</h3>
        <p className="text-xs sm:text-sm text-zinc-600 mb-3 sm:mb-4">
          View and manage devices where you&apos;re currently logged in.
        </p>
        <Button variant="secondary" disabled className="text-xs sm:text-sm">
          Coming Soon
        </Button>
      </div>
    </div>
  );
}

