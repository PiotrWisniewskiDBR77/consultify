# Consultify Ideas — epics, Definition of Done and final acceptance protocol

Status: **NORMATIVE EXECUTION AND ACCEPTANCE CONTRACT**
Parent program: `09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md`
Detailed remediation: `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md`

## 1. Completion statement

The assignment is complete only when the exact candidate implements every applicable epic below, passes every mandatory DoD category, reproduces the full functional and visual acceptance matrix, stores the evidence package, and is handed to Codex for independent review with no known P0/P1 and no silently omitted P2/P3.

Claude owns implementation and first-party verification. Codex is the independent acceptance owner. `READY_FOR_CODEX_REVIEW` means candidate handoff, never `ACCEPTED`.

## 2. Documentation map and precedence

Claude must create a source/decision register before coding.

| Decision area | Primary authority | Supporting evidence |
|---|---|---|
| Idea model and Z1–Z4 | `docs/standards/idea-workspace/01_MODEL_I_ZASADY.md` | chapters 02–12 |
| current panel/rail/navigation geometry | chapter 13 | chapter 03 only for non-conflicting layer behavior |
| actions and placement | chapters 02, 04–08 and chapter 14 | 131-row manual inventory |
| AI and Teresa | chapter 09 | reports 01–04, master program §8 |
| conversion/import/export/templates | chapter 10 | master program §§9–10 |
| tool behavior | chapter 11 | manual reports 01–04 |
| priorities | chapter 12 | plan 08 |
| global UI authority | `docs/ui-standards/CANON.md` | `UI_UX_IMPLEMENTATION_STANDARD.md` |
| numeric tokens | `00-foundation/FOUNDATION_TOKEN_CONTRACT.md` | bound code SSOT |
| color and light mode | `color-system.md`, `light-mode-readability.md` | contrast plus runtime screenshots |
| visual language and motion | `visual-language.md` | motion lint and visual QA |
| icons/actions | `ICONOGRAPHY_AND_ACTION_STANDARD.md` | Action Registry |
| PL/EN and microcopy | `CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md` | locale/pseudo-locale matrix |
| canvas extension | `canvas-mode.md` | tool standards; never replaces DBR77 |
| Table | `TABLE_AND_PREVIEW_CANON.md`, `DOKTRYNA_TABELA_NIE_EXCEL.md` | P15 runtime |
| evidence packet | `CONSULTIFY_ATOMIC_ACCEPTANCE_PACKET_TEMPLATE_2026-08-04.md` | master program §16 |

Conflict procedure: record both requirements, apply the hierarchy in `CANON.md` and the newer Idea owner decision, verify code SSOT where required, never invent a third variant, and escalate only a genuinely unresolved owner choice. Archive files and unaccepted screenshots are context, not authority.

## 3. Universal Definition of Done

Every requirement is Done only when every applicable category passes.

### 3.1 Contract

- stable requirement ID, priority, source and owner surface;
- mapping requirement → task → code → route/API → test → runtime evidence;
- scope, permission, mutation, confirmation, terminal state and recovery declared;
- no conflict with Z1–Z4/current geometry;
- changed and intentionally unchanged behavior explicit.

### 3.2 Code

- mounted in the real consumer and reachable from the intended route;
- no placeholder, dead dispatch, fake success, swallowed error or duplicate path;
- shared behavior uses shared primitives/registry;
- no new legacy/P15 fork;
- migrations forward-safe and tested against existing records;
- unrelated working-tree changes preserved.

### 3.3 Functional

- primary path works from a clean record;
- pointer, keyboard and PPM call the same action contract;
- enabled, disabled-with-reason, loading, success, validation, transport, permission and offline states are honest;
- undo/redo or restore works where promised;
- rapid input does not duplicate work;
- semantics are tool-correct, not generic/mislabelled.

### 3.4 Data and persistence

- save/retry/conflict state observable;
- server/database readback confirmed;
- refresh, leave/reopen and cold reopen retain result;
- representation switching neither mutates nor duplicates content;
- histories append rather than overwrite;
- stale/recompute behavior verified;
- personal view state remains local, shared content remains shared.

### 3.5 Business and financial

- recognizable business outcome and correct maturity semantics;
- facts, assumptions, evidence gaps, alternatives, risks, owners, KPIs and decisions distinct;
- scoring inputs/weights/overrides transparent;
- downstream artifacts contain meaningful mapped content and backlinks;
- currency, scale, unit, source, period and formula version explicit;
- cash, capacity, avoided risk and qualitative value not conflated;
- Base/Upside/Downside vary drivers;
- ROI/NPV/payback/BCR/sensitivity reconcile independently;
- missing/stale/invalid inputs block misleading approval.

### 3.6 Visual

- approved components composed; no parallel feature-level design system;
- numeric values and semantic colors use canonical tokens/code SSOT;
- light/dark hierarchy and contrast equivalent;
- focus uses focus token, primary CTA uses navy; crimson only per canon;
- Menu 1/Menu 3/panel/rail/bottom controls match current geometry;
- no overlap, clipping, hidden primary action, icon wall or unexplained duplicate;
- typography, density, spacing, borders, radii, elevation and motion match the component family;
- shared surfaces look identical across tools; tool graphics express real semantics;
- evidence comes from real exact-SHA runtime.

### 3.7 Customer experience

- first-time user knows how to start, what is selected/affected and whether work is saved;
- labels use business language;
- consequential actions preview impact and provide recovery;
- empty states lead to meaningful first result;
- no silent operation, surprise mutation, context fallback or Convert/Export ambiguity;
- durable progress/result/error reduces uncertainty;
- scenes are possible, natural and efficient without hidden gestures;
- coaching is contextual/dismissible, not permanent clutter.

### 3.8 Accessibility, locale, tests and evidence

- accessible name, role, state, focus order and visible focus;
- Enter/Space/arrows/Escape per component contract; core work without raw-coordinate drag;
- contrast, non-color cues, reduced motion and 200% reflow pass;
- PL/EN, pseudo-locale, long labels, plural 0/1/2/5, dates/numbers/currency/units pass;
- 403/409/422/timeout/offline copy is actionable;
- focused tests fail on old behavior and pass on new;
- integration/contract/persistence tests cover boundaries;
- root and relevant server checks reported honestly;
- evidence is indexed; absence remains `NOT VERIFIED`.

## 4. Epics and epic-level DoD

### E00 — Candidate control and ledger

Scope: exact HEAD/branch/dirty state, ownership, runtime/backend/database/session, version badge, requirement/decision/evidence ledgers and baseline four-scene readback.

DoD: candidate reproducible; unrelated edits untouched; every requirement ledgered; baseline routes, screenshots and readback stored.

### E01 — One Idea data model and integrity

Scope: shared IDs/typed extensions, local view preferences, save/conflict/offline/history/restore, duplication prevention, canonical P0 scenarios.

DoD: no duplication through representation cycle; two users can hold different views; shared edit appears once; partial conversion does not promote whole Idea; destructive import has preview, confirm, pre-change snapshot and restore.

### E02 — Action Registry

Scope: stable command IDs, scopes, availability, permissions, handlers, toolbar/rail/inspector/PPM/keyboard/Teresa parity, terminal states, removal of cross-tool handler leakage.

DoD: every visible action has one registry entry and real handler/disabled reason; intentional duplicates share implementation and distinct context; no PPM-only secret capability; machine check detects unregistered commands.

### E03 — Shell, navigation and ownership

Scope: Menu 1, Menu 3, current information panel, movable rail, selection bar, PPM, bottom controls and route/tab/representation synchronization.

DoD: current geometry; List/deep links survive refresh; URL/tab/tool agree; actions live at correct scope; supported sizes/zoom hide no essential control.

### E04 — Mind Map

Scope: master program §5.1 and plan 08.

DoD: original 18+ node scene builds; 20 mixed rapid sibling operations never create two editors; two cross-links, comments/evidence and AI proposal persist; first-level PPM fits 1280×800 without dead/duplicate action.

### E05 — Whiteboard

Scope: §5.2 and plan 08.

DoD: 12 mixed inserts have no complete overlap; immediate naming; three clusters/four links/freehand/group/lock/layer persist; workshop state honest; default labels trigger AI coaching; connector PPM and real object copy/paste work.

### E06 — Process Flow

Scope: §5.3 and plan 08.

DoD: complaint scene with lanes/Yes-No/correction loop persists; one creation path; immediate lane naming; editable/deletable edges; initial `Not validated`; Fit works from 25–300%; Insert/Split availability is context-correct.

### E07 — Table P15

Scope: §5.4 and plan 08.

DoD: 11-row portfolio/schema persists; field wizard meets interaction budget; row/cell/header PPM works; saved views preserve contracts; AI supported/unsupported/error/cancel durable; CSV append/update/replace and recovery pass; no canvas metaphors/legacy dual path.

### E08 — Business case and decision governance

Scope: maturity, evidence/assumptions, alternatives, benefits/risks/dependencies/KPIs, transparent scoring, readiness and decision outcomes.

DoD: stage gates enforce completeness; decision summary traces material claims; score exposes weights/override reasons; Approve/Reject/Return/Defer persist distinctly; reopened decisions version rather than overwrite.

### E09 — Financial case

Scope: typed drivers/scenarios/cash flows/ROI/NPV/payback/BCR/sensitivity, units, stale/recompute and Finance lineage.

DoD: at least three cost and three benefit drivers; benefit types separated; calculations reconcile; provenance visible; invalid/stale state blocks approval; compute→save→reopen→mutate→stale→recompute→convert/readback passes or named downstream blocker is honest.

### E10 — AI and Teresa

Scope: proposal-first mutations, grounding, shared scopes, accept/reject/apply/history/undo and Teresa registry parity.

DoD: no silent AI mutation; visible and actual scope match; unsupported claims marked; every request terminates in proposal/result/error/cancel; Teresa uses same action ID and confirmation/audit rules.

### E11 — Conversion, import, export and templates

Scope: one conversion pipeline, explicit source scope, append-only lineage/backlinks, file-only Export and safe imports/templates.

DoD: Initiative/Tasks/Decision/Report/Presentation contain meaningful data/backlinks; Finance target status consistent; repeated conversions coexist; exports are real/openable files; import recovery passes; ambiguous labels/dead conversion code removed.

### E12 — Collaboration, security and resilience

Scope: presence/comments/workshop roles, tenant/role authorization, concurrent edits/reconnect/conflict, confidential AI/export/telemetry and offline/retry.

DoD: unauthorized server operations rejected; UI reflects role; reconnect duplicates nothing; confidential content respects policy; failures visible/recoverable.

### E13 — Visual system and CX

Scope: canonical components/tokens, hierarchy/density/responsiveness, states, tool semantics, financial visualization, PL/EN and first-use guidance.

DoD: Visual/CX DoD passes every tool; no one-off component where approved family exists; light/dark and grayscale remain legible; first-use runs need no undocumented gesture; adjacent My Work shell stays consistent.

### E14 — Accessibility, locale, performance and observability

Scope: a11y/reflow, localization, large fixtures, SLOs and content-safe telemetry.

DoD: zero serious/critical a11y issue; core scenes keyboard-capable; 200% functional; pseudo-locale/error matrix passes; actual p50/p95 recorded; no sensitive canvas content in analytics.

### E15 — Final regression and evidence closure

Scope: full automation/manual rerun, two clean rounds, exact-SHA evidence, final package and Codex handoff.

DoD: two consecutive full rounds introduce no P0/P1; P2/P3 all implemented or explicitly owner-accepted as named limitation; every epic has evidence; final report separates facts/observations/conclusions/recommendations.

## 5. Traceability ledger

`02_EXECUTION_LEDGER.csv` columns:

`requirement_id,epic_id,priority,source_doc,source_section,business_outcome,surface,action_id,baseline_state,implementation_state,files_changed,route_or_api,automated_tests,runtime_test,persistence_readback,visual_evidence,accessibility_locale,candidate_sha,final_state,blocker_or_risk`

Allowed final states: `REPAIRED_RETESTED`, `VERIFIED_NO_CHANGE`, `NOT_VERIFIED`, `BLOCKED_EXTERNAL`, `REJECTED`. Implementation difficulty is not an external blocker.

## 6. Functional and visual acceptance matrix

### Per tool

- Pass A: every visible toolbar, rail, panel, Menu 1/Menu 3, PPM and keyboard action;
- Pass B: rebuild the original full business scene from zero;
- save, server readback, refresh, leave/reopen and cold reopen;
- disabled, loading, validation, transport, permission, conflict and offline states;
- empty, selection, AI proposal/error/applied, destructive confirm and persistence feedback;
- 1280×800, 1440×900, 1920×1080;
- light/dark; PL/EN/pseudo-locale;
- 100%, canonical 125% regression and 200% reflow;
- canvas min/normal/high internal zoom where applicable.

### Visual review questions

1. Is the application immediately recognizable as Consultify?
2. Are Idea, representation, maturity and save state obvious?
3. Is there one clear primary action?
4. Are document/view/selection scopes clear?
5. Are rail/toolbars compact, owned and non-overlapping?
6. Do light/dark preserve hierarchy/contrast?
7. Are focus/selection/status/warning/danger distinct without color alone?
8. Are typography/spacing/radius/border/elevation/motion canonical?
9. Does each tool visually express its business semantics?
10. Is every result/error durable enough to inspect?
11. Does 200% retain primary functionality?
12. Does it reuse accepted adjacent components instead of local invention?

### Hard visual FAIL

- unreadable light mode or arbitrary non-token color;
- crimson focus or noncanonical primary CTA;
- clipped/covered essential control or overlapping new objects;
- icon wall or unexplained duplicate;
- icon-only control without name/tooltip;
- fake enabled action/success;
- status only by color;
- canvas styling on operational Table input;
- mock/mismatched-SHA screenshot claimed as runtime acceptance.

## 7. Customer-experience simulations

- **CX-01 Exploration:** new Idea → three-level Mind Map → evidence → reject/accept AI proposal → reopen.
- **CX-02 Workshop:** 12 Whiteboard items → name/cluster/vote/connect/draw/group/tidy → promote decision/action → reopen.
- **CX-03 Operations:** complaint Process Flow → lanes/decisions/exceptions/loop → duration/cost → validation/bottleneck.
- **CX-04 Portfolio:** 11-row Table → schema/views/scoring/decision log → supported/unsupported AI → export/reopen.
- **CX-05 Finance:** costs/benefits/scenarios → ROI/NPV/payback/sensitivity → mutate/recompute → approve/convert.
- **CX-06 Executive handoff:** Spark→Ready → decision summary/approval → Initiative/Tasks/Decision/Report/Presentation → backlinks/readback.

Record clicks, time, confusion, undo, help usage and success. Compare with original audit friction. A new critical ambiguity is a regression even if technically clickable.

## 8. Final test sequence

1. freeze SHA and restart exact runtime;
2. migrations/data integrity;
3. focused unit/component tests;
4. API/contract/integration tests;
5. root and server checks;
6. four Pass A inventories;
7. four Pass B scenes;
8. business and financial cases;
9. conversion/readback;
10. permissions/offline/reconnect/conflict;
11. accessibility/locale/performance;
12. visual matrix and CX simulations;
13. cold reopen all acceptance records;
14. evidence-link/CSV/schema validation;
15. adversarial round one and repairs;
16. repeat critical matrix as round two;
17. hand off only after two consecutive rounds add no P0/P1.

Any code change invalidates affected downstream evidence; create a new candidate identity and rerun affected gates.

## 9. Handoff to Codex

Claude's `17_FINAL_ACCEPTANCE.md` and final message must start with:

- candidate SHA, branch/worktree, runtime URLs and badge;
- baseline and exact changed-file scope;
- E00–E15 closure table;
- P0/P1/P2/P3 totals and states;
- four scenes, business case, financial case and golden journey results;
- automated/type-check/migration/performance/a11y results;
- visual/CX matrix result;
- unresolved risks/external blockers;
- evidence and ledger paths;
- recommendation `READY_FOR_CODEX_REVIEW` or `NOT_READY`.

No claim without evidence. Distinguish code existence, mounted consumer, runtime execution and persisted readback. List every `NOT VERIFIED`. Codex independently samples code, tests, runtime, persistence and visuals; Claude self-attestation never grants `ACCEPTED`.

## 10. Terminal rule

Claude does not stop because the task is large, context is long, one wave passes or a report exists. It continues while a safe in-scope step remains.

Valid terminal states:

- `READY_FOR_CODEX_REVIEW`: E00–E15 and all applicable DoD/gates complete, evidence closed, no known P0/P1;
- `NOT_READY`: work remains and must continue;
- `BLOCKED_EXTERNAL`: all independent work complete and exact missing external authority/dependency documented.

No other wording constitutes delivery.
