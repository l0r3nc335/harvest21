"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  loadingText?: string;
  elevation?: "default" | "high";
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loadingText = "Processing...",
  elevation = "default",
}: ConfirmationModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error("Error in confirm handler:", error);
      setIsLoading(false);
      // Don't close modal on error
      return;
    }
    // Only close modal if confirm was successful
    setIsLoading(false);
    onClose();
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsLoading(false);
      onClose();
    }
  };

  const zOverlay = elevation === "high" ? "z-[201]" : "z-[100]";
  const zContent = elevation === "high" ? "z-[202]" : "z-[101]";

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 ${zOverlay} transition-opacity`}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`fixed inset-0 ${zContent} flex items-center justify-center p-4`}>
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  variant === "danger"
                    ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="p-1 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {message}
            </p>
            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{loadingText}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isLoading}
              className="text-sm px-4 py-2"
            >
              {cancelText}
            </Button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`text-sm px-4 py-2 rounded-md font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                variant === "danger"
                  ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:hover:bg-red-600"
                  : "bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500 disabled:hover:bg-yellow-500"
              }`}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return typeof window !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
