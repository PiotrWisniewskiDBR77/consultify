-- Shared Method Kernel — explicit demo-bypass status on Session/Output/Report
-- (agent P0B, 2026-08-13).
--
-- CLAUDE.md rule #7 requires the `methodology_review`-pack demo bypass
-- (server/src/method-core/demoBypass.ts) to carry a VISIBLE, structural
-- demonstration marker all the way through the artefacts it produces — not
-- just a one-time notice on the `POST /sessions` response. Before this
-- migration, `demoBypassActive` existed only as a transient HTTP response
-- field at session-creation time; nothing durable recorded it, so an Output
-- or Report frozen from a demo-bypassed session was indistinguishable from a
-- production one once you left the create-session response behind.
--
-- Fully additive + idempotent: only ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- No DROP, no rewrite of existing columns, no DELETE, no CHECK constraint
-- added here (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`; validity of the
-- boolean is enforced at the application layer instead, same discipline
-- already used for limitations_json / findings in 20260813_method_outputs.sql).
-- Safe to re-run on a shared database. NOT executed against demo/staging/
-- production by this agent.

ALTER TABLE method_sessions
  ADD COLUMN IF NOT EXISTS demo_bypass_active BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE method_outputs
  ADD COLUMN IF NOT EXISTS demo_bypass_active BOOLEAN NOT NULL DEFAULT false;

-- `kind` distinguishes the two structured artefacts this table renders from
-- one immutable Output — a Report and a Presentation are the SAME snapshot
-- discipline (structured content_json, server-computed content_hash, never
-- an image — see MethodReportSnapshotService's class doc comment on the
-- screenshot ban) with a different `title`/`content` shape, not a second
-- table. Default 'report' preserves every existing row's meaning unchanged.
ALTER TABLE method_report_snapshots
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'report';

ALTER TABLE method_report_snapshots
  ADD COLUMN IF NOT EXISTS demo_bypass_active BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_method_report_snapshots_kind ON method_report_snapshots(kind);
