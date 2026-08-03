-- Register the "closure" section in the initiative section library
-- (created by 529_initiative_section_types.sql) so the frontend's
-- ClosureSection.tsx (registry key 'closure', component_key 'closure',
-- server/src/components/Initiatives/sections/registry.ts) is actually
-- reachable through InitiativeDocumentView's DB-backed section renderer, not
-- just present in the frontend registry (a registry-only entry silently
-- never renders once this table has rows — the renderer reads its section
-- list from here, not from the frontend default map).
--
-- Deliberately a SEPARATE file from
-- 934_initiative_closure_evidence_gate.sql (which creates
-- initiative_closure_requests/initiative_closure_evidence) — see that file's
-- own header comment for why both files were moved out of a "20260802_...sql"
-- -style dated name into this plain-numbered range: this project's migration
-- runner executes every dated file before any plain-numbered file, and
-- several core tables these two files depend on (initiative_section_types,
-- initiative_history) are not reliably present that early on a fresh
-- install. Numbered 933/934 (highest existing plain-numbered migration at
-- the time of writing was 932) to guarantee they run after
-- 529_initiative_section_types.sql and after the tables the 934 file itself
-- needs.
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
      -- is_system/is_active are INTEGER (0/1) on the live table
      -- (529_initiative_section_types.sql: `is_system INTEGER DEFAULT 0`,
      -- `is_active INTEGER DEFAULT 1`) — not boolean. Postgres has no
      -- implicit boolean->integer cast, so this must use 1, not TRUE
      -- (strict-schema repair, 2026-08; same value, correct literal type).
      ('ist-closure', 'closure', 'Closure & Evidence', 'Zamknięcie i dowody', 'Closure request, evidence pack and approval workflow required before DONE', 'Wniosek o zamknięcie, pakiet dowodów i proces zatwierdzenia wymagany przed DONE', 'content', 'left', 145, 'CheckCircle2', 'text-emerald-600', 'from-emerald-600/10 to-teal-600/10', 'closure', 1, 1)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
