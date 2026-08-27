import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

// Bare title — root layout appends " · GigBridge".
export const metadata: Metadata = {
  title: "Complete your profile",
  description: "Set up your GigBridge profile.",
};

/**
 * Onboarding page — server component shell.
 *
 * ★ Security: requireAuth() validates JWT server-side.
 * If the user is already onboarded, redirect them straight to /dashboard.
 * Otherwise, load their partial profile (if any) and pass it to the form
 * so they can resume where they left off.
 */
export default async function OnboardingPage() {
  const { user, role, onboardingCompleted } = await requireAuth();

  // Already finished? Go to dashboard
  if (onboardingCompleted) {
    redirect("/dashboard");
  }

  // Load partial profile for resume-ability
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, bio, skills, focus_areas, school_or_company")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-xl border border-border-default bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-text-primary">
          {role === "student"
            ? "Set up your student profile"
            : "Set up your business profile"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {role === "student"
            ? "Tell us about your skills so businesses can find you."
            : "Tell us about your company so students know who they're working with."}
        </p>

        <OnboardingForm
          role={role}
          initialData={{
            fullName: profile?.full_name ?? "",
            bio: profile?.bio ?? "",
            skills: profile?.skills ?? [],
            focusAreas: profile?.focus_areas ?? [],
            schoolOrCompany: profile?.school_or_company ?? "",
          }}
        />
      </div>
    </div>
  );
}
