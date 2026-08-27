"use client";

import { useState, useTransition, useCallback } from "react";
import {
  saveOnboardingStep,
  completeOnboarding,
} from "@/lib/onboarding/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { UserRole } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";

// ─── Types ────────────────────────────────────────────────────────

interface OnboardingFormProps {
  role: UserRole;
  initialData: {
    fullName: string;
    bio: string;
    skills: string[];
    focusAreas: string[];
    schoolOrCompany: string;
  };
}

interface StepConfig {
  id: string;
  title: string;
  description: string;
}

// ─── Step definitions per role ────────────────────────────────────

const STUDENT_STEPS: StepConfig[] = [
  {
    id: "name",
    title: "Your name",
    description: "How should clients address you?",
  },
  {
    id: "skills",
    title: "Your skills",
    description: "What can you offer? (Add at least one)",
  },
  {
    id: "details",
    title: "About you",
    description: "Optional: bio, school, and focus areas",
  },
];

const BUSINESS_STEPS: StepConfig[] = [
  {
    id: "name",
    title: "Your name",
    description: "Who's behind the business?",
  },
  {
    id: "company",
    title: "Your company",
    description: "Tell students about your organization",
  },
  {
    id: "details",
    title: "About your business",
    description: "Optional: bio and industries you work in",
  },
];

// ─── Suggested options ────────────────────────────────────────────

const SKILL_SUGGESTIONS = [
  "Graphic Design",
  "Logo Design",
  "Video Editing",
  "Social Media",
  "Copywriting",
  "Web Development",
  "Photography",
  "Illustration",
  "UI/UX Design",
  "Data Entry",
  "Translation",
  "Voice Over",
  "Animation",
  "Content Writing",
  "SEO",
];

const INDUSTRY_SUGGESTIONS = [
  "Technology",
  "E-commerce",
  "Education",
  "Healthcare",
  "Finance",
  "Media",
  "Food & Beverage",
  "Real Estate",
  "Fashion",
  "Non-profit",
  "Marketing",
  "Consulting",
];

// ─── Component ────────────────────────────────────────────────────

export function OnboardingForm({ role, initialData }: OnboardingFormProps) {
  const steps = role === "student" ? STUDENT_STEPS : BUSINESS_STEPS;

  // Form state — seeded from database for resume
  const [fullName, setFullName] = useState(initialData.fullName);
  const [bio, setBio] = useState(initialData.bio);
  const [skills, setSkills] = useState<string[]>(initialData.skills);
  const [focusAreas, setFocusAreas] = useState<string[]>(
    initialData.focusAreas,
  );
  const [schoolOrCompany, setSchoolOrCompany] = useState(
    initialData.schoolOrCompany,
  );

  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalSteps = steps.length;

  // ── Per-step save ─────────────────────────────────────────────

  const saveCurrentStep = useCallback(() => {
    const formData = new FormData();

    // Always save whatever we have so far
    if (fullName.trim()) formData.set("fullName", fullName);
    if (bio.trim()) formData.set("bio", bio);
    if (skills.length > 0) formData.set("skills", skills.join(","));
    if (focusAreas.length > 0)
      formData.set("focus_areas", focusAreas.join(","));
    if (schoolOrCompany.trim())
      formData.set("school_or_company", schoolOrCompany);

    startTransition(async () => {
      await saveOnboardingStep(formData);
    });
  }, [fullName, bio, skills, focusAreas, schoolOrCompany]);

  // ── Navigation ────────────────────────────────────────────────

  function handleNext() {
    // Validate current step before advancing
    const error = validateCurrentStep();
    if (error) {
      setResult({ error });
      return;
    }
    setResult(null);
    saveCurrentStep();
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }

  function handleBack() {
    setResult(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  function handleComplete() {
    const error = validateCurrentStep();
    if (error) {
      setResult({ error });
      return;
    }
    setResult(null);

    // Build final FormData with everything
    const formData = new FormData();
    formData.set("fullName", fullName);
    if (bio.trim()) formData.set("bio", bio);
    if (skills.length > 0) formData.set("skills", skills.join(","));
    if (focusAreas.length > 0)
      formData.set("focus_areas", focusAreas.join(","));
    if (schoolOrCompany.trim())
      formData.set("school_or_company", schoolOrCompany);

    startTransition(async () => {
      const actionResult = await completeOnboarding(formData);
      // completeOnboarding redirects on success — we only reach here on error
      setResult(actionResult);
    });
  }

  // ── Step validation ───────────────────────────────────────────

  function validateCurrentStep(): string | null {
    const step = steps[currentStep];
    if (!step) return null;

    switch (step.id) {
      case "name":
        if (!fullName.trim() || fullName.trim().length < 2) {
          return "Please enter your full name (at least 2 characters)";
        }
        break;
      case "skills":
        if (skills.length === 0) {
          return "Please add at least one skill";
        }
        break;
      case "company":
        if (role === "business" && !schoolOrCompany.trim()) {
          return "Please enter your company name";
        }
        break;
      // "details" step has no required fields
    }
    return null;
  }

  // ── Render current step content ───────────────────────────────

  const step = steps[currentStep];

  return (
    <div className="mt-6">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span>{step?.title}</span>
        </div>
        <div
          className="mt-2 h-1.5 w-full rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label={`Step ${currentStep + 1} of ${totalSteps}: ${step?.title}`}
        >
          <div
            className="h-1.5 rounded-full bg-brand-600 transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step description */}
      <p className="mb-4 text-sm text-text-secondary">{step?.description}</p>

      {/* Error display */}
      {result?.error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          {result.error}
        </div>
      )}

      {/* Step content */}
      <div className="space-y-4">
        {step?.id === "name" && (
          <Input
            id="fullName"
            type="text"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            disabled={isPending}
            autoFocus
          />
        )}

        {step?.id === "skills" && (
          <TagInput
            label="Skills"
            tags={skills}
            onChange={setSkills}
            suggestions={SKILL_SUGGESTIONS}
            placeholder="Type a skill and press Enter"
            maxTags={20}
            disabled={isPending}
          />
        )}

        {step?.id === "company" && (
          <Input
            id="schoolOrCompany"
            type="text"
            label="Company name"
            value={schoolOrCompany}
            onChange={(e) => setSchoolOrCompany(e.target.value)}
            placeholder="Acme Inc."
            disabled={isPending}
            autoFocus
          />
        )}

        {step?.id === "details" && (
          <>
            <div>
              <Textarea
                id="bio"
                label="Bio (optional)"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  role === "student"
                    ? "Tell businesses what you're passionate about…"
                    : "Describe your company and what you're looking for…"
                }
                disabled={isPending}
              />
              <p className="mt-1 text-right text-xs text-text-tertiary">
                {bio.length}/500
              </p>
            </div>

            {role === "student" && (
              <Input
                id="schoolOrCompanyStudent"
                type="text"
                label="School (optional)"
                value={schoolOrCompany}
                onChange={(e) => setSchoolOrCompany(e.target.value)}
                placeholder="University of…"
                disabled={isPending}
              />
            )}

            <TagInput
              label={
                role === "student"
                  ? "Focus areas (optional)"
                  : "Industries (at least one)"
              }
              tags={focusAreas}
              onChange={setFocusAreas}
              suggestions={
                role === "student" ? SKILL_SUGGESTIONS : INDUSTRY_SUGGESTIONS
              }
              placeholder={
                role === "student"
                  ? "Areas you're interested in"
                  : "Your industry"
              }
              maxTags={10}
              disabled={isPending}
            />
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex gap-3">
        {currentStep > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            disabled={isPending}
            className="flex-1"
          >
            Back
          </Button>
        )}

        {currentStep < totalSteps - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            loading={isPending}
            className="flex-1"
          >
            {isPending ? "Saving…" : "Continue"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleComplete}
            loading={isPending}
            className="flex-1"
          >
            {isPending ? "Completing…" : "Complete profile"}
          </Button>
        )}
      </div>
    </div>
  );
}
