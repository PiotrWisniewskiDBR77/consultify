# Owner notes — Chat → My Work → Interview → Tools

Date of consolidation: 2026-08-23
Source review: owner walkthrough and screenshots from 2026-08-22
Status: `CAPTURED_UNRECONCILED / IMPLEMENTATION_NOT_AUTHORIZED_BY_THIS_NOTE`

## Purpose and truth boundary

This is the single navigation note for owner feedback recorded from the Chat
review through My Work, Interview and Tools. It consolidates requested repairs,
partial approvals and required product rules. It does not replace the detailed
module registers and does not prove implementation, persistence, deployment or
owner acceptance.

Allowed statuses in this note:

- `APPROVED_AS_IS` — the owner explicitly accepted the observed surface;
- `CAPTURED` — the requirement was recorded but not reconciled;
- `REMEDIATION_REQUIRED` — the observed product requires correction;
- `NOT_VERIFIED` — functionality or backend truth has not been proven;
- `BLOCKED` — testing could not continue because the runtime, API, data or
  authentication boundary failed.

Canonical detailed sources:

- Chat: [OWNER_REVIEW_2026-08-22.md](modules/13_CHAT/OWNER_REVIEW_2026-08-22.md)
- Interview: [INTERVIEW_RECOMMENDATION_REGISTER.md](modules/02_INTERVIEW/INTERVIEW_RECOMMENDATION_REGISTER.md)
- Interview creator standard: [CONSULTING_CREATOR_GUIDELINES.md](modules/02_INTERVIEW/CONSULTING_CREATOR_GUIDELINES.md)
- Tools: [TOOLS_OWNER_REVIEW_REGISTER.md](modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md)
- Tools final working-model report: [TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md](modules/03_TOOLS/TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md)
- Cross-module menu policy: [ROW_MENU_AUDIT_REGISTER.md](owner_feedback/CROSS_MODULE/ROW_MENU_AUDIT_REGISTER.md)

## Executive summary

| Area                   | Owner conclusion                                                                                                                        | Current truth                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Chat                   | Requires substantial UX, Canvas and governed-action corrections                                                                         | `REMEDIATION_REQUIRED / NOT_ACCEPTED`                  |
| My Work / Decisions    | Canonical object table is obscured by an unrelated technical section                                                                    | `REMEDIATION_REQUIRED`                                 |
| Interview              | One of the stronger modules; table shapes and upper menus accepted, but lifecycle, menus, previews and three creators require work      | `PARTIAL_APPROVAL / REMEDIATION_REQUIRED`              |
| Tools                  | Library and tool-document presentation are strong; operating model, names, menus, output chain and backend readiness require completion | `PARTIAL_APPROVAL / REMEDIATION_REQUIRED`              |
| Shared staging runtime | Local UI must use the shared Railway staging database; no local database, reset, seed or migration is part of owner review              | `ENVIRONMENT_CONTRACT / CURRENT READBACK NOT_VERIFIED` |

## A. Chat

### CHAT-01 — Canvas and document working area

Status: `REMEDIATION_REQUIRED`

- Canvas must be a clear working surface, not a collection of competing
  controls and diagnostic affordances.
- The three genuinely different document views must be directly available as
  `Rich / DOC / MD`; duplicated view controls and unexplained internal labels
  must be removed.
- The former generic `PROMOTE` group must describe the outcome explicitly:
  create the selected object in the workspace.
- Menus must never cover content, must fit the viewport, preserve focus and work
  in light and dark themes.

### CHAT-02 — Governed action and handoff

Status: `REMEDIATION_REQUIRED / FUNCTIONAL_READBACK_REQUIRED`

- A proposal from Teresa is not an executed action. The UI must clearly show
  proposal, user decision, execution state, durable result and failure.
- State treatments must distinguish pending, executable, working, completed,
  rejected and failed outcomes.
- Actions must be permission-aware, idempotent and traceable to their source
  conversation and target object.
- No visual success may be shown before the target object is durably created and
  can be reopened.

### CHAT-03 — Response action row

Status: `REMEDIATION_REQUIRED`

- Keep one stable action container for every AI response; controls must not jump
  in and out with hover, streaming or missing identifiers.
- Unavailable operations should remain visible only when a truthful disabled
  reason helps the user; otherwise omit non-actions.
- Expanded actions belong in the same container, not in another detached card.

### CHAT-04 — Header, welcome and conversation start

Status: `REMEDIATION_REQUIRED`

- Header controls need one size, radius, spacing, focus and disabled-state
  contract.
- Welcome should invite the user to talk to Teresa, use the first name safely
  and preserve a name-free fallback.
- Quick starters must prefill an editable composer instead of sending a message
  immediately.
- The empty composer may have a restrained living affordance, respecting both
  OS and application reduced-motion settings.

### CHAT-05 — Completeness gate

Status: `NOT_VERIFIED`

Before owner retest, verify Canvas content preservation, every action handler,
API and permission boundary, cold readback, failure recovery, PL/EN, desktop,
tablet, themes and console/network errors.

## B. My Work / Decisions

### MYWORK-01 — Decisions list must be the primary content

Status: `REMEDIATION_REQUIRED`

- The Decisions page must open as the canonical Decisions table, in the same
  way that Tasks opens as the Tasks table.
- The technical `Benefits, Effectiveness and Closure` section, KPI observations,
  closure cases and raw request form shown above the table must not displace the
  working list.
- Any required governance or closure detail belongs in the selected decision
  workspace or preview, not as an unrelated page-wide block above all records.

## C. Interview

### INT-01 — Accepted baseline

Status: `APPROVED_AS_IS / PARTIAL`

- Preserve the shared shape of the six tables: Inbox, Sessions, Assigned,
  Templates, Insights and Initiatives.
- Preserve the upper Interview menu/navigation observed during the review.
- This approval does not cover row menus, kebab menus, preview content,
  correctness, handlers or persistence.

### INT-02 — Context and kebab menus

Status: `REMEDIATION_REQUIRED`

- Right-click and kebab menus must come from one permission- and state-aware
  action registry for each object type.
- Each menu must expose the complete useful lifecycle actions for its context;
  sparse generic menus are not sufficient.
- Confirmed gaps include Inbox and the inconsistent Assigned actions. The same
  audit must cover Sessions, Templates, Insights and Initiatives.
- Disabled items require a truthful reason. Do not invent operations unsupported
  by the backend.

### INT-03 — Preview standard

Status: `REMEDIATION_REQUIRED`

- Every preview needs the same information anatomy and action placement.
- Actions belong at the bottom in a canonical footer, with object-specific
  actions using the shared component contract.
- Preview is not merely a second way to open a record. It must summarize what is
  inside, why it matters, current status, provenance/relations and the next
  legitimate action.
- Keep exactly one primary `Open` path; omit empty action sections.

### INT-04 — Question workspace regression

Status: `REMEDIATION_REQUIRED / ROLLBACK_OR_RESTORE_REQUIRED`

- Remove the recently introduced narrow N-type question card layout.
- Restore the earlier production-style question workspace: readable question
  list on the left, a broad focused question/answer canvas, clear progress and
  stable Save/Next controls.
- The previous layout is the product reference supplied by the owner; its
  behavior and responsive states still require a frozen-candidate replay.

### INT-05 — Approval lifecycle

Status: `REMEDIATION_REQUIRED / BACKEND_AND_PERSISTENCE_NOT_VERIFIED`

Required flow:

1. assignee answers and submits;
2. authorized reviewer receives the submitted response set;
3. reviewer accepts it or returns it with feedback;
4. accepted material becomes eligible for Insights and downstream work;
5. returned material goes back to the assignee without losing answers, comments
   or audit history;
6. every transition preserves actor, timestamp, reason, version and readback.

Submitted is not Approved. Unapproved answers must not silently become source
material for downstream generation.

### INT-06 — Assign creator and missing template suggestions

Status: `REMEDIATION_REQUIRED / ROOT_CAUSE_NOT_VERIFIED`

- The Assign creator itself was judged substantively useful.
- The template selector failed to suggest available templates and requires an
  API/filter/tenant/status investigation rather than a visual workaround.
- Preserve template, assignees, team assignment, due date, priority, notes and
  anonymity controls, but organize them within the shared creator standard.

### INT-07 — Three canonical creators

Status: `REMEDIATION_REQUIRED / PROTOTYPE_GATE_REQUIRED`

The Assign, Insight and Initiative creators must share one professional visual
and interaction system:

- larger standardized dialog using the available viewport;
- fixed header and footer, one scrollable content region;
- one stepper grammar, component scale, spacing, typography and button hierarchy;
- visible next action without forcing the user to discover hidden scrolling;
- fewer nested frames and clearer grouping;
- simple primary path with advanced settings progressively disclosed;
- preserved entered data when moving Back/Next or recovering from an error;
- explicit loading, validation, empty, partial, provider-failure and retry states;
- accessibility, keyboard operation and responsive desktop/tablet behavior.

The next version must pass a clickable-prototype review before implementation is
treated as reusable platform standard.

## D. Tools

### TOOL-01 — Accepted surfaces

Status: `APPROVED_AS_IS / PARTIAL`

- The Library table and the full Dynamic SWOT knowledge/tool document were
  explicitly liked by the owner in both light and dark themes.
- Existing preview graphics were accepted; only the semantic content contract
  needs completion.
- Preserve the strong tool positioning, use/not-use guidance, preparation,
  process explanation and right-side metadata structure.

### TOOL-02 — Tool document header

Status: `REMEDIATION_REQUIRED`

- Shorten `How to / Knowledge base` to `Knowledge` or `Knowledge base` according
  to the final locale contract.
- Shorten `Analyze with AI` to `Analyze` while retaining the AI symbol.
- `Sections`, `Knowledge`, `Analyze` and `Start Session` must use the same size.
- `Start Session` is the only filled/colored primary action.

### TOOL-03 — Canonical module chain and naming

Status: `REMEDIATION_REQUIRED`

The Tools module must use this canonical chain:

`Library → Sessions → Insights → Reports → Initiatives`

- Rename `Outputs` to `Insights`.
- Insights are the approved conclusions generated from completed tool sessions.
- Reports are generated Word, PowerPoint or Excel deliverables built from
  approved sessions/insights, with or without a template.
- Initiatives use the same canonical Initiative creator as Interview, but accept
  Tools-specific sources: approved session results, insights and reports.
- Interview should also expose Reports as a downstream section using the same
  report-generation platform.

### TOOL-04 — Tables and creators

Status: `REMEDIATION_REQUIRED / BACKEND_NOT_VERIFIED`

- Insights, Reports and Initiatives each need a real canonical table, preview,
  complete context/kebab menus and a creator following the Interview creator
  standard.
- Sessions become eligible sources only after the approval lifecycle completes.
- Report generation must support document and presentation/workbook creation,
  template selection and no-template authoring, with durable lineage to every
  source.
- Existing rows labelled as generic blue `Report` and unknown
  `CONFIGURING` statuses are not an accepted information model.

### TOOL-05 — Dynamic SWOT: Input & Exploration

Status: `REMEDIATION_REQUIRED`

- Remove the duplicate left-hand Strengths/Weaknesses/Opportunities/Threats
  selector when the canonical selector above the workspace already provides the
  same navigation.
- Remove the four large counters for accepted points, confirmed areas, active
  dialogues and maximum target; they duplicate information available closer to
  the work.
- Move `Current AI proposal` to the top of the active area: it is the primary
  working component.
- When there are zero accepted points, do not render an empty explanatory card.
- Do not repeat Accepted/Attempts counters when the selector already communicates
  the relevant count.
- Replace the always-visible manual text field with an explicit human action
  button. Opening it should allow a consultant to add a point manually.
- Allow up to five accepted points per area. Each accepted point must be editable
  and removable or deferred through explicit actions with recovery/confirmation
  proportional to the operation.
- AI proposals support the consultant; accepting, skipping, commenting and
  asking for deeper reasoning remain human-controlled decisions.

### TOOL-06 — Dynamic SWOT: matrix build

Status: `REMEDIATION_REQUIRED`

- Replace the dark isolated visual block with the canonical application visual
  language and semantic SWOT colors.
- Remove the explanatory banner above the matrix when it does not help perform
  the task.
- Convert the rich descriptions accepted during Input & Exploration into concise
  consultant-editable sentences for the final 2×2 matrix.
- The matrix must be presentation-quality: excellent typography, hierarchy,
  spacing, semantic colors and clear grouping. It is a final client-facing
  artifact, not merely a counter dashboard.
- The transformation from description to concise matrix statement must preserve
  source lineage and allow manual correction before finalization.

### TOOL-07 — Dynamic SWOT: Synthesis, Insights and Recommendations

Status: `REMEDIATION_REQUIRED / CONTENT_CONTRACT_REQUIRED`

The nine synthesis outputs require precise definitions, evidence rules and a
consistent display. At minimum preserve the reviewed categories including:

- key findings;
- key insights;
- business implications;
- conclusions;
- decision options;
- consultant recommendation;
- risks, assumptions and uncertainties;
- questions requiring management decision;
- the remaining canonical synthesis category defined by the tool method.

For each item specify: purpose, expected answer form, source evidence, confidence,
assumptions, owner/reviewer and what makes it complete. `Needs evidence` must be a
truthful state, not decorative metadata.

Add a separate `Recommendations` navigation section. Move the useful supporting
analysis and the complete recommendation story there: per-area observations,
internal synthesis, external synthesis, strategic tensions/insights and proposed
moves. Avoid duplicating the same conclusion in both Synthesis and
Recommendations.

### TOOL-08 — Completion / result health

Status: `REMEDIATION_REQUIRED`

- Replace `Outputs & Actions` with a focused completion/result-health screen.
- Show whether the tool was completed well, what evidence is missing, an AI
  quality/readiness assessment and the reasons behind the score.
- Remove links that create reports, initiatives or other documents from inside
  the tool session; those belong in the dedicated Insights, Reports and
  Initiatives creators.
- Preserve only the final summary/readiness result and the governed submit,
  review, approve/return or finish action appropriate to status.

### TOOL-09 — Preview content contract

Status: `CAPTURED / CROSS_MODULE_STANDARD_REQUIRED`

Tools previews are visually accepted, but every preview must communicate:

- what the object is and why it exists;
- current lifecycle state and completeness;
- concise substantive summary;
- key evidence/provenance and relations;
- risks, missing evidence or blocked dependencies;
- the next legitimate actions.

### TOOL-10 — Right-click and kebab menus

Status: `REMEDIATION_REQUIRED`

- Current menus are too generic (`Open`, `Preview`, `Chat`) and do not represent
  each object's lifecycle.
- Complete every Library, Session, Insight, Report and Initiative menu using the
  cross-module action policy.
- Right-click and kebab must be two presentations of the same action registry.
- Three-sceptic review of menu policy is retained in the cross-module policy
  documents; no menu is accepted solely because it renders.

### TOOL-11 — Runtime and backend readiness

Status: `BLOCKED / NOT_VERIFIED`

- Owner review showed missing tables/data, HTTP 404 and HTTP 500 states on local
  screens. These are blockers, not valid empty states.
- Local UI must connect to the shared Railway staging database used by the
  staging environment (`demo.consulify.ai` as identified by the owner; exact
  deployed hostname and service coordinates still require runtime verification).
- Do not create or clear a local database, run seeds, reset staging data or run
  migrations as part of review preparation.
- Before the next review prove: authenticated owner identity, mounted APIs,
  nonempty canonical tables, create/update/submit/approve/cold-readback paths,
  browser screenshots and zero unexplained 4xx/5xx/console errors.

## E. Shared implementation order

1. Freeze and identify exact code, frontend, backend, staging database and owner
   identity; repair runtime connectivity without modifying data.
2. Reconcile this note with the detailed Chat, Interview and Tools registers;
   resolve duplicates and open wording questions with the owner.
3. Define the shared action-menu registry, preview anatomy and creator shell as
   platform contracts.
4. Produce and owner-review clickable prototypes for the three Interview
   creators and the compact Dynamic SWOT working flow.
5. Implement backend lifecycle and lineage first where the UI depends on review,
   approval, report generation or initiative creation.
6. Implement module UI against mounted handlers; no fixture-only success.
7. Verify each path in Playwright with authenticated staging data, cold reload,
   persistence/readback, failure states, PL/EN, themes and responsive layouts.
8. Run independent expert review, then owner retest. Only owner retest can move a
   requirement to `OWNER_ACCEPTED`.

## F. Open confirmations

- Confirm final owner-facing staging hostname (`demo.consulify.ai` versus the
  currently deployed domain discovered from infrastructure) without changing
  the shared database contract.
- Confirm the ninth named synthesis output in the Dynamic SWOT method.
- Confirm whether the tool header label is `Knowledge` or `Knowledge base` in EN
  and the corresponding PL wording.
- Confirm the final name for the completion screen: `Result health`, `Quality &
readiness` or another owner-approved label.
- Confirm which actions are available to owner, reviewer, assignee and ordinary
  member for every object state.

## G. Acceptance rule

Nothing in this document is `FIXED`, `DONE` or `OWNER_ACCEPTED` unless a later
entry records the exact candidate SHA, runtime, database, persona, browser proof,
persistence/cold readback and explicit owner verdict. Until then, every repair
remains `CAPTURED`, `REMEDIATION_REQUIRED`, `NOT_VERIFIED` or `BLOCKED`.

## H. Atomic coverage ledger — 50 retained entries

The sections above are a readable synthesis, not the atomic denominator. The
following ledger is the completeness index. Detailed wording, evidence and
acceptance criteria remain in the linked canonical registers.

### H1. Chat — 17 atomic owner findings

Canonical source:
[OWNER_REVIEW_2026-08-22.md](modules/13_CHAT/OWNER_REVIEW_2026-08-22.md)

| ID             | Atomic subject                                               |
| -------------- | ------------------------------------------------------------ |
| `CHAT-OWN-001` | Configurable order of Canvas and Chat side panels            |
| `CHAT-OWN-002` | One header height and truthful save model                    |
| `CHAT-OWN-003` | Prove conversation branching or remove premature branch UI   |
| `CHAT-OWN-004` | Decide and clarify the product role of Important signals     |
| `CHAT-OWN-005` | Simplify Canvas command bar and audit every action           |
| `CHAT-OWN-006` | Replace oversized kebab with direct Rich/DOC/MD view control |
| `CHAT-OWN-007` | Repair floating-panel layering, containment and focus        |
| `CHAT-OWN-008` | Complete governed proposal card and state language           |
| `CHAT-OWN-009` | Unify response actions and stabilize icons/controls          |
| `CHAT-OWN-010` | Normalize conversation header controls                       |
| `CHAT-OWN-011` | Restore stronger personalized start screen                   |
| `CHAT-OWN-012` | Add restrained living-input pulse                            |
| `CHAT-OWN-013` | Rebuild history IA for private and organization work         |
| `CHAT-OWN-014` | Give every start-screen control one explicit semantic        |
| `CHAT-OWN-015` | Verify Teresa voice modes across the application             |
| `CHAT-OWN-016` | Close live-provider and user-safe error handling             |
| `CHAT-OWN-017` | Complete Canvas functional qualification                     |

Count: `17`.

### H2. Interview — 7 owner observations and 9 implementation recommendations

Canonical source:
[INTERVIEW_RECOMMENDATION_REGISTER.md](modules/02_INTERVIEW/INTERVIEW_RECOMMENDATION_REGISTER.md)

Owner observations:

| ID                     | Atomic subject                                                |
| ---------------------- | ------------------------------------------------------------- |
| `INT-MENU-OWN-001`     | Context and kebab menus are incomplete and inconsistent       |
| `INT-PREV-OWN-001`     | Preview action footers lack one canonical format              |
| `INT-QCARD-OWN-001`    | N-type question card regression; restore prior workspace      |
| `INT-APPROVAL-OWN-001` | Missing accept/return approval lifecycle                      |
| `INT-ASSIGN-OWN-001`   | Assign creator cannot suggest/select the expected template    |
| `INT-TPL-ED-OWN-001`   | Template editor accepted as useful, with discoverability debt |
| `INT-CREATOR-OWN-001`  | Assign, Insight and Initiative creators need one standard     |

Mapped recommendations:

| ID            | Atomic recommendation                                         |
| ------------- | ------------------------------------------------------------- |
| `REC-INT-001` | Preserve accepted table shape and upper navigation            |
| `REC-INT-002` | Governed, state-aware action registry for row menus           |
| `REC-INT-003` | Canonical Preview anatomy and action placement                |
| `REC-INT-004` | Restore the earlier question-answer workspace                 |
| `REC-INT-005` | Implement submitted → accepted/returned lifecycle             |
| `REC-INT-006` | Repair template eligibility and selector readback             |
| `REC-INT-007` | Standardize the three creator shells and navigation           |
| `REC-INT-008` | Add functional, persistence, accessibility and recovery gates |
| `REC-INT-009` | Prototype and owner-approve before platform-wide reuse        |

Count: `16`.

### H3. Tools — 14 atomic owner findings/decisions

Canonical source:
[TOOLS_OWNER_REVIEW_REGISTER.md](modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md)

| ID                         | Atomic subject                                                          |
| -------------------------- | ----------------------------------------------------------------------- |
| `TLS-OWN-INTAKE-001`       | Open and preserve the complete Tools owner review                       |
| `TLS-TBL-OWN-001`          | Preserve accepted Library/Sessions table baseline                       |
| `TLS-DETAIL-OWN-001`       | Preserve accepted Dynamic SWOT detail in light/dark                     |
| `TLS-OUTPUT-OWN-001`       | Correct the Outputs/Insights semantic model                             |
| `TLS-REPORT-OWN-001`       | Build real Reports registry and document generator                      |
| `TLS-INIT-OWN-001`         | Reuse the canonical Initiative Creator with Tools context               |
| `TLS-PREV-OWN-001`         | Preserve accepted graphical Preview layer                               |
| `TLS-PREV-CONTENT-OWN-001` | Define cross-app Preview content contract                               |
| `TLS-MENU-OWN-001`         | Complete sparse right-click and kebab menus                             |
| `TLS-MENU-POLICY-OWN-001`  | Apply three-sceptic governed menu policy review                         |
| `TLS-SWOT-OWN-001`         | Establish the final reusable consulting-tool session model              |
| `TLS-REC-OWN-001`          | Add Recommendations as a separate canonical stage                       |
| `TLS-READY-OWN-001`        | Replace Outputs & Actions with Results & Readiness                      |
| `TLS-CHAIN-OWN-001`        | Preserve four distinct classes: Outputs, Insights, Reports, Initiatives |

Count: `14`.

### H4. My Work and environment — 3 retained entries

| ID                    | Atomic subject                                                                                                       | Status                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `MYWORK-DEC-OWN-001`  | Decisions must open as the Decisions table without the unrelated technical block above it                            | `CAPTURED / REGISTER_ID_ASSIGNED_HERE` |
| `ENV-STAGING-OWN-001` | Local application uses the shared Railway staging database identified by the owner; no local DB/reset/seed/migration | `CAPTURED / RUNTIME_NOT_VERIFIED`      |
| `ENV-AUTH-OWN-002`    | Repair owner-session/backend identity mismatch and prove authenticated data readback                                 | `BLOCKED / ROOT_CAUSE_NOT_CLOSED`      |

Count: `3`.

### H5. Denominator and limitation

- Atomically indexed in this scope: `17 + 16 + 14 + 3 = 50` entries.
- The `50` entries are retained requirements/findings, not `50` completed fixes.
- Screenshots and sub-acceptance checks are evidence items, not additional owner
  requirements; therefore they are not inflated into the denominator.
- Earlier or later feedback outside the bounded Chat → My Work → Interview →
  Tools walkthrough is not silently claimed as covered by this denominator.
- If another transcript/register contains an additional owner request, it must
  receive a new stable ID and increment this denominator; it must not be folded
  invisibly into an existing summary.

## I. Complete inventory of registers and evidence from the 2026-08-21 to 2026-08-23 review window

This section protects the work product itself. It lists the register, review,
specification, audit, readiness and evidence-index files found in the repository
for the last two-day owner-review window. It is a file inventory, not a claim
that every recorded item was implemented or accepted.

### I1. Primary owner-feedback and recommendation registers

| Area                                 | Register or controlling document                                        | Evidence binding                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Chat                                 | `modules/13_CHAT/OWNER_REVIEW_2026-08-22.md`                            | `modules/13_CHAT/evidence/owner-review-2026-08-22/EVIDENCE_INDEX.md` — 25 screenshots          |
| Interview                            | `modules/02_INTERVIEW/INTERVIEW_RECOMMENDATION_REGISTER.md`             | `modules/02_INTERVIEW/evidence/tables-owner-review-2026-08-22/INDEX.md` — 33 screenshots       |
| Interview creator standard           | `modules/02_INTERVIEW/CONSULTING_CREATOR_GUIDELINES.md`                 | Owner screenshots are bound through the Interview evidence index                               |
| Interview creator challenge          | `modules/02_INTERVIEW/CREATOR_SKEPTICAL_REVIEW.md`                      | Critical review of the creator standard; no independent acceptance claim                       |
| Tools                                | `modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md`                       | Three evidence indexes: menus 6, tables 5, tool detail 2 screenshots                           |
| Tools closure summary                | `modules/03_TOOLS/TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md`        | Summary only; the register and evidence indexes remain canonical                               |
| My Work — Ideas                      | `modules/07_MY_WORK_AGENT/IDEAS_OWNER_REVIEW_2026-08-22.md`             | `modules/07_MY_WORK_AGENT/evidence/ideas-owner-review-2026-08-22/INDEX.md` — 25 screenshots    |
| My Work — Notebook                   | `modules/07_MY_WORK_AGENT/NOTEBOOK_OWNER_REVIEW_2026-08-22.md`          | `modules/07_MY_WORK_AGENT/evidence/notebook-owner-review-2026-08-22/INDEX.md` — 10 screenshots |
| My Work — Decisions                  | Finding retained in this consolidated note as `MYWORK-DEC-OWN-001`      | `modules/07_MY_WORK_AGENT/evidence/decisions-owner-review-2026-08-22/INDEX.md` — 2 screenshots |
| Organization                         | `owner_feedback/01_ORGANIZATION/OWNER_FEEDBACK_REGISTER.md`             | `owner_feedback/01_ORGANIZATION/EVIDENCE_INDEX.md` — 18 screenshots                            |
| Organization implementation contract | `owner_feedback/01_ORGANIZATION/FINAL_IMPLEMENTATION_SPEC.md`           | Derived specification; does not replace the owner register                                     |
| Organization expert synthesis        | `owner_feedback/01_ORGANIZATION/ORG-OWN-003_EXPERT_SYNTHESIS.md`        | Supporting expert analysis                                                                     |
| Organization screen blueprint        | `owner_feedback/01_ORGANIZATION/ORG-OWN-003_SCREEN_BLUEPRINT.md`        | Supporting screen-level blueprint                                                              |
| Settings                             | `owner_feedback/13_SETTINGS/OWNER_FEEDBACK_REGISTER.md`                 | `owner_feedback/13_SETTINGS/EVIDENCE_INDEX.md` — 1 screenshot                                  |
| Settings implementation contract     | `owner_feedback/13_SETTINGS/FINAL_IMPLEMENTATION_SPEC.md`               | Derived specification                                                                          |
| Admin                                | `owner_feedback/14_ADMIN/OWNER_FEEDBACK_REGISTER.md`                    | `owner_feedback/14_ADMIN/EVIDENCE_INDEX.md` — 8 screenshots                                    |
| Admin implementation contract        | `owner_feedback/14_ADMIN/FINAL_IMPLEMENTATION_SPEC.md`                  | Derived specification                                                                          |
| Admin seven-task blueprint           | `owner_feedback/14_ADMIN/ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md`           | Supporting implementation decomposition                                                        |
| AI OS                                | `owner_feedback/15_AI_OS/OWNER_FEEDBACK_REGISTER.md`                    | `owner_feedback/15_AI_OS/EVIDENCE_INDEX.md` — 1 screenshot                                     |
| Partners                             | `owner_feedback/16_PARTNERS/OWNER_FEEDBACK_REGISTER.md`                 | `owner_feedback/16_PARTNERS/EVIDENCE_INDEX.md` — 1 screenshot                                  |
| Partners content truth audit         | `owner_feedback/16_PARTNERS/PARTNER_CONTENT_SOURCE_AUDIT_2026-08-22.md` | Source classification and publication-safety audit                                             |
| Partners content matrix              | `owner_feedback/16_PARTNERS/PAR_OWN_001_CONTENT_MATRIX.md`              | Requirement/source matrix                                                                      |

### I2. Cross-module registers and governance documents

| Purpose                                  | File                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cross-module owner feedback              | `owner_feedback/CROSS_MODULE/OWNER_FEEDBACK_REGISTER.md`                                    |
| Row-menu audit                           | `owner_feedback/CROSS_MODULE/ROW_MENU_AUDIT_REGISTER.md`                                    |
| Row-menu policy sceptical review         | `owner_feedback/CROSS_MODULE/ROW_MENU_POLICY_SKEPTICAL_REVIEW.md`                           |
| Visual card standard audit               | `owner_feedback/CROSS_MODULE/VISUAL_STANDARD_CARD_AUDIT.md`                                 |
| Cross-module evidence                    | `owner_feedback/CROSS_MODULE/EVIDENCE_INDEX.md` — 5 screenshots                             |
| Automated sweep evidence                 | `owner_feedback/CROSS_MODULE/evidence/2026-08-21_AUTOMATED_SWEEP/INDEX.md` — 16 screenshots |
| Owner decision register                  | `owner_feedback/DECISION_REGISTER.md`                                                       |
| Owner-feedback traceability              | `owner_feedback/TRACEABILITY_MATRIX.md`                                                     |
| Documentation audit                      | `owner_feedback/DOCUMENTATION_AUDIT_2026-08-21.md`                                          |
| Implementation-readiness audit           | `owner_feedback/IMPLEMENTATION_READINESS_AUDIT_2026-08-21.md`                               |
| Master Wave 3 status                     | `MASTER_STATUS_REGISTER.md`                                                                 |
| Sixteen-module owner-acceptance register | `../WAVE_03_16_MODULE_OWNER_ACCEPTANCE_REGISTER.md`                                         |
| Review coverage matrix                   | `OWNER_REVIEW_COVERAGE_MATRIX_2026-08-22.md`                                                |
| Review preflight                         | `OWNER_REVIEW_PREFLIGHT.md`                                                                 |
| Guided owner replay                      | `GUIDED_OWNER_REPLAY.md`                                                                    |
| Final sixteen-module replay              | `FINAL_16_MODULE_REPLAY.md`                                                                 |
| Exact-SHA browser replay                 | `EXACT_SHA_BROWSER_REPLAY_2026-08-23.md`                                                    |
| Cross-module findings                    | `CROSS_MODULE_FINDINGS.md`                                                                  |
| Owner policy decisions                   | `OWNER_POLICY_DECISIONS.md`                                                                 |
| SHA/runtime ledger                       | `SHA_RUNTIME_LEDGER.md`                                                                     |
| Owner fixture inventory                  | `OWNER_FIXTURE_INVENTORY.md`                                                                |
| Frontend/backend alignment audit         | `FRONTEND_BACKEND_ALIGNMENT_AUDIT.md`                                                       |
| Remaining-module table preflight         | `REMAINING_MODULE_TABLE_PREFLIGHT_2026-08-22.md`                                            |
| Next-modules review readiness            | `NEXT_MODULES_OWNER_REVIEW_READINESS_2026-08-22.md`                                         |

### I3. Runtime, database and preservation registers created during the same recovery window

| Purpose                                  | File                                                                                   | Truth boundary                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| Incident freeze                          | `../../../operations/CONSULTIFY_INCIDENT_FREEZE_AUDIT_2026-08-22.md`                   | Freeze/audit, not acceptance                |
| WIP preservation and candidate inventory | `../../../operations/CONSULTIFY_WIP_PRESERVATION_AND_CANDIDATE_REGISTER_2026-08-22.md` | Protects worktrees/candidates from loss     |
| Security and dependency audit            | `../../../operations/WAVE_03_SECURITY_AND_DEPENDENCY_AUDIT_2026-08-22.md`              | Audit only                                  |
| Database recovery inventory              | `DATABASE_RECOVERY_INVENTORY_2026-08-23.md`                                            | Recovery evidence, not staging safety proof |
| Fresh PostgreSQL schema audit            | `FRESH_POSTGRES_SCHEMA_AUDIT_2026-08-23.md`                                            | Schema evidence only                        |
| Railway/public demo incident audit       | `RAILWAY_AND_PUBLIC_DEMO_INCIDENT_AUDIT_2026-08-23.md`                                 | Incident/root-cause record                  |
| Remaining MVP control register           | `../../FINAL_MVP_REMAINING_9_CONTROL_REGISTER_2026-08-23.md`                           | Program-control register                    |

### I4. Sixteen module acceptance files retained alongside the registers

The following files are the per-module acceptance envelopes. They are not
substitutes for the detailed owner-feedback registers above:

1. `modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`
2. `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md`
3. `modules/03_TOOLS/MODULE_ACCEPTANCE.md`
4. `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`
5. `modules/05_INITIATIVES/MODULE_ACCEPTANCE.md`
6. `modules/06_EXECUTION/MODULE_ACCEPTANCE.md`
7. `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`
8. `modules/08_MEETINGS/MODULE_ACCEPTANCE.md`
9. `modules/09_RESULTS/MODULE_ACCEPTANCE.md`
10. `modules/10_FINANCE/MODULE_ACCEPTANCE.md`
11. `modules/11_MATERIALS/MODULE_ACCEPTANCE.md`
12. `modules/12_AUDITS/MODULE_ACCEPTANCE.md`
13. `modules/13_CHAT/MODULE_ACCEPTANCE.md`
14. `modules/14_ADMIN/MODULE_ACCEPTANCE.md`
15. `modules/15_SETTINGS/MODULE_ACCEPTANCE.md`
16. `modules/16_PARTNER/MODULE_ACCEPTANCE.md`

### I5. Preserved visual-evidence denominator

- Evidence indexes listed above: `15`.
- Screenshot/image files bound by those indexes: `158`.
- Breakdown: Interview 33; Tools 13; My Work 37; Chat 25;
  Organization 18; Settings 1; Admin 8; AI OS 1; Partners 1;
  cross-module direct evidence 5; automated sweep 16.
- The screenshots remain stored inside the repository under the exact evidence
  directories listed in I1 and I2. Their existence proves preservation of the
  visual input, not implementation, backend readback, owner acceptance or
  release.

### I6. Inventory rule going forward

No register, screenshot index, expert review, final specification or incident
audit from this window may be replaced by this summary. This document is the
navigation index; the listed source files remain the detailed record. New owner
feedback must be appended to the relevant detailed register, receive a stable
ID, bind its screenshot/evidence path and then be added to this inventory.
