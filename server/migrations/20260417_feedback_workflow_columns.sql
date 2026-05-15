-- Feedback Pipeline V2.1 — additive workflow columns
--
-- Historically all workflow/resolution state lived inside the
-- feedback_items.metadata_json blob. That is great for iteration speed but
-- terrible for SQL analytics (MTTR, aging, owner dashboards, …). This
-- migration surfaces the most queried workflow fields as first-class columns
-- while the server continues to maintain the JSON copy as the source of
-- truth. Backfill happens lazily on the next workflow write — we do NOT
-- try to back-parse every existing row here to keep the migration cheap
-- and idempotent.
--
-- All columns are nullable and additive; existing queries keep working.

DO $$
BEGIN
  -- owner: email or 'cursor' / 'human' tag of the last workflow owner
  BEGIN
    ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS owner TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- cluster: auto-inferred bucket (see feedbackTriage.inferCluster)
  BEGIN
    ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS cluster TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- deploy_status: pending / staging / production / failed
  BEGIN
    ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS deploy_status TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- workflow_updated_at: timestamp of last workflow PATCH (drives aging)
  BEGIN
    ALTER TABLE feedback_items
      ADD COLUMN IF NOT EXISTS workflow_updated_at TIMESTAMP;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_items_owner ON feedback_items(owner);
CREATE INDEX IF NOT EXISTS idx_feedback_items_cluster ON feedback_items(cluster);
CREATE INDEX IF NOT EXISTS idx_feedback_items_deploy_status
  ON feedback_items(deploy_status);
CREATE INDEX IF NOT EXISTS idx_feedback_items_workflow_updated_at
  ON feedback_items(workflow_updated_at);
