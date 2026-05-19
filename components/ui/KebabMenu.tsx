"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Trash2, UserCheck, UserX } from "lucide-react";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { cn } from "@/lib/utils";

type KebabMenuProps = {
  onDelete: () => void | Promise<void>;
  onDisable?: () => void;
  isDisabled?: boolean;
  className?: string;
  deleteMessage?: string;
};

export function KebabMenu({ 
  onDelete, 
  onDisable, 
  isDisabled = false, 
  className,
  deleteMessage = "Are you sure you want to delete this item? This action cannot be undone.",
}: KebabMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        buttonRef.current &&
        menuRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setPosition(null);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      
      // Calculate position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const menuHeight = 120; // Approximate height of menu
        
        // Position below button by default
        let top = rect.bottom + 8;
        const right = window.innerWidth - rect.right;
        
        // If not enough space below, position above
        if (rect.bottom + menuHeight > viewportHeight && rect.top > menuHeight) {
          top = rect.top - menuHeight - 8;
        }
        
        setPosition({ top, right });
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleDeleteClick = () => {
    setIsOpen(false);
    setPosition(null);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await onDelete();
    } catch (error) {
      console.error("Error in delete handler:", error);
      // Don't close modal on error, let user see the error toast
      return;
    }
    // Only close modal if delete was successful
    setShowConfirmModal(false);
  };

  const menuContent = isOpen && position && (
    <div
      ref={menuRef}
      className="fixed z-100 w-48 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
    >
      {onDisable && (
        <DropdownItem
          onClick={() => {
            onDisable();
            setIsOpen(false);
            setPosition(null);
          }}
          className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900"
        >
          {isDisabled ? (
            <UserCheck className="h-4 w-4" aria-hidden />
          ) : (
            <UserX className="h-4 w-4" aria-hidden />
          )}
          {isDisabled ? "Enable" : "Disable"}
        </DropdownItem>
      )}
      <DropdownItem
        onClick={handleDeleteClick}
        className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </DropdownItem>
    </div>
  );

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 cursor-pointer"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      {typeof window !== "undefined" && menuContent && createPortal(menuContent, document.body)}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        message={deleteMessage}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}

