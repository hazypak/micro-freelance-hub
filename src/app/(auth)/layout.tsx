/**
 * Auth layout — centered card on a clean background.
 *
 * ★ No `metadata` export. The root layout defines
 *   `title.template: "%s · GigBridge"`, and a nested route group's own
 *   template would silently OVERRIDE it — that's how this file used to
 *   render "Sign In | Micro-Freelance Hub" long after the app was
 *   renamed. Dropping the export lets the root template fire, so every
 *   auth page inherits "· GigBridge" for free.
 *
 * No sidebar, no dashboard chrome — signed-out users don't have a
 * dashboard to be reminded of. Just the form on an empty stage.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Wordmark + tagline — small, matches the home page's voice. */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            GigBridge
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Small tasks. Student hands.
          </p>
        </div>

        {/* Card — the form's stage. `bg-surface` + `border-border-default`
            respect the token palette so a future theme swap covers it. */}
        <div className="rounded-xl border border-border-default bg-surface px-6 py-8 shadow-sm sm:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
