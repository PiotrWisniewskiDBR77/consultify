# Consultify — kanoniczny plan domknięcia aplikacji

> **Plan wykonawczy 2026-08-19:** dokładny zakres, EPIC-i, DoD, testy,
> zależności i estymacje dla dziesięciu zadań z realnym brakiem produktu lub
> infrastruktury są zamrożone w
> [`TEN_PRODUCT_INFRA_CLOSURE_PLAN_20260819.md`](./TEN_PRODUCT_INFRA_CLOSURE_PLAN_20260819.md).
> Zadania są realizowane sekwencyjnie; dokument nie zmienia frozen DoD ani
> zewnętrznych owner/release gates.
> Code-audit forecast zastępuje historyczny szacunek 71–128 agent-days /
> 3–6 miesięcy; reestymację wymusiły literalne wielodrzwiowe cutover
> Results/Finance, cztery modele Execution i osobne environment gates.

Wersja: `2.0.0`

Status: `EXECUTION_READY / 82_TASKS / NOT_RELEASE_READY`

## Purpose

This document replaces dated five-hour cleanup plans, the June master closure
plan and the local `MVP_FULL_USABILITY_DECISIONS_AND_PLAN.md` as the current
completion plan. It becomes executable only through the exact candidate SHA
recorded in `CLEANUP_CURRENT_STATE_20260816.md`. Historical task definitions
are preserved below, but historical green evidence does not transfer to the
current candidate.

## Gate hierarchy

### 1. `CLEANUP_COMPLETE`

Requires one clean candidate, a complete recovery/quarantine ledger, no unknown
valuable package allowed to enter canonical execution, and a recoverable
disposition for retired worktrees. Preserved unreviewed refs may remain as a
literal `QUARANTINE_BACKLOG`; they are not integration inputs, reviewed assets,
prune-ready material, or authorization to delete history.

### 2. `INTEGRATION_READY`

Requires clean Git state, exact SHA, `diff --check` policy satisfied, build and
type checks, module-scoped tests, migration discovery and fresh-database proof
for every integrated data package.

### 3. `DEMO_READY`

Requires deployment identity matching the accepted integration SHA, real demo
database migrations, tenant-scoped write/readback, browser golden flows and
runtime evidence owned by the repository.

### 4. `PRODUCTION_READY`

Requires a separately frozen release SHA, independent verification, rollback
and migration rehearsal, security/observability gates, and explicit owner
authorization. `DEMO_READY` never implies this gate.

## Module completion board

| Module | Current status | Completion gate |
| --- | --- | --- |
| Assessment | `PARTIAL / ROUTE_MOUNT_GREEN` | Five-surface Chromium mount is green on fresh PostgreSQL. Complete Library-to-session, unify registry ownership and prove create/edit/freeze/readback. |
| Tools | `PARTIAL / INTEGRATED_REALDB_GREEN` | Browser golden flow, publishable-pack/initiative-quality policy and explicit flag decision. Fresh strict DB and 100/100 realDB assertions are green at the current candidate. |
| Audits | `PARTIAL / REALDB_AND_ROUTE_MOUNT_GREEN` | Fresh strict DB, 259/259 assertions, event compatibility readback and five-surface Chromium mount are green. Complete the audit golden flow and make the explicit rollout decision; default remains OFF. |
| Case / Agent | `ALREADY_PRESENT / VERIFICATION_REQUIRED` | No replay. Verify the existing lifecycle, 19 migrations, route/flag truth, persistence/outbox/restart, cross-module adapters and browser journeys; retain VoiceOver as literal blocker until proven. |
| Artifact / Materials | `ALREADY_PRESENT / VERIFICATION_REQUIRED` | No replay. Focused DOC/PPT/XLSX/governance/shell assertions are green; prove realDB persistence, export, cold reopen, browser accessibility and remaining human/provider/stability gates on the exact SHA. |
| Results | `ALREADY_PRESENT / BLOCKED_DATA_AND_MOUNT` | No replay. Decide access and rollout, mount the KPI/ROI/OKR workspace deliberately, provide deterministic three-role fixtures, prove lifecycle/readback and bind fresh evidence to the exact SHA. |
| Finance | `ALREADY_PRESENT / EVOLVED / RUNTIME_NOT_VERIFIED` | No replay. Prove one governed runtime owner, explicit OFF/ON workspace behavior, canonical artifact/business/working-revision identity, fresh migration lifecycle and the Results seam. |
| CEPD / Interview | `PARTIAL / SELECTIVE_RECOVERY_APPLIED` | Two exact missing hunks are recovered. Prove integer evidence persistence on fresh PostgreSQL, bounded AI timeout, access matrix, nullable evaluation and notification fallback. |
| UX tables/tools | `ALREADY_PRESENT / EVOLVED` | No replay. Rerun independent Assessment surface acceptance; retain the local scope-cleanup commit only as superseded evidence. |
| Ideas / My Work | `ALREADY_PRESENT / VERIFICATION_REQUIRED` | No replay. Prove Ideas four-surface behavior and My Work tenant idempotency, projection retire/reopen and literal Radar-OFF mount truth on fresh PostgreSQL. |
| Initiatives / Execution | `ALREADY_PRESENT / EVOLVED / VERIFICATION_REQUIRED` | No replay. Prove canonical routes, fresh migration ledger, lifecycle and forbidden-transition flows, tenant/RBAC, owner-backed execution, closure, and Results/Finance persistence seams. |
| Chat / Teresa | `ALREADY_PRESENT / EVOLVED_SAFER / VERIFICATION_REQUIRED` | No replay. Verify governed handoff, conflict recovery, provider behavior, persistence and cross-tenant denial on the exact runtime candidate. |
| Auth / Security | `ALREADY_PRESENT / SECURITY_EVOLVED` | No replay. Retain fail-closed SAML verification and sandbox enforcement; run the exact candidate security and negative-control gates before release. |

## Execution rule

Every module advances through:

`route -> mount -> API/service -> persistence -> readback -> test -> browser`

Missing evidence preserves `PARTIAL`, `BLOCKED`, `EVIDENCE_MISSING`, or
`NOT_VERIFIED`. Historical green runs do not transfer across SHAs.

The test-discovery gate currently has no unresolved or broken-orphan file:
4997/4997 are classified, including the recovered cookie-auth security suite
(11/11 assertions green).

Both production compile surfaces are green on the recovery candidate:
frontend/shared Vite build with the documented 8 GB heap and the strict backend
TypeScript emit. Backend build also verifies that its generated SWOT/output
runtime mirrors have not drifted from their root domain sources.

## Historical plans

The following classes are historical evidence and not active instructions:

- `FINAL_ACCEPTANCE_SPRINT_20260815.md`
- `NEXT_5H_EXECUTION_PLAN_20260815.md`
- `CLEANUP_5H_FAST_PATH_20260815.md`
- `FIVE_HOUR_*_20260815.md`
- `CLEANUP_FASTPOINT_20260815.md`
- dated status snapshots and objective-progress snapshots
- `docs/plans/CONSULTIFY_MASTER_CLOSURE_PLAN.md` from 2026-06-03

They may be retired only after links and unique evidence are preserved.

## Program denominator: 74 + 8

The executable denominator is exactly `82` unique tasks:

- 74 module tasks across 16 modules;
- one cross-module transformation flow;
- six system/NFR tasks;
- one release task.

Module distribution: Chat 3, My Work + Agent 4, Interview 3, Tools 3,
Assessment 3, Initiatives 6, Execution 5, Results 5, Finance 6, Materials 7,
Audits 7, Meeting 3, Organization 3, Admin 4, Settings 6 and Partner 6.

The historical plan counted “participation in flow” inside the Execution and
Results module totals while also excluding the top-level flow from 74. This
plan removes the ambiguity: `EXE-FLOW-ADAPTER-001` and
`RES-FLOW-ADAPTER-001` are module tasks; `FLOW-TRANSFORM-MVP-001` remains the
separate end-to-end integration task.

### Status vocabulary

- `DONE` — complete evidence remains valid on the current exact product SHA.
- `PARTIAL` — implementation or evidence exists, but the task remains open.
- `OPEN` — no complete current-SHA proof.
- `NOT_VERIFIED` — implementation may exist; required evidence was not run.
- `BLOCKED_OWNER` — a business, legal, methodology, provider or rollout
  decision is required.

Cleanup completion does not close a product task. A module task is `DONE` only
after route, mount, API/service, canonical owner persistence, cold readback,
focused/static, fresh+upgrade realDB, browser/visual and required deployed
parity all pass on the same SHA. Tenant, role/capability, stale/CAS,
retry/replay, concurrency/idempotency, provider/schema failure and orphan-row
negative controls are mandatory where applicable.

## Frozen MVP decisions

1. One canonical domain writer; no dual-write or silent legacy fallback.
2. An unavailable/unapproved provider returns explicit `UNAVAILABLE`, never a
   mock or silent downgrade.
3. Meeting recording is OFF by default; minutes and proposal-first remain.
4. Partner MVP ends at versioned accrual and manually approved payout request;
   no automatic payout/KYC/tax.
5. Audit MVP uses an internal unlicensed transformation pack; named external
   standards remain OFF without rights.
6. Tools MVP is Dynamic SWOT; Assessment MVP is DRD. Other methods require a
   separate packet, provenance and rights.
7. Materials export receipts bind immutable source version/hash and provider
   job/output identity.
8. Retention is a versioned tenant policy; legal hold is separate; no
   destructive purge before legal policy.
9. Public personas are Owner, Admin, Manager, Consultant, Member, respondent
   and partner.
10. Existing Visual Standard, StyleGuide and hub/mobile standards are the UI
    authority; no local design systems.
11. Incomplete destructive actions remain hidden.
12. Cross-module handoffs use versioned payload, idempotency key and
    exactly-once receipt/outbox.
13. Meeting/Teresa proposes Task/Decision/Material; a human approves creation.
14. Results owns append-only Actual; Finance reconciles but does not overwrite
    the Results owner.

Changing a frozen decision requires an explicit owner, date, rationale and
impact/invalidation matrix.

## Detailed module task register — 74 tasks

### M01 Chat — 3

- `CHAT-BVP-001` — `PARTIAL`: message/attachment/URL → citation → proposal →
  approval → one receipt → cold reopen; tenant/retry/concurrent approval and
  provider fail-closed; exact S/D/B/V/P.
- `CHAT-NFR-001` — `OPEN`: streaming cancellation, latency/retry budget,
  provider recovery, restart durability, telemetry and runbook.
- `CHAT-UI-CANON-001` — `OPEN`: mounted inventory, all states, 1440/768/390,
  light/dark, PL/EN, keyboard/focus/axe and human sign-off.

### M02 My Work + Agent — 4

- `MYW-REALDB-FIXTURE-AUTH-001` — `OPEN`: governed positive fixture, owner and
  fresh-PG authority; every pending gets a material disposition.
- `MYW-AGT-BVP-001` — `PARTIAL`: event→inbox→decision/notebook/idea and
  conversation→same transformation case/plan; stable IDs, tenant, CAS,
  concurrency and reopen.
- `AGT-OPS-001` — `OPEN`: outbox/restart/long-run, failed-provider recovery,
  duplicate prevention, telemetry and runbook.
- `MYW-AGT-UI-CANON-001` — `OPEN`: full role/state/viewport sign-off; Radar
  remains literally OFF until a separate decision.

### M03 Interview — 3

- `INT-BVP-001` — `PARTIAL`: publish→invite→respond/resume→submit→approve
  insight→one candidate→reopen; expiry, revoke, respondent wall, tenant,
  stale/concurrency.
- `INT-DELIVERY-OPS-001` — `PARTIAL`: integer evidence fresh-PG readback,
  bounded AI timeout, notification fallback, restart and telemetry.
- `INT-UI-CANON-001` — `OPEN`: respondent/manager/owner, timeout/error states,
  responsive, visual and accessibility sign-off.

### M04 Tools — 3

- `TLS-BVP-001` — `PARTIAL / REALDB_SLICE_GREEN`: Dynamic SWOT through
  immutable output/report/presentation/candidate and reopen; CAS 409/428,
  tenant, race/replay and nonempty lineage.
- `TLS-CATALOG-001` — `PARTIAL / POLICY_BOUND`: one truthful catalog; Dynamic
  SWOT active, other tools hidden/unavailable until packet, provenance and
  rights exist.
- `TLS-UI-CANON-001` — `OPEN`: all SWOT surfaces/states and full responsive,
  language, keyboard/axe and visual sign-off.

### M05 Assessment — 3

- `ASM-BVP-001` — `PARTIAL / ROUTE_MOUNT_GREEN`: Library→DRD session→answers/
  evidence→review/freeze→immutable report→initiative batch→reopen; one version
  owner and exactly-one batch.
- `ASM-METHOD-CATALOG-001` — `PARTIAL / BLOCKED_OWNER`: unify definitions,
  method packs and flags; DRD active, other methods fail-closed pending rights.
- `ASM-UI-CANON-001` — `OPEN`: five surfaces plus complete create/edit/freeze/
  readback and responsive/a11y/human sign-off.

### M06 Initiatives — 6

- `INI-BVP-001` — `PARTIAL`: approved candidate→one Initiative→gate→one
  Execution handoff→reopen; tenant project, capability, stale/concurrency.
- `INI-MVP-PROFILE-001` — `PARTIAL`: one project/team/capability/approval
  policy and writer.
- `INI-MVP-PORTFOLIO-001` — `PARTIAL`: idempotent Portfolio/Resource/Roadmap/
  Timeline/Capacity read models.
- `INI-MVP-GATE-001` — `PARTIAL`: auditable GO/NO-GO and same-ID
  scheduled→executing receipt.
- `INI-MVP-CARDS-001` — `PARTIAL`: deterministic persisted cards/reopen and
  retirement/read-only disposition of old variants.
- `INI-UI-CANON-001` — `OPEN`: hub, management/control/rollout, cards/gates,
  all states, roles and viewport sign-off.

### M07 Execution — 5

- `EXE-BVP-001` — `PARTIAL`: Initiative→case→work/resources/control/report→
  approved evidence→one Results signal→reload; tenant/role/replay/concurrency.
- `EXE-MVP-SPINE-001` — `PARTIAL`: one plan/tasks/milestones/RACI/resources/
  budget/capacity/RAID/issues/changes/decisions spine.
- `EXE-MVP-ACTIONS-001` — `OPEN`: implement or hide exposed edit/archive/
  delete; destructive policy, audit and negative controls.
- `EXE-FLOW-ADAPTER-001` — `PARTIAL`: versioned Initiative→Execution and
  Execution→Results exactly-once adapters with restart/readback.
- `EXE-UI-CANON-001` — `OPEN`: owner-backed runtime, actions, all states,
  responsive/a11y and visual sign-off.

### M08 Results — 5

- `RES-BVP-001` — `PARTIAL / BLOCKED_DATA_AND_MOUNT`: KPI/ROI/OKR golden
  flows, persistence, role/visibility, append-only history and flag OFF/ON.
- `RES-MVP-LEGACY-CUTOVER-001` — `OPEN`: one owner, backfill/usage/rollback
  proof before legacy Goals/store writer retirement.
- `RES-MVP-VISIBILITY-001` — `BLOCKED_OWNER`: enterprise visibility and
  roll-up policy with three-role fixture and cross-tenant denial.
- `RES-FLOW-ADAPTER-001` — `PARTIAL`: Execution→observation and Results
  Actual→Finance reconciliation, versioned/idempotent/restart-safe.
- `RES-UI-CANON-001` — `OPEN`: KPI/ROI/OKR all states, roles, viewports,
  languages, visual and accessibility sign-off.

### M09 Finance — 6

- `FIN-BVP-001` — `PARTIAL / BLOCKED_ARCHITECTURE`: statement→baseline→
  prediction→analysis→valuation→approve/export/reopen; identity, tenant/RBAC,
  precision and no false success.
- `FIN-MVP-CUTOVER-001` — `OPEN`: one governed compatibility/V8 runtime spine,
  ID space, backfill, usage proof and rollback.
- `FIN-MVP-CANDIDATE-001` — `OPEN`: Finance→Candidate Pack with versioned
  numerical anchors and immutable source identity.
- `FIN-MVP-RECONCILIATION-001` — `BLOCKED_OWNER`: Results owns Actual;
  Finance dispute/reconciliation owner, outbox replay and audit.
- `FIN-MVP-IMPORT-001` — `OPEN`: representative XLSX/CSV import→map→correct→
  confirm with validation/tenant/rollback.
- `FIN-UI-CANON-001` — `OPEN`: five workspaces OFF/ON, deep links/reload,
  identity/error/conflict and responsive/a11y sign-off.

### M10 Materials — 7

- `MAT-POL-001` — `BLOCKED_OWNER`: approved DOCX/PPTX/XLSX provider,
  DPA/residency/SLA/cost and asset provenance/licenses.
- `MAT-BVP-001` — `PARTIAL`: real DOC/PPT/XLSX open→edit/version/export→
  reopen; leases/CAS/four-eyes/tenant/concurrency/provider failure.
- `MAT-MVP-DOC-001` — `PARTIAL`: create/edit/checkpoint/restore/share/revoke/
  rotate DOC and immutable lineage.
- `MAT-MVP-PPT-001` — `PARTIAL`: template/edit/history/restore/PPTX+PDF/share/
  revoke, notes and accessibility.
- `MAT-MVP-XLSX-001` — `PARTIAL`: structural operations, formulas, versions,
  concurrency, share/archive and cold readback.
- `MAT-MVP-EXPORT-001` — `OPEN`: immutable source artifact/version/hash,
  provider job, output hash and retry receipt.
- `MAT-UI-CANON-001` — `OPEN`: three editors, shell/context menus, responsive,
  light/dark, keyboard/VoiceOver/axe and human sign-off.

### M11 Audits — 7

- `AUD-POL-001` — `BLOCKED_OWNER`: methodology/rights owner, internal pack and
  segregation of duties; named external standards OFF.
- `AUD-BVP-001` — `PARTIAL / REALDB_AND_ROUTE_MOUNT_GREEN`: program create/
  save/reopen, tenant/role/stale/replay and flag OFF/ON.
- `AUD-MVP-OWNER-001` — `OPEN`: one API/data writer; canonical
  `/audit-programs`, legacy redirect/read-only/retired after proof.
- `AUD-MVP-RIGHTS-001` — `BLOCKED_OWNER`: provenance and rights, fail-closed
  names/content/scoring.
- `AUD-MVP-LIFECYCLE-001` — `OPEN`: criterion→evidence→finding→action→
  candidate→closure→effectiveness, immutable audit and no self-approval.
- `AUD-MVP-AI-HANDOFF-001` — `OPEN`: AI proposal-only, human approval and one
  downstream receipt.
- `AUD-MVP-DATA-001` — `OPEN`: governed synthetic fixture with at least 150
  criteria, 400 evidence, 60 findings, 40 actions and 12 candidates plus
  role/tenant/performance/cold-reopen proof.

### M12 Meeting — 3

- `MTG-POL-001` — `BLOCKED_OWNER`: recording OFF; consent, transcript
  retention, legal hold and regional policy.
- `MTG-BVP-001` — `NOT_VERIFIED`: create→agenda/materials→notes→proposal→human
  approval→exactly one task/decision/material→reopen; tenant/role/replay.
- `MTG-UI-CANON-001` — `OPEN`: minutes/proposals/consent/retention/errors and
  complete responsive/a11y/visual sign-off.

### M13 Organization — 3

- `ORG-BVP-001` — `NOT_VERIFIED`: document→claim proposal→approve→immutable
  context snapshot→Chat with exact refs→reopen; conflict/source deletion/
  tenant/confidentiality.
- `ORG-OPS-001` — `OPEN`: snapshot lifecycle, provenance/retention,
  monitoring, repair/rebuild and runbook.
- `ORG-UI-CANON-001` — `OPEN`: context/claims/sources/snapshots, confidentiality
  and permission/error states with responsive/a11y sign-off.

### M14 Admin — 4

- `ADM-BVP-001` — `NOT_VERIFIED`: invite→accept→role→revoke→new session;
  last-owner/cross-org/stale/no-capability and complete audit.
- `ADM-MVP-OPS-001` — `OPEN`: tenant IAM jobs/retry/audit/observability and
  support runbook; SuperAdmin outside MVP.
- `ADM-MVP-BACKUP-001` — `OPEN`: tenant backup/export/restore, encryption,
  access audit and recovery rehearsal.
- `ADM-UI-CANON-001` — `OPEN`: IAM/security/audit states, hidden forbidden
  controls, responsive/a11y and multi-persona sign-off.

### M15 Settings — 6

- `SET-BVP-001` — `NOT_VERIFIED`: profile/language/theme/notifications/AI save
  → DB → reload/new session; tenant lock, no fake success, secret non-readback.
- `SET-MVP-OAUTH-001` — `BLOCKED_OWNER`: connect/revoke/error only for approved
  providers and residency policy.
- `SET-MVP-MFA-001` — `OPEN`: enroll/challenge/recovery/re-auth, tenant
  enforcement and audit.
- `SET-MVP-EXPORT-001` — `OPEN`: portable user export with immutable request/
  receipt and authorization.
- `SET-MVP-DELETE-001` — `BLOCKED_OWNER`: request/cancel/approve/legal hold/
  anonymization under legal retention policy.
- `SET-UI-CANON-001` — `OPEN`: preference/security/privacy states, mobile,
  keyboard/focus/axe and human sign-off.

### M16 Partner — 6

- `PRT-POL-001` — `BLOCKED_OWNER`: currency, rule, eligibility, attribution
  window, reversal/dispute/tax and manual payout policy.
- `PRT-BVP-001` — `NOT_VERIFIED`: register/connect→certification→code→read
  attribution→reopen; expiry/isolation/retry/concurrency, no fabricated payout.
- `PRT-MVP-LEDGER-001` — `OPEN`: append-only participant ledger, rule version,
  corrections/reversals/disputes and audit.
- `PRT-MVP-ACCRUAL-001` — `BLOCKED_OWNER`: referral→eligible accrual→manual
  payout request→independent approval; no automatic payout.
- `PRT-MVP-LEGACY-CUTOVER-001` — `OPEN`: backfill/parity/usage telemetry, zero
  legacy fallback and rollback.
- `PRT-UI-CANON-001` — `OPEN`: partner/certification/attribution/ledger/accrual
  states, isolation, responsive/a11y and sign-off.

## Eight cross-program tasks outside the 74

| Task | Current state | Literal completion |
| --- | --- | --- |
| `FLOW-TRANSFORM-MVP-001` | `OPEN / DEPENDS_ON_M06-M09` | Organization/Interview/DRD/SWOT→approved candidate→Initiative→Execution→Results Actual→Finance reconciliation→PIR; one realPG lineage, stable IDs after restart, zero orphans, deployed desktop/mobile and rollback. |
| `NFR-PERF-001` | `OPEN` | Representative latency/load/concurrency/limits for 16 modules, thresholds, positive control and trend evidence on release SHA. |
| `OPS-OBS-001` | `OPEN` | Structured logs, metrics, alerts, dashboards, correlation IDs, SLO and exercised runbooks. |
| `SEC-PRIV-001` | `PARTIAL` | Threat model, SAML/sandbox negatives, secrets/residency/retention/privacy, dependency triage and security UAT. Existing fixes are preserved; release proof remains open. |
| `DATA-DR-001` | `OPEN` | Realistic backup/restore/backfill/disaster recovery with RPO/RTO, checksums, tenant isolation and rehearsal. |
| `PERSONA-UAT-001` | `OPEN` | Owner/Admin/Manager/Consultant/Member/respondent/partner job stories, capability negatives and wave sign-offs. |
| `UI-CANON-ALL-001` | `OPEN` | Aggregate 16 UI packets, all viewports/themes/languages, axe and human brand/UX approval. |
| `REL-001-T01` | `NOT_AUTHORIZED / OPEN` | Frozen release SHA, push without force, snapshot/preflight, migrations, deploy, server/client SHA, DB/flag/data readback, 16 deployed flows, stable telemetry window and rollback rehearsal. |

## Internal-beta authority amendment — 1 supplemental task

- `AUD-UI-CANON-001` — `AUTHORIZED / DONE_CURRENT_SHA_INTERNAL_BETA`:
  existing `/audit-programs` UI only; automated mounted G4 is accepted instead
  of human UAT for internal beta. Authorized by Piotr on 2026-08-20 with the
  exact statement: “Autoryzuję dodanie AUD-UI-CANON-001 do authority internal
  beta w ograniczonym zakresie istniejącego Audit UI i akceptuję jego
  automatyczne dowody jako UAT.” This supplemental authority does not rewrite
  the historical 74+8 denominator and does not authorize production deployment,
  licensed audit content or a new Audit surface.

## Execution waves and dependencies

### Four-branch ownership

| Lane | Scope | Top-level tasks |
| --- | --- | ---: |
| Claude A — method/evidence | Assessment, Audits, Tools, Interview BVP+delivery | 15 |
| Claude B — transformation | My Work Decisions/Tasks/Agent, Initiatives, Execution | 15 |
| Claude C — Ideas/Documents | Materials, Chat, Organization, Meeting BVP+UI; Ideas mandatory sub-packets | 15 |
| Codex integrator | Results, Finance, Admin, Settings, Partner, Interview UI, Meeting policy and all cross-program gates | 37 |
| **Total** |  | **82** |

The executable packets are under `docs/cleanup/agents/`. Claude C's two Ideas
sub-packets are acceptance scope of existing parent tasks, not extra top-level
denominator. Integration is serial A → C → B → Codex Results/Finance even when
implementation runs in parallel.

1. **Packet freeze:** exact candidate, clean state, task owner, dependencies,
   allowlist/hash, fixture and commands. Historical branches are never bases.
2. **Owner decisions:** Assessment catalog; Results visibility; Finance
   reconciliation; Materials provider; Audit methodology/rights; Meeting
   consent/retention; Settings OAuth/deletion; Partner economics.
3. **Ownership/data spines:** My Work fixture → Assessment registry →
   Initiatives lifecycle → Execution spine → Results mount/data → Finance
   cutover/reconciliation → Audit owner.
4. **Transformation:** M06–M09 adapters, then `FLOW-TRANSFORM-MVP-001`. A sum
   of module tests does not close the end-to-end flow.
5. **Domain A:** Chat, My Work/Agent, Interview, Tools, Assessment,
   Organization. **Domain B:** Materials, Audits, Meeting, Admin, Settings,
   Partner. Parallel work only on disjoint allowlists/fixtures; serial
   integration.
6. **UI/personas:** sixteen `*-UI-CANON-001`, then `UI-CANON-ALL-001` and
   `PERSONA-UAT-001`.
7. **NFR/release candidate:** performance, observability, security/privacy,
   DR, complete static/type/build/test and fresh+upgrade database matrix.
8. **Demo/release:** exact-SHA demo with 16 golden flows, then separately
   authorized `REL-001-T01`.

Immediate execution order:

1. `MYW-REALDB-FIXTURE-AUTH-001`.
2. `ASM-BVP-001` and `ASM-METHOD-CATALOG-001`.
3. Initiatives and Execution spine/adapters.
4. Results mount/visibility/adapter.
5. Finance BVP/cutover/reconciliation.
6. `FLOW-TRANSFORM-MVP-001` on fresh PostgreSQL.
7. Remaining domains, UI/personas, NFR, demo and release.

## Realistic duration estimate

This is a program, not a cleanup sprint. For one Codex execution lane working
serially, with stable environments and prompt owner decisions:

| Workstream | Estimated focused agent-days |
| --- | ---: |
| Packet revalidation and owner-contract preparation | 3–6 days |
| Core spines: My Work, Assessment, Initiatives, Execution, Results, Finance | 18–32 days |
| Remaining ten domain closures | 18–30 days |
| Sixteen UI canon packets and persona acceptance preparation | 12–22 days |
| Cross-flow, performance, observability, security/privacy and DR | 12–22 days |
| Full regression, demo candidate, release rehearsal and fixes | 8–16 days |
| **Technical total, serial** | **71–128 focused agent-days** |

Practical forecast:

- uninterrupted continuous technical path: approximately `10–18 calendar weeks`;
- realistic calendar including owner decisions, providers, environments,
  human UX/accessibility and stabilization: approximately `3–6 months`;
- unresolved architecture or production defects may extend the upper bound.

Codex can own code, migrations, tests, realDB/browser evidence, documentation,
defect repair and release-candidate preparation. It cannot independently close
human VoiceOver/brand UAT, legal/methodology/provider decisions or production
authorization. Those remain named external gates, not hidden contingency.

## Task packet and execution ledger contract

Packet readiness is machine-verified by
`node scripts/cleanup/verify-closure-plan.mjs`. The accepted execution packet
commit is `59d572fb83`; branches are sealed by its documentation-only
descendant. This readiness means tasks are unambiguous and safely assignable;
it does not pre-claim implementation or release success.

Before start, every task records: `taskId`, owner, exact baseline SHA,
allowlist/hash, dependencies, fixture IDs/provenance, commands and denominators,
evidence artifact hashes, rollback and verdict. Integrator records:

`taskId → source SHA → canonical SHA → product SHA → evidence SHA`.

Workers use short-lived worktrees. No broad merge, reset/clean/stash, force
push, deploy, ref deletion or shared-file mutation without an explicit lease.

## Source provenance

The 82-task scope was recovered from the local branch
`codex/consultify-canonical-cleanup-20260814`, primarily:

- `docs/cleanup/agents/MVP_FULL_USABILITY_DECISIONS_AND_PLAN.md`;
- `docs/cleanup/agents/MVP_DECISION_REGISTER.md`;
- `docs/cleanup/agents/MODULE_AGENT_TASK_QUEUE.md`;
- `docs/cleanup/agents/SHARED_CONTEXT_16_MODULE_AGENTS.md`;
- `docs/cleanup/FINAL_16_MODULE_READINESS_AND_EXECUTION_PLAN_2026-08-15.md`.

Those files remain historical sources, not active execution instructions. Their
product SHAs, migration/test counts and browser/deployment claims are not
transferable to the current candidate. Current package truth remains in
`CLEANUP_RECOVERY_LEDGER_20260816.md`; current repository state remains in
`CLEANUP_CURRENT_STATE_20260816.md`.
