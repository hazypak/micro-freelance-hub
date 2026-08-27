import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind-aware conflict resolution.
 *
 * - `clsx` handles conditionals: cn("base", isActive && "bg-brand-600")
 * - `twMerge` resolves conflicts: cn("px-4", "px-6") → "px-6"
 *
 * Every UI component accepts an optional `className` prop and
 * merges it via cn() so consumers can override any default.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
