-- Explicit rollback for SR-1 SHOWCASE-ROLL / DEC-576 migration 20262300.
-- Drops the watermark table. Safe + idempotent; no application data touched
-- (the roll itself only shifts planning dates and is reverted by re-running
-- with a negative delta if ever needed — out of scope here).
-- [ODMROZENIE WSPOLNE DEC-576]

DROP TABLE IF EXISTS showcase_date_roll;
