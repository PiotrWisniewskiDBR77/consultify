# Business Work Canvas Canon

Status: `DRAFT / PRODUCT SOURCE OF TRUTH`
Owner: Product + Engineering
Created: 2026-05-03
Scope: Strategic product doctrine, functional scope, UI/UX principles, technology direction and phased implementation model for Consultify Business Work Canvas.

## 1. Product Thesis

Business Work Canvas is the governed work area beside Teresa chat where business users turn messy context into structured thinking, durable artifacts and actionable next steps.

It is not a coding canvas. It is not a generic document editor. It is not a second chat.

It is the operating workspace for business work:

```text
conversation -> structured thinking -> business artifact -> decision -> execution path
```

Competitors can generate artifacts. Consultify must generate artifacts that understand the business: organization context, roles, projects, findings, decisions, initiatives, risks, KPIs, sources, approvals and execution pathways.

The product ambition:

```text
Claude-like artifact delight + Manus-like output workflow + Consultify business governance
```

## 2. Strategic Positioning

### 2.1 What We Learn From Competitors

Claude Artifacts win by making AI output feel alive. Substantial content appears in a dedicated right-side panel, can be iterated on, versioned, copied, downloaded, shared and rendered as documents, charts, diagrams, HTML or interactive components. Claude's strongest UX lesson is that the artifact is not a chat message. It is a first-class work object.

ChatGPT Canvas wins in focused editing. Users can select a section, ask for targeted changes, review inline suggestions, apply changes, restore versions and show diffs. The strongest lesson is the editing loop:

```text
select -> ask -> preview suggestion -> apply/reject -> version
```

Gemini Canvas wins in transformation. A document or research result can become a slide deck, app, web page, infographic, quiz or audio overview. The strongest lesson is that the Canvas should not only edit content; it should transform content into the format that best serves the user's next job.

Manus wins in outcome workflow. It turns data and prompts into dashboards, reports, slide decks, web pages and shared team workspaces. The strongest lesson is that the workspace should show the work process, not only the final output.

### 2.2 Consultify Differentiation

Consultify must not compete as a general-purpose coding or creative playground. Its advantage is business context and governed conversion:

```text
artifact -> conclusion -> conversion intent -> durable business object -> lineage
```

Business Work Canvas should know when an output is:

- a note,
- an idea,
- a decision candidate,
- an initiative candidate,
- a KPI signal,
- a report,
- a presentation,
- a table,
- a research pack,
- a client deliverable,
- an execution plan.

It should also know what must happen next: review, approve, convert, assign, export, share or continue researching.

## 3. Non-Negotiable Product Principles

### 3.1 One Chat, One Workspace

The left panel remains Teresa chat. The right panel is the work area. They share the same conversation context and the same active business context.

Blocked patterns:

- a separate Canvas chat,
- hidden context loss between chat and Canvas,
- multiple competing conversation states,
- Canvas actions that do not appear in the conversation or audit trail when they matter.

### 3.2 Intent Before Tool

Users should not need to choose "table", "diagram", "report" or "dashboard" as a technical tool. They should express intent:

- "compare these options",
- "show the risks",
- "turn this into a plan",
- "prepare a version for the board",
- "create initiatives from this",
- "map the process",
- "make this client-ready",
- "build a dashboard from this spreadsheet".

Canvas chooses the right form and asks when the choice is ambiguous.

### 3.3 Business Artifacts, Not Decorative Output

Every artifact should have a business role. If Canvas creates a chart, the chart should have an insight. If it creates a table, the table should support a decision. If it creates a report, the report should include assumptions, limits and next steps.

### 3.4 Governed AI Actions

Important actions follow:

```text
proposal -> user approval -> execution -> read-back -> audit
```

This applies to creating initiatives, decisions, client deliverables, external shares, tasks, KPI candidates and any durable object.

### 3.5 Markdown-First, JSON-Native, Always Markdown Projection

Business Work Canvas follows `docs/architecture/adr/0001-markdown-first-json-native-markdown-projection.md`.

Natural documents use Markdown as source of truth. Native artifacts use JSON as source of truth. Every native artifact must have a Markdown projection so Teresa, search, review, MCP and export can understand it.

Business users must not see raw JSON unless they explicitly open a technical source view.

### 3.6 Trust And Traceability

Business outputs must show:

- source material,
- assumptions,
- confidence,
- limitations,
- generated/edited by,
- version history,
- downstream conversions,
- unresolved questions.

Canvas should make uncertainty visible, not hidden.

## 4. Functional Scope

### 4.1 Drafting And Writing

Canvas must support professional drafting for:

- business notes,
- meeting notes,
- client notes,
- strategy memos,
- executive summaries,
- decision memos,
- implementation plans,
- proposals,
- research reports,
- market analysis,
- board updates,
- operating plans.

Core capabilities:

- edit directly,
- ask Teresa to rewrite selected text,
- shorten, expand, clarify, formalize or simplify,
- adapt audience and tone,
- create outline,
- create executive version,
- create detailed version,
- show changes,
- restore version,
- export.

### 4.2 Structured Business Tables

Tables are first-class business artifacts, not Markdown decoration.

Required table forms:

- option comparison,
- decision matrix,
- risk matrix,
- RACI,
- roadmap,
- action plan,
- backlog,
- KPI table,
- vendor scoring,
- competitor comparison,
- customer segment table,
- cost-benefit table,
- assumptions table,
- initiative candidate table,
- task extraction table.

Required interactions:

- sort,
- filter,
- resize columns,
- add/edit rows,
- add/edit columns,
- copy,
- export CSV/XLSX,
- convert rows into initiatives/tasks/notes,
- summarize table as narrative,
- generate chart from table.

### 4.3 Charts And Business Visualizations

Charts must communicate business meaning, not only render data.

Required chart forms:

- line chart,
- bar chart,
- stacked bar chart,
- pie/donut chart,
- scatter chart,
- heatmap,
- radar chart,
- waterfall chart,
- KPI card row,
- funnel chart,
- timeline chart,
- risk heatmap.

Every chart should include:

- title,
- business question,
- data source,
- key insight,
- caveat or limitation,
- ability to change chart type when appropriate.

### 4.4 Diagrams And Thinking Maps

Canvas should help users understand complex situations visually.

Required visual thinking forms:

- process map,
- flowchart,
- decision tree,
- dependency map,
- stakeholder map,
- operating model map,
- customer journey,
- org chart,
- roadmap,
- Gantt/timeline,
- mind map,
- assumptions map.

Use cases:

- map a process before proposing improvement,
- turn a meeting note into action flow,
- turn a strategy into roadmap,
- turn a decision into trade-off tree,
- turn a research finding into stakeholder map.

### 4.5 Research Workspace

Research is a governed workspace, not a generated paragraph.

Required research structure:

- research question,
- hypotheses,
- sources,
- extracted facts,
- contradictions,
- confidence,
- source quality,
- gaps,
- implications,
- recommendations,
- next research questions,
- final report.

Research outputs:

- source table,
- evidence map,
- competitor table,
- market map,
- report,
- presentation,
- decision memo,
- initiative candidates.

### 4.6 Decision Workspace

This is a core Consultify advantage.

Required decision forms:

- decision memo,
- options analysis,
- decision matrix,
- trade-off table,
- risk-impact matrix,
- recommendation card,
- assumptions list,
- unresolved questions,
- approval checklist.

Decision output should answer:

- what decision is being made,
- what options exist,
- what criteria matter,
- what evidence supports each option,
- what Teresa recommends,
- what the risks are,
- what must be validated,
- who should approve,
- what execution should start.

### 4.7 Reports And Client Deliverables

Reports should be durable artifacts that can be exported and converted.

Required report types:

- executive report,
- audit report,
- assessment report,
- market research report,
- strategic recommendation report,
- implementation report,
- client-facing report,
- internal operating report.

Standard report sections:

- context,
- objective,
- method,
- evidence,
- analysis,
- key findings,
- recommendations,
- risks,
- limitations,
- next steps,
- appendices.

### 4.8 Presentations

Presentations must not be just "slides from text". They should preserve the argument.

Required presentation forms:

- executive deck,
- board update,
- client proposal,
- strategy deck,
- workshop deck,
- project update,
- investor-style summary,
- operating review.

Capabilities:

- generate outline,
- generate slide structure,
- create speaker notes,
- convert report to deck,
- convert table/chart to slide,
- export to PPTX/PDF,
- create audience-specific variants.

### 4.9 Dashboards

Dashboards should initially be static or refresh-on-demand business views, not real-time BI.

Required dashboard forms:

- KPI dashboard,
- sales dashboard,
- finance dashboard,
- project dashboard,
- risk dashboard,
- initiative dashboard,
- market dashboard,
- client/account dashboard.

Dashboard components:

- KPI cards,
- charts,
- tables,
- filters,
- narrative insights,
- "what changed" summary,
- recommended actions.

### 4.10 Execution Preparation

Canvas must convert thinking into execution.

Allowed target conversions:

- Idea,
- Note,
- Decision,
- Initiative,
- Task,
- Report,
- Presentation,
- Table,
- KPI candidate,
- Research follow-up.

Conversion must preserve lineage:

```text
source conversation + selected content + Canvas draft + generated artifact + target object
```

## 5. UX Doctrine

### 5.1 Claude-Like Right Panel Feel

The right panel should feel like a calm, premium, persistent work surface:

- clean document canvas,
- no unnecessary chrome,
- compact topbar,
- strong typography,
- generous whitespace,
- dark mode coherence with chat,
- artifact feels like a real object, not a chat attachment,
- selected content is understood without noisy UI.

The emotional goal:

```text
"I can think and build here."
```

### 5.2 Conversation On The Left, Work On The Right

The left chat should remain the steering surface. The right Canvas should remain the working surface.

Left panel responsibilities:

- ask,
- clarify,
- guide,
- explain,
- approve,
- continue.

Right panel responsibilities:

- draft,
- structure,
- visualize,
- compare,
- decide,
- prepare output.

### 5.3 Topbar Principles

The Canvas topbar should be compact and action-oriented.

Recommended groups:

- title/name,
- create/new,
- output actions: report, table, chart, presentation, dashboard,
- workspace actions: idea, note, decision, initiative, task,
- file actions: copy, save, upload, export, share, close,
- view actions: document/source/changes,
- diagnostics/version menu.

Do not show save text as primary UI. Use subtle icon state.

### 5.4 Artifact Blocks UX

A Canvas document can contain embedded native blocks:

- table block,
- chart block,
- diagram block,
- dashboard block,
- decision block,
- research block,
- presentation outline block.

Each block should expose local actions:

- ask Teresa about this,
- edit,
- regenerate,
- convert,
- copy,
- export,
- show source,
- show provenance.

### 5.5 Selection UX

Selection should be powerful but quiet.

When the user selects content, Teresa should receive the selected context. UI can show small contextual affordances only when helpful:

- improve this,
- turn into table,
- turn into decision,
- explain,
- extract actions,
- create chart,
- create initiative candidates.

Avoid persistent chips and noisy selected-context bars.

### 5.6 Version And Changes UX

Canvas should make iteration safe.

Required:

- autosave,
- version history,
- restore,
- show changes,
- operation summaries,
- "what changed" explanation,
- failed projection state,
- retry.

### 5.7 Empty State UX

Empty Canvas should invite work, not advertise features.

Recommended prompts:

- Draft a decision memo.
- Compare strategic options.
- Analyze a spreadsheet.
- Create a client report.
- Build a KPI dashboard.
- Turn this conversation into an initiative plan.

## 6. Technology Direction

### 6.1 Existing Foundation

Keep and extend:

- React + TypeScript frontend,
- existing `UnifiedChatPanel`,
- existing `WorkCanvasDocumentPanel`,
- existing Work Canvas routes,
- Markdown-first content envelope,
- version snapshots,
- share/export actions,
- workspace conversions.

### 6.2 Document Editing

Recommended direction:

- short term: keep Markdown editor/renderer,
- medium term: introduce TipTap/ProseMirror for rich document mode,
- keep Markdown source/projection as durable interchange format.

Why TipTap/ProseMirror:

- strong selection/range model,
- inline comments,
- decorations/suggestions,
- structured document nodes,
- compatible with custom embedded blocks.

### 6.3 Markdown Rendering

Keep Markdown as universal projection.

Recommended renderer capabilities:

- GFM tables,
- task lists,
- blockquotes,
- code blocks,
- custom fenced block renderers,
- citations/source references,
- safe sanitization.

### 6.4 Native Tables

Recommended stack:

- custom React table for first version,
- optionally TanStack Table when interactions grow.

Use JSON canonical data and Markdown projection.

### 6.5 Charts

Recommended stack:

- Vega-Lite for AI-generated declarative chart specs,
- `vega-embed` for rendering,
- optional Recharts for hand-built dashboard components.

Why Vega-Lite:

- JSON-native,
- AI-friendly,
- portable,
- validates well,
- works for multiple chart types.

### 6.6 Diagrams

Recommended stack:

- Mermaid for flowcharts, sequence diagrams, Gantt-like diagrams and mind/process maps,
- SVG export/fallback for stable rendering.

### 6.7 Dashboards

Recommended stack:

- native Canvas block composition,
- KPI card components,
- table block,
- chart block,
- filter state stored in JSON.

Avoid building a full BI platform at the start.

### 6.8 Presentations

Recommended stack:

- existing output action pipeline,
- durable presentation JSON model,
- Markdown outline projection,
- PPTX generation using existing server-side presentation tooling where available.

### 6.9 Data Analysis

Recommended staged approach:

1. Start with file parsing and structured table/chart generation without arbitrary code execution.
2. Add controlled server-side analysis jobs for CSV/XLSX/JSON.
3. Later evaluate Pyodide or E2B-like isolated sandbox for Python analysis.

Security default:

- no arbitrary external network access,
- file-scoped execution,
- timeouts,
- audit logs,
- visible analysis code/log when applicable.

### 6.10 Export And Sharing

Required export formats over time:

- Markdown,
- PDF,
- DOCX,
- CSV,
- XLSX,
- PPTX,
- shareable Canvas link,
- copied business summary.

### 6.11 Governance And Audit

Every durable conversion should record:

- source draft,
- source conversation,
- selected range or block,
- operation type,
- user approval,
- generated target object,
- timestamp,
- actor,
- version.

## 7. Implementation Roadmap

### Phase 1: Premium Work Surface

Goal: make Canvas feel as polished and useful as Claude for business documents.

Deliverables:

- refined split layout,
- calm artifact shell,
- editable title,
- autosave,
- version history,
- show changes,
- share/export,
- selected-context operations without noisy chrome.

### Phase 2: Business Artifact Blocks

Goal: introduce native business forms.

Deliverables:

- table block,
- chart block,
- diagram block,
- decision block,
- research block,
- Markdown projection for every block,
- block-level actions.

### Phase 3: Business Transformations

Goal: let users transform work into better formats.

Deliverables:

- text to table,
- table to chart,
- note to decision memo,
- conversation to report,
- report to presentation,
- research to dashboard,
- table rows to initiatives/tasks.

### Phase 4: Research And Decision Workspace

Goal: create the Consultify advantage.

Deliverables:

- research source table,
- hypotheses,
- evidence map,
- confidence,
- contradictions,
- decision matrix,
- options analysis,
- recommendation card,
- approval-ready decision memo.

### Phase 5: Execution Prep

Goal: connect Canvas to downstream business tools.

Deliverables:

- create initiatives from Canvas,
- create tasks,
- create notes,
- create decisions,
- create KPI candidates,
- create reports/decks,
- preserve lineage.

### Phase 6: Team And Workflow Runtime

Goal: move toward Manus-like business operating workspace.

Deliverables:

- workflow step ledger,
- reusable templates,
- recurring dashboard/report refresh,
- collaboration,
- approval checkpoints,
- shared artifact library.

## 8. First Templates For DBR77 Users

The first DBR77-friendly templates should be practical, not abstract.

Recommended templates:

- Strategy Note,
- Client Meeting Note,
- Decision Memo,
- Risk Matrix,
- Initiative Plan,
- KPI Review,
- Market Research Report,
- Competitor Comparison,
- Project Roadmap,
- Executive Update,
- Client Proposal,
- Implementation Plan,
- Operations Dashboard,
- Sales/Finance Review,
- Workshop Summary.

Each template should have:

- purpose,
- required inputs,
- recommended structure,
- default artifact blocks,
- possible conversions,
- export target.

## 9. Acceptance Criteria For "Claude-Level" Feeling

Canvas is good enough when:

- users understand that the right panel is a persistent artifact, not a message,
- they can iterate without fear because versions and changes are visible,
- they can select content and ask Teresa for targeted work,
- Teresa can choose the right business form,
- tables/charts/diagrams feel native,
- outputs can become decisions, initiatives, tasks, reports or presentations,
- no raw technical payload leaks into business UI,
- dark mode feels like one coherent application,
- the workspace is useful even before full automation exists.

## 10. Source Audit Notes

Reviewed public references:

- Claude Help Center: Artifacts, live artifacts, right-side artifact panel, versioning, export, sharing, persistent/live artifact direction.
- OpenAI Help Center: ChatGPT Canvas, targeted selection edits, inline suggestions, shortcuts, version history, show changes, React/HTML sandbox, Python execution.
- OpenAI Help Center: Data Analysis, structured file analysis, interactive tables/charts, generated analysis code and sandboxed execution.
- Gemini Help and Gemini overview: Canvas docs/apps/slides, quiz, infographic, web page, Audio Overview, export to Docs/Slides/Colab.
- Manus docs and product pages: data visualization, dashboards, reports, slides, collaboration, shared workspace, recurring business workflow direction.

## 11. Final Doctrine

Business Work Canvas should be the place where DBR77 users feel:

```text
I can bring a complicated business situation here, work through it with Teresa, see it become clear, and turn it into something my organization can act on.
```

That is the product promise.
