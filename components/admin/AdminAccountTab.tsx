"use client";

import { useState } from "react";
import { User, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type UserData = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number;
};

type AdminAccountTabProps = {
  user: UserData;
};

export function AdminAccountTab({ user }: AdminAccountTabProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading("Updating profile...");

    try {
      const { error } = await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq("user_id", user.id);

      if (error) {
        toast.error(error.message || "Failed to update profile", { id: toastId });
        return;
      }

      toast.success("Profile updated successfully!", { id: toastId });
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const toastId = toast.loading("Signing out...");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast.error(error.message || "Failed to sign out", { id: toastId });
        setIsLoggingOut(false);
        return;
      }

      toast.success("Successfully signed out!", { id: toastId });
      router.push("/");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred", { id: toastId });
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-[#D3AF37]" />
        <h2 className="text-2xl font-bold text-zinc-900">Account Settings</h2>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Profile Information</h3>
          <p className="text-sm text-zinc-600 mb-6">
            Update your account information.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                First Name
              </label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Last Name
              </label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input
                  type="email"
                  value={user.email}
                  disabled
                  placeholder="Enter your email address"
                  className="pl-10 bg-zinc-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Email address cannot be changed
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#D3AF37] text-black hover:bg-[#c4a030]"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">Sign Out</h3>
        <p className="text-sm text-zinc-600 mb-4">
          Sign out of your account. You will need to sign in again to access the admin panel.
        </p>
        <Button
          onClick={handleLogout}
          disabled={isLoggingOut}
          variant="secondary"
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Sign Out"}
        </Button>
      </div>
    </div>
  );
}

