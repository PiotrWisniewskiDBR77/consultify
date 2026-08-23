-- Reserved migration identity. The authoritative confidence-bounds migration
-- was renumbered to 20261057 in commit 35661751ed. A later integration merge
-- accidentally restored this pre-rename twin. Keep this filename as an
-- explicit no-op so migration ledgers remain stable without applying the same
-- data repair and constraint replacement twice.
BEGIN;
COMMIT;
