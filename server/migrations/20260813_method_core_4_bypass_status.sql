-- ═══════════════════════════════════════════════════════════════════════
-- ★ NAZWA PLIKU: NIE UŻYWAJ SŁOWA „demo" W NAZWIE MIGRACJI SCHEMATU.
--
-- `server/scripts/migrate.postgres.ts` → `isSqliteOnlyMigration()` (ok. linii
-- 318-327) traktuje KAŻDY plik, którego nazwa zawiera `seed`, `mock` albo
-- `demo`, jako plik z danymi demonstracyjnymi i CICHO wyklucza go z przepływu
-- migracji schematu. Bez błędu. Runner kończy się `✅ complete`, exit 0.
--
-- Ten plik nazywał się wcześniej `..._demo_status.sql` i przez to NIGDY nie
-- wykonywał się na świeżej instalacji — kolumny `demo_bypass_active`/`kind`
-- po prostu nie powstawały, a migracje raportowały sukces. Wykryte dopiero
-- przy weryfikacji schematu od zera (`information_schema`), nie po kodzie
-- wyjścia. Wcześniejsze biegi „działały", bo plik aplikowano ręcznie przez
-- `--only`, co ten filtr omija.
--
-- Nazwa kolumny `demo_bypass_active` jest w porządku — chodzi WYŁĄCZNIE
-- o nazwę pliku.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- KOLEJNOŚĆ: ten plik jest krokiem 4/4 rodziny `20260813_method_core_*`.
--
-- Numer w nazwie NIE jest ozdobą. Runner (`server/scripts/migrate.postgres.ts`,
-- `compareMigrationOrder`) sortuje pliki o tej samej dacie LEKSYKALNIE po nazwie.
-- Bez tego numeru kolejność była: http_idempotency → kernel → demo_status →
-- outputs, czyli KONSUMENT PRZED PRODUCENTEM w dwóch miejscach naraz:
--   • `..._http_idempotency` ma FK do `method_sessions`, którą tworzy `..._kernel`
--   • `..._demo_status` robi ALTER na `method_outputs`, którą tworzy `..._outputs`
--
-- Skutek: instalacja OD ZERA padała na
-- `relation "method_sessions" does not exist`. Biegi przyrostowe tego NIE
-- pokazywały, bo każdy plik dochodził osobno, już po swoim producencie.
--
-- Dodając kolejny plik do tej rodziny — nadaj mu następny numer.
-- ═══════════════════════════════════════════════════════════════════════

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
