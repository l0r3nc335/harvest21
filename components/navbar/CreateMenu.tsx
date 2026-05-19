"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

type CreateMenuProps = {
  onUpdate: () => void;
  onPrayerRequest: () => void;
};

export function CreateMenu({ onUpdate, onPrayerRequest }: CreateMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md bg-[#FFD700] px-4 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-[#E6B800]"
      >
        <Plus className="h-4 w-4" />
        Create
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-zinc-200 bg-white shadow-lg">
          <button
            onClick={() => {
              onUpdate();
              setIsOpen(false);
            }}
            className="w-full cursor-pointer px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-100"
          >
            Update
          </button>
          <button
            onClick={() => {
              onPrayerRequest();
              setIsOpen(false);
            }}
            className="w-full cursor-pointer px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-100"
          >
            Prayer Request
          </button>
        </div>
      )}
    </div>
  );
}

