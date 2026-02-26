# Consulting Tools v3 — “One task per consulting tool” (Tool Specs SSOT)

> **Status:** Draft (v3 SSOT)  
> **Purpose:** A complete, implementation-ready plan **per consulting tool** (non-licensed).  
> Each tool spec includes: Library preview content, wizard/workflow steps, expected result surface (table/workspace/hybrid), CTAs to outputs, and traceability requirements.
>
> **Important:** Licensed assessments (DRD/SIRI/ADMA) are handled as **Methodology Packs** (separate artefact SSOT) and are **out of scope** for this document.

## 0) References (SSOT)

- Consulting Tools module workflow: `docs/product/CONSULTING_TOOLS_V3.md`
- Tools catalog (library registry): `docs/product/TOOLS_CATALOG_V3.md`
- Source traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- Link Graph (context/backlinks): `docs/product/LINK_GRAPH_V3.md`
- UI/UX canon (must):
  - Module hub: `docs/ui-standards/03-modules/module-hub-standard.md`
  - View modes: `docs/ui-standards/03-modules/view-modes-standard.md`
  - Table preview: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - Workspace tools strip: `docs/ui-standards/02-components/workspace-3-tools-strip.md`

---

## 1) Canonical spec template (copy 1:1)

Every consulting tool must have the following sections fully completed (PL+EN where applicable).

### 1.1 Library preview (must be complete)

- **Name (EN/PL)**
- **Category**: Strategy / Operations / Digital / Process Automation
- **Short description (EN/PL)**: 1–2 sentences
- **Goal / outcome**: what decision it enables
- **When to use**: scenarios + anti-scenarios
- **Inputs**:
  - required vs optional
  - “what to ask the client”
  - “what consultant assumptions can be added”
- **How it works**: steps in plain language
- **What you get**: bullet list
- **Outputs** (capabilities): Initiative / Report / Presentation
- **Common mistakes** (typical pitfalls)
- **Example** (1 short example)
- **Next steps** (CTAs)
- **KB links** (internal/external)
- **Preview graphic (MUST)**: canonical representation (what the illustration must show)
- **Micro-video (MUST)**: 60s avatar script outline

### 1.2 Wizard / session workflow (must be consistent across tools)

All tools follow the universal skeleton (SSOT: `CONSULTING_TOOLS_V3.md`):

1) Define intent  
2) Inputs + Assumptions (with attachments/links)  
3) Work surface (table/workspace/hybrid)  
4) Review (summaries + missing items checklist)  
5) Finalize (locks session; eligible to outputs)  
6) Outputs (Create Initiative / Report / Presentation)

### 1.3 Result surface (must be explicit)

Choose one:

- **Table-first** (structured rows/columns, optionally with preview pane)
- **Workspace-first** (canvas/diagram, with a supporting table if needed)
- **Hybrid** (both)

Also specify:

- which parts are collapsible sections,
- when to open Workspace,
- whether we need split view (table on left, comments/insights on right).

### 1.4 Outputs & traceability (must)

- **Initiatives**: can be 1..N; must link to a finalized source (`ToolSession FINALIZED`)
- **Reports/Presentations**: drafts must store `source_type/source_id/source_version` and offer “Open source”

SSOT: `SOURCE_TRACEABILITY_SPEC.md`.

---

## 2) Tool inventory (v3) — 31 consulting tools

Canonical tool types (as implemented in tool store) are:

- **Strategy (1–10)**:
  1. `dynamic-swot`
  2. `market-forces`
  3. `growth-paths`
  4. `value-chain`
  5. `portfolio-priority`
  6. `ambition-decomposer`
  7. `focus-tradeoff`
  8. `risk-uncertainty`
  9. `capability-mapper`
  10. `narrative-engine`
- **Operations (11–20)**:
  11. `vsm-builder`
  12. `sop-builder`
  13. `a3-problem-solving`
  14. `smed-planner`
  15. `dms-builder`
  16. `automation-pipeline`
  17. `constraint-control`
  18. `decision-engine`
  19. `control-tower`
  20. `inventory-autopilot`
- **Digital (21–30)**:
  21. `robotics-feasibility`
  22. `logistics-automation`
  23. `rpa-scanner`
  24. `ai-discovery`
  25. `integration-diagnostic`
  26. `digital-value-pool`
  27. `legacy-analyzer`
  28. `data-inventory`
  29. `pain-to-solution`
  30. `pain-explorer`
- **Process Automation (31)**:
  31. `process-automation`

> Note: UI labels may use slightly different human names. The implementation must align slugs across:  
> library (`known tools`), sessions (`tool_sessions.tool_type`), and runtime (tool store `ToolType`).

### 2.1 Tool slug governance (MUST) — canonical vs legacy aliases

**Canonical key for a tool (v3):** `toolType` (the slug used by ToolSession + runtime store).

This is the value that must be stable across:

- Library entries (Known Tools)
- Session creation (`ToolSession.tool_type`)
- Runtime (wizard/workspace configuration)
- Output traceability labels (“Open source”)
- Knowledge base routing (Help/KB module ID override)

#### 2.1.1 Known observed legacy IDs (as-is) and required convergence

Some as-is UI surfaces use legacy IDs that do not match the canonical `toolType`. v3 must converge on canonical slugs, but can keep **aliases** for deep links/backward compatibility.

| Canonical `toolType` | Legacy/alternate IDs observed in code | v3 rule |
|---|---|---|
| `ai-discovery` | `ai-usecase-discovery` | accept legacy deep-link, but persist canonical in session/source |
| `legacy-analyzer` | `legacy-drag` | same as above |
| `pain-explorer` | `structured-pain-explorer` | same as above |
| `pain-explorer` | `structured-pain` (docs) | docs must point to canonical `pain-explorer` |

**Policy:** UI can display friendly labels, but must never create sessions with a non-canonical toolType.

---

## 3) Tool specs (one section per tool)

Below are complete “plans” per tool, designed to be converted into tasks.
Where content is not yet authored, fields are explicitly marked as **TBD** (not omitted).

> **Universal outputs (default):** “Create initiative batch”, “Generate report/deck”.  
> Tool-specific outputs refine what is inside that batch/report/deck.

---

### 3.1 Tool #1 — Dynamic SWOT (`dynamic-swot`) — Strategy

#### Library preview
- **Name (EN/PL)**: Dynamic SWOT / Dynamiczny SWOT
- **Goal**: fast situation diagnosis → actionable implications → draft initiatives
- **When to use**:
  - **Use**: quick strategic diagnosis, alignment workshop, early discovery
  - **Avoid**: when you already have a validated problem tree and need execution planning (use A3 / roadmap tools)
- **Inputs (required)**:
  - business goal, scope, timeframe
  - top signals from interviews/data (links/attachments encouraged)
  - key constraints (budget, resources, deadlines)
- **Assumptions (consultant adds)**:
  - market context, benchmark heuristics, interpretation caveats
- **How it works**:
  - collect signals → group SWOT → normalize → derive implications (SO/WO/ST/WT) → propose initiatives
- **What you get**: SWOT matrix + prioritized implications + 3–7 initiative concepts
- **Common mistakes**: mixing symptoms/causes; too many items; no link to actions
- **Example**: weakness “lead time” + opportunity “supplier digitalization” → initiative “supplier portal + forecasting”
- **Next steps (CTAs)**: Create initiatives batch; Generate report/deck
- **KB**: TBD (internal article + examples)
- **Preview graphic (MUST)**: SWOT 2×2 + correlation lines (SO/WO/ST/WT) + “initiative chips”
- **Micro‑video (60s)**:
  - 0–10s: what is Dynamic SWOT
  - 10–25s: what inputs we need (signals, goals, constraints)
  - 25–45s: how we transform SWOT into implications + initiatives
  - 45–60s: what you get + next step outputs

#### Wizard / session plan
- **Define**: goal/scope/timeframe
- **Inputs**: signals importer (notes/interviews + attachments/links) + “assumptions” field
- **Work surface**: hybrid
  - table for items (quadrant, impact, source)
  - optional workspace for mapping correlations
- **Review**: missing checklist (context + at least N items per quadrant + correlations)
- **Finalize**: lock snapshots
- **Outputs**: initiatives batch + report/deck drafts (traceable)

---

### 3.2 Tool #2 — Market Forces (Porter) (`market-forces`) — Strategy

#### Library preview
- **Name (EN/PL)**: Market Forces (Porter) / Siły rynkowe (Porter)
- **Goal**: translate competitive pressure into strategic risks/levers and initiative concepts
- **Inputs (required)**: industry definition, geography scope, competitors, buyers/suppliers structure, substitutes/entrants signals
- **Work**: score each force + evidence + pressure points + levers → initiatives
- **What you get**: 5 forces scorecard + key risks + 3–7 initiative concepts
- **Preview graphic**: 5-forces diagram with scores + “lever chips”
- **Micro‑video**: explain “scoring + evidence → levers → initiatives”
- **KB**: TBD

#### Wizard plan
- Define: market boundary & position
- Inputs: evidence prompts per force + attachments/links
- Work surface: table-first (5 forces rows, drivers list)
- Review: missing drivers per force
- Outputs: initiatives + report/deck

---

### 3.3 Tool #3 — Growth Paths (Ansoff) (`growth-paths`) — Strategy

#### Library preview
- **Name (EN/PL)**: Growth Paths (Ansoff) / Ścieżki wzrostu (Ansoff)
- **Goal**: explore growth options and select feasible bets with risk framing
- **Inputs**: current products/segments, adjacent markets, capabilities, risk appetite
- **Preview graphic**: 2×2 matrix (market/product) + option cards
- **Micro‑video**: “map options → pick 1–2 → enabling initiatives”
- **KB**: TBD

#### Wizard plan
- Define: growth goal & constraints
- Work surface: matrix + option list (table or cards)
- Review: too many paths / missing capability gaps
- Outputs: initiatives batch (per chosen path) + deck

---

### 3.4 Tool #4 — Value Chain Analysis (`value-chain`) — Strategy

#### Library preview
- **Name (EN/PL)**: Value Chain / Łańcuch wartości
- **Goal**: identify value/cost hotspots and target improvement initiatives
- **Inputs**: primary/support activities, cost drivers, pain points (quality/SLA)
- **Preview graphic**: value chain blocks with hotspot highlights
- **Micro‑video**: “map activities → mark hotspots → propose levers → initiatives”
- **KB**: TBD

#### Wizard plan
- Work surface: hybrid (workspace map + table hotspot list)
- Outputs: initiative package “hotspots → levers”

---

### 3.5 Tool #5 — Portfolio Prioritization (`portfolio-priority`) — Strategy

#### Library preview
- **Name (EN/PL)**: Portfolio Prioritization / Priorytetyzacja portfolio
- **Goal**: rank initiatives by impact/effort and constraints → decide stop/scale/sequence
- **Inputs**: candidate initiatives list, impact/effort, constraints, dependencies
- **Preview graphic**: matrix + ranked list
- **Micro‑video**: “score → sort → select top picks”
- **KB**: TBD

#### Wizard plan
- Work: interactive board (table + matrix view)
- Review: missing scores / missing constraints
- Outputs: initiatives updates + report/deck

---

### 3.6 Tool #6 — Ambition Decomposer (`ambition-decomposer`) — Strategy

#### Library preview
- **Name (EN/PL)**: Ambition Decomposer / Dekompozycja ambicji
- **Goal**: translate vision into measurable dimensions and trade-offs
- **Inputs**: vision statement, strategic targets, stakeholders
- **Preview graphic**: ambition tree (vision → dimensions → metrics)
- **Micro‑video**: “vision → dimensions → initiatives”
- **KB**: TBD

#### Wizard plan
- Work: table-first + optional workspace tree
- Outputs: initiative clusters per dimension

---

### 3.7 Tool #7 — Focus & Trade-off (`focus-tradeoff`) — Strategy

#### Library preview
- **Name (EN/PL)**: Focus & Trade-off / Fokus i kompromisy
- **Goal**: identify conflicts and what NOT to do; generate exit/stop initiatives
- **Inputs**: competing priorities, constraints, stakeholder positions
- **Preview graphic**: trade-off map (A vs B) + decision notes
- **Micro‑video**: “conflicts → choices → stop/exit initiatives”
- **KB**: TBD

#### Wizard plan
- Work: table (conflicts) + optional workspace map
- Outputs: decision package + initiatives

---

### 3.8 Tool #8 — Risk & Uncertainty (`risk-uncertainty`) — Strategy

#### Library preview
- **Name (EN/PL)**: Risk & Uncertainty / Ryzyko i niepewność
- **Goal**: map assumptions/risks, simulate scenarios, generate resilience initiatives
- **Inputs**: assumptions, risk items (probability/impact), mitigations
- **Preview graphic**: risk heatmap + scenario list
- **Micro‑video**: “assumptions → risks → mitigations → initiatives”
- **KB**: TBD

#### Wizard plan
- Work: interactive board (risk register) + heatmap view
- Outputs: mitigation initiatives + report

---

### 3.9 Tool #9 — Capability Mapper (`capability-mapper`) — Strategy

#### Library preview
- **Name (EN/PL)**: Capability Mapper / Mapa kompetencji
- **Goal**: map capabilities, maturity, gaps → focused roadmap initiatives
- **Inputs**: target outcomes, current capabilities, maturity evidence
- **Preview graphic**: capability map + gap highlights
- **Micro‑video**: “map → gaps → build initiatives”
- **KB**: TBD

#### Wizard plan
- Work: table (capability rows) + optional map
- Outputs: capability-building initiatives

---

### 3.10 Tool #10 — Narrative & Alignment (`narrative-engine`) — Strategy

#### Library preview
- **Name (EN/PL)**: Narrative & Alignment / Narracja i wyrównanie
- **Goal**: create coherent strategy narrative and test alignment
- **Inputs**: strategy choices, stakeholder messages, target audiences
- **Preview graphic**: narrative structure + alignment score
- **Micro‑video**: “build narrative → test alignment → communication initiatives”
- **KB**: TBD

#### Wizard plan
- Work: document-first (structured sections) + alignment checklist
- Outputs: comms initiatives + deck/report

---

### 3.11 Tool #11 — VSM Builder (`vsm-builder`) — Operations

#### Library preview
- **Name (EN/PL)**: VSM Builder / Kreator VSM
- **Goal**: visualize flow, waste, and improvement priorities (current → future state)
- **Inputs**: process scope, steps, times, inventories, demand/volume
- **Preview graphic**: VSM map (boxes + timeline)
- **Micro‑video**: “current state → waste → future state → initiatives”
- **KB**: TBD (lean/VSM best practices)

#### Wizard plan
- Work surface: workspace-first (VSM canvas) + table for steps/data box
- Outputs: initiative package “future state actions” + report

---

### 3.12 Tool #12 — SOP Builder (`sop-builder`) — Operations

#### Library preview
- **Name (EN/PL)**: SOP Builder / Kreator SOP
- **Goal**: create repeatable standard work + checklists + training-ready steps
- **Inputs**: process steps, quality criteria, roles, frequency
- **Preview graphic**: SOP page + checklist
- **Micro‑video**: “capture steps → standardize → checklist → training”
- **KB**: TBD

#### Wizard plan
- Work: table-first (steps) + document summary
- Outputs: SOP artefact draft + initiatives for rollout/training

---

### 3.13 Tool #13 — A3 Problem Solving (`a3-problem-solving`) — Operations

#### Library preview
- **Name (EN/PL)**: A3 Problem Solving / A3 rozwiązywanie problemów
- **Goal**: structured root cause analysis (PDCA/5Why) → countermeasures + follow-up KPIs
- **Inputs**: problem statement, evidence, baseline metrics
- **Preview graphic**: A3 one-page layout
- **Micro‑video**: “problem → causes → countermeasures → KPI tracking”
- **KB**: TBD

#### Wizard plan
- Work: document-first with sections + supporting table for causes/actions
- Outputs: initiative package + KPI suggestions (Results linkable)

---

### 3.14 Tool #14 — SMED Planner (`smed-planner`) — Operations

#### Library preview
- **Name (EN/PL)**: SMED Planner / Planer SMED
- **Goal**: reduce changeover time; separate internal/external; compute ROI of improvements
- **Inputs**: changeover steps, time per step, constraints
- **Preview graphic**: internal vs external split + ROI card
- **Micro‑video**: “map steps → classify → improve → quantify”
- **KB**: TBD

#### Wizard plan
- Work: table-first (steps) + summary ROI section
- Outputs: improvement initiatives + report

---

### 3.15 Tool #15 — Daily Management System (`dms-builder`) — Operations

#### Library preview
- **Name (EN/PL)**: Daily Management System / System zarządzania dziennego
- **Goal**: define tier meetings, KPIs, escalation rules, and issue→initiative pipeline
- **Inputs**: org structure, key KPIs, meeting cadence
- **Preview graphic**: tier cadence + KPI board
- **Micro‑video**: “cadence + KPIs + escalation → operating rhythm”
- **KB**: TBD

#### Wizard plan
- Work: interactive board (tiers, KPIs, escalation)
- Outputs: initiatives for rollout + report/deck

---

### 3.16 Tool #16 — Automation Pipeline (`automation-pipeline`) — Operations

#### Library preview
- **Name (EN/PL)**: Automation Pipeline / Pipeline automatyzacji
- **Goal**: build prioritized automation backlog from ops insights (RPA/workflow/AI/integrations)
- **Inputs**: pain points, process steps, constraints, tech landscape
- **Preview graphic**: backlog board + ROI ranges
- **Micro‑video**: “collect candidates → classify → prioritize → roadmap”
- **KB**: TBD

#### Wizard plan
- Work: table + kanban (classify) + prioritization matrix
- Outputs: initiative batch (automation roadmap)

---

### 3.17 Tool #17 — Constraint Control (`constraint-control`) — Operations

#### Library preview
- **Name (EN/PL)**: Constraint Control Loop / Pętla sterowania ograniczeniami
- **Goal**: define bottlenecks, dispatch rules, capacity alerts (TOC)
- **Inputs**: throughput system, constraint candidates, WIP policies
- **Preview graphic**: constraint map + rules
- **Micro‑video**: “find constraint → rules → alerts → actions”
- **KB**: TBD

#### Wizard plan
- Work: table-first (constraints, rules, alerts) + optional map
- Outputs: initiatives + operating rules report

---

### 3.18 Tool #18 — Decision Engine (`decision-engine`) — Operations

#### Library preview
- **Name (EN/PL)**: Decision Automation Engine / Silnik automatyzacji decyzji
- **Goal**: map decision points and define policy rules; simulate automation impact
- **Inputs**: decision catalog, policy constraints, risk tolerance
- **Preview graphic**: decision tree + policy blocks
- **Micro‑video**: “catalog → rules → simulate → initiatives”
- **KB**: TBD

#### Wizard plan
- Work: table-first (decisions & rules) + optional flowchart workspace
- Outputs: initiatives for policy-as-code automation

---

### 3.19 Tool #19 — Control Tower (`control-tower`) — Operations

#### Library preview
- **Name (EN/PL)**: Shopfloor Control Tower / Wieża kontroli
- **Goal**: design visibility dashboard (states, anomalies, actions)
- **Inputs**: critical processes, KPIs, anomaly types, response protocols
- **Preview graphic**: dashboard mock + alert flow
- **Micro‑video**: “visibility → anomalies → actions”
- **KB**: TBD

#### Wizard plan
- Work: hybrid (board of metrics + protocol checklist)
- Outputs: initiatives + deck for leadership

---

### 3.20 Tool #20 — Inventory Autopilot (`inventory-autopilot`) — Operations

#### Library preview
- **Name (EN/PL)**: Inventory Autopilot / Autopilot zapasów
- **Goal**: classify SKUs, define replenishment policies, simulate cash/stockout impact
- **Inputs**: SKU groups, demand variability, lead times, service level targets
- **Preview graphic**: ABC/XYZ map + policy table
- **Micro‑video**: “classify → policies → simulate → initiatives”
- **KB**: TBD

#### Wizard plan
- Work: interactive board (SKU classes + policies)
- Outputs: initiatives + report

---

### 3.21 Tool #21 — Robotics Feasibility (`robotics-feasibility`) — Digital

#### Library preview
- **Name (EN/PL)**: Robotics Feasibility / Wykonalność robotyki
- **Goal**: evaluate processes for robotization potential; estimate ROI ranges and prerequisites
- **Inputs**: process candidates, volumes, constraints, safety requirements
- **Preview graphic**: candidate map + feasibility scorecard
- **Micro‑video**: “screen candidates → feasibility → ROI range → roadmap”
- **KB**: TBD

#### Wizard plan
- Work: table-first (candidates) + scoring
- Outputs: initiatives + deck

---

### 3.22 Tool #22 — Logistics Automation (`logistics-automation`) — Digital

#### Library preview
- **Name (EN/PL)**: Logistics Automation / Automatyzacja logistyki
- **Goal**: identify intralogistics automation potential (AMR/ASRS/slotting) + roadmap
- **Inputs**: warehouse/process map, volumes, constraints, layout hints
- **Preview graphic**: automation map + feasibility scores
- **Micro‑video (60s)**:
  - 0–10s: what the tool does (logistics automation opportunities)
  - 10–25s: what inputs we need (flows, volumes, constraints, layout hints)
  - 25–45s: how we work (opportunity map + feasibility + prerequisites + ROI range)
  - 45–60s: what you get (roadmap) + next steps (initiatives + deck)
- **KB**: TBD

#### Wizard plan
- **Define**:
  - scope (warehouse / transport / picking / packing / yard)
  - service level goals and constraints (space, safety, labor availability)
- **Inputs & assumptions**:
  - volumes (daily/weekly), seasonality, SKU profile
  - layout hints / photos / existing WMS data exports (attachments/links encouraged)
  - consultant assumptions: benchmark ranges, typical prerequisites, caveats
- **Work surface**: hybrid
  - table-first “opportunity map”:
    - area/flow, candidate automation, feasibility score, prerequisites, rough ROI range
  - optional workspace (layout/flow sketch) for communicating the target concept
- **Review**:
  - missing: volumes + constraint list + at least 3 candidate opportunities
  - “unknowns checklist”: data quality, safety constraints, integration readiness
- **Finalize**: lock session snapshot (inputs + assumptions + shortlist)
- **Outputs**:
  - initiatives batch (pilots + prerequisites + roadmap)
  - deck outline (executive-ready “why + what + roadmap”)

---

### 3.23 Tool #23 — RPA Scanner (`rpa-scanner`) — Digital

#### Library preview
- **Name (EN/PL)**: RPA Scanner / Skaner RPA
- **Goal**: identify transactional processes suitable for RPA/workflow/API automation
- **Inputs**: process list, exception rate, data quality, integration constraints
- **Preview graphic**: automation heatmap + use-case list
- **Micro‑video (60s)**:
  - 0–10s: what RPA Scanner is (find best automation candidates)
  - 10–25s: inputs (process list + frequency/volume + exception rate + constraints)
  - 25–45s: how it works (score suitability → classify workflow/RPA/API/AI)
  - 45–60s: outputs (prioritized backlog) + next steps (initiatives + report)
- **KB**: TBD

#### Wizard plan
- **Define**:
  - target domain (finance, HR, procurement, customer service, back-office)
  - target goals (cycle time, cost, error rate, compliance)
- **Inputs & assumptions**:
  - candidate process list (from interviews + org context)
  - exception rate, data quality, frequency/volume, risk/compliance notes
  - attachments: screenshots, forms, SOPs, example cases
- **Work surface**: table-first
  - rows = candidate processes
  - columns = suitability signals (rule-based vs judgment, stability, data availability, integration constraints)
  - classification = `workflow | rpa | api | ai | none`
- **Review**:
  - missing: at least N candidates + basic sizing fields + integration blockers notes
- **Finalize**
- **Outputs**:
  - initiatives batch (top candidates + prerequisite initiatives)
  - report (automation backlog + sizing logic)

---

### 3.24 Tool #24 — AI Discovery (`ai-discovery`) — Digital

#### Library preview
- **Name (EN/PL)**: AI Use‑Case Discovery / Odkrywanie przypadków użycia AI
- **Goal**: find real AI use cases; assess data readiness; identify blockers
- **Inputs**: decisions, data assets, process pains, compliance constraints
- **Preview graphic**: portfolio + readiness score
- **Micro‑video (60s)**:
  - 0–10s: what AI Discovery is (use-case portfolio)
  - 10–25s: inputs (decisions, pains, data assets, constraints)
  - 25–45s: how it works (value + feasibility + data readiness + risk controls)
  - 45–60s: outputs (pilots + foundations) + next steps (initiatives + deck)
- **KB**: TBD

#### Wizard plan
- **Define**:
  - business domain + decision areas (what decisions improve)
  - risk appetite and compliance constraints
- **Inputs & assumptions**:
  - candidate use cases (from interviews + existing data/integration context)
  - data readiness signals (sources, owners, quality, latency)
  - attachments: sample datasets, reports, screenshots, policies
- **Work surface**: table-first (portfolio)
  - rows = use case candidates
  - columns = value hypothesis, feasibility, data readiness, risk controls, “pilot next step”
  - optional board view: now/later/never or quick wins vs foundations
- **Review**:
  - missing: at least N candidates + data owners + top 3 blockers
- **Finalize**
- **Outputs**:
  - initiatives batch:
    - pilots (quick wins)
    - foundations (data/platform/governance)
  - deck/report draft for steering committee

---

### 3.25 Tool #25 — Integration Diagnostic (`integration-diagnostic`) — Digital

#### Library preview
- **Name (EN/PL)**: Integration Diagnostic / Diagnostyka integracji IT
- **Goal**: map system interactions; find integration debt; recommend architecture improvements
- **Inputs**: system list, interfaces, pain points, SLAs
- **Preview graphic**: integration map + critical points
- **Micro‑video (60s)**:
  - 0–10s: what it does (integration reality map)
  - 10–25s: inputs (systems, interfaces, pains, evidence)
  - 25–45s: how it works (map → classify criticality → identify debt patterns)
  - 45–60s: outputs (quick fixes + target architecture roadmap) + next steps
- **KB**: TBD

#### Wizard plan
- **Define**:
  - scope: business capability / application landscape slice
  - target outcomes: latency reduction, changeability, reliability
- **Inputs & assumptions**:
  - system list, key integrations/interfaces, pain points (incidents, manual workarounds)
  - attachments: architecture diagrams, interface inventories, logs, SLA docs
  - consultant assumptions: integration patterns, typical failure modes, “good enough” target state
- **Work surface**: hybrid
  - workspace-first: integration map (systems + connections + critical paths)
  - supporting table: interface catalog (type, owner, criticality, issues, target approach)
- **Review**:
  - missing: owners + criticality tags + at least 5 key interfaces mapped
- **Finalize**
- **Outputs**:
  - initiatives batch (quick fixes + target architecture steps)
  - report/deck (integration debt narrative + roadmap)

---

### 3.26 Tool #26 — Digital Value Pool (`digital-value-pool`) — Digital

#### Library preview
- **Name (EN/PL)**: Digital Value Pool / Pule wartości cyfrowej
- **Goal**: locate where digitalization changes economics (capital, decisions, quality, scale)
- **Inputs**: value drivers, cost base, operational constraints
- **Preview graphic**: value pool map + EBITDA impact card
- **Micro‑video (60s)**:
  - 0–10s: what value pools are (where digital changes economics)
  - 10–25s: inputs (drivers, baseline signals, constraints)
  - 25–45s: how it works (identify pools → estimate levers → shortlist initiatives)
  - 45–60s: outputs (value thesis + roadmap) + next steps
- **KB**: TBD

#### Wizard plan
- **Define**:
  - value lens: cost, revenue, capital, quality, decision speed
  - scope: product line / plant / function
- **Inputs & assumptions**:
  - baseline economics signals (cost drivers, waste, decision delays)
  - attachments: P&L extracts, KPI boards, process metrics
  - consultant assumptions: benchmark levers and value ranges
- **Work surface**: table-first
  - rows = value pools (where digital changes economics)
  - columns = lever, hypothesis, prerequisites, rough ROI range, initiative candidates
- **Review**:
  - missing: baseline driver evidence + at least 3 pools + assumptions noted
- **Finalize**
- **Outputs**:
  - initiatives batch (value pool → initiative packages)
  - deck (value thesis + roadmap)

---

### 3.27 Tool #27 — Legacy Analyzer (`legacy-analyzer`) — Digital

#### Library preview
- **Name (EN/PL)**: Legacy Drag Analyzer / Analizator oporu legacy
- **Goal**: quantify legacy drag in decision latency, change cost, and operational risk
- **Inputs**: key systems, change processes, incident patterns
- **Preview graphic**: drag scorecard + migration alternatives
- **Micro‑video (60s)**:
  - 0–10s: what legacy drag means (latency/change cost/risk)
  - 10–25s: inputs (evidence: incidents, release logs, workarounds, integrations)
  - 25–45s: how it works (scorecard → root causes → option set)
  - 45–60s: outputs (decision options + initiatives) + next steps
- **KB**: TBD

#### Wizard plan
- **Define**:
  - scope: which systems / which business impact (decisions, changes, risk)
- **Inputs & assumptions**:
  - evidence prompts: change lead time, incident patterns, manual workarounds, integration friction
  - attachments: incident reports, release logs, architecture snapshots
  - consultant assumptions: “drag metrics” interpretation and caveats
- **Work surface**: table-first
  - scorecard: latency, change cost, operational risk (and supporting evidence)
  - migration alternatives list (options, trade-offs, prerequisites)
- **Review**:
  - missing: evidence for each score dimension + target outcome definition
- **Finalize**
- **Outputs**:
  - initiatives batch (stabilize/decouple/modernize)
  - report/deck (legacy drag narrative + decision options)

---

### 3.28 Tool #28 — Data Inventory (`data-inventory`) — Digital

#### Library preview
- **Name (EN/PL)**: Data Asset & Gap Inventory / Inwentaryzacja danych i luk
- **Goal**: map decisions to required data; identify gaps; find unused data waste
- **Inputs**: decision catalog, data sources, ownership/governance hints
- **Preview graphic**: decision→data map + gap list
- **Micro‑video (60s)**:
  - 0–10s: what it does (map decisions to data)
  - 10–25s: inputs (decision catalog, sources, owners, evidence)
  - 25–45s: how it works (mapping → gaps → priorities)
  - 45–60s: outputs (data foundation initiatives) + next steps
- **KB**: TBD

#### Wizard plan
- **Define**:
  - scope: decision areas + target reporting/AI needs
- **Inputs & assumptions**:
  - decision catalog (from interviews), current data sources, ownership/governance hints
  - attachments: data dictionaries, reports, extracts, system lists
  - consultant assumptions: “minimum viable data” and governance baseline
- **Work surface**: table-first
  - mapping table: decision → required data → source → gap → owner → initiative suggestion
- **Review**:
  - missing: owners + source mapping + at least N decisions mapped
- **Finalize**
- **Outputs**:
  - initiatives batch (data foundation, governance, instrumentation)
  - report/deck (data gap thesis)

---

### 3.29 Tool #29 — Pain‑to‑Solution (`pain-to-solution`) — Digital

#### Library preview
- **Name (EN/PL)**: Pain‑to‑Solution / Problem→Rozwiązanie
- **Goal**: translate discovery insights into solution classes and vendor archetypes
- **Inputs**: pain statements, constraints, target outcomes, integration requirements
- **Preview graphic**: mapping table + “solution archetype cards”
- **Micro‑video (60s)**:
  - 0–10s: what it does (turn pains into solution paths)
  - 10–25s: inputs (structured pains + constraints + target outcomes)
  - 25–45s: how it works (map → shortlist archetypes → prerequisites)
  - 45–60s: outputs (pilot initiatives + recommendation deck) + next steps
- **KB**: TBD

#### Wizard plan
- **Define**:
  - scope: domain + target outcomes (cycle time, cost, compliance, experience)
- **Inputs & assumptions**:
  - structured pains (ideally from Pain Explorer tool / interviews)
  - constraints: integration, security, process change readiness
  - consultant assumptions: solution archetypes and selection heuristics
- **Work surface**: hybrid
  - table-first mapping: pain → solution class → technology archetype → prerequisites
  - optional cards view for “solution archetypes” (scan-friendly)
- **Review**:
  - missing: pain statement quality + constraints + at least 3 mappings
- **Finalize**
- **Outputs**:
  - initiatives batch (solution pilots + prerequisites)
  - deck/report (recommendations + rationale + next steps)

---

### 3.30 Tool #30 — Pain Explorer (`pain-explorer`) — Digital

#### Library preview
- **Name (EN/PL)**: Structured Pain Explorer / Eksplorator problemów
- **Goal**: convert chaotic descriptions into structured problems, hypotheses, and initiative drafts
- **Inputs**: raw descriptions, stakeholders, constraints
- **Preview graphic**: problem tree + hypothesis list
- **Micro‑video (60s)**:
  - 0–10s: what it does (structure chaotic pains)
  - 10–25s: inputs (raw descriptions + evidence + stakeholders)
  - 25–45s: how it works (problem statement → hypotheses → unknowns checklist)
  - 45–60s: outputs (experiment/pilot initiatives + alignment report/deck)
- **KB**: TBD

#### Wizard plan
- **Define**:
  - domain/context + who is impacted
- **Inputs & assumptions**:
  - raw pain descriptions (chat + attachments + links)
  - stakeholders and constraints
  - consultant assumptions: problem-framing heuristics and caveats
- **Work surface**: hybrid
  - document-first: problem statement + scope + hypothesis list
  - supporting table: pains (symptoms), candidate causes, evidence, “unknowns”
  - optional workspace: problem tree map for workshops
- **Review**:
  - missing: clear problem statement + evidence links + top hypotheses
- **Finalize**
- **Outputs**:
  - initiatives batch (hypotheses → experiments/pilots)
  - report/deck draft for alignment

---

### 3.31 Tool #31 — Process Automation (`process-automation`) — Process Automation

> Full detailed workflow is canonical in `CONSULTING_TOOLS_V3.md` (reference tool spec).

#### Library preview
- **Name (EN/PL)**: Process Automation by AI / Automatyzacja procesu (AI)
- **Goal**: map process → optimize (lean) → propose automation tech (reuse) → compute payback/ROI
- **Inputs**: process steps, decision points, times, volume, labor cost assumptions, CAPEX/OPEX hints
- **Preview graphic**: flowchart + step table + ROI summary card
- **Micro‑video**: “process map → lean → automation → economics → initiatives”
- **KB**: lean principles + automation patterns (TBD)

#### Wizard plan (must be hybrid)
- Work: workspace flowchart + table (1 row per step) + economics summary
- Outputs: initiatives batch + optional report/deck

---

## 4) Next step: converting specs into implementation tasks

From this SSOT we can now generate:

- **31 tasks** (one per consulting tool) to author:
  - preview content (PL+EN),
  - wizard questions/sections,
  - result surface (table/workspace/hybrid),
  - preview illustration requirements,
  - 60s avatar micro-video script,
  - DoD and acceptance.
- **1 cross-cutting task**: build the universal wizard shell and per-tool configuration mapping (so that 31 tools do not mean 31 bespoke UIs).

