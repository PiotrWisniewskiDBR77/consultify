# Canvas Interactivity Research And Implementation Blueprint

Status: `DRAFT / PRODUCT + ENGINEERING BLUEPRINT`
Owner: Product + Engineering
Created: 2026-05-03
Scope: Work Canvas interactivity model, competitor capability inventory, artifact block contract, renderer choices, and phased implementation plan.

## 1. Executive Summary

The next Work Canvas step should not be a richer static Markdown preview. Claude, ChatGPT, Gemini and Manus all treat the right-side workspace as an artifact runtime: a place where documents, code, tables, charts, dashboards, apps, reports and agent outputs can be created, edited, versioned, shared and acted on.

For Consultify, the correct direction is:

```text
Markdown document + typed artifact blocks + governed AI operations + native renderers
```

This keeps the accepted contract from `docs/architecture/adr/0001-markdown-first-json-native-markdown-projection.md`: Markdown-first for natural documents, JSON-native when the content needs native behavior, and always a Markdown projection.

## 2. Competitor Capability Matrix

| Capability | Claude Artifacts | ChatGPT Canvas / Data Analysis | Gemini Canvas | Manus | Consultify priority |
| --- | --- | --- | --- | --- | --- |
| Split chat + work panel | Yes | Yes | Yes | Yes | Must have |
| Editable long-form documents | Markdown/plain text artifacts | Canvas document editing | Canvas docs | Reports/docs | Must have |
| Selection-based AI edits | Iterate on artifact / selected artifact context | Highlight text/code, ask for edits, inline comments | Select and ask | Prompt over workspace output | Must have |
| Version history | Version selector | Back/restore and show changes | Previous/next version | Single workspace history | Must have |
| Markdown projection | Markdown artifacts | Document export to MD | Copy/export docs | Reports/webpages | Already core |
| Tables | Markdown/table artifacts | Interactive data table view | Docs/apps/tables via generated apps | Data tables and dashboards | Must have |
| Charts | React/Recharts, SVG, HTML | Matplotlib, interactive charts | Apps/infographics | Data visualization dashboards | Must have |
| Diagrams | Mermaid, SVG | Rendered code/HTML, markdown diagrams by prompt | Apps/visuals | Reports/dashboards | Should have |
| Interactive apps | React, HTML, AI-powered artifacts | React/HTML sandbox | Apps/games/webpages | Web development projects | Should have |
| Code editing | Code artifacts | Coding canvas | Code view | Dev tasks/browser | Should have |
| Code execution | Artifact error repair, not general code interpreter | Python execution and console | App console/logs, Colab export | Agent sandbox/workflow | Later |
| Data analysis | Via generated artifacts | Secure Python/pandas environment | File prompt to canvas outputs | Data analysis workflow | Must have, phased |
| Dashboards | React interactive dashboards | Charts/tables from analysis | Custom dashboards/apps | Native dashboard output | Must have, phased |
| Slides/decks | Can generate artifacts/outlines | Export docs, generated content | Export to Slides | Slide deck output | Already started |
| Reports | Markdown/HTML docs | Docs/PDF/DOCX | Docs/export | Detailed reports/PDF | Already started |
| Share/publish | Share/publish artifacts | Share canvas asset | Share links/copy canvas | Shareable workspace/pages | Must have |
| Persistent app storage | Published artifacts can store text data | Canvas asset state/version | Shared app data/session data | Workspace/task state | Later |
| Tool integration | MCP from artifacts | GPT actions/files/apps | Google Docs/Slides/Colab | Cloud Browser/accounts/tools | Later |
| Agentic web action | MCP tools only | Workspace agents, apps | Google ecosystem actions | Cloud Browser / My Browser | Later |
| Collaboration | Shared/published artifacts | Shared canvas asset | Shared links/copies | Manus Collab real-time workspace | Later |

## 3. What Others Are Actually Doing

### Claude

Claude treats artifacts as self-contained, reusable content displayed beside the chat. Public docs list Markdown/plain text, code snippets, single-page HTML, SVG, diagrams/flowcharts and interactive React components. Artifacts have versions, code view, copy, download, share/publish, error repair, AI-powered apps, MCP access and persistent storage for published artifacts.

Technical read: Claude's strongest pattern is not "document editor"; it is a typed artifact runtime. It decides when output is substantial enough to become a standalone object, assigns a content kind, renders it in the right sandbox, and keeps chat as the control surface.

### ChatGPT

ChatGPT Canvas is optimized for writing and code revision. It supports direct editing, selection-based prompts, inline suggestions, writing shortcuts, coding shortcuts, version restore, show changes, sharing and downloads. React/HTML is rendered in a sandbox. Python code can execute with console output and fix-bug loops. Data Analysis adds uploaded files, pandas, Matplotlib, interactive tables and selected interactive chart types.

Technical read: OpenAI combines three surfaces: a document/code editor, a code execution sandbox, and typed outputs such as tables/charts. The key UX loop is `select -> ask -> suggest/apply -> show diff`.

### Gemini

Gemini Canvas supports docs, apps, slides and code. It can turn a Canvas doc into a web page, infographic, quiz, Audio Overview, custom visual or app. It supports autosave, selection edits, basic formatting, LaTeX, code view, console/logs, recent changes, export to Docs/Slides/Colab and sharing/copying.

Technical read: Gemini treats Canvas as a document-to-output transformer. A report can become a quiz, infographic, webpage or app from the same workspace.

### Manus

Manus is less about a document editor and more about a task workspace. Its strongest features are Cloud Browser, authenticated workflows, data visualization, slide/report/dashboard/webpage outputs, collaboration links and reusable/recurring workflows.

Technical read: Manus wraps artifacts in an agent run ledger. The workspace shows what the agent is doing, what it produced, and lets humans steer the next operation.

## 4. Consultify Target Capability Set

### Tier 1: Must Ship Next

- Interactive Markdown document with typed embedded blocks.
- Tables with sort, filter, copy, CSV/XLSX export and Markdown projection.
- Charts from JSON specs, starting with Vega-Lite.
- Mermaid diagrams from fenced code blocks.
- Selection-based AI operations with visible diff before apply.
- Version history with restore and show changes.
- Share/export per artifact.

### Tier 2: High Leverage

- TipTap/ProseMirror document editor for inline comments, suggestions and block-aware editing.
- Native presentation/table/report output blocks that become durable outputs.
- HTML preview sandbox for simple webpage/app artifacts.
- React sandbox for interactive calculators, dashboards and prototypes.
- Dataset upload to table/chart/report pipeline.

### Tier 3: Agentic Runtime

- Python analysis sandbox for CSV/XLSX/PDF/JSON.
- Analysis logs and reproducible code.
- Dashboard generator with filters and KPI cards.
- Browser/research workflow operations with approvals.
- Multi-user collaboration and shared workspace sessions.
- Persistent app storage for published interactive artifacts.

## 5. Canvas Block Contract

The existing `CanvasDocumentState` can remain the document-level shell. The next layer should be a block model inside the content envelope.

```ts
type CanvasArtifactBlockKind =
  | 'markdown'
  | 'table'
  | 'chart'
  | 'diagram'
  | 'html_app'
  | 'react_app'
  | 'python_analysis'
  | 'slides'
  | 'report'
  | 'workflow_result';

type CanvasArtifactBlockStatus =
  | 'draft'
  | 'renderable'
  | 'needs_data'
  | 'failed'
  | 'stale';

interface CanvasArtifactBlock<TData = unknown> {
  id: string;
  kind: CanvasArtifactBlockKind;
  title?: string;
  canonicalFormat: 'markdown' | 'json';
  contentMd: string;
  contentJson?: TData;
  schemaVersion: string;
  status: CanvasArtifactBlockStatus;
  projectionStatus: 'synced' | 'stale' | 'failed' | 'missing';
  provenance: {
    draftId: string;
    conversationId?: string;
    sourceBlockIds?: string[];
    sourceFileIds?: string[];
    createdBy: 'user' | 'ai' | 'system';
    operationId?: string;
    createdAt: string;
    updatedAt: string;
  };
  capabilities: {
    editable: boolean;
    selectable: boolean;
    exportable: boolean;
    executable?: boolean;
    shareable?: boolean;
  };
}
```

Document-level envelope:

```ts
interface CanvasDocumentEnvelope {
  schemaVersion: 'canvas-document-v2';
  title: string;
  kind: 'document' | 'research' | 'decision' | 'plan' | 'table' | 'presentation' | 'report' | 'dashboard';
  canonicalFormat: 'markdown' | 'json';
  contentMd: string;
  blocks: CanvasArtifactBlock[];
  markdownProjectionStatus: 'synced' | 'stale' | 'failed' | 'missing';
}
```

Rule: natural documents can keep Markdown as canonical, but every native interactive object must have its own block-level JSON source and Markdown projection. Do not encode a dashboard only as prose.

## 6. Native Block Schemas

### Table Block

```ts
interface CanvasTableBlockData {
  columns: Array<{
    id: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
    sourceField?: string;
  }>;
  rows: Array<Record<string, string | number | boolean | null>>;
  summary?: string;
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
  filters?: Array<{ columnId: string; operator: string; value: unknown }>;
}
```

Projection: Markdown table plus a short summary and data limitations.

### Chart Block

```ts
interface CanvasChartBlockData {
  engine: 'vega-lite';
  spec: Record<string, unknown>;
  dataset?: Array<Record<string, unknown>>;
  insight?: string;
  assumptions?: string[];
}
```

Projection: chart title, insight, source data summary and a fallback Markdown table for small datasets.

### Diagram Block

```ts
interface CanvasDiagramBlockData {
  engine: 'mermaid' | 'svg';
  source: string;
  description?: string;
}
```

Projection: fenced `mermaid` block or SVG export link plus description.

### HTML / React App Block

```ts
interface CanvasAppBlockData {
  runtime: 'html' | 'react';
  files: Record<string, string>;
  entryFile: string;
  allowedPackages?: string[];
  networkAccess: 'none' | 'approved_domains' | 'open';
  approvedDomains?: string[];
}
```

Projection: app purpose, inputs, outputs, dependencies and safety state.

### Python Analysis Block

```ts
interface CanvasPythonAnalysisBlockData {
  files: Array<{ id: string; name: string; mimeType: string }>;
  code: string;
  outputs: Array<
    | { type: 'stdout'; text: string }
    | { type: 'dataframe'; table: CanvasTableBlockData }
    | { type: 'chart'; chart: CanvasChartBlockData }
    | { type: 'image'; mimeType: string; base64: string; alt?: string }
  >;
  execution: {
    sandbox: 'server-python' | 'e2b' | 'pyodide';
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
}
```

Projection: methodology, generated code summary, outputs and limitations.

## 7. Renderer Choices

| Block kind | Renderer | Why | First implementation |
| --- | --- | --- | --- |
| Markdown | Current Markdown renderer, then TipTap read/edit | Already exists and matches ADR | Keep current renderer, improve block injection |
| Table | Custom React table | Business users need sort/filter/export | Lightweight table component using native JSON |
| Chart | Vega-Lite via `vega-embed` | Declarative JSON spec, AI-friendly, portable | Render `chart` blocks and fenced `vega-lite` code |
| Diagram | Mermaid renderer | Fast diagrams from text | Render fenced `mermaid` blocks safely |
| HTML app | Sandboxed iframe | Simple webpages/calculators | Static iframe with strict sandbox |
| React app | Sandpack or equivalent | Live React preview with package control | Behind feature flag |
| Python analysis | Server sandbox, E2B or Pyodide | Needed for real data analysis | Start with server-side controlled job or E2B adapter |
| Slides | Existing output action + native deck model | Already in product direction | Durable output artifact with Markdown outline |
| Report | Markdown report + evidence blocks | Consulting-native output | Current report action plus citations/lineage |
| Workflow result | Operation ledger renderer | Manus-like transparency | Timeline of steps, approvals and outputs |

Security default: all executable renderers start with network disabled. Any outbound network access requires explicit approval and a visible runtime state.

## 8. AI Operation Model

Current operations cover `replace_selection`, `append_section` and `update_document`. The next generation should be block-aware:

```ts
type CanvasBlockOperation =
  | { type: 'insert_block'; afterBlockId?: string; block: CanvasArtifactBlock }
  | { type: 'update_block'; blockId: string; patch: unknown; summary: string }
  | { type: 'delete_block'; blockId: string; reason: string }
  | { type: 'convert_block'; blockId: string; targetKind: CanvasArtifactBlockKind; instruction: string }
  | { type: 'generate_from_selection'; selection: CanvasSelection; targetKind: CanvasArtifactBlockKind; instruction: string }
  | { type: 'run_analysis'; blockId: string; fileIds: string[]; question: string };
```

Every AI operation should return:

- proposed changes,
- affected blocks,
- Markdown projection diff,
- validation result,
- required approval level,
- version snapshot.

## 9. Phased Implementation Packages

### Package A: Interactive Blocks Foundation

Goal: add typed artifact blocks without replacing the existing Canvas.

- Extend frontend/shared Canvas types with `CanvasArtifactBlock`.
- Extend backend draft envelope to optionally store `blocks`.
- Add Markdown projector for table/chart/diagram blocks.
- Add block-aware version snapshots.
- Add tests for projection status and no raw JSON leakage.

Exit criteria: a Canvas draft can contain Markdown plus native table/chart/diagram blocks and still render/export as Markdown.

### Package B: Table, Chart And Diagram Quick Wins

Goal: first visible interactivity like competitors.

- Implement table block renderer with sort/filter/copy/export.
- Implement Vega-Lite chart renderer with graceful fallback.
- Implement Mermaid diagram renderer.
- Add AI actions: `create table`, `create chart`, `create diagram from selection`.
- Add backend validators for block JSON.

Exit criteria: user can ask Teresa to turn selected text/data into a table, chart or diagram in Canvas.

### Package C: Document Editor Upgrade

Goal: move toward ChatGPT/Gemini-style inline editing.

- Evaluate and adopt TipTap/ProseMirror for document mode.
- Preserve Markdown source/projection rules.
- Add inline comments/suggestions data model.
- Add accept/reject suggestion flow.
- Keep MD mode as source/diagnostic view.

Exit criteria: user can select a paragraph, request edits, see suggestions and apply/reject with version history.

### Package D: Safe HTML / React Runtime

Goal: Claude/OpenAI-style interactive apps.

- Add static HTML sandbox iframe.
- Add React sandbox behind feature flag, likely Sandpack.
- Add package allowlist and network policy.
- Add console/error capture and "ask Teresa to fix" loop.
- Add share/export for app blocks.

Exit criteria: user can create a small calculator/dashboard/prototype that runs inside Canvas without escaping sandbox rules.

### Package E: Data Analysis Runtime

Goal: ChatGPT Data Analysis / Manus Data Viz equivalent.

- Add dataset upload/import pipeline for CSV/XLSX/JSON/PDF.
- Add Python execution adapter with isolated jobs.
- Return output blocks: dataframe, chart, image, report section and code log.
- Add "view analysis" panel.
- Add retry/fix loop on execution errors.

Exit criteria: user can upload a spreadsheet, ask a business question, and get an interactive table, chart and narrative insight in Canvas.

### Package F: Agent Workflow Workspace

Goal: Manus-like work execution layer.

- Add workflow run object and step ledger.
- Add operations: research, extract, analyze, generate report/deck/dashboard, publish/share.
- Add explicit approval checkpoints for external actions.
- Add browser/tool integration only through governed adapters.
- Add collaboration/share history later.

Exit criteria: Canvas can show not only the final artifact, but the trace of how Teresa built it and what actions are waiting for approval.

## 10. Product Defaults For Consulting Workspace

The first user-facing templates should be:

| Template | Blocks |
| --- | --- |
| Strategy note | Markdown, decision table, risks chart |
| Market research report | Markdown, source table, comparison chart, citations |
| Client proposal | Markdown, pricing table, timeline diagram, deck outline |
| KPI review | KPI table, line/bar charts, executive summary |
| Initiative plan | Markdown, milestones table, RACI table, risk heatmap |
| Data analysis | Uploaded dataset, dataframe table, chart, findings report |

## 11. Source Notes

Public sources reviewed:

- Claude Help Center: `What are artifacts and how do I use them?`
- OpenAI Help Center: `What is the canvas feature in ChatGPT and how do I use it?`
- OpenAI Help Center: `Data analysis with ChatGPT`
- Google Gemini Apps Help: `Create docs, apps and more with Canvas`
- Manus Documentation: `Cloud browser`
- Manus Documentation: `Data Analysis & Visualization`
- Manus Documentation: `Manus Collab`
- Vega-Lite documentation and examples
- Sandpack public documentation and CodeSandbox overview
- TipTap AI Suggestion / Comments documentation

## 12. Implementation Decision

Recommended next engineering start: Package A and Package B together.

Reason: this gives the visible "Claude/Manus/OpenAI feeling" fastest without committing immediately to a full editor migration or code execution platform. Tables, charts and diagrams are low-risk, high-value, consulting-native and compatible with the current Markdown-first contract.
