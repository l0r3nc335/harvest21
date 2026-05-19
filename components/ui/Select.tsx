"use client";
import { forwardRef, SelectHTMLAttributes } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronDown } from "lucide-react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, ...props },
  ref
) {
  const base =
    "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:ring-zinc-800 appearance-none pr-8 cursor-pointer disabled:cursor-not-allowed";
  
  return (
    <div className="relative">
      <select ref={ref} className={twMerge(clsx(base, className))} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-zinc-500" />
    </div>
  );
});

