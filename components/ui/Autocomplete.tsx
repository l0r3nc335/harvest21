"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { ChevronDown, Check } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

type AutocompleteOption = {
  id: string | number;
  name: string;
};

type AutocompleteProps = {
  value?: string;
  options: AutocompleteOption[];
  onSelect: (option: AutocompleteOption | null) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  isLoading?: boolean;
  onSearch?: (query: string) => void;
};

export function Autocomplete({
  value,
  options,
  onSelect,
  placeholder = "Search...",
  className,
  error = false,
  isLoading = false,
  onSearch,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef<string | undefined>(value);
  
  // Derive selected option from value prop and options
  const selectedOption = value 
    ? options.find((opt) => opt.id.toString() === value || opt.name === value) || null
    : null;

  // Update search query when value prop changes (defer to avoid cascading renders)
  useEffect(() => {
    if (lastValueRef.current !== value) {
      lastValueRef.current = value;
      // Use setTimeout to defer state update and avoid cascading renders
      setTimeout(() => {
        if (value && selectedOption) {
          setSearchQuery(selectedOption.name);
        } else if (!value && searchQuery && !isOpen) {
          // Only clear if dropdown is closed and we're not actively typing
          setSearchQuery("");
        }
      }, 0);
    }
  }, [value, selectedOption, searchQuery, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search query to selected option name when closing (if option is selected)
        if (selectedOption) {
          // Use setTimeout to avoid synchronous state updates in event handler
          setTimeout(() => {
            setSearchQuery(selectedOption.name);
          }, 0);
        }
        // If no option selected, keep the search query as is (don't clear input)
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedOption]);

  // When search query is empty, show first 20 items; otherwise filter and limit to 20
  const filteredOptions = searchQuery.trim() === ""
    ? options.slice(0, 20) // Show first 20 items when search is empty
    : options.filter((option) =>
        option.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20); // Limit to first 20 results

  const handleSelect = useCallback((option: AutocompleteOption) => {
    setSearchQuery(option.name);
    setIsOpen(false);
    onSelect(option);
  }, [onSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);
    
    // If query is cleared, clear selection but keep input visible
    if (query.trim() === "") {
      onSelect(null);
      // Fetch initial options when clearing
      if (onSearch) {
        onSearch("");
      }
    } else {
      // Trigger search callback
      if (onSearch) {
        onSearch(query);
      }
    }
  }, [onSearch, onSelect]);

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
    // When focusing, if search is empty, fetch initial options
    if (searchQuery.trim() === "" && onSearch) {
      onSearch("");
    }
  }, [searchQuery, onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery(""); // Keep input visible with empty string
    setIsOpen(true); // Keep dropdown open to show initial options
    onSelect(null);
    inputRef.current?.focus();
    // Fetch initial options when clearing
    if (onSearch) {
      onSearch("");
    }
  }, [onSelect, onSearch]);

  const displayValue = selectedOption ? selectedOption.name : searchQuery;

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={twMerge(
            clsx(
              error && "border-red-500",
              "pr-8"
            ),
            className
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {selectedOption && (
            <button
              type="button"
              onClick={handleClear}
              className="text-zinc-400 hover:text-zinc-600 text-xs"
            >
              ×
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen && searchQuery.trim() === "" && onSearch) {
                onSearch("");
              }
              inputRef.current?.focus();
            }}
            className="text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg max-h-80 overflow-auto dark:border-zinc-800 dark:bg-zinc-900">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">No results found</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={twMerge(
                  clsx(
                    "w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between",
                    selectedOption?.id === option.id && "bg-zinc-100 dark:bg-zinc-800"
                  )
                )}
              >
                <span>{option.name}</span>
                {selectedOption?.id === option.id && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

