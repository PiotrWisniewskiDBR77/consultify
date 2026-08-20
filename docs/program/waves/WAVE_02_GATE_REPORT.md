# Consultify — Wave 02 Core Closure gate report

Date: `2026-08-20`

Overall verdict: `CONDITIONAL_PASS / OWNER_BROWSER_GATE_REQUIRED`

This report qualifies the code candidate at
`a02a15073733ffc25cfb471a37586361c1815e6e` on
`codex/full-mvp-recovery-20260820`. It does not authorize production, deployment,
or promotion to `OWNER_ACCEPTED`.

## Candidate and recovery state

- durable worktree: `/Users/piotrwisniewski/Developer/consultify-wave02-recovery`;
- code candidate: `a02a15073733ffc25cfb471a37586361c1815e6e`;
- branch: `codex/full-mvp-recovery-20260820`;
- recovery source: the same branch and commit formerly checked out at the
  reboot-removed `/private/tmp/consultify-staging-deploy-e6ca`;
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
