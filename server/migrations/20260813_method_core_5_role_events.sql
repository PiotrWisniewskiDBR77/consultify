-- ═══════════════════════════════════════════════════════════════════════
-- KOLEJNOŚĆ: ten plik jest krokiem 5/5 rodziny `20260813_method_core_*`.
--
-- Numer w nazwie NIE jest ozdobą. Runner (`server/scripts/migrate.postgres.ts`,
-- `compareMigrationOrder`) sortuje pliki o tej samej dacie LEKSYKALNIE po nazwie.
-- Ten plik ma FK do `method_sessions` (krok 1) i `organizations` — musi
-- biec PO `..._1_kernel.sql`. Dodając kolejny plik do tej rodziny — nadaj mu
-- następny numer.
--
-- ★ Nazwa pliku NIE zawiera słów "demo"/"seed"/"mock" — `isSqliteOnlyMigration()`
-- (server/scripts/migrate.postgres.ts, ok. linia 318-327) cicho wyklucza pliki
-- z tymi słowami z przebiegu migracji (runner kończy się exit 0 mimo
-- pominięcia pliku). Ten fakt jest udokumentowanym defektem, który już
-- kosztował sesję debugowania — patrz MEMORY. Po zastosowaniu tej migracji
-- ZAWSZE zweryfikuj `information_schema.tables`, nigdy tylko kod wyjścia.
-- ═══════════════════════════════════════════════════════════════════════

-- Shared Method Kernel — append-only role assignment/revocation history
-- (agent S2, CEL 3: role, assignment, approval przez HTTP, 2026-08-13).
--
-- `method_session_roles` (server/migrations/20260813_method_core_1_kernel.sql)
-- is CURRENT STATE ONLY — a DELETE there removes the row entirely, so it
-- cannot answer "who held `approver` on this session, and when was it
-- granted/revoked". This table is the append-only ledger that survives a
-- revoke: `method_session_roles` rows come and go, `method_session_role_events`
-- rows never do. Nothing here is ever UPDATEd or DELETEd by the kernel.
--
-- Fully additive + idempotent: only CREATE TABLE IF NOT EXISTS and
-- CREATE INDEX IF NOT EXISTS. No DROP, no ALTER of existing columns, no
-- DELETE. Safe to re-run on a shared database. Org-scoped, matching every
-- other method_* table.

CREATE TABLE IF NOT EXISTS method_session_role_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'revoked')),
  actor_user_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_session_role_events_session
  ON method_session_role_events(session_id);
CREATE INDEX IF NOT EXISTS ix_method_session_role_events_org
  ON method_session_role_events(organization_id);
