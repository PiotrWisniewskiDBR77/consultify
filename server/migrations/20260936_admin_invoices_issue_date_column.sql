ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE invoices
SET issue_date = created_at
WHERE issue_date IS NULL;
