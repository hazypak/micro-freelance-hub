"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Full name — used for alt text and fallback initials. */
  name: string;
  /** Image URL. When absent or broken, initials are shown. */
  src?: string | null;
  /** Size in pixels (used for both width and height). */
  size?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Extract first initial + last initial from a full name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "?";
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Avatar — circular image with text-initial fallback.
 *
 * Shows the image when `src` is provided and loads successfully.
 * Falls back to initials derived from `name` when src is absent
 * or the image fails to load (onError).
 *
 * The fallback uses a deterministic brand-tinted background so
 * avatars without photos still look intentional, not broken.
 */
function Avatar({ name, src, size = 40, className, ...props }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        !showImage && "bg-brand-100 text-brand-700",
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          {...props}
        />
      ) : (
        <span
          className="select-none font-medium"
          style={{ fontSize: size * 0.4 }}
          aria-hidden="true"
        >
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}

export { Avatar };
