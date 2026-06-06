# Interview → Initiatives Tab — Deep Code-Verified Audit

**Module:** Interview Hub, `InterviewTab === 'initiatives'`
**Branch:** `feat/wave1-foundations`
**Date:** 2026-06-05
**Auditor scope:** the interview-side Initiatives tab AND its seam to the canonical platform-wide Initiatives module.
**Method:** Read / Grep / Glob / `git log` only. No code modified.

---

## SCORE: 72 / 100

A genuinely-honest, real-persisted view that correctly deep-links into the canonical
Initiatives module and creates canonical rows through the wizard — materially better than
the Canvas/handoff "hand-rolled insert" disease this codebase has been fighting. It loses
points on **one structural inflow bug** (the D5 finding→initiative handoff creates
initiatives that can never appear in this tab), **org-not-project scoping** (wrong blast
radius for multi-project orgs), **a cosmetic multi-select with no bulk action**, **dead
state/route landmines**, and **deliberate-but-undocumented column divergence** from the
canonical table. None of these are data-corruption class; all are traceability / coherence
class — which is precisely the axis the owner said matters most for this feature.

Scoring rationale:
- Data-source honesty (real persisted only): **excellent** (+).
- Canonical create via wizard: **excellent** (+).
- Deep-link parity to canonical detail: **very good** (+).
- Handoff inflow visibility: **broken** (−−).
- Scoping coherence: **wrong default** (−).
- Bulk UX: **dead-end** (−).
- Latent landmines (dead route w/ competing schema, dead wizard state): **−**.

---

## VERDICT 1 — "REAL PERSISTED ONLY" RULE: **HOLDS. ✅**

The invariant in the load-bearing comment is honored in code.

`src/components/Interview/InterviewHub.tsx:425-429`:
```
// NOTE: Synthetic "derived initiatives" generator was intentionally removed.
// The Interview > Initiatives tab MUST show only real persisted initiatives
// returned from /initiatives?source=interview_insight. ...
// Adding fake rows breaks traceability and parity with the Initiatives module.
```

Traced every writer of the backing state `interviewInitiatives`
(`InterviewHub.tsx:761`). There are exactly **three** call sites of
`setInterviewInitiatives`, and none injects synthetic rows:

1. `InterviewHub.tsx:1068` — initial load:
   `setInterviewInitiatives(unwrapApiList(initiativesRes.value, 'initiatives'))`
   where `initiativesRes` is `Api.get('/initiatives?source=interview_insight')`
   (`InterviewHub.tsx:1035`). Real API.
2. `InterviewHub.tsx:1072` — `setInterviewInitiatives([])` on the rejected branch.
   Honest empty state.
3. `InterviewHub.tsx:8569` — optimistic upsert after wizard create, but the rows merged
   in come from `onCreated(created)` where `created[].id` is the **real** id returned by
   the canonical `POST /initiatives` (see Wizard verdict). Not fake.

The refresh path (`loadInterviewInitiatives`, `InterviewHub.tsx:1121-1135`) likewise reads
only the API and sets `[]`/error on failure.

**Demo-data leakage check — clean.** Even though the Interview demo dataset contains an
entity of `type: 'initiative'` (`interviewDemoData.ts:1285-1286`), that object is a
**handoff-target reference inside insights**, never routed into `setInterviewInitiatives`.
`isUsingDemoData` gates assignments/insights/templates permissions
(`InterviewHub.tsx:814-820`) but is **never** consulted on the initiatives data path. The
empty-state copy is honest: "No initiatives created from interview yet"
(`InterviewHub.tsx:7434`), not a fabricated row.

The dead `INTERVIEW…` "derived initiatives generator" referenced in the comment is gone —
`grep` finds no synthetic generator anywhere in the file.

**Conclusion:** The tab is a genuine, traceable view of persisted `initiatives` rows whose
`source_type = 'interview_insight'`. The owner's hardest invariant is intact.

---

## VERDICT 2 — PARITY WITH THE CANONICAL INITIATIVES MODULE: **PARTIAL / DIVERGENT-BY-DESIGN, WITH ONE BROKEN SEAM.**

### 2a. Data source: two different endpoints, same physical table

| Surface | Fetch | Scope |
|---|---|---|
| **Interview tab** | `Api.get('/initiatives?source=interview_insight')` (`InterviewHub.tsx:1035,1123`) → REST `InitiativeController.getInitiatives` | **org-scoped**, filtered by `source_type` |
| **Canonical Initiatives module** | `V8PlanningApi.getPortfolio({...})` with fallback `Api.getInitiatives(currentProjectId)` (`InitiativesHub.tsx:368-392`) | **project-scoped**, V8 portfolio read |

Both ultimately read the **single** physical `initiatives` table (confirmed in Schema-Drift
section), so there is no double-bookkeeping. But they reach it via **two different read
APIs with different scoping defaults**. That is the root of the coherence questions below.

### 2b. Column parity: deliberately slimmer (acceptable, but undocumented)

Interview tab renders **7 columns** (`InterviewHub.tsx:6959-6967`):
`select · title · status · priority · source · date · actions`.

The canonical `InitiativeController.getInitiatives` mapping
(`InitiativeController.ts:435-468`) returns ~30 fields (axis, area, summary, hypothesis,
businessValue, costCapex/Opex, expectedRoi, valueDriver, confidenceLevel, currentStage,
owner avatars, progress, evidenceRefs, actionContract, sourcePack, …). The tab throws all
of that away — `InterviewInitiativeDraft` (`InterviewHub.tsx:390-404`) only models 12
fields and the table surfaces 6.

This is a **justified consultant-triage view** (you don't want a 30-column financial grid
inside an interview workflow). But it is **undocumented divergence**: nothing tells a future
maintainer that the slim column set is intentional vs. an unfinished port. The `source`
column is the one piece of value-add the canonical table doesn't have — it back-links to
the originating insight (`InterviewHub.tsx:7221-7223,7328-7339`).

### 2c. Detail navigation: **canonical, not divergent. ✅**

Row click and the row-action "Open record" both
`navigate('/initiatives?open=<id>&mode=doc')`
(`InterviewHub.tsx:7242, 7371-7373`). There is **no** divergent in-interview detail view —
it routes into the real Initiatives doc surface. The canonical hub resolves that deep-link
robustly: `V8PlanningApi.getInitiative(openId)` → REST `GET /initiatives/:id` →
`source=interview_insight` list fallback (`InitiativesHub.tsx:730-746`). So the link
survives even for interview-only rows. This is the strongest parity point in the feature.

### 2d. Status workflow: **aligned with the canonical state machine. ✅**

The tab drives `DRAFT → PENDING_REVIEW → REVIEW` via
`PATCH /initiatives/:id/status` (`InterviewHub.tsx:2251`,
handler `handleUpdateInterviewInitiativeStatus` 2244-2273). Those exact transitions are
**valid** in the canonical `VALID_TRANSITIONS` table
(`server/src/constants/initiativeStatuses.ts:303-308`):
```
DRAFT: [PENDING_REVIEW, CANCELLED]
PENDING_REVIEW: [REVIEW, DRAFT, CANCELLED]
REVIEW: [PROMOTED, DRAFT, CANCELLED]
```
and the canonical comment confirms the intended phase chain
(`InitiativeController.ts:1228`: `DRAFT -> PENDING_REVIEW -> REVIEW -> PROMOTED -> ...`).
So the interview tab is **FAZA-1 (proposal)** of the same governed lifecycle, handing off to
the Initiatives module at REVIEW. The "Approve and move forward" action
(`InterviewHub.tsx:7394-7405`) is correctly gated on `canReviewInsights` and, on success,
deep-links into the canonical module (`opt.openInInitiatives`, `InterviewHub.tsx:2261-2263`).
This is coherent governance, not a parallel workflow.

⚠️ **Residual risk (P2):** the canonical `updateInitiativeStatus` enforces gate-readiness
and (for `PENDING_REVIEW`) KPI-schema checks (`InitiativeController.ts:1187-1216, 1619`).
Wizard-created drafts carry `successCriteria` only when `candidate.suggestedKpi` exists
(`InitiativeWizardModal.tsx:494`). A draft with no suggested KPI may be **silently
rejected** by the gate when the consultant clicks "Send to review"; the tab surfaces only a
generic `toast.error('Failed to update status')` (`InterviewHub.tsx:2269`) — no reason
shown. The backend returns a structured reason; the tab discards it.

---

## VERDICT 3 — THE HANDOFF INFLOW (D5): **STRUCTURALLY BROKEN FOR THIS TAB. ❌ (P0)**

This is the most important finding. Commit `f45fd2d8db`
("finding handoff creates real initiative/decision/task (D5)") made the no-target handoff
mint a **real** canonical entity instead of an orphan placeholder — good. But it created the
initiative through a path that **does not tag `source_type`**, so the created initiative
**can never appear in the Initiatives tab that is supposed to show it.**

Trace:

`server/src/routes/v8/interview-insights.routes.ts:789-808` (default `targetType='initiative'`):
```ts
const { default: initiativeService } = await import('../../services/initiativeService.js');
const initiative = await initiativeService.createInitiative({
  organization_id: organizationId,
  project_id: validProjectId || undefined,
  title,
  summary,
  status: 'DRAFT',
  owner_id: userId,
  market_context: `Created from interview finding ${findingId}`,
} as any);
```

→ `initiativeService.createInitiative` (`server/src/services/initiativeService.ts:65-67`)
→ `InitiativeDefinitionService.createInitiative`
(`server/src/services/initiative/InitiativeDefinitionService.ts:96-147`). Its INSERT
column list (lines 104-111) is:
```
id, organization_id, org_id, project_id, title, axis, area, summary, hypothesis,
status, current_stage, business_value, competencies_required, cost_capex, cost_opex,
expected_roi, social_impact, start_date, pilot_end_date, end_date, due_date,
owner_business_id, owner_id, owner_execution_id, sponsor_id, market_context,
created_at, updated_at
```
**There is no `source_type` and no `source_id` column in this INSERT, and
`CreateInitiativeData` (lines 38-45) does not even declare those fields.** The created row
gets `source_type = NULL` (or the table default).

Meanwhile the tab lists with `source_type = 'interview_insight'`
(`InterviewHub.tsx:1035`; controller filter `InitiativeController.ts:392-411`). A NULL
`source_type` will never match. **Net effect:**

- A finding handed off to an initiative creates a real, canonical initiative.
- That initiative is invisible in Interview → Initiatives (the place a consultant would
  look for "initiatives from this interview").
- The back-link is **NOT bidirectional**: provenance lives only in `market_context`
  free-text (`"Created from interview finding <id>"`) and in the org-context claim
  (`interview-insights.routes.ts:829-868`), neither of which the tab queries. The finding
  itself records the handoff (`recordHandoff`, line 822), so finding→initiative is tracked;
  but initiative→finding and tab-visibility are not.

By contrast the **wizard** path (next verdict) sets `source_type='interview_insight'`
correctly. So the platform now has **two inflows into the same tab with different
fidelity** — exactly the kind of seam-drift the owner flagged. A consultant who promotes via
the wizard sees the row; a consultant who hands off a finding does not. Same intent, two
outcomes.

**This is the make-or-break defect for "is this a traceable view or a half-built mirror."**
The view is honest about what it queries — but the inflow is inconsistent, so the view is
**incomplete through no fault of its own UI**.

### Decision/Task targets are correctly out of scope
For `targetType` `decision`/`task` (`interview-insights.routes.ts:749-788`) the handoff
routes to `decisionService` / `TaskService` and links to `/my-work/...`. Those legitimately
do **not** belong in the Initiatives tab, so their absence here is correct. Only the
`initiative` branch is the bug.

---

## VERDICT 4 — THE WIZARD: **CANONICAL, CORRECT. ✅**

The interview tab launches `InitiativeWizardModal` (`InterviewHub.tsx:8545-8562`) with:
```
creationSourceType="interview_insight"
creationSourceId={null}
```
The wizard creates via `createInitiativeWriteTruth`
(`InitiativeWizardModal.tsx:464-496`), which is `POST /initiatives`
(`src/services/initiativeWriteTruth.ts:117-118`) → `InitiativeController.createInitiative`.
That handler **does** persist source tracking
(`InitiativeController.ts:602-657`, columns `source_type, source_id, action_contract_json,
source_pack_json, evidence_refs_json`) and enforces the traceability guard "sourceId is
required when sourceType is not manual" (lines 589-597).

The wizard also prefers a candidate's **anchored** source over the creation default
(`InitiativeWizardModal.tsx:461-463`, `ANCHORED_SOURCE_TYPES` includes `interview_insight`,
`interview_finding`, `interview_session`, line 180-190), so a candidate generated from a
specific insight gets that insight as its `source_id`. This is exactly the
provenance the handoff path is missing.

After create, the tab refetches (`onClose → loadInterviewInitiatives`,
`InterviewHub.tsx:8563-8566`) and optimistically upserts with
`sourceType: …|| 'interview_insight'` (`InterviewHub.tsx:8579`). So wizard-created rows
**do** appear in the tab with correct provenance. **This is the path that proves the tab can
work end-to-end — and the benchmark the handoff path should be held to.**

**No hand-rolled insert here.** This is the "cured" pattern; the handoff is the
still-infected one.

---

## VERDICT 5 — SCHEMA-DRIFT CHECK: **MITIGATED AT RUNTIME, BUT A LATENT LANDMINE EXISTS.**

The codebase historically had two competing `initiatives` schemas. Status today:

### 5a. One physical table, column-aware reads — drift is absorbed. ✅
`/api/initiatives` is mounted to the **pmo** router
(`server/src/Gateway.ts:193,450`: `import initiativesRoutes from './routes/pmo/initiatives.routes.js'`;
`app.use('/api/initiatives', …, initiativesRoutes)`; also `/api/pmo/initiatives` at line 803).
That router's `GET /` → `InitiativeController.getInitiatives`
(`server/src/routes/pmo/initiatives.routes.ts:646`), which is **column-introspecting**:
`getColumnNameSet(await qh.getTableColumns('initiatives'))`
(`InitiativeController.ts:327-329`) and only emits `source_type` predicates when the column
exists (lines 373, 394). So even on an older DB the query degrades gracefully instead of
500-ing.

The single `initiatives` table is **auto-repaired** on startup to include the source
columns: `DatabaseInitializer.ts:REQUIRED_COLUMNS.initiatives` lists
`'source_type', 'source_id', 'source_report_id', 'source_assessment_id', 'created_from'`
(lines 556-561), added via `ALTER TABLE … ADD COLUMN` (the repair loop at 631-673 / 1138).
So in any running instance, `source_type` exists and the tab filter functions.

### 5b. The landmine: a DEAD second router that would create a CONFLICTING table (P1)
`server/src/routes/initiatives.routes.ts` (the **non-pmo** 320-line file) defines its **own**
`initiatives` schema via `CREATE TABLE IF NOT EXISTS`
(`initiatives.routes.ts:47-71`) that **differs** from the canonical one:
- `name TEXT NOT NULL` (canonical primary text col is `title`, `name` is nullable/derived)
- `status TEXT DEFAULT 'DRAFT'` (canonical default is `step3` via
  `InitiativeDefinitionService.ts:122`)
- `created_by TEXT NOT NULL`, `updated_by`, `report_id`, `report_name`,
  `estimated_budget`, `estimated_timeline` — a leaner, assessment-flavored shape.

`grep` confirms this file is imported **only** by `server/src/routes/__tests__/
initiatives-crud.test.ts:39` and is **NOT mounted anywhere** in `Gateway.ts`. So it is dead
in production. But:
- `CREATE TABLE IF NOT EXISTS` is a no-op against the existing canonical table — fine.
- Its `INSERT` requires `name`/`created_by` NOT NULL; if this router were ever wired up
  (copy-paste, a future "lightweight initiatives" feature, or a test that shares the dev
  DB), inserts that satisfy the canonical schema but omit `created_by` would **fail**, and
  reads would return a different column projection (`source_type as sourceType` directly off
  the row vs. the controller's enriched mapping). That is latent drift waiting to bite.

**Recommendation:** delete `server/src/routes/initiatives.routes.ts` (and migrate its test
to the pmo controller) so there is exactly one initiatives write path. It is the same
"two competing schemas" disease, currently dormant.

### 5c. Two CREATE paths with different column fidelity (the real live drift)
Even ignoring the dead router, there are **two live create paths** writing the same table
with different columns:
- `InitiativeController.createInitiative` — writes `source_type/source_id/...` (wizard path). ✅
- `InitiativeDefinitionService.createInitiative` — does **not** write `source_type` (handoff
  path). ❌ (this is the Verdict-3 bug, viewed as schema drift.)

So the practical drift today is not two tables — it's **two writers disagreeing on whether
`source_type` is part of an initiative's identity.**

---

## VERDICT 6 — FILTERING / SCOPING: **WRONG DEFAULT BLAST RADIUS. ⚠️ (P1)**

The tab shows **all org-level** `interview_insight` initiatives, **not** project-scoped ones.

- Fetch passes no `projectId`: `Api.get('/initiatives?source=interview_insight')`
  (`InterviewHub.tsx:1035,1123`). The controller only narrows by project when a `projectId`
  query param is present (`InitiativeController.ts:342-345`) — it isn't.
- Client filter `filteredInterviewInitiatives` (`InterviewHub.tsx:1582-1609`) filters by
  status and free-text search **only** — there is **no `currentProjectId` filter**, even
  though `currentProjectId` is available in the component (`InterviewHub.tsx:558, 1843`).

**Consequence:** in a multi-project org, a consultant working in Project A sees interview
initiatives from Projects B, C, D as well. The canonical Initiatives module, by contrast, is
**project-scoped** (`InitiativesHub.tsx:377` `Api.getInitiatives(currentProjectId)`). So the
two surfaces disagree on scope: the tab is broader than the module it claims parity with.
For a single-project demo org (Atelier Toys) this is invisible; for any real multi-project
tenant it is a confidentiality / relevance leak.

The wizard, meanwhile, **does** create with `projectId` (`InterviewWizard` passes
`projectId={currentProjectId}` at `InterviewHub.tsx:8547`), so the created rows *are*
project-tagged — the tab just doesn't filter on it when reading them back. Easy fix:
pass `projectId` to the list call and/or add a `currentProjectId` predicate to
`filteredInterviewInitiatives`.

---

## DATA INTEGRITY + VISUAL

**Status / priority / source display — consistent with the rest of the app. ✅**
Uses shared `getStatusStyle / getPriorityStyle / getTypeStyle` from
`@/constants/statusColors` (`InterviewHub.tsx:87`), the same helpers the other tabs and the
canonical module use. Status mapping collapses the canonical machine into 3 human buckets —
Draft / Pending review / Moved forward (`InterviewHub.tsx:6912-6944`) — which is sensible
for triage and matches the status filter chips (`InterviewHub.tsx:2820-2832`).

**Empty / loading / error — all honest and wired. ✅**
- Loading: `<LoadingState variant="spinner" />` (`InterviewHub.tsx:6485`).
- Per-tab error degradation: `initiativesLoadError` surfaced via
  `tabDegradedMessage` (`InterviewHub.tsx:6516`), set on the rejected branch
  (`InterviewHub.tsx:1073-1077`).
- Empty: distinguishes "no initiatives at all" vs. "none for this filter"
  (`InterviewHub.tsx:7426-7438`) and offers two real CTAs — go to Insights, or run the
  wizard (`InterviewHub.tsx:7447-7470`). No fabricated placeholder row.

**View-settings panel — present and persisted. ✅**
Hidden-column toggles + row-description toggle persist to localStorage
(`INTERVIEW_INITIATIVES_TABLE_VIEW_STORAGE_KEY`, `…_ROW_DESCRIPTION_STORAGE_KEY`;
`InterviewHub.tsx:156-158, 637-646, 7195-7208`). Column resize is bounded and
neighbor-compensated (`handleInitiativeColumnResize`, `InterviewHub.tsx:6991-7013`).
Outside-click / Escape close handled (`InterviewHub.tsx:669-687`). On par with the other 5
tabs.

**No hardcoded/placeholder data in the tab.** Confirmed (Verdict 1).

### Visual / interaction defects
- **Multi-select is cosmetic (P1).** `selectedInitiativeIds` checkboxes
  (`InterviewHub.tsx:7246-7268`, select-all `6980-6990`) drive **only** a "Clear" button
  when rows are selected (`InterviewHub.tsx:2837-2855`). Unlike Insights/Sessions/Templates,
  which expose real bulk actions in the same command-row slot
  (e.g. `2358-2364` assignments), the initiatives selection enables **no** bulk
  send-to-review / bulk approve / bulk delete. A user selects 8 rows and the only thing
  that happens is a counter. Dead-end affordance — either wire bulk status transitions or
  remove the checkboxes.
- **Dead wizard state (P2).** `showInterviewInitiativeWizard` /
  `setShowInterviewInitiativeWizard` (`InterviewHub.tsx:648`) is declared and **never used**
  — the live wizard is `showInitiativeWizard` (`765`, rendered `8546`). Confusing dead state.
- **Status reason swallowed (P2).** See Verdict 2d — gate-readiness rejections show a
  generic toast.

---

## THE HARD QUESTION — TRACEABLE VIEW, OR HALF-BUILT MIRROR?

**It is a real, traceable view — but with an inflow leak that makes it look half-built.**

The *reading* side is principled: one physical table, canonical detail navigation, honest
empty states, the governed status machine, zero synthetic rows. The owner's headline
invariant ("real persisted only") is genuinely upheld. This is **not** a fake mirror.

But the *writing* side is **inconsistent across the two inflows**: the wizard tags
`source_type='interview_insight'` and the row shows up; the D5 finding handoff does not tag
it and the row is invisible here. So the tab will *appear* to "drift" from reality — a
consultant who used handoff will swear the tab is broken/empty, while the data is actually
sitting in the canonical module untagged. The fix is in the **handoff service**, not the
tab. The tab is doing the right thing with the data it's given.

Secondary drift risks (org-vs-project scope, the dead competing-schema router) are real but
dormant/cosmetic in the current single-project demo posture.

---

## ARCHITECTURE RECOMMENDATION — EMBED CANONICAL, OR SEPARATE VIEW?

**Recommendation: keep the separate slim view, but make it a thin filtered read of the
canonical source — do NOT embed the full canonical Initiatives table component, and do NOT
let it diverge further.**

Reasoning:
- A consultant in an interview workflow needs **triage** (title, status, priority, source
  back-link, date, send-to-review) — not the 30-column financial/portfolio grid the
  canonical `InitiativesHub` renders. Embedding the canonical table would drag in V8
  portfolio loading, financial columns, RAID/KPI panels, and project-scope assumptions that
  don't fit the tab. Separate view is **justified**.
- But "separate view" must mean **separate presentation over the same governed read**, not a
  separate data contract. Today the tab already routes detail/status through canonical
  endpoints — good. Close the remaining gaps so the *only* thing that's bespoke is the
  column projection:
  1. **Single source-tag contract.** Make `source_type='interview_insight'` (+ `source_id`)
     the *one* identity of an interview-driven initiative, written by **every** inflow.
  2. **Single create path.** Route the handoff through the same canonical create that the
     wizard uses (the controller / a service method that accepts `source_type`/`source_id`),
     not `InitiativeDefinitionService.createInitiative` which can't express provenance.
  3. **One read predicate**, parameterized by `projectId` so the tab and the module agree on
     scope.

In short: **shared backbone, bespoke skin.** The current design is already 70% of this; it
just needs the inflow and scope unified so the skin can't lie.

---

## WHAT WORKS (keep)

- ✅ "Real persisted only" invariant — fully upheld; honest empty/loading/error states.
- ✅ Wizard creates **canonical** rows with correct `source_type`/`source_id` provenance and
  anchored-source resolution.
- ✅ Detail navigation deep-links into the **canonical** Initiatives doc view, with a robust
  3-tier resolver on the receiving end.
- ✅ Status workflow (`DRAFT→PENDING_REVIEW→REVIEW`) is a valid slice of the canonical
  governed state machine — no parallel/forked workflow.
- ✅ Column-aware backend read absorbs historical schema drift instead of 500-ing.
- ✅ Single physical `initiatives` table with startup auto-repair of source columns.
- ✅ Source column back-links each initiative to its originating insight (value-add over the
  canonical grid).
- ✅ View-settings parity (hidden columns, resize, row description, persistence) with the
  other 5 tabs.

---

## RANKED REMEDIATION

### P0 — must fix (correctness / traceability of the headline feature)
1. **Finding→initiative handoff must tag `source_type='interview_insight'` + `source_id`.**
   `server/src/routes/v8/interview-insights.routes.ts:789-808` currently calls
   `initiativeService.createInitiative({...})` which (via
   `InitiativeDefinitionService.createInitiative`,
   `server/src/services/initiative/InitiativeDefinitionService.ts:96-147`) writes **no**
   source columns. Route this create through the canonical create that persists
   `source_type`/`source_id` (e.g. the controller's create or an extended service method),
   passing `source_type:'interview_insight'`, `source_id:<findingId or insightId>`. **Size: M.**
   Without this, D5 handoffs are permanently invisible in the tab and the inflow is silently
   inconsistent with the wizard.

### P1 — should fix (coherence / drift prevention / dead UX)
2. **Project-scope the tab read.** Pass `projectId` to
   `/initiatives?source=interview_insight` and/or add a `currentProjectId` predicate to
   `filteredInterviewInitiatives` (`InterviewHub.tsx:1582-1609`). Today it leaks all-org
   interview initiatives into every project context, disagreeing with the project-scoped
   canonical module. **Size: S.**
3. **Delete the dead competing-schema router**
   `server/src/routes/initiatives.routes.ts` (its own `CREATE TABLE` with
   `name NOT NULL`/`created_by NOT NULL`/`status DEFAULT 'DRAFT'`, lines 47-71) and migrate
   its test (`server/src/routes/__tests__/initiatives-crud.test.ts:39`) to the pmo
   controller. Removes a latent "two schemas" landmine. **Size: S–M.**
4. **Wire real bulk actions or remove the checkboxes.** `selectedInitiativeIds`
   (`InterviewHub.tsx:7246-7268, 2837-2855`) currently only offers "Clear". Add bulk
   send-to-review / approve (reusing `handleUpdateInterviewInitiativeStatus`) or drop the
   selection UI. **Size: S** (remove) / **M** (wire bulk transitions with per-item
   tolerance like `handleBulkRemind`).

### P2 — polish
5. **Surface gate-readiness rejection reasons.** `handleUpdateInterviewInitiativeStatus`
   (`InterviewHub.tsx:2267-2270`) swallows the structured backend error
   (`InitiativeController.ts:1118-1216`) behind a generic toast. Show the reason. **Size: S.**
6. **Remove dead wizard state** `showInterviewInitiativeWizard` /
   `setShowInterviewInitiativeWizard` (`InterviewHub.tsx:648`). **Size: XS.**
7. **Document the intentional slim column set** (a short comment near
   `InterviewHub.tsx:6959`) so the divergence from the canonical 30-column table reads as
   deliberate, not unfinished. **Size: XS.**

---

## APPENDIX — KEY FILE:LINE INDEX

| Concern | Location |
|---|---|
| "Real persisted only" invariant comment | `src/components/Interview/InterviewHub.tsx:425-429` |
| Tab data fetch (org-scoped, source-filtered) | `InterviewHub.tsx:1035, 1123` |
| State writers (only 3, all real) | `InterviewHub.tsx:1068, 1072, 8569` |
| Client filter (no project predicate) | `InterviewHub.tsx:1582-1609` |
| Table columns (7) | `InterviewHub.tsx:6959-6967` |
| Row → canonical detail navigation | `InterviewHub.tsx:7240-7243, 7371-7373` |
| Status workflow handler | `InterviewHub.tsx:2244-2273` |
| Multi-select (cosmetic) | `InterviewHub.tsx:7246-7268, 2837-2855` |
| Dead wizard state | `InterviewHub.tsx:648` |
| Wizard launch (correct source tag) | `InterviewHub.tsx:8545-8562` |
| Wizard create → canonical POST | `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx:464-496`; `src/services/initiativeWriteTruth.ts:117-118` |
| Canonical read (column-aware, source filter) | `server/src/controllers/InitiativeController.ts:294-468, 367-411` |
| Canonical create (writes source_type) | `InitiativeController.ts:538-657` |
| **Handoff create (NO source_type) — P0** | `server/src/routes/v8/interview-insights.routes.ts:789-808` |
| Canonical service create (no source cols) | `server/src/services/initiative/InitiativeDefinitionService.ts:96-147`, types `38-47` |
| Status machine transitions | `server/src/constants/initiativeStatuses.ts:301-336` |
| Route mount (pmo router @ /api/initiatives) | `server/src/Gateway.ts:193, 450, 803` |
| **Dead competing-schema router — P1** | `server/src/routes/initiatives.routes.ts:47-71` (unmounted; test-only import) |
| Schema auto-repair (source cols) | `server/src/database/DatabaseInitializer.ts:556-561` |
| Canonical hub deep-link resolver | `src/components/Initiatives/InitiativesHub.tsx:730-746` |
| Canonical hub project-scoped load | `InitiativesHub.tsx:368-392` |
| D5 commit | `f45fd2d8db` |
