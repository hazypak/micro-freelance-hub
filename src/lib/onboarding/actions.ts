"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/guards";
import {
  studentOnboardingSchema,
  businessOnboardingSchema,
} from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/auth/actions";
import type { Database } from "@/lib/supabase/types";

// ─── Save Onboarding Step ─────────────────────────────────────────

/**
 * Persist a single onboarding step — partial profile update.
 *
 * Accepts arbitrary profile fields and writes only those columns.
 * Does NOT set `onboarding_completed` — that happens in `completeOnboarding`.
 *
 * ★ Security: requireAuth() validates JWT server-side. The update is
 *   scoped to the authenticated user's own row via RLS + `.eq("id", ...)`.
 */
export async function saveOnboardingStep(
  formData: FormData
): Promise<ActionResult> {
  const { user } = await requireAuth();

  const supabase = await createClient();

  // Build the update object from only the fields that were submitted
  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};

  const fullName = formData.get("fullName");
  if (typeof fullName === "string" && fullName.trim()) {
    update.full_name = fullName.trim();
  }

  const bio = formData.get("bio");
  if (typeof bio === "string") {
    update.bio = bio.trim() || null;
  }

  const schoolOrCompany = formData.get("school_or_company");
  if (typeof schoolOrCompany === "string") {
    update.school_or_company = schoolOrCompany.trim() || null;
  }

  // Array fields come as comma-separated strings from the form
  const skills = formData.get("skills");
  if (typeof skills === "string") {
    update.skills = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const focusAreas = formData.get("focus_areas");
  if (typeof focusAreas === "string") {
    update.focus_areas = focusAreas
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (Object.keys(update).length === 0) {
    return { error: "No fields to update" };
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    console.error("Onboarding step save error:", error.message);
    return { error: "Failed to save. Please try again." };
  }

  return { success: true };
}

// ─── Complete Onboarding ──────────────────────────────────────────

/**
 * Validate the full onboarding payload and mark profile as complete.
 *
 * This is the final step — validates ALL required fields for the user's
 * role, then sets `onboarding_completed = true` and redirects to /dashboard.
 *
 * ★ Why validate everything again? Per-step saves are convenience — the
 *   final validation is the security boundary. A client could skip steps
 *   or tamper with saved data, so we re-validate the full set.
 */
export async function completeOnboarding(
  formData: FormData
): Promise<ActionResult> {
  const { user, role } = await requireAuth();

  const supabase = await createClient();

  // Fetch the current profile to merge with any final-step data
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("full_name, bio, skills, focus_areas, school_or_company")
    .eq("id", user.id)
    .single();

  if (fetchError || !profile) {
    return { error: "Failed to load profile. Please try again." };
  }

  // Merge any last-step fields from the form with existing profile data
  const merged = {
    fullName:
      (formData.get("fullName") as string | null)?.trim() ||
      profile.full_name ||
      "",
    bio:
      (formData.get("bio") as string | null)?.trim() ||
      profile.bio ||
      undefined,
    skills: parseArrayField(formData.get("skills")) ?? profile.skills ?? [],
    focus_areas:
      parseArrayField(formData.get("focus_areas")) ??
      profile.focus_areas ??
      [],
    school_or_company:
      (formData.get("school_or_company") as string | null)?.trim() ||
      profile.school_or_company ||
      undefined,
  };

  // Validate against the role-specific schema
  const schema =
    role === "student" ? studentOnboardingSchema : businessOnboardingSchema;

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return {
      error: firstError?.message ?? "Please complete all required fields",
    };
  }

  // Final update — write all validated fields + mark complete
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      bio: parsed.data.bio ?? null,
      skills: "skills" in parsed.data ? parsed.data.skills : null,
      focus_areas:
        "focus_areas" in parsed.data
          ? (parsed.data.focus_areas ?? null)
          : null,
      school_or_company:
        "school_or_company" in parsed.data
          ? (parsed.data.school_or_company ?? null)
          : null,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Complete onboarding error:", updateError.message);
    return { error: "Failed to complete onboarding. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseArrayField(
  value: FormDataEntryValue | null
): string[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
