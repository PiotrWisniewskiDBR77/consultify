# Assessment — owner review synthesis

> Date: 2026-08-23  
> Owner: Piotr Wiśniewski  
> Scope: complete Wave 3 owner intake for Assessment  
> Canonical atomic source: `OWNER_FEEDBACK_REGISTER.md` (`ASM-OWN-001`–`028`)  
> Status: `OWNER_REQUIREMENTS_CAPTURED / TWO-ROUND_EXPERT_AUDIT_INCOMPLETE / NOT_IMPLEMENTED / NOT_ACCEPTED`

This document is a navigation and implementation synthesis. It does not replace
the atomic owner register, screenshots, donor URL, book, QBank, expert reviews
or runtime evidence.

## 1. Product model

Assessment is organized as a reusable product shell with method-specific
definitions. DRD is the current flagship method, but shared code must support
future assessments with different hierarchies, scoring, evidence policies,
visualizations and reports.

The main register has five areas:

1. `Library` — a pure methodology catalog and knowledge surface;
2. `Processes` — started/running Assessment instances;
3. `Insights` — standardized downstream insight objects;
4. `Reports` — canonical report objects/revisions;
5. `Initiatives` — governed initiatives derived from accepted analysis.

Library never displays active sessions. Starting a catalog method creates a
Process. A method detail explains purpose, fit, scope, requirements and outputs
before start.

## 2. Assessment session shell

Inside one Process, Level 2 exposes exactly:

`Interview | Matrix | Report`

`Settings` is a separate action. `Split` and `Workspace` are removed. The header
retains document name and Exit. Technical metadata and unexplained global
legends are removed from the working canvas.

Level 3 changes with the active mode:

- left: mode-specific controls;
- right: status, Save and AI Analysis;
- deliberate spacing separates Level 2 from Level 3;
- axes are not duplicated in a horizontal row when they already exist in the
  left navigator.

## 3. Interview

Purpose: establish the factual AS-IS state, collect evidence and rationale, and
support authorized assessor validation.

- compact two-stage left navigation: axes/groups, then areas/units;
- truthful progress at both levels, distinguishing answered, assessed and
  evidence-validated counts;
- no permanent Assessment-specific Teresa side panel; the general Teresa chat
  remains available;
- canonical QBank v2 is the source for 7 axes, 39 areas, 233 area-level
  definitions and 699 evidence questions;
- the proven demo component in
  `src/components/assessment/drd/DRDAssessmentEditor.tsx` is the interaction
  donor, adapted to the current light style and left navigation;
- cards provide description, example, explanation, questions, comment,
  attachment/link and previous/next navigation;
- evidence, respondent knowledge, claim, assessor judgment and approval remain
  separate records; the UI cannot convert a click or uploaded file into a
  validated maturity score automatically.

The donor's `Target` location conflicts with the final separation of Interview
AS-IS and Matrix TO-BE. Expert reconciliation must decide the final control
placement before implementation; no ambiguous mixed-state design may ship.

## 4. Matrix

Matrix is both the maturity visualization and transformation workspace:

- reads the exact canonical AS-IS state from Interview;
- shows evidence confidence, gaps, conflicts and non-contiguous capability
  patterns honestly;
- sets and persists TO-BE separately from AS-IS;
- records the specific transformation steps selected between current and
  intended state;
- supports cell details with description, example, technologies and distinct
  AS-IS/TO-BE actions;
- supports full-screen view;
- allows revision-anchored human comments;
- never assumes every company should reach maximum maturity.

## 5. Report

Report is expert interpretation of approved evidence and Matrix state, not a
score dump. It explains what was established, what it means in this enterprise,
which development direction makes sense and why, within a foreseeable horizon.

The interactive Report contains seven selectable axis chapters. Every chapter:

1. opens with a 120–180 word axis synthesis;
2. includes an export-quality axis Matrix and 30–60 word analytical caption;
3. includes one 110–170 word commentary per applicable area;
4. closes with a 180–260 word cross-area conclusion and decision line.

Every area commentary covers factual state, assessment/confidence, enterprise
meaning, gap/target rationale and next step. Facts, uncertainty, expert
inference and recommendations are visibly distinct. Piotr's book under
`knowledge/DRD/` and the pinned method/QBank provide methodology grounding.

Each axis can be exported as PDF. `Eksportuj wszystko` assembles all seven
chapters in canonical order with contents, pagination, revision/method metadata
and honest draft/approval marking. Export renders a saved revision and never
regenerates different prose.

The existing `DRD_REPORT_SPEC.md` uses eight communication dimensions. This
conflicts with the current seven-axis chapter decision and requires a formal,
versioned canon reconciliation before coding.

## 6. Settings and governance

Settings contains:

1. `Informacje o dokumencie`;
2. `Subskrypcja i wykorzystanie`;
3. `Zespół i uprawnienia`;
4. `Akceptacje` (working label);
5. `Wersje`.

Team capabilities distinguish document access, answering, assessment,
answer approval, target/Matrix approval and report approval. The currently
enumerated gates are:

`approved AS-IS answers/evidence → approved target/Matrix → approved report`

Every approval identifies actor, time and exact revision. Upstream edits make
affected downstream approvals stale/reopened rather than silently preserving a
misleading accepted state.

The paid entitlement card shows subscription/payment state, seats and report
credits. Unpaid/demo use permits clearly temporary exploration but no answer
persistence and no report generation. Report metering needs atomic,
idempotent consume/refund rules; clicking, failure or retry must not double
charge. Version restore creates a new revision and never rewrites history.

## 7. Collaboration and AI

Matrix and Report support object-anchored comment threads with author, time,
revision and resolve/reopen state. Comments cannot change canonical scoring or
approval implicitly.

AI Analysis acts as a skeptical reviewer. It detects missing evidence,
contradictions, unjustified targets, omitted dependencies, weak conclusions,
stale downstream content and alternative options. It returns a sourced list of
proposed changes with rationale and uncertainty. A human accepts, edits or
rejects each proposal. AI never writes or approves silently and cannot bypass
subscription or role gates.

## 8. Reusable architecture boundary

The shared Assessment shell owns Library/Processes, navigation, permissions,
approvals, comments, versions, AI proposal workflow and exports. A versioned
method definition/adapter owns hierarchy, terminology, item/answer model,
scoring, applicability, evidence policy, target capability, Matrix capability,
report template and methodology sources.

DRD-specific numbers and semantics — seven axes, 39 areas, native level counts,
QBank, Matrix and seven report chapters — cannot be hard-coded as universal
Assessment behavior. A second structurally different method fixture must prove
that the shell is truly reusable.

## 9. Unresolved decisions before implementation

1. Resolve Interview-only AS-IS versus donor card's `Target` control.
2. Reconcile seven axis chapters with the existing eight report dimensions.
3. Confirm whether approvals are three gates or two higher-level groups and
   confirm the final Polish Settings card label.
4. Define canonical Report identity across the in-session Report workspace and
   the shared Reports register.
5. Approve the method-definition schema, scoring/applicability rules and
   evidence-quality gate.
6. Decide report-credit consumption, retry/refund and re-generation policy.
7. Define separation of duties, self-approval, quorum/delegation and approval
   invalidation rules.
8. Prove persistence/readback, concurrency conflicts, attachment security,
   accessibility, PDF quality and cross-method reuse.

## 10. Acceptance boundary

The owner review has produced a detailed target contract, not a completed
implementation. No current screen is `OWNER_ACCEPTED` merely because its
desired replacement is documented. Final acceptance requires a reconciled
specification, implementation on a frozen candidate, automated and runtime
proof, complete seeded-data walkthrough, PDF inspection and Piotr's explicit
owner acceptance.

The completed two-round skeptical audit is recorded in
`ASSESSMENT_COMPLETE_EXPERT_AUDIT_2026-08-23.md`. All three reviewers returned
`INCOMPLETE`, with specification coverage between 7.9 and 8.1/10. Its C1–C15
closure list is the required reconciliation step before the document can be
treated as conditionally complete for implementation.
