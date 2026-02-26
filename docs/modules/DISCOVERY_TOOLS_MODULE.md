# Discovery Tools Module

## Overview

`Discovery Tools` replaces the previous Tools menu and sits above the Assessment module. It exposes four primary categories—Strategic Analysis, Operational Excellence, Digital Transformation, and Process Automation by AI—and links each category directly into the AI chat workspace so users can work conversationally with every methodology. The module's goal is to turn AI-guided analysis into initiative-ready outputs that flow downstream into the Initiatives module.

> **MVP v3 note:** In v3 operating model, Discovery Tools become a subset of the unified **Tools** area:
> `Tools/Library → Sessions → Reports → Presentations → Initiatives`.
> SSOT: `docs/product/OPERATING_MODEL_V3.md` and `docs/product/TOOLS_CATALOG_V3.md`.

### Navigation

- **Sidebar placement**: the Discovery Tools button renders above Assessments. Hovering reveals the four categories. Strategic, Operational, and Digital categories expose flat lists of ten tools each; Process Automation opens immediately into its dedicated wizard.
- **As-is routes (code)**:
  - hub: `/discovery-tools` → `src/views/discovery-tools/DiscoveryToolsView.tsx`
  - categories: `/discovery-tools/strategic|operational|digital|process-automation`
  - tool selection happens inside the category views (query param / deep link patterns may apply).

### Architecture

As-is (code):

- Views (routing layer):
  - `src/views/discovery-tools/DiscoveryToolsView.tsx` (landing, 4 categories)
  - `src/views/discovery-tools/StrategicToolsView.tsx`
  - `src/views/discovery-tools/OperationalToolsView.tsx`
  - `src/views/discovery-tools/DigitalToolsView.tsx`
  - `src/views/discovery-tools/ProcessAutomationView.tsx`
- Canonical tool document view (2-column):
  - `src/components/DiscoveryTools/ToolDocumentView.tsx`
- Step rendering + tool-specific steps:
  - `src/components/DiscoveryTools/ToolCanvas.tsx`
- Session orchestration + AI integration:
  - `src/components/DiscoveryTools/ToolWorkspace.tsx`
  - store: `src/store/useToolStore` (ToolSession, step defs)
  - AI hook: `src/hooks/discovery/useToolAI`

### Integration Points

- **Initiatives**: Every tool produces structured initiative ideas. Once the user confirms, `createInitiative` pushes them into `InitiativeGeneratorWizard`.
- **Projects**: Strategic & digital tools feed into project planning via the project conversion route.
- **Assessments**: Tools recommend frameworks/assessments (DRD, LEAN, SIRI, etc.) and link directly to the Assessment workspace.

### Shared Components

As-is exports (`src/components/DiscoveryTools/index.ts`):

- `ToolWorkspace`, `ToolDocumentView`, `ToolCanvas`, `ToolHeader`, `ToolActionBar`, `ToolReviewPanel`
- Visualizations: `PorterRadar`, `SWOTMatrix`

### Data Flow (mermaid)

```
flowchart TB
    UserInput --> ChatPanel
    ChatPanel -->|stream| AIService
    AIService --> EntityExtractor
    EntityExtractor --> ToolStore
    ToolStore --> VisualizationPanel
    VisualizationPanel --> InitiativeComposer
    ToolStore --> InitiativeModule
    ToolStore --> AssessmentModule
    ToolStore --> ProjectModule
```

> Note: The diagram is conceptual. In current implementation, Tool sessions are orchestrated via `ToolWorkspace` + `useToolStore` + `useToolAI`,
> and rendered as a canonical 2-column document (`ToolDocumentView`) or step canvas (`ToolCanvas`) depending on tool/category.

## Template (reused per tool)

Each tool documentation uses the following schema:

1. Executive summary
2. Business problem + value
3. User journey
4. Data inputs + validation
5. AI logic and prompts (system prompt, extraction schema, tool-specific logic)
6. Visualization specification
7. Outputs and deliverables
8. Initiative generation pattern
9. UX/UI guidelines
10. Help content

## Strategic Analysis Tools (1–10)

### 1. Dynamic SWOT (AI-Driven SWOT Analysis)

- **Executive summary**: replaces manual SWOT by gathering quantitative evidence (financials, KPIs, assessments). AI classifies facts into Strengths/Weaknesses/Opportunities/Threats and generates correlation pairs (S+O, W+T) that become initiative seeds.
- **Business value**: translates chaotic inputs into prioritized strategic bets with sources, confidence levels, and impact magnitudes.
- **User journey**: user uploads/answers prompts about evaluation data, AI suggests supporting evidence, user confirms and explores graphics.
- **Data inputs**: financial KPIs, DRD/SIRI/ADMA scores, market trend signals, project/backlog tags.
- **AI logic**: system prompt enforces data-first reasoning and outputs JSON with fields `strengths`, `weaknesses`, `opportunities`, `threats` plus `correlations`. Example prompt: `Prioritize evidence-supported factors; every response ends with JSON extraction...`
- **Visualization**: dual-pane SWOT matrix with hoverable nodes showing source, confidence, impact. Color-coded (green strengths, red threats). Responsive for mobile (stacked cards).
- **Outputs**: summary narrative, initiative list (with S+O, W+T link), downloadable graphic, conversation log.
- **Initiatives**: each correlation becomes initiative JSON with fields `id`, `name`, `rationale`, `impact`, `owner`, `enablers`.
- **UX/UI**: left chat panel, right matrix, bottom row of initiatives, top ribbon with hero stats. Buttons: `[Regenerate insights]`, `[Create initiative]`, `[Download matrix]`.
- **Help content**: explains how to validate data quality, tips for combining sources, and FAQ (e.g., “What if data is sparse?”).

### 2. Market Forces Analysis (Porter's 5 Forces – AI Edition)

- **Purpose**: quantify each of Porter's five forces using data (supplier / buyer concentration, accession cost, substitute signals) so users understand whether the industry can sustain investment.
- **AI logic**: the system prompt enforces numeric scoring (low/medium/high) plus trend direction; outputs JSON of five forces with `score`, `trend`, `drivers`, and `benchmarkComparisons`.
- **Visualization**: radial chart (five punches) with tooltips describing impact on margin; candidate force allows toggling between absolute and normalized scores.
- **Initiative example**: "Premium segment pricing redesign" (addresses buyer power) with ROI, risk, dependencies.
- **UI/Help**: show benchmarks, allow uploading competitor data, include FAQ "What if data is incomplete?"; CTA buttons `[Generate battle plan]`, `[Create initiative]`.

### 3. Growth Paths Analysis (Ansoff Matrix – AI Edition)

- **Purpose**: evaluate the four quadrants (Market Penetration, Market Development, Product Development, Diversification) with AI-generated ROI, risk, capability gap, required runway.
- **AI logic**: uses inputs on existing/new products, markets, channels, and overlays probability distributions for growth; outputs readiness classification + recommended transformations.
- **Visualization**: interactive Ansoff matrix with quadrant depth, spending bars, and annotations for capability readiness.
- **Initiatives**: packages of pilots for each quadrant (e.g., "Market Expansion Sprint X" or "Product Extension Proof of Concept").
- **UI/Help**: highlight trade-offs between growth and risk, include runbooks on how to stage pilots.

### 4. Value Chain Analysis (AI Value Leakage Finder)

- **Purpose**: map activities to cost/time/value and detect leaks—inventories, approvals, rework—that diminish strategic value.
- **Inputs**: process steps, cost buckets, cycle times, supplier/customer handoffs, resource utilization.
- **AI logic**: clusters activities by cost/time and highlights micro-losses by comparing to benchmarks; identifies value-adding vs. non-value-adding segments.
- **Visualization**: stacked bar of time vs. value, dependency graph showing leakage points, heatmap on the value chain flow.
- **Output**: prioritized list of leak sources plus remedial initiatives (automation, elimination, outsourcing).
- **Help/UX**: includes explanations of difference between OEE and value, tip to review supplier contracts.

### 5. Strategic Portfolio Prioritization (BCG Logic)

- **Purpose**: classify initiatives using a BCG-like matrix to identify winners, cash cows, question marks, and dogs and support allocation decisions.
- **AI logic**: combines impact, effort, customer value, and risk to place initiatives on the matrix; simulates constrained resource portfolios.
- **Visualization**: dynamic BCG grid with draggable dots representing proposed initiatives, color-coded by transformation type.
- **Initiatives**: prompts to `stop`, `scale`, `merge`, or `exit`; generates summary reason statements.
- **UI/Help**: includes interactive filters (transformation type) and ability to export decision rationale.

### 6. Strategic Ambition Decomposer

- **Purpose**: translate lofty ambition statements into measurable directional choices (growth pace, margin focus, capability bets).
- **AI logic**: ingests vision/mission statements, financial targets, and leadership narratives; splits into strategic dimensions and surfacing contradictions.
- **Output**: structured map where each ambition dimension links to trade-offs (speed vs. stability, margin vs. volume, etc.).
- **Initiative generation**: produces transformation domains (growth, cost, capability) with precise metrics (KPIs) and dependencies.
- **UX**: uses cards for each dimension, decision toggles for trade-offs, snippet summarizing consequences; help section includes coaching on articulating ambition.

### 7. Strategic Focus & Trade-off Engine

- **Purpose**: force choice by identifying conflicting initiatives (e.g., premium vs. low-cost) and recommending deliberate rejections.
- **AI logic**: ingests active initiatives, resource allocation planes, and financial data to map conflicts and compute cost of indecision.
- **Visualization**: Sankey showing resource diversion, alert badges for conflicting areas, priority slider.
- **Initiatives**: prompts for `exit`, `stop`, `merge`, or `consolidate` actions with timeline/owner suggestions.
- **Help**: emphasizes value of saying “no”, provides script for stakeholder conversations.

### 8. Strategic Risk & Uncertainty Mapper

- **Purpose**: surface critical assumptions and simulate scenarios to ensure strategy withstands shocks.
- **AI logic**: identifies hypothesis-impact pairs; computes probability-impact matrix, cascades (Scenario B triggers risk C), and resilience needs.
- **Visualization**: risk heatmap + scenario tree showing cascading events; includes “Plan B” swimlanes.
- **Outputs**: risk register, resilience initiatives (e.g., “Dual sourcing initiative”), cross-links to Risk module.
- **UX/Help**: includes risk filtering (by likelihood/impact), instructions on when to run tabletop exercises.

### 9. Strategic Capability-to-Outcome Mapper

- **Purpose**: compare strategy goals with existing capabilities (people, processes, technology) and highlight gaps.
- **AI logic**: merges capability data (project catalogs, skill inventories, technology stack) with target outcomes; scores capability maturity vs. desired transformation.
- **Visualization**: capability radar chart + gap waterfall detailing blockers.
- **Outputs**: capability-building initiatives (reskilling, recruitment, tool acquisition) with dependencies on other tools (e.g., SOP Builder).
- **Help**: guidelines for collecting capability data, recommended maturity models (CMMI, Capability Maturity Model).

### 10. Strategic Narrative & Alignment Engine

- **Purpose**: turn analyzed decisions into a coherent narrative tailored to stakeholders (executive, management, operations).
- **AI logic**: distills decisions, priorities, and risks into messaging frameworks, tests for contradictions, and adapts tone per audience.
- **Visualization**: story canvas with pillars (Why, What, How, Next) and alignment badges.
- **Outputs**: communication plan, alignment initiatives (OKR refresh, town hall scripts), initiative dependencies.
- **Help**: includes templates for executive summaries, email scripts, and alignment workshops.

## Operational Excellence Tools (11–21)

### 11. Digital Value Stream Map Builder

- **Purpose**: guide users through creating current and future VSMs without physical gemba. Chat-driven questions populate tables with steps, cycle time, wait time, rework, WIP, and owners.
- **AI logic**: verifies consistency (e.g., high CT vs. demand) and flags NVA steps. Generates current vs. future state maps plus KPI summary (lead time, value ratio).
- **Visualization**: flow diagram with swimlanes for material/information, bottleneck highlights, and quick win callouts.
- **Initiatives**: Bottleneck Relief, Quality-at-Source, Integration/Automation actions.
- **UX/Help**: includes templates for common flows (O2C, P2P); tip: start with 6–12 steps, then refine.

### 12. Standard Work & SOP Builder

- **Purpose**: convert narrated process descriptions into executable SOP with checklists, quality criteria, and drift detection.
- **AI logic**: normalizes language, enforces DoD, marks missing owners or standards, generates training plan.
- **Outputs**: role-based cards, digital checklists, compliance drift monitor.
- **UI**: editable table of steps with phases (as-is/to-be), attachment of media, inline editing.
- **Help**: references for defining acceptance criteria and drift detection thresholds.

### 13. A3 Problem Solving (AI Root Cause)

- **Purpose**: produce a data-backed A3 report culminating in countermeasures with owners, KPIs, and follow-up steps.
- **AI logic**: enforces evidence for each root cause via extracted logs, eliminates empty 5 Whys, and offers countermeasure categories (procedural, organizational, technological).
- **Outputs**: structured A3 PDF, countermeasure table, KPI tracker.
- **Help**: outlines when to trigger an A3 and how to classify countermeasures.

### 14. SMED / Changeover Reduction Planner

- **Purpose**: reduce changeover via planner capturing task sequences, internal/external classification, and toolkit requirements.
- **AI logic**: distinguishes waste, calculates savings (min/changeover), and suggests layout/tool spend.
- **Outputs**: SMED roadmap (quick wins, mid-term tooling, long-term automation) with CAPEX/OPEX estimates.
- **Help**: includes checklists for prepping kits and standardizing handoffs.

### 15. Daily Management System Builder

- **Purpose**: configure Lean daily management with tiered meetings, KPI boards, escalation rules, and initiative triggers.
- **AI logic**: evaluates KPI quality, identifies bad candidates (lagging, uncontrolled), and builds issue-to-initiative pipeline (repeat issue → initiative).
- **Outputs**: tier map, escalation thresholds, automation suggestions.
- **Help**: describes how to staff tier meetings and monitor thresholds.

### 16. Operational Automation Pipeline Builder

- **Purpose**: convert waste detected by VSM/Handover Friction into an automation backlog covering workflow/RPA/AI/API.
- **AI logic**: classifies processes, estimates savings (hours/FTE), and flags anti-patterns.
- **Outputs**: prioritized automation pipeline with effort/impact, technology recommendations, data needs.
- **Help**: includes sample naming conventions for automation initiatives.

### 17. Real-Time Constraint Control Loop

- **Purpose**: manage physical constraints via TOC, dispatch rules, and alerts; transitions from manual approvals to semi-auto dispatch.
- **AI logic**: monitors throughput, reprioritizes work when overload detected, and pushes alerts to control tower.
- **Outputs**: priority rules, dispatch queue, alert templates.
- **Help**: includes readiness checklist (define constraint, thresholds).

### 18. Decision Automation Engine

- **Purpose**: map decision architecture into policy rules (policy-as-code) covering thresholds, exceptions, and approvals.
- **AI logic**: extracts decisions from described processes, simulates outcome, and recommends automation approach (decision tree, PMS script, calcs).
- **Outputs**: decision catalog, policy bundle, simulation results.
- **Help**: describes when to automize vs. keep manual oversight.

### 19. Shopfloor Digital Control Tower

- **Purpose**: provide visibility into physical operations (states, downtimes, backlogs) even without IoT via manual logging.
- **AI logic**: validates logs, surfaces anomalies, recommends in-shift actions.
- **Outputs**: dashboard of statuses, anomaly list, recommended actions.
- **Help**: outlines data collection cadence and alert definitions.

### 20. Inventory Autopilot (ABC/XYZ)

- **Purpose**: build algorithmic replenishment policies (ABC/XYZ classification, safety stock, reorder points) even before WMS integration.
- **AI logic**: simulates policy impact on cash, stockouts, and FTE effort.
- **Outputs**: SKU matrix mapping, recommended parameters, simulation scenarios.
- **Help**: provides guardrails for policy changes and approval workflows.

### 21. Process Automation by AI (builder)

- **Purpose**: interactive table-based workshop where user lists process steps, identifies decisions/tasks, time estimates, lean optimizations, automation ideas, and economic impact.
- **Flow**: user adds steps (LP, step name, type, time, phase). AI suggests optimization opportunities, automation options, and recalculated times. Final section calculates ROI from time savings and generates initiative.
- **Table structure**:

```
| LP | Step Name | Task/Decision | Baseline Time | Lean Idea | Lean Time | Automation Idea | Auto Time | Savings | Economic Notes |
|----|-----------|---------------|---------------|-----------|-----------|------------------|-----------|---------|----------------|
| 1  | Check stock | Task | 12m | batch review with rule | 8m | Inventory API | 0m | 12m | 200 orders/day |
```

- **AI logic**: compares baseline vs. optimized times, computes reduction per step, tags automation feasibility, and aggregates savings (time/hour, FTE equivalent, cost avoidance).
- **Outputs**: completed table, automation roadmap, ROI summary, initiative draft ready to send to initiatives module.
- **Help**: provides question prompts, time estimation guidance, and tips for capturing value (e.g., “capture the current time per role, not per business outcome”).
- **Purpose**: interactive table-based workshop where user lists process steps, identifies decisions/tasks, time estimates, lean optimizations, automation ideas, and economic impact.
- **Flow**: user adds steps (LP, step name, type, time, phase). AI suggests optimization opportunities, automation options, and recalculated times. Final section calculates ROI from time savings and generates initiative.
- **Outputs**: exported table, automation roadmap, initiative summary.
- **Help**: includes template table, time estimation guidance, and tips for quantifying benefits.

## Digital Transformation Tools (21–30)

### 21. Robotics Deployment Feasibility Analyzer

- **Purpose**: assess whether robotics (industrial/cobots/AMR) deliver ROI by analyzing repetitive operations, volume, variability, ergonomics, and CapEx/Opex.
- **AI logic**: classifies robotizability (high/medium/low), maps to robot types, and flags prerequisites (layout, data, standards).
- **Outputs**: Robotics Candidate Map, ROI ranges (pessimistic/realistic/optimistic), prerequisite checklist.
- **Help**: includes inventory of hardware types, readiness checklist, and vendor-neutral guidance.

### 22. Logistics & Warehouse Automation Analyzer

- **Purpose**: find automation potential across transport, storage, picking, packing without requiring IoT by leveraging structured dialogue + flow data.
- **AI logic**: classifies flows (stable/volatile), maps to automation types (AMR, AS/RS, wave planning), rejects high-variability scenarios.
- **Outputs**: Logistics Automation Potential Map, CAPEX/OPEX projection, prerequisites (slotting, layout changes).
- **Help**: ensures the user understands punchlist for pilots vs. full automation.

### 23. RPA & Workflow Automation Scanner

- **Purpose**: identify digital transactional opportunities for RPA, workflow automation, or AI-assisted automation.
- **AI logic**: breaks process steps, counts clicks/manual entries, evaluates exceptions, and maps to automation category.
- **Outputs**: Automation Heatmap, candidate list with effort/ROI/stability, technology recommendation (workflow/RPA/API).
- **Help**: includes typical anti-patterns (RPA on unstable process) and prepping data cleanup.

### 24. AI Use-Case Discovery & Readiness Assessment

- **Purpose**: separate hype from real AI opportunities via decision/data mapping.
- **AI logic**: classifies use cases (prediction/classification/optimization/generation/anomaly detection), assesses data readiness, explainability, and change impact.
- **Outputs**: AI Use-Case Portfolio, readiness score, recommended model type, roadmap (AI now/later/never).
- **Help**: provides questions to validate data quality and decision owner readiness.

### 25. IT / System Integration Diagnostic

- **Purpose**: map application landscape, identify integration debt, and recommend high-level architecture improvements (API, event-driven, data hub).
- **AI logic**: collects system involvement per process, marks manual handoffs, is red flagging over/under integration.
- **Outputs**: Integration Reality Map, critical points, high-level recommendations, initiative suggestions.
- **Help**: explains difference between integration types and how to gather data.

### 26. Digital Value Pool Identifier

- **Purpose**: identify economic value pools where digital can shift capital, decisions, quality, scale, or costs.
- **AI logic**: conducts economic interview, matches responses to archetypes (inventory cash drain, downtime, decision latency).
- **Outputs**: prioritized initiatives per value pool with expected EBITDA lift.
- **Help**: describes how to frame responses (focusing on money rather than tech).

### 27. Legacy Technology Drag Analyzer

- **Purpose**: quantify the drag of legacy stacks in terms of decision latency, change cost, and operational risk rather than just system age.
- **AI logic**: maps user-described pains (workarounds, delays) to metrics, proposes focused solutions (API enablement, decision outer layer).
- **Outputs**: Drag scorecard, targeted initiatives with suggested technology/actions.
- **Help**: clarifies that the focus is on friction, not forced migrations.

### 28. Data Asset & Gap Inventory

- **Purpose**: map key decisions and required data, flag gaps, and highlight unused data that wastes storage/effort.
- **AI logic**: aligns decision cadences with data availability, surface missing signals, unused reports, and data collectors.
- **Outputs**: decision-to-data map, data gap list, initiatives (data foundation, integrations).
- **Help**: includes templates for data gap interviews and guidance on quick wins.

### 29. Pain-to-Solution Matcher

- **Purpose**: bridge discovery insights with DBR77 Marketplace solutions without vendor lock-in.
- **AI logic**: pulls pains from value pool/legacy/data tools, maps to solution classes (RPA, APS, AI planning, WMS), and lists vendor archetypes plus integration accelerator needs.
- **Outputs**: solution recommendation table, prioritized vendors, estimated integration scope.
- **Help**: explains how to interpret vendor archetypes and what signals indicate readiness.

### 30. Structured Pain Explorer

- **Purpose**: convert chaotic user statements into structured problems, hypotheses, and initiative drafts—ideal entry point for busy executives.
- **Flow**: user describes pain; AI asks clarifying questions, segments symptoms vs. causes, builds scope, target metrics, and solution paths.
- **Outputs**: initiative draft with problem statement, goals, metrics, tool suggestions; seeds the rest of the toolchain.
- **Help**: emphasizes narrative capture, tip to use voice input for richer content.

## Standard Patterns

### Button actions & workflow

- Primary actions: `[Run Analysis]` (kicks off AI prompt), `[Generate Initiative]` (opens the initiative composer), `[Save & Export]` (persists session state), `[Submit to Initiatives]` (bulk push selected initiatives).
- Secondary actions: `[Add data source]`, `[Switch visualization]`, `[Open help]`, `[Rollback changes]`.
- Buttons follow Atom design tokens: `primary` uses `bg-primary-500`, `secondary` uses `bg-slate-800`, `ghost` uses `border-slate-300`.

### Initiative generation standard

- Initiative object schema:

```
{
  "toolId": "dynamic-swot",
  "title": "Expanding premium positioning",
  "description": "...",
  "impact": "High",
  "effort": "Medium",
  "owner": "Strategy Lead",
  "dependencies": ["ValueChain-04"],
  "rationale": "S+O correlation shows ...",
  "metrics": { "revenue": "+8%", "margin": "+120bps" }
}
```

- All tools map `sourceEvidence` and `confidence` so the initiatives dashboard can filter by AI confidence band.
- Initiative modal supports tagging (strategic/operational/digital), priority, and estimated ROI and calculates templates for follow-up actions.

### Visualization specifications

- Every tool attaches a visualization card next to the chat panel, updating in real-time as the AI responds. Tooltips explain each data source, formula, and recommendation.
- The shared color palette: positive/strength (emerald 500), caution/warning (amber 500), danger/blocker (rose 500), neutral/information (slate 500). Use gradients for benchmark comparisons.
- Responsiveness: cards collapse vertically below 1024px and provide toggle buttons to switch between chart and tabular detailed view.
- Specialized diagrams include SWOT matrix, Ansoff quadrant, Porter's radial, VSM swimlanes, BCG grid, risk heatmaps, robotics candidate map, ABC/XYZ inventory map, and automation pipeline kanban. Use `exportVisualization` helper for PNG/PDF exports.

### Help content template

- Each tool includes:
  - **Purpose**: Why this tool exists and what differentiates it from others.
  - **Inputs**: Checklist of required/optional data and where to find it.
  - **How to use**: Step-by-step walkthrough covering chat prompts and expected replies.
  - **Tips**: Best practices (e.g., “keep initial VSM steps concise” or “log at least three changeovers for SMED”).
  - **FAQ**: Answers to common concerns (“What if data is missing?” or “Can I repeat this analysis?”).
  - **Related tools**: Cross-links to successor tools for the next stage (e.g., Strategic tools link to Portfolio or Narrative).
- Help content renders in `ToolHelpSidebar` with collapsible panels, inline links, and quick action links (e.g., start initiative, download summary).

## AI Prompt Library

| Tool ID | Prompt excerpt |
|---|---|
| `dynamic-swot` | `You are an AI strategist: classify provided facts into Strengths/Weaknesses/Opportunities/Threats, connect them into correlations, and always return JSON extraction.` |
| `market-forces` | `Assess the competitiveness described, score each of Porter's five forces numerically, and justify each score with cited data.` |
| `growth-paths` | `Map the described product/market combinations to the Ansoff quadrants and compute ROI/risk for each growth path.` |
| `value-chain` | `Analyze the sequence of activities, tag waste vs. value, and highlight leaks where time or cost exceeds peer benchmarks.` |
| `portfolio-prioritization` | `Place initiatives and candidate investments on a BCG-style grid, simulate constraints, and recommend stop/scale/exit actions.` |
| `ambition-decomposer` | `Break the ambition statement into measurable dimensions, force trade-offs, and call out conflicting choices.` |
| `focus-tradeoff` | `Identify opposing initiatives, compute the cost of indecision, and suggest deliberate rejections.` |
| `risk-mapper` | `Extract assumptions, compute likelihood × impact, and simulate cascading scenarios with mitigation ideas.` |
| `capability-mapper` | `Match strategy outcomes to capability needs, score gaps, and recommend capability-building initiatives.` |
| `narrative-engine` | `Summarize the strategy into Why/What/How, test for contradictory signals, and tailor outputs per audience.` |
| `vsm-builder` | `Guide the user through steps, validate CT/WT, compute lead time vs. value, and produce current+future state.` |
| `sop-builder` | `Normalize procedural narratives into standard work cards, highlight missing DoD, and produce checklists.` |
| `a3-problem` | `Step through the A3 template, ensure each Why has evidence, and suggest countermeasure categories.` |
| `smed-planner` | `Categorize setup steps into internal/external, surface waste, and propose changeover savings.` |
| `dms-builder` | `Evaluate KPI quality, define thresholds, and map issue frequency to initiative triggers.` |
| `automation-pipeline` | `Identify automation candidates from process steps, classify into workflow/RPA/AI, and calculate labor savings.` |
| `constraint-loop` | `Define the constraint, priority rules, dispatch appeals, and escalation triggers.` |
| `decision-automation` | `Extract decision architecture, propose policy rules, and simulate exception handling.` |
| `control-tower` | `Validate manual logs, detect anomalies, and recommend immediate actions for the shift.` |
| `inventory-autopilot` | `Classify SKUs via ABC/XYZ, propose reorder policies, simulate cash/stockout impacts.` |
| `robotics-feasibility` | `Score robotizability, map to robot types, and output ROI ranges plus prerequisites.` |
| `logistics-automation` | `Map material flows, evaluate stability, and recommend physical/algo automation.` |
| `rpa-scanner` | `Break down transactional steps, quantify exceptions, and classify automation type.` |
| `ai-usecases` | `Collect use cases, assess data readiness, and rank them into now/later/never categories.` |
| `integration-diagnostic` | `Map systems per process, flag integration debt, and recommend architecture fixes.` |
| `value-pool` | `Capture economic friction points and map them to known value pools (inventory, decisions, etc.).` |
| `legacy-drag` | `Translate legacy pain descriptions into metrics (latency, change cost, risk) and suggest remedial/practical fixes.` |
| `data-gap` | `Map decisions to required data, highlight gaps/unused data, and recommend collection priorities.` |
| `pain-to-solution` | `Link pains to solution classes and vendor archetypes without recommending vendors directly.` |
| `structured-pain` | `Structure chaotic pain statements into problem statements, hypotheses, scopes, and solution paths.` |

## Initiative Generation Logic

- All tools produce initiatives with the shared schema defined earlier. Each tool tags the initiative with `initiativeType` (Strategic, Operational, Digital, Automation) and `confidence`.
- Additional tool-specific mappings:
  - Strategic tools append `linkedForces` and `valueChainSources`.
  - Operational tools include `processStep`, `expectedCycleTime`, and `automationSuggestion`.
  - Digital tools enrich initiatives with `automationType`, `technology`, and `robotType`.
- Initiatives queue in `useToolStore` until the user opens `InitiativeComposer`, confirms owners, timelines, and dependencies, then pushes into the central Initiatives module.

## Visualization & Help Adoption

- Help sidebar surfaces adoption guidance: recommended participants, data to prepare, and session cadence.
- Visualizations share export controls, responsive behavior, and the color system described earlier. Each includes tooltips, drill-downs, and cross-links to related outputs (initiative view, export PDF).
