"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  variant?: "light" | "dark";
  trapFocus?: boolean;
  elevation?: "default" | "high";
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  variant = "light",
  trapFocus = false,
  elevation = "default",
}: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (!trapFocus || e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, trapFocus]);

  useEffect(() => {
    if (isOpen && trapFocus) {
      const focusTarget = closeButtonRef.current ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusTarget?.focus();
    }
  }, [isOpen, trapFocus]);

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    fullscreen: "max-w-full w-full h-full max-h-full",
  };

  const isDark = variant === "dark";
  const zOverlay = elevation === "high" ? "z-[201]" : "z-[100]";
  const zContent = elevation === "high" ? "z-[202]" : "z-[101]";

  const hideClass = isClosing ? "opacity-0 pointer-events-none" : "";

  const modalContent = (
    <>
      <div
        className={`fixed inset-0 bg-black/50 ${zOverlay} ${hideClass}`}
        onClick={handleClose}
        aria-hidden
      />
      <div
        className={`fixed inset-0 ${zContent} ${size === "fullscreen" ? "" : "flex items-center justify-center p-4"} ${hideClass}`}
        role="presentation"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={isOpen ? "modal-title" : undefined}
          className={`${isDark ? "bg-[#1a1a1a] border border-white/10" : "bg-white"} ${size === "fullscreen" ? "rounded-none h-full w-full" : "rounded-lg shadow-xl max-h-[90vh]"} ${sizeClasses[size]} ${size === "fullscreen" ? "" : "w-full"} flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between p-6 ${isDark ? "border-b border-white/10" : "border-b border-zinc-200"}`}>
            <h2 id="modal-title" className={`text-xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className={`p-1 rounded ${isDark ? "text-[#a0a0a0] hover:text-white hover:bg-white/5" : "hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className={`p-6 flex-1 min-h-0 ${isDark ? "text-white" : ""}`}>{children}</div>
        </div>
      </div>
    </>
  );

  if (!isOpen) return null;
  return typeof window !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}

