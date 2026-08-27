import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PrototypeNotice, LegalSection } from "@/components/layout/legal-page";

// ─── Metadata ──────────────────────────────────────────────────────

// ★ Plain "Privacy", not "Privacy — GigBridge". The root layout sets
//   `title.template: "%s · GigBridge"`, so the suffix is appended for
//   us; spelling it out here would render "Privacy — GigBridge · GigBridge".
export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Plain-language notes on what GigBridge's prototype stores, who can see it, and how to ask for it to be removed.",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /privacy — honest placeholder, not a privacy policy.
 *
 * Lives at the top level (not inside `(protected)`) so unauthenticated
 * visitors can read it before deciding to sign up. The prototype notice
 * is the first thing on the page — anyone scanning for the boilerplate
 * "we take your privacy seriously" copy should learn immediately that
 * this isn't a commercial site.
 *
 * ★ Plain language is the deliberate choice here. A short, honest list
 *   of what the prototype actually does is more useful — and more
 *   truthful — than 2,000 words of legalese promising things a class
 *   project cannot deliver.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Privacy"
        description="What this prototype stores, who can see it, and how to ask for it to be deleted."
      />

      <PrototypeNotice />

      <div className="space-y-8 text-sm leading-relaxed text-text-secondary">
        <LegalSection heading="What this prototype stores">
          <p>
            When you create an account, GigBridge stores the email
            address you signed up with (handled by Supabase Auth) plus
            the name and role you chose during onboarding. Tasks,
            proposals, assignments, and submissions you create are
            stored in the database alongside your user id.
          </p>
          <p>
            Files uploaded as deliverables go to private storage. Only
            the assigned student and the task owner can download them,
            and only through short-lived signed links — there is no
            public URL for an uploaded file.
          </p>
        </LegalSection>

        <LegalSection heading="Who can see what">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong className="font-medium text-text-primary">
                Businesses
              </strong>{" "}
              you submit proposals to see your name and proposal on
              their own tasks. They cannot see proposals you sent to
              anyone else.
            </li>
            <li>
              <strong className="font-medium text-text-primary">
                Students
              </strong>{" "}
              browsing the ticker see published tasks and the business
              that posted them. They cannot see other students&apos;
              proposals.
            </li>
            <li>
              <strong className="font-medium text-text-primary">
                The site owner
              </strong>{" "}
              has full database access as a consequence of running the
              service. This is a student project, not a regulated
              business — see the notice above.
            </li>
          </ul>
        </LegalSection>

        <LegalSection heading="Cookies, analytics, and third parties">
          <p>
            No analytics or tracking scripts are loaded. Supabase Auth
            sets a small number of first-party cookies needed to keep
            you signed in. There are no advertising cookies, and no
            data is sold or shared with third parties.
          </p>
        </LegalSection>

        <LegalSection heading="Asking for your data to be deleted">
          <p>
            Email the project owner from the address you signed up
            with and ask for removal. Account, task, and proposal data
            will be deleted within a reasonable timeframe. A short
            reply may be needed to confirm the request really came
            from you.
          </p>
        </LegalSection>

        <LegalSection heading="Changes to this page">
          <p>
            If the prototype ever becomes a real product, this page
            will be replaced by a genuine privacy policy written by
            someone with legal training. Until then, the warning at
            the top is the most important sentence on it.
          </p>
        </LegalSection>
      </div>
    </main>
  );
}
