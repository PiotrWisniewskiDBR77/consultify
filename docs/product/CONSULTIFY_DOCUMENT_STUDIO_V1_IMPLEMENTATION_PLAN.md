# Consultify Document Studio v1 — Implementation Plan

> Status: Canonical v1
> Owner: Product + Engineering
> Authority: Highest for the wave-by-wave engineering plan that turns Document Studio doctrine into production code, layered on top of the V8.1 substrate and the existing Reports & Presentations runtime.
> Position: Companion to `CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md` and `CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_MATRIX.md`. Read SSOT and Gap Matrix first.

---

## 1. Why this document exists

The SSOT defines product truth. The Gap Matrix defines what is `Reuse / Extend / New`. This document defines:

- waves,
- per-wave acceptance criteria,
- per-wave validation method,
- file-level boundaries,
- cutover and rollback rules,
- non-goals per wave.

---

## 2. Engineering boundaries (apply to every wave)

- All durable state goes through `server/src/services/v8/artifactRegistryService.ts`. Document Studio MUST NOT introduce a parallel artifact registry, a parallel artifact run record, a parallel version table, or a parallel source-ref table.
- All AI behavior goes through the existing AI service abstraction used by the report-builder and presentation generator. Document Studio MUST NOT introduce a new model-routing surface.
- All authentication goes through the existing auth middleware. Document Studio MUST NOT introduce a new auth surface.
- All UI growth happens inside existing surfaces (chat-first plus the Reports & Presentations hub) under the Menu-3 placement contract.
- All releases follow `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`: feature flag, canary, rollback hook, deprecation if a wave is replaced.

---

## 3. Waves

| Wave | Scope | Risk |
| --- | --- | --- |
| MVP-1 | Mode 1 end-to-end through V8.1 substrate, DOCX/PDF via report-builder helpers, single Menu-3 button, chat-first entry consumption | Low |
| MVP-2 | Mode 2 (Template Architect), Template Registry, document-class formatting class constants, AI Editor local-scope rewrite, Brand QA, Language QA | Medium |
| MVP-3 | Mode 3, source-pack preflight enforcement, AI Editor section + global scope, Methodology QA, Executive QA, Risk QA, Data QA | Medium |
| MVP-4 | Advanced DOCX with real Word styles, stable TOC, headers/footers, page numbers, cover page, lettered/numbered appendices, captions, footnotes, citation styles; Format QA; Export QA hardened | High (DOCX is historically fragile) |
| MVP-5 | Enterprise governance: workflow approval, reusable content blocks, legal/compliance templates, brand governance, source provenance UI, deeper integrations, multi-user collaboration on the same schema | High |

---

## 4. MVP-1 — Mode 1 end-to-end

### 4.1 Goal

Users can submit a free-form document request, receive an AI-generated outline, accept it, receive a generated draft as a V8.1 artifact, render it in the artifact workspace, and export DOCX/PDF reusing the report-builder export pipeline.

### 4.2 Files to create

Backend:

- `server/src/services/documentStudio/documentStudioTypes.ts`
- `server/src/services/documentStudio/documentStudioService.ts`
- `server/src/services/documentStudio/documentNarrativePlanner.ts`
- `server/src/services/documentStudio/documentContentGenerator.ts`
- `server/src/services/documentStudio/documentSchemaRenderer.ts`
- `server/src/services/documentStudio/__tests__/documentStudioService.test.ts`
- `server/src/routes/document-studio.routes.ts`

Frontend:

- `src/components/DocumentStudio/types.ts`
- `src/components/DocumentStudio/api.ts`
- `src/components/DocumentStudio/DocumentStudioIntakePanel.tsx`
- `src/components/DocumentStudio/DocumentStudioWorkspace.tsx`
- `src/components/DocumentStudio/DocumentStudioExportButton.tsx`

Wiring:

- Append the route mount to the existing route registry (must be a small, clearly-scoped append).
- Append a single AI action button to the Menu-3 right-side slot of the existing Reports & Presentations hub.
- Append a single `/document-studio/:artifactId` route to the existing `AppRoutes`.

### 4.3 Files explicitly untouched

- `server/src/routes/documents.routes.ts` (organization-context concern; namespace already taken).
- `src/components/documents/*` (organization-context UI).
- `server/src/services/v8/artifactRegistryService.ts` (read-only consumer).
- `server/src/services/reportBuilderService.ts` (read-only reuse of export helpers).
- `server/src/services/reportQualityGatesService.ts` (read-only).
- `PRESENTATION_GENERATOR_V3` runtime files.
- All other modules (interview, idea, finance, manager, knowledge, connector, my-work, etc.).
- All `consultify-*` archive folders, `IRIS*`, `industrial-training-data-factory`.
- All `.husky`, `.github`, infrastructure, Dockerfile, deploy configs.
- All `.env*` files.

### 4.4 Acceptance criteria

- POST `/api/document-studio/intake` accepts intake payload, validates tenant, returns `{ artifactId, runId }`.
- POST `/api/document-studio/:artifactId/plan` invokes Narrative Planner, returns the proposed outline; persists outline on the V8.1 `ArtifactRun.planJson`.
- POST `/api/document-studio/:artifactId/generate` (after outline accept) invokes Content Generator, materializes a V8.1 `ArtifactVersion` with the `DocumentSchema` JSON.
- GET `/api/document-studio/:artifactId` returns the current schema for preview rendering.
- GET `/api/document-studio/:artifactId/export/:format` (`docx` or `pdf`) returns the rendered file using the report-builder export pipeline.
- All durable state lives on V8.1 records; no new tables.
- The artifact has `artifactType = "document"`, correct `organizationId`, correct visibility scope.
- Source pack populates `ArtifactSourceRef` records on the artifact.
- Unsourced analytical blocks are marked `is_assumption: true`.
- The unit test for the orchestrator happy path passes; the test for `is_assumption` marking on missing sources passes.

### 4.5 Validation method

- `npm run lint` in `server/`.
- `npm run typecheck` in `server/`.
- `npm test -- documentStudio` in `server/`.
- `npm run lint` in client.
- `npm run typecheck` in client.
- Manual smoke: intake → plan → generate → preview → export DOCX → open in Word, confirm headings present and document opens cleanly.
- `git status` shows only files inside the approved scope.
- Tenant guard verified by attempting cross-tenant read and confirming 403/404.

### 4.6 Non-goals (MVP-1)

- Mode 2 or Mode 3 in any form.
- Template Registry storage or UI.
- AI Document Editor with section/global/methodology/source scopes (only basic local rewrite reachable via existing artifact run regenerate is acceptable).
- Full Document QA Engine beyond Completeness and Source.
- Brand Voice profile productization.
- Cover page, TOC, headers/footers beyond what report-builder DOCX exporter already produces.
- A new sidebar module or hub.
- Any change to the V8.1 artifact registry.
- Any change to report-builder or presentation generator behavior.

### 4.7 Rollback

- Remove the single AI action button from the R&P hub.
- Unmount `/api/document-studio` from the route registry.
- Remove the `/document-studio/:artifactId` route from `AppRoutes`.
- Delete `server/src/services/documentStudio/` folder.
- Delete `src/components/DocumentStudio/` folder.
- Delete `server/src/routes/document-studio.routes.ts`.
- Any artifacts created during MVP-1 remain valid V8.1 artifacts and continue to function via canonical artifact endpoints.

---

## 5. MVP-2 — Template Architect, Template Registry, AI Editor (local), Brand QA, Language QA

### 5.1 Goal

Users can ask AI to plan a new `DocumentTemplate`, edit and approve it. Approved templates enter the Template Registry and become available to Mode 3.

### 5.2 Acceptance criteria (high-level)

- `DocumentTemplate` storage exists, scoped `system | organization`, with `draft / approved / deprecated` lifecycle and explicit successor pointer.
- AI Template Architect produces `section_blueprint` and `formatting_schema`.
- Brand QA scores tone and banned phrases against an organization Brand Voice profile.
- Language QA scores register, density and language consistency.
- AI Editor accepts local-scope rewrite proposals with diffs.

### 5.3 Non-goals

- Methodology, Executive, Risk and Data QA categories (deferred to MVP-3).
- Brand Voice scoring (deferred to MVP-3); MVP-2 scope ships the registry + governance + Mode 3 wiring; Brand/Language QA are tracked separately.

### 5.4 MVP-2 status — delivered slice (Document Template Architect + Mode 3)

The first MVP-2 slice has shipped end-to-end:

- `DocumentTemplate` types in `server/src/services/documentStudio/documentStudioTypes.ts` with `draft / approved / deprecated` lifecycle, `category`, `documentType`, `purpose`, `audience`, `requiredInputs`, `sectionBlueprint`, `formattingSchema`, `exportRules`, `version` and audit fields.
- Tenant-scoped registry + governance flow in `server/src/services/documentStudio/documentTemplateService.ts`: `draftTemplate`, `getTemplate`, `listTemplates`, `approveTemplate`, `deprecateTemplate`, `listTemplateAuditEntries`, `isTemplateUsableForGeneration`. Cross-tenant access is denied by default.
- Routes: `GET /api/document-studio/templates`, `POST /api/document-studio/templates/plan`, `GET /api/document-studio/templates/:templateId`, `POST /api/document-studio/templates/:templateId/approve`, `POST /api/document-studio/templates/:templateId/deprecate`, `GET /api/document-studio/templates/:templateId/audit`. Registered before `/:artifactId` so the matchers don't collide.
- Mode 3 wiring: `materializeDocumentArtifact` accepts `templateId`. When provided and approved, the outline + `FormattingSchema` + per-document metadata are hydrated from the template, the wave5 metadata records `documentStudioMode: 'mode_3'`, `documentStudioTemplateId` and `documentStudioTemplateVersion`. Cross-tenant or non-approved templates are rejected with `template_not_usable`.
- Frontend: a `DocumentStudioTemplateArchitectView` for drafting, reviewing and approving templates, plus a Mode 3 picker inside `DocumentStudioIntakeForm`. The studio header now exposes two tabs: `Generate` (Mode 1 + Mode 3) and `Plan template` (Mode 2).
- Tests: `documentTemplateService.test.ts` (7) and `documentStudioMode3.test.ts` (4); the full Document Studio suite is at 31 passing tests.

Storage caveat (MVP-2 boundary): the registry uses an in-process tenant-scoped `Map`, mirroring the editor proposal store from MVP-1. This is acceptable for the slice (server-only, audit-recorded, deny-by-default tenant isolation) but is replaced by a wave5-backed `template`-typed artifact in MVP-3 hardening.

---

## 6. MVP-3 — Mode 3, source-pack preflight, AI Editor section/global, Methodology / Executive / Risk / Data QA

### 6.1 Goal

Users can pick an `approved` template and generate a document from it. The system enforces required-input preflight, applies the template formatting schema, runs methodology and executive QA, and supports section + global edits.

### 6.2 Acceptance criteria (high-level)

- `missing_required_source` failure surfaces in `ArtifactRunFailurePackage` when the source pack is incomplete.
- AI Editor handles section and global scope edits with diffs.
- QA Engine adds Methodology, Executive, Risk and Data categories.

### 6.3 MVP-3 status — delivered slice (governance + scope expansion + bounded AI architect)

The first MVP-3 slice has shipped end-to-end (governance and editor reach; QA categories deferred to a follow-up slice):

- **Source-pack preflight**: `preflightRequiredSources` and `MissingRequiredSourceError` in `documentStudioService.ts`. `materializeDocumentArtifact` rejects Mode 3 generation when the active template's `requiredInputs` are not satisfied by the source pack. The matcher is token-aware and case-insensitive across `sourceType`, `sourceId`, `sourceTitle` so consultants can express requirements in plain language. `/api/document-studio/generate` returns `400 missing_required_source` with the missing list; the frontend `MissingRequiredSourceError` decodes the structured payload and surfaces a remediation message in `DocumentStudioView`.
- **AI Editor section + global scopes**: `DocumentEditorScope` is now `'local' | 'section' | 'global'`. New service exports `createSectionEditProposal`, `createGlobalEditProposal`, generic `approveEditProposal` / `rejectEditProposal` (legacy `approveLocalEditProposal` / `rejectLocalEditProposal` retained as aliases). Approval applies the edit deterministically to one block, every block of one section, or every block of every section, with full audit traces (`affectedSectionIds` recorded). New routes `POST /api/document-studio/:artifactId/editor/proposals/section` and `POST /api/document-studio/:artifactId/editor/proposals/global`. Frontend `DocumentStudioEditorPanel` exposes a scope selector (Local block / Section / Whole document) with the right target picker per scope.
- **AI Document Template Architect refinement**: `documentTemplateRefiner.ts` mirrors the safety contract of the narrative refiner: the LLM may rewrite section purposes and propose a refined template name; new / removed / renamed / reordered sections trigger deterministic fallback. `documentTemplateService.draftTemplateAsync({ useLlm })` performs the refinement and persists a `template_updated` audit entry only when refinement actually changed anything. `/api/document-studio/templates/plan` accepts `useLlm` and returns `{ template, llmRefined }`. The frontend Template Architect view exposes a "Refine with AI" checkbox and a status hint after each draft.
- **Tests**: 18 new tests across `documentStudioPreflight.test.ts` (6), `documentStudioEditorScopes.test.ts` (5), and `documentTemplateRefiner.test.ts` (7). Full Document Studio backend suite at 49 passing tests across 9 files.

### 6.3.1 MVP-3 hardening slice — bounded AI editor + preflight UX

A second MVP-3 slice has shipped, focused on AI Editor parity with the Template Architect's safety contract and on remediation UX for Mode 3:

- **Bounded AI editor refinement**: `documentEditorRefiner.ts` adds an opt-in LLM rewrite step for the AI Editor. Mirrors the narrative / template refiner contract: rewrites the `after` text per block in the same language as the input; rejects empty / oversized / runaway-growth rewrites (>4× of a non-trivial input or >4000 characters absolute); collapses every failure mode (`FEATURE_UNAVAILABLE`, malformed JSON, missing fields) to `null` so the caller can fall back to the deterministic instruction marker.
- **`useLlm` wired through the proposal creators**: `createLocalEditProposal`, `createSectionEditProposal`, `createGlobalEditProposal` accept `useLlm: boolean`. For `local`, the LLM rewrite replaces `proposal.diff.after` directly. For `section` / `global`, the refiner runs per block and stores the per-block rewrites in the new `DocumentEditorProposal.blockRewrites` map, with `llmRefined: true` flag for UX. `applyProposalToSchema` consumes `blockRewrites` at approval time, falling back to the deterministic marker for any block the LLM did not produce. The governance envelope (`proposal → approval → execution → audit`) is unchanged regardless of refinement mode.
- **Routes**: all three editor proposal endpoints accept `useLlm` in the request body (default `false` → fully deterministic, identical to the previous behavior).
- **Frontend AI Editor**: a new "Refine with AI" checkbox sits next to the proposal action buttons. The diff header shows an `AI rewrite` badge when `proposal.llmRefined === true`. Status messages distinguish between AI-applied rewrites, AI-unavailable fallbacks, and deterministic edits.
- **Required-input checklist UX**: `DocumentStudioIntakeForm` now renders the selected template's `requiredInputs` as a sky-themed information panel with a bulleted list above the description field. Consultants see what the source pack must contain *before* they submit, in addition to the post-submit `MissingRequiredSourceError` remediation surface.
- **Tests**: 18 additional Vitest specs (`documentEditorRefiner.test.ts` × 11, `documentStudioEditorLlm.test.ts` × 7) covering the refiner safety contract and `useLlm` integration across all three scopes (success, partial fallback, total fallback, off-by-default). Full Document Studio backend suite now at 67 passing tests across 11 files.

### 6.3.2 MVP-3 hardening slice — QA engine v0 (Brand + Language) and audit provenance

A third MVP-3 slice has shipped, focused on quality enforcement and editor traceability:

- **QA engine v0 — deterministic Brand QA + Language QA**: new `documentQaService.ts` with a public `runDocumentQa(schema)` entry point. Brand QA scans every paragraph / list item / heading / callout / quote for global banned phrases (`as an ai`, `placeholder`, `TBD`, …), language-specific marketing fluff (en: `amazing`, `cutting-edge`, `synergy`, `utilize`, …; pl: `rewolucyjny`, `synergia`, `na koniec dnia`, …), casual markers in the `executive` register (`basically`, `kinda`, `you guys`, …), and excessive ALL-CAPS runs (Roman numerals excepted). Language QA enforces document-language consistency (Polish diacritic / token-hint heuristics vs English token hints), per-block density (against `DENSITY_TARGETS` keyed by `schema.density`), and document-level average density. Each category produces a `score ∈ [0, 100]` (severity-weighted: low −5, medium −12, high −25), a `blocking` flag (score &lt; 70), a human-readable summary, and a list of `DocumentQaFinding` entries with `code` strings (`banned_phrase`, `register_mismatch`, `language_mismatch`, `density_under`, `density_over`, `document_density_under`, `document_density_over`, `excessive_caps`). The engine is fully deterministic — no LLM call — so it is safe to run on every save and is fully auditable.
- **QA route**: `GET /api/document-studio/:artifactId/qa` returns `{ report: DocumentQaReport }`. Tenant-scoped via the same auth gate as the other routes; the artifact's `organizationId` is stamped onto the report at the route layer.
- **Audit provenance for AI-assisted edits**: `proposal_executed` audit entries now record `llmRefined: boolean` and `blockRewritesCount: number`, so the audit panel and downstream telemetry can distinguish AI-assisted proposals from purely deterministic ones without inspecting the proposal body.
- **Frontend**: new `DocumentStudioQaPanel.tsx` (rendered below the AI Editor in the document panel) with a `Run QA` button and an idle hint. Results show per-category scores with traffic-light coloring (≥ 90 emerald, ≥ 70 amber, &lt; 70 danger), a `blocking` chip when a category goes blocking, and a finding list grouped per category with severity chips and section / block back-references. Frontend types mirror the backend: `DocumentQaReport`, `DocumentQaCategoryReport`, `DocumentQaFinding`, `DocumentQaSeverity`, `DocumentQaCategory`. New API call `getDocumentStudioQaReport(artifactId)`.
- **Tests**: 13 new specs in `documentQaService.test.ts` covering banned-phrase detection (global + per-language), executive register policing, ALL-CAPS heuristic with Roman-numeral exception, clean documents → score 100, language mismatch (English block in PL doc and PL block in EN doc), per-block density floor / ceiling, document-level density average, the engine envelope (`anyBlocking` aggregation), and score clamping. Full Document Studio backend suite now at **80 passing tests across 12 files** (67 → 80).

### 6.3.3 MVP-3 hardening slice — Source QA + export soft-block

A fourth MVP-3 slice has shipped, focused on enforcing QA at the export boundary and adding source-coverage as a third deterministic QA category:

- **Source QA category**: new `runSourceQa` in `documentQaService.ts`. Three rules: (a) document-level — `schema.sourceRefs.length === 0` AND ≥ 3 editable blocks → high-severity `document_no_sources`; (b) section-level — sections with ≥ 12 editable words across ≥ 1 non-assumption block AND no section `sourceRefs` → high-severity `section_no_sources`; (c) per-block — blocks marked `isAssumption: true` in a section without `sourceRefs` → medium-severity `unresolved_assumption`; sections that contain only assumptions get a low-severity `section_only_assumptions`. The `runDocumentQa` envelope now returns three categories (`brand`, `language`, `sources`).
- **Approval-gating policy**: new `requiresApprovalForExport(documentType)` and `APPROVAL_GATED_DOCUMENT_TYPES` in `documentQaService.ts`. Gated set: `decision_memo`, `board_report`, `steering_committee_report`, `business_case`, `sales_proposal`, `client_final_report`, `due_diligence_note`, `ai_audit_report`, `internal_policy_document`. Drafts and lower-stakes types (memo, workshop summary, generic document, …) export freely.
- **`QaBlockingError` + export soft-block**: `exportDocumentArtifact(artifactId, organizationId, format, options?)` now accepts `{ userId, qaOverride }`. For approval-gated types the function runs `runDocumentQa(schema)`. If `report.anyBlocking === true` and `qaOverride !== true`, it records a `qa_blocked_export` audit entry and throws `QaBlockingError` carrying the full report. The gate runs for every format (markdown / docx / pdf) so callers cannot sidestep by switching format. Clean exports stamp `manifest.qaReportSummary` with per-category scores.
- **Audited override path**: when `qaOverride: true` is passed alongside a blocking report, the export proceeds, the manifest stamps `qaOverride: true`, and a `qa_override_export` audit entry records the actor, format, document type, and the list of blocking categories. New audit actions added to `DocumentAuditAction`: `qa_blocked_export`, `qa_override_export`.
- **Route**: `GET /api/document-studio/:artifactId/export/:format` accepts `?qaOverride=true|1` (audited). On a blocking gate without override, the route returns `403 qa_blocking` with `{ error, message, report }`.
- **Frontend**: new `QaBlockingError` class on the API client decodes the structured `403`. `exportDocumentStudioArtifact(..., { qaOverride })` round-trips the override flag. The document panel now catches `QaBlockingError`, shows a danger banner listing blocking categories with score and finding count, offers `Dismiss` and `Override and export (audited)` buttons, and surfaces a confirmation note in the existing export-note bar after a successful override.
- **Tests**: 13 new specs across `documentQaService.test.ts` (Source QA × 5, approval-gating policy × 1) and `documentStudioExportQaGate.test.ts` (skip for non-gated × 2, throw for gated × 2, audit on block × 1, override path × 1, clean gated export × 1). Full Document Studio backend suite now at **93 passing tests across 13 files** (80 → 93).

### 6.3.4 MVP-3 hardening slice — role-gated QA override + audit snapshot

A fifth MVP-3 slice has shipped, focused on closing the security gap around the QA override and giving the audit log enough payload for forensic replay:

- **Role-gated `qaOverride` enforcement**: `canOverrideQa(role)` policy added to `documentQaService.ts`. Allowed roles: `SUPERADMIN`, `SUPER_ADMIN`, `OWNER`, `ADMIN`, `ADMINISTRATOR`, `PROJECT_MANAGER`, `MANAGER` (case-insensitive, whitespace-tolerant). Everyone else (team members, viewers, guests, clients, unknown / missing role) deny by default. The service throws `QaOverrideUnauthorizedError` BEFORE running QA when an unauthorized override is attempted, so the denial is visible even on documents whose QA would have passed.
- **Denial audit**: new `qa_override_denied` audit action (`DocumentAuditAction`). Recorded with `format`, `documentType`, and the `attemptedRole` so reviewers can spot abuse patterns.
- **QA snapshot in audit `details`**: both `qa_blocked_export` and `qa_override_export` audit entries now persist a compact `qaReport` snapshot — per-category `score` / `blocking` / `findingsCount` plus a `blockingFindings[]` array carrying `category` / `severity` / `code` / `sectionId` / `blockId` for each blocking finding. The audit log now contains enough information to replay why an export was blocked (or overridden) without re-running QA against a possibly-mutated schema.
- **Route changes**: `getAuthContext` now exposes `userRole` from `req.userRole || req.user?.role`. The export route forwards both `userId` and `userRole` to `exportDocumentArtifact` and surfaces a typed `403 qa_override_unauthorized { message, role }` when the policy denies. New endpoint `GET /api/document-studio/policy` returns `{ policy: { canOverrideQa, role } }` so the frontend can hide privilege-only actions before the user attempts them.
- **Frontend**: new `QaOverrideUnauthorizedError` class on the API client decodes the typed `403`. `getDocumentStudioPolicy()` is called on document-panel mount and cached in component state. The QA-block banner now renders the `Override and export (audited)` button only when `policy.canOverrideQa === true`; unprivileged users see a one-line note explaining the requirement and showing their resolved role. If a stale policy lets an unauthorized override slip through, the panel refreshes the cached policy from the typed error and surfaces the message.
- **Tests**: 4 new specs — `documentQaService.test.ts` adds `canOverrideQa policy: privileged roles allow, others deny` (covers all 7 allowed roles, all 6 denied roles, deny-by-default for empty/null/unknown, and case-insensitive matching). `documentStudioExportQaGate.test.ts` adds three integration specs: `proceeds when qaOverride: true is set by an authorized role` (asserts on `actorRole` audit field and the `qaReport` snapshot's `blockingFindings`), `rejects qaOverride for a non-privileged role with QaOverrideUnauthorizedError and audits the denial`, `rejects qaOverride when role is missing entirely (deny-by-default)`, and `records the QA report snapshot in qa_blocked_export audit details`. Full Document Studio backend suite now at **97 passing tests across 13 files** (93 → 97).

### 6.4 MVP-3 deferred to a follow-up slice

- Persistence of the Template Registry to the wave5 substrate (replace the in-process map with `template`-typed artifacts).
- Organization-scoped Brand Voice profile (override the default banned-phrase catalog and register policies per tenant). The engine is already structured to accept this without changes to the public envelope.
- Methodology / Executive / Risk / Data / Format / Export / Completeness QA categories (slots reserved in `DocumentQaCategory`).
- Tenant-overridable `canOverrideQa` policy — currently the role set is global. A future iteration moves the role list to the org-scoped Brand Voice / governance profile so high-trust orgs can include `MANAGER` while low-trust orgs can restrict to `OWNER` only.
- ~~LLM-driven section / global edit rewrite~~ — **delivered in 6.3.1** (deterministic remains the default; LLM is opt-in per proposal).
- ~~Brand QA + Language QA scoring categories~~ — **delivered in 6.3.2** (deterministic v0; per-tenant Brand Voice profile is the next iteration).
- ~~Audit-panel `AI rewrite` provenance~~ — **delivered in 6.3.2** (recorded in `proposal_executed.details.llmRefined` and `.blockRewritesCount`).
- ~~Soft-block of Mode 3 export when QA `anyBlocking === true`~~ — **delivered in 6.3.3** for the approval-gated document type set.
- ~~Source QA category~~ — **delivered in 6.3.3**.
- ~~Role-gated override for the export QA bypass~~ — **delivered in 6.3.4** (`canOverrideQa(role)` enforced server-side; frontend hides the privilege-only button via `/api/document-studio/policy`).
- ~~QA snapshot in audit~~ — **delivered in 6.3.4** (compact `qaReport` snapshot in `qa_blocked_export` and `qa_override_export` audit details).

---

## 7. MVP-4 — Advanced DOCX export

### 7.1 Goal

Real Word styles, stable TOC, headers/footers with page numbering, cover page, lettered/numbered appendices, captions, footnotes, citation styles. PDF parity.

### 7.2 Acceptance criteria (high-level)

- DOCX renderer uses real Word styles defined per formatting class.
- TOC and page numbers survive open/close in Word and Pages.
- Format QA and Export QA categories ship.

### 7.3 Risk and mitigation

- High risk because DOCX layout regressions are easy and visible. Mitigation: maintain a baseline corpus of golden DOCX files and run pixel-stable checks against representative documents.

---

## 8. MVP-5 — Enterprise governance

### 8.1 Goal

Workflow approval, reusable content blocks, legal/compliance templates, brand governance, source provenance UI, deeper integrations, multi-user collaboration on the same schema.

### 8.2 Acceptance criteria (high-level)

- Approval workflow integrates with the V8 publish review service.
- Reusable content blocks library is available across templates.
- Multi-user editing follows the V8 concurrent editing service.

---

## 9. Cross-wave validation

Each wave MUST:

- ship behind a feature flag,
- include unit tests for the orchestrator changes,
- include at least one happy-path integration smoke,
- pass lint + typecheck,
- include a closeout report under `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`.

Each wave MUST NOT:

- regress earlier-wave behavior,
- modify the V8.1 substrate,
- modify report-builder semantics (only additive helpers may be introduced; semantic changes require a separate block),
- introduce a parallel artifact registry.

---

## 10. Cutover and deprecation

- `REPORT_GENERATOR_V3.md` is marked superseded for Document doctrine. It remains on disk as historical reference; archive-first policy applies.
- R1–R4 reports continue to be created via the existing report-builder routes during MVP-1. MVP-2 onward, R1–R4 templates become entries in the Document Studio Template Registry, and the report-builder routes remain as a transitional surface until full migration in MVP-3.
- The unified `Reports & Presentations` hub continues to be the primary R&P surface.

---

## 11. Open follow-ups

- Author the seeded `system`-scope `DocumentTemplate` records for all 22 types (MVP-2).
- Define language-specific (PL/EN) variants of default sections per type (MVP-2).
- Decide on tooling for the DOCX golden corpus and the diff method (MVP-4).
- Define the multi-user collaboration semantics for documents (MVP-5).
