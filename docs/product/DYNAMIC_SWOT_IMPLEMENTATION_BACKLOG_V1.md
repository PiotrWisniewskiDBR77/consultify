# Dynamic SWOT Implementation Backlog V1

> Status: proposed implementation backlog  
> Scope: `Dynamic SWOT` pilot tool

---

## 1. Goal

Turn `Dynamic SWOT` into the first reference implementation of the new tool standard:

- conversation-first,
- structured canvas,
- AI co-strategist,
- outputs-first ending,
- Help Center backed,
- traceable downstream artifacts.

---

## 2. Target runtime

Canonical stage flow:

1. `Mission Brief`
2. `Internal Reality`
3. `Market Reality`
4. `Strategic Tensions`
5. `Recommended Moves`
6. `Outputs`

---

## 3. Frontend workstream

### FE-01 Session stage model

- update user-facing stage model,
- align labels in runtime with the new spec,
- ensure command-row-compatible navigation.

### FE-02 Structured objects

- introduce or normalize first-class runtime objects:
  - `signal`
  - `swotCard`
  - `tension`
  - `recommendedMove`
  - `outputCandidate`

### FE-03 Canvas views

- implement `Story View` as the default,
- keep `Matrix View` as secondary classic view,
- reserve `Correlations` and `Moves` as explicit UX surfaces.

### FE-04 Right panel uplift

- replace passive panel with:
  - `Mission Pulse`
  - `AI Co-Strategist`
  - `Output Candidates`

### FE-05 Outputs step

- expose the 4 output CTAs:
  - initiative,
  - report,
  - presentation,
  - idea.

---

## 4. Backend / API workstream

### BE-01 Session schema review

- verify tool session payload can store:
  - tensions,
  - recommended moves,
  - output candidates,
  - richer context snapshot.

### BE-02 Output creation mapping

- define how `Dynamic SWOT` creates each output,
- confirm downstream source metadata is preserved.

### BE-03 Idea output gap

- review current idea creation contract,
- close the gap between tool-session traceability and idea creation if needed,
- ensure idea output is not a second-class workaround.

---

## 5. AI workstream

### AI-01 Prompt model

- refine prompts from quadrant generation to strategic conversation guidance,
- keep `propose -> accept/reject` contract.

### AI-02 Tension generation

- make tensions first-class AI suggestions,
- classify into:
  - `Attack`
  - `Repair`
  - `Defend`
  - `Protect`

### AI-03 Recommended moves

- create a dedicated move generation layer after tensions,
- support categories:
  - `Quick Win`
  - `Big Bet`
  - `Defensive Move`
  - `Capability Build`

### AI-04 Output candidates

- generate candidate initiatives and ideas before creation,
- explain why they were proposed.

---

## 6. Outputs workstream

### OUT-01 Initiative

- support 1..N initiative creation from SWOT moves,
- preserve source tool metadata.

### OUT-02 Report

- prefill report builder from SWOT session.

### OUT-03 Presentation

- prefill presentation flow from SWOT session.

### OUT-04 Idea

- support one or more ideas created from SWOT,
- preserve source context as much as current platform allows,
- define full traceability follow-up if platform contract is incomplete.

---

## 7. Help Center / content workstream

### KB-01 Canonical article

- create or upgrade `tools-dynamic-swot-how-to`,
- align article with new runtime flow.

### KB-02 Known Tools preview alignment

- align library content with Help Center article and runtime.

### KB-03 Asset assumptions

- create preview graphic assumptions,
- create micro-video script,
- define thumbnail / teaser expectations.

---

## 8. Testing / validation workstream

### QA-01 Happy path

- start tool,
- complete key stages,
- finalize,
- create one output.

### QA-02 Output path coverage

- validate all 4 output CTAs appear,
- validate initiative creation path,
- validate idea path,
- validate generator routing for report/presentation.

### QA-03 Help Center

- open tool-specific Help Center,
- confirm canonical article appears contextually,
- confirm content matches runtime.

---

## 9. Suggested implementation order

1. Upgrade output contract and runtime shell.
2. Add idea output support in the tool runtime.
3. Upgrade `Dynamic SWOT` content pack and Help Center article.
4. Refine runtime stage model and right panel.
5. Add tensions and recommended moves as explicit objects.
6. Validate end-to-end pilot path.

---

## 10. Ready-to-build DoD

`Dynamic SWOT` is ready to build when:

- output contract is approved,
- implementation workstreams are explicit,
- KB article template exists,
- content pack exists,
- key platform gaps are visible,
- the team can start FE/BE/AI work without further discovery.
