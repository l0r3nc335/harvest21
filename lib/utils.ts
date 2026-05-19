import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateName(name: string, maxLength: number = 40): string {
  if (!name) return "";
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength) + "...";
}
