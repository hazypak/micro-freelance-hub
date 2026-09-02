"use client";

import { useRef, useEffect, useCallback } from "react";
import Script from "next/script";

/**
 * Turnstile CAPTCHA widget wrapper.
 *
 * Loads the Cloudflare Turnstile script and renders the widget into a
 * `<div>`. Calls `onToken(token)` when a challenge is solved, and
 * `onExpire()` when the token expires (so the parent can reset).
 *
 * Usage:
 * ```tsx
 * <TurnstileWidget onToken={(t) => setToken(t)} />
 * ```
 */
export function TurnstileWidget({
  onToken,
  onExpire,
}: {
  onToken: (token: string) => void;
  onExpire?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Grab the site key from the global — Next.js replaces NEXT_PUBLIC_*
  // at build time, so reading from process.env in a client component
  // works (the value is inlined).
  const siteKey =
    process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? "";

  const onLoadTurnstileScript = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    // Render the widget once the script is loaded
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => {
        onToken(token);
      },
      "expired-callback": () => {
        onExpire?.();
      },
    });
  }, [siteKey, onToken, onExpire]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={onLoadTurnstileScript}
        strategy="afterInteractive"
      />
      <div
        ref={containerRef}
        className="flex justify-center"
        aria-label="CAPTCHA challenge"
      />
    </>
  );
}

// ─── Type declaration for the Turnstile API ───────────────────────

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}