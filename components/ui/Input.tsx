"use client";
import { forwardRef, InputHTMLAttributes } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  const base =
    "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:ring-zinc-800";
  return <input ref={ref} className={twMerge(clsx(base, className))} {...props} />;
});


