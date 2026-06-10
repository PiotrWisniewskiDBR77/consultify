# Interview Enterprise (V4-INTV) — Code-Verified Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** `interviewEnterpriseService.ts` + `interview-enterprise.routes.ts` mounted at `/api/interview-v4`.
**Excluded (other agents):** main structured Interview (`/api/interview`, `interview.routes.ts`, `InterviewController.ts`, `v8/interview.routes.ts`), Discovery canvas.

---

## VERDICT: **HALF-BUILT — wired but never exercised; will 500 on first call in the running app**

Not "dead code" (it is reachable over HTTP and has a full frontend API client), but **not alive** either: nothing in the product calls it, and the database tables it depends on are not created by the migration system the app actually runs. It is a complete, coherent vertical slice that was committed, mounted, given an API client — and then abandoned mid-March, never connected to a UI and never schema-provisioned in the canonical migration path.

### The 4 hard evidence points

| # | Question | Finding | Evidence |
|---|----------|---------|----------|
| 1 | **Route mounted?** | **YES — unconditionally.** | `server/src/Gateway.ts:138` imports it; `Gateway.ts:927` → `app.use('/api/interview-v4', interviewEnterpriseRoutes);`. No feature flag, no `mountStub`. Auth + demo guard applied (`routes:19-20`). |
| 2 | **Any UI calls it?** | **NO.** A full API client exists but is **never invoked.** | `src/services/api.ts:17318-17509` defines 22 `interview*` enterprise methods. Grep of all `*.ts`/`*.tsx` under `src/` (excluding `api.ts`) for every method name returns **zero** call sites. No component, hook, or page imports them. Dead at the product layer. |
| 3 | **Do its tables exist?** | **NO — not in the migration system the app runs.** | The service writes to 8 tables (`interview_respondent_segments`, `interview_quotas`, `interview_distributions`, `interview_reminder_schedules`, `interview_evidence_access_log`, `interview_diagnostics_snapshots`, `interview_findings`, `organization_context_versions`) plus 3 columns on `interview_sessions` (`min_cohort_size`, `export_gating`, `anonymity_mode`). **None** are created by `DatabaseInitializer.ts` (the boot-time ensure-schema). They exist only in (a) the **DEPRECATED** legacy `server/migrations/652_v4_interview_enterprise.sql` and (b) the **never-auto-run** `server/migrations-v2/001_baseline_20260413.sql`. See §3 for the full migration-system analysis. |
| 4 | **Last meaningfully touched?** | **2026-03 — abandoned ~3 months.** Only 2 commits ever. | `git log` shows: created `2026-03-06` (`05b994e24c feat(V4): Interview Enterprise (INTV-01..07)`), last touched `2026-03-28` (`2d8a4feb20 chore: checkpoint deployment readiness work` — a bulk "capture in-progress state" sweep, made-with Cursor). No commits since. No follow-up, no UI wiring, no migration cleanup. |

**Net:** mounted ✓, UI ✗, tables ✗(in active path), abandoned ✓ → **HALF-BUILT, runtime-broken, unused.**

---

## Recommendation: **LEAVE-DORMANT (de-risk now) — REVIVE later if multi-respondent surveys become a roadmap item; do NOT delete yet**

Rationale:
- **Don't delete:** the code is genuinely good (see §4), offers capabilities the main module lacks (see §5), and is only ~1.2k lines across 2 files + an api.ts block. Deleting destroys real value to remove near-zero weight.
- **Don't revive now:** it's not on the GA-06-08 critical path, has no UI, and its schema isn't provisioned. Reviving means building a whole frontend surface — that's an M/L effort with no current product demand signal.
- **Do de-risk now (S):** it is currently a **latent 500-generator mounted in prod under auth**. Anyone who discovers `/api/interview-v4/...` (or a future dev who wires the existing api.ts client) gets opaque 500s because the tables don't exist. Either feature-flag the mount off, or guarantee the schema. Pick one (see §6 P0).

**Effort if you choose to fully REVIVE later:** **L** — service is done (S to finish hardening), schema is written (S to wire into migrations-v2), but the **entire frontend is missing** (M–L: segments/quotas UI, distribution dashboard, diagnostics views, findings pipeline board, context-version diff viewer). The api.ts client is already there, which removes the plumbing layer.

---

## 1. Route mount — CONFIRMED MOUNTED (unconditional, authed)

`server/src/Gateway.ts`:
```
138:  import interviewEnterpriseRoutes from './routes/interview-enterprise.routes.js';
927:  app.use('/api/interview-v4', interviewEnterpriseRoutes);
```
Adjacent to `app.use('/api/interview', deprecationHeader(...), interviewRoutes)` (line 926). The enterprise mount has **no** `deprecationHeader`, **no** `mountStub`, **no** env gate — it is a first-class, always-on route group.

Route file applies global middleware (`interview-enterprise.routes.ts:19-20`):
```
router.use(verifyToken);
router.use(demoContextMiddleware);
```
So every endpoint is auth-protected and demo-aware. **22 endpoints** across 7 feature groups (V4-INTV-01..07): segments, quotas, distributions, distribution-stats, send, reminder-schedules, evidence access-log, diagnostics (create/get), findings (create/get/promote/status), cohort-check, export-gating, context versions (create/list/get/sign-off/diff).

---

## 2. UI usage — CONFIRMED ZERO

- **Backend → only the route file uses the service.** `grep -rn "interviewEnterprise" server/src` → the service definition, the route file, and the Gateway import. Nothing else.
- **Frontend api.ts client exists** (`src/services/api.ts:17318-17509`, 22 methods, all hitting `${API_URL}/interview-v4/...`). This is real, typed, and complete.
- **Frontend client is never called.** Grep for each of the 22 method names (`interviewCreateSegment`, `interviewGetFindings`, `interviewCheckCohort`, `interviewCreateContextVersion`, etc.) across all `src/**/*.ts*` excluding `api.ts` → **0 results.**
- `grep -rni "enterprise" src/components/Interview` returns only unrelated prose ("BCG Enterprise Level" template-builder copy, ERP "Enterprise Resource Planning" content) — nothing referencing the V4-INTV API.

**Conclusion:** the api.ts client is the only consumer, and it has no callers. The feature has no product surface whatsoever.

---

## 3. Tables — the decisive finding (two competing migration systems; enterprise tables live in neither active path)

The service issues raw INSERT/SELECT/UPDATE against 8 tables and reads 3 columns on `interview_sessions`. Where do those come from?

**Boot-time schema (`DatabaseInitializer.ts`):** ensures a curated list of "critical" tables incl. `interview_sessions`, `interview_questions`, etc. (lines 71-78). **None of the 8 enterprise tables are in that list** (`grep` of the 8 names against `DatabaseInitializer.ts` → NONE). And the `interview_sessions` CREATE there does **not** include `min_cohort_size` / `export_gating` / `anonymity_mode`. So the boot ensure-schema does **not** provision Enterprise.

**Migration files that DO define them — but both are out of the active path:**

| Source | Creates enterprise tables? | Runs? |
|--------|---------------------------|-------|
| `server/migrations/652_v4_interview_enterprise.sql` | YES — all 8 tables + the 3 `interview_sessions` columns (incl. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). | **Directory is DEPRECATED.** `server/migrations/README.md`: *"DEPRECATED - Migrations moved … Legacy migrations have been archived … New migrations live in `server/migrations-v2/`."* The archive README: these *"should never be run again."* |
| `server/migrations-v2/001_baseline_20260413.sql` | YES — all 8 (`public.interview_*`, `public.organization_context_versions`) + the 3 columns. | **`migrations-v2` is not referenced by any `server/src` code** (`grep -rln "migrations-v2" server/src` → nothing). The app never auto-applies it at boot. |

**What the app/runner actually do:**
- **At boot** (`server/src/index.ts:293-317`) the only migration runner invoked is the **Table Platform** runner in `DatabaseInitializer.ts:3076` (`runTablePlatformMigrations`). Its file filter is `/^(7\d{2}|\d{8})_.*\.sql$/` (line 3103) — **only `7xx` or 8-digit-date files.** `652_…` starts with `6` and is **excluded by pattern.** So the boot path provisions neither 652 nor the v2 baseline.
- **The CLI migrator** `package.json:177 db:migrate` → `server/scripts/migrate.postgres.ts` defaults `--dir` to **`server/migrations`** (line 254), the *deprecated* dir — not `migrations-v2`. In that dir `652` is > 500 so it isn't skipped by the `<500` rule, meaning a manual `npm run db:migrate` *could* in principle apply `652_v4_interview_enterprise.sql`. BUT: (a) the README declares that whole dir dead, (b) there is a **duplicate `652` prefix** (`652_v4_ai_governance.sql` AND `652_v4_interview_enterprise.sql`), and (c) nothing in the deploy/boot pipeline runs `db:migrate` automatically (`grep` for `migrate.postgres`/`db:migrate` in CI/Docker/render → only the package.json script defs). So whether the tables exist in any given DB is **non-deterministic and depends on manual operator action against a deprecated directory.**

**Runtime consequence:** in the running app, calling any V4-INTV endpoint that touches these tables (i.e. essentially all of them) will throw a Postgres "relation does not exist" → **500**. This is the strongest single proof the feature was **never actually run end-to-end.** A working feature whose schema lived only in a deprecated/never-auto-run migration would have surfaced 500s immediately the first time anyone used it — which never happened because nobody ever used it (§2).

> Note: the service also implicitly assumes an `interview_evidence` table (it audits access by `evidenceId`); `652` and the v2 baseline create `interview_evidence` too, same provisioning problem.

---

## 4. Code quality / completeness — GOOD; no stubs, would revive cleanly

The 771-line service is **complete and coherent**, not a stub farm:
- **Zero `TODO`/`FIXME`/`throw new Error('not implemented')`** in the service or routes.
- Consistent org-scoping: every query carries `organization_id = ?` (service) sourced from authenticated identity (route `requireUser`, `routes:22-34`).
- Parameterized SQL throughout (no string interpolation of user input) → no SQL-injection surface.
- Proper Zod validation on every mutating endpoint (channel enums, email format, severity/status enums, length caps).
- Real domain logic, not placeholders: `checkCohortSize`/`checkExportGating` implement k-anonymity suppression (min cohort vs completed-distribution count); `diffContextVersions` computes added/removed/changed keys across JSON context snapshots; `getDistributionStats` aggregates funnel + completion rate; `promoteFindingToInitiative` carries traceability IDs.
- Sensible helpers (`safeJson`, `safeJsonArray`, row-mappers) with try/catch JSON guards.

**Minor smells (non-blocking):**
- `safeJsonArray` is defined and used; `getDb()`/`this.db` is only used by `createContextVersion` while every other method goes through `queryHelpers.*` directly — mild inconsistency (the `db` member is largely vestigial).
- `respondentCount` on segments is always returned as `0` on create and read from a `respondent_count` column that nothing ever increments — quota/segment counters are **write-once, never maintained** (no counter-update logic on distribution completion). This is the one place the logic is genuinely incomplete: cohort checks against a per-segment count will always read 0 → always suppressed. A revive must wire counter maintenance.
- `createReminderSchedule` persists a schedule row but **there is no scheduler/worker** that ever reads `interview_reminder_schedules` and sends reminders. Distribution `markDistributionSent` flips status but no email is actually dispatched (no mailer call). So "distribution engine" is a data model + status state-machine, **not** an actual sending engine. This is the largest completeness gap.

**Revive-ability:** the service/route layer is ~90% done; the missing pieces are (a) schema wiring into migrations-v2, (b) counter maintenance, (c) an actual mail/reminder worker, and (d) the entire frontend. Fast to finish the backend; the frontend is the real cost.

---

## 5. Distinct value vs the main Interview module — GENUINELY DIFFERENT, not duplication

The main structured Interview (`InterviewController.ts`) is a **single-respondent, consultant-driven** flow: one `interview_sessions` row owned by `owner_id`, questions answered internally, summary facts/gaps/constraints/pain-points. It models *one* discovery conversation. It has **no** public distribution, **no** tokens, **no** email channels, **no** quotas, **no** segments, **no** anonymity/cohort suppression, **no** branching engine.

Interview Enterprise adds a **different product**: a **multi-respondent survey/diagnostic** system —
- public-token distributions across email/link/webhook channels with a funnel state-machine (pending→sent→opened→started→completed→expired),
- respondent **segmentation + quotas**,
- **branching** types (`BranchingRule`, matrix/ranking/multi_select question configs),
- **anonymity governance** (identified/anonymous/pseudonymous, k-anonymity min-cohort suppression, export gating),
- **diagnostics snapshots** (themes/sentiment/trends/segments/drivers),
- a **findings→recommendation→initiative** traceability pipeline,
- **org-level context versioning** with confidence scores, source citations, reviewer sign-off, and version diffing.

**Assessment:** this is **complementary, not redundant.** It is the "enterprise survey at scale" variant the main module deliberately doesn't do. The overlap is only nominal (both touch `interview_sessions`). If multi-respondent diagnostics ever become a roadmap need, this is a strong head-start — which is the core reason **not** to delete it.

---

## 6. Findings & remediation (it IS mounted, so security/runtime matter)

### P0 — Latent 500 generator mounted in production
**Issue:** all 22 endpoints are live under auth, but their tables aren't provisioned by the boot or auto-run migration path → guaranteed 500 on use. A future dev wiring the existing `api.ts` client, or any probe of `/api/interview-v4/*`, hits opaque server errors.
**Remediation — pick ONE:**
- **(Recommended, S)** Gate the mount off until revived: wrap `Gateway.ts:927` behind a feature flag / `mountStub` (matching the pattern used for `workqueue`/`connectors` on lines 930-931), so the surface returns a clean "not enabled" instead of 500s, and signals dormancy.
- **(If you intend to keep it warm, M)** Port `652_v4_interview_enterprise.sql` into a properly-numbered `migrations-v2` file (the v2 baseline already contains the DDL, so this may just be confirming the baseline is applied in target envs) and add the 8 tables to `DatabaseInitializer.ts`'s ensure-list so dev/SQLite doesn't 500 either.

### P1 — "Distribution engine" doesn't distribute
`markDistributionSent` and `createReminderSchedule` persist state but **no mailer / no scheduler** consumes them. If revived, this is the headline gap — the engine is a data model without an actuator. (M)

### P1 — Segment/quota counters never maintained
`respondent_count` / `current_count` are written as 0 and never incremented on distribution completion → `checkCohortSize(segmentId)` always returns suppressed; quotas never close. Wire counter updates into the distribution-completion path. (S)

### P2 — Org-scoping is solid; one note
Auth + org-scoping are correct (every query is `organization_id`-filtered from the authenticated identity). `requireUser` falls back to `x-organization-id` header / `organizationId` query param when the token lacks an org — acceptable given `verifyToken` runs first, but worth confirming the token path is always populated so the header fallback can't be used for cross-org access. Low risk as-is. (S, verify-only)

---

## 7. If you DELETE instead (not recommended, but here's the exact surface)

Removing Enterprise is low-risk because nothing depends on it. Exact removal list:
1. `server/src/services/interviewEnterpriseService.ts` (whole file).
2. `server/src/routes/interview-enterprise.routes.ts` (whole file).
3. `server/src/Gateway.ts:138` (import) and `:927` (mount).
4. `src/services/api.ts:17318-17509` — the 22 `interview*` V4-INTV client methods (the block between the `// V4-INTV: Interview Enterprise API` banner and `interviewDiffContextVersions`). **Verify boundaries:** the very next method (`organizationContextGet`, line 17510) is a *separate* feature — do not remove it.
5. Optionally drop `server/migrations/652_v4_interview_enterprise.sql` and the enterprise `CREATE TABLE`s from `migrations-v2/001_baseline_20260413.sql` (and `… 4.sql` duplicate) **only if** the tables truly don't exist in any live DB — check target DBs first, since dropping DDL doesn't drop already-created tables.

**Dependency confirmation:** `grep -rn "interviewEnterprise|interview-enterprise"` shows references confined to those exact files; no other service, controller, job, test, or component imports the service or its types. Safe to remove with zero blast radius beyond the files above.

---

## Summary line

**HALF-BUILT.** Mounted (`Gateway.ts:927`), full api.ts client (`api.ts:17318-17509`) with **zero UI callers**, depends on 8 tables provisioned only by a **deprecated/never-auto-run** migration path (will **500** in the running app), last touched **2026-03-28** with only 2 commits ever. Code quality is **high** and the feature is **genuinely distinct** from the single-respondent main Interview. **Recommendation: LEAVE-DORMANT — feature-flag the mount off now (S) to stop latent 500s; preserve for a future multi-respondent-survey revive (L, mostly frontend). Do not delete.**
