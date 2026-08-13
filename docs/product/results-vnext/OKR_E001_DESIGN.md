# OKR-E001 — Program & Cycle — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
First epic of the OKR domain — an entirely new domain in this program.
Backend only — UI Registry is RN-G2. Mirrors ROI-E001's structure (the most
recent "first epic of a domain" precedent), reuses the RN-G1 platform
kernel exactly as KPI/ROI did.

Everything 7 more OKR epics will build on is established here — the
Program/Cycle/Set boundary must be right from the start.

---

## 0. Ground truth

Unlike ROI (prose-only ledger), **OKR-E001 has a full per-AC table** in
`EPIC_LEDGER_LIVE.md` (Decision ID / Aggregate / Command-API / Schema /
Roles columns, quoted verbatim in the design draft this doc is built
from) — 6 ACs across OKR-F-001 (Program) and OKR-F-002/003 (Cycle):

1. **OKR-F-001-AC-01** — Program publish is versioned/audited; a policy
   change never silently reinterprets already-closed Cycles created under
   a prior `policy_version_id`.
2. **OKR-F-001-AC-02** — Only an active Program may open a new Cycle,
   blocked at the command level, not just UI.
3. **OKR-F-002-AC-01** — Cycle transitions (Planned→Drafting→Active→
   Review→Closed, or →Cancelled) execute only as explicit commands, never
   as UI guessing dates.
4. **OKR-F-002-AC-02** — Regression guard: no vNext code treats `cycle_id`
   itself as OKR Set identity — fixes the AS-IS mistake
   (`okr_cycles.dept_id/team_id` flattening Set into Cycle).
5. **OKR-F-003-AC-01** — A scheduler proposes/executes due Cycle
   transitions under policy with an audited `actor_type=service`; manual
   override always possible.
6. **OKR-F-003-AC-02** — Cadence-occurrence generation is idempotent per
   window; rerunning the scheduler never duplicates a
   `cadence_occurrence_id`.

**D08/D09** (`01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md`, quoted): D08 —
"OKR Set jest materializowany, Set = Cycle + scope/team + owner." D09 —
"OKR niezależny od KPI/ROI/Initiative — tylko jawne referencje kontekstowe
lub neutralny source binding... brak FK/roll-up inheritance."

**AS-IS legacy D09 violation, confirmed by direct code read**:
`server/migrations/914_okr_management.sql`'s `okr_key_results.kpi_id TEXT`
has a live FK to `initiative_kpis`; `okrService.ts` imports
`kpiDefinitionService.js` cross-domain and reads `kpi_time_series` directly
via `kr.kpi_id`; the frontend has a "Related KPI" dropdown. Auto-scoring
from KPI was already reverted (informational-only today), but the
FK/import/UI-dropdown structurally still exist. **D09 for OKR-E001 means:
zero FKs from `okr_vnext_programs`/`okr_vnext_cycles` to `initiatives`,
`kpi_*`, `roi_*`, `tasks`, or `projects`, period.**

---

## 1. Program vs. Cycle vs. (future) Set

```
OKRProgram   — org-wide policy container. draft|active|suspended|retired.
└─ OKRCycle  — time-boxed window under one Program. planned|drafting|active|review|closed|cancelled.
   └─ OKRSet — (OKR-E002, NOT this epic) = Cycle + scope_type/scope_id + owner_user_id, materialized.
```

**OKR-E001 builds Program and Cycle only.** No `okr_vnext_sets`,
`Objective`, `KeyResult`, `Alignment`, `CheckIn`, `Review`, `Reflection` —
those are OKR-E002 through OKR-E008. `okr_vnext_cycles` gets no
`dept_id`/`team_id`/`scope_type`/`scope_id` columns — the exact AS-IS
mistake — and no read model in this package returns anything shaped like
"the objectives for cycle X."

---

## 2. Decisions

All 11 decision points from the design draft are ratified as specified.

| # | Question | Decision | Rationale |
|---|---|---|---|
| P1 | Table prefix: `rvn_okr_*` or `okr_vnext_*`? | **`okr_vnext_*`** for tables, `rvn_okr_` for the migration filename. | Both `EPIC_LEDGER_LIVE.md` and `04_OKR_IMPLEMENTATION_PLAN.md` §10 independently name every OKR table with `okr_vnext_`; `EXECUTION_LEDGER.md:448` confirms this is the deliberate, already-decided divergence across the three domains — not invented here. |
| P2 | Row-level ABAC visibility for Program/Cycle? | **No.** Plain `organization_id` scoping for reads; RBAC (`requireOrgRole`) gates writes. | The AC table's "Roles/visibility" cells name literal roles, never a visibility-mode phrase — contrast OKR-E002's Set row, which explicitly cites scope/visibility-default language. Program/Cycle are org-wide configuration, normally one active Program per org; ABAC protects individual work products, not org-wide policy everyone needs to see. |
| P3 | New `RVN_RESOURCE_TYPES` entries despite P2? | **Yes — append `'okr_program'`, `'okr_cycle'`.** Not for ABAC rows, but because `PlatformEventEnvelope.aggregateType` is typed to this union and every event this epic writes needs a value from it. | Confirmed by reading `resourceTypes.ts` directly — `'okr_set'` is already reserved, these two are not; the type constraint would fail `tsc` without this. |
| P4 | What gates "OKR Program Admin" writes? | **Reuse the existing 3-level RBAC role** (`requireOrgRole('admin','superadmin')`). No new PBAC capability key. | The capability-key system is documented shadow-only rollout; inventing a new granular capability with zero existing UI/data model is out of scope. The RBAC helper is already hard-enforced and directly usable. |
| P5 | Where does `visibility_default` actually take effect? | **`publishProgram` authors the platform's `rvn_platform_visibility_policies` row** for `(organization_id, domain:'okr')` in the same transaction — the FIRST product-facing writer of that platform table (KPI/ROI only had it seeded by an out-of-band rollout script). Requires one new platform primitive, `publishVisibilityPolicy` (§4.4). | Confirmed `getActiveVisibilityPolicy` reads this table directly as SSOT — without this wiring, OKR-E002's `createOkrSet` would be permanently fail-closed until an undocumented ops script runs, repeating KPI/ROI's own gap rather than fixing it once a domain has an admin-configurable policy screen at E001 stage (which OKR uniquely does). |
| P6 | Self-approval denial for `publishProgram`? | **No.** | The plan's "Program author cannot publish alone" line has no concrete schema field, AC, or endpoint backing it anywhere (compensation is an explicit non-goal). Not fabricating an unsourced maker-checker, per the same discipline ROI-E001 D1 used. Flagged forward if a future Founder decision concretizes this. |
| P7 | At most one active Program per org? | **Yes — partial unique index** `(organization_id) WHERE status='active'`. | Structurally necessary: Cycle has exactly one `program_id`, "the org's OKR policy" is singular everywhere else in this design (P5's visibility authoring). Mirrors the platform's own EXCLUDE-one-active pattern. |
| P8 | At most one active Cycle per Program? | **No such constraint.** | No AC names Cycle uniqueness (unlike ROI-E001's AC-02); the plan's `cycle_model: custom` option implies legitimate overlapping cadences. |
| P9 | DB-level ordering CHECK across the 10 Cycle timestamp columns? | **No** — command-layer validation only, one DB CHECK limited to `start_date <= end_date`. | No AC requires exhaustive DB-level ordering; a rigid CHECK forecloses legitimate edge cases more cheaply caught in application code. |
| P10 | Scheduler: live cron, or pure callable primitive? | **Pure, fully-tested, directly-callable functions.** Wiring an actual periodic trigger is out of scope. | Matches `outboxDrain.ts`'s own precedent exactly — built and realDB-tested, not wired to a live cron. No established job-scheduler convention exists yet to hook into. |
| P11 | Build `okr_vnext_checkin_occurrences` now, or defer to OKR-E004? | **Build now, minimal shell** (`cadence_occurrence_id`/`cycle_id`/`window_start`/`window_end` only). | AC OKR-F-003-AC-02 pins this schema pointer directly to this epic; the idempotency mechanism must exist for the scheduler to be testable. Same "reserve now, avoid ALTER later" discipline as `rvn_kpi_definitions.response_policy_id`/`rvn_roi_cases.submitted_by`. |

**One additional confirmation**: the draft's own flagged open DoD item —
`reflection_required_for_close`'s default — **stays `false`** (fail-safe/
waivable) until a Founder decision concretizes plan §20's EVIDENCE_NEEDED
#3. Not resolved here; correctly left open in the DDL's own comment.

---

## 3. Legacy collision check

`okr_vnext_*` — confirmed greenfield (zero hits anywhere in the worktree
before this design). Live legacy tables untouched by E001 (archive routing
is OKR-E008's job, matching KPI-E007/ROI-E008's pattern): `okr_cycles`,
`okr_objectives`, `okr_key_results`, `okr_check_ins`
(`server/migrations/914_okr_management.sql`), read via `okrService.ts` and
`resultsStrategic.routes.ts`. None of this is modified by E001.

`'okr_set'` in `RVN_RESOURCE_TYPES`/`CanonicalObjectTypeValues` is already
reserved since RN-G1 — confirmed by direct read, untouched by this epic.
`'okr_set.published'` already sits as a placeholder in
`EVENT_TYPE_CONSUMER_GROUPS` — this epic does not touch it, reserved for
OKR-E002 (same posture ROI-E001 D7 took toward `roi_case.decided`).

---

## 4. Schema (full DDL)

Migration file: `server/migrations/20260822_rvn_okr_program_cycle.sql`.

```sql
-- ============================================================
-- okr_vnext_programs — root aggregate #1. Org-wide policy container.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_programs (
  program_id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                  TEXT NOT NULL,
  name                              TEXT NOT NULL,
  status                            TEXT NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft','active','suspended','retired')),

  cycle_model                       TEXT NOT NULL DEFAULT 'quarterly'
                                      CHECK (cycle_model IN ('quarterly','trimester','half_year','annual','custom')),
  annual_direction_enabled          BOOLEAN NOT NULL DEFAULT false,
  objective_min_recommended         INT NULL,
  objective_max_recommended         INT NULL,
  kr_min_required                   INT NOT NULL DEFAULT 2,
  kr_max_recommended                INT NULL,
  checkin_frequency                 TEXT NOT NULL DEFAULT 'biweekly'
                                      CHECK (checkin_frequency IN ('weekly','biweekly','monthly','custom')),
  approval_required                 BOOLEAN NOT NULL DEFAULT true,
  scoring_model                     TEXT NOT NULL DEFAULT 'zero_to_one'
                                      CHECK (scoring_model IN ('zero_to_one','percentage','categories','custom')),
  objective_rollup_model            TEXT NOT NULL DEFAULT 'none'
                                      CHECK (objective_rollup_model IN ('equal_average','weighted_average','manual','none')),
  confidence_enabled                BOOLEAN NOT NULL DEFAULT true,
  confidence_model                  TEXT NOT NULL DEFAULT 'high_medium_low'
                                      CHECK (confidence_model IN ('high_medium_low','numeric','custom')),
  objective_confidence_model        TEXT NOT NULL DEFAULT 'lowest_kr'
                                      CHECK (objective_confidence_model IN ('lowest_kr','owner_selected','custom')),
  -- Platform's real enum spelling (visibilityResolver.ts), not the plan
  -- doc's prose spelling.
  visibility_default                TEXT NOT NULL DEFAULT 'OPEN_ORG'
                                      CHECK (visibility_default IN ('OPEN_ORG','SCOPE','MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL')),
  committed_vs_aspirational_enabled BOOLEAN NOT NULL DEFAULT true,
  manager_review_required           BOOLEAN NOT NULL DEFAULT true,
  self_review_required              BOOLEAN NOT NULL DEFAULT false,
  -- EVIDENCE_NEEDED #3 (plan §20) still OPEN — false is the fail-safe
  -- default until Founder decides, not a guess at eventual policy.
  reflection_required_for_close     BOOLEAN NOT NULL DEFAULT false,
  recognition_enabled               BOOLEAN NOT NULL DEFAULT true,

  -- Circular FK with okr_vnext_program_policy_versions — plain nullable
  -- column now, ALTERed after both tables exist below. Same resolution
  -- rvn_kpi_definitions.current_definition_version_id used.
  active_policy_version_id          UUID NULL,

  row_version                       INT NOT NULL DEFAULT 1,
  created_by                        TEXT NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                        TEXT NULL,
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_programs_org_status
  ON okr_vnext_programs(organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_programs_one_active_per_org
  ON okr_vnext_programs(organization_id)
  WHERE status = 'active';

-- ============================================================
-- okr_vnext_program_policy_versions — append-only publish history.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_program_policy_versions (
  policy_version_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id           UUID NOT NULL REFERENCES okr_vnext_programs(program_id),
  organization_id      TEXT NOT NULL,
  version_number       INT NOT NULL,
  -- Immutable snapshot of every policy field on okr_vnext_programs at the
  -- moment publishProgram() was called — the mechanism satisfying
  -- OKR-F-001-AC-01: Cycles pin policy_version_id at creation, so a later
  -- republish never reinterprets a Cycle created under an earlier snapshot.
  snapshot             JSONB NOT NULL,
  published_by         TEXT NOT NULL,
  published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_ppv_program
  ON okr_vnext_program_policy_versions(organization_id, program_id);

REVOKE UPDATE, DELETE ON okr_vnext_program_policy_versions FROM PUBLIC;

ALTER TABLE okr_vnext_programs
  ADD CONSTRAINT fk_okr_vnext_programs_active_policy_version
  FOREIGN KEY (active_policy_version_id)
  REFERENCES okr_vnext_program_policy_versions(policy_version_id);

-- ============================================================
-- okr_vnext_cycles — root aggregate #2. Calendar/governance window.
-- ============================================================
-- REGRESSION GUARD (OKR-F-002-AC-02): do NOT add dept_id/team_id/
-- scope_type/scope_id here — that was the exact AS-IS mistake. Scope
-- belongs exclusively to okr_vnext_sets (OKR-E002), not created here.
CREATE TABLE IF NOT EXISTS okr_vnext_cycles (
  cycle_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          TEXT NOT NULL,
  program_id                UUID NOT NULL REFERENCES okr_vnext_programs(program_id),
  name                       TEXT NOT NULL,

  start_date                 DATE NOT NULL,
  end_date                   DATE NOT NULL,
  draft_open_at              TIMESTAMPTZ NOT NULL,
  submission_due_at          TIMESTAMPTZ NOT NULL,
  approval_due_at            TIMESTAMPTZ NULL,
  active_start_at            TIMESTAMPTZ NOT NULL,
  midcycle_review_at         TIMESTAMPTZ NULL,
  final_update_due_at        TIMESTAMPTZ NOT NULL,
  review_open_at             TIMESTAMPTZ NOT NULL,
  reflection_due_at          TIMESTAMPTZ NOT NULL,
  manager_review_due_at      TIMESTAMPTZ NULL,
  close_at                   TIMESTAMPTZ NOT NULL,

  status                     TEXT NOT NULL DEFAULT 'planned'
                               CHECK (status IN ('planned','drafting','active','review','closed','cancelled')),
  -- Snapshot pointer, set once at creation from
  -- okr_vnext_programs.active_policy_version_id — NEVER updated afterward.
  policy_version_id          UUID NOT NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),

  row_version                 INT NOT NULL DEFAULT 1,
  created_by                  TEXT NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                  TEXT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_cycles_org_program_status
  ON okr_vnext_cycles(organization_id, program_id, status);

-- ============================================================
-- okr_vnext_checkin_occurrences — minimal shell (Decision P11).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_checkin_occurrences (
  cadence_occurrence_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  cycle_id                    UUID NOT NULL REFERENCES okr_vnext_cycles(cycle_id),
  window_start                DATE NOT NULL,
  window_end                  DATE NOT NULL,
  generated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by                 TEXT NOT NULL DEFAULT 'system:okr_cycle_scheduler',
  UNIQUE (cycle_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkin_occ_cycle
  ON okr_vnext_checkin_occurrences(organization_id, cycle_id);
```

No trigger needed on `okr_vnext_program_policy_versions` — pure
INSERT-only, `REVOKE UPDATE/DELETE` is sufficient (never has a *partial*
mutability window the way KPI/ROI's approval snapshots do).

---

## 5. New platform primitive: `publishVisibilityPolicy` (Decision P5)

Added to `server/src/services/resultsVnext/platform/visibilityResolver.ts`,
alongside `getActiveVisibilityPolicy`:

```typescript
/**
 * Write counterpart to getActiveVisibilityPolicy — closes any currently
 * active row for (organizationId, domain) and opens a new one, inside the
 * caller's own transaction/pinned client. First real writer of
 * rvn_platform_visibility_policies from product code — OKR-E001's
 * publishProgram is that writer for domain='okr'.
 */
export async function publishVisibilityPolicy(
  client: PoolClient,
  input: { organizationId: string; domain: string; mode: string; publishedBy: string }
): Promise<ActiveVisibilityPolicy> {
  const { organizationId, domain, mode, publishedBy } = input;

  await client.query(
    `UPDATE rvn_platform_visibility_policies
        SET effective_to = now()
      WHERE organization_id = $1 AND domain = $2
        AND is_active = true
        AND (effective_to IS NULL OR effective_to > now())`,
    [organizationId, domain]
  );

  const nextVersionResult = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(policy_version), 0) + 1 AS next
       FROM rvn_platform_visibility_policies
      WHERE organization_id = $1 AND domain = $2`,
    [organizationId, domain]
  );
  const nextVersion = nextVersionResult.rows[0].next;

  const insertResult = await client.query<{ policy_id: string; policy_version: number }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, allow_narrowing_only,
        default_scope_type, is_active, effective_from, created_by)
     VALUES ($1, $2, $3, $4, true, NULL, true, now(), $5)
     RETURNING policy_id, policy_version`,
    [organizationId, domain, nextVersion, mode, publishedBy]
  );
  const row = insertResult.rows[0];
  return { policyId: row.policy_id, policyVersion: String(row.policy_version) };
}
```

The platform's `EXCLUDE USING gist` constraint on this table requires the
UPDATE-then-INSERT ordering above (inserting before closing the old row
violates the exclusion constraint) — this must run on the **same pinned
client**, inside `publishProgram`'s `applyMutation`, same shape as
`openOrEscalateDeviationCase` being called from inside `recordMeasurement`.

---

## 6. Command layer (`server/src/services/resultsVnext/okr/`)

### 6.1 `createProgram` — `executeAtomicCreate`

Plain INSERT (`status='draft'`, no policy-version row yet). No fail-closed
visibility-policy lookup (Program is not an ABAC resource, P2). Route-layer
guard: `requireOrgRole('admin','superadmin')`.

### 6.2 `editProgramDraft` — `executeAtomicCommand`

`row_version`-CAS update of any policy field. Guard: `status IN
('draft','active')` — editing allowed pre-first-publish and as ongoing
tuning while active (staged fields take effect only for future Cycles once
`publishProgram` snapshots them). Rejected for `suspended`/`retired`.

### 6.3 `publishProgram` — `executeAtomicCommand`

Core of OKR-F-001-AC-01. Inside `applyMutation`, same pinned client:
1. `nextVersionNumber = COALESCE(MAX(version_number),0)+1` for this `program_id`.
2. INSERT the full current field snapshot into `okr_vnext_program_policy_versions`.
3. UPDATE `okr_vnext_programs.active_policy_version_id`; if `status='draft'`, transition to `active`; if already `active`, unchanged.
4. `publishVisibilityPolicy(client, {organizationId, domain:'okr', mode: program.visibility_default, publishedBy: actorId})`.

No self-approval denial (P6).

### 6.4 `createCycle` — `executeAtomicCreate`

Fail-closed guard (OKR-F-001-AC-02): loads `program_id` first; if
`program.status !== 'active'`, throws `OkrCycleProgramNotActiveError` (409)
**before** any INSERT. On success: `policy_version_id =
program.active_policy_version_id` (pinned, never updated after).

```typescript
export class OkrCycleProgramNotActiveError extends Error {
  code = 'PROGRAM_NOT_ACTIVE';
  constructor(programId: string, actualStatus: string) {
    super(`OKR Program ${programId} is not active (status: ${actualStatus}) — cannot open a new Cycle`);
    this.name = 'OkrCycleProgramNotActiveError';
  }
}
```

### 6.5 Cycle lifecycle transitions (OKR-F-002-AC-01)

Generic guarded transition, `runOkrCycleLifecycleTransition` (mirrors
`runRoiCaseLifecycleTransition`/`runKpiLifecycleTransition`):

```typescript
runOkrCycleLifecycleTransition({ eventType: 'okr_cycle.drafting_opened', fromStatuses: ['planned'], toStatus: 'drafting' }, input);
runOkrCycleLifecycleTransition({ eventType: 'okr_cycle.activated',       fromStatuses: ['drafting'], toStatus: 'active' }, input);
runOkrCycleLifecycleTransition({ eventType: 'okr_cycle.review_opened',   fromStatuses: ['active'], toStatus: 'review' }, input);
runOkrCycleLifecycleTransition({ eventType: 'okr_cycle.closed',          fromStatuses: ['review'], toStatus: 'closed' }, input);
runOkrCycleLifecycleTransition({ eventType: 'okr_cycle.cancelled',       fromStatuses: ['planned','drafting','active','review'], toStatus: 'cancelled' }, input);
```

`cancel` is a design addition beyond the epic ledger's own Command/API cell
(which names only open-drafting/activate/open-review/close) — added
because the plan's own lifecycle diagram shows a cancel branch from every
non-terminal state; a Cycle with no cancel path would be a foreseeable gap.
Stated explicitly, not silently added.

`OkrCycleValidationError` (generic invalid-transition guard, mirrors
`RoiCaseValidationError`/`KpiDefinitionValidationError`), discriminated by
`.code` (`INVALID_TRANSITION`).

### 6.6 `okrCycleScheduler.ts` — service-actor functions (P10)

Not exposed over HTTP — internal, calls the same transition commands a
human would.

```typescript
/**
 * For every Cycle in (planned|drafting|active|review) whose next due
 * timestamp has passed 'now', calls runOkrCycleLifecycleTransition with
 * actorUserId=null and actorEffectiveRole='system:okr_cycle_scheduler' —
 * the platform's actual service-actor convention (nullable actorUserId +
 * a 'system:*' role string; there is no separate actor_type column).
 * Idempotent by construction: it calls the same CAS-guarded transition a
 * human would; if already done, the fromStatuses guard rejects harmlessly.
 */
export async function proposeAndExecuteDueCycleTransitions(
  input: { organizationId: string; asOf?: Date }
): Promise<{ transitioned: Array<{ cycleId: string; toStatus: string }> }>

/**
 * Materializes okr_vnext_checkin_occurrences rows for a Cycle from
 * active_start_at through final_update_due_at, at intervals derived from
 * the Program's checkin_frequency (custom = no-op until a later epic
 * defines its interval source). Idempotent via
 * INSERT ... ON CONFLICT (cycle_id, window_start) DO NOTHING.
 */
export async function generateCadenceOccurrences(
  input: { organizationId: string; cycleId: string }
): Promise<{ created: number; skippedExisting: number }>
```

Wiring an actual periodic trigger is out of scope for this epic (P10).

---

## 7. Visibility wiring

No ABAC resource-visibility rows for Program or Cycle (P2). Reads use
plain `WHERE organization_id = $1` — not `buildVisibilityScopedCte`. The
TEXT/UUID join-cast bug class structurally does not apply here (no join
against `rvn_platform_resource_visibility`). `RVN_RESOURCE_TYPES` gains
`'okr_program'`/`'okr_cycle'` (P3), appended never reordered; same two
values appended to `CanonicalObjectTypeValues`. `'okr_set'` stays
untouched. Write auth is `requireOrgRole('admin','superadmin')`, not
`resolveVisibility()` (P2/P4).

**Testing implication**: this epic's negative-path test is "a non-admin
org member gets 403 on every write route" — not a visibility-leak test.
Do not spend realDB-testing budget on an ABAC-join test that doesn't
apply here.

---

## 8. API surface (`server/src/routes/resultsVnext/okr.routes.ts`)

Mounted at `/api/vnext/results/okr`. Structural precedent: `roi.routes.ts`
(most recent sibling — read it first). Every mutating route requires
`requireOrgRole('admin','superadmin')`; `GET` routes require only
`requireOrgAccess()`.

| Method | Path | Command/Repository | Auth |
|---|---|---|---|
| `POST` | `/programs` | `createProgram` | admin |
| `GET` | `/programs` | `listPrograms` | org member |
| `GET` | `/programs/:programId` | `getProgram` | org member |
| `PATCH` | `/programs/:programId/draft` | `editProgramDraft` | admin |
| `POST` | `/programs/:programId/publish` | `publishProgram` | admin |
| `POST` | `/cycles` | `createCycle` | admin |
| `GET` | `/cycles` | `listCycles` | org member |
| `GET` | `/cycles/:cycleId` | `getCycle` | org member |
| `POST` | `/cycles/:cycleId/open-drafting` | transition (planned→drafting) | admin |
| `POST` | `/cycles/:cycleId/activate` | transition (drafting→active) | admin |
| `POST` | `/cycles/:cycleId/open-review` | transition (active→review) | admin |
| `POST` | `/cycles/:cycleId/close` | transition (review→closed) | admin |
| `POST` | `/cycles/:cycleId/cancel` | transition (→cancelled) | admin |

Explicitly not in this package: `/sets/*`, `/objectives/*`,
`/key-results/*`, `/alignments/*` (OKR-E002+), `/my`/`/team-health`/
`/attention`/`/company`/`/advisor/*` (later epics).

**Mount-order note**: no literal-path sub-router collision within this
epic's own set; flag it in the route file header for whoever adds the next
OKR router, same class of bug fixed twice in KPI.

Validators: `server/src/validators/resultsVnextOkr.validators.ts`,
redeclaring shared field helpers locally, matching every existing
convention.

Error mapping: `AtomicWriteConflictError`→409, `AtomicWriteAggregateNotFoundError`→404,
`OkrCycleProgramNotActiveError`→409, `OkrCycleValidationError`→409, Zod→400,
`requireOrgRole` failure→403 (middleware-level), unknown→500.

---

## 9. File list (backend only)

**New:**
- `server/migrations/20260822_rvn_okr_program_cycle.sql`
- `server/src/services/resultsVnext/okr/okrProgramTypes.ts`
- `server/src/services/resultsVnext/okr/okrProgramCommands.ts` (`createProgram`, `editProgramDraft`, `publishProgram`, `OkrProgramValidationError`)
- `server/src/services/resultsVnext/okr/okrCycleTypes.ts`
- `server/src/services/resultsVnext/okr/okrCycleCommands.ts` (`createCycle`, `runOkrCycleLifecycleTransition`, `OkrCycleProgramNotActiveError`, `OkrCycleValidationError`)
- `server/src/services/resultsVnext/okr/okrCycleScheduler.ts`
- `server/src/services/resultsVnext/okr/okrRepository.ts` (plain `organization_id` scoping, no visibility CTE)
- `server/src/services/resultsVnext/okr/README.md`
- `server/src/routes/resultsVnext/okr.routes.ts`
- `server/src/validators/resultsVnextOkr.validators.ts`
- `tests/resultsVnext/okr/okrProgramPublish.realdb.test.ts` (policy-version snapshot + pointer + `publishVisibilityPolicy` side effect + one-active-per-org)
- `tests/resultsVnext/okr/okrCycleLifecycle.realdb.test.ts` (program-not-active guard, all 5 transitions, pinned `policy_version_id` immutability across a Program republish)
- `tests/resultsVnext/okr/okrCycleScheduler.realdb.test.ts` (idempotent transition proposal + idempotent cadence generation)
- `tests/resultsVnext/okr/okrRbacGuard.test.ts` (non-admin 403 on every write route)
- `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/platform/resourceTypes.ts` — append `'okr_program'`, `'okr_cycle'`
- `server/src/types/myWorkRoofPackage.ts` — append same two values to `CanonicalObjectTypeValues`
- `server/src/services/resultsVnext/platform/visibilityResolver.ts` — add `publishVisibilityPolicy`
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new event types (`okr_program.created/draft_edited/published`, `okr_cycle.created/drafting_opened/activated/review_opened/closed/cancelled`, all → `['mywork_projection']`). Do not touch the pre-existing `okr_set.published` entry.
- `server/src/Gateway.ts` (mount `okr.routes.ts`)
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry

**Read-only reference:** `roiCaseCommands.ts`, `roiRepository.ts`,
`roi.routes.ts`, `atomicWrite.ts`, `visibilityResolver.ts`,
`resourceTypes.ts`, `rbac.middleware.ts` (`requireOrgRole`).

---

## 10. Testing discipline (standing rule)

Every new repository/command function needs a direct real-Postgres test.
Priority for this epic:
1. **Policy-version immutability across republish** — create Program,
   publish (v1), create Cycle A (pins v1), edit + republish Program (v2),
   assert Cycle A's `policy_version_id` still points at v1 and v1's stored
   `snapshot` is byte-identical to before v2 existed. Literal AC-01 proof.
2. **Scheduler idempotency** — run `proposeAndExecuteDueCycleTransitions`
   twice against the same due Cycle; second call is a no-op. Run
   `generateCadenceOccurrences` twice; row count unchanged on the second
   run.
3. **RBAC denial**, not ABAC leak — this epic's negative-path shape is
   genuinely different from every prior epic's.

## 11. Definition of done

- [ ] All 13 endpoints work against a real org with a real admin user
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Program publish/republish preserves already-created Cycles' pinned `policy_version_id`
- [ ] `createCycle` rejects when Program is not `active`, verified against real Postgres
- [ ] Scheduler idempotency verified (two-call, not concurrency-race — no race exists here to prove)
- [ ] Non-admin 403 verified on every write route
- [ ] `publishVisibilityPolicy` verified to correctly close the prior active row under the platform's EXCLUDE constraint
- [ ] Full existing KPI + ROI test suites still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E001 rows updated
- [ ] `reflection_required_for_close`'s `false` default explicitly noted as fail-safe-pending-Founder-decision, not silently presented as final
