"use client";
import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type DropdownProps = {
  label: string;
  children: ReactNode;
  badge?: number;
  className?: string;
  selectedValue?: string;
  onClose?: () => void;
};

export function Dropdown({ label, children, badge, className, selectedValue, onClose }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const displayLabel = selectedValue || label;

  return (
    <div className={cn("relative", className)} ref={dropdownRef} data-dropdown>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 cursor-pointer"
      >
        {displayLabel}
        {badge !== undefined && badge > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {badge}
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </button>
      {isOpen && (
        <div 
          className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          onClick={(e) => {
            // Close dropdown when clicking inside the dropdown menu (after item click)
            e.stopPropagation();
            setTimeout(() => setIsOpen(false), 100);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

