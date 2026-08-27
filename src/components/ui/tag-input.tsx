"use client";

import { useState, useRef, useCallback, useId } from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface TagInputProps {
  /** Visible label text. Always required for accessibility. */
  label: string;
  /** Current tags (controlled). */
  tags: string[];
  /** Called when the tag list changes. */
  onChange: (tags: string[]) => void;
  /** Clickable suggestion chips. */
  suggestions?: string[];
  /** Input placeholder. */
  placeholder?: string;
  /** Maximum number of tags. */
  maxTags?: number;
  /** Disables input and tag removal. */
  disabled?: boolean;
  /** Validation error message — triggers error styling. */
  error?: string;
  /** Helper text shown below the input when there's no error. */
  description?: string;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * TagInput — accessible tag input with clickable suggestions.
 *
 * ★ Accessibility:
 *   - role="listbox" on suggestions for screen readers
 *   - aria-live region announces tag count changes
 *   - Keyboard: Enter to add, Backspace to remove last tag
 *   - useId() for guaranteed-unique label ↔ input wiring
 *   - Error + description wired via aria-describedby
 */
function TagInput({
  label,
  tags,
  onChange,
  suggestions = [],
  placeholder = "Type and press Enter",
  maxTags = 10,
  disabled = false,
  error,
  description,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const autoId = useId();
  const inputId = `${autoId}-tag`;
  const errorId = `${autoId}-tag-error`;
  const descId = `${autoId}-tag-desc`;
  const hintId = `${autoId}-tag-hint`;

  // ── Add / Remove ────────────────────────────────────────────────

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (
        !trimmed ||
        tags.length >= maxTags ||
        tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())
      ) {
        return;
      }
      onChange([...tags, trimmed]);
      setInputValue("");
    },
    [tags, onChange, maxTags],
  );

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  // Filter suggestions to exclude already-selected tags
  const availableSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  const atLimit = tags.length >= maxTags;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Label */}
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-text-primary"
      >
        {label}
      </label>

      {/* Selected tags */}
      {tags.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          aria-live="polite"
          aria-label={`${tags.length} selected`}
        >
          {tags.map((tag, i) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                disabled={disabled}
                className={cn(
                  "ml-0.5 rounded-full p-0.5",
                  "text-brand-400 hover:bg-brand-100 hover:text-brand-600",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  "disabled:opacity-50",
                  "transition-colors duration-fast",
                )}
                aria-label={`Remove ${tag}`}
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Text input */}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "block w-full rounded-lg border bg-surface px-3 py-2",
          "text-sm text-text-primary placeholder:text-text-tertiary",
          "transition-colors duration-fast",
          "focus:outline-none focus:ring-2 focus:ring-offset-1",
          error
            ? "border-error-500 focus:ring-error-500"
            : "border-border-default focus:border-brand-500 focus:ring-brand-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        placeholder={atLimit ? `Maximum ${maxTags} reached` : placeholder}
        disabled={disabled || atLimit}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error && errorId, description && descId, hintId]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />

      {/* Hint */}
      <p id={hintId} className="text-xs text-text-tertiary">
        Press Enter to add · click × to remove
      </p>

      {/* Error */}
      {error && (
        <p id={errorId} className="text-sm text-error-600" role="alert">
          {error}
        </p>
      )}

      {/* Description */}
      {!error && description && (
        <p id={descId} className="text-sm text-text-tertiary">
          {description}
        </p>
      )}

      {/* Suggestion chips */}
      {availableSuggestions.length > 0 && !atLimit && (
        <div
          className="flex flex-wrap gap-1.5"
          role="listbox"
          aria-label={`${label} suggestions`}
        >
          {availableSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => addTag(suggestion)}
              disabled={disabled}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                "border-border-default bg-surface-sunken text-text-secondary",
                "hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                "disabled:opacity-50",
                "transition-colors duration-fast",
              )}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

TagInput.displayName = "TagInput";

export { TagInput };
