"use client";
import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

type RadioProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  labelClassName?: string;
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, label, labelClassName, ...props },
  ref
) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        ref={ref}
        type="radio"
        className={twMerge(
          clsx(
            "h-4 w-4 text-green-600 focus:ring-green-600 focus:ring-2 border-zinc-300 cursor-pointer",
            "checked:bg-green-600 checked:border-green-600",
            className
          )
        )}
        {...props}
      />
      <span className={twMerge("text-sm text-zinc-900 dark:text-zinc-100", labelClassName)}>{label}</span>
    </label>
  );
});

