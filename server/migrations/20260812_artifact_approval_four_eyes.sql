-- Artifact approval four-eyes enforcement.
-- Nullable preserves legacy project-gate and pre-migration artifact rows.
-- ArtifactApprovalService requires this value for every newly submitted review.
ALTER TABLE approval_assignments
  ADD COLUMN IF NOT EXISTS requested_by_user_id TEXT;
