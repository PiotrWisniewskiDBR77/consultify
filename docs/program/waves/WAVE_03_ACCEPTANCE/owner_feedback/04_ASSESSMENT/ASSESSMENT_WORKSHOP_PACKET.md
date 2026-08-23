# Assessment four-mode workshop packet

Status: `WORKSHOP_READY / IMPLEMENTATION_NOT_AUTHORIZED_BY_THIS_DOCUMENT`

Date: `2026-08-23`

Owner: Piotr Wiśniewski

Product baseline inspected: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`

Primary source register: `OWNER_FEEDBACK_REGISTER.md`, findings
`ASM-OWN-001`–`ASM-OWN-009`

## 1. Outcome the workshop must produce

Approve one coherent Assessment workspace composed of four task-specific modes:

1. `Interview` — conduct the conversation one question at a time;
2. `Split` — review and manage the complete answer register;
3. `Matrix` — inspect and govern current/target maturity graphically;
4. `Report` — review the emerging assessment narrative and conclusions.

The target is deliberately hybrid:

- preserve the current implementation's lighter typography, frames, spacing
  and general visual language;
- restore the functional value of Piotr's prior level-by-area Matrix;
- replace the current cognitively overloaded Interview interaction;
- retain the backend/event-store as the only authoritative assessment state.

## 2. What is already real in the current checkout

### Backend-connected Method Core workspace

The canonical DRD route mounts `DrdMethodWorkspaceScreen` before the legacy
assessment loader. The active owner-review session proved server-backed:

- seven DRD axes and 39 units;
- answer and evidence events;
- Teresa previews;
- lifecycle transitions and freeze;
- immutable Outputs, Report snapshots and Initiative drafts.

Relevant implementation:

- `src/views/AssessmentSessionEditorView.tsx`
- `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx`
- `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`
- `src/method-core/methods/drd/drdHttpSessionRuntime.ts`
- `server/src/method-core/`

### Current shared shell

`MethodWorkspaceShell` implements only three modes:

- `Interview`;
- `Split`;
- `Matrix`.

Current behavior is not the owner target:

- Interview renders every question for the selected unit, with the full answer
  and evidence apparatus repeated for each question;
- the long navigator and Teresa panel remain visible at large breakpoints;
- Split renders the same Interview surface plus a compact `LiveMatrix` below;
- Matrix renders the generic `LiveMatrix`;
- an additional bottom `Graphic Mirror` can duplicate Matrix again;
- Report is not a workspace mode.

Relevant implementation:

- `src/components/method-workspace/MethodWorkspaceShell.tsx`
- `src/components/method-workspace/InterviewFocusPanel.tsx`
- `src/components/method-workspace/LiveMatrix.tsx`
- `src/components/method-workspace/types.ts`

### Prior owner-valued Matrix

The earlier Matrix implementation still exists in the checkout:

- `DRDMatrixSession` wraps Piotr's `MaturityMatrix`;
- it exposes all seven axes and their areas;
- it reads achieved/current and target levels;
- it allows an authorized user to change achieved level;
- it was designed to round-trip with the legacy `answers.drd.areas` structure;
- full-screen and Matrix-level editing treatments are also present in
  `DRDAssessmentEditor`.

Relevant implementation:

- `src/components/assessment/drd/DRDMatrixSession.tsx`
- `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- `src/components/MaturityMatrix.tsx`
- `src/components/assessment/drd/drdAnswersAdapter.ts`

This code is a reusable functional source, not a safe writer for Method Core as
it stands. The canonical HTTP route returns before these legacy components are
mounted.

### Report foundation

A business-facing Assessment report renderer already exists and reads Method
Core Output/session/approval data:

- `src/components/assessment/report/AssessmentReportView.tsx`
- `src/components/assessment/report/AssessmentReportDocument.tsx`
- `src/components/assessment/report/reportApi.ts`

It is currently a separate frozen-output surface rather than the fourth mode of
the live/read-only workspace. Report snapshots also exist in the Method Core
lifecycle. These two concepts must be reconciled, not duplicated.

## 3. Target contract by mode

### Interview

Primary user job: conduct a human conversation without losing place.

Default visible content:

- current axis, area, level and progress;
- exactly one current question;
- answer input and applicable answer-state choices;
- one primary `Save and continue` action;
- compact optional access to evidence, help and Teresa.

Progressive disclosure:

- methodology tree becomes an intentional navigator/drawer, not a permanently
  expanded wall;
- rationale, examples and evidence requirements open on demand;
- Teresa provides help for the current question without owning equal permanent
  screen width;
- the next question is not expanded before the current answer is dealt with.

### Split

Primary user job: audit and manage everything already answered.

Required structure:

- status/coverage summary;
- filterable answer list grouped by axis and area;
- answer text, state, evidence status and last editor visible at appropriate
  density;
- click-to-preview/edit with full-height canonical Preview;
- governed edits write through the same Method Core command path as Interview;
- discrepancies and missing evidence are findable without scanning 39 units.

Split is not Interview plus a small Matrix.

### Matrix

Primary user job: understand and govern maturity across an axis.

Required structure:

- Piotr's level-by-area matrix concept;
- achieved/current (`AS-IS`) and target (`TO-BE`) visible together;
- per-axis and cross-axis navigation;
- current, target and gap summaries;
- standard and full-screen views;
- authorized score/target adjustment with rationale;
- the same canonical Matrix visual reusable by Report.

The current generic `LiveMatrix` can supply state/evidence semantics, but it
does not replace the owner-selected level-by-area presentation.

### Report

Primary user job: review the emerging assessment story and prepare a governed
deliverable.

Required structure:

- executive summary and assessment scope;
- progress/completeness and limitations;
- Matrix visual for each included axis;
- strengths, gaps, findings and recommendations derived from traceable source
  state;
- explicit conclusions for each included section;
- review/generation state and a canonical transition into the shared Reports
  register.

Report mode must not create a second Report domain. Before freeze it may show a
clearly labelled preview/draft; after freeze it must read the immutable Output
and canonical Report snapshot.

## 4. Single-source-of-truth rule

Method Core events and server state remain authoritative.

Forbidden implementation shortcut:

- mounting the legacy Matrix and allowing it to write only
  `answers.drd.areas` while Interview writes Method Core events.

That would create two independently editable truths and reproduce the current
regression in a subtler form.

Required adapter boundary:

1. derive the four mode view models from the same Method Core session/events;
2. translate Interview, Split and Matrix edits into canonical Method Core
   commands;
3. refresh/read back server state after every governed mutation;
4. derive Report preview from the same view model before freeze;
5. switch Report to immutable Output/snapshot provenance after freeze;
6. retain actor, timestamp, evidence and rationale for every direct Matrix or
   Split correction.

## 5. Workshop decision table

| Decision                 | Recommended starting point                                                                               | Owner decision |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | -------------- |
| Interview question scope | One question at a time.                                                                                  | `PENDING`      |
| Primary Interview action | `Save and continue`.                                                                                     | `PENDING`      |
| Navigator placement      | Collapsible drawer/compact progress navigator.                                                           | `PENDING`      |
| Teresa placement         | Contextual helper opened on demand; compact state remains visible.                                       | `PENDING`      |
| Evidence placement       | Collapsible per-question section with visible evidence status.                                           | `PENDING`      |
| Split default grouping   | Axis → area → answered questions.                                                                        | `PENDING`      |
| Split edit treatment     | Full-height Preview with explicit Save/Cancel and audit reason.                                          | `PENDING`      |
| Matrix base              | Prior `DRDMatrixSession`/`MaturityMatrix` functional concept, restyled in current light visual language. | `PENDING`      |
| Matrix edit semantics    | Current and target editable only for authorized roles; rationale required.                               | `PENDING`      |
| Report before freeze     | Clearly labelled live preview, never immutable/final.                                                    | `PENDING`      |
| Report after freeze      | Immutable Output-backed document and canonical Report lifecycle.                                         | `PENDING`      |
| Graphic Mirror           | Remove as duplicate if canonical Matrix mode is accepted.                                                | `PENDING`      |
| Frozen route             | Keep four-mode read-only workspace; do not replace it with diagnostics.                                  | `PENDING`      |

## 6. Proposed implementation sequence after workshop

1. Extend the shared view-mode contract with `report` and add contract tests.
2. Introduce a DRD-specific workspace composition that preserves shared shell
   chrome but supplies the owner-approved four mode bodies.
3. Refactor Interview to a single-question controller without changing server
   commands.
4. Build Split from the event-derived answer/evidence register.
5. Adapt the prior Matrix presentation to the Method Core read/write contract.
6. Embed the existing Report renderer as live-preview/frozen-read mode and
   connect it to the canonical Reports lifecycle.
7. Replace the frozen technical page with the read-only four-mode workspace;
   move diagnostics into subordinate audit details.
8. Seed a complete representative DRD and verify Interview → Split → Matrix →
   Report → Insights/Initiatives readback.

## 7. Non-negotiable verification gates

- no parallel legacy answer store is introduced;
- a write in any editable mode is visible in the other modes after server
  readback;
- direct Matrix/target changes retain actor, rationale and evidence lineage;
- refresh and cold login preserve the same values;
- frozen sessions are read-only and retain the useful workspace;
- Report preview is never presented as a frozen/final Report;
- the Matrix embedded in Report matches the canonical Matrix state;
- local seeded fixtures cover the complete path;
- technical tests do not replace Piotr's owner workshop and final retest.

## 8. Current delivery status

| Area                            | Status                                     |
| ------------------------------- | ------------------------------------------ |
| Backend Method Core             | `PRESENT / PARTIALLY LIVE-VERIFIED`        |
| Current Interview               | `REJECTED / REBUILD_REQUIRED`              |
| Current Split                   | `WRONG SEMANTICS / REBUILD_REQUIRED`       |
| Prior Matrix functional concept | `PRESENT / ADAPTER_REQUIRED`               |
| Current Matrix                  | `NOT OWNER TARGET`                         |
| Report renderer                 | `PRESENT / WORKSPACE INTEGRATION REQUIRED` |
| Four-mode contract              | `DOCUMENTED / OWNER WORKSHOP REQUIRED`     |
| Implementation                  | `NOT STARTED`                              |
| Owner acceptance                | `NOT GRANTED`                              |
