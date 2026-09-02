/**
 * Auth layout — playful widget-style centered card.
 *
 * Features a subtle animated gradient background with floating blob
 * decorations, a multi-layered card with a decorative accent bar, and
 * smooth micro-interactions.
 *
 * ★ No `metadata` export. The root layout defines
 *   `title.template: "%s · GigBridge"`, and a nested route group's own
 *   template would silently OVERRIDE it — that's how this file used to
 *   render "Sign In | Micro-Freelance Hub" long after the app was
 *   renamed. Dropping the export lets the root template fire, so every
 *   auth page inherits "· GigBridge" for free.
 *
 * No sidebar, no dashboard chrome — signed-out users don't have a
 * dashboard to be reminded of. Just the form on an animated stage.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {/* ── Animated background blobs ── */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="animate-blob absolute -left-32 -top-32 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-success-200/20 blur-3xl" />
      </div>

      {/* ── Decorative dot grid overlay ── */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md space-y-8">
        {/* ── Wordmark + tagline ── */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span className="inline-block h-2 w-2 rounded-full bg-success-500 animate-pulse" />
            Small tasks. Student hands.
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary">
            GigBridge
          </h1>
        </div>

        {/* ── Card with decorative accent bar ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border-default bg-surface shadow-lg shadow-brand-500/5">
          {/* Decorative accent bar at top */}
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-success-400" />

          {/* Decorative corner widget */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-12 w-12 rounded-full border-8 border-brand-100/50" aria-hidden="true" />

          <div className="px-6 py-8 sm:px-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
