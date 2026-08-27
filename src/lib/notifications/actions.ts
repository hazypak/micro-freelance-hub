"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/guards";
import { parseId } from "@/lib/validation/schemas";
import type { NotificationType } from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/auth/actions";

// ─── Create Notification (internal helper) ─────────────────────────

/**
 * Insert a notification for a user.
 *
 * ★ Why admin client? The person TRIGGERING the action (e.g. a
 *   business accepting a proposal) is different from the person
 *   RECEIVING the notification (the student). RLS ties inserts
 *   to auth.uid(), so the business user can't insert a row where
 *   user_id = student_id. The admin client bypasses RLS.
 *
 * This is NOT a server action — it's a plain async function called
 * from other server actions. We don't export it from the module's
 * public API; proposal actions import it directly.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const admin = createAdminClient();

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
  });

  if (error) {
    // Non-critical — log but don't fail the parent action.
    // The proposal action should still succeed even if the
    // notification insert fails.
    console.error("[notifications] Failed to create notification:", error);
  }
}

// ─── Mark as Read ──────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 *
 * Guard: authenticated user, RLS ensures ownership.
 */
export async function markNotificationRead(
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();

  const notificationId = parseId(formData.get("notificationId"));
  if (!notificationId) return { error: "Notification not found" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    return { error: "Failed to mark notification as read" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Mark All as Read ──────────────────────────────────────────────

/**
 * Mark all of the current user's unread notifications as read.
 *
 * Guard: authenticated user, RLS ensures ownership.
 */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { user } = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    return { error: "Failed to mark notifications as read" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
