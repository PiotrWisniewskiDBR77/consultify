# Dynamic SWOT Session Target V1

> Status: implementation draft  
> Depends on: `docs/product/AI_STRATEGY_TOOL_SESSIONS_STANDARD_V1.md`

---

## 1. Outcome

Redesign `Dynamic SWOT` from a form-like flow into a consulting-grade human + AI workspace where evidence, synthesis, and output readiness are visible throughout the session.

---

## 2. Target Session IA

The runtime keeps the existing shell but upgrades the canvas behavior.

Left navigation uses five business phases only:

1. `Mission & Context`
2. `Input & Exploration`
3. `SWOT Build`
4. `Synthesis & Insights`
5. `Outputs & Actions`

Each phase should show:

- completion state,
- current focus,
- unresolved gaps,
- readiness signal.

---

## 3. Target Canvas By Phase

### 3.1 Mission & Context

The first phase becomes a decision framing workspace.

It should expose:

- strategic question,
- business scope,
- time horizon,
- success signal,
- constraints and assumptions,
- optional KPI target.

AI behavior:

- sharpen wording,
- challenge ambiguity,
- suggest what is out of scope,
- explain what is still missing from the brief.

### 3.2 Input & Exploration

This phase becomes an evidence workbench.

It should expose:

- source groups,
- normalized signal queue,
- evidence types,
- provenance,
- confidence,
- quality state,
- missing-evidence prompts.

### 3.3 SWOT Build

This phase becomes a selective synthesis board, not a dumping matrix.

It should expose:

- a story lens above the matrix,
- accepted cards,
- proposed cards,
- evidence and confidence badges,
- ability to move items between quadrants,
- ability to promote proposals into accepted cards.

### 3.4 Synthesis & Insights

This is the consulting center of gravity.

It should expose:

- tensions,
- correlations,
- applied conclusions,
- recommended moves,
- move categories,
- what should not be done now.

### 3.5 Outputs & Actions

This phase becomes a decision bridge.

It should expose:

- final source summary,
- readiness checklist,
- output candidates,
- maturity routing,
- traceability back to evidence and moves.

---

## 4. Right AI Collaboration Panel

The right panel should actively support the current phase.

Minimum sections:

- `AI coach brief`
- `Next question`
- `Why this matters now`
- `Proposal queue`
- `Missing evidence`
- `Readiness`

The panel should never silently commit AI output. It must point the user back to explicit session state.

---

## 5. Runtime Data Interpretation

The current runtime should make these objects explicit:

- `missionBrief`
- `signal`
- `swotCard`
- `strategicTension`
- `recommendedMove`
- `outputCandidate`
- `finalSourceSummary`

Quality extensions for the current data model:

- signals should support `fact / observation / hypothesis`,
- signals should support `accepted / proposed / needs-evidence`,
- SWOT cards should support `accepted / proposed`,
- output candidates should support maturity or readiness.

---

## 6. File Mapping

### Session shell and orchestration

- `src/components/DiscoveryTools/ToolDocumentView.tsx`
- `src/components/DiscoveryTools/ToolCanvas.tsx`
- `src/components/DiscoveryTools/ToolContextPanel.tsx`

### Dynamic SWOT phase surfaces

- `src/components/DiscoveryTools/steps/ContextStep.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx`
- `src/components/DiscoveryTools/steps/SummaryStep.tsx`

### Runtime state and AI contract

- `src/store/useToolStore.ts`
- `src/hooks/discovery/useToolAI.ts`
- `src/components/DiscoveryTools/toolCompletion.ts`

---

## 7. Implementation Order

1. Extend reusable session standard and session docs.
2. Upgrade `ToolDocumentView` into a five-phase consulting workspace with richer phase signals.
3. Turn `ToolContextPanel` into a real AI collaboration panel.
4. Refactor the SWOT phase screens to show evidence quality, accepted vs proposed content, and readiness.
5. Extend store contracts for signal quality and proposal states.
6. Tighten AI prompts and JSON materialization around mission, signals, items, and output readiness.

---

## 8. Current Implementation Notes

The first implementation wave should optimize for clarity, not maximal automation.

Therefore:

- accepted vs proposed may initially be expressed through explicit item states,
- move routing can start with lightweight readiness heuristics,
- the right panel can guide actions before it becomes fully interactive,
- shell canon and frozen layout rules remain unchanged.

