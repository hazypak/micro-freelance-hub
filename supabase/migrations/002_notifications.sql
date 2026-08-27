-- ─── Notifications table ─────────────────────────────────────────
--
-- In-app notifications for proposal lifecycle events.
-- RLS: users can only read/update their own notifications.
-- Inserts are done via the service-role (admin) client so that
-- server actions can create notifications for OTHER users.

-- Create enum for notification types
CREATE TYPE notification_type AS ENUM (
  'proposal_received',
  'proposal_accepted',
  'proposal_rejected'
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       text NOT NULL,
  message     text NOT NULL,
  link        text,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────
-- Primary read pattern: "my unread notifications, newest first"
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT policy for regular users — inserts are done via
-- the service-role client (createAdminClient) which bypasses RLS.
-- This prevents users from creating fake notifications.
