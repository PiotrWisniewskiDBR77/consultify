# Consultify Document Studio v1 — Gap Matrix

> Status: Canonical v1
> Owner: Product + Engineering
> Authority: Highest for the explicit current-vs-target gap analysis between the V8.1 substrate plus the existing report/presentation runtimes and the target Document Studio v1.
> Position: Companion to `CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`. Read the SSOT first.

---

## 1. Scope of this gap matrix

This document maps each Document Studio v1 capability to existing repo anchors and labels each gap as one of:

- `Reuse` — existing capability is sufficient; Document Studio plugs in as a consumer.
- `Extend` — existing capability is partially sufficient; Document Studio extends it without forking.
- `New` — no existing capability; Document Studio introduces a new code surface.

The matrix is the basis for `CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`.

Repo path convention: paths starting with `server/`, `src/`, `apps/` refer to `DRD/consultify/`.

---

## 2. Substrate and identity

| Capability | Existing anchor | Status | Notes |
| --- | --- | --- | --- |
| Artifact identity, lifecycle, version lineage | `server/src/services/v8/artifactRegistryService.ts`, `server/src/types/artifactRegistry.ts` | Reuse | Document Studio MUST persist via this service only. |
| `ArtifactRun` runtime states (`requested → planning → generating → validating → draft → in_review → approved → exported → archived`) | `artifactRegistryService` (V8.1 spec §7) | Reuse | No new lifecycle. |
| `ArtifactSourceRef` source lineage | `artifactRegistryService` + V8.1 §13 | Reuse | Document Studio populates source refs from the source pack. |
| Visibility scopes (`private`, `project`, `organization`, `review_shared`, `demo`) | V8.1 substrate | Reuse | Document Studio sets scope from intake `confidentiality`. |
| Artifact routes (CRUD, lifecycle, conversions) | `server/src/routes/artifacts.routes.ts`, `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/artifact-conversions.routes.ts` | Reuse | Document Studio routes call into the substrate where appropriate. |

---

## 3. Reports & Presentations runtime reuse

| Capability | Existing anchor | Status | Notes |
| --- | --- | --- | --- |
| Report Builder service (sections, intent, generation, versions, comments) | `server/src/services/reportBuilderService.ts` | Reuse for R1–R4 | Document Studio MUST NOT modify report-builder behavior; it can call its export helpers. |
| Report Builder routes (CRUD, generate, share, export, quality gates) | `server/src/routes/report-builder.routes.ts` | Reuse for R1–R4 | No edits in MVP-1. |
| DOCX export pipeline | `server/src/services/reportBuilderService.ts` (DOCX handlers) and `REPORT_BUILDER_EXPORTS_STANDARD.md` | Reuse (read-only) | MVP-1 calls existing helpers; MVP-4 hardens DOCX. |
| PDF export pipeline | Report Builder PDF handlers | Reuse | Same as DOCX. |
| PPTX export pipeline | `server/src/services/report/pptx/PptxPipelineService.ts` | Reuse | Out of scope for Document Studio. |
| Quality gates baseline | `server/src/services/reportQualityGatesService.ts` | Extend | Document Studio adds Document QA Engine layered above this; MVP-1 only uses the Completeness/Source subset. |
| Reports & Presentations hub | `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`, `useRapData.ts`, `types.ts` | Extend | MVP-1 adds a single Menu-3 button "New document" without a new hub or tab. |
| Public share pipeline | Existing report-builder share routes | Reuse | Document Studio uses V8.1 publish review for share semantics. |

---

## 4. AI runtime reuse

| Capability | Existing anchor | Status | Notes |
| --- | --- | --- | --- |
| AI artifact runtime architecture | `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md` | Reuse | Document Studio inherits draft/preview/version/publish lifecycle. |
| Proposal-only mode | `docs/product/AI_PROPOSAL_ONLY_APPLICATION_MODE_V8.md` | Reuse | All AI document edits are proposals until accepted. |
| Source truth and provenance | `server/src/services/v8/sourceTruthService.ts`, `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` | Reuse | Document Studio attaches provenance via V8.1 source refs. |
| Tool governance | `server/src/services/v8/toolGovernanceService.ts` | Reuse | Document Studio does not introduce a new tool surface in MVP-1. |
| LLM service abstraction | Existing AI service used by report-builder and presentation generator | Reuse | Document Studio piggybacks on existing model selection. |
| AI human-in-the-loop governance | `docs/product/AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` | Reuse | Document edits at methodology and source scope follow `proposal → approval → execution → audit`. |
| AI ops and release | `docs/product/AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` | Reuse | Document Studio MVP-1 ships behind a feature flag. |

---

## 5. Document Studio-specific gaps

### 5.1 Document Schema engine

| Capability | Status | Notes |
| --- | --- | --- |
| Internal `DocumentSchema` type | New | Defined in `server/src/services/documentStudio/documentStudioTypes.ts`. |
| Section/block CRUD primitives | New | MVP-1 ships immutable schema generated by the orchestrator; section/block edits are deferred to MVP-2. |
| Diff and patch primitives | New | MVP-2. |

### 5.2 Document Narrative Planner

| Capability | Status | Notes |
| --- | --- | --- |
| Outline planner from Mode-1 intake | New | `server/src/services/documentStudio/documentNarrativePlanner.ts`. |
| Outline planner from template (Mode 3) | New | MVP-3. |
| Argumentation logic per section | New | MVP-2 onward. |

### 5.3 Document Content Generator

| Capability | Status | Notes |
| --- | --- | --- |
| Section-by-section generation into the schema | New | `server/src/services/documentStudio/documentContentGenerator.ts`. |
| `is_assumption` marking for unsourced claims | New | MVP-1 mandatory. |
| Source ref attachment per block | New | MVP-1 minimum: per section. Per-block in MVP-2. |

### 5.4 Document Template Architect (Mode 2)

| Capability | Status | Notes |
| --- | --- | --- |
| AI-planned `section_blueprint` | New | MVP-2. |
| AI-planned `formatting_schema` | New | MVP-2. |
| Governance rules | New | MVP-2. |

### 5.5 Template Registry

| Capability | Status | Notes |
| --- | --- | --- |
| `DocumentTemplate` storage | New | MVP-2. |
| `draft / approved / deprecated` lifecycle | New | MVP-2. |
| Permissions and approval rules | New | MVP-2; reuses RBAC primitives in V8 substrate. |
| `system` and `organization` scope | New | MVP-2. |

### 5.6 Formatting & Style Engine

| Capability | Status | Notes |
| --- | --- | --- |
| Default consulting `FormattingSchema` | New | MVP-1: hard-coded default. MVP-2: published constant per formatting class. |
| DOCX with real Word styles | Extend | MVP-4 hardens beyond report-builder baseline. |
| PDF with stable layout | Extend | MVP-4. |
| Internal artifact preview | New | `src/components/DocumentStudio/DocumentStudioWorkspace.tsx`. |

### 5.7 AI Document Editor

| Capability | Status | Notes |
| --- | --- | --- |
| Edit-scope detector (5 scopes) | New | MVP-2 (local), MVP-3 (section, global), MVP-4 (methodology, source). |
| Diff viewer | New | MVP-2. |
| Accept/reject UI | Extend | Reuses V8.1 publish review patterns. |

### 5.8 Document QA Engine

| Capability | Status | Notes |
| --- | --- | --- |
| Completeness QA | Extend | MVP-1 reuses report quality gate. |
| Source QA | New | MVP-1 minimum: confirms `is_assumption` marking. |
| Methodology QA | New | MVP-3. |
| Executive QA | New | MVP-3. |
| Language QA | New | MVP-2. |
| Format QA | New | MVP-4. |
| Brand QA | New | MVP-2. |
| Risk QA | New | MVP-3. |
| Data QA | New | MVP-3. |
| Export QA | Extend | Reuses report-builder export gate; MVP-4 extends. |

### 5.9 Surface integration

| Capability | Status | Notes |
| --- | --- | --- |
| Chat-first creation entry | New | MVP-1: backend route consumed from chat. UI integration uses existing chat application-agent runtime. |
| Menu-3 button in R&P hub | New | MVP-1 single button. |
| Outputs Library entry | Reuse | Document Studio artifacts surface automatically because they are V8.1 artifacts. |
| `My Work` view | Reuse | Same. |
| Artifact workspace surface | Extend | MVP-1 renders Document preview inside the existing artifact workspace. |

---

## 6. Risk-weighted summary

| Risk class | Item | Mitigation |
| --- | --- | --- |
| Doctrine | Parallel registry created by accident | Hard rule: only `artifactRegistryService.materializeArtifactRun` persists. PR review checklist. |
| UI | Menu-3 placement violates governance | Strict adherence to `21-ai-actions-menu3-placement.mdc`; single right-side AI action. |
| DOCX | Quality regression vs report-builder baseline | MVP-1 reuses report-builder export helpers verbatim; no new DOCX styling logic. |
| Source | Unsourced claim leaks unmarked | Source QA in MVP-1: every analytical block carries `is_assumption` if no source ref attached. |
| Tenancy | Cross-tenant artifact leakage | All read/write goes through V8 substrate which enforces visibility scope; no new auth surface. |
| Scope | Scope creep into Modes 2/3 inside MVP-1 | Acceptance criteria in implementation plan and DoD enforce Mode-1 boundary. |

---

## 7. Items explicitly deferred beyond MVP-1

- Mode 2 Template Architect.
- Mode 3 Generate-from-template.
- Document Editor with five edit scopes (only basic local rewrite reachable through artifact run regenerate).
- Full QA Engine (only Completeness and Source in MVP-1).
- Brand Voice profile productization.
- Real Word styles beyond report-builder baseline.
- Cover page and TOC styling beyond what report-builder provides.
- Collaborative real-time editing.
- Track-changes-like view.
- Comments per block.
- Source package and appendix package as separate exports.
- Notion / Drive integrations beyond what report-builder already provides.
