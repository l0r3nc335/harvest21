"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, X } from "lucide-react";

export type SearchWithFilterOption = {
  value: string;
  label: string;
};

type SearchWithFilterProps = {
  value: string;
  onValueChange: (value: string) => void;
  filters: SearchWithFilterOption[];
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showClearButton?: boolean;
  ariaLabelInput?: string;
  ariaLabelFilter?: string;
};

export function SearchWithFilter({
  value,
  onValueChange,
  filters,
  selectedFilter,
  onFilterChange,
  placeholder = "Search...",
  disabled = false,
  showClearButton = true,
  ariaLabelInput = "Search",
  ariaLabelFilter = "Filter options",
}: SearchWithFilterProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = filters.find((f) => f.value === selectedFilter) ?? filters[0];

  const closeDropdown = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDropdown();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDropdown]);

  const handleSelectFilter = (optionValue: string) => {
    onFilterChange(optionValue);
    closeDropdown();
  };

  return (
    <div
      ref={containerRef}
      className={`
        relative
        flex items-center w-full
        h-11 sm:h-12
        px-3 sm:px-4
        bg-white dark:bg-zinc-900
        border border-neutral-200 dark:border-zinc-700
        rounded-2xl
        shadow-sm
        transition-all duration-200
        focus-within:shadow-md focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10
        focus-within:border-neutral-300 dark:focus-within:border-zinc-600
      `}
    >
      <Search
        className="w-5 h-5 shrink-0 text-neutral-400 dark:text-zinc-500"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabelInput}
        className="flex-1 min-w-0 mx-2 sm:mx-3 py-2 bg-transparent border-0 text-sm text-neutral-900 dark:text-zinc-100 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {showClearButton && value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label="Clear search"
          className="shrink-0 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
        >
          <X className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
        </button>
      )}
      <div
        className="h-6 w-px shrink-0 bg-neutral-200 dark:bg-zinc-600"
        aria-hidden
      />
      <div className="relative shrink-0 min-w-0 pl-2 sm:pl-3">
        <button
          type="button"
          onClick={() => setIsFilterOpen((prev) => !prev)}
          disabled={disabled}
          aria-label={`${ariaLabelFilter}: ${selectedOption.label}`}
          aria-expanded={isFilterOpen}
          aria-haspopup="listbox"
          className="flex items-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 h-9 sm:h-auto py-2 px-2 sm:px-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-zinc-800 active:bg-neutral-200 dark:active:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-neutral-700 dark:text-zinc-300 overflow-hidden"
        >
          <span className="hidden sm:inline truncate min-w-0 max-w-[72px] md:max-w-[100px]">{selectedOption.label}</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isFilterOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      {isFilterOpen && (
        <div
          className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-48 top-full mt-1.5 min-w-0 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-700 rounded-xl shadow-lg py-1 z-50 animate-fade-in-up overflow-hidden"
          role="listbox"
        >
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selectedFilter === option.value}
              onClick={() => handleSelectFilter(option.value)}
              className={`w-full text-left px-4 py-2.5 text-sm min-h-[44px] sm:min-h-0 sm:py-2.5 transition-colors truncate ${
                selectedFilter === option.value
                  ? "bg-neutral-100 dark:bg-zinc-800 text-neutral-900 dark:text-zinc-100 font-medium"
                  : "text-neutral-700 dark:text-zinc-300 hover:bg-neutral-50 dark:hover:bg-zinc-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
