-- RED-ADMIN 2026-07-19: schema-500 klasy „kolumna brak → 500" w rewirze
-- superadmin/security + admin/audit. Znalezione automatycznym probem (harness
-- acceptance) na parity :5443 (dump TROLLEY). Kontrolery oczekują kolumn, których
-- ŻADNA uruchomiona migracja nie dodała (055_security_module.sql.sql ma podwójne
-- rozszerzenie → poza regex autorun /^(7\d{2}|\d{8})_.*\.sql$/ → nigdy nie odpala;
-- a i tak nie zawiera location_*/resolved). CZYSTY Postgres, addytywne, idempotentne.
-- Na demo (jeśli kolumny już są) = no-op. Prefiks daty → autorun DatabaseInitializer.

-- GET /api/superadmin/security/events/stats — SUM(CASE WHEN resolved = 0 ...) → 42703.
-- GET /api/superadmin/security/events — SELECT ... location_city, location_country, resolved → 42703.
-- Kod traktuje `resolved` jako INTEGER (0/1: `resolved = ?` push 1/0; `resolved = 0`),
-- dlatego INTEGER (nie BOOLEAN — inaczej operator boolean = integer poleci).
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS resolved INTEGER DEFAULT 0;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS location_country TEXT;

-- GET /api/superadmin/admin/audit-logs/export — SELECT l.description, l.resolved_at
-- FROM admin_audit_logs → 42703 (tabela ma review_notes/reviewed_at, nie description/resolved_at).
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
