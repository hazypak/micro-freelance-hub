-- ─── Extend notification_type enum for submission events ────────
--
-- Adds notification types for the deliverables workflow:
--   submission_received — business gets notified when student submits
--   task_completed      — student gets notified when business approves
--   task_disputed       — student gets notified if business disputes

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'submission_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_disputed';
