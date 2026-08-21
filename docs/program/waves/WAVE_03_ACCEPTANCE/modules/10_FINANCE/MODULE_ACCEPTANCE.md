# Wave 3 — Finance acceptance

ID: `FIN`
Routes: `/finance`
Current gate: `FULL_COMPUTED_HARNESS_PASS / MOUNTED_OWNER_FIXTURE_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: import exact-six Statement, map/confirm, then inspect Baseline,
Prediction, Analysis and Valuation with durable identities. Required boundaries:
invalid pack, cross-tenant ID, stale selection, permission denial, atomic
rollback and no false ready state.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | `FIN-BVP-001`, `FIN-MVP-CUTOVER-001`, `FIN-MVP-CANDIDATE-001`, `FIN-MVP-RECONCILIATION-001`, `FIN-MVP-IMPORT-001`, `FIN-UI-CANON-001`; mobile/release/production excluded |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | atomic full-chain checkpoint `eee5b6cc7b`; mounted runtime is not yet rebound to this checkpoint; fresh migrations `817`, repeat `0`, dry-run `0` |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | exact-six Statement → Analysis → Baseline → Prediction → Valuation; Candidate/Results seams mapped; invalid/stale/tenant/auth/atomic/N/A boundaries covered |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | durable same-tenant `ACTIVE/ADMIN` route fixtures; separate tenant actors; header claims alone explicitly rejected |
| G04 | Reproducible realistic and boundary fixtures | `PASS_FOR_FULL_COMPUTED_HARNESS / MOUNTED_FIXTURE_MODE_PENDING` | Checkpoint `eee5b6cc7b`. The guarded official-PDF harness reproducibly executes the full canonical chain without trigger/session bypass: exact-six Statement and reconciliation, computed Analysis (`CURRENT_RATIO=3`), real GoldCo Baseline (7 schedule families, 12 periods, 372 outputs), STANDARD_BASE Prediction (372 passthrough rows) and DCF_FCFF Valuation (`READY`). All five business versions pass independent-checker approval and cold hash/run/current-pointer readback. Two final clean runs passed `2/2` and whole-database cleanup. This is strong pre-browser evidence, but the harness deliberately drops its database; a mounted retain/reset mode and deep-link replay are still required before owner review. |
| G05 | Functional preflight and cold readback | `PASS_FOR_SOURCE_PREFLIGHT` | exact-six `2/2`; canonical RealPG matrix `128/128`; UI/unit `419/419`; focused staging `3/3`; root/server typechecks PASS; disposable DB catalog absence verified |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `NOT_STARTED` | — |
| G07 | Piotr review card | `NOT_STARTED` | — |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `NOT_STARTED` | — |
| G12 | Owner register reconciled and confirmed | `NOT_STARTED` | — |
| G13 | Solution and impact analysis | `NOT_STARTED` | — |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| _prepare before G07_ | `/finance` | _pending_ | Import → map → confirm → Baseline/Prediction/Analysis/Valuation → reopen | Remaining Finance cutover belongs to Wave 5 | CFO clarity, charts, exact-six confidence, forecasting flow, valuation trust |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `FIN-OWNER-G04-V1` | guarded full-chain pre-browser harness | CD PROJEKT FY2025 exact PDF; stable OWNER/ADMIN/foreign OWNER; exact-six Statement plus computed Analysis/Baseline/Prediction/Valuation | `server/scripts/run-wave3-finance-owner-review.ts`; loopback-only exact-name disposable DB; explicit confirmation; whole DB drop | six statements/receipts/hashes; Analysis ratio `3`; Baseline 372 outputs; Prediction 372 passthrough rows; DCF method `READY`; five approved versions with matching hashes/runs | same-tenant OWNER/ADMIN allowed; foreign OWNER pack read denied | `FULL_COMPUTED_HARNESS_PASS / MOUNTED_RETAIN_MODE_PENDING` |

Qualified source and guarded pre-browser fixture (not yet a complete G04 owner fixture):

- `/Users/piotrwisniewski/Desktop/CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf`
- SHA-256 `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`
- accepted by the exact-six harness; no substitute PDF is authorized.
- Guard contract: `SEED_WAVE3_FINANCE_OWNER_REVIEW=YES`, loopback PostgreSQL,
  exact database name `consultify_w3_finance_owner_*`, explicit new manifest
  path and `FINANCE_STATEMENT_DROP_DATABASE_AFTER=1`.
- The manifest is written exclusively with mode `0600`, contains no database
  URL, password or token, and is bound to the exact source hash and six-record
  cardinality. A denied foreign-owner read proves no statement-row mutation;
  it is not claimed as a blanket no-write proof for every Finance table.
- Prepared routes are source-backed but remain `deepLinkVerified:false` until
  mounted browser replay. Statement, Analysis, Baseline, Prediction and
  Valuation are computed and independently read back; the retained browser
  database/runtime journey is not yet proven.

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Technical preflight findings

| ID | Finding | Classification | Resolution/evidence | State |
|---|---|---|---|---|
| `FIN-PF-001` | Five route suites used role claims without durable active memberships and failed at the current auth wall. | stale test fixtures; auth wall correct | fixtures now create exact `users` plus `ACTIVE/ADMIN` memberships; foreign actors retain no cross-tenant grant; all former 41 auth failures pass | `FIXED` |
| `FIN-PF-002` | Existing Statement Pack was recomputed after the pinned registration transaction, allowing committed mutation plus apparent caller failure and mutating replays. | product atomicity regression | existing-pack recompute moved into the pinned transaction; post-commit work is observational only; concurrent replay preserves `xmin` and `updated_at` | `FIXED` |
| `FIN-PF-003` | Immutable valuation input event ledger lacked tenant-bound parent FKs. | product schema defect | migration `20261061_finance_valuation_input_events_tenant_fks.sql`; three validated composite FKs, fail-closed anti-joins, append-only preserved; three raw cross-tenant probes reject `23503` with zero probe residue | `FIXED` |
| `FIN-PF-004` | Failed DCF compute could omit a truthful method state or leave contradictory/stale publication behavior. | product state-integrity regression | new unpublished methods persist classified `DATA_INCOMPLETE`/`COMPUTE_FAILED` with `MISSING`; failed retry preserves last good `READY`; direct and legacy paths independently read back; no failure receipt fabricated | `FIXED` |
| `FIN-PF-005` | Concurrent method creation could leak unique violation `23505`, including mixed success/failure publication. | product concurrency regression | atomic `INSERT ... ON CONFLICT DO NOTHING` plus tenant-scoped reselect; mixed race yields one method and final `READY`; tenant matrix remains green | `FIXED` |
| `FIN-PF-006` | Compute output, job success, revision identity, business-version freshness and Valuation publication could commit in separate units or bind to an unrelated job/target. | product atomicity and identity-binding defects | checkpoint `eee5b6cc7b` publishes the authoritative tuple in one supplied transaction; enforces organization, input, lineage-bound output/BV/current revision, stale/order and replay/collision gates; injected publication/receipt failures fully roll back job/output/WR/BV/method; foreign and unrelated targets fail closed | `FIXED_VERIFIED` |

## Exact-current source evidence

- Source checkpoint: `eee5b6cc7b` on `codex/wave3-16-module-acceptance-20260821`.
- Finance UI/unit pack: `46` files, `419/419 PASS`, zero skipped.
- Staged Statement services: `2` files, `3/3 PASS`.
- Official-PDF exact-six RealPG: `1` file, `2/2 PASS`; confidence/schema wall, rollback, six sibling statements, ACCEPT/EXCLUDE mapping decisions, six confirmations, pack readiness, cold readback, receipt hash and reimport identity.
- Full official-PDF computed chain after atomic-publication hardening: two final fresh runs, each `2/2 PASS`, each followed by whole-database drop and catalog absence.
- Focused atomic publication regressions: canonical `26/26 PASS`; legacy Valuation adapter `17/17 PASS`; injected publish/receipt rollback, foreign/unrelated target denial, current-revision binding, exact replay/collision, delayed-order protection and old-BV reconciliation rollback.
- Canonical RealPG/HTTP replay: `12` files, `128/128 PASS`, zero skipped. It covers Statement, Analysis, Baseline, Prediction, Valuation, mount proof, legacy ID bridge, export/import, tenant matrix, cold reopen, atomic Statement registration and legacy Valuation successor behavior.
- Migration ledger: fresh `817`, repeat `0`, dry-run `0` on owned disposable PostgreSQL databases.
- Root typecheck: PASS. Server typecheck: PASS. `git diff --check`: PASS.
- Cleanup: exact-six databases self-dropped; route-matrix databases were force-dropped only after exact-name verification; final catalog readback showed absence. Some individual legacy suites intentionally retain their own fixture graph inside the disposable database, so whole-database destruction — not a false per-table zero claim — is the terminal cleanup evidence.
- Nonblocking diagnostics retained honestly: exact-six logs show fallback attempts against older optional diagnostic columns and unavailable LLM mapping; deterministic mapping still completed and the acceptance assertions passed. These logs are not represented as a clean provider run.

## Remaining gate to owner review

Finance is not `READY_FOR_OWNER_REVIEW` yet. Before G06/G07 the integrator must:

1. extend the qualified exact-six fixture with computed Baseline, Prediction, Analysis and Valuation states rather than identity shells;
2. start client/server on the same accepted source SHA and record runtime/DB/flag identity;
3. execute the literal mounted browser chain `6/6 ready → Save/Validate → explicit confirm → receipt → list/detail/deep-link → cold signed context`;
4. prepare invalid, stale and foreign-tenant alternates without requiring Piotr to reconstruct technical boundary data manually.

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: remaining `FIN-MVP-CUTOVER-001` Wave-5 work remains later-wave scope only where it is not a direct Wave-3 acceptance dependency. No blanket waiver is implied.
Evidence manifest: —
