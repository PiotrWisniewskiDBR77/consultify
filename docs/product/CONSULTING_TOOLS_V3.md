# Consulting Tools v3 — Module & Workflow SSOT

> **Status:** Draft (v3 SSOT)  
> **Scope:** Product + UX contracts + workflow + data contracts (logical)  
> **Goal:** One canonical Source of Truth for the **Consulting Tools** module: how users choose tools, run sessions, iterate with assumptions, finalize outcomes, and generate traceable deliverables (initiatives / reports / presentations).
>
> This document is intentionally **workflow-first**. The *catalog of tools* remains in `docs/product/TOOLS_CATALOG_V3.md`.

## 0) Related SSOT (mandatory references)

- Tools catalog: `docs/product/TOOLS_CATALOG_V3.md`
- Master consulting tools standard: `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`
- One task per consulting tool (tool specs SSOT): `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- Consulting Templates library (60 classic frameworks; implementation contract): `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`
- Known Tools content completeness audit (v3): `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`
- Operating model: `docs/product/OPERATING_MODEL_V3.md`
- Source traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- Link graph (embedded refs + backlinks): `docs/product/LINK_GRAPH_V3.md`
- Reports & Presentations: `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`, `docs/product/REPORT_GENERATOR_V3.md`, `docs/product/PRESENTATION_GENERATOR_V3.md`
- Financial Analysis (export surface + economics): `docs/product/FINANCIAL_ANALYSIS_V3.md`
- UI/UX canon:
  - Module hub: `docs/ui-standards/03-modules/module-hub-standard.md`
  - View modes: `docs/ui-standards/03-modules/view-modes-standard.md`
  - App tables: `docs/ui-standards/03-modules/app-table-standard.md`
  - Table + preview: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - Workspace 3-tools strip: `docs/ui-standards/02-components/workspace-3-tools-strip.md`
  - Workspace & shared tools: `docs/ui-standards/README.md`

---

## 1) Problem statement (why this module exists)

Consultinity must provide **consulting knowledge** and make it actionable. The Consulting Tools module is the canonical, repeatable way to:

- pick the right consulting method (tool) for a problem,
- collect client inputs and consultant assumptions,
- structure work in a consistent format (table/workspace/wizard),
- generate sponsor-ready outputs (initiative / report / presentation),
- guarantee traceability and auditability of every deliverable.

---

## 2) Canonical naming & mental model (v3)

### 2.1 Module name

User-facing module name: **Consulting Tools**.

> Historical labels (as-is code): “Discovery Tools”, “Licensed Tools”, “Assessment”.  
> v3 must present **one coherent module** and one coherent flow.

### 2.2 i18n / user-facing copy (MUST)

The module and categories must support PL+EN (`useTranslation` in UI).

Canonical copy:

- **EN**: “Consulting Tools”
- **PL**: “Narzędzia konsultingowe”

Category pills (examples, can be adjusted but must stay consistent across surfaces):

- Strategy / Strategia
- Operations / Operacje
- Digital / Digital
- Process Automation / Automatyzacja procesu
- Licensed (Methodologies) / Licencjonowane (Metodologie)

### 2.2 One mental model (MUST)

The Consulting Tools module is one user journey:

**Library → Sessions → Reports & Presentations → Initiatives**

- **Library**: tool catalog & selection
- **Sessions**: work in progress (executions/runs)
- **Reports & Presentations**: reports and presentations created from sessions
- **Initiatives**: initiatives created from tool/assessment sources (traceability control)

User-facing interpretation:

- first function = `Library`
- second function = `Sessions`
- third function = `Reports & Presentations`
- fourth function = `Initiatives`

This matches `docs/product/TOOLS_CATALOG_V3.md` and `V3-E01` in the program ledger.

---

## 3) Three classes of “tools” inside one module

The module contains three classes of work methods. They share the **same workflow skeleton** and the same output system, but differ in knowledge density and runtime mechanics.

### 3.1 Consulting tools (small-to-medium methods)

Examples: SWOT, 5 Forces, 7S, value pool, operational templates, digital templates, etc.

Characteristics:

- can often be described briefly,
- may rely on externally sourced knowledge (internet research) + internal heuristics,
- run as a **Tool Session** (wizard/workspace/table/hybrid).

### 3.2 Consulting Templates (classic frameworks; workspace templates)

Examples: MECE issue trees, PESTEL, Business Model Canvas, Balanced Scorecard, VSM, SIPOC, SCOR, TOM, Process Mining, ADKAR, etc.

Canonical source-of-truth for their method + implementation contract lives in:

- `wdrozenia/modules/tools/catalog/{strategy,operations,transformation}/` (method + worked examples)
- `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md` (how each template is implemented in Consultify)

Characteristics:

- are primarily **workspace templates** (no bespoke editors),
- run as a **Tool Session** using the universal wizard skeleton, but the Work step is **Workspace-first**,
- have deterministic artifact structure (blocks/matrix/tree/scorecard/process map) + deterministic DoD checklist,
- always generate **traceable** outputs (initiatives / report / deck) only after finalization.

### 3.3 Licensed assessments / methodologies (knowledge-heavy)

Examples: DRD, SIRI, ADMA (and future licensed packs).

Characteristics:

- require significant methodology knowledge, scoring rules, evidence guidance,
- have dedicated educational content (articles/scripts/videos) and internal libraries,
- should be treated as a distinct **methodology artefact** (licensed pack),
  not merely “another small tool template”.

#### 3.3.1 Canonical artefact: Methodology Pack (v3)

We model licensed assessments as a first-class artefact:

`MethodologyPack` (aka `AssessmentFramework`) — a knowledge and runtime definition for a licensed methodology.

It contains:

- **Knowledge base assets**: overview, “how to score”, “what does level mean”, examples & evidence rules
  - SSOT for production assets: `docs/knowledge/` (scripts/articles/videos pipeline)
- **Question / scoring model**: dimensions, questions, scoring scales, aggregation rules
- **UI runtime contract**: how the assessment session is presented (questionnaire + scoring + summary)
- **Output mappings**: how results can generate initiatives/reports/presentations (traceable)

The runtime execution creates an `AssessmentReport` (canonical source; see traceability SSOT).

---

## 4) Core workflow (end-to-end) — the “working formula”

This is the canonical flow for **both** consulting tools and licensed assessments.

### 4.1 Step A — Choose tool in Library (ModuleHub)

**Surface:** Module Hub + view modes + dynamic tabs (SSOT: module hub standard + view modes standard).

Library MUST provide:

- **Categories & filters** (user can narrow tools):
  - Strategy / Operations / Digital / Process Automation
  - Licensed (Methodologies / Assessments)
- **Search**: library-wide
- **View modes**: `table` + `grid(cards)` at minimum
- **AI context** entry point in the module topbar:
  - user can discuss “what should I do?” and get tool recommendations
  - AI operates *propose → accept* (never auto-starts a tool without user action)

#### 4.1.0 Dynamic tabs: “Tool card” (MUST)

When the user selects a tool in the Library, the system must support opening a **dynamic tab** for that tool (“tool card”):

- it presents the same preview content (description + graphic + micro-video + KB)
- it provides clear CTAs: `Start session`, `Open methodology` (for licensed packs), `View examples`
- it never feels like “another app”; it is just a dynamic tab inside the Consulting Tools module.

#### 4.1.1 Tool preview (right panel) — MUST

Selecting a tool in Library shows an Outlook-style preview pane (SSOT: table preview pane standard) containing:

- **Description**: when to use + expected inputs + expected outputs
- **Graphic preview**: “how this tool typically looks” (canonical illustration)
- **Micro-video**: short explainer (1–2 min)
- **Knowledge links (KB)**: methodology / examples / guidance (especially for licensed packs)

**Non-negotiable content completeness rule (v3):** every tool entry must have:

- `whenToUse` (clear scenarios)
- `inputs` (what is required vs optional)
- `steps` (how the tool works)
- `outputs` (what deliverables it can produce)
- `KB` (references: internal knowledge + external sources if applicable)
- **graphic preview**
- **micro-video**

#### 4.1.2 Start a tool from Library

Clicking “Start” (or primary CTA) does:

- creates a new **session** (ToolSession or Assessment execution run),
- creates the corresponding row in the `Sessions` function immediately,
- opens it in **dynamic tabs**,
- routes user to the correct runtime surface (wizard/workspace/questionnaire).

### 4.2 Step B — Run a Session (work execution)

Each session follows the same consulting skeleton:

1) **Define intent / diagnosis scope**  
2) **Assumptions & inputs** (client data + consultant assumptions)  
3) **Work surface** (table/workspace/questionnaire/hybrid)  
4) **Conclusions & summaries** (insights + comments + what’s missing)  
5) **Finalize** (freeze the session version)  
6) **Next step outputs** (initiative/report/presentation)

For `Dynamic SWOT` MVP, the reference runtime is more explicit and phase-based:

1. `Mission & Context`
2. `Input & Exploration`
3. `SWOT Build`
4. `Synthesis & Insights`
5. `Outputs & Actions`

This five-phase session model is the reference for the first MVP. Older wizard-like runtime interpretations are not the reference path for `Dynamic SWOT`.

#### 4.2.0 Iteration loop (MUST): “missing → add → re-process”

Tools are not a single-pass form. A session must support the canonical loop:

- user provides inputs + assumptions
- the tool processes them into the tool’s “thinking format”
- the tool identifies **missing items / add-ons needed** (as a deterministic checklist, not “AI opinion”)
- user fills the missing items
- the tool re-processes and updates summaries/conclusions

This is the core reason we standardize the wizard: repeatability and quality of consulting outcomes.

#### 4.2.1 “Assumptions” are first-class (MUST)

Assumptions are a visible and auditable layer of the session. They must be:

- explicitly reviewable in the session UI,
- included in session snapshots upon finalization,
- traceable into outputs (as part of “why these conclusions exist”).

#### 4.2.1a Evidence is first-class (MUST)

Every tool session must support an explicit “evidence layer”:

- key claims should be tagged as **evidence-backed** (linked) vs **assumption**,
- evidence can be: attachments, links, embedded references to platform artifacts (Notebook/Interview/Reports/Workspaces),
- the “missing items” checklist must include missing evidence for high-impact claims (not only missing text fields).

#### 4.2.2 “Work surface” types (MUST)

A tool chooses one of the canonical surface types:

- **Table** (App Table / Interactive Board standard)
- **Workspace** (canvas, using 3-tools strip: Tools / Context / AI Suggestions)
- **Wizard** (multi-step guided flow)
- **Hybrid** (workspace + table + wizard steps)
- **Questionnaire** (assessment runtime; still fits the skeleton)

#### 4.2.3 Session outputs inside the session (MUST)

Every session (tool or assessment) must expose, before finalization:

- **summaries** (what we learned)
- **comments/observations** (consultant perspective + caveats)
- **missing items** (what blocks quality / finalization)

After finalization, these become part of the immutable snapshot and are available to outputs.

### 4.3 Step C — Finalize (locking and eligibility for outputs)

Finalization is the gate that turns session work into a canonical source of deliverables.

Rules are canonical in `docs/product/SOURCE_TRACEABILITY_SPEC.md`:

- ToolSession must reach `FINALIZED` (locked + immutable snapshots)
- AssessmentReport must reach `FINAL` (locked + immutable)
- Only then the session is eligible to generate initiatives / reports / presentations.

### 4.4 Step D — Outputs (“go further”)

From a finalized session, user can create:

- **Initiative** (one or many)
- **Report**
- **Presentation**

All outputs must be:

- created with **traceability** (`source_type`, `source_id`, `source_version`)
- able to “Open source” back to the session
- recorded as artefacts visible in module surfaces (Outputs tabs and/or canonical libraries)

#### 4.4.1 Report / Presentation generators (MUST integration contract)

When the user clicks **Create Report** or **Create Presentation** from a finalized ToolSession:

- the generator must open with the ToolSession pre-selected as a primary source input,
- the created artifact must store source traceability (`source_type=TOOL`, `source_id=tool_session_id`, `source_version=session.version`),
- blocks/sections/slides should preserve block-level traceability where feasible (“Open source” to the exact session).

SSOT:

- Reports: `docs/product/REPORT_GENERATOR_V3.md`
- Presentations: `docs/product/PRESENTATION_GENERATOR_V3.md`

### 4.5 Step E — Initiatives (traceability & control)

Initiatives created from Consulting Tools must satisfy:

- “no initiative without a traceable source” (strict rule),
- possible 1..N sources (one initiative can link multiple sessions),
- sources are immutable after finalization.

---

## 5) AI behavior (non-negotiable contract)

AI is a co-pilot, not an auto-pilot:

- always works as **propose → accept/reject**,
- never overwrites user work,
- can recommend tools and next steps,
- can propose missing inputs / assumptions,
- can draft summaries and output drafts, but user approves.

AI suggestions must be:

- explainable (“why this suggestion”),
- actionable (“what to do next”),
- grounded in session data and checklists (not free-form opinions).

---

## 6) Context & knowledge linkage (Link Graph)

Every session/workspace/wizard supports:

- **Context / Links** panel with:
  - embedded references
  - platform-wide backlinks (“Used in”)
- **AI Suggestions** panel (send to chat, insert into content)

SSOT: `docs/product/LINK_GRAPH_V3.md` + UI contract in `docs/ui-standards/02-components/workspace-3-tools-strip.md`.

---

## 7) Data contracts (logical, v3)

This section defines the minimum logical model required to implement the workflow consistently.

### 7.1 ToolDefinition (catalog entry)

ToolDefinition MUST include:

- identity: `tool_id`, `name`, `category` (strategy/ops/digital/process_auto/licensed)
- class: `tool_class = consulting_tool | framework_template | methodology_pack`
- surface type: `table | workspace | wizard | hybrid | questionnaire`
- `when_to_use`, `inputs_schema`, `outputs_capabilities`
- preview assets:
  - `preview_image_url`
  - `micro_video_url`
  - `kb_links[]`

Additionally, ToolDefinition SHOULD include:

- `example_outputs[]` (links to sample report/deck/initiative packages, if available)
- `tool_spec_version` (for governance of tool content changes)

### 7.2 ToolSession (consulting tool run)

Canonical fields and lifecycle are defined in `SOURCE_TRACEABILITY_SPEC.md`.
Session MUST support:

- editable while `DRAFT`
- finalizable to `FINALIZED` (locking snapshots)
- snapshots must capture:
  - inputs + assumptions
  - key work artefacts (tables/workspaces)
  - conclusions/summary

### 7.3 MethodologyPack (licensed)

The licensed pack is a knowledge artefact; execution produces `AssessmentReport` (canonical source).

Minimum pack fields:

- `framework_code` (DRD/SIRI/ADMA/…)
- knowledge assets refs (articles/videos)
- scoring model
- runtime UI configuration
- output mapping rules

### 7.4 Outputs (deliverables)

Outputs are artefacts:

- Initiative
- Report
- Presentation/Deck

Each output MUST store:

- `source_type`, `source_id`, `source_version`
- creator metadata (`created_by`, `created_at`)
- “Open source” deep link target

---

## 8) Standard “Tool Wizard” (universal for consulting tools)

Consulting tools (non-licensed) use a single reusable wizard pattern.

### 8.1 Canonical steps (default)

1) **Define** (intent, scope, audience, context)  
2) **Inputs & assumptions** (client data + consultant assumptions; attachments/links)  
3) **Work** (table/workspace/hybrid)  
4) **Review** (summaries + missing items + suggested improvements)  
5) **Finalize** (freeze, eligibility)  
6) **Outputs** (Create initiative/report/presentation)

### 8.2 UI contract

- step surfaces must stay within the global UI canon (module hub / workspace tools strip / app table)
- right-side panels use the standard 3-tools strip where applicable
- preview pane patterns must match `table-preview-pane-standard.md`

### 8.3 “One task per tool” — canonical Tool Spec template (SSOT)

Every consulting tool (and every licensed methodology pack) must be described using the same template so it can be converted into implementation tasks.

**Tool Spec template (copy 1:1):**

- **Name + category** (Strategy/Operations/Digital/Process Automation/Licensed)
- **Purpose / outcomes** (what decision it enables)
- **When to use** (scenarios + anti-scenarios)
- **Inputs**
  - required vs optional
  - “what to ask the client”
  - “what consultant assumptions can be added”
- **Steps** (wizard steps + what happens in each step)
- **Work surface**
  - table columns (if any)
  - workspace mode (if any)
  - hybrid rules (if any)
- **AI behavior**
  - suggestions allowed
  - propose→accept surfaces
  - forbidden actions
- **Outputs**
  - initiative/report/deck capabilities
  - traceability rules
- **Graphics assumptions (MUST)**
  - the canonical visual representation of the tool (preview illustration)
  - key shapes/diagrams/tables used in the tool
- **Micro-video (MUST)**
  - 1–2 min script outline
  - what the user will learn in the preview
- **KB links**
  - internal: `docs/knowledge/` assets if applicable
  - external references (if the tool is internet-research-backed)
- **Analytics events** (opened/started/finalized/output-created)
- **Definition of Done / Acceptance** (quality gates + expected demo flow)

---

## 9) Reference tool spec — “Process Automation” (workflow + data)

This tool is the canonical example of a **hybrid** tool (workspace + table + economics) and sets the bar for v3 consulting tools.

### 9.1 Goal

Model a client process, classify steps, measure as-is time, propose lean optimizations, propose automation technologies with reuse, quantify savings, and compute payback/ROI.

### 9.2 Wizard steps (canonical)

1) **Capture process** (chat-assisted) → draw flowchart in Workspace  
2) **Map flowchart → steps table** (1 row per step)  
3) **Classify steps**: trigger / decision / action  
   - workspace shapes reflect the classification (start/end, decision diamond, action rectangle, etc.)
4) **Measure as-is**: time per step (optionally cost drivers)  
5) **Lean optimize**: propose simplifications; record to-be time  
6) **Automation options**:
   - propose technologies per step
   - enforce reuse (technology objects referenced across steps)
7) **Savings**: compute time saved per step and aggregated  
8) **Economics**:
   - capture CAPEX + OPEX (and optionally staffing assumptions)
   - compute payback/ROI for the whole process improvement

### 9.3 Data model (logical)

Core dataset: `ProcessStep[]` (1..N)

Minimum fields per step:

- `step_id`, `order_index`, `name`
- `step_type`: `trigger | decision | action`
- `as_is_time_minutes`
- `to_be_time_minutes`
- `lean_ideas[]` (accepted proposals)
- `automation_technology_ids[]`
- `time_saved_minutes` (computed)
- `capex_amount?`, `opex_amount?` (optional per step; can also be global)

Technology list: `AutomationTechnology[]`

- `tech_id`, `name`, `category`, `notes`, `estimated_cost`, `vendor_links[]`

Economics summary:

- totals as-is vs to-be
- savings (time → cost via assumptions)
- payback period + ROI summary

### 9.4 Outputs

From finalized session:

- initiative package (“process improvement initiatives”)
- optional report/deck template (“Process Automation Summary”)

All outputs are traceable to the finalized session.

---

## 10) Task extraction (for Implementation Program)

This SSOT is designed to be converted into tasks without ambiguity. Minimum task set:

### 10.1 P0 / R0 (foundation)

- Consulting Tools module: Library/Sessions/Outputs/Initiatives navigation coherence (one mental model)
- Library: filters + search + view modes (table + cards)
- Library: preview pane contract (description + graphic + micro-video + KB links)
- Session core: ToolSession lifecycle in UI (draft → finalize; locked state)
- Traceability everywhere (Open source, source fields, MyWork → MYWORK ToolSession materialization)

### 10.2 P1 / R1 (scale)

- Universal Tool Wizard shell (reusable steps + per-tool config)
- MethodologyPack artefact model for licensed assessments (content + runtime config)
- Assessment runtime parity for SIRI/ADMA vs DRD (knowledge + UI + outputs)
- Process Automation tool (hybrid reference implementation)

### 10.3 Content production & completeness (R2 or parallel track)

- Tool catalog completeness audit (whenToUse/inputs/steps/outputs/KB + graphic + micro-video)
- “One task per tool” spec completion for:
  - 10 Strategy tools
  - 10 Operations tools
  - 10 Digital tools
  - + Process Automation tool
- Licensed methodology packs content hardening:
  - DRD as benchmark
  - SIRI and ADMA parity (methodology guidance + summary surfaces)

---

## 11) V8 Program Decisions

### 11.1 Classic framework templates registry

> V8 Decision W7-5 applied — 2026-03-23

The Known Tools table is the primary shared registry. Classic framework templates live as a typed family/subtype inside the shared tools registry. Do not create a disconnected parallel registry.

Rule: `one shared registry, typed families`.

### 11.2 Consulting tool AI governance granularity

> V8 Decision W7-6 applied — 2026-03-23

Consulting tool AI governance operates at two levels:

| Level | Scope |
|---|---|
| **Session-level** | Defines broad mode, permissions, and context boundaries for the tool session |
| **Action-level** | Decides whether a specific AI action within the session can execute, propose, or requires approval |

Rule: `session sets the sandbox, action decides the gate`.

The session-level governance binds the tool session to a `ContextSnapshot` and applies consumer class policy. Within that sandbox, each AI action (propose inputs, draft summaries, generate outputs, finalize) is individually gated by its risk class and approval path as defined in the tool governance model (WP-W1-AI-04).

