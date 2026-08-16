import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────────

export const userRoleSchema = z.enum(["student", "business", "admin"]);

export const taskStatusSchema = z.enum([
  "draft",
  "open",
  "in_progress",
  "submitted",
  "ai_review",
  "client_review",
  "completed",
  "cancelled",
  "disputed",
]);

export const proposalStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
]);

// ─── Auth ───────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or fewer")
    .trim(),
  role: userRoleSchema.exclude(["admin"]), // admin is not self-selectable
});

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// ─── Profile ────────────────────────────────────────────────────────

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100)
    .trim()
    .optional(),
  bio: z.string().max(500, "Bio must be 500 characters or fewer").optional(),
  school_or_company: z
    .string()
    .max(200, "Must be 200 characters or fewer")
    .optional(),
  focus_areas: z
    .array(z.string().max(50))
    .max(10, "Maximum 10 focus areas")
    .optional(),
  skills: z
    .array(z.string().max(50))
    .max(20, "Maximum 20 skills")
    .optional(),
});

// ─── Onboarding ─────────────────────────────────────────────────────

export const studentOnboardingSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().max(50)).min(1, "Select at least one skill").max(20),
  focus_areas: z.array(z.string().max(50)).max(10).optional(),
  school_or_company: z.string().max(200).optional(),
});

export const businessOnboardingSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  bio: z.string().max(500).optional(),
  school_or_company: z.string().min(1, "Company name is required").max(200),
  focus_areas: z
    .array(z.string().max(50))
    .min(1, "Select at least one industry")
    .max(10),
});

// ─── Tasks ──────────────────────────────────────────────────────────

export const taskCategorySchema = z.enum([
  "design",
  "development",
  "writing",
  "marketing",
  "video",
  "data",
  "research",
  "other",
]);

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title must be 120 characters or fewer")
    .trim(),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(5000, "Description must be 5000 characters or fewer"),
  brief: z
    .string()
    .max(10000, "Brief must be 10000 characters or fewer")
    .optional(),
  category: taskCategorySchema,
  budget: z
    .number()
    .positive("Budget must be greater than zero")
    .max(50000, "Budget must be $50,000 or less"),
  deadline: z
    .string()
    .datetime()
    .optional()
    .refine(
      (val) => !val || new Date(val) > new Date(),
      "Deadline must be in the future"
    ),
  required_skills: z
    .array(z.string().max(50))
    .max(10, "Maximum 10 required skills")
    .optional(),
  permitted_deliverable_types: z
    .array(z.string().max(50))
    .max(5, "Maximum 5 deliverable types")
    .optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

// ─── Proposals ──────────────────────────────────────────────────────

export const createProposalSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
  cover_message: z
    .string()
    .min(20, "Cover message must be at least 20 characters")
    .max(2000, "Cover message must be 2000 characters or fewer"),
  proposed_price: z
    .number()
    .positive("Price must be greater than zero")
    .max(50000, "Price must be $50,000 or less")
    .optional(),
  timeline_estimate: z
    .string()
    .max(100, "Timeline must be 100 characters or fewer")
    .optional(),
});

// ─── Submissions ────────────────────────────────────────────────────

export const createSubmissionSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
  notes: z
    .string()
    .max(2000, "Notes must be 2000 characters or fewer")
    .optional(),
  deliverable_url: z.string().url("Must be a valid URL").optional(),
});

// ─── Reviews ────────────────────────────────────────────────────────

export const createReviewSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
  reviewee_id: z.string().uuid("Invalid reviewee ID"),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .max(2000, "Comment must be 2000 characters or fewer")
    .optional(),
});

// ─── File upload ────────────────────────────────────────────────────

/** Allowed MIME types for deliverable uploads */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ─── Type exports ───────────────────────────────────────────────────

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
