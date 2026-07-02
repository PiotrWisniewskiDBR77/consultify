-- Adds template provenance tracking to work_canvas_drafts
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS template_id TEXT;
CREATE INDEX IF NOT EXISTS idx_wcd_template_id ON work_canvas_drafts(template_id) WHERE template_id IS NOT NULL;
