# Wave 3 — Interview acceptance

ID: `INT`
Routes: `/interview`, `/interview/respond/:token`
Current gate: `TECHNICAL_BROWSER_COMPLETE_WITH_PROVIDER_UNAVAILABLE / OWNER_REVIEW_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: create/manage an interview and complete the isolated public
respondent path with durable response readback.

Required boundaries: expired/replayed/foreign token, respondent isolation from
organization navigation, insufficient manager role and duplicate submission.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Routes: authenticated `/interview` and isolated public `/interview/respond/:token`. Task links: `INT-BVP-001`, `INT-DELIVERY-OPS-001`, `INT-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile, production outreach and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Exact corrected adopted runtime on product/client/server `3d61730fd8ad18d19cf9967cb5513697659003cc`, dirty fingerprint `950fd602e25e20defb9e3c905675d1c32bd101907a27e01079b8fa152c2c633a`: server `:3984`, client `:3985`, retained DB `consultify_w3_interview_owner_browser_20260822`, `817` migrations. Runtime manifest `/private/tmp/consultify-wave3-runtime-manifest-interview-retest-20260822.json` proves health/ready/frontend `200`, exact server/readiness SHA, client marker, SQL ledger and `W3-INTERVIEW-OWNER-v1` durable marker; auth/test bypasses were OFF. Owned runtime stopped cleanly with process groups terminated, ports free and adopted DB preserved. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Manager: create/publish/assign/invite/review. Respondent: opaque token → resume/CAS answer → submit. Downstream: approved insight → exactly one initiative candidate. Durable boundaries include token expiry/revoke, anonymity wall, tenant/role access, answer CAS, AI timeout audit, notification fallback and immutable handoff receipt. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed matrix: session owner, same-tenant ADMIN, direct assignee, team assignee and legitimate public-token respondent. Denied matrix: unrelated same-org member, inactive member, foreign-tenant ADMIN, revoked/expired token and replay/concurrent stale writer. The mounted owner fixture binds stable OWNER `w3.interview.owner@local.test` plus active and revoked public-token paths; the broader denied matrix remains RealPG-backed and was not manually replayed in full. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Technical fixture: disposable `int_bvp_*` database with explicit immutable-cleanup opt-in, opaque 256-bit tokens, two isolated organizations and unique `intbvp001-*` identities; residue `0`, immutable trigger enabled (`O`). Owner fixture: local-only idempotent seed `seed-wave3-interview-owner-review.ts`, two coherent sessions, six realistic Polish questions/answers, active anonymous link, submitted manager-review state and revoked-link boundary. Reseeding preserves respondent answers and terminal state. |
| G05 | Functional preflight and cold readback | `PASS_WITH_PROVIDER_UNAVAILABLE` | Source lanes remain `70/70` real-PG, `34/34` component/API and `15/15` routing-seam PASS. Focused correction tests passed `47/47`; mounted RealPG passed `6/6`, including durable evaluation snapshot and independent cold-pool answer readback. On the corrected exact runtime, the authenticated owner cold-opened `wave3-int-owner-review-session-v1` with all three persisted answers plus manager detail/questions/notes/evidence/linked-items/summary reads. One automatic canonical V8 evaluation request produced the intended retryable `503 INTERVIEW_EVALUATION_UNAVAILABLE`; the runtime log contains no legacy-compatible evaluation request and no evaluation `500`, so no fabricated score or duplicate provider call occurred. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS_TECHNICAL_WITH_PROVIDER_UNAVAILABLE` | Corrected exact-runtime desktop replay passed the manager entry/workspace, active public respondent route and revoked-link boundary. The active public DOM rendered the three required Polish questions; the revoked route rendered “Ten link wygasł albo został cofnięty.” and the server recorded `410`. After the single canonical evaluation `503`, the manager DOM remained in the honest `Ocena AI — Brak oceny` state and the console carried the typed unavailable-capability error; no legacy retry was observed. Provider-backed scoring itself remains unavailable in this secret-free local runtime and is not claimed green. The write-once fixture receipt remains `deepLinkVerified:false`; this later exact-runtime evidence is recorded here instead of rewriting that receipt. PL/EN, tablet, themes and full a11y/console matrix remain for the owner round; mobile is non-gating. This is not owner acceptance. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 3. Owner decisions remain pending. |
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
| _prepare before G07_ | `/interview` | _pending_ | Create/manage interview → open respondent link → submit → readback | Production outreach | Interview clarity, respondent trust, completion friction, result usefulness |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `INT-TECH-01` | technical matrix | Invite, respondent, manager, delivery, timeout and candidate boundaries | Fresh disposable DB `int_bvp_wave3_20260821`; unique per-run fixtures; immutable cleanup requires both opt-in and `int_bvp_*` DB prefix | independent SQL assertions and cold-pool assertions in real-PG suites | allowed/denied matrix in G03 | `70/70 PASS` | current source candidate `d3d6de5bfc` |
| `INT-OWNER-01` | owner-review fixture | Credible manager and anonymous-respondent journey | guarded loopback DB `consultify_w3_interview_owner_browser_20260822`; FINAL write-once manifest and durable marker | live public API + PostgreSQL + mounted cold UI replay | local owner + token-only anonymous respondent | `TECHNICAL_BROWSER_COMPLETE_WITH_PROVIDER_UNAVAILABLE` | 2 sessions, 6 questions, 2 distributions; corrected exact-runtime manager and active-public cold readback; revoked `410`; exactly one canonical evaluation `503`, zero compatibility retries and honest `Brak oceny` UI |

Owner fixture identifiers:

- template: `wave3-int-owner-template-v1`
- public session: `wave3-int-owner-public-session-v1`
- submitted manager-review session: `wave3-int-owner-review-session-v1`
- public distribution: `wave3-int-owner-public-distribution-v1`
- revoked distribution: `wave3-int-owner-revoked-distribution-v1`
- the local token routes are emitted by the seed at runtime and are deliberately
  not copied into this durable document

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `INT-PF-001` | The historical exactly-once test tried to delete an immutable handoff receipt and failed during teardown after all functional assertions passed. Cleanup now requires an explicit opt-in, a verified `int_bvp_*` disposable database, transaction-local replica role, zero-residue proof and enabled-trigger readback. | Initial current-SHA replay: `70/70` functional assertions with teardown failure; corrected replay on fresh PostgreSQL: `70/70 PASS`, residue `0`, trigger `O`; commit `9fcff61b7d`. | `FIXED_VERIFIED` |
| `INT-PF-002` | The shared candidate scanner referenced nonexistent `assessments.title` and `assessments.summary` columns. Its fail-soft catch hid the schema error and silently skipped Assessment candidates during an Interview scan. The query now uses canonical `name` and `description` columns. | Real-PG query error on initial replay; corrected exactly-once suite `11/11 PASS` without the missing-column error; commit `291e37340f`. | `FIXED_VERIFIED` |
| `INT-PF-003` | The authenticated hub was blanket-gated by global V8 availability even though authoring remains a supported legacy-canonical contract; V8 assignments/insights silently fell back to legacy, masking contract and tenant failures. Routing is now explicit by capability: authoring stays on its declared backend, assignments/insights are V8-only and fail visibly. Unsupported archived assignment commands remain unavailable rather than writing legacy. | Focused routing/smoke `2/2` files, `15/15 PASS`; structural search finds zero V8 `.catch()` legacy fallbacks and zero legacy assignment/insight calls in the hub; root typecheck PASS. | `FIXED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `INT-PF-001` | Test teardown predated immutable source-receipt protection. | Strict disposable-DB/opt-in guard, transaction-local trigger bypass, residue and trigger-state proof. | `9fcff61b7d` | current fresh-PG `70/70 PASS`, residue `0`, trigger `O` |
| `INT-PF-002` | Fail-soft scanner query used two columns absent from the canonical Assessment schema. | Read canonical `name` and `description`. | `291e37340f` | exactly-once real-PG `11/11 PASS`, missing-column error absent |
| `INT-OWNER-01` | No durable realistic Wave 3 fixture existed for the guided owner round. | Add local-only non-destructive seed for manager, respondent and revoked-link states. | `d3d6de5bfc` | seed readback `2` sessions / `6` questions / `2` distributions; active API + revoked `410` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
