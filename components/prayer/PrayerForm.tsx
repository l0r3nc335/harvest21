"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Prayer, PrayerFormData } from "@/lib/prayerActions";

type PrayerFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PrayerFormData) => Promise<void>;
  initialData?: Prayer | null;
  footerSlot?: ReactNode;
};

export function PrayerForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  footerSlot,
}: PrayerFormProps) {
  const MAX_LENGTH = 500;
  const [body, setBody] = useState(initialData?.body ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formKey = `${isOpen}-${initialData?.id ?? "new"}`;

  // Update body when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setBody(initialData?.body ?? "");
    }
  }, [isOpen, initialData?.body]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        body: body.trim(),
        visibility: initialData?.visibility || "public",
      });
      // Clear the form and close modal after successful submission
      setBody("");
      onClose();
    } catch (error) {
      // Error is already handled by the parent component with toast
      // Keep the form open and text intact so user can retry
      console.error("Failed to submit prayer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Prayer Request" : "Post A Prayer Request"}
      size="md"
      variant="dark"
    >
      <div className="flex flex-col max-h-[calc(90vh-120px)] overflow-y-auto scrollbar-yellow p-4 space-y-6">
        <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-white">Write a prayer request</p>
            <textarea
              value={body}
              onChange={(e) =>
                setBody(e.target.value.slice(0, MAX_LENGTH))
              }
              placeholder="Type something"
              required
              rows={6}
              maxLength={MAX_LENGTH}
              className="w-full rounded-lg border border-white/20 bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-[#a0a0a0] focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 resize-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                <span className={body.length >= MAX_LENGTH ? "text-red-400" : ""}>
                  {body.length} / {MAX_LENGTH}
                </span>
                {body.length >= MAX_LENGTH && <span className="text-red-400">(Limit reached)</span>}
              </div>
              {body.length >= MAX_LENGTH && (
                <span className="text-xs text-red-400 font-medium">Maximum length reached</span>
              )}
            </div>
          </div>

          {footerSlot}

          <div className="flex flex-col gap-3 pt-2 border-t border-white/10 sm:flex-row sm:justify-end sm:items-center">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={isSubmitting}
              className="w-full border-white/20 bg-transparent text-white hover:bg-white/5 hover:border-white/30 transition-colors sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#E1B94D] text-black hover:bg-[#d4a639] disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              {isSubmitting ? "Posting..." : initialData ? "Update" : "Post"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

