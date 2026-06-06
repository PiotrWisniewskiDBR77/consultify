# DEEP RE-VERIFICATION — Module 09: Outputs / Deliverables

**Date:** 2026-06-03 · **Method:** end-to-end (UI → route → DB), no builds · **Repo:** consultify @ `feat/wave1-foundations`

Deeper than `COMPLETION_09_outputs.md`. Confirms the aggregation backbone (central artifact registry), confirms the export gate is real, and validates/extends the G1–G9 gap list with file:line.

---

## Per-feature verification table

| Feature | UI | Route | DB / service | Verdict | Evidence |
|---|---|---|---|---|---|
| Aggregate library (All/Mine/Review) | `OutputsAggregateTabContent.tsx` | `GET /api/artifacts` (`artifacts.routes.ts:299`) | `artifactRegistryService.listArtifactsForUser` → `v8_output_artifacts` | **WORKS** | Real registry read, filters by outputType/family/scope/view (`:307–337`); `onlyMine`/`review` mapped. |
| Reports tab (format-lane) | `ReportsTabContent.tsx` | report-builder rows | reportBuilderService | **WORKS** | Legacy format tab; bypasses aggregate (G2). |
| Presentations tab (format-lane) | `PresentationsTabContent.tsx` | decks | presentationGeneratorService | **WORKS** | Legacy format tab; bypasses aggregate (G2). |
| Sheets tab | `SheetsTabContent.tsx` | `?outputType=sheet` | workbook/table-platform registry writes | **WORKS** | Error path → aggregate; empty static card has no retry CTA (G6). |
| Templates tab | `TemplatesTabContent.tsx` | `?artifactFamily=template` | registry | **PARTIAL** | Empty-state lacks CTA (G8). |
| Export PDF | `useRapData.ts:1422` `exportReportPdf` | `GET /report-builder/:id/export/pdf` | pdfkit, real binary | **WORKS** | Client gate `isExportApproved` (`:1424`) + server hard gate. |
| Export PPTX | `useRapData.ts:1457` `exportDeckPptx` | `GET /presentations/decks/:id/download` | pptxgenjs, real binary | **WORKS** | Client gate (`:1459`) + server gate. |
| Server export hard gate | — | `presentations.routes.ts:1422,1442,1565,1584` | `enforceNoLegalHold` (`:593`), `ensureConfidentialityPolicy` (`:208`) | **WORKS** | Legal-hold + confidentiality enforced before binary emit. |
| Approval / lifecycle | — | `presentations.routes.ts:961–1031` | states draft/approved/deprecated + lineage + audit | **WORKS** | Real lifecycle transitions. |
| Client approval guard | `useRapData.ts:165` `isExportApproved` | — | reads `governance.publishState` | **PARTIAL** | Returns `true` when `publishState` absent (`:167`) → legacy-row hole; server is the only hard stop (G4). |
| Teresa → Outputs deeplink | `V8ArtifactRunControl.tsx:819` "View in Outputs" | nav `/presentations?tab=all&artifactId=<id>` | `tab=all`→`outputs_all` (`outputsLibraryTabQuery.ts:22`) | **WORKS** | Fires on run completion (report/presentation). |
| Teresa from-chat run | `ArtifactRunsApi.createFromChat` (`artifactRuns.ts:116`) | `POST /api/artifact-runs/from-chat` (`artifact-runs.routes.ts:24`, `requireAudit`) | `artifactRegistryService.createArtifactRunFromChat` | **WORKS** | Real audited route + service. |
| Empty-state "Generate with Teresa" | `OutputsAggregateTabContent.tsx:688` | `openTeresaForOutput` (`:191`) | — | **PARTIAL** | Only opens chat with context (`:192–200`); does **not** call `createFromChat` (G9). |
| Document Studio → Outputs | `DocumentStudioView.tsx` | — | — | **BROKEN/MISSING** | No publish / start-review / register-artifact action (grep: 0 hits). G5 — central vision gap. |
| Demo data | `useRapData.ts:192–389` | — | — | **MOCK (dead)** | `DEMO_REPORTS/PRESENTATIONS/TEMPLATES` declared, **0 usages** — pure dead code (G1). |

---

## Lens 1 — Functionalities verified

The hub is backed by a **real central artifact registry** (`v8_output_artifacts` + `v8_artifact_origin_links`, written via `registerArtifactOrigin` `artifactRegistryService.ts:1102–1196`). Read model `GET /api/artifacts` (`artifacts.routes.ts:299`) is genuinely filtered and role/org-scoped (`getAuthContext`, `:302`). Export is real (pdfkit/pptxgenjs binaries) and double-gated (client `isExportApproved` + server `enforceNoLegalHold`/`ensureConfidentialityPolicy`). Lifecycle (draft→approved→deprecated) with lineage + audit is real (`presentations.routes.ts:961–1031`). No demo data is injected at runtime (DEMO arrays unreferenced).

## Lens 2 — Cross-module flow (09 aggregates outputs from where — edge confirmation)

The registry is **fed by all producing modules** (writers grep-confirmed):
- **10 Document Studio / Reports** → `report-builder.routes.ts`, `reportBuilderService.ts` ✅
- **11 Presentations** → `presentations.routes.ts`, `presentationGeneratorService.ts` ✅
- **12 Tabele / Sheets** → `workbook.routes.ts`, `table-platform.routes.ts`, `exceleCanon.ts`, `registerGovernedTableSheetArtifact` (`artifactRegistryService.ts:683`) ✅
- **Teresa chat** → `artifact-runs.routes.ts` (from-chat) ✅
- **Execution** → `v8/execution.routes.ts` ✅ · **Finance** → `financeIntegrationHooks.ts` ✅
- **Assessment → Report Builder**, **Finance → Reports**, **Canvas → V8ArtifactRunControl** all wired.

**Confirmed broken edge:** **Document Studio authoring → Outputs** has NO push path (`DocumentStudioView.tsx` has no start-review/publish). A directly-authored document only lands in the library if it flows through the Teresa run pipeline. This is the one genuinely missing aggregation edge (G5).

**Stale (cosmetic) edges:** `InitiativeSourceLink.tsx:85` and `CommandPalette.tsx:164` deep-link `tab=documents` → resolves to format tab (`outputsLibraryTabQuery.ts:27`) not aggregate (G3).

## Lens 3 — Teresa wiring (real vs dead apply-handlers)

**Real:** `V8ArtifactRunControl.tsx` runs the plan→accept→materialize loop, then on completion navigates to the Outputs deeplink (`:819`). `POST /api/artifact-runs/from-chat` is a live, audited route (`artifact-runs.routes.ts:24–38`) → real `createArtifactRunFromChat` service. Client wrapper `ArtifactRunsApi.createFromChat` exists (`artifactRuns.ts:116`).

**Dead/missing:** The Outputs empty-state CTA `openTeresaForOutput` (`OutputsAggregateTabContent.tsx:191`) only opens chat with context — it does **not** invoke `createFromChat`, so the one-click "Generate report from empty library" never auto-triggers a run (G9). No toolbar button in the chat panel calls `createFromChat` directly either. **Apply-handler verdict: pipeline real and navigable; auto-trigger entry point dead.**

## Lens 4 — Contextual memory (user/org, ephemeral/long-term)

- **Ephemeral chat context:** every tab uses `useOpenChatWithContext` (`OutputsAggregateTabContent.tsx:153`, `ReportsAndPresentationsHub.tsx:68`, `ReportsTabContent.tsx:66`, `PresentationsTabContent.tsx:66`) to hand entity context into Teresa.
- **Snapshot lineage:** artifacts carry `contextSnapshotId` (`useRapData.ts:762`, `types.ts:118`, registry `artifactRegistryService.ts:363`) — durable per-artifact provenance back to originating conversation.
- **Long-term context push is a STUB:** `notifyContextOfNewArtifact` (`artifactRegistryService.ts:1197–1209`) only **logs** — it does not write the new artifact into any long-term/org context store. The real long-term read path is `getRecentArtifactRefsForOrg` (`:1216`). So org-level "memory of recent outputs" is **read-only / pull**, not push-on-create.

---

## P0 / P1 / P2 (re-verified)

### P0 — Pre-GA
| ID | Item | File:line |
|---|---|---|
| P0-1 | Delete dead `DEMO_*` arrays | `useRapData.ts:192–389` |
| P0-2 | Drop `outputs_documents` + `presentations` format tabs; keep all/mine/review/sheets/templates | `ReportsAndPresentationsHub.tsx:161,166` |
| P0-3 | Repoint `tab=documents` deep links → `tab=all` | `InitiativeSourceLink.tsx:85`, `CommandPalette.tsx:164` |
| P0-4 | Add retry CTA to Sheets empty static card | `SheetsTabContent.tsx:62–89` |

### P1 — Wave 1
| ID | Item | File:line |
|---|---|---|
| P1-1 | Wire "Generate with Teresa" → `ArtifactRunsApi.createFromChat` + open run control inline | `OutputsAggregateTabContent.tsx:191`, `artifactRuns.ts:116` |
| P1-2 | **Document Studio → Outputs "Publish" action** (register-as-artifact / start-review) — closes the one missing aggregation edge | `DocumentStudioView.tsx`, `artifacts.routes.ts` |
| P1-3 | Harden client approval gate for legacy rows lacking `publishState` | `useRapData.ts:165–168` |
| P1-4 | Templates empty-state CTA | `TemplatesTabContent.tsx` |
| P1-5 | E2E round-trip: from-chat → materialize → "View in Outputs" → hub shows artifact | `tests/e2e/smoke/` |

### P2 — Post-GA
Socket.IO live-refresh on `artifact:created`; Tabele auto-register sheet-as-artifact on export; make `notifyContextOfNewArtifact` actually push to long-term context (currently log-only stub, `artifactRegistryService.ts:1197`); governance-endpoint integration tests; "Teresa-generated" badge.

---

## Net delta vs COMPLETION_09

1. **Aggregation backbone confirmed real and broad** — central registry fed by modules 10/11/12 + Teresa + execution + finance.
2. **Export double-gate confirmed** (client `isExportApproved` + server legal-hold/confidentiality).
3. **Two genuine vision gaps stand:** (a) Document Studio has no publish-to-Outputs edge (G5/P1-2); (b) empty-state Teresa CTA doesn't auto-trigger a run (G9/P1-1).
4. **New finding:** `notifyContextOfNewArtifact` is a log-only stub — long-term context is read-only (pull via `getRecentArtifactRefsForOrg`), no push-on-create.
5. Cosmetic/dead-code items (DEMO block, format tabs, stale deep links) all confirmed present.
