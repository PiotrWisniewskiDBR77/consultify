# Consultify — Wave 02 Core Closure gate report

Date: `2026-08-21`

Overall verdict: `CONDITIONAL_PASS / OWNER_BROWSER_GATE_REQUIRED`

This report qualifies the corrected code candidate at
`2ce7750de9` on
`codex/full-mvp-recovery-20260820`. It does not authorize production, deployment,
or promotion to `OWNER_ACCEPTED`.

## Candidate and recovery state

- authoritative worktree: `/private/tmp/consultify-staging-deploy-e6ca`;
- dependency-bearing verification checkout (patched temporarily only to run
  the checks, then restored clean):
  `/Users/piotrwisniewski/Developer/consultify-wave02-recovery`;
- code candidate: `2ce7750de9`;
- branch: `codex/full-mvp-recovery-20260820`;
- recovery source: preserved local branch history; the authoritative temporary
  worktree is present again and owns the branch;
- production touched: `NO`;
- push/deploy performed: `NO`;
- NFR suite rerun: `NO`.

## Controlled fan-in

| Order | Scope | Integrated checkpoint |
|---|---|---|
| 1 | Finance exact-six | `826dac93da` |
| 2 | Results writer decision | `9ab6c3dea5` |
| 2 | Transform SWOT lineage to analysis | `5e1b088648` |
| 2 | Transform SWOT through execution | `308b3839be` |
| 2 | Transform Runtime-v1 through Results and Closure | `4319d1012a` |
| 4 | Dynamic SWOT bounded owner header | `002b9f5a21` |
| 3 | Federated Teresa/UI action manifest | `8c535a106f` |
| 3 | Mounted mutation denominator | `a02a150737` |
| post-gate repair | Standalone server typecheck boundary | `4318da80fa` |
| post-gate integration repair | Restore eight canonical Finance budget routes lost in merge `826dac93da` | `3ab15ebb29` |
| post-gate Finance cutover | Govern budget-initiative unlink and retire ECO-W41 | `2ce7750de9` |

The apparent table order preserves the historical commit sequence. P3 was
reviewed after P1/P2 shared-contract work; the bounded P4 packet had no shared
schema overlap.

## P1 — Finance exact-six

Verdict: `PASS_WITH_RETAINED_OWNER_EVIDENCE`

- source packet: `f5c6a7f16f95a6b800afb19b08832d2c6930514c`;
- obsolete index removed and period-aware exact-six identity integrated;
- schema preflight and atomic multi-section staging are fail-closed;
- focused rerun on the candidate: Finance contract and atomic import tests
  included in the `50/50` passing suite below;
- retained real-PostgreSQL owner acceptance: `2/2 PASS`;
- accepted PDF SHA-256:
  `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`.

A post-restart attempt to invoke the owner harness stopped in preflight because
`FINANCE_STATEMENT_ACCEPTANCE_PDF` was not supplied. It did not execute product
tests and is not counted as a failure or as new acceptance evidence. The earlier
real-PostgreSQL owner evidence remains the qualifying artifact; no Finance code
changed after it.

### Finance route integration requalification

The final audit found that merge `826dac93da` retained the canonical Finance
services, clients, registry decisions and route tests but dropped eight mounted
V8 budget handlers from `finance.routes.ts`: registration, line update,
projection, scenario adjustment, approval, discard, document import and
initiative link. That was a real integration regression and contradicted the
retirement claims despite the earlier green source evidence.

Commit `3ab15ebb29` restores the previously governed handlers without changing
their service contracts. On the repaired candidate:

- mounted Finance route suite: `79/79 PASS`;
- exact Finance cutover inventory: `11/11 PASS`;
- combined recovery qualification: `90/90 PASS`;
- root `npm run type-check`: `PASS`;
- no push, deployment, production access or owner-browser substitution occurred.

The exact-current Finance denominator after ECO-W41 is `26 retired / 52 actual
legacy mutation doors`, with `26` still open. `FIN-MVP-CUTOVER-001` remains
`PARTIAL`; this repair restores already-claimed mounted successors but does not
promote the broader parent task.

ECO-W41 adds a DRAFT-only tenant-bound unlink command sharing the link-family
advisory lock, exact parent-version CAS, immutable removed-link snapshot receipt,
response-loss replay and writer-scoped legacy rollback. Qualification evidence:
root and server typechecks `PASS`, focused route/inventory/client/UI tests
`101/101 PASS`, real-PostgreSQL canonical plus mounted legacy tests `72/72 PASS`,
fresh migration `816`, repeat `0`, dry-run `0`, final fixture/export residue `0`.

## P2 — Results writers and Transform runtime

Verdict: `PASS`

Results:

- 23 legacy writer doors are explicitly retired;
- 5 current canonical writers remain;
- unresolved/null-successor ambiguity in the bounded MVP registry: `0`;
- focused registry evidence: `8/8 PASS`.

Transform:

- one immutable `APPROVED` SWOT is carried through Definition, Analysis,
  Portfolio, Schedule, Handoff, Runtime-v1 Execution, Delivery, Results,
  effectiveness review and governed Closure;
- exact source identity survives cold readback;
- stale, malformed, wrong-tool, fault and missing-replay states fail closed;
- real PostgreSQL rerun on `2026-08-20`: `4 PASS / 1 RETIRED LEGACY SKIP`;
- the skipped legacy A05 adapter is replaced by the Runtime-v1 proof and is not
  counted as current acceptance.

## P3 — Federated Teresa/UI manifest

Verdict: `PASS_FOR_EXPLICIT_MVP_DENOMINATOR`

- adapters consume existing Idea, Dynamic SWOT, Chat, Execution and Case
  Workspace registries; no copied manual action registry was introduced;
- each manifest row exposes role, tenant scope, effect, preview/confirm,
  idempotency, receipt/audit, compensation and UI/Teresa executor identity;
- Dynamic SWOT registry split: `23` capabilities, `6` supported handlers and
  `17 NOT_SUPPORTED_IN_MVP` entries;
- mounted write-route denominator: `280` routes total:
  - Idea: `60`;
  - Dynamic SWOT: `12`;
  - Chat: `68`;
  - Execution: `65`;
  - Case Workspace: `75`;
- additions, duplicate IDs and missing denominator entries fail CI tests.
- the standalone server compiler now consumes a server-local type-only boundary;
  runtime manifest construction and validation remain single-sourced in
  `shared/contracts/federatedActionManifest.ts`;
- focused post-repair P3 evidence: `5/5 PASS`.

Important boundary: registry-supported actions and mounted-route denominator
rows are separate evidence sets. A mounted route is `NOT_SUPPORTED_IN_MVP` for
Teresa until an exact shared-executor mapping is proven. This report does not
claim Teresa can execute all 280 mounted mutations.

## P4 — Dynamic SWOT bounded owner header

Verdict: `CODE_PASS / BROWSER_NOT_TESTED`

Only the five backlog-eligible paths were ported. The implementation moves
Sections, How-to and AI secondary actions into the header before one primary
CTA, omits an empty Menu 2 shell only for explicit opt-in, and preserves legacy
consumers.

- focused viewport/compatibility evidence: `4/4 PASS` at 1440, 768 and 390 px;
- root typecheck: `PASS`;
- mounted browser proof: `NOT_TESTED`;
- blocker: Codex Browser/Computer Use runtime was disabled by the local
  `js_repl = false` feature flag, so `mcp__node_repl__js` was unavailable to the
  task. No substitute or synthetic screenshot is accepted as owner proof.

## Final verification on the durable candidate

Focused command result:

- test files: `6 PASS`;
- tests: `50 PASS / 0 FAIL`;
- covered Finance contracts and atomic staging, Results cutover, federated
  manifest, mounted mutation denominator and bounded owner-header behavior.

Persistence command result:

- real PostgreSQL Transform file: `1 PASS`;
- tests: `4 PASS / 1 RETIRED LEGACY SKIP / 0 FAIL`.

Shared-contract verification:

- root `npm run type-check -- --pretty false`: `PASS`;
- server `npm --prefix server run typecheck -- --pretty false`: `PASS`;
- initial standalone server rerun exposed `TS6059` in the two P3 adapters; this
  was treated as a real gate failure, fixed in `4318da80fa`, and rerun to PASS;
- focused manifest and mounted-denominator tests after the repair: `5/5 PASS`;
- post-integration Finance route and inventory requalification: `90/90 PASS`;
- `git diff --check`: required again after this report-only commit;
- candidate cleanliness: required again after this report-only commit.

## Release decision

Wave 02 is technically closed for P1, P2 and the explicit P3 MVP denominator.
P4 is code-complete but not owner-accepted. Therefore:

- `GO` for preserving this branch as the Wave 02 technical candidate;
- `STOP` for full `OWNER_ACCEPTED`, production release or deployment;
- one remaining gate: mounted browser review of the Dynamic SWOT owner header
  on the exact final candidate, followed by an owner decision;
- if that review finds defects, record screenshots and comments in the UI/UX
  correction register and iterate without changing the technical verdicts for
  unrelated P1-P3 scopes.

## Parent-task and next-round reconciliation

The bounded Wave 2 packet does not automatically promote unrelated broader
82-task parent contracts. After exact owner bindings and mounted real-PG usage
telemetry closed `RES-MVP-LEGACY-CUTOVER-001`, the authoritative reporter on
this branch is `73 DONE_CURRENT_SHA / 9 PARTIAL`, with zero missing or invalid
records.

- the original 11-task reconciliation is recorded in
  `WAVE_02_REMAINING_11_RECONCILIATION.md`;
- the exact-SHA collaborative acceptance preparation for all 16 modules is
  recorded in `WAVE_03_16_MODULE_OWNER_ACCEPTANCE_REGISTER.md`;
- neither document substitutes historical automation or code inspection for
  the outstanding mounted browser and owner decisions.
