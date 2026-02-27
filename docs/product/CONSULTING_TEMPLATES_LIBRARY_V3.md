# Consulting Templates Library v3 (SSOT) — 60 classic consulting tools

> **Status:** Draft (v3 SSOT)  
> **Scope:** Implementation contract + data/UX/runtime spec for the classic frameworks library:  
> - Strategy (20)  
> - Operations (20)  
> - Digital Transformation (20)  
>
> **Goal:** For **every** classic consulting tool we have a precise, unambiguous answer to:  
> **“How does it work in Consultify?”** (wizard steps, workspace artifact, DoD validation, initiative generation, outputs, assets, traceability)

## 0) Related SSOT (mandatory)

- Consulting Tools module workflow: `docs/product/CONSULTING_TOOLS_V3.md`
- Tools catalog (surfaces + Workspace engine canon): `docs/product/TOOLS_CATALOG_V3.md`
- Tool specs SSOT (31 interactive consulting toolTypes): `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- Traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- Link Graph (embedded refs + backlinks): `docs/product/LINK_GRAPH_V3.md`
- UI/UX canon (must):
  - `docs/ui-standards/03-modules/module-hub-standard.md`
  - `docs/ui-standards/03-modules/view-modes-standard.md`
  - `docs/ui-standards/03-modules/app-table-standard.md`
  - `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- Classic method source docs (method + examples):
  - `wdrozenia/modules/tools/catalog/strategy/`
  - `wdrozenia/modules/tools/catalog/operations/`
  - `wdrozenia/modules/tools/catalog/transformation/`

---

## 1) Definitions (canonical)

### 1.1 Consulting Template

**Consulting Template** = classic consulting framework delivered as a **Workspace-first ToolSession**.

It is not a bespoke editor. It is a configuration of:

- a fixed **template slug** (stable ID),
- a fixed **workspace mode** (Templates / Flowchart / ProcessFlow / VSM),
- a deterministic **artifact structure** (blocks / matrix / scorecard / tree / map),
- a deterministic **DoD validation** (what blocks finalization),
- deterministic **initiative generation mapping** (how we convert findings to initiatives).

### 1.2 Relationship to “31 consulting tools”

- The **31 consulting tools** are the “interactive AI tools” and are tracked by Known Tools content completeness (`tools` registry + KB) and described in `CONSULTING_TOOLS_TOOL_SPECS_V3.md`.
- The **60 classic frameworks** in this document are the **template library** used by the Workspace engine (Consulting Templates mode).

Both run as **ToolSession** and must follow the same workflow skeleton:

**Define → Inputs & Assumptions → Work (Workspace) → Review (missing items + summary) → Finalize → Outputs**

### 1.3 Non-negotiables (v3)

- **One engine**: Workspace is the only editor (no bespoke “Canvas editors” per framework).
- **Propose → accept**: AI never overwrites user work.
- **Traceability**: outputs (initiatives/reports/decks) must store `source_type/source_id/source_version` and provide “Open source”.
- **Finalization gate**: initiatives/reports/decks are eligible only after ToolSession is finalized.
- **Links/backlinks**: every session supports embedded references + platform backlinks (`LINK_GRAPH_V3.md`).

---

## 2) Runtime contract (how templates run in the app)

### 2.1 Surface type

All templates are **Workspace-first** and use the canonical 2-column layout:

- **Left (Workspace canvas)**: the template artifact (blocks/matrix/tree/map).
- **Right (Control panel)**: status, DoD checklist, review/finalize, export, initiative generation, context links, AI suggestions.

### 2.2 ToolSession payload (logical data model)

ToolSession stores:

- `tool_type`: template slug (exactly as in section 4 inventory below)
- `answers_json` (template payload), with a shared skeleton:

```json
{
  "define": {
    "intent": "string",
    "scope": "string",
    "timeHorizon": "string",
    "audience": "string"
  },
  "inputs": {
    "facts": ["string"],
    "attachments": ["artifactRefOrUrl"],
    "links": ["url"],
    "assumptions": ["string"]
  },
  "workspace": {
    "mode": "templates|flowchart|processflow|vsm",
    "artifact": { "type": "string", "version": 1, "payload": {} }
  },
  "review": {
    "missingItems": ["string"],
    "summary": "string",
    "keyInsights": ["string"],
    "risksAndUnknowns": ["string"]
  },
  "initiativeDrafts": [
    {
      "title": "string",
      "rationale": "string",
      "expectedImpact": "string",
      "effort": "Low|Medium|High",
      "risks": ["string"],
      "firstSteps": ["string"],
      "trace": { "sourceBlockId": "string", "sourceItemId": "string" }
    }
  ]
}
```

### 2.3 DoD validation contract

Each template defines a DoD checklist that blocks finalization until satisfied.

Canonical DoD rules format:

- **Must-have fields**: `define.intent`, `define.scope`, `define.timeHorizon`
- **Artifact completeness**: minimum required blocks/items filled
- **Evidence policy**: key claims must have evidence links or be explicitly tagged as assumptions
- **Insights gate**: at least 3 key insights (unless user marks “insufficient evidence” with reason)
- **Initiatives gate**: at least 3 initiative drafts OR “no initiatives” with reason

### 2.4 Initiative generation (deterministic mapping)

Initiatives are generated from the artifact using deterministic rules per template:

- each initiative links back to a **specific artifact element** (block/card/node/row),
- initiative fields are standardized (title, rationale, impact, effort, risks, first steps),
- output batch size defaults: 3–7, max: 12.

### 2.5 Exports

Templates must support:

- **PDF** export (tool snapshot + summary + key visuals),
- **PNG/SVG** export of the workspace artifact when applicable (slide-ready),
- optional **PPTX** export via Presentations generator (traceable blocks).

---

## 3) Archetypes (implementation building blocks)

Every template must choose exactly one archetype (sometimes with a secondary supporting table view):

- **A — Blocks canvas** (fixed blocks + cards; tags: evidence/assumption/risk/action)
- **B — 2×2 matrix** (items with x/y scoring + rationale)
- **C — Portfolio grid (multi-cell)** (e.g. 3×3)
- **D — Tree / decomposition** (nodes/edges + optional hypotheses)
- **E — Scorecard** (dimensions + scores + evidence)
- **F — Map / flow** (process/customer journey/system map)
- **G — Roadmap / waves** (time + dependencies + owners)
- **H — Economics** (baseline/target, CAPEX/OPEX, payback)

### 3.1 Canonical “graphic presentation” per archetype (MUST)

This section is the single, reusable source-of-truth for “what the user should see” (and what we use as preview graphics and marketing visuals).

- **A — Blocks canvas**
  - **Must show**: named blocks + cards with tags (`evidence/assumption/risk/action`) + a right-side panel with DoD + “Generate initiatives”.
  - **Export visual**: one-page canvas snapshot (PNG/PDF) + summary cards.
- **B — 2×2 matrix**
  - **Must show**: axes labels + quadrant semantics + items placed (with tooltips or score pills) + supporting table view.
  - **Export visual**: matrix PNG + top items list.
- **C — Portfolio grid**
  - **Must show**: grid cells + cell strategy labels + entities plotted with size (optional) + “recommended actions”.
  - **Export visual**: grid PNG + actions table.
- **D — Tree / decomposition**
  - **Must show**: root question node + MECE branches + leaf nodes; optional hypothesis board; optional bridge-to-target.
  - **Export visual**: tree SVG/PNG + hypothesis list.
- **E — Scorecard**
  - **Must show**: dimensions list + score scale + evidence links + “gap” indicators + recommended actions.
  - **Export visual**: scorecard table + heat strip.
- **F — Map / flow**
  - **Must show**: nodes/edges diagram + labels + hotspot markers + drilldown drawer; for process flows include timing fields.
  - **Export visual**: diagram PNG/PDF + hotspot → initiatives mapping table.
- **G — Roadmap / waves**
  - **Must show**: waves/timeline + dependencies + owners + risk badges + “what is blocked”.
  - **Export visual**: roadmap timeline + waves table.
- **H — Economics**
  - **Must show**: baseline vs target + assumptions + savings model + payback/ROI card + scenario toggles.
  - **Export visual**: economics summary card + assumptions appendix.

---

## 4) Inventory (60 templates; canonical slugs)

### 4.1 Strategy (20)

1. `mece-issue-tree`
2. `hypothesis-driven-strategy`
3. `pyramid-principle`
4. `pestel`
5. `market-sizing-tam-sam-som`
6. `customer-segmentation`
7. `jobs-to-be-done`
8. `competitive-benchmarking`
9. `porter-generic-strategies`
10. `strategic-positioning`
11. `vrio`
12. `core-competencies`
13. `blue-ocean-strategy`
14. `errc-grid`
15. `ge-mckinsey-9-box`
16. `experience-curve`
17. `bcg-advantage-matrix`
18. `three-horizons`
19. `business-model-canvas`
20. `balanced-scorecard`

### 4.2 Operations (20)

21. `value-stream-mapping-vsm`
22. `sipoc`
23. `dmaic`
24. `kaizen-pdca`
25. `gemba-walk`
26. `standard-work`
27. `5s`
28. `root-cause-5whys-fishbone`
29. `kanban-wip-limits`
30. `bottleneck-analysis-toc`
31. `smed`
32. `oee`
33. `tpm`
34. `spc-control-charts`
35. `process-capability-cpk`
36. `fmea`
37. `abc-xyz-inventory`
38. `safety-stock-reorder-point`
39. `sales-and-operations-planning-sn-op`
40. `scor-model`

### 4.3 Digital Transformation (20)

41. `digital-transformation-assessment`
42. `target-operating-model-tom`
43. `transformation-roadmap`
44. `benefits-case-value-tracking`
45. `current-state-architecture-map`
46. `target-architecture-blueprint`
47. `application-portfolio-rationalization`
48. `technology-standards-guardrails`
49. `data-strategy-data-operating-model`
50. `data-governance`
51. `data-quality-management`
52. `ai-use-case-factory`
53. `process-mining`
54. `automation-opportunity-assessment`
55. `customer-journey-digitization-map`
56. `product-operating-model`
57. `agile-at-scale`
58. `capability-skills-gap-analysis`
59. `change-management-plan-adkar`
60. `digital-risk-assessment`

---

## 5) Template specs (implementation-ready)

> Format per template:
> - **Slug / Category / Archetype / Workspace mode**
> - **Artifact structure** (blocks/axes/dimensions/nodes)
> - **Wizard: Define / Inputs / Work / Review**
> - **DoD validation rules**
> - **Initiative generation mapping**
> - **Exports**
> - **Knowledge source** (internal canonical doc path)
> - **Authoritative references** (minimum 1 web link when available; otherwise book citation)

---

### Strategy #1 — MECE & Issue Trees (`mece-issue-tree`)

- **Category**: Strategy
- **Archetype**: D (Tree / decomposition) + supporting board (hypotheses)
- **Workspace mode**: Templates (tree editor)
- **Artifact structure**:
  - `tree.nodes[]`: `type = root|kpi|driver|mechanism|leaf`, `label`, optional `formula`
  - `tree.edges[]`
  - `hypotheses[]`: one per leaf (statement, test, threshold, status)
  - optional `bridgeToTarget[]`: quantified contributions
- **Wizard**:
  - **Define**: root question (decision-grade), KPI baseline/target, constraints
  - **Inputs**: evidence links (finance/KPIs/interviews), assumptions register
  - **Work**: build tree → create hypotheses → prioritize (impact×uncertainty×speed) → bridge
  - **Review**: top 3–5 validated hypotheses + risks/unknowns
- **DoD**:
  - root KPI baseline+target present
  - numeric first layer exists (formula node) OR explicit “non-numeric” reason
  - ≥8 leaves OR “simple scope” reason
  - ≥5 hypotheses with tests
  - ≥3 initiatives mapped to leaf nodes OR “insufficient evidence” reason
- **Initiatives mapping**:
  - each validated leaf → 1–2 initiatives, `trace.sourceItemId = leafNodeId`
- **Exports**: tree diagram (PNG/SVG), summary PDF
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/mece-issue-tree.md`
- **References**:
  - [McKinsey Alumni — Barbara Minto on MECE](https://www.mckinsey.com/alumni/news-and-insights/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it)
  - Minto, Barbara. *The Minto Pyramid Principle* (book)

---

### Strategy #2 — Hypothesis-Driven Strategy (`hypothesis-driven-strategy`)

- **Category**: Strategy
- **Archetype**: D (Tree) + experiment plan table
- **Workspace mode**: Templates
- **Artifact structure**:
  - issue tree + hypotheses
  - `tests[]`: test design (method, data needed, owner, timebox, decision threshold)
- **Wizard**:
  - Define: decision question + timebox
  - Inputs: evidence inventory + data gaps
  - Work: generate hypotheses, design minimal tests, prioritize
  - Review: “what to test next” checklist + initiative candidates (experiments)
- **DoD**:
  - ≥5 hypotheses with explicit disproof tests
  - ≥3 tests assigned owners/timebox
- **Initiatives mapping**:
  - tests become initiatives (experiment/pilot), trace to hypothesisId
- **Exports**: PDF (tree + test plan)
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/hypothesis-driven-strategy.md`
- **References**: internal canonical doc + case interview style guides (bookless; use internal)

---

### Strategy #3 — Pyramid Principle (Minto) (`pyramid-principle`)

- **Category**: Strategy
- **Archetype**: D (Narrative tree)
- **Workspace mode**: Templates
- **Artifact structure**:
  - `scqa`: situation/complication/question/answer
  - `pyramid`: answer-first top line + supporting points (MECE)
  - `storyline`: ordered outline
- **Wizard**:
  - Define: audience + decision required
  - Inputs: facts vs assumptions, evidence links
  - Work: build SCQA + pyramid outline; mark weak evidence
  - Review: “executive-ready narrative” checklist
- **DoD**:
  - top-line answer present
  - ≥3 supporting points, each with evidence link or explicit assumption tag
- **Initiatives mapping**:
  - gaps in evidence become initiatives (“collect data”, “validate assumption”)
- **Exports**: outline PDF; optional deck outline (traceable)
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/pyramid-principle.md`
- **References**:
  - [Barbara Minto — concept page](https://www.barbaraminto.com/concept.html)

---

### Strategy #4 — PESTEL (`pestel`)

- **Category**: Strategy
- **Archetype**: E (Scorecard)
- **Workspace mode**: Templates
- **Artifact structure**:
  - dimensions: P/E/S/T/E/L
  - each item: signal, impact, likelihood, horizon, evidence, implication, initiative hook
- **Wizard**:
  - Define: market boundary + horizon
  - Inputs: sources list (links), assumptions register
  - Work: capture signals per dimension → synthesize implications
  - Review: top risks/opportunities + missing signals checklist
- **DoD**:
  - ≥2 signals per dimension OR explicit “not relevant” note per dimension
  - ≥3 implications and ≥3 initiative drafts
- **Initiatives mapping**:
  - each implication → initiative (mitigation / capture opportunity)
- **Exports**: PDF scorecard + implications
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/pestel.md`
- **References**: internal canonical doc

---

### Strategy #5 — Market Sizing (TAM/SAM/SOM) (`market-sizing-tam-sam-som`)

- **Category**: Strategy
- **Archetype**: D (Driver tree) + H (economics light)
- **Workspace mode**: Templates
- **Artifact structure**:
  - driver tree with variables, sources, ranges
  - scenarios: base/low/high
- **Wizard**:
  - Define: market definition + geography + time horizon
  - Inputs: data sources + assumptions
  - Work: build top-down + bottom-up estimates; reconcile
  - Review: sensitivity + biggest unknowns
- **DoD**:
  - at least one top-down AND one bottom-up path (or explicit reason)
  - all key variables have source link or assumption tag
- **Initiatives mapping**:
  - “unknowns” become initiatives (data acquisition, validation experiments)
- **Exports**: PDF + CSV of variables
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/market-sizing-tam-sam-som.md`
- **References**: internal canonical doc

---

### Strategy #6 — Customer Segmentation (STP) (`customer-segmentation`)

- **Category**: Strategy
- **Archetype**: A (Blocks) + E (scorecard per segment)
- **Workspace mode**: Templates
- **Artifact structure**:
  - segments list with needs, size, willingness-to-pay, accessibility
  - target choice + positioning statement per target
- **DoD**:
  - ≥3 segments defined OR explicit “single segment market”
  - each segment has “why it matters” + evidence/assumption tags
- **Initiatives mapping**:
  - per target segment: go-to-market / product changes
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/customer-segmentation.md`
- **References**: internal canonical doc

---

### Strategy #7 — Jobs To Be Done (JTBD) (`jobs-to-be-done`)

- **Category**: Strategy
- **Archetype**: F (Job map) + E (forces)
- **Workspace mode**: Templates
- **Artifact structure**:
  - job map stages (define/locate/prepare/confirm/execute/monitor/modify/conclude)
  - forces of progress: push/pull/anxiety/habit
- **DoD**:
  - ≥5 job statements with outcomes
  - ≥3 insights + ≥3 initiative drafts
- **Initiatives mapping**:
  - unmet outcomes → initiatives; experiment plan optional
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/jobs-to-be-done.md`
- **References**: internal canonical doc

---

### Strategy #8 — Competitive Benchmarking (`competitive-benchmarking`)

- **Category**: Strategy
- **Archetype**: E (Scorecard table)
- **Workspace mode**: Templates
- **Artifact structure**:
  - dimensions (price, quality, SLA, features, reach, etc.)
  - competitors list + scores + evidence links
- **DoD**:
  - ≥3 competitors OR explicit “monopoly market”
  - evidence links for top 5 claims
- **Initiatives mapping**:
  - gaps → initiatives; “defend advantage” items also become initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/competitive-benchmarking.md`

---

### Strategy #9 — Porter’s Generic Strategies (`porter-generic-strategies`)

- **Category**: Strategy
- **Archetype**: A (Choice blocks) + E (trade-off scorecard)
- **Workspace mode**: Templates
- **Artifact structure**:
  - choice: cost leadership / differentiation / focus (and why)
  - required capabilities + stop-doing list
- **DoD**:
  - explicit strategy choice OR explicit “hybrid” justification with risks
- **Initiatives mapping**:
  - capability gaps and stop-doing items → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/porter-generic-strategies.md`

---

### Strategy #10 — Strategic Positioning (Porter) (`strategic-positioning`)

- **Category**: Strategy
- **Archetype**: A (Positioning blocks) + F (activity system map)
- **Workspace mode**: Templates
- **Artifact structure**:
  - positioning statement
  - activity system nodes (fit), links, “break points”
- **DoD**:
  - positioning statement complete
  - ≥10 activities OR explicit “small scope”
- **Initiatives mapping**:
  - activity changes → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/strategic-positioning.md`

---

### Strategy #11 — VRIO (`vrio`)

- **Category**: Strategy
- **Archetype**: E (Scorecard)
- **Workspace mode**: Templates
- **Artifact structure**:
  - resources/capabilities rows
  - VRIO checks per row + evidence + resulting implication
- **DoD**:
  - ≥5 capabilities assessed
  - each “advantage” claim has evidence or explicit assumption
- **Initiatives mapping**:
  - build/protect/monetize actions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/vrio.md`

---

### Strategy #12 — Core Competencies (`core-competencies`)

- **Category**: Strategy
- **Archetype**: A (Blocks) + E (maturity)
- **Workspace mode**: Templates
- **Artifact structure**:
  - competencies list, maturity, strategic relevance, investment needs
- **DoD**: ≥5 competencies + target maturity per top 3
- **Initiatives mapping**: close gaps via training/hiring/partnership initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/core-competencies.md`

---

### Strategy #13 — Blue Ocean Strategy (`blue-ocean-strategy`)

- **Category**: Strategy
- **Archetype**: B (Strategy canvas) + B (ERRC)
- **Workspace mode**: Templates
- **Artifact structure**:
  - factors of competition (x-axis) + value curve (as-is vs to-be)
  - ERRC grid items
- **DoD**: ≥8 factors + to-be curve + ≥6 ERRC actions
- **Initiatives mapping**: ERRC actions → initiatives, trace to factor/action
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/blue-ocean-strategy.md`

---

### Strategy #14 — ERRC Grid (`errc-grid`)

- **Category**: Strategy
- **Archetype**: B (2×2 blocks)
- **Workspace mode**: Templates
- **Artifact structure**: eliminate/reduce/raise/create lists with tags
- **DoD**: ≥2 items per quadrant OR explicit empty justification
- **Initiatives mapping**: each item → initiative
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/errc-grid.md`

---

### Strategy #15 — GE–McKinsey 9-box (`ge-mckinsey-9-box`)

- **Category**: Strategy
- **Archetype**: C (3×3 grid) + supporting table
- **Workspace mode**: Templates
- **Artifact structure**:
  - axis definitions (attractiveness, strength)
  - business units list with x/y scores + evidence
- **DoD**: axes defined + ≥5 units scored
- **Initiatives mapping**: cell rule (invest/select/harvest) → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/ge-mckinsey-9-box.md`

---

### Strategy #16 — Experience Curve (BCG) (`experience-curve`)

- **Category**: Strategy
- **Archetype**: H (economics) + E (assumptions)
- **Workspace mode**: Templates
- **Artifact structure**:
  - cost vs cumulative volume curve + learning rate assumptions
  - levers (scale, standardization, automation)
- **DoD**: baseline cost + volume + learning rate assumption + sensitivity
- **Initiatives mapping**: levers → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/experience-curve.md`

---

### Strategy #17 — BCG Advantage Matrix (`bcg-advantage-matrix`)

- **Category**: Strategy
- **Archetype**: C (grid) + E
- **Workspace mode**: Templates
- **Artifact structure**: business positions mapped to advantage type; recommended plays
- **DoD**: ≥3 positions mapped + explicit playbook per position
- **Initiatives mapping**: plays → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/bcg-advantage-matrix.md`

---

### Strategy #18 — Three Horizons (`three-horizons`)

- **Category**: Strategy
- **Archetype**: G (roadmap horizons)
- **Workspace mode**: Templates
- **Artifact structure**:
  - H1/H2/H3 initiatives with funding/metrics
- **DoD**: at least one initiative per horizon (or explicit reason)
- **Initiatives mapping**: already initiative-shaped; ensure trace links + owners + metrics
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/three-horizons.md`

---

### Strategy #19 — Business Model Canvas (`business-model-canvas`)

- **Category**: Strategy
- **Archetype**: A (blocks canvas)
- **Workspace mode**: Templates
- **Artifact structure**: 9 blocks, each with cards tagged evidence/assumption/risk/action
- **DoD**:
  - all 9 blocks have ≥1 card OR “not applicable” note
  - ≥5 assumptions tagged + ≥3 experiments drafted
- **Initiatives mapping**:
  - assumptions → experiments as initiatives; action cards → initiatives
- **Exports**: canvas PNG/PDF
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/business-model-canvas.md`
- **References**:
  - [Strategyzer — Business Model Canvas (official)](https://www.strategyzer.com/canvas/business-model-canvas)

---

### Strategy #20 — Balanced Scorecard (`balanced-scorecard`)

- **Category**: Strategy
- **Archetype**: A (objectives blocks) + E (measures) + G (initiatives roadmap)
- **Workspace mode**: Templates
- **Artifact structure**:
  - perspectives: Financial/Customer/Internal/Learning
  - objectives per perspective with measures, targets, owners
- **DoD**:
  - ≥2 objectives per perspective OR explicit reason
  - each objective has 1–2 measures + owner
- **Initiatives mapping**: objective gaps → initiatives; trace to objectiveId
- **Knowledge source**: `wdrozenia/modules/tools/catalog/strategy/balanced-scorecard`
- **References**:
  - [HBR — Using the Balanced Scorecard as a Strategic Management System](https://hbr.org/2007/07/using-the-balanced-scorecard-as-a-strategic-management-system)

---

## Operations (20)

### Operations #21 — Value Stream Mapping (VSM) (`value-stream-mapping-vsm`)

- **Category**: Operations
- **Archetype**: F (map/flow) + H (quantification)
- **Workspace mode**: VSM
- **Artifact structure**:
  - steps with CT/wait/WIP + info flow + timeline VA/NVA
  - future-state rules list
- **DoD**: scope start/end + ≥3 steps with CT+wait; VA/NVA computed; ≥5 initiatives
- **Initiatives mapping**: hot spot step → initiative(s)
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/value-stream-mapping-vsm.md`
- **References**:
  - [Lean Enterprise Institute — Learning to See](https://www.lean.org/store/book/learning-to-see/)

---

### Operations #22 — SIPOC (`sipoc`)

- **Category**: Operations
- **Archetype**: A (blocks/table)
- **Workspace mode**: Templates
- **Artifact structure**: suppliers/inputs/process/outputs/customers table with owners + evidence
- **DoD**: all 5 columns filled; ≥5 process steps; ≥3 gaps/risks
- **Initiatives mapping**: gaps in inputs/outputs/controls → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/sipoc.md`

---

### Operations #23 — DMAIC (`dmaic`)

- **Category**: Operations
- **Archetype**: G (phase flow)
- **Workspace mode**: Templates
- **Artifact structure**:
  - phases Define/Measure/Analyze/Improve/Control with required sections
  - baseline + target + control plan
- **DoD**: problem statement + baseline + root cause + countermeasures + control plan
- **Initiatives mapping**: Improve actions + Control cadence items → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/dmaic.md`

---

### Operations #24 — Kaizen / PDCA (`kaizen-pdca`)

- **Category**: Operations
- **Archetype**: G
- **Workspace mode**: Templates
- **Artifact structure**: Plan/Do/Check/Act board with tasks + learnings
- **DoD**: hypothesis + measure + result + next standard
- **Initiatives mapping**: actions → initiatives; trace to PDCA cardId
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/kaizen-pdca.md`

---

### Operations #25 — Gemba Walk (`gemba-walk`)

- **Category**: Operations
- **Archetype**: A (observation log)
- **Workspace mode**: Templates
- **Artifact structure**: observations with location/time, evidence, theme tags, suggested action
- **DoD**: ≥10 observations + ≥3 themes + ≥3 initiatives
- **Initiatives mapping**: theme → initiative batch (quick wins + systemic)
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/gemba-walk.md`

---

### Operations #26 — Standard Work (`standard-work`)

- **Category**: Operations
- **Archetype**: A/F
- **Workspace mode**: Templates
- **Artifact structure**: steps, critical points, checks, takt/cycle, training notes
- **DoD**: complete step list + critical checks + owner + review cadence
- **Initiatives mapping**: rollout/training/audit initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/standard-work.md`

---

### Operations #27 — 5S (`5s`)

- **Category**: Operations
- **Archetype**: G (stages) + E (audit)
- **Workspace mode**: Templates
- **Artifact structure**: Sort/Set/Shine/Standardize/Sustain + audit checklist
- **DoD**: before/after evidence + audit cadence + owners
- **Initiatives mapping**: stage actions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/5s.md`

---

### Operations #28 — Root Cause Analysis (5 Whys + Fishbone) (`root-cause-5whys-fishbone`)

- **Category**: Operations
- **Archetype**: D (cause tree) + A (fishbone categories)
- **Workspace mode**: Templates
- **Artifact structure**: problem statement + fishbone + 5whys chain + countermeasures
- **DoD**: evidence for problem + at least one root cause + countermeasure + follow-up metric
- **Initiatives mapping**: countermeasures → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/root-cause-5whys-fishbone.md`

---

### Operations #29 — Kanban & WIP Limits (`kanban-wip-limits`)

- **Category**: Operations
- **Archetype**: F (flow board) + E (policies)
- **Workspace mode**: Templates
- **Artifact structure**: workflow states + WIP limits + policies + classes of service
- **DoD**: explicit policies + limits + cadence + metrics
- **Initiatives mapping**: policy changes + tooling/data initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/kanban-wip-limits.md`

---

### Operations #30 — TOC Bottleneck Analysis (`bottleneck-analysis-toc`)

- **Category**: Operations
- **Archetype**: F/G
- **Workspace mode**: ProcessFlow
- **Artifact structure**: flow + throughput per step + constraint + buffer rules
- **DoD**: constraint identified + buffer policy + 5 focusing steps plan
- **Initiatives mapping**: exploit/subordinate/elevate actions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/bottleneck-analysis-toc.md`

---

### Operations #31 — SMED (`smed`)

- **Category**: Operations
- **Archetype**: F (steps) + H (ROI light)
- **Workspace mode**: Templates
- **Artifact structure**: changeover steps with internal/external classification + conversion actions
- **DoD**: baseline changeover time + ≥10 steps classified + future target + actions
- **Initiatives mapping**: conversion actions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/smed.md`

---

### Operations #32 — OEE (`oee`)

- **Category**: Operations
- **Archetype**: E (scorecard)
- **Workspace mode**: Templates
- **Artifact structure**: availability/performance/quality + loss tree + actions
- **DoD**: baseline OEE + top 3 losses + initiatives
- **Initiatives mapping**: loss → initiative
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/oee.md`

---

### Operations #33 — TPM (`tpm`)

- **Category**: Operations
- **Archetype**: G (pillars/rollout) + E (metrics)
- **Workspace mode**: Templates
- **Artifact structure**: pillars + routines + ownership + downtime log
- **DoD**: ownership model + routines + baseline downtime + cadence
- **Initiatives mapping**: pillar actions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/tpm.md`

---

### Operations #34 — SPC Control Charts (`spc-control-charts`)

- **Category**: Operations
- **Archetype**: E (chart config + rules)
- **Workspace mode**: Templates
- **Artifact structure**: metric definition, sampling plan, control limits, out-of-control rules
- **DoD**: measurement plan + reaction plan + training notes
- **Initiatives mapping**: instrumentation + training + reaction workflows
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/spc-control-charts.md`

---

### Operations #35 — Process Capability (Cp/Cpk) (`process-capability-cpk`)

- **Category**: Operations
- **Archetype**: E/H
- **Workspace mode**: Templates
- **Artifact structure**: spec limits, measured distribution summary, Cp/Cpk, improvement levers
- **DoD**: data window + spec limits + computed capability + actions
- **Initiatives mapping**: reduce variance actions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/process-capability-cpk.md`

---

### Operations #36 — FMEA (`fmea`)

- **Category**: Operations
- **Archetype**: E (table)
- **Workspace mode**: Templates
- **Artifact structure**: failure modes, effects, causes, controls, severity/occurrence/detection (or Action Priority)
- **DoD**: top risks identified + mitigations with owners + due dates
- **Initiatives mapping**: mitigations → initiatives (trace to rowId)
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/fmea.md`

---

### Operations #37 — Inventory Classification (ABC/XYZ) (`abc-xyz-inventory`)

- **Category**: Operations
- **Archetype**: B (matrix) + table
- **Workspace mode**: Templates
- **Artifact structure**: SKU groups with ABC and XYZ classes + policy per class
- **DoD**: classification rules documented + ≥80% SKUs classified + policy table complete
- **Initiatives mapping**: policy changes + data quality initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/abc-xyz-inventory.md`

---

### Operations #38 — Safety Stock & Reorder Point (`safety-stock-reorder-point`)

- **Category**: Operations
- **Archetype**: H (calculation) + E
- **Workspace mode**: Templates
- **Artifact structure**: demand variability, lead time variability, service level targets, formulas + assumptions
- **DoD**: service levels + formulas + governance cadence
- **Initiatives mapping**: parameter governance + forecasting improvements
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/safety-stock-reorder-point.md`

---

### Operations #39 — Sales & Operations Planning (S&OP) (`sales-and-operations-planning-sn-op`)

- **Category**: Operations
- **Archetype**: G (cadence + decisions) + E (KPIs)
- **Workspace mode**: Templates
- **Artifact structure**: monthly cycle stages + decision rights + KPIs + agenda templates
- **DoD**: cadence defined + owners + KPIs + exception rules
- **Initiatives mapping**: process rollout initiatives + data/integration initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/sales-and-operations-planning-sn-op.md`

---

### Operations #40 — SCOR Model (`scor-model`)

- **Category**: Operations
- **Archetype**: F (process map) + E (metrics)
- **Workspace mode**: Templates
- **Artifact structure**: SCOR process categories + metrics dictionary + gaps
- **DoD**: scope (which processes) + baseline metrics + gap list
- **Initiatives mapping**: gaps → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/operations/scor-model.md`
- **References**:
  - [ASCM — The SCOR Digital Standard](https://www.ascm.org/corporate-solutions/standards-tools/scor-ds/)

---

## Digital Transformation (20)

> Note: These templates must be made tool-specific (avoid boilerplate). The artifact structure below is canonical for Consultify implementation.

### Transformation #41 — Digital Transformation Assessment (`digital-transformation-assessment`)

- **Category**: Transformation
- **Archetype**: E (maturity scorecard)
- **Workspace mode**: Templates
- **Artifact structure**: dimensions (strategy/operating model/data/tech/people/security) with levels + evidence + gaps
- **DoD**: score+evidence for each dimension + top 5 gaps + initiatives
- **Initiatives mapping**: each top gap → initiative
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/digital-transformation-assessment.md`

---

### Transformation #42 — Target Operating Model (TOM) (`target-operating-model-tom`)

- **Category**: Transformation
- **Archetype**: A (blocks) + G (rollout)
- **Workspace mode**: Templates
- **Artifact structure**: capabilities, org roles, governance, cadence, KPIs
- **DoD**: TOM blocks filled + ownership + cadence
- **Initiatives mapping**: rollout initiatives per capability/governance gap
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/target-operating-model-tom.md`

---

### Transformation #43 — Transformation Roadmap (`transformation-roadmap`)

- **Category**: Transformation
- **Archetype**: G (waves + dependencies)
- **Workspace mode**: Templates
- **Artifact structure**: initiatives grouped into waves with dependencies + risks
- **DoD**: ≥2 waves + dependencies + owners + KPIs
- **Initiatives mapping**: trace preserved; generate missing prerequisites as initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/transformation-roadmap.md`

---

### Transformation #44 — Benefits Case & Value Tracking (`benefits-case-value-tracking`)

- **Category**: Transformation
- **Archetype**: H (benefits model) + G (governance)
- **Workspace mode**: Templates
- **Artifact structure**: benefits register (baseline→target), measurement plan, owners, cadence
- **DoD**: each benefit has metric + baseline + target + owner + measurement frequency
- **Initiatives mapping**: instrumentation + governance initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/benefits-case-value-tracking.md`

---

### Transformation #45 — Current-State Architecture Map (`current-state-architecture-map`)

- **Category**: Transformation
- **Archetype**: F (system map)
- **Workspace mode**: Flowchart/Templates
- **Artifact structure**: systems (nodes) + integrations (edges) + owners + criticality + pain points
- **DoD**: ≥10 systems mapped (or explicit scope) + owners + top 5 critical interfaces
- **Initiatives mapping**: integration debt fixes → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/current-state-architecture-map.md`

---

### Transformation #46 — Target Architecture Blueprint (`target-architecture-blueprint`)

- **Category**: Transformation
- **Archetype**: F/G
- **Workspace mode**: Flowchart/Templates
- **Artifact structure**: target components + migration stages + guardrails
- **DoD**: target state diagram + transition steps + risks
- **Initiatives mapping**: migration steps → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/target-architecture-blueprint.md`

---

### Transformation #47 — Application Portfolio Rationalization (`application-portfolio-rationalization`)

- **Category**: Transformation
- **Archetype**: B (2×2) + table
- **Workspace mode**: Templates
- **Artifact structure**: apps list + value/fit scores + retire/modernize/keep decisions
- **DoD**: ≥20 apps or scoped list + decision per app + top 10 actions
- **Initiatives mapping**: retire/modernize decisions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/application-portfolio-rationalization.md`

---

### Transformation #48 — Technology Standards & Guardrails (`technology-standards-guardrails`)

- **Category**: Transformation
- **Archetype**: A (catalog) + E (compliance score)
- **Workspace mode**: Templates
- **Artifact structure**: standards list (domain, rule, rationale, exceptions workflow)
- **DoD**: standards for top domains + exception process + owners
- **Initiatives mapping**: adoption rollout initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/technology-standards-guardrails.md`

---

### Transformation #49 — Data Strategy & Data Operating Model (`data-strategy-data-operating-model`)

- **Category**: Transformation
- **Archetype**: A/G
- **Workspace mode**: Templates
- **Artifact structure**: data domains, ownership, platform choices, principles, roadmap
- **DoD**: domains + ownership + prioritized roadmap
- **Initiatives mapping**: foundations + governance initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/data-strategy-data-operating-model.md`

---

### Transformation #50 — Data Governance (`data-governance`)

- **Category**: Transformation
- **Archetype**: A/G
- **Workspace mode**: Templates
- **Artifact structure**: roles (owner/steward), policies, decision rights, cadence, escalation
- **DoD**: roles assigned + top policies + cadence
- **Initiatives mapping**: implement governance operating rhythm
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/data-governance.md`

---

### Transformation #51 — Data Quality Management (`data-quality-management`)

- **Category**: Transformation
- **Archetype**: E (DQ scorecard)
- **Workspace mode**: Templates
- **Artifact structure**: DQ dimensions, rules, SLAs, monitoring, remediation backlog
- **DoD**: DQ rules for top entities + SLA + owner
- **Initiatives mapping**: remediation initiatives per entity/rule
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/data-quality-management.md`

---

### Transformation #52 — AI Use-Case Factory (`ai-use-case-factory`)

- **Category**: Transformation
- **Archetype**: G (gated pipeline) + E (readiness)
- **Workspace mode**: Templates
- **Artifact structure**: intake → triage → MVP → scale gates; each use-case has value, data, risk controls
- **DoD**: ≥10 candidates + top 3 pilots + foundations backlog
- **Initiatives mapping**: pilots + data/platform/governance foundations
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/ai-use-case-factory.md`

---

### Transformation #53 — Process Mining (`process-mining`)

- **Category**: Transformation
- **Archetype**: F (as-is model) + E (variants/conformance)
- **Workspace mode**: Templates
- **Artifact structure**:
  - event log schema: caseId, activity, timestamp (+ resource/cost optional)
  - discovered variants + bottlenecks + conformance gaps
- **DoD**: log schema defined + ≥1 log source + top 3 bottlenecks + initiatives
- **Initiatives mapping**: each bottleneck/gap → initiative; trace to variantId
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/process-mining.md`
- **References**:
  - [Springer — Process Mining: Data Science in Action (van der Aalst)](https://link.springer.com/book/10.1007/978-3-662-49851-4)

---

### Transformation #54 — Automation Opportunity Assessment (`automation-opportunity-assessment`)

- **Category**: Transformation
- **Archetype**: E/H/G
- **Workspace mode**: Templates
- **Artifact structure**: candidate list with value/feasibility/risk + delivery approach + ROI range
- **DoD**: ≥10 candidates + top 5 prioritized + assumptions + owners
- **Initiatives mapping**: top candidates + prerequisite initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/automation-opportunity-assessment.md`

---

### Transformation #55 — Customer Journey Digitization Map (`customer-journey-digitization-map`)

- **Category**: Transformation
- **Archetype**: F (journey map) + E (pain/opportunity scoring)
- **Workspace mode**: Templates
- **Artifact structure**: stages, touchpoints, pains, metrics, digital interventions
- **DoD**: journey scope + ≥5 stages + metrics + prioritized interventions
- **Initiatives mapping**: interventions → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/customer-journey-digitization-map.md`

---

### Transformation #56 — Product Operating Model (`product-operating-model`)

- **Category**: Transformation
- **Archetype**: A/G
- **Workspace mode**: Templates
- **Artifact structure**: product taxonomy, teams, funding, OKRs, governance cadence
- **DoD**: team topology + OKR examples + cadence + RACI
- **Initiatives mapping**: rollout + enablement initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/product-operating-model.md`

---

### Transformation #57 — Agile at Scale (`agile-at-scale`)

- **Category**: Transformation
- **Archetype**: A/G
- **Workspace mode**: Templates
- **Artifact structure**: ways of working, ceremonies, roles, metrics, rollout plan
- **DoD**: WoW defined + pilot plan + adoption metrics
- **Initiatives mapping**: training/coaching + tooling + governance initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/agile-at-scale.md`

---

### Transformation #58 — Capability / Skills Gap Analysis (`capability-skills-gap-analysis`)

- **Category**: Transformation
- **Archetype**: E (matrix) + G (plan)
- **Workspace mode**: Templates
- **Artifact structure**: skills matrix, current vs target, training plan, hiring plan
- **DoD**: top roles + target levels + plan + owners
- **Initiatives mapping**: upskilling/hiring/partnering initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/capability-skills-gap-analysis.md`

---

### Transformation #59 — Change Management Plan (ADKAR) (`change-management-plan-adkar`)

- **Category**: Transformation
- **Archetype**: E/G
- **Workspace mode**: Templates
- **Artifact structure**: stakeholders, ADKAR stage per segment, interventions, comms/training plan, adoption KPIs
- **DoD**: stakeholders mapped + KPIs + cadence + risk log
- **Initiatives mapping**: interventions → initiatives (trace to segmentId)
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/change-management-plan-adkar.md`
- **References**:
  - [Prosci — ADKAR Model](https://www.prosci.com/blog/adkar-model)

---

### Transformation #60 — Digital Risk Assessment (`digital-risk-assessment`)

- **Category**: Transformation
- **Archetype**: E (risk register)
- **Workspace mode**: Templates
- **Artifact structure**: risks, likelihood/impact, controls, owners, mitigations
- **DoD**: top risks + owners + mitigations + follow-up cadence
- **Initiatives mapping**: mitigations → initiatives
- **Knowledge source**: `wdrozenia/modules/tools/catalog/transformation/digital-risk-assessment.md`

---

## 6) Implementation notes (how we ship this in v3)

### 6.1 MVP packaging

Ship as:

- A **Templates library** inside Consulting Tools (Library tab) with category pills:
  - Strategy / Operations / Transformation
- Starting a template creates a ToolSession with `tool_type = <template-slug>` and `surface=workspace`.

### 6.2 Content production pipeline

For each template we must maintain:

- method doc (in `wdrozenia/.../catalog/...`)
- Consultify implementation contract (this SSOT)
- preview illustration + micro-video script (can be derived from the template spec)
- KB article (How to use) referencing the internal method doc + this contract

---

## 7) Help / KB + model context (MUST for completeness)

### 7.1 Canonical sources for help content (what we already have)

For every template slug in section 4:

- **Method + worked example**: `wdrozenia/modules/tools/catalog/<category>/<slug>.md`
- **Micro-video scenario (45–60s)**: `wdrozenia/modules/tools/catalog/movie/<slug>.md`

These two sources are sufficient to produce:

- Help article (“How to use”)
- Context pack for the model (prompt grounding + extraction schemas + self-checks)

### 7.2 KB routing rule (recommended)

To avoid collision with Known Tools KB slugs (`tools-<toolType>-how-to`), templates should use:

- `templates-<templateSlug>-how-to`

If/when we store templates in the same KB tables (`kb_articles`), `related_modules` should include the template slug.

### 7.3 Minimum “Help pack” per template (must exist)

For each template we require:

- **TL;DR (5–8 sentences)**
- **When to use / when NOT to use**
- **Inputs checklist** (required vs optional)
- **Step-by-step method** (the 6-step skeleton, with template-specific nuances)
- **Interpretation guidance** (how to read the artifact; what “good” looks like)
- **Common mistakes & fixes**
- **DoD checklist** (exact gating rules)
- **FAQ (≥8)**
- **References** (≥3, when applicable)

### 7.4 Model context pack (must exist)

For AI-assisted runs of templates, we need a compact context pack per template:

- **Non-negotiable reasoning rules** (MECE where relevant; facts vs assumptions; evidence policy)
- **Extraction schema** (JSON) for:
  - `missingItems[]`
  - `keyInsights[]`
  - `initiativeDrafts[]` (with trace pointers)
- **Self-checks** (“red flags”)

> Note: Many `wdrozenia/.../catalog/...` docs already contain AI spec + extraction schema; where missing or boilerplate, this section is the contract to upgrade them.

