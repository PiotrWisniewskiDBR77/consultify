-- Register the "closure" section in the initiative section library
-- (created by 529_initiative_section_types.sql) so the frontend's
-- ClosureSection.tsx (registry key 'closure', component_key 'closure',
-- server/src/components/Initiatives/sections/registry.ts) is actually
-- reachable through InitiativeDocumentView's DB-backed section renderer, not
-- just present in the frontend registry (a registry-only entry silently
-- never renders once this table has rows — the renderer reads its section
-- list from here, not from the frontend default map).
--
-- Deliberately a SEPARATE, later-numbered file from
-- 20260802_exe008_closure_evidence_gate.sql (which creates
-- initiative_closure_requests/initiative_closure_evidence) — see that file's
-- own header comment for why: this project's migration runner executes every
-- "20260802_...sql"-style dated file before any plain-numbered file, so a
-- seed insert into initiative_section_types placed in the 20260802 file
-- would run before that table exists on a fresh install. Numbered 933
-- (highest existing plain-numbered migration at the time of writing was 932)
-- to guarantee it runs after 529_initiative_section_types.sql.
--
-- Native Postgres syntax (`ON CONFLICT (id) DO NOTHING`, not SQLite's
-- `INSERT OR IGNORE`) — this file is run directly against Postgres by the
-- project's own migration runner and, per Codex review, may also be run
-- directly via `psql < file.sql`, so it must not depend on any
-- dialect-rewriting layer. `initiative_section_types` has no unique
-- constraint on `key`, only PRIMARY KEY(id) (verified against the live
-- schema — 529_initiative_section_types.sql relies on deterministic ids like
-- 'ist-closure' for its own idempotency), so conflict on `id` is the
-- correct and only available idempotency key here.
--
-- Guarded by an existence check (not a bare INSERT) so this migration is a
-- clean no-op — not an error — if it is ever run against a database where
-- initiative_section_types does not exist yet, instead of assuming the
-- ordering observed today holds forever.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'initiative_section_types'
  ) THEN
    INSERT INTO initiative_section_types
      (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active)
    VALUES
      ('ist-closure', 'closure', 'Closure & Evidence', 'Zamknięcie i dowody', 'Closure request, evidence pack and approval workflow required before DONE', 'Wniosek o zamknięcie, pakiet dowodów i proces zatwierdzenia wymagany przed DONE', 'content', 'left', 145, 'CheckCircle2', 'text-emerald-600', 'from-emerald-600/10 to-teal-600/10', 'closure', 1, 1)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
