-- Non-destructive rollback for A-1 / DEC-489.
-- Disable VITE_INITIATIVES_PORTFOLIO_ANALYSIS. The nullable additive columns remain
-- in place so previously published audit evidence is never deleted.
BEGIN;
COMMIT;
