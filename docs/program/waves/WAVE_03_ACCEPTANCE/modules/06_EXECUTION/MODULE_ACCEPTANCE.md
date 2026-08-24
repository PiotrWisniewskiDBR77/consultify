# Wave 3 — Execution acceptance

ID: `EXE`
Routes: `/execution`, `/execution/:caseId`
Current gate: `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

> Recovery replay — 2026-08-23: the historical 817-migration database recorded
> below was absent at catalog revalidation. A replacement local-only database,
> `consultify_w3_execution_owner_recovered_20260823`, was provisioned through
> the exact 831-migration chain and bound to a new FINAL `0600` manifest. A
> PostgreSQL restart followed by independent readback preserved the complete
> closed execution/evidence/Results lineage and all six personas. Exact clean
> SHA `df885a12eb352c2c417739c363ca5d1ec714d2c3` then adopted it on server/client
> `4333/4334`: health/readiness/frontend were `200/200/200`, migration ledgers
> were `ok/ok`, the client marker and SQL ownership marker passed, canonical
> Initiative/Case/work/list API reads returned `200`, anonymous access returned
> `401`, inactive login `403`, and foreign-tenant Case access `404`. This restores
> current technical API/storage readiness, not authenticated browser evidence,
> Piotr acceptance, policy approval, production release, or final 16/16 replay.

> Current integration replay — 2026-08-24: exact clean SHA
> `14da3e6d07578ca035daf62f1b7731cbb53dcfdb` on server/client `4006/4007`
> used real local authentication and the preserved 834-migration database
> `consultify_w3_initiatives_owner_execution_20260824`. The same canonical
> Initiative was visible in Initiatives and `Realizacje`; Work, Resources,
> Control and Reports were non-empty and SQL/API counts reconciled. Evidence:
> `../../evidence/current-sha-14da3e6d-2026-08-24/initiatives-execution/EVIDENCE_INDEX.md`.
> This closes the current wiring/readback proof, not owner acceptance or the
> open product and visual findings.

## Contract

Primary journey: open a case, inspect capacity/health, perform a governed action
and cold-reopen. Required boundaries: member/viewer denial, stale action,
concurrency conflict, foreign tenant and rollback receipt.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope: canonical Execution spine and health, Initiative→Case handoff, governed actions, delivery evidence, immutable Results signal and closure delivery to Results/Finance decision. Task links: `EXE-BVP-001`, `EXE-MVP-SPINE-001`, `EXE-MVP-ACTIONS-001`, `EXE-FLOW-ADAPTER-001`, `EXE-UI-CANON-001`; all five evidence packets report `DONE_CURRENT_SHA`. Mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_EXACT_RUNTIME_PREFLIGHT` | Exact browser candidate `3d61730fd8ad18d19cf9967cb5513697659003cc`; adopted retained DB `consultify_w3_execution_owner_final_ui_20260822`, server/client `3982/3983`, health/ready/frontend `200`, exact server/client SHA, `817` migrations and durable SQL marker verified. The owned runtime was identity-stopped after replay; DB and FINAL manifest remain retained. This is technical qualification, not owner acceptance or release approval. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Initiative handoff → governed Case/work/resources/control → evidence submit/distinct approval → close → immutable exactly-once Results receipt → Finance `NEEDS_DECISION` without fabricated actual. Nine implemented actions are registry-governed; four hidden actions remain absent. Stale CAS, idempotency, tenant, role, rollback and cold readback are explicit boundaries. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant OWNER/ADMIN plus distinct approver. Denied: MEMBER for governed mutation, inactive/revoked member, foreign tenant, forged JWT, stale CAS writer and hidden/unregistered action caller. Live persona `cw-local-user` and distinct local actors passed real login/JWT checks; owner-review personas will be bound to the stable UI fixture. |
| G04 | Reproducible realistic and boundary fixtures | `SEEDED_RETAINED` | Fresh disposable local DB `consultify_w3_execution_owner_final_ui_20260822` passed all `817` exact-current migrations. Retained secret-free `0600` FINAL manifest: `/tmp/w3-execution-owner-final-ui-20260822-v3.json`; durable marker, exact DB/family binding and six personas verified. The fixture now seeds the explicit tenant V8 row and a deterministic accepted runtime-v1 Initiative/Handoff/Execution Case snapshot in addition to the governed BVP action/budget/evidence/close and immutable Results receipt. Reset fails closed instead of disabling the immutable Results trigger; use manifest-bound drop + fresh provision after a completed lineage. DB and manifest are preserved for owner review. |
| G05 | Functional preflight and cold readback | `PASS_TECHNICAL_BROWSER_PARTIAL` | Existing technical denominator remains `137/137 PASS`. Exact-source adopted runtime on `3982/3983` reported health/ready/frontend `200`, exact full SHA `3d61730fd8ad18d19cf9967cb5513697659003cc`, `817` migrations and verified SQL marker. Real login succeeded. Browser mounted all five tabs; Realizacje showed the exact customer pilot and the repaired `/execution/w3-exe-case-v1` cold deep link opened `Execution Case ...@v1`. Independent API cold reads returned Initiative `v3`, Case `v1 ACTIVE`, work `0 tasks / 0 decisions`; SQL parity confirmed the accepted runtime-v1 trio, governed BVP `CLOSED v3`, budget reference and one Results receipt. Focused deep-link/runtime-spine regression `4/4 PASS`; Execution runtime-family guard `1/1 PASS`. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PARTIAL_DESKTOP_PL_CURRENT_REPLAY` | Current exact-SHA replay is linked above; the earlier local PL replay remains at `../../../../evidence/current-browser-replay/2026-08-23/execution/MANIFEST.md`. Current screenshots confirm three visible residuals: `Executing` is untranslated, Sterowanie still exposes the historical closure block above its register, and owner/approver are raw UUIDs. Tablet, EN, theme, keyboard/a11y, clean console/HTTP capture and owner visual judgment remain open. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 7. Owner decisions remain pending. |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `NOT_STARTED` | — |
| G12 | Owner register reconciled and confirmed | `NOT_STARTED` | — |
| G13 | Solution and impact analysis | `NOT_STARTED` | — |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `TECHNICAL_EXACT_SHA_PASS_WITH_OPEN_FINDINGS` | Exact-SHA `14da3e6d07578ca035daf62f1b7731cbb53dcfdb`; focused Initiative/Execution contract lane `11/11 PASS`; real auth; API/SQL identity parity; record-aware browser captures for Realizacje, Work, Resources, Control and Reports. Full product regression and all visual/methodological findings remain open. |
| G16 | Before/after owner retest packet | `CURRENT_AFTER_PACKET_READY / BEFORE_HISTORY_PRESERVED` | Six-screen packet linked above; historical owner screenshots remain in this register. Guided owner retest is still pending. |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| Confirm that a real initiative can be understood and governed from action/budget context through approved evidence to an immutable Results signal | `/execution/w3-exe-case-v1` (technical deep link verified; owner judgment pending) | Stable active OWNER/ADMIN/MEMBER plus distinct ADMIN approver; customer-pilot initiative, PLN 120,000 plan / PLN 40,000 actual, governed closed Case; revoked and foreign alternates | Open Case → inspect initiative/action/resource/control/report references → inspect budget → trace MEMBER-submitted evidence to distinct approval → inspect governed closed status → cold reopen → verify delivered Results lineage | Shared `cw-local`, production backfill/release, hidden actions, mobile and unsigned/bypass runtime | Is operational health clear? Is budget context actionable? Is CAS/conflict feedback understandable? Can the user trace who submitted and approved evidence and why Results received a signal? |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `EXE-TECH-01` | technical matrix | Handoff, BVP close, Results/Finance delivery, all governed actions, tenant/role/CAS/idempotency/rollback | Local real PostgreSQL; unique run-scoped identities; guarded immutable-ledger cleanup | SQL, mounted HTTP, independent pool and immutable receipts | allowed/denied matrix in G03 | `137/137 PASS`; core tested prefixes residue `0` |
| `EXE-OWNER-01` | owner-review fixture | Credible initiative/Case → action/budget → distinct evidence approval → governed close → Results lineage | Guarded disposable local provision/seed/readback/reset/drop; new wx/0600 manifest | FINAL marker/manifest, API/SQL parity and mounted cold deep link | OWNER/ADMIN allowed, MEMBER submits but cannot govern, distinct approver; revoked and foreign denied | `SEEDED_RETAINED / TECHNICAL_BROWSER_PASS / OWNER_GATE_PENDING` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `EXE-PF-001` | Root Vitest configuration replaces global `fetch` with a UI mock, so backend live-stack files invoked from the repository root falsely reported HTTP 200 on the unauthenticated probe. Running through `server/vitest.config.ts` restores native network I/O. | Root invocation stopped fail-closed; curl and native Node returned 401; correct server-config replay `39/39 PASS`. | `FIXED_INVOCATION_VERIFIED` |
| `EXE-PF-002` | The real-PG action registry test wrote an immutable audit but attempted to remove only its organization; every green run retained 11 audit rows and one organization. The guarded disposable-ledger helper now supports `execution_action_audit`, and the test removes its exact organization scope before deleting the organization. | Before fix: 22 rows across two runs; exact bounded cleanup performed; after fix `21/21 PASS`, new prefix residue `0`; commit `9ce72577f9`. | `FIXED_VERIFIED` |
| `EXE-PF-003` | The signed live test still called governed budget delete without the current required positive `expectedVersion` and `X-Idempotency-Key`, producing 400 before action governance. The test now exercises the current CAS/idempotent contract for success, role denial and forced-audit rollback. | Before reconciliation `35/39 PASS`, four failures all on budget action; corrected replay `39/39 PASS`; commit `9ce72577f9`. | `FIXED_VERIFIED` |
| `EXE-PF-004` | The historical live-stack harness intentionally retains append-only action audits and does not fully remove every run-created Case/project in its first file. This is durable evidence but prevents claiming whole-harness residue zero on a shared database. | Core prefixes `exe-bvp`, `exe-flow`, `res-flow`, `exe-actions`, `org_exe09` are zero; reusable `cw-local` fixture and historical live-stack audit rows remain separately identifiable. | `OPEN_NONBLOCKING_FIXTURE_HYGIENE` |
| `EXE-PF-005` | A technical integration replaced the established initiative-based Execution entry screen with a runtime-v1 `Execution Case` register. Owner review rejected that visible product model: an Execution Case may be an internal runtime container, but it is not the primary user-facing object. | Superseded by `EXE-OWN-002`; the primary list is restored from the same initiative identities used by Initiatives, with standard table, preview and initiative document navigation. | `SUPERSEDED_BY_OWNER_DECISION` |
| `EXE-PF-006` | The documented canonical Case deep link `/execution/:caseId` was not mounted and redirected a valid owner-review URL to Chat. | Added the protected Execution route and deterministic runtime-v1 Case selection/workbench hydration. Browser cold reopen remained on `/execution/w3-exe-case-v1` and displayed the exact Case at `v1`; focused contract `4/4 PASS`. | `FIXED_BROWSER_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `EXE-OWN-001` | 2026-08-23 | „nie ma ani menu, ani danych, nic nie mogę otworzyć, nic nie mogę przeanalizować” | Availability | `/execution` | Shell returned `Execution is unavailable` although the local server had `ENABLE_V8_GLOBAL=true`; the frontend did not mirror the backend's development-only implicit tenant fallback. | In LOCAL review, open the real Execution module without inventing a replacement product model or injecting synthetic operational records. Production remains fail-closed. | Blocks the complete owner review. | `Screenshot 2026-08-23 at 14.39.40.png`; SHA-256 `1cac51dd8e71df71c264d2cb5c1e166e483c35f6a5b061ec8fcded2d94ac4664` | `bcfb01483a36` | `P0` | `FIXED_LOCAL_REVIEW / OWNER_RETEST_REQUIRED` | uncommitted local review worktree | Local V8 gate hook has a development-only parity test; no synthetic Execution fixture remains. | `PENDING` |
| `EXE-OWN-002` | 2026-08-23 | „skoro przez ostatnie miesiące w zakładce Execution były po prostu karty inicjatyw, które są w statusie realizacji. To czemu teraz pokazujesz mi jakieś gówno?” / „To najlepiej wypierdol, żeby to się już nigdy tu nie pojawiało.” | Conceptual regression / primary entity | `/execution?tab=list&view=table` | The established initiative entry screen was made unreachable and replaced by a visible `Execution Case` register plus synthetic review records. | Execution starts from the same initiatives promoted into execution. The standard table, preview and full document operate on the initiative identity; an Execution Case may only support the initiative internally. | Replaced a familiar, previously working core flow with an alien abstraction and made owner review misleading. | Owner browser review, 2026-08-23 | `bcfb01483a36` | `P0` | `TECHNICAL_PASS / OWNER_RETEST_REQUIRED` | `673363f63c`, `45b91a507f` | Focused contracts `12/12 PASS`; exact-SHA browser replay on client `:3987` and server `:3986` at `45b91a507f` opened the full canonical Initiative document from the `IN_EXECUTION` Initiative while preserving the internal Execution Case only as correlation metadata. Retained fixture DB remained at 834 migrations. Owner retest remains required. | `PENDING` |
| `EXE-OWN-003` | 2026-08-23 | „podłączysz mi jakieś dane, żebym mógł coś tu pooglądać? Nad czymś popracować?” | Review data / owner workflow | `/execution?tab=list&view=table` | Restored initiative table was truthful but empty because the local source returned no initiatives in an Execution lifecycle state. | Local owner review reuses the deterministic Initiatives showcase dataset and filters it through the real Execution lifecycle rules; production uses only API data. | Without representative initiatives the owner cannot review preview, documents or subsequent Execution functions. | Owner browser review, 2026-08-23 | `bcfb01483a36` | `P0` | `FIXED_LOCAL / OWNER_RETEST_REQUIRED` | uncommitted local review worktree | Browser shows three initiative rows: Scheduled, Executing and Blocked; preview verified. | `PENDING` |
| `EXE-OWN-004` | 2026-08-23 | „zbudować jakieś przykładowe dokumenty w pracę, zasoby, sterowanie, raporty” | Review data / detailed Execution workflow | `/execution?tab=work|resources|control|reports` | The four detailed surfaces read the separate canonical `runtime-v1` Execution Case backend and therefore remained empty even when the primary initiative register had review rows. | Provide one coherent, deterministic DEV-only review package spanning work, milestones, allocations, management signals, governed interventions, report definitions and report runs. A real non-empty API response always wins; production and tests remain API-only and fail closed. | Enables owner review of all four workflows without promoting Execution Cases to primary user-facing objects or writing synthetic records into a database. | Owner request, 2026-08-23 | `bcfb01483a36` | `P0` | `TECHNICAL_EXACT_SHA_PASS / OWNER_RETEST_REQUIRED` | `14da3e6d07578ca035daf62f1b7731cbb53dcfdb` | Focused Initiative/Execution lane `11/11 PASS`; exact-SHA SQL/API readback and record-aware browser evidence prove tasks `2`, decisions `1`, allocations `2`, signal/intervention `1/1`, report definition/run `1/1`. | `PENDING` |
| `EXE-OWN-005` | 2026-08-23 | „lista powinna sprawiać, że otwierane jest narzędzie w oddzielnej karcie menu trzeciego, a nie gdzieś na dole” | Information architecture / work-item navigation | `/execution?tab=work&view=table` | The old implementation expanded the workspace below the register. The current local candidate now opens task/decision records through the shared dynamic-document mechanism. | Keep the register as a compact list. Selecting an item opens its dedicated work tool as a contextual tab in the third-level menu and displays the item workspace as the main screen. Closing or returning restores the list and its previous filters/selection/scroll state. | The corrected structure separates register browsing from governed work. Preservation of exact scroll/selection after return still requires focused verification. | Current screenshot `03-praca-document-menu3.jpg`, SHA-256 `625636f67ec05d925914592125366fd2ba86b8e5ecd64c462847b4cd828da968`; historical screenshots retained | `LOCAL @cc8848eb7d33`; integration worktree pending checkpoint | `P1` | `FIXED_LOCAL_BROWSER / OWNER_RETEST_REQUIRED` | pending checkpoint | Dynamic Menu 3 tab, full work document and Back to list verified in the current browser. Exact return-state and persistence checks remain open. | `PENDING` |
| `EXE-OWN-006` | 2026-08-23 | „powinien się otwierać raport, w którym powinniśmy mieć jakąś analizę (...) co się zbliża i co jest już dziś w backorder” | Work report / organizational control | `/execution?tab=work` | Work provides an operational register but no management report explaining current overdue commitments, future exposure, blocking decisions or strategic impact. | Open a dedicated third-level report tab with an organization-wide, auditable analysis of tasks and decisions: pain today, 7/14/30/90-day horizon, structural bottlenecks, affected objectives and prioritized interventions. | Without synthesis, management must manually interpret individual rows and cannot distinguish volume of activity from risk of non-delivery. | Owner request plus McKinsey-style and BSC skeptical reviews, 2026-08-23 | `bcfb01483a36` | `P0` | `OWNER_REQUIREMENT_CAPTURED / EXPERT_SPEC_COMPLETE / NOT_IMPLEMENTED` | — | Two independent expert specifications reconciled below; implementation and browser acceptance pending. | `PENDING` |
| `EXE-OWN-007` | 2026-08-23 | „Robimy raporty na dany tydzień (...) także prognozujemy przyszłość — wywołujemy ‘zrób raport’ (...) pobiera wszystkich ludzi będących w projektach i pokazuje ich poziom obciążenia oraz w jakich projektach pracują (...) wyłącznie te raporty bez żadnych dodatkowych wstawek między tabelami raportów a menu trzecim.” | Cross-module reporting architecture | `/execution?tab=work|resources|control|reports` | Four operational registers exist, but no coherent creator/lifecycle connects weekly historical state, forward forecast, people/project load, management control and immutable published reports. | Implement the four linked tasks `EXE-WORK-REPORT-01`, `EXE-RESOURCES-REPORT-01`, `EXE-CONTROL-REPORT-01` and `EXE-REPORT-GENERATOR-01`. Keep the Reports list visually clean; generated reports open as dynamic full-screen third-level tabs and freeze only on publication. | Without a shared model the four screens become disconnected tables, dynamic data can masquerade as history and management cannot compare what was forecast with what later happened. | Four owner screenshots at 15:56 plus independent workforce, program-control and report-operations expert reviews, 2026-08-23 | `bcfb01483a36` | `P0` | `OWNER_REQUIREMENT_CAPTURED / 4 IMPLEMENTATION TASKS SPECIFIED / NOT_IMPLEMENTED` | — | Expert specifications reconciled into the four tasks; implementation and browser acceptance pending. | `PENDING` |
| `EXE-OWN-008` | 2026-08-23 | „te taski muszą współpracować razem z tabelą realizacji, czyli lista inicjatyw, która się pojawia, jest zgodna z całą strukturą inicjatyw” | Cross-module identity / SSOT | Initiatives → Execution: Realizacje, Praca, Zasoby, Sterowanie, Raporty | The review implementation currently joins an initiative register to runtime-v1 detail families through separate read envelopes, which can drift into a second visible initiative model. | Initiatives is the canonical initiative registry. `Realizacje` is only its lifecycle-filtered projection. Work, resources, control and reports reference the same stable Initiative ID and accepted version, and every row/drill-down resolves to the same canonical Initiative Card. Internal Execution Case IDs may support processing but never replace, fork or rename the visible initiative identity. | Prevents duplicate registers, orphan tasks/reports, contradictory statuses and non-reconciling aggregates. | Owner clarification, 2026-08-23 | `bcfb01483a36` | `P0` | `TECHNICAL_IDENTITY_AND_PROJECTION_PASS / OWNER_RETEST_REQUIRED` | `4cd0ce6589`, `673363f63c`, `45b91a507f`, `14da3e6d07578ca035daf62f1b7731cbb53dcfdb` | Exact-SHA API/SQL/browser replay proved one Initiative ID linked to one active Execution Case and populated all five Execution surfaces from that governed fixture. No claim is made yet for every drill-down, version conflict or owner acceptance. | `PENDING` |

### Cross-module initiative identity invariant

All four Execution workstreams and the `Realizacje` table operate on one canonical initiative graph:

1. `Initiatives.initiative_id` is the stable business identity; title, lifecycle, owner, gates and card structure come from the canonical Initiative read model.
2. `Realizacje` is a filtered projection of that register for the configured execution lifecycle statuses, not a separately created list.
3. Tasks, decisions, milestones, assignments, signals, interventions and reports carry `initiative_id` plus the source version/snapshot they were calculated from. Runtime case identifiers are internal correlation keys only.
4. Table, preview, Kanban, timeline, Work, Resources, Control and Reports must reconcile to the same initiative population and status taxonomy for the same `as-of` instant.
5. Every drill-down opens the canonical Initiative Card or the exact governed child record and can return to the originating filtered view without losing state.
6. A missing, foreign, stale or version-conflicting initiative fails closed and is shown explicitly; it may not be replaced by a synthetic duplicate.
7. Review fixtures may be deterministic and synthetic, but must share the same Initiative IDs across Initiatives, Execution and Results and must never override a non-empty real API response.

### EXE-OWN-006 — Work report product contract

**Management question.** Which organizational commitments are already unmet, which are likely to become unmet, what decisions or dependencies cause the exposure, and which business objectives require intervention now?

**Deterministic time buckets.** `OVERDUE`, `DUE_TODAY`, `1–7 DAYS`, `8–14 DAYS`, `15–30 DAYS`, `31–90 DAYS`, `>90 DAYS`, and `NO_DUE_DATE`. The overdue aging view additionally separates `1–3`, `4–7`, `8–14`, `15–30`, and `>30` days. An item without a due date is a data-risk item, never green and never silently counted as formally overdue.

**Top-level screen.** The report opens as a dedicated third-level menu tab and uses the full work surface. It contains: (1) scope, state date, last synchronization, active filters and data completeness; (2) an executive pulse of no more than eight reconcilable KPI cards; (3) a commitment horizon showing tasks and decisions separately; (4) a BSC objective-risk matrix; (5) bottlenecks and blocking chains; (6) a 12-week inflow/throughput/backorder trend; (7) three to five evidence-backed interventions; and (8) an auditable detailed register.

**Core KPI contract.** Show overdue tasks, overdue decisions, impact-weighted backorder, at-risk commitments within seven days, active blocks and blocked days, median/P90 decision latency, throughput-to-inflow ratio, and data completeness. Every KPI exposes current value, numerator/denominator, comparison with the previous equivalent period, calculation timestamp and an exact drill-down set.

**Strategic/BSC view.** Map commitments directly or through milestones to Financial, Customer/Market, Internal Process, and People/Capability objectives, with a separate Governance/data-quality layer. Objective risk is weighted by business impact and dependency criticality, not by raw task count. Until credible objective mappings exist, label the view as an operational backlog report rather than a BSC strategy report.

**Risk evidence.** Risk classifications must cite deterministic signals such as overdue due date/SLA, active block, overdue dependency, absent owner, missing evidence/DoD, repeated rescheduling or confirmed capacity conflict. `UNKNOWN` is never zero. Facts, model estimates and recommendations are visually and semantically separated as `FACT`, `INFERENCE`, and `RECOMMENDATION`.

**Drill-down.** `KPI → objective/perspective → initiative/team → owner → task/decision → dependencies and evidence`. Any task or decision opens its own third-level tool tab under `EXE-OWN-005`; returning restores report filters, comparison period and scroll position. The report itself does not bypass governed task or decision operations.

**AI analysis.** AI may explain period changes, detect recurring root causes, forecast delay risk, group symptoms, simulate a decision delay and propose prioritized interventions. Every proposal includes sources, assumptions, missing data, confidence, predicted effect and decision owner. AI cannot autonomously change status, owner, due date, priority or make a decision.

**Acceptance gates.** KPI totals reconcile exactly to drill-down records; formulas, timezone and denominators are visible; tasks and decisions remain distinct but share dependency analysis; original due-date history is preserved; permissions do not leak inaccessible records; each alert has cause, owner and expected action; the report is reproducible for a historical state date.

### Implementation task — EXE-WORK-REPORT-01

**Title:** Build the trendsetting organizational Work Intelligence Report for tasks and decisions

**Objective:** Turn the Work register into a management intelligence surface that tells leadership what hurts today, what will become a problem next, why it is happening, which objectives are exposed and which controlled intervention produces the highest expected benefit. The result must optimize organizational attention rather than celebrate activity volume.

**User outcome:** A leader opens `Execution → Praca → Raport pracy` and, within two interactions, can identify the most important unmet or threatened commitment, understand its causal chain and open the governed task or decision tool required to act.

**Navigation and state**

1. Add `Raport pracy` as a contextual third-level menu tab under `Praca`.
2. Open the report on the full work surface; never append it below the register.
3. Preserve organizational scope, date range, filters, comparison period and scroll position when drilling down or returning.
4. Open an individual task or decision in its own third-level tool tab according to `EXE-OWN-005`.
5. Make report state shareable and reproducible through a stable URL/query contract without exposing unauthorized filters or records.

**Screen composition — management narrative order**

1. **Context and trust bar:** state date, timezone, last synchronization, organizational scope, active filters, comparison period, source freshness and data-completeness score.
2. **Executive Pulse:** maximum eight KPI cards with current value, numerator/denominator, delta, direction, severity and exact drill-down.
3. **What hurts today:** overdue tasks, overdue decisions, breached SLA, due-today commitments, active blockers and critical missing data, ranked by business exposure.
4. **What is approaching:** an interactive horizon for `1–7`, `8–14`, `15–30`, `31–90`, `>90 DAYS` and `NO DUE DATE`, separating tasks, decisions and milestones while showing risk concentration.
5. **What is at stake:** BSC/objective-risk matrix for Financial, Customer/Market, Internal Process, People/Capability and Governance perspectives. Where objective linkage is incomplete, explicitly label the output as operational rather than strategic.
6. **Why it is happening:** causal view of blocking decisions, overdue dependencies, repeated rescheduling, capacity conflicts, missing owners/evidence and downstream affected commitments. Deduplicate one root cause with many effects.
7. **How the system is changing:** 12-week trend for inflow, throughput, net backorder change, aging, blocked days and decision latency, with comparable-period baselines.
8. **What management should do:** three to five prioritized interventions with evidence, expected unlocked flow, affected objectives, decision owner, reversibility, confidence and missing information.
9. **Auditable register:** exact records behind the analysis, using the same filters and deterministic formulas as every preceding section.

**Canonical calculations**

- `formalBackorder`: open item with due date earlier than the state date.
- `slaBackorder`: open item whose applicable response/decision SLA is breached.
- `undatedRisk`: open item without a due date; never counted as green or silently added to formal backorder.
- `agingDays`: state date minus applicable due/SLA date.
- `decisionLatency`: decision outcome timestamp minus request timestamp.
- `blockedDays`: accumulated time in blocked state, not merely current age.
- `throughputRatio`: completed items divided by newly created items in the comparable period.
- `netBackorderChange`: newly overdue minus overdue items resolved in the period.
- `impactWeightedBackorder`: overdue age × explicit impact weight × dependency criticality; never label as money without a verified financial exposure.
- `dataCompleteness`: proportion of applicable records with owner, due date, SLA, objective/milestone link, dependency state, DoD and required evidence.

All formulas, denominators, timezone rules and inclusion/exclusion criteria must be visible from the interface and versioned. `UNKNOWN`, `NOT_APPLICABLE` and numerical zero are separate states.

**Interaction and drill-down**

- Every KPI, chart segment, objective cell, alert and intervention opens its exact contributing record set.
- Drill-down path: `KPI → objective/perspective → initiative/team → owner → task/decision → dependencies/evidence`.
- The user can pivot the same population by type, status, initiative, milestone, owner, team, objective, impact, aging, blocker, SLA, evidence state and data quality.
- Report views are read/analysis surfaces. Governed mutations occur only inside the source task or decision tool and require the existing authorization/version/idempotency contract.

**AI Work Intelligence contract**

- Explain material change versus the comparison period.
- Identify repeated systemic causes and concentration risk.
- Forecast delay risk with a stated method, confidence and missing inputs.
- Simulate the downstream effect of delaying a decision or dependency.
- Rank interventions by impact, urgency, reversibility and flow unlocked.
- Produce a proposal, never an automatic mutation.
- Label every statement as `FACT`, `INFERENCE` or `RECOMMENDATION` and provide source records, assumptions, confidence, expected effect and accountable decision owner.

**Required delivery slices**

1. Versioned metric dictionary and query/read-model contract.
2. Permission-safe aggregated backend endpoint plus deterministic historical state-date reconstruction.
3. Full-screen third-level report route and preserved-navigation state.
4. Executive Pulse and exact KPI drill-down.
5. Horizon, aging and 12-week trend views.
6. Objective/BSC exposure and causal/blocking-chain views.
7. AI analysis proposal with citations and human accept/reject workflow.
8. Auditable detailed register, export and saved/shared report views.
9. Contract, permission, reconciliation, timezone, accessibility and browser tests.

**Definition of Done**

- Every displayed aggregate reconciles exactly with its drill-down population.
- Historical report replay returns the same result for the same versioned state date and scope.
- No inaccessible record contributes to either a number, label, AI explanation or exported artifact.
- Tasks and decisions are distinct types but participate in one dependency graph.
- The report exposes stale sources and missing data instead of fabricating certainty.
- A single root cause is not inflated into multiple independent alerts.
- AI cannot change owners, dates, priorities, statuses or decisions.
- Keyboard navigation, focus order, screen-reader labels, empty/loading/error states and responsive layout meet the shared application standard.
- Owner can move from organizational diagnosis to the accountable task or decision in at most two interactions.
- Owner browser acceptance is recorded separately; technical completion must not be promoted to owner acceptance.

**Out of scope for this task:** autonomous work reassignment, autonomous decision-making, silent deadline changes, financial-value claims without verified exposure, replacement of the canonical task/decision tools, and production seeding of synthetic organizational records.

### Implementation task — EXE-RESOURCES-REPORT-01

**Title:** Build the weekly and forward-looking People Capacity Intelligence report

**Objective:** For a selected base week and 4/8/12/26-week horizon, show every person assigned to the selected projects, their availability, assignments, projects, required effort, saturation range, conflicts, free capacity, missing roles/skills and explicit data uncertainty. This is decision support, not time tracking and not minute-precision theatre.

**Workflow:** `Nowa analiza → context/scope → source freshness → missing-data validation → deterministic calculation → human review/comments → Analyze AI → approve/publish immutable version`. Inputs include calendar/timezone, organization, project statuses, teams, people and aggregation by person/team/project/role. Missing availability, estimates or dates remain `UNKNOWN`; a user may provide an auditable assumption, accept a labelled estimate, exclude a record with justification or leave it unknown.

**Report layout:** trust/context bar; management KPI summary; person-by-week load heatmap; People view showing role, skills, availability, assigned effort, saturation range and projects; Project view showing required roles, assigned people, demand, coverage and schedule impact; dedicated conflict/missing-role/missing-skill/unassigned-work/free-capacity registers; AI recommendations; assumptions, provenance and audit.

**Canonical measures:** available capacity after absence, fixed duties, accepted reservations and explicit operating buffer; project/task demand as sourced value, range, configured size class, labelled forecast or `UNKNOWN`; saturation as a range (`demand / capacity`) with configurable thresholds; active projects per person, allocation concentration, unassigned-work share, role/skill coverage, conflict count, consecutive overload weeks, data freshness and confidence. Aggregation must never hide low-confidence inputs.

**AI boundary:** AI may propose rebalancing, delegation, sequencing, missing-data completion and scenario variants. Accepting a proposal creates a governed change proposal for Praca/Sterowanie; it never mutates an assignment, person, project or due date directly.

**DoD:** all in-scope assigned people are present, including people with no task in the base week; person↔project drill-down reconciles; facts/forecasts/assumptions/unknowns are distinct; load calculations are deterministic and tested; every result exposes confidence and lineage; multiple variants/versions can be compared; approved versions are immutable; permission, snapshot, missing-data, contract and owner-browser gates pass separately.

### Implementation task — EXE-CONTROL-REPORT-01

**Title:** Build the weekly Management Control Loop and forward risk report

**Objective:** Replace the loose signal/intervention table with an auditable control loop for a selected week and 2/4/8/12-week horizon: `signal → qualification → analysis → human decision → intervention → execution task → outcome verification → resolve/escalate/reopen`.

**Scope boundaries:** Praca remains the execution source for tasks, milestones, dependencies and results; Zasoby remains the source for capacity, allocations and skills; Sterowanie interprets cross-domain impact and governs decisions/interventions; Raporty stores published snapshots. Sterowanie must not duplicate task execution or resource calendars.

**Report layout:** week/scope/trust bar; plan-delivery, blocked-work, milestone, initiative-risk, dependency, capacity, decision-latency and intervention-effectiveness KPIs; a unified signal/problem register; causal and downstream-impact view; pending/overdue decisions; intervention portfolio with baseline, target and verification deadline; forward scenarios (base/optimistic/pessimistic); executive summary and evidence annex.

**Epistemic contract:** every statement is `FACT`, `INFERENCE` or `RECOMMENDATION`. Facts cite versioned source and capture time. Inferences cite facts, logic and confidence. Recommendations show expected impact, cost/capacity, side effects and responsible decision owner. `UNKNOWN`, `NOT_VERIFIED`, `INSUFFICIENT_DATA`, `OWNER_MISSING` and `DECISION_REQUIRED` are explicit states.

**Governed workflow:** qualification sets category, severity, affected scope, analysis owner and reaction SLA; dismissal requires rationale. AI groups signals, proposes causes/scenarios/options and missing evidence but cannot decide, accept risk, mutate plans or publish. A human decision records decider, rationale, selected/rejected options, accepted risk, expected result and verification date. Closing without success criteria and evidence is blocked or explicitly `NOT_VERIFIED`; ineffective interventions can reopen the problem.

**DoD:** complete bidirectional lineage exists from aggregate through source signal, decision, intervention, work item and verification; each KPI reconciles; AI executions are versioned with sources/model/assumptions; mutations are authorized, versioned, idempotent and audited; published weekly control reports remain immutable; incomplete-data, forecast, permission, lifecycle and end-to-end control-loop tests pass; owner acceptance remains independent.

### Implementation task — EXE-REPORT-GENERATOR-01

**Title:** Build the unified `Zrób raport` generator and versioned Execution report center

**Objective:** Generate a professional weekly report that combines Praca, Zasoby and Sterowanie, describes historical state at an explicit `as-of` timestamp and separately forecasts a selected future horizon. Before publication it is a dynamically refreshable draft; publication atomically freezes content, sources, calculations, assumptions and the forecast known at that moment.

**List-screen contract:** `Execution → Raporty` contains only the third-level menu, `Zrób raport`, table-related filters and the report table. No KPI cards, banners, dashboards, forms or decorative sections may appear between the menu and table. Opening or generating a report creates a closable, full-screen dynamic third-level tab; multiple reports may be open and restored after refresh when authorization remains valid.

**Generator:** (1) type/name/purpose/owner/audience/language/base version; (2) historical period, separate `as-of`, reporting week, forecast horizon, calendar/timezone; (3) organization/projects/initiatives/statuses/teams/people/roles and justified exclusions; (4) selected Work/People/Control/Forecast/AI/data-annex sections; (5) deterministic thresholds, baseline, RAG, progress, missing-data and forecast assumptions; (6) pre-generation validation of freshness, assignments, availability, estimates, ownership, dates, risks and baseline; (7) section-by-section generation with resumable partial failure and automatic opening of the report tab.

**Report types:** Weekly Execution Pack, Work/Delivery, Resources/Capacity, Management Control and Portfolio/Multi-project. The architecture shares lifecycle, versioning, authorization, provenance, comparison and export so new report types do not require a parallel system.

**Lifecycle:** `GENERATING → DRAFT_DYNAMIC → READY_TO_REVIEW → IN_REVIEW → READY_TO_PUBLISH → PUBLISHED_SNAPSHOT → SUPERSEDED/ARCHIVED`, with explicit `INCOMPLETE` and `FAILED`. A rendered screen is not evidence of readiness. Draft refresh shows source changes, preserves human comments and requires confirmation before replacing edited generated text. A published snapshot is immutable; correction creates a new lineage-linked version.

**Full report layout:** summary; Praca; Zasoby (person→projects, project→people, weekly capacity, skills); Sterowanie; Forecast; Recommendations; Data/Methodology; Version history/Audit. Historical fact and forward forecast are visually and semantically distinct. Every number drills down to source identity/version, capture time, transformation and value class (`SOURCE`, `CALCULATED`, `MANUAL`, `AI`, `UNKNOWN`).

**AI and calculation boundary:** load, aggregation and RAG calculations are deterministic. AI may explain changes, anomalies, risks, scenarios and recommendations, but must expose execution ID/model/prompt version, sources, assumptions and confidence. It cannot hide missing data, mutate sources, silently overwrite human text or publish.

**Publication/export/security:** publication is atomic and freezes the source snapshot, report definition, generator/model versions, manual corrections, warnings and integrity identifier. Support reproducible PDF and XLSX (optional PPTX summary and scoped CSV), clearly marking dynamic drafts. Viewer/Creator/Editor/Reviewer/Publisher/Admin capabilities are enforced at organization/project/person/section/export level; reports never expand source-data access and all refresh, scope, status, publication and export operations are audited.

**DoD:** list-screen cleanliness is visually verified; creator separates history/as-of/forecast; all project-assigned people and their weekly load/projects appear; several reports can open concurrently; draft refresh and diff are safe; snapshot immutability and atomic publication are proven; forecast-vs-later-actual and version comparisons work; every number has provenance; missing/partial sources and AI/export failures remain truthful; permission and redaction tests prevent leakage; lifecycle transition tests, refresh-state restoration, exports and owner browser acceptance pass independently.

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| `EXE-OWN-001`, `EXE-OWN-002` | Frontend V8 gate disagreed with backend local fallback; later technical integration promoted an internal Execution Case abstraction to the primary UI and review fixtures hid missing initiative data. | Keep the local-only gate parity fix; remove synthetic Execution fixtures; restore the initiative register as the primary Execution surface and keep runtime cases internal. | uncommitted local review worktree | Initiative register, Execution list/table/Kanban/timeline/document | Execution | Focused contracts + typecheck + browser owner route | Owner retest pending |
| `EXE-OWN-003`, `EXE-OWN-004` | The initiative register and the four runtime-v1 detail families have different backend contracts; the local review environment had no governed handoff-generated Execution Cases. | Keep the real backend contract intact and add deterministic DEV-only read envelopes for owner review. Never activate them in tests/production and never override a non-empty API response. | uncommitted local review worktree | Initiative review rows; Work, Resources, Control and Reports surfaces | Execution | Typecheck PASS; focused Execution contracts `20/20 PASS`; browser owner retest pending | Production/test fail-closed contract retained |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `EXE-PF-002` | Immutable action audits were outside the common guarded cleanup helper. | Add the audit ledger/trigger to guarded cleanup and remove exact test-org rows before parent teardown. | `9ce72577f9` | `21/21 PASS`; subsequent `exe-actions-*` residue `0`; typecheck PASS |
| `EXE-PF-003` | Live test contract lagged behind governed CAS/idempotent budget delete. | Supply positive expected version and an explicit idempotency key in success, denial and rollback paths. | `9ce72577f9` | server-config live stack `2/2` files, `39/39 PASS` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
