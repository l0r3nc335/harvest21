"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";

interface FilterOption {
  value: string;
  label: string;
}

interface Filter {
  id: string;
  label: string;
  options: FilterOption[];
  defaultValue: string;
}

interface FilterBarProps {
  filters?: Filter[];
  onFilterChange?: (filterId: string, value: string) => void;
  className?: string;
}

const defaultFilters: Filter[] = [
  {
    id: "sortBy",
    label: "Sort By",
    options: [{ value: "default", label: "Default" }],
    defaultValue: "default",
  },
  {
    id: "continents",
    label: "Continents",
    options: [{ value: "south-america", label: "South America" }],
    defaultValue: "south-america",
  },
  {
    id: "country",
    label: "Country",
    options: [{ value: "chile", label: "Chile" }],
    defaultValue: "chile",
  },
  {
    id: "status",
    label: "Status",
    options: [{ value: "all", label: "All" }],
    defaultValue: "all",
  },
  {
    id: "supportLevel",
    label: "Support Level",
    options: [{ value: "all", label: "All" }],
    defaultValue: "all",
  },
  {
    id: "openToVisits",
    label: "Open to Visits",
    options: [{ value: "all", label: "All" }],
    defaultValue: "all",
  },
];

export function FilterBar({
  filters = defaultFilters,
  onFilterChange,
  className,
}: FilterBarProps) {
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      filters.forEach((filter) => {
        initial[filter.id] = filter.defaultValue;
      });
      return initial;
    }
  );

  const handleChange = (filterId: string, value: string) => {
    setSelectedValues((prev) => ({ ...prev, [filterId]: value }));
    onFilterChange?.(filterId, value);
  };

  const getSelectedLabel = (filter: Filter) => {
    const selectedValue = selectedValues[filter.id];
    const option = filter.options.find((opt) => opt.value === selectedValue);
    return option?.label || filter.defaultValue;
  };

  return (
    <div className={`bg-[#000000] py-4 ${className || ""}`}>
      <div className="flex flex-row justify-center md:justify-end items-center mx-8 mb-4">
        <div className="flex flex-wrap gap-4 justify-center md:justify-end items-center">
          {filters.map((filter) => (
            <div key={filter.id} className="min-w-[140px]">
              <label className="block text-sm font-medium text-white mb-1.5">
                {filter.label}
              </label>
              <Dropdown
                label={filter.label}
                selectedValue={getSelectedLabel(filter)}
                className="w-full [&_button]:bg-white [&_button]:text-black [&_button]:border-0 [&_button]:rounded-md [&_button]:w-full [&_button]:justify-between [&_button]:focus:ring-2 [&_button]:focus:ring-[#FFD700]/50 [&>div:last-child]:left-0 [&>div:last-child]:w-full [&>div:last-child]:min-w-[140px]"
              >
                {filter.options.map((option) => (
                  <DropdownItem
                    key={option.value}
                    onClick={() => handleChange(filter.id, option.value)}
                    className={
                      selectedValues[filter.id] === option.value
                        ? "bg-zinc-200 dark:bg-zinc-700"
                        : ""
                    }
                  >
                    {option.label}
                  </DropdownItem>
                ))}
              </Dropdown>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

