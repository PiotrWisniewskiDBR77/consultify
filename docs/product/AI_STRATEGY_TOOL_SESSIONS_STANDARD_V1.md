# AI Strategy Tool Sessions Standard V1

> Status: working standard  
> Scope: AI-assisted strategy tool sessions in `Tools`  
> Reference runtime: `Dynamic SWOT`

---

## 1. Purpose

This document defines the reusable runtime standard for strategy sessions where a human works with AI inside one structured consulting workspace.

The goal is to prevent weak session experiences where the tool behaves like:

- a static form,
- a methodology dump,
- a hidden AI generator,
- a summary screen without decision logic.

Canonical rule:

> The session must make human judgment, AI proposals, evidence quality, and decision readiness visible in one place.

---

## 2. Core Collaboration Principle

Every strategy session must feel like a visible collaboration loop:

1. User frames the decision.
2. AI asks focused questions and explains why.
3. AI proposes structure, not final truth.
4. User accepts, edits, rejects, or challenges.
5. The canvas updates into inspectable artifacts.
6. The session ends in decision-ready outputs.

This means:

- AI never silently overwrites accepted content.
- accepted content and proposed content must be visually distinguishable,
- evidence must stay traceable into synthesis and outputs,
- the final screen must answer not only `what we found`, but also `what is ready now`.

---

## 3. Frozen Shell Contract

The session must respect existing shell canon and frozen layouts:

- keep the canonical module shell,
- keep one command row only,
- keep left navigation for business phases,
- keep one main canvas as the working surface,
- keep one right assist panel for active collaboration,
- do not introduce a parallel wizard outside the existing runtime.

The shell pattern is:

`Header -> PropertiesStrip -> ActionBar -> LeftNav + Main Canvas + Right AI Collaboration Panel`

---

## 4. Canonical Session Phases

All AI-assisted strategy tools must map to five primary phases:

1. `Mission & Context`
2. `Input & Exploration`
3. `Tool Build`
4. `Synthesis & Insights`
5. `Outputs & Actions`

Interpretation:

- `Mission & Context`: define the decision question, scope, time horizon, success signal, assumptions, and constraints.
- `Input & Exploration`: build an evidence workbench from interviews, materials, benchmarks, AI context, and platform knowledge.
- `Tool Build`: convert evidence into the method-specific structure.
- `Synthesis & Insights`: extract tensions, trade-offs, interpretations, and candidate moves.
- `Outputs & Actions`: decide what is ready for report, presentation, initiative, or idea and what is blocked.

---

## 5. Mandatory Runtime Layers

Every strategy session must expose these layers explicitly:

- `decision frame`,
- `evidence layer`,
- `structured analysis layer`,
- `insight / tension / trade-off layer`,
- `move design layer`,
- `output readiness layer`,
- `traceability to accepted evidence`.

These layers can be expressed differently by each method, but they must all exist.

---

## 6. Human + AI Contract

AI must behave in `propose -> accept/edit/reject` mode.

AI should be strongest in places where users struggle most:

- sharpening vague decision questions,
- converting loose notes into usable signals,
- deduplicating or splitting evidence,
- separating internal from external logic,
- surfacing tensions and disconfirming evidence,
- framing candidate moves,
- checking readiness for downstream outputs.

The UI must always answer:

- `What is already accepted?`
- `What is still proposed?`
- `Why is AI asking this now?`
- `What is still missing?`
- `What can be generated safely from this session?`

---

## 7. Right AI Collaboration Panel Standard

The right panel is not a passive widget column. It is the active collaboration surface.

It should contain:

- current phase mission,
- next best question,
- why this matters now,
- proposal queue,
- missing evidence or quality gaps,
- readiness signal,
- bridge to chat or generation actions.

It should not become a duplicate summary of the whole canvas.

---

## 8. Readiness Logic

Every phase should expose quality and readiness signals:

- `complete enough to continue`,
- `needs clarification`,
- `needs evidence`,
- `ready for synthesis`,
- `ready for outputs`,
- `blocked`.

Output readiness must classify work into:

- `ready for initiative`,
- `ready for executive deck`,
- `ready for report`,
- `keep as idea`,
- `blocked by missing evidence`.

---

## 9. Evidence Quality Standard

Signals should support at least:

- source group,
- evidence type: `fact / observation / hypothesis`,
- confidence,
- provenance,
- quality state: `accepted / proposed / needs evidence`.

The tool does not need full governance workflow in every phase, but the runtime must help users distinguish strong evidence from weak interpretation.

---

## 10. Reusable Runtime Objects

Strategy runtimes should model explicit objects rather than opaque text blobs.

Minimum object families:

- `missionBrief`
- `signal`
- `analysis item`
- `strategic tension` or equivalent synthesis object
- `recommended move`
- `outputCandidate`
- `finalSourceSummary`

Method-specific runtimes may add their own objects on top of this base.

---

## 11. Dynamic SWOT Reference Interpretation

`Dynamic SWOT` is the first reference implementation of this standard.

Its mapping is:

- `Mission & Context` -> decision frame for the SWOT session,
- `Input & Exploration` -> evidence workbench,
- `Tool Build` -> strengths / weaknesses / opportunities / threats,
- `Synthesis & Insights` -> tensions, correlations, conclusions, moves,
- `Outputs & Actions` -> summary, readiness, and downstream artifact routes.

What is SWOT-specific:

- quadrant logic,
- SO / WO / ST / WT correlation logic,
- attack / repair / defend / protect tension families.

What is reusable:

- visible AI coach loop,
- accepted vs proposed states,
- evidence-first synthesis,
- readiness-based output routing.

