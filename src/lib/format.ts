/**
 * Locale-aware formatters for GigBridge UI.
 *
 * All dates use the `en-MY` locale (Malaysia) — same as the rest of
 * the app. All money uses MYR.
 *
 * Date styles:
 *   "short"  → "5 Aug 2026"      (compact list rows)
 *   "long"   → "5 August 2026"   (detail headers)
 *   "long-time" → "5 August 2026, 14:30"  (audit/activity detail)
 *   "short-time" → "5 Aug 2026, 14:30"   (submission rows)
 */

export type DateStyle = "short" | "long" | "short-time" | "long-time";

export function formatDate(iso: string, style: DateStyle = "short"): string {
  const date = new Date(iso);

  const base: Intl.DateTimeFormatOptions = {
    year: "numeric",
    day: "numeric",
  };

  if (style === "short" || style === "short-time") {
    base.month = "short";
  } else {
    base.month = "long";
  }

  if (style === "short-time" || style === "long-time") {
    base.hour = "2-digit";
    base.minute = "2-digit";
  }

  return date.toLocaleDateString("en-MY", base);
}

/**
 * Format an MYR amount as currency.
 *
 * `Intl.NumberFormat` with `"en-MY"` produces "RM 1,234.56" — the
 * localised prefix is automatic, no manual concatenation needed.
 */
export function formatBudget(amount: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amount);
}