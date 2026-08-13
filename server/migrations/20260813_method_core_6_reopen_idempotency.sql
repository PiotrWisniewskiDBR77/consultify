-- ═══════════════════════════════════════════════════════════════════════
-- KOLEJNOŚĆ: ten plik jest krokiem 6/6 rodziny `20260813_method_core_*`.
--
-- Numer w nazwie NIE jest ozdobą. Runner (`server/scripts/migrate.postgres.ts`,
-- `compareMigrationOrder`) sortuje pliki o tej samej dacie LEKSYKALNIE po nazwie.
-- Ten plik ma FK do `organizations` i (dwukrotnie) do `method_sessions`
-- (krok 1) — musi biec PO `..._1_kernel.sql`. Dodając kolejny plik do tej
-- rodziny — nadaj mu następny numer.
--
-- ★ Nazwa pliku NIE zawiera słów "demo"/"seed"/"mock" — `isSqliteOnlyMigration()`
-- (server/scripts/migrate.postgres.ts) cicho wyklucza pliki z tymi słowami
-- z przebiegu migracji (runner kończy się exit 0 mimo pominięcia pliku). Po
-- zastosowaniu tej migracji ZAWSZE zweryfikuj `information_schema.tables`,
-- nigdy tylko kod wyjścia.
-- ═══════════════════════════════════════════════════════════════════════

-- Shared Method Kernel — HTTP layer idempotency for
-- `POST /api/method/sessions/:id/reopen` (agent S8, 2026-08-13).
--
-- `MethodSessionService.transition()`'s own `frozen -> active` branch
-- unconditionally INSERTs a brand new `method_sessions` row on every call —
-- it has no concept of "this exact request already happened" (its
-- `idempotencyKey` field, part of the frozen `MethodTransitionRequest`
-- contract, is not read by that branch — see that file's header comment).
-- A naive retry of `POST .../reopen` (client timeout, network blip) would
-- therefore mint a SECOND revision of the same frozen session, silently.
--
-- This tiny table is the HTTP-boundary idempotency anchor that closes that
-- gap for the reopen endpoint specifically — exactly the same shape as
-- `method_session_create_idempotency` (20260813_method_core_3_http_idempotency.sql)
-- uses for `POST /sessions`: (organization_id, idempotency_key) -> the
-- revision a first call actually produced. A replay looks itself up here
-- FIRST and returns the ALREADY-CREATED revision instead of calling
-- `MethodSessionService.transition()` again.
--
-- `root_session_id` (the frozen session that was reopened) is kept alongside
-- `revision_session_id` (the new `active` row it produced) purely for
-- diagnostics/audit — the router only ever reads by (organization_id,
-- idempotency_key).
--
-- Fully additive + idempotent, matching this family's convention: only
-- CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS method_session_reopen_idempotency (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  root_session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  revision_session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_method_session_reopen_idempotency_revision
  ON method_session_reopen_idempotency(revision_session_id);

CREATE INDEX IF NOT EXISTS ix_method_session_reopen_idempotency_root
  ON method_session_reopen_idempotency(root_session_id);
