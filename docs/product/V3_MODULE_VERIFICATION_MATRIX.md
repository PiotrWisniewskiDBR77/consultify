# MVP v3 — Module Verification Matrix (SSOT ↔ Code ↔ UX)

> **Status:** Working document (verification pass)  
> **Owner:** Product + Engineering  
> **Goal:** During the walkthrough (module-by-module), capture **OK / Gap / Open decision / Go-live risk** and translate gaps into a task backlog with acceptance criteria.

---

## 0) How to use this matrix (canonical)

For each module:

- Verify **SSOT is consistent** (no contradictions with `SYSTEM_ARCHITECTURE_BRIEF.md`, `OPERATING_MODEL_V3.md`, `REQUIREMENTS_V3_SSOT.md`).
- Verify **code “as-is V2”** matches what we plan to show the client next week (no overpromising).
- Verify **UX compliance** with `docs/ui-standards/` (shell/hub/table standards, i18n, locked/read-only behavior).
- Verify **cross-cutting** rules: traceability, backlinks, export/share quality, scheduled automation where relevant.
- Record outcomes:
  - **OK** (ready / confirmed)
  - **GAP** (missing or incorrect)
  - **OPEN DECISION** (needs a product call)
  - **GO-LIVE RISK** (must fix before the client)

Output of this doc becomes: **task backlog (P0/P1)** with acceptance criteria.

---

## 1) Global non‑negotiables (apply to every module)

### 1.1 System axis & artefacts (MUST)

SSOT:
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`

Checklist:
- [ ] Any object that can lead to an initiative has canonical source rules respected (**ToolSession / AssessmentReport only**, with `MYWORK ToolSession` materialization when needed).
- [ ] “Supporting artefacts” (Notebook/Workspace/Report/Deck) do not silently become initiative sources.
- [ ] Backlinks (“Used in”) exist where the UX claims they exist.

### 1.2 UI/UX compliance (MUST)

SSOT:
- `docs/ui-standards/README.md` (index)
- `docs/ui-standards/UI_UX_CANON_V3.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/03-modules/table-preview-pane-standard.md` (where applicable)

Checklist:
- [ ] i18n (PL+EN) for user-facing strings
- [ ] “locked/read-only” surfaces behave consistently (no hidden edits)
- [ ] module hub topbar order and view modes match standards
- [ ] “propose → accept/reject” for AI changes on artefacts that can be edited

### 1.3 Share / export / deliverables (MUST where present)

Checklist:
- [ ] public share links are consistent (expiry, password, watermark/read-only)
- [ ] export baselines match `docs/REPORT_BUILDER_EXPORTS_STANDARD.md` (for report exports)
- [ ] “online artifact is primary; exports are renders” is either true in code or clearly labeled “target v3”

---

## 2) Module-by-module verification table (fill during walkthrough)

> **Columns meaning**
> - **SSOT**: canonical spec docs for the module
> - **As‑is code**: key routes/components/services that implement it today
> - **UX standards**: required UI standards to validate against
> - **Cross‑cutting**: traceability/backlinks/export/share/scheduling impacts
> - **Status**: OK / GAP / OPEN / RISK
> - **Notes**: concrete evidence + what to fix

### 2.1 Chat (support layer)

- **SSOT**: `docs/product/OPERATING_MODEL_V3.md`
- **As‑is code**: _(fill during walkthrough)_
- **UX standards**: _(fill)_
- **Cross‑cutting**:
  - context handoff to Interview/Notebook/Tools
- **Status**: ⬜
- **Notes**:

### 2.2 MyWork (personal hub)

- **SSOT**: `docs/product/OPERATING_MODEL_V3.md`, `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- **As‑is code**: MyWork screens + conversions
- **UX standards**: artifact identity, preview pane where relevant
- **Cross‑cutting**:
  - `MYWORK ToolSession` materialization rule for outputs
- **Status**: ⬜
- **Notes**:

### 2.3 Interview (form engine + assignments + insights)

- **SSOT**: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- **As‑is code**: _(fill)_
- **UX standards**: “one question per screen” rules, i18n, attachments if present
- **Cross‑cutting**:
  - Insights = context only (not initiative sources)
- **Status**: ⬜
- **Notes**:

### 2.4 Tools (Discovery + Licensed) + ToolSessions

- **SSOT**: `docs/product/TOOLS_CATALOG_V3.md`, `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- **As‑is code**: _(fill)_
- **UX standards**: ModuleHub, Workspace 3-tools strip where used
- **Cross‑cutting**:
  - output packages → initiatives/reports/presentations
- **Status**: ⬜
- **Notes**:

### 2.5 Initiatives (governance layer)

- **SSOT**: governance docs + operating model
- **As‑is code**: _(fill)_
- **UX standards**: N-mode sections, decision/task panels
- **Cross‑cutting**:
  - sources shown read-only
  - link graph “Used in”
- **Status**: ⬜
- **Notes**:

### 2.6 Execution (tasks/calendar/kanban)

- **SSOT**: `docs/product/OPERATING_MODEL_V3.md` + execution SSOT (if exists)
- **As‑is code**: _(fill)_
- **UX standards**: view modes + table/preview (if used)
- **Cross‑cutting**:
  - reporting inputs (R1)
- **Status**: ⬜
- **Notes**:

### 2.7 Benefits / Realization (KPI/ROI)

- **SSOT**: benefits + economics policy (if canonical)
- **As‑is code**: _(fill)_
- **UX standards**: interactive boards standard if used
- **Cross‑cutting**:
  - inputs for R3/R4 reporting
- **Status**: ⬜
- **Notes**:

### 2.8 Financial Analysis (5 tabs)

- **SSOT**: `docs/product/FINANCIAL_ANALYSIS_V3.md`
- **As‑is code**: _(fill)_
- **UX standards**: interactive boards + table standards
- **Cross‑cutting**:
  - inputs for R2/R3 reporting (economics)
- **Status**: ⬜
- **Notes**:

### 2.9 Notebook (context system) + Link Graph

- **SSOT**: `docs/product/NOTEBOOK_V3.md`, `docs/product/LINK_GRAPH_V3.md`
- **As‑is code**: _(fill)_
- **UX standards**: embedded references + backlinks surfaces
- **Cross‑cutting**:
  - seed → tool session rule if creating outputs
- **Status**: ⬜
- **Notes**:

### 2.10 Workspace (visual engine)

- **SSOT**: Workspace SSOT section in `docs/product/TOOLS_CATALOG_V3.md`
- **As‑is code**: _(fill)_
- **UX standards**: workspace 3-tools strip, locked state
- **Cross‑cutting**:
  - convert-to outputs must be traceable
- **Status**: ⬜
- **Notes**:

### 2.11 Reports (management layer + deliverables)

- **SSOT**:
  - `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
  - `docs/product/REPORT_GENERATOR_V3.md`
  - `docs/product/REPORTING_CANONICAL_TEMPLATES.md`
  - `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`
- **As‑is code**:
  - Report Builder + Management Reports + Scheduled Reports + legacy public snapshots
- **UX standards**: ModuleHub + export/share UX baselines
- **Cross‑cutting**:
  - R1–R4 escalation (RAG)
  - scheduled reports
- **Status**: ⬜
- **Notes**:

### 2.12 Presentations (deck generator)

- **SSOT**:
  - `docs/product/PRESENTATION_GENERATOR_V3.md`
  - `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- **As‑is code**: _(fill)_
- **UX standards**: gamma-like generator rules, theme/brand kit rules (if present)
- **Cross‑cutting**:
  - traceability for slide blocks
- **Status**: ⬜
- **Notes**:

### 2.13 Meeting (planned)

- **SSOT**: `docs/product/MEETING_TOOL_V3.md`
- **As‑is code**: _(fill)_
- **Status**: ⬜
- **Notes**:

---

## 3) Open decisions & contradictions log (capture live)

| ID | Topic | Options | Default | Decision owner | Due | Notes |
|---|---|---|---|---|---|---|
| OD-001 |  |  |  |  |  |  |

---

## 4) Go-live risks (P0)

| Risk | Module | Symptom | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| RISK-001 |  |  |  |  |  |

