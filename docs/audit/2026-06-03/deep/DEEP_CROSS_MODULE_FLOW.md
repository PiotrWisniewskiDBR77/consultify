# DEEP AUDIT — Cross-Module Workflow / Data-Flow

**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Method:** code + docs read, no builds
**Question:** How does work flow between modules end-to-end, and where does the chain break?

---

## 0. Verdict (one paragraph)

Consultify is **not a set of siloed stores** — there is a genuine shared object spine:
`organization` (tenant) → `organization_context_items` (claim store) → `/api/initiatives` →
KPI↔initiative mappings → `/api/artifacts` (unified output model with `outputType`). Three real
backbones carry work: (a) the **org-context ingestion engine** that pulls interview answers, evidence
and notes into a claim store Teresa reads on every reply; (b) the **initiative ID** that Results,
Finance and KPIs reference; (c) the **`/api/artifacts` registry** (`artifactId` + `outputType:
report|presentation|sheet|initiative|idea`) that Chat, Tables, Documents and the Outputs hub all share.
The chain is therefore **data-coherent but UX-discontinuous**: the hard part (shared IDs/persistence) is
mostly built; the breaks are at the **navigation seams** (Execution dead-ends, Finance→Initiative 404,
Results→Outputs missing) and at **one true data hole** — Document Studio never registers its document
into the artifact registry, so authored documents silently fail to appear in the Outputs library.

---

## 1. Shared Object Model (the spine) — answer to Q2

| Spine | Mechanism | Evidence |
|---|---|---|
| **Tenant** | `organization` id from org-scoped JWT; persisted `consultify_current_org_id`; switch = token exchange + full state reset | `src/contexts/OrgContext.tsx:52,79,128,146` |
| **Org context claim store** | `organization_context_items` / `_claims` with `source_type` (`interview_answer`, `interview_evidence`, manual). `buildResolvedContext(orgId)` → 9-layer context | `server/src/services/aiContextBuilder.ts:554,615,625,635`; `OrganizationContextService.js` |
| **Initiative** | canonical `/api/initiatives` (REST), referenced by `initiativeId` everywhere downstream | `src/services/initiativeService.ts:7,17` |
| **KPI↔Initiative** | KPI mappings carry `initiative_id`; Results dashboard scoped by `initiativeId` | `src/components/Results/kpiDomain.ts:118-125`; `KPICreateModal.tsx:113`; `ResultsHub.tsx:330` |
| **Unified artifact** | `/api/artifacts?outputType=report|presentation`; `artifactId`; governance/review/export | `src/components/ReportsAndPresentations/useRapData.ts:5-12,471`; `TabeleView.tsx:116,144`; `V8ArtifactRunControl.tsx:57-63` |

**Conclusion:** A real common spine exists. The weakest seam in the spine is the **artifact registry write coverage** (see §4/G).

---

## 2. Edge-by-edge Flow Map (A→B: artifact · path · status)

| A→B | Artifact / payload | Path (file:line) | Status |
|---|---|---|---|
| 16 Org → all | resolved org context (profile/strategy/ops/signals) into Teresa | `aiContextBuilder.ts:504-724` | **WORKS** |
| 03 Interview → 16 Org | interview answers/evidence ingested as `source_type='interview_answer'` claims | `InterviewController.ts:779,791,931` (IngestionPipeline → OrganizationContextService) | **WORKS** |
| 16 Org → 04 Tools | RAG scoped by `organizationId` / `organization_id` | `src/services/toolScopedRAG.ts:117,127,176` | **WORKS** |
| 03 Interview → 04 Tools | insight `export {target:'tools'}` | `InterviewHub.tsx:3711`; `InsightDetailView.tsx:268` | **WORKS** |
| 03 Interview → Assessment | insight `export {target:'assessment'}` | `InterviewHub.tsx:3728`; `InsightDetailView.tsx:283` | **WORKS** |
| 03 Interview → 05 Initiatives | `navigate('/initiatives?open=…&mode=doc')` on insight promotion | `InterviewHub.tsx:2261,7243` | **WORKS** |
| Assessment → 05 Initiatives | drawer + mgmt panel navigate `?open=` | `AssessmentInitiativesDrawer.tsx:56`; `InitiativesManagementPanel.tsx:913` | **WORKS** |
| Assessment(GapAnalysis) → 05 | POST `/api/initiatives/generate-from-assessments` — endpoint absent; component never imported | `GapAnalysisDashboard.tsx:59` | **BROKEN (orphan)** |
| 05 Initiatives → 07 Results | CTA `navigate(ROUTES.BENEFITS)`; KPIs carry `initiative_id` | `InitiativesHub.tsx:1530`; `kpiDomain.ts:118` | **WORKS** |
| 05 Initiatives → 06 Execution | no direct CTA; sidebar-only | `InitiativesHub.tsx` (no `/implementation` nav) | **MISSING** |
| 05 Initiatives → 08 Finance | `navigate('/economics?tab=models&initiativeId=…')` | `InitiativesHub.tsx:1327` | **WORKS** |
| 05 Initiatives → 09 Outputs | `InitiativeSourceLink → /presentations?tab=documents` | `InitiativeSourceLink.tsx:85` | **PARTIAL** (lands on legacy format tab) |
| 06 Execution → 07 Results | no forward CTA; zero `ROUTES.BENEFITS` refs in hub | `ExecutionHub.tsx` (whole file) | **BROKEN** |
| 07 Results → 06 Execution | back-link "Open in Execution" | `ResultsHub.tsx:747` | **WORKS** |
| 07 Results → 08 Finance | KPI/ROI inputs; ROI views reference initiativeId | `Results/ROIAnalysisView.tsx`, `ROITrackingView.tsx` | **PARTIAL** (data refs present, no explicit handoff CTA) |
| 07 Results → 09 Outputs | only `/reports/builder/:id`; no publish-to-Outputs CTA | `ResultsKpiReportsView.tsx:428,530,555` | **MISSING** |
| 08 Finance → 05 Initiatives | `href=/initiatives/${id}` — route undeclared → wildcard → `/chat` | `InitiativeLinkingPanel.tsx:269`; `AppRoutes.tsx:1663` | **BROKEN (404)** |
| 08 Finance → 09 Outputs | ExportButton/ExportToOutputDialog, but `relatedInitiativeIds` not passed at call site | `FinancialModelWorkspace.tsx:711` vs `ExportButton.tsx:22` | **DATA GAP** |
| 01 Chat → 09 Outputs | `V8ArtifactRunControl` builds artifact (`outputType` report/presentation/sheet) → `navigate('/presentations?…&artifactId=…')` | `V8ArtifactRunControl.tsx:57-63,819` | **WORKS** |
| 11 Tables → 09 Outputs | `/presentations?tab=sheets`; rides `/artifacts/{id}` but **no auto-artifact registration** | `TabeleView.tsx:116,144`; COMPLETION_09:76 | **PARTIAL** |
| 10 Documents → 09 Outputs | **no "Send to Outputs / start-review" action; document never registered in artifact registry** | COMPLETION_09:44,79; `DocumentStudioView.tsx` (absent) | **BROKEN (silent data drop)** |
| 09 Outputs → 10/11/12 | hub reads `/api/artifacts?outputType=…`; aggregate tab present | `useRapData.ts:5-12,471`; `OutputsAggregateTabContent.tsx` | **PARTIAL** (3 of 7 tabs bypass aggregate) |
| 13 Meeting → 02 Moja Praca | follow-up tasks/decisions | `MeetingHub.tsx` (navigate present, handoff thin) | **PARTIAL** |
| 06/10/12 → 13 Meeting | review packages | docs MODULE_HANDOFFS:39,41 | **NOT VERIFIED in code** |

---

## 3. The Golden Path (what a consultant should walk) + breaks

```
16 Onboard ✅ → 03 Interview ✅(ingests to org claim store) → [Teresa grounded ✅]
→ 04 Tools/Assessment ✅(RAG + insight export) → 05 Initiatives ✅(promote from insight)
→ 06 Execution  ⛔ DEAD-END (no link out to Results)
→ 07 Results ✅(KPI↔initiative) → 09 Outputs ⚠️ MISSING (no publish CTA from Results)
→ 08 Finance ✅(model from initiative) → 09 Outputs ⚠️ DATA GAP (loses initiative link); ⛔ Finance→Initiative 404
→ 09 Outputs aggregates Chat ✅ / Tables ⚠️ / Documents ⛔(never registered)
→ 13 Meeting ⚠️ (thin follow-up handoff)
```

**Breaks, ranked by journey impact:**
1. **Execution → Results** (P0): finish tasks, nowhere to go. `ExecutionHub.tsx`.
2. **Document Studio → Outputs** (P0): authored documents never enter the artifact registry — the single true *data* drop, not just a missing button. `DocumentStudioView.tsx`.
3. **Finance → Initiative 404** (P1): `InitiativeLinkingPanel.tsx:269` href to nonexistent `/initiatives/:id`.
4. **Finance export drops `relatedInitiativeIds`** (P1): `FinancialModelWorkspace.tsx:711` — output loses provenance.
5. **Results → Outputs missing** (P1): `ResultsKpiReportsView.tsx`.
6. **Initiatives → Execution missing CTA** (P2): `InitiativesHub.tsx`.
7. **Tables auto-registration / Outputs format-tab bypass** (P2): `TabeleView.tsx`, `ReportsAndPresentationsHub.tsx:160-169`.

---

## 4. The "Outputs hub" promise (Q4)

**PARTIAL.** `useRapData` truly aggregates from one unified `/api/artifacts` model
(`outputType=report|presentation`, view=mine|review) with governance/export gating — this is the right
design and Chat-produced artifacts land here. But three leaks:
- **G-Documents:** Document Studio never POSTs to artifact start-review → documents authored there are invisible to the hub (COMPLETION_09:44,79).
- **G-Tables:** Tables open into the hub by deep-link but aren't auto-registered as artifacts (COMPLETION_09:76).
- **G-Tabs:** 3 of 7 hub tabs (`outputs_documents`, `presentations`) bypass the governed aggregate and show format-only lanes (COMPLETION_09:38).

---

## 5. Siloing / duplication / silent drops (Q5)

- **Produced-but-not-consumed:** Document Studio documents (no registry write); Finance `relatedInitiativeIds` (dropped at export); GapAnalysisDashboard (orphan, dead endpoint).
- **Consumed-but-never-produced:** Finance→Initiative deep-link expects `/initiatives/:id` route that does not exist (wildcard → `/chat`).
- **Not a silo, but parallel paths:** Org context reaches Teresa via two paths (resolved context + raw rows) — `aiContextBuilder.ts:567-575` notes processed P10 findings vs raw answers; not a break but two readers of the same store.
- **Meeting** is the least-wired hub for outbound follow-up handoff (thin navigate; no verified task/decision write-back to 02/05).

---

## 6. Completion items (file:line)

**P0**
1. ExecutionHub: add `navigate(ROUTES.BENEFITS)` CTA — `src/components/Execution/ExecutionHub.tsx`.
2. Document Studio: add "Publish to Outputs" → POST `/api/artifacts` start-review so documents register — `src/views/DocumentStudioView.tsx` + `src/services/api.ts` (artifacts).

**P1**
3. Fix Finance→Initiative link: use `?open=${id}&mode=doc` (or add `/initiatives/:id`) — `src/components/Economics/InitiativeLinkingPanel.tsx:269`.
4. Pass `relatedInitiativeIds` to ExportButton — `src/components/Finance/FinancialModelWorkspace.tsx:711`.
5. Results→Outputs publish CTA — `src/components/Results/ResultsKpiReportsView.tsx:428`.
6. Wire "Generate with Teresa" empty-state to `ArtifactRunsApi.createFromChat()` — `OutputsAggregateTabContent.tsx:191`.

**P2**
7. Initiatives→Execution CTA — `src/components/Initiatives/InitiativesHub.tsx:1327` (sibling of Finance CTA).
8. Auto-register Tables as artifacts on save — `TabeleView.tsx`.
9. Collapse format-lane hub tabs into aggregate — `ReportsAndPresentationsHub.tsx:160-169`.
10. Delete or wire GapAnalysisDashboard — `src/components/assessment/GapAnalysisDashboard.tsx:59`.
11. Strengthen Meeting → 02/05 follow-up write-back — `src/components/Meeting/MeetingHub.tsx`.
