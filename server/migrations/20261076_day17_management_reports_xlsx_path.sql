-- Day 17 X.2. Additive and backward-compatible: frozen demo ignores this
-- nullable column; new code treats NULL as "not exported yet".
ALTER TABLE management_reports ADD COLUMN IF NOT EXISTS xlsx_path TEXT;
