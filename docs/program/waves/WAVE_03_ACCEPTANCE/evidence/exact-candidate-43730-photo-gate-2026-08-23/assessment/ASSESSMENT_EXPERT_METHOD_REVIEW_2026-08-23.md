# Assessment — independent expert method review

**Review date:** 2026-08-23  
**Candidate:** `43730c271b96bfd45d52af8235aa217b94d2c390`  
**Review type:** independent business / assessment-method review  
**Evidence scope:** current gate packet, `OWNER_FEEDBACK_REGISTER.md`, `owner_feedback/ASSESSMENT_WORKSHOP_PACKET.md`, and every PNG in this candidate's `assessment/` evidence directory  
**Acceptance status:** **NOT ACCEPTED — NO-GO**  
**Code changes:** none  

## 1. Executive verdict

The candidate exposes fragments of an Assessment module, but does not yet provide a coherent practitioner-grade assessment lifecycle. The visible implementation currently behaves as several disconnected registries and technical diagnostic surfaces. It does not yet implement the owner's later operating model, the required approval chain, the paid-product controls, or a reusable method contract.

The most important correction is not a visual refinement. It is reconciliation of the product model. The current documentation contains an older four-mode workshop concept (`Interview / Split / Matrix / Report`) and a later, explicit owner decision to remove both Split and a separate Workspace mode. The authoritative user-facing work modes must therefore be:

1. **Interview** — establish and evidence the current state;
2. **Matrix** — review the current-state synthesis, define the target state and gaps;
3. **Report** — interpret the approved assessment by axis and publish/export it.

**Settings is a separate control surface, not a fourth work mode.** The useful purpose previously assigned to Split — a manageable answer register and review queue — must not be lost. It should exist as an internal Interview subview/filter opened from contextual third-level controls, not as a top-level mode.

This later decision must be added atomically to the canonical owner register before implementation. Until that documentation reconciliation is complete, parallel implementations can legitimately continue building incompatible navigation and data semantics.

## 2. Evidence reviewed

### Canonical written evidence

- current Assessment gate packet for exact candidate `43730`;
- `OWNER_FEEDBACK_REGISTER.md`, including `ASM-OWN-001` through `ASM-OWN-009`;
- `owner_feedback/ASSESSMENT_WORKSHOP_PACKET.md` in full;
- the later owner decisions represented in the current gate packet, especially removal of Split as a top-level mode and the requirement for subscription, team, approval, versioning and report controls.

### Current candidate screenshots

- `ASM-G04-library.png`;
- `ASM-G07-library-preview.png`;
- `ASM-G08-processes.png`;
- `ASM-G09-process-preview.png`;
- `ASM-G09-interview-current.png`;
- `ASM-G09-split-current.png`;
- `ASM-G09-matrix-current.png`;
- `ASM-G10-outputs.png`;
- `ASM-G10-reports.png`;
- `ASM-G10-initiatives.png`.

Screenshots are treated as visual evidence only. They do not prove persistence, authorization, scoring correctness, lineage, generation correctness or owner acceptance.

## 3. Canonical practitioner flow to implement

### 3.1 Library

The Library is a catalogue of assessment methods, not a session registry. Each method row/card must allow the user to understand the method before starting: purpose, applicable business areas, level model, estimated effort, required participants/evidence, commercial entitlement and availability. Starting a method creates a durable Process and moves the work to Processes.

### 3.2 Process

A Process is the governed assessment case. Its record must expose method and method-version, owner/team, completion, current approval gate, last activity, entitlement state and next valid action. Opening a Process enters the three-mode assessment workspace.

### 3.3 Interview — current state and evidence

Interview exists to capture the present factual state, not the future ambition. The primary interaction should show one manageable assessment unit/level at a time, with concise method text and progressive disclosure for explanation, examples, expected evidence and deeper diagnostic questions. The user must be able to:

- set a current-state response with an explicit response state;
- explain the rationale;
- add evidence/attachments and evidence metadata;
- save and continue without losing context;
- see answered/total, missing-evidence and review-required counts;
- open a compact answer register/review queue without introducing a separate Split mode;
- request AI assistance as a proposal, never as an automatic assessment mutation.

The permanent local Teresa panel is not part of this tool because a global assistant already exists. Removing it recovers working space and avoids two competing assistant contexts.

### 3.4 Matrix — current, target and gap

The Matrix is the analytical workspace. Current values must be derived from the approved Interview answers under the selected method version; they must not become an unrelated second source of truth. Target values are a distinct human decision and require their own rationale, comments and approval gate.

The Matrix must support axis navigation, area-level current/target/gap visibility, drill-down to the originating answers/evidence, comments, detection of skipped prerequisite levels and AI-proposed changes. Selecting a current or target cell must preserve lineage and obey method-specific scoring and progression rules. A proposal is not applied until a human accepts it.

### 3.5 Report — interpretation and publication

For DRD, the report must contain exactly one substantive chapter per configured axis. Each axis chapter must include:

1. a concise axis introduction and assessment scope;
2. the approved matrix visual for that axis;
3. one evidence-grounded commentary section per area;
4. current state, target state, gap and material limitations;
5. practical conclusions and sequenced next-step implications for a defined horizon.

An overall cover/executive summary may frame the report, but it must not replace or collapse the seven axis chapters. The report must support human comments, AI analysis with source traceability, review/approval, versioning, single-axis export and **Export all** to one reproducible PDF.

### 3.6 Insights, Reports and Initiatives

The user-facing downstream trio is `Insights / Reports / Initiatives`, consistent with other tools. `Outputs` must not remain a competing navigation label. An immutable internal Assessment Output may remain as a technical provenance snapshot, but the UI must present it as source lineage, not as a fourth user product.

- **Insights** are traceable findings derived from an approved/frozen assessment snapshot.
- **Reports** consume an eligible assessment snapshot plus approved insights and preserve the exact source/version.
- **Initiatives** are proposed or registered actions derived from approved findings/reports; they require explicit human registration and preserve lineage.

No downstream item may be silently regenerated from mutable current data. Empty states must distinguish “no records exist” from “records exist but none are eligible for generation.”

### 3.7 Approval model

The module requires distinct governed gates:

1. response/current-state review and approval;
2. target-state review and approval;
3. report review and publication approval.

Settings must define who can answer, review, approve targets and approve/publish reports. The UI must show the active gate, approver, blocking reason and next valid action. A frozen snapshot is read-only; reopening creates a new revision and preserves the prior snapshot.

### 3.8 Settings and paid-product controls

Settings must include at least:

- **Document information:** process ID, method/version, revision, owner, dates, state and lineage;
- **Subscription and quota:** entitlement state, license allocation, remaining report-generation allowance and commercial contact path;
- **Team and roles:** access, responder, reviewer and approver assignments;
- **Approval policy:** current-state, target-state and report gates;
- **Version history:** revisions, snapshots, approvals, reopen events and published exports.

If the method is not licensed, users may explore a clearly labelled non-persistent test experience, but cannot save durable responses or generate reports. The UI must state this before work begins; it must not allow apparent saving and later discard work.

### 3.9 Reusable formula for other assessment methods

The shell must not hard-code DRD's seven axes or seven levels. A method adapter/schema must declare:

- method identity, version, commercial entitlement and availability;
- axes/dimensions, areas/units, ordering and labels;
- level count, progression rules and target semantics;
- question/response types, evidence rules and scoring/aggregation rules;
- current-state derivation and exceptions;
- report chapter structure and terminology;
- approval policy defaults and allowed overrides;
- supported downstream artifacts and lineage fields.

DRD is the first complete implementation of this contract, not a one-off screen set.

## 4. Atomic findings

| ID | Evidence | Violated rule | Impact | Priority | Testable correction |
|---|---|---|---|---|---|
| ASM-METH-001 | Gate packet G00; workshop proposes four modes; later owner decision removes Split/Workspace | One canonical product model must govern navigation and data ownership | Teams can implement incompatible workspaces and acceptance has no stable denominator | P0 | Update the canonical register with a superseding decision: top-level modes are exactly Interview, Matrix, Report; Settings is separate; no Split tab is rendered on desktop or responsive routes |
| ASM-METH-002 | `ASM-G09-interview-current.png`, `ASM-G09-split-current.png`, `ASM-G09-matrix-current.png`; Report absent | A complete assessment must support current evidence → current synthesis → target → report | A practitioner cannot finish an assessment or prove what generated the result | P0 | One seeded E2E case creates a Process, records evidence-backed current answers, approves current state, selects/approves targets, generates/reviews/publishes a 7-axis report and reads it back with identical lineage |
| ASM-METH-003 | `ASM-G09-interview-current.png`; ASM-OWN-008 | Interview must minimize cognitive load and prioritize the active question/unit | The current screen is too dense for a live client interview and invites missed/low-quality answers | P0 | At 1440×900, the active Interview shows one working unit with progressive disclosure; permanent Teresa and duplicate axis navigation are absent; next/previous, save, counts and evidence remain accessible |
| ASM-METH-004 | `ASM-G09-split-current.png` is effectively another Interview; later owner removes Split | Removed navigation must not remove a necessary business capability | Without an answer register, reviewers cannot efficiently find missing, disputed or evidence-poor responses | P0 | Implement a non-top-level Interview review/register view with filters for unanswered, missing evidence, needs review and approved; opening a row returns to the exact Interview unit |
| ASM-METH-005 | `ASM-G09-matrix-current.png` shows empty current/target/gap grid with no governed derivation | Current state, target state and gap are distinct concepts with traceable sources | Manual or disconnected matrix values would invalidate assessment integrity | P0 | Approved Interview answers deterministically populate current cells; target edits never alter current; each cell opens source answers/evidence; a changed answer recomputes only the permitted draft revision |
| ASM-METH-006 | Owner flow requires non-contiguous-level checks; Matrix screenshot lacks prerequisite handling | Maturity targets must respect method progression rules or explicitly document exceptions | Users can select attractive but methodologically incoherent targets | P0 | For a seeded area with current levels 1,2,5 and missing 3,4, Matrix flags the discontinuity, explains the method rule, and requires resolve/waive-with-rationale before target approval |
| ASM-METH-007 | Report mode absent; workshop report specification pending | Reports must interpret approved evidence, not merely restate scores | The paid deliverable and consulting value are missing | P0 | Generate a report containing seven ordered axis chapters, each with matrix image, all configured area commentaries, conclusions, limitations and source snapshot/version; review and approval are required before publication |
| ASM-METH-008 | `ASM-G10-outputs.png`, `ASM-G10-reports.png`, `ASM-G10-initiatives.png` empty and inconsistent | Downstream artifacts require consistent names, eligibility and provenance | Users cannot test the business flow and may generate artifacts from the wrong source | P0 | Replace user-facing Outputs with Insights; seed at least one traceable item in each downstream registry; every item displays source process, snapshot, method version and creation state |
| ASM-METH-009 | Gate packet G03; no visible approval controls across Interview/Matrix/Report | Current answers, targets and published report need separate governed approvals | Unreviewed evidence or ambitions can become an official deliverable | P0 | Configure responder/reviewer/report approver; prove unauthorized transitions fail, authorized transitions succeed, gate/audit timestamps persist, and reopening creates a new revision |
| ASM-METH-010 | Gate packet G03; no subscription/quota/team/settings surface | A paid assessment must enforce entitlement before durable work and report generation | Commercial leakage, confusing data loss and uncontrolled access | P0 | Licensed fixture saves and generates within quota; unlicensed fixture is explicitly non-persistent and report-disabled; zero-quota fixture blocks generation with remaining-quota and contact information |
| ASM-METH-011 | Workshop adapter discussion; current UI is DRD-specific | New methods must use one governed shell and method contract | Every method risks becoming another bespoke, divergent application | P0 | Load a second synthetic method with different axes/levels from the adapter only; Library, Interview, Matrix and Report render correctly without DRD-specific code paths or labels |
| ASM-METH-012 | `ASM-G07-library-preview.png` describes five axes while current DRD workspace exposes seven | Method information must match the selected canonical method version | A buyer/practitioner receives a materially false description before starting | P1 | Preview reads axis count and names from the same method version used by the Process; a contract test fails on any mismatch |
| ASM-METH-013 | `ASM-G04-library.png`, `ASM-G07-library-preview.png`; commercial terms not configured | Library must explain applicability and purchase/use conditions before Start | Method selection and expectation setting are incomplete | P1 | DRD preview displays purpose, scope, seven axes, required participants/evidence, estimated effort, subscription state and enabled Start action; unavailable methods explain their status without a dead action |
| ASM-METH-014 | `ASM-G09-process-preview.png` shows sparse metadata, disabled AI and Report/Initiative next actions | Process preview must communicate readiness and valid next action | Users may attempt downstream actions before the assessment is eligible | P1 | Preview shows method/version, team, completion, evidence gaps, current gate, eligibility blockers and exactly one valid next action; Report/Initiative actions stay blocked with a reason until eligible |
| ASM-METH-015 | `ASM-G10-reports.png` and `ASM-G10-initiatives.png` say “No assessments found” while Processes shows two drafts | Empty states must distinguish absence from ineligibility | The UI makes existing work appear lost and hides the actual prerequisite | P1 | With two draft processes and no eligible snapshot, show “2 assessments exist; 0 eligible” plus the blocking gate; with none, show a true no-record state |
| ASM-METH-016 | `ASM-G10-outputs.png`; owner requires `Insights / Reports / Initiatives`; workshop uses immutable Output internally | Technical provenance objects must not compete with user-facing product language | Duplicate concepts fragment navigation and confuse what is editable or publishable | P1 | UI exposes Insights only; API/domain lineage may reference immutable Assessment Output; a generated Insight links to that snapshot without exposing a second Outputs registry |
| ASM-METH-017 | Current screenshots contain AI affordances but no proposal workflow | AI analysis must be explainable, reviewable and non-destructive | AI could silently alter regulated evidence, targets or report conclusions | P1 | AI returns a proposed change list with source, rationale and confidence; no data changes before per-item human Apply; Reject leaves state unchanged; every applied change is audited |
| ASM-METH-018 | Report export and quota requirements are documented but not visible | Export must be reproducible, access-controlled and commercially counted | Published reports may differ between views, leak data or bypass monetization | P1 | Export one axis and Export all; exported PDF matches the approved snapshot, records generator/time/version, respects authorization, decrements quota exactly once on successful generation and not on failure |
| ASM-METH-019 | Frozen diagnostic surface rejected in ASM-OWN-003; revision semantics discussed in workshop | Frozen artifacts are evidence snapshots, not dead technical screens | Users cannot understand, reuse or safely revise completed work | P1 | Frozen process opens a readable business summary with lineage and approved downstream actions; Reopen creates a new editable revision while the old snapshot and exports remain byte-identifiable |
| ASM-METH-020 | Current implementation duplicates axis controls across top bars/tree; owner says axes live on the left | Navigation must have one source of orientation per mode | Duplicate controls consume space and can drift to different selections | P2 | Interview and Matrix use one left-side axis/area navigator; route, selected item and counts remain synchronized after refresh and deep-link navigation |

## 5. Minimum acceptance scenarios

The module cannot be called methodologically complete until all scenarios below pass with browser evidence and persistence/readback evidence on the same exact candidate:

1. **Library truth:** method preview matches canonical method version and entitlement.
2. **Start transition:** Start creates exactly one Process; Library contains no session table.
3. **Interview resume:** answer, rationale and evidence persist after reload and reopen at the same unit.
4. **Answer review:** review register filters and deep-links correctly without a Split top-level tab.
5. **Current derivation:** approved Interview responses deterministically populate Matrix current values.
6. **Target governance:** target is independent, prerequisite gaps are handled, and approval is role-gated.
7. **AI safety:** proposals do not mutate data before explicit human application.
8. **Report completeness:** seven DRD axis chapters contain their matrix and every configured area commentary.
9. **Export reproducibility:** approved single-axis and all-axis PDFs reproduce the same snapshot/version.
10. **Downstream lineage:** Insight, Report and Initiative read back with the exact originating snapshot.
11. **Paid boundary:** unlicensed, licensed, exhausted-quota and unauthorized-user cases fail or succeed as specified.
12. **Revision integrity:** frozen state is immutable; reopen creates a new revision without altering history.
13. **Second method:** a non-DRD fixture renders through the same shell and adapter contract.

## 6. Closure recommendation

Do not begin broad visual polishing from the present surfaces. First close the canonical decision conflict and the data/approval contracts, then implement one complete DRD vertical slice across Library → Process → Interview → Matrix → Report → Insights/Reports/Initiatives. Use that slice to validate the reusable method adapter. Only after the complete persisted flow passes should the remaining DRD axes and additional methods be expanded.

This review is an expert finding set, not owner acceptance and not proof that any correction has been implemented.
