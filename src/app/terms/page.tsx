import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PrototypeNotice, LegalSection } from "@/components/layout/legal-page";

// ─── Metadata ──────────────────────────────────────────────────────

// Plain title — the root layout appends " · GigBridge" via title.template.
export const metadata: Metadata = {
  title: "Terms",
  description:
    "Plain-language notes on how GigBridge's prototype expects to be used, and what it does not promise.",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /terms — honest placeholder, not terms of service.
 *
 * Public route for the same reason as /privacy: a visitor should be
 * able to read it before creating an account.
 *
 * ★ The hardest thing to get right on this page is the payments
 *   section. Tasks carry a budget in MYR and businesses "award" them,
 *   but the prototype never moves money — there is no payment
 *   processor wired in. Quietly omitting that would leave a student
 *   reasonably believing the platform guarantees they get paid, so it
 *   is stated outright rather than left to inference.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Terms"
        description="How this prototype expects to be used — and what it does not promise."
      />

      <PrototypeNotice />

      <div className="space-y-8 text-sm leading-relaxed text-text-secondary">
        <LegalSection heading="What GigBridge is">
          <p>
            GigBridge is a demonstration marketplace connecting student
            freelancers with businesses posting small tasks. It exists
            to show that the workflow — post, propose, award, submit,
            review — can be built end to end. It is not a registered
            business and offers no service guarantee.
          </p>
        </LegalSection>

        <LegalSection heading="Payments are not handled here">
          <p>
            Tasks display a budget and businesses can award them to a
            student, but{" "}
            <strong className="font-medium text-text-primary">
              no money moves through this site
            </strong>
            . There is no payment processor, no escrow, and no invoice
            system. Any actual payment is arranged directly between the
            business and the student, entirely at their own risk.
          </p>
          <p>
            GigBridge cannot recover a payment that was never made and
            has no dispute process that results in money changing
            hands.
          </p>
        </LegalSection>

        <LegalSection heading="What's expected of you">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Post and apply for tasks in good faith. Don&apos;t post
              work you have no intention of awarding.
            </li>
            <li>
              Don&apos;t upload malware, illegal material, or content
              you don&apos;t hold the rights to.
            </li>
            <li>
              Don&apos;t attempt to access other users&apos; tasks,
              proposals, or files. Access rules are enforced in the
              database, and probing them is still not welcome.
            </li>
            <li>
              Use one account per person. Roles are chosen at
              onboarding and shape what you can see.
            </li>
          </ul>
        </LegalSection>

        <LegalSection heading="Content and ownership">
          <p>
            You keep ownership of everything you upload. Uploading a
            deliverable grants the task owner access to download and
            review it — nothing more. Who owns the finished work after
            that is between you and the other party, and this site
            takes no position on it.
          </p>
        </LegalSection>

        <LegalSection heading="Availability and data loss">
          <p>
            The prototype may be taken offline, reset, or have its
            database wiped without notice. Keep your own copy of
            anything that matters to you.
          </p>
        </LegalSection>

        <LegalSection heading="Account removal">
          <p>
            Accounts that are used to harass others, upload illegal
            content, or probe access controls may be removed without
            warning. You can also request removal of your own account
            at any time — see the{" "}
            <a
              href="/privacy"
              className="font-medium text-brand-600 underline-offset-2 hover:underline"
            >
              privacy page
            </a>
            .
          </p>
        </LegalSection>
      </div>
    </main>
  );
}
