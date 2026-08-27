import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// ─── PrototypeNotice ──────────────────────────────────────────────

/**
 * PrototypeNotice — the "this is not a real legal document" banner.
 *
 * ★ Why this is a component and not copy-pasted prose: /privacy and
 *   /terms make the *same* claim about GigBridge's status. If that
 *   claim ever stops being true — the project ships, a real policy
 *   gets written — it has to stop being true in both places at once.
 *   Two copies drift; one doesn't.
 *
 * Rendered as <aside role="note"> rather than role="alert": this is
 * standing context for the page, not an event the user must react to,
 * so it should not interrupt a screen reader mid-sentence.
 */
function PrototypeNotice() {
  return (
    <aside
      role="note"
      className="mb-8 flex gap-3 rounded-lg border border-warning-100 bg-warning-50 px-4 py-3"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-warning-600"
        aria-hidden="true"
      />
      <p className="text-sm text-warning-700">
        <strong className="font-semibold">
          GigBridge is a student project, not a commercial service.
        </strong>{" "}
        This page describes, in plain language, what the prototype
        actually does. It is not a legal agreement and creates no
        obligations on anyone. Don&apos;t upload anything you would
        mind losing or sharing.
      </p>
    </aside>
  );
}

// ─── LegalSection ─────────────────────────────────────────────────

/**
 * LegalSection — labelled block of prose on a legal placeholder page.
 *
 * Renders a real <section> + <h2> so the two pages have a navigable
 * heading outline for screen readers, rather than bold <p> tags that
 * only look like headings.
 */
function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-text-primary">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export { PrototypeNotice, LegalSection };
