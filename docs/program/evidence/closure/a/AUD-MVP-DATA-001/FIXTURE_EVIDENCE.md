# AUD-MVP-DATA-001 — Governed synthetic Audits fixture at scale

Evidence for the fixture generator at `server/src/services/auditProgramFixtures/fixtureGenerator.ts`
and its DoD tests at `server/src/services/auditProgramFixtures/__tests__/fixtureGenerator.pg.test.ts`.

All measurements below are from a REAL run against the dedicated PostgreSQL instance
(`postgresql://consultinity:consultinity@127.0.0.1:34911/consultinity`, 1557 tables,
703/703 migrations applied), with `CI=true RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres
NODE_ENV=test`, `npx vitest run … --retry=0`. Counts are `SELECT count(*)` results printed by
the test run, not the generator's own bookkeeping (the test also asserts
`result.counts` from the generator equals the independently-measured `SELECT` result).

## 1. Literal row counts (measured by SELECT)

| Entity | Table | Count | Minimum required |
|---|---|---|---|
| Criteria (leaf, `node_kind='criterion'`) | `audit_program_criteria` | **160** | 150 |
| Criteria (all nodes, incl. 16 domain headers) | `audit_program_criteria` | 176 | — |
| Evidence | `audit_evidence` | **480** | 400 |
| Findings | `audit_program_findings` | **73** | 60 |
| Corrective actions | `audit_corrective_actions` | **48** | 40 |
| Initiative proposals / candidates | `audit_initiative_proposals` | **30** | 12 |

Findings breakdown: 48 `nonconforming` (each with exactly one `corrective_action`,
each carrying a real `criterion_id`) + 25 `observation` (also carrying a real
`criterion_id`, no action required by the taxonomy). 30 of the 48 nonconforming
findings were reviewed to `confirmed` status (reviewer ≠ author) and drafted into
30 initiative proposals (`splitBy: 'criterion'`, one proposal per distinct
criterion — i.e. every proposal traces to exactly one confirmed finding).

## 2. Tenant / org / actor identity

| Role | Id |
|---|---|
| Fixture organization (tenant) | `claude_a_org_aud_mvp_data_001` |
| Tenant-negative control organization (never written to) | `claude_a_org_tenant_negative_control` |
| Primary actor (roles: `auditor` + `auditee`, drafts findings/evidence/actions) | `claude_a_actor_primary` |
| Secondary actor (roles: `lead_auditor` + `reviewer`, confirms findings + drafts proposals) | `claude_a_actor_secondary` |
| Viewer actor (role: `viewer` only — used for ROLE NEGATIVE write test) | `claude_a_actor_viewer` |
| Outsider actor (zero audit-role membership — used for ROLE NEGATIVE read test) | `claude_a_actor_outsider` |
| Pack key (kernel-native pack id, identified via this key) | `claude-a-fixture-scale-pack-v1` |
| Norm source key (kernel-native source id, identified via this key) | `claude-a-fixture-scale-source-v1` |

One actor is deliberately given multiple audit roles (auditor+auditee on the same
program) to reach write-capability coverage across the whole lifecycle in one
fixture run, and a **second, distinct** actor is used specifically wherever the
kernel enforces segregation of duties (`assertNotReviewingOwnFinding` — reviewer
must differ from the finding's author). This is documented, not hidden: a real
audit engagement would use distinct people per role; a scale fixture with a
single owner actor per capability bucket is a deliberate simplification to keep
the generator tractable, and the two-actor split exists specifically to keep the
one real SoD gate the generator exercises (author ≠ reviewer) honest rather than
bypassed.

## 3. Generation wall-clock (measured)

```
[AUD-MVP-DATA-001] Generation wall-clock ms: 2363 reused: false
```

~2.4 seconds for a full generation (source + pack + 176 pack criteria + publish +
program snapshot + id-rename pass + 5 members + 480 evidence + 73 findings + 48
actions + 30 confirmed reviews + 30 proposal drafts + final id-rename pass),
measured end-to-end inside `generateFixture()` via `Date.now()` deltas.

## 4. Query timings (DoD requirement 5 — measure and report, no invented threshold)

Three consecutive calls each, against the full fixture (160 leaf criteria / 480
evidence / 73 findings / 48 actions / 30 proposals), measured with
`performance.now()`:

```
[AUD-MVP-DATA-001] PERFORMANCE listCriteria ms: [6.22, 4.99, 4.90]
[AUD-MVP-DATA-001] PERFORMANCE getProgram   ms: [3.01, 2.40, 2.84]
```

- `criterionService.listCriteria(orgId, programId)` — the program's full criteria
  tree with per-criterion evidence/finding counts, built from **two** aggregate
  `GROUP BY` queries (not N+1) plus an in-process tree build: **~5–6 ms**.
- `programService.getProgram(orgId, programId)` — the program detail + the
  findings/evidence rollup used by the module's summary view (a single
  correlated-subquery `SELECT`): **~2.4–3.0 ms**.

Honest read: at this scale (160 criteria / 480 evidence / 73 findings) both
queries are effectively instantaneous on local Postgres and show no sign of
non-linear degradation — they are each a fixed number of `GROUP BY`/aggregate
queries independent of a per-row loop, so the expected growth curve is linear in
row count. No owner-facing threshold was assumed or tuned toward; these are the
literal numbers from this run. Nothing here looks pathological. This is **not**
a proof that the same queries stay fast at 10x or 100x this scale — that would
require a dedicated multi-N benchmark, which was out of scope for this task's
time budget; flagging this explicitly rather than implying a broader guarantee.

## 5. Graph integrity join used (DoD requirement 2)

- Evidence → criterion: `LEFT JOIN audit_program_criteria c ON c.id = e.criterion_id
  AND c.organization_id = e.organization_id`, counting rows where `c.id IS NULL`.
  **Result: 0 orphans.**
- Finding → criterion: same shape, `audit_program_findings.criterion_id`.
  **Result: 0 orphans.**
- Action → finding: `LEFT JOIN audit_program_findings f ON f.id = a.finding_id
  AND f.organization_id = a.organization_id`. **Result: 0 orphans.**
- Candidate (= `audit_initiative_proposals` row) → proposal: since a "candidate"
  and its "proposal" are the same row in this kernel's data model, the
  meaningful join is proposal → its **source findings**:
  `CROSS JOIN LATERAL jsonb_array_elements_text(p.source_finding_ids::jsonb)
  AS ref(finding_id) LEFT JOIN audit_program_findings f ON f.id = ref.finding_id
  AND f.organization_id = p.organization_id`, counting rows where `f.id IS NULL`.
  **Result: 0 orphans.** Additionally verified no proposal has an empty
  `source_finding_ids` array (0 rows with `jsonb_array_length(...) = 0`).

## 6. Tenant negative (DoD requirement 3)

`measureCounts('claude_a_org_tenant_negative_control')` returns all-zero across
the same five tables:

```
{ criteria: 0, criteriaAllNodes: 0, evidence: 0, findings: 0, correctiveActions: 0, initiativeProposals: 0 }
```

No row was ever written with that organization id — this is a structural
guarantee (every service call in the generator is scoped to
`FIXTURE_ORG_ID`), confirmed by direct measurement rather than assumed.

## 7. Role negative (DoD requirement 4)

- **Read**: `claude_a_actor_outsider` has **zero** audit-role membership in the
  fixture program. `resolveProgramAccess()` for that actor resolves capabilities
  to `ORG_MEMBER_CAPABILITIES` only (`pack.read`, `program.create`) — it does
  **not** include `program.read`. Calling
  `permissions.requireCapability(outsider, programId, 'program.read')` throws
  `AuditPermissionError`. This is a genuine, structural capability gate in
  `permissions.ts` — see §9 for an important caveat about which code paths
  actually enforce it today.
- **Write**: `claude_a_actor_viewer` has role `viewer` only (`pack.read`,
  `program.read`). Calling `evidenceService.submitEvidence(...)` as that actor
  throws `AuditPermissionError` (missing `evidence.submit`). The evidence count
  is re-measured immediately after and confirmed unchanged (480 → 480), proving
  the denial left no partial write.

## 8. Cold reopen (DoD requirement 6)

A **fresh, independent `pg.Pool`** (not the app's shared connection pool/DB
layer singleton) opened against the same `DATABASE_URL`, queried directly for
the five counts plus the program id, matches `result.counts` and
`result.identity.programId` exactly. This demonstrates the data is genuinely
persisted (not dependent on any in-process cache/connection state), without
disrupting the shared app pool that other concurrently-running test files in
the same vitest worker may depend on.

## 9. Idempotency (DoD requirement 7)

`generateFixture()` looks up an existing program by
`(organization_id = FIXTURE_ORG_ID, pack_key = FIXTURE_PACK_KEY)` before
creating anything (mirrors `packSeed.findExistingPack`'s pattern). Calling it a
second time against an already-populated fixture returns `{ reused: true }`
and creates nothing; `measureCounts()` before and after the second call are
`toEqual` — no counter changed.

## 10. Cleanup (DoD requirement 8)

`cleanupFixture()` deletes, scoped to `organization_id = FIXTURE_ORG_ID` (plus
`audit_pack_criteria` scoped via its parent `audit_packs.id`), across:
`audit_domain_events`, `audit_ai_proposals`, `audit_verifications`,
`audit_initiative_proposals`, `audit_corrective_actions`,
`audit_management_responses`, `audit_program_findings`,
`audit_evidence_requests`, `audit_evidence`, `audit_program_criteria`,
`audit_program_members`, `audit_programs`, `audit_pack_criteria`,
`audit_packs`, `audit_norm_sources`.

Post-cleanup measurement (independent probe script against the live DB, after a
full test-file run including the `afterAll` cleanup) — all ten tables scoped to
`organization_id = 'claude_a_org_aud_mvp_data_001'`:

```
audit_programs 0
audit_program_criteria 0
audit_program_members 0
audit_evidence 0
audit_program_findings 0
audit_corrective_actions 0
audit_initiative_proposals 0
audit_packs 0
audit_norm_sources 0
audit_domain_events 0
```

The test suite additionally asserts, right after `cleanupFixture()`, that no
`audit_packs`/`audit_norm_sources` row for the fixture's `pack_key`/`source_key`
remains, and that `audit_program_members` is empty.

## 11. Content discipline — no named external standard (DoD content rule)

Two independent checks, both passing:

1. **Generation-time guard**: `assertNoForbiddenStandardTokens()` is called on
   every generated criterion `title`/`requirementText`/`auditQuestion`/
   `auditProcedure` string before it is handed to `packService.replaceCriteria`
   — it throws if any of `ISO 27001`, `ISO 9001`, `SOC 2`, `NIST`, `COBIT`,
   `ITIL`, `IATF`, `VDA`, `HIPAA`, `GDPR`, `RODO` (word-boundary, case
   insensitive) appears anywhere.
2. **Post-hoc DB scan** (the `CONTENT` test): every `title`/`requirement_text`/
   `audit_question`/`audit_procedure`/`source_reference` from
   `audit_program_criteria`, every `statement`/`requirement_text`/`gap_text`/
   `recommendation` from `audit_program_findings`, every `title`/`description`/
   `content_snapshot` from `audit_evidence`, and the pack's own
   `title`/`summary`/`purpose` are pulled live from the database and scanned
   against the same pattern list. **Zero matches.**

The pack itself is marked `classification: 'DEMONSTRATION'` (matching
`packSeed.ts`'s existing demo pack) and its norm source is
`source_kind: 'demonstration'`, `rights_status: 'owned_internal'` — same
discipline as the existing demo seed.

## 12. Tests

All 11 tests in `server/src/services/auditProgramFixtures/__tests__/fixtureGenerator.pg.test.ts`
run against the real Postgres instance, `--retry=0`:

```
NODE_ENV=test DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34911/consultinity" \
npx vitest run server/src/services/auditProgramFixtures/__tests__/fixtureGenerator.pg.test.ts --retry=0
```

```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

Tests: SCALE (counts), SCALE (claude_a_ id prefix on the 7 renamed tables),
GRAPH INTEGRITY, CONTENT, TENANT NEGATIVE, ROLE NEGATIVE (read),
ROLE NEGATIVE (write), PERFORMANCE, COLD REOPEN, IDEMPOTENCY, CLEANUP.
0 failed, 0 skipped, 0 todo.

## 13. Kernel services used vs. direct SQL fallback

Went through the real kernel writers for everything that has a writer:
`packService.createPack/replaceCriteria/approveByExpert/publishPack`,
`programService.createProgramFromPack/addMember`,
`evidenceService.submitEvidence`, `findingService.createFinding/reviewFinding`,
`correctiveActionService.proposeAction`, `proposalService.draftProposalsFromFindings`.
Every one of these enforces its real validation and capability gates — e.g.
`createFinding`'s two hard rules (nonconforming needs a criterion + objective
evidence; a bare evidence gap is never auto-promoted to nonconforming),
`packValidator.assertPublishable`'s full publish gate (including the expert
approval requirement, which applies to `DEMONSTRATION` packs too — see §14),
and `reviewFinding`'s `assertNotReviewingOwnFinding` segregation check, all ran
for real during generation.

**Direct SQL fallback (justified, and only for two things):**

1. **Two inserts with no writer to call**: `audit_norm_sources` (norm source)
   has no dedicated `normSourceService.create*` exposed by the pieces of the
   kernel this lane may call for that path — `packSeed.ts` itself creates this
   row with a raw `INSERT` (see `packSeed.ensureDemoSource`), so this fixture
   follows that exact, already-accepted pattern rather than inventing a new
   one.
2. **The `claude_a_` id-rename pass** (`renameProgramAndCriteria` +
   `renameRemainingIdsToFixturePrefix`): the kernel's `newId(prefix)` helper in
   `auditsDb.ts` generates ids internally with its own fixed prefixes
   (`aprog_`, `apcrit_`, `aevid_`, `apf_`, `aca_`, `aprop_`, `apmem_`) — no
   service function accepts an injected id. To satisfy the task's requirement
   that every row carry a `claude_a_` id, this module does a controlled,
   deterministic `UPDATE … SET id = 'claude_a_' || id` pass **after** the real
   writer already validated and inserted the row — this never bypasses
   validation, it only renames an already-valid row's primary key. It is safe
   specifically because none of the five measured tables (or `audit_programs`/
   `audit_program_members`) has a real `REFERENCES` foreign key to another one
   of them (confirmed by grep against `20260813_audits_method_core.sql` — the
   only two `REFERENCES` in that migration are `audit_pack_criteria.pack_id →
   audit_packs.id` and `audit_packs.source_id → audit_norm_sources.id`, both
   `ON DELETE CASCADE` with no `ON UPDATE` clause).

**One documented exception where the id was *not* renamed**: `audit_packs.id`
and `audit_pack_criteria.id` keep their kernel-native ids. Renaming
`audit_packs.id` would violate the real FK from `audit_pack_criteria.pack_id`
(Postgres FK `ON UPDATE` defaults to `NO ACTION`, and the constraint isn't
declared `DEFERRABLE`, so a same-transaction rename-both-sides trick isn't
available without altering the schema — out of scope and undesirable for a
fixture generator to do). These two tables are instead identified and cleaned
up by `pack_key = 'claude-a-fixture-scale-pack-v1'` /
`source_key = 'claude-a-fixture-scale-source-v1'` and by
`organization_id = FIXTURE_ORG_ID` scoping, which is exact (verified in §10).

## 14. Inventory correction

The task's stated inventory ("the only fixture mechanism is `packSeed.ts`,
producing 3 domains / 9 criteria and zero evidence/findings/actions/
candidates") was re-verified and found **accurate** — no correction needed
there.

One thing worth flagging that the inventory didn't mention, found while
building the ROLE NEGATIVE (read) test: **no read-path service function in
`server/src/services/audits/**` actually calls `requireCapability(...,
'program.read')` (or any other read capability) today** — `criterionService
.listCriteria`, `.getCriterion`, `evidenceService.listEvidence`,
`findingService.listFindings/getFinding`, `programService.getProgram`, etc. are
all capability-**unchecked** at the service layer; only mutations
(`updateProgram`, `submitEvidence`, `createFinding`, …) call
`requireCapability`. The `program.read` capability *is* real and correctly
gates a role-less actor when you call `permissions.requireCapability`/
`assertCapability` directly (which is what the ROLE NEGATIVE (read) test does,
and it's how the tests in this fixture's suite prove the read-gate exists) —
but nothing in the service layer currently *applies* that gate on an actual
read call. If read-side authorization for Audits is enforced today, it must be
happening exclusively in the (out-of-lease) routes layer
(`server/src/routes/audits/**`), not in the services this lane may call. This
is not something this task was asked to fix (it's `server/src/services/
audits/**`, outside the lease), but it's worth the lead/owner knowing: a
program with zero audit-role members can, per the service layer alone, still
have its criteria/evidence/findings listed by any caller who reaches the
service function directly. Flagging as an `INTEGRATOR_CHANGE_REQUEST` below.

## 15. Blocked-by-lease items (INTEGRATOR_CHANGE_REQUEST)

- **Nothing in AUD-MVP-DATA-001's own scope was blocked.** The one item that
  would need action outside this lane is the read-capability gap in §14: if
  Audits' service-layer reads (`criterionService`, `evidenceService`,
  `findingService`, `programService`) are meant to enforce `program.read` (or
  a similarly scoped read capability) themselves rather than relying entirely
  on the routes layer, that change belongs to `server/src/services/audits/**`,
  which is outside this lane's lease. Recommend the Audits kernel owner
  triage whether route-level enforcement is actually complete for every
  Audits read endpoint, given the service layer provides no defense in depth
  here.
