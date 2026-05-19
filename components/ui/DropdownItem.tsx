"use client";
import { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DropdownItemProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function DropdownItem({
  className,
  children,
  onClick,
  ...props
}: DropdownItemProps) {
  return (
    <div
      className={cn(
        "cursor-pointer px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

