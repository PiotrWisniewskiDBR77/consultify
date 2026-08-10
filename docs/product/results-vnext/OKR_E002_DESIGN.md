# OKR-E002 — Materialized Set — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Second epic of the OKR domain, builds on OKR-E001 (Program & Cycle).
Backend only — UI Registry is RN-G2.

**Standing re-verification requirement**: this design was drafted while
OKR-E001's code was still in flight. Before implementing, re-read
OKR-E001's actual landed code and confirm every cross-reference —
`okr_vnext_programs`/`okr_vnext_cycles` column names,
`runOkrCycleLifecycleTransition`'s exact signature, `OkrCycleValidationError`'s
exact shape, `publishVisibilityPolicy`'s final signature. This design
describes their *intended* shape from the frozen E001 doc, not verified
running code. Same discipline ROI-E008 owed ROI-E007 while it was
mid-flight.

---

## 0. Epic boundary

`EPIC_LEDGER_LIVE.md` gives OKR-E002 a **full per-AC table** (quoted
verbatim in the design draft): 5 ACs across OKR-F-004 (Set creation and
company projection), OKR-F-005 (approval and material change), OKR-F-006
(visibility narrowing).

1. **OKR-F-004-AC-01** — Set creation enforces uniqueness of
   `(org, program, cycle, scope_type, scope_id, owner)`; a duplicate is a
   conflict, never a silent second existence.
2. **OKR-F-004-AC-02** — Company/BU/team/individual Sets share one
   contract; the company view is a projection, not a separate model.
3. **OKR-F-005-AC-01** — Approval freezes an immutable
   `OKRApprovedSnapshot`; the reviewer cannot be the author
   (self-approval denied).
4. **OKR-F-005-AC-02** — Material edits to an Active Set create an
   `OKRMaterialChange`, they do NOT overwrite the approved snapshot.
5. **OKR-F-006-AC-01** — Visibility inherits the Program's
   `visibility_default`; a per-record override may ONLY narrow.

This is materially broader than "just create a Set": the ledger requires
the full submit→approve/request-changes→immutable-snapshot maker-checker
cycle **now**, even though Objectives/KRs (the content a Set commits to)
don't exist until OKR-E003. That mirrors ROI's own precedent (ROI-E001
built Case lifecycle including `markReadyForReview` before ROI-E002 gave
it economic content). Accepted as the ledger's own split.

**Out of scope** (later epics): Objective/KeyResult CRUD and the real
≥2-KR submission guard (OKR-E003), check-ins (E004), alignment (E005),
support/decisions (E006), review/reflection/carry-forward (E007),
Teresa/perspectives/legacy (E008), `okr_vnext_population_rules`
(Decision D2), and the `/my`/`/team-health`/`/attention`/`/advisor/*`
read models.

**One plan-doc table name deliberately not built**: `04_OKR_IMPLEMENTATION_PLAN.md`
§10 lists `okr_vnext_visibility_policies`. OKR-E001's Decision P5 already
superseded this — Program-level policy is authored into the **platform's**
`rvn_platform_visibility_policies` via `publishVisibilityPolicy`.
Per-record narrowing goes through the platform's
`rvn_platform_resource_visibility`/`rvn_platform_resource_acl`, exactly
like KPI/ROI. See Decision D1.

---

## 1. Decisions

All 15 decision points from the design draft are ratified as specified,
with its own 5 flagged open questions resolved as D16-D20.

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Domain-owned `okr_vnext_visibility_policies` (plan §10) or platform-owned? | **Platform-owned.** No domain visibility-policy table; `okr_vnext_sets` carries no `visibility_mode`/`visibility_policy_id` column. | Direct precedent: ROI-E001 §3 made the identical deviation from its own plan doc's schema list for the identical reason (RN-G1 §C.3's warning against a parallel resource-naming taxonomy). OKR-E001 P5 established the Program-level half; this is the per-resource half of the same pattern. |
| D2 | Build `okr_vnext_population_rules` / auto-scaffold empty Sets for eligible scopes? | **No — explicit command creation only.** `not_required`/`required` statuses are forward-declared in the CHECK constraint but no E002 command ever writes them (zero behavior, same "reserve the slot, no ALTER later" discipline as `reflection_required_for_close`). | The ledger's own Command/API cell for OKR-F-004-AC-01 is literally `POST .../sets` — a command, not an implicit side effect. No AC mentions a population-rule engine. Building auto-scaffolding with zero AC backing would be fabricated scope. |
| D3 | Uniqueness tuple and status exclusions? | Partial unique index on `(organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id) WHERE status <> 'cancelled'`. `'closed'` is deliberately NOT excluded. | Tuple taken verbatim from plan §4.4. Cancelled (an aborted attempt) frees the slot; closed (the normal successful end of a cycle for that scope) does not — a second Set for the same cycle+scope while the first is closed would be a duplicate, not a legitimate do-over. |
| D4 | `scope_id` type and the `company` sentinel? | `scope_id TEXT NOT NULL`. For `scope_type='company'`, `scope_id = organizationId`. For `'team'`, a `team_members.team_id`. For `'individual'`, the target user's id. | `TEXT` matches every other cross-domain identifier in this program — never assume UUID. The company sentinel needs a deterministic, always-populated value for the uniqueness tuple to mean anything; `organizationId` is the only one guaranteed stable. |
| D5 | Are `okr_vnext_approved_snapshots` and `okr_vnext_set_versions` one table or two? | **Two distinct tables**, read literally from the ledger's two separate AC cells. Snapshots: immutable, content-hashed, one row per approval. Set versions: append-only history of material edits to an already-approved Active Set. | The ledger names them in two different AC cells with two different Requirement texts; collapsing them would silently merge two named requirements into one mechanism. |
| D6 | Do pre-approval draft edits write version rows? | **No.** Draft edits are plain CAS updates; `okr_vnext_set_versions` is written only by `recordOkrSetMaterialChange` (requires `status='active'`). | F-005-AC-02 is specifically about "Materialne edycje **Active** Set." Versioning drafts is unbacked scope. |
| D7 | Real ≥2-KR submission guard now, or a stub? | **Stub**: `isOkrSetReadyForSubmissionEligible(setRow)`, exported for OKR-E003 to import and **wrap, never replace** — checks only `reviewer_user_id IS NOT NULL`. | Objectives/KRs don't exist until E003. Identical shape to the ROI-E001→ROI-E002 `isRoiCaseReadyForReviewEligible` extension, this program's twice-proven pattern. |
| D8 | Does the approval snapshot include Objectives/KRs? | **Empty placeholder arrays** (`objectives: []`); `buildOkrSetApprovalSnapshotPayload` exported as an explicit extension point for E003. | An honest structurally-present-but-empty array beats fabricating content that didn't exist at approval time. |
| D9 | Fate of the pre-existing `okr_set.published` placeholder event? | **Repurposed as `activateOkrSet`'s event** (`approved → active`), not `approveOkrSet`'s, which gets a new `okr_set.approved` key. | Structural analogy to `okr_program.published`, whose semantics in OKR-E001 §6.3 are "the moment status flips to active." Approval-decision and went-live are distinct moments even though adjacent. |
| D10 | Self-approval denial — which fields? | Check `submitted_by` and `created_by`, both deny. `owner_user_id`/`reviewer_user_id` not independently checked. | Exact precedent: ROI-E003 D13 — a Set's owner may legitimately not be its submitter and should still be able to approve a delegate's draft. |
| D11 | Own error class or reuse KPI/ROI's? | **Own class**, `OkrSetSelfApprovalDeniedError`. | Established per-aggregate pattern (`SelfApprovalDeniedError` → `DeviationSelfApprovalDeniedError` → `RoiSelfApprovalDeniedError`), never reused across aggregates. |
| D12 | Narrowing-only enforcement — existing platform helper? | **None exists — build one locally.** `rvn_platform_visibility_policies.allow_narrowing_only` is set `true` by every writer but has **zero enforcement code anywhere** (grep-confirmed). Build `VISIBILITY_NARROWNESS_RANK` + `isVisibilityModeNarrowerOrEqual` locally in `okrSetCommands.ts`, not as a platform change. | Verified against real code, not assumed from the column's existence. OKR-E002 is the first domain that actually needs per-record narrowing; no other domain has asked for it, and RN-G1 defines no canonical order to conform to — so a local helper is right until a second caller appears. |
| D13 | `resolveScopeVisibility` supports only `scope_type='team'` for `SCOPE` mode — blocker? | **Not a blocker for the MVP default** (`OPEN_ORG`), but a **named, real platform gap**: under a `SCOPE`-mode Program policy, only team Sets resolve; company/BU/individual Sets fail-closed. Not fixed here (platform-layer change, out of this epic's file ownership) — flagged forward and restated in the closure entry. | Confirmed by direct read of `resolveScopeVisibility`'s own `return { allow: false, reason: 'OUT_OF_SCOPE' }` fallthrough. Same posture ROI-E003 D20 took toward the ACL-granularity gap it found but didn't fix. |
| D14 | MyWork obligations? | **Yes**, reusing `createObligation`: `createOkrSet` → `draft_okr_set`; `submitOkrSetForApproval` → `review_okr_set`, assigned to `reviewer_user_id`. | Plan §13's obligation catalog names both literally; the generic primitive already exists with zero adaptation. |
| D15 | `cancelOkrSet` despite no AC naming it? | **Yes, added explicitly** as a design addition, stated not silent. | Same class of addition OKR-E001 §6.5 made for `okr_cycle.cancel`; a Set with no cancel path from any of its 5+ live states would be a foreseeable gap the plan's own lifecycle diagram shows a branch for. |
| D16 (resolves OQ1) | `scope_type='business_unit'` has no canonical id source anywhere in the repo. | **Treat `scope_id` for `'business_unit'` as an opaque caller-supplied TEXT with no referential integrity**, matching legacy's own `okr_cycles.dept_id` precedent (also a bare TEXT with no FK). Flag as a genuine data-model gap for whichever epic first needs to *resolve* a BU to its member users (visibility, rollups). | Inventing a business-unit registry the product hasn't asked for would be exactly the fabricated scope this program's decision tables exist to prevent. An opaque identifier is honest about what's actually known. |
| D17 (resolves OQ2) | Keep the reserved `recommit_status`/`recommit_by`/`recommit_at` columns on `okr_vnext_set_versions`? | **Keep them, unused.** No E002 command writes them; they mirror plan §4.8's "reviewer, recommit outcome" language for `OKRMaterialChange`. Note in the closure entry that the recommit workflow is unbuilt and unowned. | Same "reserve now to avoid an ALTER on a live table later" discipline used successfully four times in this program (`response_policy_id`, `submitted_by`, `next_action_*`, `teresa_draft_*`). Cost is three nullable columns; the alternative is a future migration on a table with real data. |
| D18 (resolves OQ3) | Confirm D9's event repurposing? | **Confirmed as designed.** | The reasoning (parallel to `okr_program.published`'s own semantics) is sound and self-consistent; no better-sourced alternative exists. |
| D19 (resolves OQ4) | Should visibility narrowing also be permitted while `status='active'`, not just draft states? | **Yes — permit narrowing in `active` too.** `updateOkrSetDraft` keeps its draft-only scope for content fields (`title`/`owner`/`reviewer`), but a separate, narrow command `narrowOkrSetVisibility` accepts `status IN ('draft','changes_requested','submitted','approved','active')` and changes *only* the visibility mode. | "An owner wants to make their live Set more private" is a real, plausible need, and narrowing is by construction safe (it can only reduce exposure, never widen it — D12's rank check guarantees that). Blocking it would be an arbitrary restriction with no AC behind it, while permitting it cannot violate F-006-AC-01. Content edits stay draft-gated; visibility is separable. |
| D20 (resolves OQ5) | Re-verify every OKR-E001 cross-reference before implementing? | **Yes — mandatory, stated at the top of this document.** | Standing requirement, not a decision — the implementer must confirm literal signatures against landed code. |

---

## 2. Legacy collision check

Confirmed by direct grep: no real `okr_sets` table has ever existed —
`server/migrations/914_okr_management.sql`'s own header admits the AS-IS
shortcut ("folded into `okr_cycles.dept_id / team_id` rather than a
separate `okr_sets` table... a dedicated `okr_sets` table remains a
documented follow-up"), which is precisely the mistake D08 exists to fix.
`okr_vnext_*` — greenfield.

`'okr_set'` is already reserved in `RVN_RESOURCE_TYPES` and
`CanonicalObjectTypeValues` since RN-G1; **this epic is the first real
writer of either** — no code path currently produces a
`resource_type='okr_set'` row. No new `RVN_RESOURCE_TYPES` entry needed.

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260823_rvn_okr_set.sql`.

```sql
-- ============================================================
-- okr_vnext_sets — root aggregate #3. Materialized Cycle × scope × owner.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_sets (
  set_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  program_id                 UUID NOT NULL REFERENCES okr_vnext_programs(program_id),
  cycle_id                   UUID NOT NULL REFERENCES okr_vnext_cycles(cycle_id),

  scope_type                 TEXT NOT NULL
                                CHECK (scope_type IN ('company','business_unit','team','individual')),
  -- D4: for scope_type='company', scope_id = organization_id (sentinel).
  -- For 'business_unit', an opaque caller-supplied identifier (D16) — no
  -- canonical registry exists in this product yet.
  scope_id                   TEXT NOT NULL,

  owner_user_id               TEXT NOT NULL,
  reviewer_user_id             TEXT NULL,
  title                        TEXT NOT NULL,

  -- Full lifecycle forward-declared (plan §4.4). 'not_required'/'required'
  -- reserved with zero E002 code path (D2). 'review'/'closed' reserved for
  -- OKR-E004/E007 — no E002 transition reaches them.
  status                       TEXT NOT NULL DEFAULT 'draft'
                                 CHECK (status IN (
                                   'not_required','required','draft','submitted',
                                   'changes_requested','approved','active','review',
                                   'closed','cancelled'
                                 )),

  submitted_by                 TEXT NULL,
  submitted_at                 TIMESTAMPTZ NULL,
  approved_by                  TEXT NULL,
  approved_at                  TIMESTAMPTZ NULL,
  changes_requested_by         TEXT NULL,
  changes_requested_at         TIMESTAMPTZ NULL,
  changes_requested_reason     TEXT NULL,

  -- D5/D6: two independent counters. current_version bumps only via
  -- recordOkrSetMaterialChange. approved_version mirrors the
  -- sequence_number of the latest approval snapshot.
  current_version               INT NOT NULL DEFAULT 1,
  approved_version              INT NULL,
  latest_approved_snapshot_id   UUID NULL,  -- FK ALTERed below

  -- Reserved for OKR-E003/E004 rollups — NOT populated, NOT read, by any
  -- E002 command. Same "reserve now" discipline as
  -- rvn_kpi_definitions.response_policy_id.
  overall_progress              NUMERIC NULL,
  overall_confidence            TEXT NULL CHECK (overall_confidence IN ('high','medium','low','numeric')),
  attention_state                TEXT NOT NULL DEFAULT 'none'
                                   CHECK (attention_state IN ('none','watch','action_required','escalated')),
  last_checkin_at                TIMESTAMPTZ NULL,
  next_checkin_due_at            TIMESTAMPTZ NULL,

  row_version                    INT NOT NULL DEFAULT 1,
  created_by                     TEXT NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                     TEXT NULL,
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_cycle_status
  ON okr_vnext_sets(organization_id, cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_owner
  ON okr_vnext_sets(organization_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_scope
  ON okr_vnext_sets(organization_id, scope_type, scope_id);

-- OKR-F-004-AC-01. Cancelled frees the slot; closed does not (D3).
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_sets_one_per_scope_cycle_owner
  ON okr_vnext_sets(organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id)
  WHERE status <> 'cancelled';

-- ============================================================
-- okr_vnext_approved_snapshots — immutable, one row per approval (D5, D8)
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_approved_snapshots (
  snapshot_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                       UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id              TEXT NOT NULL,

  sequence_number               INT NOT NULL,

  approved_by                   TEXT NOT NULL,
  approved_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  content_hash                  TEXT NOT NULL,
  snapshot_payload              JSONB NOT NULL,  -- Set fields + objectives:[] (D8)

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No row_version, no UPDATE path — immutable by construction, matching
  -- rvn_roi_approval_snapshots exactly.
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_approved_snapshots_set_seq
  ON okr_vnext_approved_snapshots(set_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_approved_snapshots_set
  ON okr_vnext_approved_snapshots(organization_id, set_id, sequence_number DESC);

REVOKE UPDATE, DELETE ON okr_vnext_approved_snapshots FROM PUBLIC;

ALTER TABLE okr_vnext_sets
  ADD CONSTRAINT fk_okr_vnext_sets_latest_approved_snapshot
  FOREIGN KEY (latest_approved_snapshot_id)
  REFERENCES okr_vnext_approved_snapshots(snapshot_id);

-- ============================================================
-- okr_vnext_set_versions — OKRMaterialChange, append-only (D5, D6)
-- ============================================================
-- Written ONLY by recordOkrSetMaterialChange (status='active' guard).
-- Never overwrites okr_vnext_approved_snapshots (F-005-AC-02).
CREATE TABLE IF NOT EXISTS okr_vnext_set_versions (
  version_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                        UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id                TEXT NOT NULL,

  version_number                  INT NOT NULL,

  field_name                       TEXT NOT NULL
                                     CHECK (field_name IN ('title','owner_user_id','reviewer_user_id')),
  before_value                     TEXT NULL,
  after_value                      TEXT NULL,
  reason                           TEXT NOT NULL,

  requested_by                     TEXT NOT NULL,
  requested_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Reserved (plan §4.8), zero enforcing command in E002 — the recommit
  -- workflow is unbuilt and unowned (D17), stated not silent.
  reviewer_user_id                  TEXT NULL,
  recommit_status                   TEXT NULL CHECK (recommit_status IN ('pending','recommitted','waived')),
  recommit_by                       TEXT NULL,
  recommit_at                       TIMESTAMPTZ NULL,

  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_set_versions_set_seq
  ON okr_vnext_set_versions(set_id, version_number);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_set_versions_set
  ON okr_vnext_set_versions(organization_id, set_id, version_number DESC);

REVOKE UPDATE, DELETE ON okr_vnext_set_versions FROM PUBLIC;
```

---

## 4. Command layer (`server/src/services/resultsVnext/okr/`)

### 4.1 `createOkrSet` — `executeAtomicCreate` (`okrSetCommands.ts`)

Fail-closed on no active `domain='okr'` visibility policy
(`OkrSetNoActiveVisibilityPolicyError`) — `getActiveVisibilityPolicy(client,
{organizationId, domain:'okr'})`, then a second query for
`visibility_mode`/`default_scope_type` by `policy_id` (the same two-step
lookup `createKpiDraft` uses; `getActiveVisibilityPolicy` alone does not
return the mode).

**Duplicate prevention (D3)** — SAVEPOINT pattern copied literally from
`createRoiCase`: cheap pre-`SELECT`, then `SAVEPOINT okr_set_create`
around the candidate INSERT, catch `23505` on
`ux_okr_vnext_sets_one_per_scope_cycle_owner`, `ROLLBACK TO SAVEPOINT`,
re-`SELECT` the winner, return `created: false`. A naive
catch-then-retry without the SAVEPOINT fails with `25P02` — this exact
bug was found and fixed once already in this program.

```typescript
export interface CreateOkrSetInput {
  organizationId: string;
  programId: string;
  cycleId: string;
  scopeType: 'company' | 'business_unit' | 'team' | 'individual';
  scopeId: string;
  ownerUserId: string;
  reviewerUserId?: string | null;
  title: string;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CreateOkrSetResult {
  set: OkrSet;
  created: boolean;  // false = pre-existing Set for this tuple returned
}

export async function createOkrSet(
  input: CreateOkrSetInput
): Promise<AtomicCommandOutcome<CreateOkrSetResult>>
```

Inside `applyMutation`: INSERT `okr_vnext_sets`; INSERT
`rvn_platform_resource_visibility` (`resource_type='okr_set'`,
`resource_id=setId::text`, mode/policy from the lookup; write
`scope_type`/`scope_id` on the visibility row only for
`scope_type='team'` per D13's gap, `NULL` otherwise); ACL grants
(`access_level='contribute'`) for `createdBy` and, if different,
`ownerUserId` (ROI-E001 D3's shape); `createObligation`
(`obligation_type='draft_okr_set'`, D14).

`OkrSetValidationError('SCOPE_ID_REQUIRED', ...)` if `scopeId` is empty
for any `scopeType` — including `company`, where the caller passes
`organizationId` explicitly rather than the server silently defaulting
it, so the contract is visible at the call site.

### 4.2 `updateOkrSetDraft` — `executeAtomicCommand`

`row_version`-CAS update of `title`/`ownerUserId`/`reviewerUserId`.
Guard: `status IN ('draft','changes_requested')` only — not `'active'`
(D6; active edits go through `recordOkrSetMaterialChange`). Visibility is
**not** changed here — that moved to its own command per D19.

### 4.3 `narrowOkrSetVisibility` — `executeAtomicCommand` (D19)

Separate, narrow command changing only the visibility mode. Guard:
`status IN ('draft','changes_requested','submitted','approved','active')`
— deliberately wider than content editing, because narrowing is
by-construction safe.

```typescript
const VISIBILITY_NARROWNESS_RANK: Record<string, number> = {
  OPEN_ORG: 0,
  SCOPE: 1,
  MANAGEMENT_CHAIN: 2,
  RESTRICTED_ACL: 3,
  PRIVATE: 4,
};

/** True if `candidateMode` is at least as narrow as `ceilingMode` (the
 * Program's active domain='okr' policy mode). */
export function isVisibilityModeNarrowerOrEqual(
  candidateMode: string,
  ceilingMode: string
): boolean {
  return (VISIBILITY_NARROWNESS_RANK[candidateMode] ?? -1)
       >= (VISIBILITY_NARROWNESS_RANK[ceilingMode] ?? Infinity);
}
```

Violation → `OkrSetVisibilityWideningDeniedError` (409), thrown before
any write. On success: `UPDATE rvn_platform_resource_visibility SET
visibility_mode=$1 WHERE resource_type='okr_set' AND resource_id=$2::text`
on the same pinned client — the Set's own table is untouched (D1).

### 4.4 `isOkrSetReadyForSubmissionEligible` (D7) and `submitOkrSetForApproval`

```typescript
/** E002's own check: a reviewer must be assigned. OKR-E003 is expected to
 * layer its ≥2-KR-per-Objective check on top, e.g.:
 *   isOkrSetReadyForSubmissionEligible(s) && hasSufficientKeyResultCoverage(s)
 * — do not replace this function's body when E003 lands; wrap it. */
export function isOkrSetReadyForSubmissionEligible(
  setRow: OkrSetRow
): { eligible: boolean; reason?: string } {
  if (!setRow.reviewer_user_id) {
    return { eligible: false, reason: 'reviewer_not_assigned' };
  }
  return { eligible: true };
}
```

`submitOkrSetForApproval`: `executeAtomicCommand`, `fromStatuses:
['draft','changes_requested']`, guard failure →
`OkrSetNotReadyForSubmissionError` (409, carries `reason`). On success:
`status='submitted'`, `submitted_by`/`submitted_at` set;
`createObligation` (`review_okr_set`, assigned `reviewer_user_id`);
event `okr_set.submitted`.

### 4.5 `approveOkrSet` (F-005-AC-01)

`applyMutation`, **self-approval denial FIRST, before any write**:

1. `if (currentRow.submitted_by === approverId) throw new OkrSetSelfApprovalDeniedError(setId, approverId, 'submitted_by')`; same for `created_by` (D10/D11).
2. `status !== 'submitted'` → `OkrSetValidationError('NOT_SUBMITTED', ...)`.
3. `buildOkrSetApprovalSnapshotPayload(client, currentRow)` (D8 — Set fields + `objectives: []`, exported for E003).
4. `contentHash = computeStateHash(payload)` (reused from `kpiDefinitionCommands.ts`, fixed key order).
5. `sequenceNumber = COALESCE(MAX(sequence_number),0)+1` for this `set_id` — safe without its own lock, the Set row's `FOR UPDATE` already serializes concurrent approvals.
6. `INSERT INTO okr_vnext_approved_snapshots (...) RETURNING *`.
7. `UPDATE okr_vnext_sets SET status='approved', approved_by, approved_at, approved_version, latest_approved_snapshot_id, ... RETURNING *`.
8. Event `okr_set.approved`.

### 4.6 `requestChangesOnOkrSet`

No self-approval check (matches `rejectRoiCase` — declining someone
else's submission isn't the conflict self-approval-denial guards
against). `status !== 'submitted'` guard. Required `changeRequestNotes`.
Event `okr_set.changes_requested`.

### 4.7 `activateOkrSet` / `cancelOkrSet` — generic transition

```typescript
runOkrSetLifecycleTransition({
  eventType: 'okr_set.published',   // D9 — reuses the pre-existing placeholder
  fromStatuses: ['approved'],
  toStatus: 'active',
}, input);

runOkrSetLifecycleTransition({
  eventType: 'okr_set.cancelled',
  fromStatuses: ['draft','submitted','changes_requested','approved','active'],
  toStatus: 'cancelled',
}, input);
```

`runOkrSetLifecycleTransition` mirrors OKR-E001's
`runOkrCycleLifecycleTransition` exactly.

### 4.8 `recordOkrSetMaterialChange` (F-005-AC-02) — `okrSetMaterialChangeCommands.ts`

```typescript
export interface RecordOkrSetMaterialChangeInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  fieldName: 'title' | 'owner_user_id' | 'reviewer_user_id';
  afterValue: string;
  reason: string;  // required
  requestedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
}

export async function recordOkrSetMaterialChange(
  input: RecordOkrSetMaterialChangeInput
): Promise<AtomicCommandOutcome<{ set: OkrSet; version: OkrSetVersion }>>
```

Hand-written `executeAtomicCommand` (doesn't change `status`, so not the
generic helper). Guard: `status !== 'active'` →
`OkrSetValidationError('NOT_ACTIVE', ...)`. Reads `before_value` from
`currentRow[fieldName]`; INSERTs the version row
(`version_number = current_version + 1`); UPDATEs the Set's field and
`current_version`. **The approved snapshot is never touched** —
F-005-AC-02's literal guarantee. Event
`okr_set.material_change_recorded`.

---

## 5. Visibility

`listOkrSets`/`getOkrSet`/`listOkrSetApprovedSnapshots`/
`getOkrSetApprovedSnapshot` live in a **new** `okrSetRepository.ts` —
deliberately not an extension of OKR-E001's `okrRepository.ts`, whose own
design states it uses plain `organization_id` scoping with no visibility
CTE. Set reads need real ABAC, so they get their own file (mirroring the
`roiRepository.ts` vs `roiEconomicModelRepository.ts` split).

All Set reads go through `buildVisibilityScopedCte`/
`wrapWithVisibilityScope({ resourceType: 'okr_set' })` — never a raw
`WHERE organization_id=?`. **`rvn_platform_resource_visibility.resource_id`
is TEXT; `okr_vnext_sets.set_id` is UUID — every join casts `::text`.**
Write `okrSetVisibilityJoin.realdb.test.ts` before shipping: this exact
cast has already been missed 7 times in one KPI epic and is the single
most-repeated real bug in this program.

`okr_vnext_approved_snapshots`/`okr_vnext_set_versions` carry no
visibility row of their own — inherit via `set_id`, same `::text`
requirement on those joins.

`listOkrSets` query params: `{ perspective?, cycle?, scope?, status?,
attention? }`. `GET /okr/company` is a thin wrapper filtering
`scope_type='company'` over the same CTE-scoped function — F-004-AC-02's
"company view is a projection, not a separate model," structurally
guaranteed by sharing the repository function rather than duplicating it.

---

## 6. API surface (`server/src/routes/resultsVnext/okr.routes.ts`, extended)

Sets are ABAC resources — unlike OKR-E001's Program/Cycle, whose P2/P4
used plain RBAC. Confirmed: the ledger's Roles/visibility cells for every
F-004..F-006 AC name scope/narrow language, never a bare role name.

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/sets` | `createOkrSet` |
| `GET` | `/sets` | `listOkrSets` |
| `GET` | `/sets/:setId` | `getOkrSet` |
| `PATCH` | `/sets/:setId/draft` | `updateOkrSetDraft` |
| `PATCH` | `/sets/:setId/visibility` | `narrowOkrSetVisibility` (D19) |
| `POST` | `/sets/:setId/submit` | `submitOkrSetForApproval` |
| `POST` | `/sets/:setId/approve` | `approveOkrSet` |
| `POST` | `/sets/:setId/request-changes` | `requestChangesOnOkrSet` |
| `POST` | `/sets/:setId/activate` | `activateOkrSet` |
| `POST` | `/sets/:setId/cancel` | `cancelOkrSet` |
| `POST` | `/sets/:setId/request-revision` | `recordOkrSetMaterialChange` |
| `GET` | `/sets/:setId/approval-snapshots` | `listOkrSetApprovedSnapshots` |
| `GET` | `/sets/:setId/approval-snapshots/:snapshotId` | `getOkrSetApprovedSnapshot` |
| `GET` | `/okr/company` | `listOkrSets` filtered `scope_type='company'` |

Error mapping: `AtomicWriteConflictError`→409,
`AtomicWriteAggregateNotFoundError`→404, `OkrSetValidationError`→409,
`OkrSetSelfApprovalDeniedError`→403,
`OkrSetVisibilityWideningDeniedError`→409,
`OkrSetNoActiveVisibilityPolicyError`→409,
`OkrSetNotReadyForSubmissionError`→409, Zod→400, ACL failure→403,
unknown→500.

**Mount-order note**: `GET /sets/:setId` is a single dynamic segment —
any future literal-path sub-router under `/sets` must mount before it.
Same class of bug fixed twice in KPI.

---

## 7. File list (backend only)

**New:**
- `server/migrations/20260823_rvn_okr_set.sql`
- `server/src/services/resultsVnext/okr/okrSetTypes.ts`
- `server/src/services/resultsVnext/okr/okrSetCommands.ts` (`createOkrSet`, `updateOkrSetDraft`, `narrowOkrSetVisibility`, `submitOkrSetForApproval`, `approveOkrSet`, `requestChangesOnOkrSet`, `activateOkrSet`, `cancelOkrSet`, `runOkrSetLifecycleTransition`, `isOkrSetReadyForSubmissionEligible`, `isVisibilityModeNarrowerOrEqual`, `buildOkrSetApprovalSnapshotPayload`, + 5 error classes)
- `server/src/services/resultsVnext/okr/okrSetMaterialChangeCommands.ts`
- `server/src/services/resultsVnext/okr/okrSetApprovedSnapshotTypes.ts`
- `server/src/services/resultsVnext/okr/okrSetRepository.ts`
- `tests/resultsVnext/okr/okrSetCreate.test.ts` (SAVEPOINT dedupe race, no-active-policy fail-closed)
- `tests/resultsVnext/okr/okrSetVisibilityJoin.realdb.test.ts` (`::text` cast on all 3 tables, OPEN_ORG/RESTRICTED_ACL/PRIVATE branches)
- `tests/resultsVnext/okr/okrSetVisibilityNarrowing.realdb.test.ts` (every narrowing accepted, every widening rejected, across all rank pairs; and narrowing permitted in `active` per D19)
- `tests/resultsVnext/okr/okrSetLifecycle.realdb.test.ts`
- `tests/resultsVnext/okr/okrSetApproval.realdb.test.ts` (self-approval denial both branches, snapshot insert, pointer correctness, content-hash stability)
- `tests/resultsVnext/okr/okrSetMaterialChange.realdb.test.ts` (active-only guard, version increment, **approved snapshot provably untouched** — the literal F-005-AC-02 proof)
- `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` (extended)

**Changed:**
- `server/src/routes/resultsVnext/okr.routes.ts` — 14 new routes
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new events (`okr_set.created`, `okr_set.draft_edited`, `okr_set.visibility_narrowed`, `okr_set.submitted`, `okr_set.approved`, `okr_set.changes_requested`, `okr_set.cancelled`, `okr_set.material_change_recorded`), all → `['mywork_projection']`. **Repurpose** the pre-existing `okr_set.published` key as `activateOkrSet`'s event (D9) — do not add a duplicate.
- `server/src/validators/resultsVnextOkr.validators.ts` — new schemas
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry, restating D13's platform gap and D17's unbuilt recommit workflow explicitly

**Read-only reference:** `roiCaseCommands.ts` (SAVEPOINT),
`roiCaseApprovalCommands.ts`/`roiApprovalSnapshotRepository.ts`
(approval-snapshot pattern), `kpiDefinitionCommands.ts`
(`computeStateHash`, two-step policy lookup), `visibilityResolver.ts`,
`visibilityScopedQuery.ts`, `platform/obligations.ts`, OKR-E001's
`okrCycleCommands.ts` — **all must be re-read for exact current
signatures at implementation time**.

---

## 8. Definition of done

- [ ] All 14 endpoints work against a real org with real Program+Cycle rows
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] SAVEPOINT dedupe race test passes; `cancelled` frees the slot, `closed` does not
- [ ] `::text` cast verified against real Postgres on all 3 new tables
- [ ] Every narrowing accepted, every widening rejected; narrowing works in `active` (D19)
- [ ] Self-approval denial verified both branches (`submitted_by`, `created_by`)
- [ ] Approved-snapshot content-hash stable across reads; `okr_vnext_set_versions` provably never mutates a snapshot row
- [ ] Full existing KPI + ROI + OKR-E001 test suites still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E002 rows updated
- [ ] D13's `resolveScopeVisibility` platform gap and D17's unbuilt recommit workflow both restated explicitly in the closure entry, not silently dropped
