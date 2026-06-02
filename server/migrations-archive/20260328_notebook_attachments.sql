ALTER TABLE notebook_pages
ADD COLUMN IF NOT EXISTS attachments_json TEXT DEFAULT '[]';
