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

## 6.5 MVP-3 deferred items — recovery sprints 1 → 4

The following batches close the four largest items the original MVP-3 plan deferred to a "follow-up slice" (template registry persistence, the seven missing QA categories, and AI Editor methodology + source scopes) plus a Teresa-side chat intent auto-detector that removes the manual scope picker from the UI. All four sprints are landed on `staging` of the `consultify` submodule and validated by the Document Studio test suite (220 / 220 vitest specs across 26 files green; full server `tsc --noEmit` clean).

### 6.5.1 Sprint 1 — Template registry persistence + 22 system seeded templates

- **DAO**: `documentTemplateRegistryDao.ts` — `loadTemplatesForOrg`, `loadTemplateById`, `persistTemplate`, `loadAuditForTemplate`, `persistAuditEntry`, plus `__resetTemplateRegistryDaoForTests`. Tenant boundary keyed on `${organizationId}::${templateId}`; the synthetic `SYSTEM_ORG_ID = '__system__'` namespace hosts the curated catalogue without leaking into tenant queries.
- **Migration**: `server/migrations/769_document_studio_templates.sql` adds the `document_studio_templates` and `document_studio_template_audit` tables with org-scoped indexes and `ON CONFLICT DO NOTHING` upsert semantics for the seeder path.
- **Seeder**: `documentTemplateSeeder.ts` — `seedSystemDocumentTemplates()` provisions one PL + one EN approved template for each of the 22 `DocumentTypeKey` values. Idempotent at the DAO level; per-process cached so cold-start hydration is a one-shot O(catalogue) read.
- **Service hydration + write-through**: `documentTemplateService.ts` exposes `ensureTemplateRegistryHydrated(organizationId)` which runs the seeder once and then loads tenant + system templates into the in-process registry. `draftTemplate`, `draftTemplateAsync`, `approveTemplate`, `deprecateTemplate` and `pushAudit` all write through to the DAO best-effort (failures fall back to in-memory operation, never throw). `getTemplate` falls back to `SYSTEM_ORG_ID` for the curated catalogue; `listTemplates` merges system templates without duplication. `__resetTemplateRegistryAndPersistenceForTests` clears both layers between specs.
- **Routes**: `document-studio.routes.ts` `await`s `ensureTemplateRegistryHydrated(organizationId)` before list / get / audit reads so a cold-start process always serves the persisted catalogue rather than an empty cache.
- **Tests**: `documentTemplateRegistryPersistence.test.ts`, `documentTemplateSeeder.test.ts` (covers the 22 × 2 catalogue, idempotency, and tenant isolation).

### 6.5.2 Sprint 2 — Completeness / Methodology / Executive QA

- `runCompletenessQa(schema, template?)` — empty schema, empty section, blueprint-required section missing, blueprint-optional length floor, type-aware Executive Summary requirement (`EXEC_SUMMARY_REQUIRED` set) and Decision section requirement (`DECISION_SECTION_REQUIRED` set). Title fuzzy match: NFD normalize + `ł→l` + token-set inclusion (tolerates "Findings — operational diagnostic" matching the blueprint's "Findings"). `completeness_required_section_missing` and `completeness_empty_section` are `high` severity so two missing sections collapse the score below the 70 blocking threshold.
- `runMethodologyQa(schema, template?)` — blueprint order trace (monotonic increasing index of fuzzy-matched sections), `methodology_optional_section_missing` (`low`), `methodology_drift_section` (`low`), and type-aware structural requirements: `METHODOLOGY_REQUIRED_TYPES` → `methodology_missing_methodology_section` (`high`), `ASSUMPTIONS_REQUIRED_TYPES` → `methodology_missing_assumptions_section` (`medium`), `RISKS_REQUIRED_TYPES` → `methodology_missing_risks_section` (`medium`).
- `runExecutiveQa(schema)` — Executive Summary word budget (≤ 220), action-verb gate (PL: `rekomendujemy`/`decydujemy`/…, EN: `recommend`/`approve`/…), thin-decision-section detection, owner attribution (CFO/CIO/PMO/sponsor/etc), and time-anchor regex (Q1–Q4 / months / day counts / 30/60/90). Non-executive types (`workshop_summary`, `generic_document`, …) short-circuit clean.
- **Tests**: `documentQaCompleteness.test.ts` (10), `documentQaMethodology.test.ts` (10), `documentQaExecutive.test.ts` (10) — 30/30 green.

### 6.5.3 Sprint 3 — Risk / Data / Format / Export QA (Full QA Engine 10/10)

- `runRiskQa(schema)` — section-presence on `RISK_BEARING_TYPES`, severity / mitigation / owner heuristics (PL + EN) on populated narrative blocks, structural `risk_table` row count, "section exists but no narrative AND no populated risk_table" → high empty-section finding stacked with a blocking-export finding for `RISK_CRITICAL_TYPES` (`risk_register_report`, `ai_audit_report`).
- `runDataQa(schema)` — multi-currency mixing without an FX phrase, conflicting KPI percentage values keyed by the last two normalized tokens of the KPI label (per-block regex avoids cross-line bleed), placeholder values (`TBD` / `N/A` / `XXX` / `do uzupełnienia`) with severity escalating from `low` to `medium` once a hard placeholder shows up, empty `kpi_strip` block detection, and ≥ 3 distinct date-format detection.
- `runFormatQa(schema)` — heading-level skip across sections, in-section heading skip inside the block stream, empty / single-item lists, table without header row, and consecutive-empty-paragraph whitespace artifact.
- `runExportQa(schema)` — `export_missing_formatting_schema` (`high` × 2 stacked → blocking), `export_formatting_schema_keys_missing` (page.size / fonts / headingStyles), `export_cover_page_without_title`, `export_toc_without_level_one`, `export_appendix_style_without_sections` (`low`), `export_confidentiality_footer_without_value` (`low`), `export_zero_content_after_walk` (`high` × 2 stacked → blocking).
- **Engine envelope**: `runDocumentQa(schema, options?)` accepts `RunDocumentQaOptions` with the optional `template`. Categories run in stable order: `brand → language → completeness → sources → methodology → executive → risk → data → format → export`. `anyBlocking` aggregates as before. `documentQaService.test.ts` and `documentStudioExportQaGate.test.ts` are updated to assert the 10-category ordering.
- **Tests**: `documentQaRisk.test.ts` (10), `documentQaData.test.ts` (11), `documentQaFormat.test.ts` (10), `documentQaExport.test.ts` (10) — 41/41 green.

### 6.5.4 Sprint 4 — AI Editor methodology + source scopes + Teresa chat intent auto-detect

- **Type extension**: `DocumentEditorScope` in `documentStudioTypes.ts` is extended from `local | section | global` to `local | section | global | methodology | source`. Methodology rewrites refresh prose anchored on the document's methodology / approach sections; source rewrites tighten language while preserving every citation marker, every number and every named entity verbatim.
- **Refiner guardrails**: `documentEditorRefiner.ts` adds scope-specific clauses to `buildSystemPrompt` so the LLM cannot invent new methodology steps (`MUST NOT invent new methodology steps, reorder existing steps, or paraphrase the methodology contract`) and cannot change citation markers or quantitative facts on a `source` rewrite. A post-rewrite preservation guard `preservesSourceFactsAndCitations(before, after)` enforces multiset equality of `[#n]` / `[i]` markers and decimal numbers; failed guards reject the rewrite and fall back to the deterministic baseline.
- **Service slices**: `documentStudioService.ts` adds `createMethodologyEditProposal` and `createSourceEditProposal`. `applyProposalToSchema` is refactored to honour the new scopes — methodology proposals are scoped to sections matched by `isMethodologyAlignedSection` (PL `Metodologia` / `Założenia` / EN `Methodology` / `Approach` / `Scope`); source proposals only mutate blocks that carry `block.sourceRef`. Audit trail entries record the new scope plus the section / block targets used.
- **Teresa chat intent classifier**: `documentTeresaIntent.ts` exposes `detectTeresaEditorIntent(input): TeresaEditorIntent | null`. PL+EN lexicons (`SOURCE_PHRASES`, `METHODOLOGY_PHRASES`, `GLOBAL_PHRASES`, `SECTION_PHRASES`, `LOCAL_PHRASES`) drive a precedence pipeline: source > methodology > global > local > section > cursor-fallback > null. Polish character normalization includes the explicit `ł → l` substitution after `NFD` because the standard Unicode normalizer leaves `ł` un-decomposed. The chat panel calls this classifier before invoking the refiner so the user never has to pick a scope manually.
- **Tests**: `documentEditorRefinerScopes.test.ts` (5), `documentStudioEditorMethodologyScope.test.ts` (5), `documentStudioEditorSourceScope.test.ts` (5), `documentTeresaIntent.test.ts` (14) — 29/29 green.

### 6.5.5 Recovery posture and validation

- Two intra-session workspace folder resets wiped everything not yet committed in the `consultify` submodule. The first commit (`0990f6c13`) checkpointed Sprint 4 plus all surviving Sprint 1 / 2 / 3 / 4 untracked files; the second (`ef80ff483`) re-applied the lost Sprint 1 hydration and the lost Sprint 2 / 3 QA categories on top.
- Suite at the end of recovery: 26 vitest files / 220 specs in `src/services/documentStudio/__tests__/`. `tsc --noEmit -p .` clean. ESLint clean. The recovery establishes a "commit early, commit narrow" discipline going forward — no sprint surface waits for closeout to land in git.

---

## 6.6 Epic E4 — Source Pack Connectors + chat-first creation entry

Lands the persistent, tenant-scoped, addressable bundle of evidence (`SourcePack`) consumed by Mode 1 / Mode 2 / Mode 3 generation. Five connector adapters, nine HTTP routes, and a one-call chat-first orchestration that lets Teresa turn "make me a memo from these sources" into a fully grounded document artifact in one transactional flow. Four narrow slices (4.1 → 4.4) plus this closeout, all landed on `staging` of the `consultify` submodule.

### 6.6.1 Slice 4.1 — Source Pack registry (commit `a65f39c52`)

- **Types** (`documentStudioTypes.ts`, additive): `SourcePackItemType` union (`'url' | 'text' | 'file' | 'integration' | 'v8_artifact'`), `SourcePack`, `SourcePackItem`, `SourcePackStatus`, `SourcePackAuditAction`, `SourcePackAuditEntry`. Names mirror `DocumentTemplate / TemplateAuditEntry` so the route layer can reuse the same envelope contract.
- **DAO** (`documentSourcePackRegistryDao.ts`, NEW): in-memory persistence stores keyed on `${organizationId}::${packId}`, isolated to this file so the wave5 Postgres swap is mechanical. Failure-tolerant write surface; idempotent on duplicate `auditId` (replace not append). Cross-tenant reads return `null` / `[]` deny-by-default. `__resetSourcePackRegistryDaoForTests` test-only reset.
- **Service** (`documentSourcePackService.ts`, NEW): synchronous public surface backed by an in-process Map cache; every mutation issues a best-effort `void persistX().catch(...)` so callers never have to await persistence. Lifecycle: `draftSourcePack → addSourcePackItem` (resets status to draft if the pack was already ready) `→ markSourcePackReady` (rejects empty packs, idempotent) `→ archiveSourcePack` (irreversible, refuses further mutation). `attachSourcePackToDocument` projects a `ready` pack to `DocumentSourceRef[]` and audits the attach with the artifact id; refuses draft and archived packs. `ensureSourcePackRegistryHydrated(orgId)` follows the template-service pattern: idempotent per organization, deduplicates concurrent reads via `hydrationInflight`. `listSourcePacks` excludes archived packs by default (opt-in via `includeArchived: true`); newest-first sort.
- **Tests**: `documentSourcePackService.test.ts` — 14/14 green. Covers full lifecycle, attach, tenancy, audit composition, and write-through persistence.

### 6.6.2 Slice 4.2 — Source Pack connectors (commit `5c55542d6`)

- **Module** `documentSourcePackConnectors.ts` (NEW). Stateless / failure-honest / budget-bounded.
- **Public surface**: `SourcePackConnectorError` + stable code vocabulary (`'invalid_input' | 'unsupported_scheme' | 'fetch_failed' | 'fetch_timeout' | 'fetch_too_large' | 'extraction_failed' | 'artifact_not_found' | 'integration_not_configured'`). `DEFAULT_BODY_BUDGET_CHARS = 32_000`. `DEFAULT_URL_TIMEOUT_MS = 10_000`.
- **Connectors**:
    - `ingestRawTextSource` — wraps a consultant-pasted block verbatim; stable `sourceRef` id derived from title + length + leading 32-char body slice.
    - `ingestUrlSource` — fetches HTTPS/HTTP, strips `<script>/<style>/<noscript>` + remaining tags, decodes the common entities, falls back to hostname when no `<title>`. Rejects `file://` / `data://` schemes deny-by-default. Surfaces `fetch_timeout` / `fetch_failed` / `extraction_failed` with structured details. Fetcher injectable for tests.
    - `ingestFileSource` — accepts `text/*` + `application/json|xml` mimes and the `.md/.txt/.csv/.tsv/.json/.xml/.log` extension allowlist. Rejects binary mimes (PPTX/DOCX/PDF) with `extraction_failed`; binary extraction lands in a follow-up slice.
    - `ingestV8ArtifactSource` — references an existing wave5 artifact in the same tenant. Content priority: `content_md > content > content_text`. Loader injectable for tests.
    - `ingestIntegrationSource` — stub for `notion / drive / sharepoint / confluence`. Validates shape, returns reference-only item (no body). Real handlers follow once the integration secrets path is approved (deferred per the security-tenancy rule).
- **Tests**: `documentSourcePackConnectors.test.ts` — 19/19 green. Covers budget truncation, HTML strip with title fallback, AbortController timeout via injected fetcher, content priority order, missing artifact, mime/extension allowlist, integration vocabulary guard.

### 6.6.3 Slice 4.3 — Routes (commit `f20d9c37f`)

Wires the registry + connector layer into the existing `/api/document-studio` router. Routes registered BEFORE the generic `/:artifactId` matcher so the static `/source-packs/...` prefix wins.

- `POST /source-packs` — draft (name, language, description?, notes?) → 201
- `GET /source-packs` — list (status?, language?, includeArchived?)
- `GET /source-packs/:packId` — get
- `GET /source-packs/:packId/audit` — list audit entries
- `POST /source-packs/:packId/items` — ingest via `{ connector, input }` → 201
- `DELETE /source-packs/:packId/items/:itemId` — remove
- `POST /source-packs/:packId/ready` — promote draft → ready
- `POST /source-packs/:packId/archive` — irreversible archive
- `POST /source-packs/:packId/attach` — attach to a document; returns `{ pack, sourceRefs }`

Error mapping: `SourcePackConnectorError → 400 (invalid_input | unsupported_scheme | integration_not_configured), 404 (artifact_not_found), 422 (fetch_failed | fetch_timeout | fetch_too_large | extraction_failed)`. Service errors → 404 / 400 via stable `mapServiceErrorToStatus`. Every read path awaits `ensureSourcePackRegistryHydrated(orgId)`.

### 6.6.4 Slice 4.4 — Chat-first creation entry (commit `73b005622`)

Closes the E4 surface end-to-end.

- **Service** (`documentStudioService.ts`): `CreateChatSourcePackConnectorInput` discriminated union over the five connector vocabularies. `createDocumentFromChatSourcePack(params)` orchestration:
    1. Draft pack (tenant-scoped, defaults name to `${intake.title} — sources`, packLanguage falls back to `intake.language`),
    2. Ingest every supplied connector input via the connector adapters,
    3. `markSourcePackReady`,
    4. `materializeDocumentArtifact` with the pack's `DocumentSourceRef[]`,
    5. `attachSourcePackToDocument` writes the pack → artifact audit row.
- **Rollback**: connector failures roll back the partial pack via `archiveSourcePack` with reason `'chat_source_pack_ingest_failed'`. Original error rethrown so the route layer can map it to an actionable HTTP status.
- **Teresa intent extension** (`documentTeresaIntent.ts`): `detectTeresaCreationIntent(message): TeresaCreationIntent | null`. PL + EN creation lexicons (~40 phrases — `'create a memo'`, `'draft a report'`, `'wygeneruj dokument'`, `'zrób mi raport'`, …). `SOURCE_ATTACHMENT_PHRASES` flips `sourceSignal` from `'unspecified'` to `'with_pack'` when the user says `'from these sources'` / `'na podstawie tych źródeł'` / `'z tych linków'`. Polish `ł` normalization preserved. Returns `null` for editor-style requests so `detectTeresaEditorIntent` keeps owning in-document scope resolution.
- **Route**: `POST /api/document-studio/chat/create-from-sources` accepts `{ intake, sources[], packName?, packDescription?, packLanguage?, templateId?, projectId?, useLlm?, outline? }` and returns `201 { artifactId, schema, packId, itemCount }`.
- **Tests**: `documentTeresaCreationIntent.test.ts` (9), `documentStudioChatSourcePack.test.ts` (6) — 15/15 green. Covers PL + EN creation matching, source-signal detection, the Polish `ł` normalization fix, full orchestration audit trail, connector-failure rollback to archived, input validation, custom packName trimming, language fallback. wave5 service mocked per the `documentStudioPreflight` pattern.

### 6.6.5 Validation summary

- **Suite**: 30 vitest files / **268 specs** in `src/services/documentStudio/__tests__/` green (was 220 at the end of Sprint 4 recovery; +48 specs from Epic E4: 14 + 19 + 15).
- **Type-check**: `tsc --noEmit -p .` clean.
- **Lint**: ESLint clean for every file in the diff.
- **Commits**: `a65f39c52` (4.1) → `5c55542d6` (4.2) → `f20d9c37f` (4.3) → `73b005622` (4.4) → this closeout. Each slice landed in its own commit per the recovery-era "commit early, commit narrow" discipline.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - Wave5 Postgres backing for the source-pack DAO (today: in-memory write-through with the same surface; the DAO swap is mechanical).
    - `multipart/form-data` ingestion for the file connector (today: file body posted as text in the JSON body — the connector is multipart-ready once the route adopts `multer`).
    - Live integration handlers for Notion / Drive / SharePoint / Confluence (today: stub validates shape and stores a reference-only item; deferred per the security-tenancy rule).

---

## 6.7 Epic E5 — Document Lifecycle: status mutation + version snapshot + rollback

Lands the lifecycle spine: every Document Studio artifact walks an explicit `draft → in_review → approved → published → archived` state machine, can be snapshotted at any point in time, and can be rolled back to a previous snapshot transactionally — with a `rollback_revert` snapshot captured first so rollback is itself reversible. Four narrow slices (5.1 → 5.4) plus this closeout, all landed on `staging` of the `consultify` submodule.

### 6.7.1 Slice 5.1 — Document status mutation (commit `0bf7d9f68`)

- **Types** (`documentStudioTypes.ts`, additive): `DocumentStatus` (`'draft' | 'in_review' | 'approved' | 'published' | 'archived'`). `DocumentSchema` gains `documentStatus?` + `statusChangedAt?` + `statusChangedBy?` + `statusReason?`. The status field is OPTIONAL on the type so historical artifacts created before E5 stay readable; the service overlay defaults missing values to `'draft'`. `DocumentAuditAction` extended with three new values: `'document_status_changed' | 'document_version_snapshot_created' | 'document_rolled_back'`.
- **Service** (`documentLifecycleService.ts`, NEW): `DocumentLifecycleState` (status, history, statusChangedAt/By, statusReason). `ALLOWED_TRANSITIONS` matrix narrowly enumerates reachable states per node so route validation + UI affordances can reason about it. `DocumentLifecycleTransitionError` carries a stable code (`'invalid_transition' | 'unknown_status' | 'unknown_artifact'`) plus from/to context. `transitionDocumentStatus` is idempotent on same-state requests (no audit, no history), real transitions emit one audit entry. `initializeDocumentLifecycle` is idempotent (does NOT reset state). In-memory write-through DAO + idempotent hydration (`ensureDocumentLifecycleHydrated`).
- **Studio service wiring**: module-load registers `pushAuditEntry` as the audit pump. `materializeDocumentArtifact` seeds lifecycle at draft. `getDocumentArtifact` overlays current lifecycle status onto every schema read — incl. historical artifacts.
- **Tests**: `documentLifecycleService.test.ts` — 16/16 green.

### 6.7.2 Slice 5.2 — Version snapshot (commit `d7205d032`)

- **Types**: `DocumentVersionSnapshotOrigin` (`'manual' | 'auto_status_change' | 'rollback_revert'`). `DocumentVersionSnapshot` carries `versionId / versionNumber (1-based monotonic per artifact) / capturedAt / capturedBy / label? / reason? / statusAtCapture / schema / origin`.
- **Service** (`documentVersionSnapshotService.ts`, NEW): append-only registry, deep-clone semantics on insert AND read. `createDocumentVersionSnapshot` increments versionNumber atomically inside the synchronous mutation. `listDocumentVersionSnapshots` returns sorted `versionNumber` asc; `getDocumentVersionSnapshot` is O(1) via versionIndex with tenant guard. `getDocumentVersionSnapshotByNumber` for rollback flows that address by number. In-memory write-through DAO + idempotent hydration mirroring the source-pack pattern.
- **Studio service**: `createDocumentSnapshot(params)` orchestrator — resolves the live schema via `getDocumentArtifact`, captures the lifecycle status at the time of capture, forwards a deep clone to the snapshot service. Throws `document_not_found` when wave5 returns null.
- **Tests**: `documentVersionSnapshotService.test.ts` (10) + `documentStudioSnapshotIntegration.test.ts` (6) — 16/16 green.

### 6.7.3 Slice 5.3 — Rollback (commit `dede484bb`)

- **Schema overlay** (`documentStudioService.ts`): per-artifact in-process `schemaOverlayStore` keyed `${artifactId}::${organizationId}`. `getDocumentArtifact` consults the overlay first and falls back to wave5 — so callers see the post-rollback schema even though wave5 still holds the pre-rollback row. Today only the rollback orchestrator writes here; proposal-driven edits keep flowing through wave5.
- **Lifecycle force-bypass** (`documentLifecycleService.ts`): `__forceTransitionDocumentStatusForRollback` is `@internal` and bypasses `ALLOWED_TRANSITIONS` so rollback can move from any state (incl. `published`) back to `draft`. Records a `document_status_changed` audit row tagged with `details.system: 'rollback'` so reviewers can distinguish system bypasses.
- **Rollback orchestrator** (`rollbackDocumentToVersion`): transactional flow — resolve snapshot (with tenant guard) → read live schema → capture `rollback_revert` snapshot of current schema → write target snapshot's schema into overlay → force lifecycle to draft → emit `document_rolled_back` audit row. Returns `{ schema, revertSnapshot, restoredFrom, lifecycle }`. `DocumentRollbackError` codes: `'invalid_input' | 'snapshot_not_found' | 'document_not_found' | 'tenant_mismatch'`. `snapshot_not_found` is returned for both unknown and cross-tenant versionIds so existence is not leaked.
- **Reversibility**: applying the revert snapshot rolls forward again — verified by spec.
- **Tests**: `documentStudioRollback.test.ts` — 10/10 green.

### 6.7.4 Slice 5.4 — Routes (commit `d5dba326a`)

Six new endpoints under `/api/document-studio/:artifactId`, all registered before the generic `/:artifactId` GET so the path matcher hits the most specific route first. Lifecycle + snapshot registries are hydrated on every read path so cold workers don't silently miss persisted state.

- `GET /:artifactId/lifecycle` — current status + history. 404 not_found.
- `POST /:artifactId/status` — body `{ to, reason? }`. 400 unknown_status / 409 invalid_transition / 404 unknown_artifact.
- `GET /:artifactId/snapshots` — list (versionNumber asc).
- `POST /:artifactId/snapshots` — body `{ label?, reason? }`. 201 with `{ snapshot }`. Origin is forced to `'manual'` from this surface.
- `GET /:artifactId/snapshots/:versionId` — get a snapshot. 404 for unknown OR mismatched artifact (existence not leaked).
- `POST /:artifactId/snapshots/:versionId/rollback` — body `{ reason? }`. Returns `{ schema, revertSnapshot, restoredFrom, lifecycle }`. 400 invalid_input / 404 snapshot_not_found / 404 document_not_found / 403 tenant_mismatch.

Type fix: `ALLOWED_TRANSITIONS` now uses explicit `Object.freeze<DocumentStatus[]>([...])` so the inferred element type is `DocumentStatus` instead of `string` — satisfies tsc strictly without an `as const` ladder.

### 6.7.5 Validation summary

- **Suite**: 34 vitest files / **310 specs** in `src/services/documentStudio/__tests__/` green (was 268 at the end of Epic E4; +42 specs from Epic E5: 16 + 16 + 10).
- **Type-check**: `tsc --noEmit -p .` clean.
- **Lint**: ESLint clean for every file in the diff.
- **Commits**: `0bf7d9f68` (5.1) → `d7205d032` (5.2) → `dede484bb` (5.3) → `d5dba326a` (5.4) → this closeout. Each slice landed in its own commit per the recovery-era "commit early, commit narrow" discipline.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - Wave5 Postgres backing for the lifecycle + snapshot DAOs (today: in-memory write-through with the same surface; the DAO swap is mechanical).
    - Auto-snapshot on lifecycle transitions (e.g. on entry to `approved` capture an `auto_status_change` snapshot so rollback can always reach the cleared version). Origin vocabulary already supports this; the wiring is one route handler away.
    - Schema-overlay write-through for proposal commits — today only the rollback orchestrator writes the overlay; `approveEditProposal` returns `nextSchema` but does not yet persist back to wave5 nor through the overlay. The overlay is the natural landing path.
    - Snapshot prune / retention policy (today: snapshots are append-only forever per artifact). Retention is a tenant-policy concern; defer until governance lands in MVP-5.

---

## 6.8 Epic E6 — Comments + review mode

Lands the reviewer rail: per-document / per-section / per-block comment threads with thread-wide resolve / reopen, per-section unresolved-thread badges, and an HTTP surface that the editor canvas can consume directly. Three narrow slices (6.1 → 6.3) plus this closeout, all landed on `staging` of the `consultify` submodule.

### 6.8.1 Slice 6.1 — Comments data plane (commit `f92efe685`)

- **Types** (`documentStudioTypes.ts`, additive): `DocumentCommentStatus` (`'open' | 'resolved'`, binary by design). `DocumentCommentAnchor` discriminated union over `'document'` / `'section'` (sectionId) / `'block'` (sectionId + blockId). `DocumentComment` carries commentId / threadId / artifactId / organizationId / parentCommentId? / anchor / authorId / body / status / createdAt / updatedAt + resolvedBy/At/Reason + reopenedBy/At + soft-delete fields (deletedBy/At). `DocumentCommentThread` + `DocumentCommentSectionCounts` placeholders for slice 6.2. `DocumentAuditAction` extended with five new values (`comment_added` / `comment_replied` / `comment_resolved` / `comment_reopened` / `comment_deleted`).
- **Service** (`documentCommentsService.ts`, NEW): synchronous in-process Map cache + in-memory write-through DAO + idempotent hydration per organization (`ensureDocumentCommentsHydrated`). Audit pump injected by the studio service so every mutation lands in the same per-artifact audit timeline as proposals + QA decisions + lifecycle transitions + snapshots. `DocumentCommentError` carries a stable code (`'invalid_input' | 'unknown_comment' | 'unknown_thread' | 'comment_already_resolved' | 'comment_not_resolved' | 'comment_deleted' | 'reply_to_reply_forbidden' | 'forbidden'`). Cross-tenant lookups throw `unknown_comment` so existence is not leaked.
    - `createDocumentComment` seeds threadId === commentId on the root.
    - `replyToDocumentComment` inherits parent anchor + threadId, bumps root.updatedAt for activity-sort, rejects replies-to-replies (flat MVP thread model — UI tree exactly two levels deep).
    - `resolveDocumentComment` is THREAD-WIDE: every comment in the thread (root + replies) flips to status: 'resolved' atomically. Resolving via a reply still resolves the whole thread. Throws `comment_already_resolved` on double-resolve.
    - `reopenDocumentComment` is the inverse — clears resolved* + stamps reopened* thread-wide. Throws `comment_not_resolved` on already-open.
    - `deleteDocumentComment` is author-only soft-delete; the row stays in the timeline with body: '' + deletedAt stamp; default listing hides deleted.
    - `listDocumentComments(artifactId, organizationId, options?)` supports filters: status / hideDeleted / anchorKind / sectionId / blockId. The sectionId filter matches BOTH section AND block anchors so the editor canvas can pull "everything attached to this section" in one call.
- **Tests**: `documentCommentsService.test.ts` — 17/17 green.

### 6.8.2 Slice 6.2 — Thread aggregation + counts (commit `c45d76c38`)

- **Service additions**:
    - `listDocumentCommentThreads(artifactId, organizationId, options?)` groups raw comments by threadId and returns `DocumentCommentThread` rows with the root, replies (createdAt asc), thread-level status (mirrors root), anchor (mirrors root), and updatedAt (max across the thread). Sorted most-recent-activity first — works because Slice 6.1 bumps `root.updatedAt` on every reply.
    - Soft-delete handling: root deleted with replies → thread stays visible; root deleted without replies → orphaned-deleted; hidden by default, opt-in via `hideOrphanedDeleted: false`.
    - Filter contract: status / anchorKind / sectionId / blockId all apply to the THREAD (root's properties).
    - `getDocumentCommentSectionCounts(artifactId, organizationId)` returns per-section + per-block buckets for unresolved-thread badges. Document-anchored threads count toward `totalOpen` / `totalResolved` only (omitted from `perSection` / `perBlock` so the rail badges match section / block headings exactly). Block-anchored threads contribute to BOTH the section AND the block bucket so a section-level badge always sums everything attached "below" it.
- **Tests**: `documentCommentsThreads.test.ts` — 10/10 green.

### 6.8.3 Slice 6.3 — Routes (commit `298f797ba`)

Nine endpoints scoped under `/api/document-studio/:artifactId/comments`, all registered before the generic `/:artifactId` GET so the path matcher hits the most specific route first. Lifecycle gating is intentionally NOT enforced here — review mode must stay usable on any document status; the lifecycle check belongs in a UI / governance layer.

- `GET /:artifactId/comments` — flat list (status / sectionId / blockId / hideDeleted query).
- `POST /:artifactId/comments` — body `{ body, anchor: { kind, sectionId?, blockId? } }`. Returns 201 `{ comment }`. `parseCommentAnchorFromBody` validates the discriminated union before reaching the service so the route returns 400 invalid_anchor for malformed payloads.
- `GET /:artifactId/comments/threads` — grouped view (status / sectionId / blockId).
- `GET /:artifactId/comments/counts` — totals + perSection + perBlock buckets.
- `GET /:artifactId/comments/:commentId` — single comment, 404 not_found for missing OR mismatched artifact (no existence leak).
- `POST /:artifactId/comments/:commentId/reply` — body `{ body }`. 201 `{ comment }`.
- `POST /:artifactId/comments/:commentId/resolve` — body `{ reason? }`. Thread-wide.
- `POST /:artifactId/comments/:commentId/reopen` — body `{ reason? }`. Thread-wide.
- `DELETE /:artifactId/comments/:commentId` — author-only soft-delete.

Error mapping — `mapCommentErrorToStatus`: 400 `invalid_input`; 403 `forbidden`; 404 `unknown_comment` / `unknown_thread`; 409 `comment_already_resolved` / `comment_not_resolved` / `reply_to_reply_forbidden` / `comment_deleted`.

### 6.8.4 Validation summary

- **Suite**: 36 vitest files / **337 specs** in `src/services/documentStudio/__tests__/` green (was 310 at the end of Epic E5; +27 specs from Epic E6: 17 + 10).
- **Type-check**: `tsc --noEmit -p .` clean.
- **Lint**: ESLint clean for every file in the diff.
- **Commits**: `f92efe685` (6.1) → `c45d76c38` (6.2) → `298f797ba` (6.3) → this closeout. Each slice landed in its own commit per the recovery-era "commit early, commit narrow" discipline.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - @-mentions + notification fan-out (today: comments are a passive timeline; mention parsing + notification dispatch arrive with the V8 notification gateway integration).
    - Comment-level edit-history (today: `body` is mutable only via reply / soft-delete; no version trail per comment). The audit timeline already records every mutation, but a dedicated edit-history view requires its own surface.
    - Lifecycle gates (today: review mode usable on any status). When governance lands in MVP-5, archived documents may need to refuse new threads — that policy is a UI / governance concern, not a data-plane one.
    - Author-only edit (today: comments are append-only — the only way to "edit" is reply or delete-and-recreate). Adding `editComment(commentId, newBody)` is straightforward but requires a stable diff representation; defer until the audit timeline UI lands.
    - Wave5 Postgres backing for the comments DAO (today: in-memory write-through with the same surface; the DAO swap is mechanical).

---

## 6.9 Epic E7 — Per-tenant Brand Voice profile

Lands the per-organization Brand Voice spine: every tenant can ship its own lexicon (banned phrases, escape-hatch for noisy globals, glossary of avoid → prefer pairs, required keywords, register override, language scope) on top of the global banned-phrase catalogue baked into the QA engine. Three narrow slices (7.1 → 7.3) plus this closeout, all landed on `staging` of the `consultify` submodule.

### 6.9.1 Slice 7.1 — Brand voice profile data plane (commit `aa66c37e4`)

- **Types** (`documentStudioTypes.ts`, additive): `BrandVoiceProfileStatus` (`'draft' | 'active' | 'archived'`), `BrandVoiceProfileLanguageScope` (`'pl' | 'en' | 'all'`), `BrandVoiceGlossaryEntry` (`{ avoid, prefer, note? }`), `BrandVoiceProfile` (profileId / organizationId / name / description / status / version / languageScope / bannedPhrases / disabledGlobalBannedPhrases / preferredPhrases / glossaryEntries / requiredKeywords / registerOverride / notes / created+activated+archived audit fields), plus `BrandVoiceProfileDraftInput` / `BrandVoiceProfileUpdateInput` / `BrandVoiceProfileAuditAction` / `BrandVoiceProfileAuditEntry`. Profile audit lives in its own stream (organization-scoped, NOT artifact-scoped) — it is never pushed into the per-document `DocumentAuditEntry` timeline.
- **DAO** (`documentBrandVoiceRegistryDao.ts`, NEW): mirrors the source-pack DAO 1:1 — in-memory write-through `profileStore` + `auditStore`, keyed `${organizationId}::${profileId}`, every operation failure-tolerant (`{ ok: false }` / `null` / `[]`), `loadBrandVoiceProfilesForOrg` filters by key prefix so cross-tenant rows are invisible.
- **Service** (`documentBrandVoiceService.ts`, NEW): synchronous in-process Map cache + idempotent per-org hydration (`ensureBrandVoiceRegistryHydrated`) + `BrandVoiceProfileError` with stable code surface (`'invalid_input' | 'profile_not_found' | 'profile_archived' | 'profile_already_active' | 'profile_already_archived' | 'forbidden'`). Public API: `draftBrandVoiceProfile`, `updateBrandVoiceProfile` (bumps `v{n}` version), `activateBrandVoiceProfile` (auto-archives previous active + records `profile_superseded` audit entry on the outgoing profile), `archiveBrandVoiceProfile`, `getBrandVoiceProfile`, `listBrandVoiceProfiles` (status filter + `includeArchived`), `getActiveBrandVoiceProfile` (single tenant-active row), `listBrandVoiceProfileAuditEntries`. Phrase / glossary inputs are normalized on every write (trim, dedupe lowercase, drop empties) so the QA layer can consume them directly.
- **Tests**: `documentBrandVoiceService.test.ts` — 15/15 green. Covers normalization, language-scope defaulting, register-override validation, version bump, archived-immutability, supersede flow, list filtering, cross-tenant deny, hydration replay.

### 6.9.2 Slice 7.2 — Brand QA profile-aware integration (commit `989d8a5fb`)

- **Engine** (`documentQaService.ts`):
    - `RunDocumentQaOptions` gains `brandVoiceProfile?: BrandVoiceProfile | null`.
    - `runBrandQa(schema, profile)` is now profile-aware:
        - `bannedPhrases` ADD to the global lexicon (additive); hits emit `tenant_banned_phrase` so the audit panel can distinguish org policy from the global baseline.
        - `disabledGlobalBannedPhrases` SUBTRACT from the global list (escape-hatch, case-insensitive).
        - `glossaryEntries` (avoid → prefer) emit `glossary_replacement` findings; entries already firing as banned hits are skipped to avoid double-flagging.
        - `requiredKeywords` produce one `required_keyword_missing` HIGH finding per absent term, anchored to the first section so the UI has a stable scroll target (the requirement is document-level, not block-level).
        - `registerOverride` pins the casual-marker check stricter than the schema's `communicationRegister` — e.g. activate the executive casual lexicon even when the schema is `professional`.
        - `languageScope` filters: profile applies only when scope is `'all'` or matches `schema.language`, AND only when `status === 'active'`.
    - The clean-document summary is profile-aware (mentions the active profile name when no findings emit).
- **Studio service** (`documentStudioService.ts`):
    - `exportDocumentArtifact` resolves the active profile via `getActiveBrandVoiceProfile` (idempotent hydration first) and forwards it to `runDocumentQa`.
    - New public orchestrator `runQaForDocument(artifactId, organizationId)` resolves schema + Mode 3 template (from artifact metadata) + active profile in one call. Stamps `report.organizationId` so callers don't have to.
- **Routes**: `GET /:artifactId/qa` switched from inline `runDocumentQa(schema)` to `runQaForDocument` so the QA panel automatically surfaces tenant-banned phrases / glossary suggestions / required-keyword warnings without extra route work.
- **Tests**: `documentQaBrandVoiceProfile.test.ts` — 8/8 green. Covers additive banned phrases, global-disable escape-hatch, glossary replacement (incl. no double-flag with banned), required-keyword missing detection, register override, languageScope filtering (pl / en / all), inactive-profile guard, and the profile-aware clean-document summary.

### 6.9.3 Slice 7.3 — Routes (commit `cd91152b1`)

Eight endpoints scoped under `/api/document-studio/brand-voice/...`, all registered before the generic `/:artifactId` matcher so the static prefix wins. Each read path awaits `ensureBrandVoiceRegistryHydrated` so cold-start workers serve the persisted catalogue rather than an empty cache.

- `GET /brand-voice/active` — currently active profile or 204 No Content.
- `GET /brand-voice/profiles` — list (`status?`, `includeArchived?`).
- `POST /brand-voice/profiles` — draft a new profile.
- `GET /brand-voice/profiles/:profileId` — single profile.
- `PATCH /brand-voice/profiles/:profileId` — partial update (draft + active rows; archived is immutable).
- `POST /brand-voice/profiles/:profileId/activate` — promote to active; auto-archives previous active.
- `POST /brand-voice/profiles/:profileId/archive` — body `{ reason? }`; irreversible.
- `GET /brand-voice/profiles/:profileId/audit` — list audit entries.

Body parsing is defensive: `parseStringArray`, `parseGlossaryEntries`, `parseLanguageScope`, and `parseRegisterOverride` filter malformed payloads to typed shapes (or undefined / null for the explicit-clear path) BEFORE reaching the service so the service contract stays clean.

Error mapping (`mapBrandVoiceErrorToStatus`): 400 `invalid_input`; 403 `forbidden`; 404 `profile_not_found`; 409 `profile_archived` / `profile_already_active` / `profile_already_archived`.

### 6.9.4 Validation summary

- **Suite**: 38 vitest files / **360 specs** in `src/services/documentStudio/__tests__/` green (was 337 at the end of Epic E6; +23 specs from Epic E7: 15 + 8).
- **Type-check**: `tsc --noEmit -p .` clean.
- **Lint**: ESLint clean for every file in the diff. Pre-existing `no-useless-escape` warning at `documentQaService.ts:1548` (Recovery Sprint 6, commit `ef80ff4837`) left untouched per the scope-lock rule.
- **Commits**: `aa66c37e4` (7.1) → `989d8a5fb` (7.2) → `cd91152b1` (7.3) → this closeout. Each slice landed in its own commit per the recovery-era "commit early, commit narrow" discipline.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - LLM-powered profile drafting (today: profiles are author-driven; a future iteration adds a `POST /brand-voice/profiles/draft` that takes a corpus of past tenant deliverables and proposes a starting lexicon).
    - `preferredPhrases` scoring (today: stored on the profile but not yet a positive QA signal; the global engine has no positive-finding code path. Lights up cleanly once `runDocumentQa` adds an "encouragement" severity tier).
    - Per-document profile pinning (today: the active tenant profile applies to every document. Pinning a specific profile to a specific artifact — useful for legal vs marketing docs in the same tenant — is a one-field metadata extension on the artifact + one resolve-time fallback in `runQaForDocument`).
    - Wave5 Postgres backing for the brand-voice DAO (today: in-memory write-through with the same surface; the DAO swap is mechanical).
    - Frontend Brand Voice editor (today: backend-only; the chat-first creation entry surfaces tenant findings via the QA panel automatically, but the dedicated edit UI is a separate slice).
    - Tenant-overridable `canOverrideQa` policy via the brand-voice / governance profile — flagged at MVP-3 boundary (`6.4 MVP-3 deferred`) and still pending; the active brand-voice row is the natural carrier once the role-set field is added.

---

## 6.10 Epic E8 — Advanced DOCX (MVP-4)

Epic E8 lifts the DOCX export from "real .docx file" (MVP-1 finalization) to "consulting-grade Word deliverable that survives open/close in Word + Pages + LibreOffice with the outline, TOC, captions, footnotes, and appendix numbering Word reviewers expect." The PDF renderer follows the same structural contract so the print artifact mirrors the editable artifact.

### 6.10.1 Slice 8.1 — Word styles per formatting class (commit `4516d96da`)

- New `documentDocxStyles.ts` resolves a `FormattingClass` (`executive` / `professional` / `narrative` / `legal`) from the schema's `communicationRegister` × `languageStyle`, and emits a Word-styles config (`paragraphStyles[]`) under stable ids: `DocStudioTitle`, `Subtitle`, `Heading1..3`, `BodyText`, `BlockQuote`, `Caption`, `DocStudioFootnote`, `AssumptionBody`, `Callout`, `SourceList`, `TOCHeading`. `Title` and `FootnoteText` are renamed out of Word's reserved namespace because `docx@9.5.1` merges those built-ins with run-property defaults that strip our font/color/bold.
- `documentDocxRenderer.ts` threads a `RenderContext` (resolved class + fonts) through every block helper and tags every emitted `Paragraph` with a `style: DOCX_STYLE_IDS.*` id. Headings keep the semantic `heading: HeadingLevel.HEADING_X` annotation alongside the named style so Word's outline level resolves correctly.
- New tests:
    - `documentDocxStyles.test.ts` (13 specs): class resolver matrix, font normalization, full style-id surface, exec-vs-legal size ordering, human-readable `describeFormattingDecision` output.
    - `documentDocxRenderer.test.ts` (6 specs): real .docx round-trip via JSZip; `word/styles.xml` contains every renderer-referenced style id; `word/document.xml` references `BodyText`, `Heading1`, `BlockQuote`, `Callout`, `DocStudioTitle`, `Subtitle`.

### 6.10.2 Slice 8.2 — TOC + cover page break + appendix labelling (commit `80f740682`)

- New optional `DocumentSection.kind?: 'body' | 'appendix'` (additive type; pre-E8 schemas keep working). Renderer auto-detects appendices by EN/PL title prefix when `kind` is absent (`Appendix`, `Annex`, `Załącznik`, `Zalacznik`).
- New `documentDocxStructure.ts` exposes pure helpers consumed by both renderers:
    - `isAppendixSection(section)` — explicit kind + title-prefix heuristic.
    - `partitionSections(sections)` — body + appendix groups, intra-group order preserved, appendices always trail.
    - `formatBodyHeading(section, idx)` — Arabic numbering.
    - `formatAppendixHeading(section, idx, formatting)` — lettered (`Appendix A — title`) / numbered (`Appendix 1 — title`) / none, idempotent for already-prefixed titles.
    - `letterForIndex(n)` — spreadsheet-style sequence beyond Z (AA, AB, …).
    - `planSectionHeadings(sections, formatting)` — full audit plan used by tests + the PDF TOC renderer.
- DOCX renderer additions:
    - Hard `PageBreak` at the end of the cover block so the cover lives on its own page.
    - Real Word `TableOfContents` field (with `hyperlink: true`, `headingStyleRange: '1-3'`) under a `TOCHeading`-styled paragraph when `formattingSchema.toc === true`, followed by another page break so body content lands on a fresh page.
    - Body sections rendered with Arabic numbering, appendices under the configured `appendixStyle`, and a forced page break before the FIRST appendix only (subsequent appendices flow naturally so two short appendices do not waste a page each).
- New tests:
    - `documentDocxStructure.test.ts` (16 specs): appendix detection (explicit kind + EN/PL prefixes), partitioning order, body numbering, lettered/numbered/none labelling, idempotency, letter beyond Z, plan output.
    - Extended `documentDocxRenderer.test.ts` with 5 new specs (now 11 total): TOC field present when toc=true, absent when toc=false; hard page break in cover; appendix lettering ordering vs body numbering; Arabic-digit appendix labelling under "numbered" scheme.

### 6.10.3 Slice 8.3 — Captions, footnotes, citation markers (commit `ee985d290`)

- `RenderContext` now carries mutable per-render registries: `tableCounter`, `figureCounter`, `nextFootnoteId`, `footnotes: Map<id, paragraphs>`, and a `sourceRefIndex: Map<key, 1-based-index>` keyed by `${sourceType}::${sourceId}`. The final `Document({ footnotes })` is populated only when the registry has user-supplied entries.
- `block.sourceRef` on paragraph / quote / table blocks renders a citation marker per `formattingSchema.citationStyle`:
    - `'inline_marker'` → ` [N]` indexed against `schema.sourceRefs`.
    - `'footnote'` and `'endnote'` (folded into footnote semantics for MVP-4) → register a Word footnote body (`Source: <type>#<id> — <title>`) and emit a `FootnoteReferenceRun`.
- Tables auto-emit a `Table N — caption` paragraph in the `Caption` named style; counter is renderer-scoped so two tables across different sections become "Table 1" / "Table 2". Same pattern for `image` blocks → `Figure N — caption` (with a placeholder paragraph preceding the caption while image embedding remains deferred).
- `block.type === 'footnote'` registers `block.content.text` in the footnote registry and emits an inline `Note <ref>` paragraph so Word's footnote pane links the body to a specific spot. Empty footnote blocks are skipped (no id allocation, no orphan body).
- New `documentDocxCaptionsFootnotes.test.ts` (9 specs): table caption auto-numbering with + without schema caption, figure captions, inline-marker citations, footnote-style citations, endnote→footnote folding, footnote block round-trip through `word/footnotes.xml`, empty footnote skip, unique id allocation across multiple notes.

### 6.10.4 Slice 8.4 — PDF parity (commit `2863533fd`)

- `documentPdfRenderer.ts` now mirrors the DOCX renderer's structural contract:
    - `PdfRenderContext` resolves the formatting class via `resolveFormattingClass`, owns per-render caption + footnote counters, and the source-ref citation index. Sizes per class live in `PDF_SIZING_BY_CLASS` (executive 28pt title / professional 24pt / narrative 24pt / legal 20pt).
    - All `draw*` helpers now take `PdfRenderContext`. Headings honor a per-class size triple; `drawHeading` accepts an optional `pageBreakBefore` so the appendix block opens on a fresh page (first appendix only — subsequent appendices flow naturally, matching the DOCX renderer).
    - `drawTableOfContents` renders the body+appendix heading list under a `Table of Contents` heading + page break when `formattingSchema.toc === true`; reuses `planSectionHeadings` so DOCX + PDF agree on the listing.
    - Section rendering uses `partitionSections` + `formatBodyHeading` / `formatAppendixHeading` (shared with DOCX). Body sections receive Arabic numbering; appendices follow `appendixStyle` (lettered / numbered / none).
    - Captions: tables auto-emit `Table N — caption` lines under the caption font size; images render as `Figure N — caption` placeholders.
    - Citations: `inline_marker` appends ` [N]` markers; `footnote`/`endnote` append a `^N` anchor and route the source description into a Notes appendix emitted at the end of the document. `block.type === 'footnote'` registers `block.content.text` in the Notes appendix and emits a `Note ^N` anchor in body text.
    - PDF Subject metadata embeds the resolved formatting class (`<documentType> · <formattingClass>`).
- New `documentPdfRendererParity.test.ts` (10 specs) using `pdf-parse` to extract page text rather than substring-matching the compressed buffer: valid PDF magic + title; lettered + numbered appendix labelling; TOC presence/absence; Table N / Figure N caption auto-numbering; inline-marker vs footnote-style citations; Notes appendix on footnote blocks; formatting class in PDF metadata.

### 6.10.5 Validation summary

- Document Studio scope: **43 files / 419 specs**, all green.
- `npx tsc --noEmit -p .` clean across the full server tsconfig.
- `npx eslint` clean for the renderers + new tests (the single pre-existing `no-useless-escape` warning in `documentQaService.ts` is from Recovery Sprint 6 — out of scope; flagged in `6.5 Recovery Sprints` and unchanged here).
- Backward-compatible additive type: pre-E8 schemas without `DocumentSection.kind` continue to render correctly; existing `documentStudioExport.test.ts` (DOCX ZIP magic + PDF magic + manifest pendingRendering removal) continues to pass without modification.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - Word's `compatabilityModeVersion` + `updateFields` features (today the TOC field is functional but Word displays "Update field" the first time the file is opened; setting `features.updateFields` would make Word auto-populate on open at the cost of a noisy diff).
    - Image asset embedding (today: Figure-N captions stand alone with a `[Figure N placeholder — image asset not yet embedded]` line; embedding via `ImageRun` requires a `block.content.url` resolver against an asset store, which lands when the source-pack image asset connector ships).
    - Native bottom-of-page footnote positioning in PDF (today: footnotes route to a Notes appendix; native bottom-of-page is a pdfkit-level layout concern requiring two-pass rendering).
    - Pixel-stable golden DOCX/PDF corpus (today: structural assertions via `JSZip` for DOCX and `pdf-parse` for PDF; visual regressions still require manual review).
    - Frontend rendering of the new structural decisions in the in-app preview (today: server-only; the preview surface needs to mirror the cover page break + TOC field at a future slice).
    - Format QA + Export QA hardening for the new appendix/caption/citation surface — covered structurally by the new tests but not yet expressed as new QA category check codes.

---

## 6.11 Epic E9 — Audience-driven warianty

Epic E9 lifts the document model from "single canonical schema rendered once" to "single canonical schema with N audience-aware projections." A consultant authors a board memo once, tags the executive-only / engineering-only / client-only material on the source schema, and the projector derives a tailored variant for every active audience profile (Board, Client, Engineering, PMO, plus tenant-custom profiles). No re-authoring, no LLM rewrite — the projection is a pure structural transformation with explicit provenance so downstream tooling can explain why a section is missing in a given variant.

### 6.11.1 Slice 9.1 — AudienceProfile types + projector + 4 system seeds (commit `d2475d8e6`)

- Additive, backwards-compatible type extensions on `documentStudioTypes.ts`:
    - `DocumentBlock.audienceTags?: string[]` and `DocumentSection.audienceTags?: string[]` — free-form tag lists used by the projector to decide whether the element survives projection. Untagged elements are default-include so pre-E9 schemas project unchanged.
    - `AudienceProfile`, `AudienceProfileStatus`, `AudienceProfileTagFilter`, `AudienceProfileExecutiveSummaryPolicy`, `AudienceProfileAppendixPolicy`, `AudienceProfileJargonPolicy`, `AudienceProfileDraftInput / UpdateInput / AuditEntry`, `DocumentVariant`, `DocumentVariantProvenance`.
- New `documentAudienceProjector.ts` exposes the pure projection contract:
    - `projectDocumentForAudience(schema, profile, opts) → { schema, provenance }` — deep-clones every kept section / block, applies schema-level scalar overrides (`audience` / `communicationRegister` / `density` / `languageStyle`), filters sections + blocks against the profile's tag filters, applies the executive-summary policy (EN+PL title heuristics) and appendix policy (reusing the E8 `isAppendixSection` detector). Provenance carries `sectionsKept`, `sectionsDropped` (with reasons: `appendix_policy_drop` / `executive_summary_drop` / `section_tag_filter`), and `blocksDropped`.
    - `describeAudienceProjectionPlan(schema, profile)` — same decisions without the deep clone, used for the `/:artifactId/variants` overview endpoint.
    - `passesTagFilter(tags, filter)` and `isExecutiveSummarySection(section)` are exported for direct testing and reuse.
- New `documentAudienceProfileSeeds.ts` ships four immutable system-default profiles owned by `'system'` org:
    - `system_board_executive` — executive register, concise density, drops appendices + `technical_detail` + `engineering_only`, audience: `Board / CEO / CFO`.
    - `system_client_external` — professional register, standard density, drops `internal_only` + `engineering_only`, keeps appendices, audience: `Client`.
    - `system_engineering_technical` — technical register, detailed density, drops executive summary + `client_only`, keeps appendices, audience: `Engineering / Technical Lead`.
    - `system_pmo_operational` — professional register, standard density, drops `client_only`, audience: `PMO / Project Team`.
- Stable `SYSTEM_AUDIENCE_TAG_VOCABULARY` (`technical_detail`, `engineering_only`, `internal_only`, `client_only`) shared across all four defaults so authors tag once and every variant projects correctly.
- New tests:
    - `documentAudienceProjector.test.ts` (27 specs): tag-filter precedence, executive-summary detector, scalar overrides, section / block filtering, executive-summary + appendix policies, immutability + provenance, all four system defaults, plan-equals-projection consistency.

### 6.11.2 Slice 9.2 — AudienceProfile DAO + service registry (commit `06ea47206`)

- New `documentAudienceProfileRegistryDao.ts`: in-memory profile + audit stores keyed by `(organizationId, profileId)`, failure-tolerant API (`load* → null/[]`, `persist* → { ok }`), tenant-boundary deny-by-default, Postgres-ready signatures so the wave5 migration is a mechanical swap.
- New `documentAudienceProfileService.ts` mirrors the E7 brand-voice contract with two structural differences:
    - **Multiple active profiles per organization.** Brand Voice limits to one active because it controls QA scoring; audience profiles describe orthogonal output renditions (board / client / engineering) and a tenant typically activates several at once.
    - **System seeds overlaid into reads** without persistence. `getAudienceProfile`, `listAudienceProfiles`, `listActiveAudienceProfiles` return the four immutable defaults alongside tenant rows. Mutations against system seeds throw `system_profile_immutable`.
- `AudienceProfileError` taxonomy: `invalid_input`, `profile_not_found`, `profile_archived`, `profile_already_active`, `profile_already_archived`, `system_profile_immutable`, `forbidden`.
- Lifecycle: `draft → active → archived` (archived rows immutable, queryable for audit). Activation never auto-supersedes; `activateAudienceProfile` is idempotency-guarded against `profile_already_active`.
- `ensureAudienceProfileRegistryHydrated(organizationId)` is the cold-start hook — idempotent, awaited by every read-path route.
- New `documentAudienceProfileService.test.ts` (22 specs): draft (5: normalization, invalid-input guards, system-org forbidden, unsupported scalar overrides, write-through), update (5: version bump, null clears overrides, archived rejected, system seed immutable, profile_not_found), activate / archive (5: stamp, multiple actives allowed, idempotency guards, system seed archive rejection), reads (5: cross-tenant denial, list includes seeds, includeSystem=false, includeArchived flag, system seed lookup), hydration (1), full-lifecycle audit (1).

### 6.11.3 Slice 9.3 — Routes (commit `c6b8491b7`)

- 9 new endpoints under `/api/document-studio`:
    - `GET /audience-profiles` (status?, includeArchived?, includeSystem?), `POST /audience-profiles`, `GET /audience-profiles/:profileId`, `PATCH /audience-profiles/:profileId`, `POST /audience-profiles/:profileId/activate`, `POST /audience-profiles/:profileId/archive`, `GET /audience-profiles/:profileId/audit`.
    - `GET /:artifactId/variants` returns active profiles (tenant + system) each accompanied by a `describeAudienceProjectionPlan` summary against the document.
    - `GET /:artifactId/variants/:profileId` returns the projected `DocumentSchema` + provenance via `projectDocumentForAudience`.
- HTTP error mapping (`mapAudienceProfileErrorToStatus`): 400 invalid_input · 403 system_profile_immutable / forbidden · 404 profile_not_found / document_not_found · 409 profile_archived / profile_already_active / profile_already_archived.
- Defensive body parsing: `parseAudienceTagFilter`, `parseAudienceRegister/Density/LanguageStyle` (with null-clear semantics), `parseAudienceExecutiveSummaryPolicy/AppendixPolicy/JargonPolicy`. Variant routes are read-only projections — no QA, no artifact mutation. Variant binary export through the renderers is intentionally deferred (downstream tooling renders the projected schema if needed).
- Following the E5 / E6 / E7 pattern, route-level integration tests are intentionally not added — the data plane is fully covered at the service layer (E9.1: 27 specs, E9.2: 22 specs) and the error-code → HTTP-status switch is a trivial mapper.

### 6.11.4 Validation summary

- Document Studio scope: **45 files / 468 specs**, all green (was 43 / 419 at end of Epic E8; +2 files / +49 specs from E9).
- `npx tsc --noEmit -p .` clean across the full server tsconfig.
- `npx eslint --fix` clean for the new modules + tests; only pre-existing `no-useless-escape` warning on `documentQaService.ts` (Recovery Sprint 6, called out in §6.5) and pre-existing `any` warnings in `getAuthContext` survive.
- Backward-compatible additive types: pre-E9 schemas without `audienceTags` continue to project unchanged (untagged elements are default-include); pre-E9 `DocumentSection.kind` semantics from E8 are preserved; existing renderer tests (DOCX / PDF parity) pass without modification.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - LLM-driven jargon substitution. `AudienceProfileJargonPolicy` is wired through the projector and stored on profiles, but a `'plain_language'` profile today only carries the policy intent — actual rewrite requires a refiner pass that reuses `documentEditorRefiner.ts` guards (methodology + source scope) under the audience constraint. Non-trivial; lands when the audience-aware AI editor flow ships.
    - Variant binary export through the DOCX / PDF renderers. The renderers consume `DocumentSchema` directly so the projected schema is renderable today, but a dedicated `/:artifactId/variants/:profileId/export/:format` route needs a QA-gating policy decision (run QA on the variant — flagging dropped exec summary as a finding; vs treat the variant as derivative of an already-QA'd source — which is the natural model). Decision deferred.
    - Density adjustment beyond scalar override. Today `densityOverride` rewrites the schema scalar; future slices may drop "detail-level" tagged blocks when the effective density steps down (e.g. comprehensive → concise). Plumbing exists (`audienceTags`); semantics unfrozen.
    - Persistence migration. Both DAOs (audience profiles + audit) sit on the in-memory store consistent with the rest of MVP-2..MVP-4; the wave5 Postgres migration is shared infrastructure landing across all Document Studio modules at once.
    - Frontend audience-variant picker. Today server-only; the consultant UI surface (Menu 3 right-side action: "Render variant…") needs to mirror the active-profile list and the projection plan, owned by Epic E11.

---

## 6.12 Epic E10 — Enterprise Collaboration

Epic E10 turns the Document Studio's existing single-author, single-state lifecycle into an enterprise-grade collaboration substrate. Two orthogonal data planes ship together: a multi-reviewer **approval workflow** that adds the evidentiary trail behind the existing `in_review → approved` lifecycle transition (who requested, who reviewed, what verdict, when resolved, under which quorum policy), and a tenant-scoped **reusable content block library** that lets consultants drop pre-approved boilerplate snippets (standard intros, compliance disclaimers, methodology blurbs) into any document without copy/pasting from older artifacts. Both planes mirror the E5 / E6 / E7 / E9 design contract — DAO + service registry + idempotent hydration + audit trail + write-through persistence — so future moves (Postgres migration, V8 publish-review integration, multi-user concurrent editing) compose without reshaping anything that already shipped.

### 6.12.1 Slice 10.1 — Approval workflow data plane (commit `faec2ecc8`)

- Additive type extensions on `documentStudioTypes.ts`:
    - `DocumentApprovalStatus` (`pending` / `approved` / `rejected` / `changes_requested` / `cancelled`), `DocumentApprovalDecisionKind` (`approve` / `reject` / `request_changes`), `DocumentApprovalQuorumPolicy` (`unanimous` / `majority` / `single_approval`), `DocumentApprovalParticipant`, `DocumentApprovalDecision`, `DocumentApprovalRequest`, `DocumentApprovalAuditAction` + entry.
    - `participants[].required` flag drives quorum arithmetic; optional reviewers may record decisions for visibility but don't block approval.
- New `documentApprovalRegistryDao.ts`: in-memory approval + audit stores keyed by `(organizationId, approvalId)`, failure-tolerant API, Postgres-ready signatures so the wave5 migration is mechanical.
- New `documentApprovalService.ts`:
    - `DocumentApprovalError` taxonomy: `invalid_input`, `approval_not_found`, `approval_already_open`, `approval_already_resolved`, `reviewer_not_participant`, `decision_already_recorded`, `forbidden`.
    - `requestDocumentApproval` enforces single non-terminal approval per `(org, artifact)` (duplicate-open guard via `approval_already_open`), normalizes participants (trim, dedupe, drop empties, default required=true), requires at least one required participant. Default policy is `'unanimous'`.
    - `recordApprovalDecision` is append-only, rejects duplicate reviewer decisions and decisions from non-participants, auto-resolves on quorum or terminal-flipping verdicts. **Resolution algorithm** (`evaluateApprovalResolution`, exported as a pure helper):
        - any reviewer (required OR optional) `'request_changes'` → `'changes_requested'`;
        - any **required** reviewer `'reject'` → `'rejected'`;
        - then per-policy: `'unanimous'` → all required must approve · `'majority'` → strictly more than half of required must approve · `'single_approval'` → first required approve resolves;
        - zero-required edge case resolves immediately to `'approved'` (notification-style).
    - `cancelApproval`: only the original requester may withdraw; resolved approvals throw `approval_already_resolved`.
    - Reads: `getApproval`, `getActiveApprovalForArtifact` (used by routes / future lifecycle gating), `listDocumentApprovals` (status?, artifactId?), `listDocumentApprovalAuditEntries`. `ensureApprovalRegistryHydrated(org, artifactId)` is idempotent per pair.
- New `documentApprovalService.test.ts` (33 specs): isTerminal helper, full quorum matrix (7 specs covering unanimous / majority / single_approval lifecycles + required-reject + request_changes + optional-reject + zero-required), request flow (6: normalization, empty-list rejected, no-required rejected, duplicate-open guard, post-resolution re-open allowed, parallel artifacts allowed, write-through), record-decision flow (8: pending under unanimous, auto-resolve under each quorum, reject + request_changes precedence, comment trimming, three guards, unsupported kind), cancel (3), reads + tenant isolation (3), hydration (1), audit trail with full lifecycle action codes (2).

### 6.12.2 Slice 10.2 — Reusable Content Block library (commit `07e671c6f`)

- Additive type extensions on `documentStudioTypes.ts`:
    - `DocumentContentBlockStatus` (`draft` / `active` / `archived`), `DocumentContentBlockTemplate` (the library entry — wraps a payload-only `Omit<DocumentBlock, 'blockId'>` plus name / description / tags / documentTypes / languageScope / version / lifecycle stamps), `DocumentContentBlockDraftInput`, `DocumentContentBlockUpdateInput`, `DocumentContentBlockAuditAction` + entry.
    - `documentTypes` empty array → applicable to all 22 document types; `languageScope: 'pl' | 'en' | 'all'` matches list filters where `'all'` always matches.
- New `documentContentBlockRegistryDao.ts`: in-memory block + audit stores keyed by `(organizationId, contentBlockId)`, identical contract to the approval DAO.
- New `documentContentBlockService.ts`:
    - `DocumentContentBlockError` taxonomy: `invalid_input`, `content_block_not_found`, `content_block_archived`, `content_block_already_active`, `content_block_already_archived`, `forbidden`.
    - Lifecycle: `draft → active → archived`. **Multiple actives ALLOWED per organization** (different snippets serve different purposes; explicitly diverges from the brand-voice single-active rule).
    - `draftDocumentContentBlock`: normalizes name (trim), tags (trim + case-insensitive dedupe), documentTypes (trim + dedupe), defaults `languageScope='all'`. Validates the embedded `DocumentBlock.type` against the canonical whitelist (heading / paragraph / bullet_list / numbered_list / table / callout / quote / kpi_strip / risk_table / image / footnote / citation).
    - `updateDocumentContentBlock`: bumps version (`v1 → v2 → …`), supports null-clearing of description / notes, rejects archived entries, re-validates the payload when `block` is supplied.
    - `activateDocumentContentBlock` / `archiveDocumentContentBlock`: idempotency guards via `content_block_already_active` / `content_block_already_archived`; archiving stamps reason in audit details.
    - List filters: `status`, `includeArchived`, `documentType` (untargeted entries match), `language` (`'all'` matches), `anyTag` (case-insensitive OR semantics).
    - **`instantiateDocumentContentBlock`** is the integration seam. Deep-clones the payload, allocates a fresh `blockId` (or accepts an explicit override), refuses archived entries, returns `{ block, template }`. Consultant clicks "Insert from library" → frontend calls the route → server returns a fresh `DocumentBlock` ready to push onto a section's `blocks` array.
    - `ensureContentBlockRegistryHydrated(organizationId)` idempotent per org.
- New `documentContentBlockService.test.ts` (25 specs): draft (5: normalization, default languageScope, invalid inputs, unsupported block type, write-through), update (5: version bump, null-clearing, archived blocked, not-found guard, payload re-validation), activate / archive (4: stamps, multiple actives, already-active idempotency, re-archive blocked), list filters (4: includeArchived behavior, documentType, language, anyTag with OR + case-insensitive), instantiate (4: fresh blockId + deep-clone isolation, blockId override, archived refused, not-found guard), tenant isolation + hydration (2), full-lifecycle audit (1).

### 6.12.3 Slice 10.3 — Routes (commit `e8ee36ce1`)

- 15 new endpoints under `/api/document-studio`:
    - **Approval workflow** (7 endpoints, scoped under `/:artifactId/approvals/...` and registered before the generic `/:artifactId` GET so the path matcher reaches them first):
        - `GET /:artifactId/approvals` (status?), `POST /:artifactId/approvals` (body: `{ participants[], quorumPolicy?, reason? }` → 201 with `{ approval }`),
        - `GET /:artifactId/approvals/active` (current non-terminal approval or 204 No Content),
        - `GET /:artifactId/approvals/:approvalId` (404 if not found OR artifactId mismatch — defensive cross-artifact denial),
        - `POST /:artifactId/approvals/:approvalId/decisions` (body: `{ kind, comment? }`; reviewerId is the authenticated user → 201 with `{ approval }`),
        - `POST /:artifactId/approvals/:approvalId/cancel` (body: `{ reason? }`; only the original requester may cancel → 403 forbidden),
        - `GET /:artifactId/approvals/:approvalId/audit`.
    - **Content block library** (8 endpoints, top-level under `/content-blocks` so they do not collide with `/:artifactId`):
        - `GET /content-blocks` (status?, includeArchived?, documentType?, language?, anyTag?), `POST /content-blocks` (400 invalid_input if block payload missing), `GET /content-blocks/:contentBlockId`, `PATCH /content-blocks/:contentBlockId` (400 if block payload supplied but invalid), `POST /content-blocks/:contentBlockId/activate`, `POST /content-blocks/:contentBlockId/archive` (body: `{ reason? }`), `POST /content-blocks/:contentBlockId/instantiate` (body: `{ blockId? }` → returns `{ block, template }`), `GET /content-blocks/:contentBlockId/audit`.
- HTTP error mapping (`mapApprovalErrorToStatus`, `mapContentBlockErrorToStatus`): 400 invalid_input · 403 forbidden / reviewer_not_participant · 404 approval_not_found / content_block_not_found · 409 approval_already_open / approval_already_resolved / decision_already_recorded / content_block_archived / content_block_already_active / content_block_already_archived.
- Defensive body parsing: `parseApprovalParticipants` (drops invalid entries, defaults required=true), `parseContentBlockLanguageScope`, `parseDocumentTypeArray`, `parseDocumentBlockPayload`. All reads/writes call the appropriate `ensureXHydrated` hook before touching state, identical to the E5 / E6 / E9 pattern.
- Following the E5 / E6 / E7 / E9 pattern, route-level integration tests are intentionally not added — the data plane is fully covered at the service layer (E10.1: 33 specs, E10.2: 25 specs) and the error-code → HTTP-status switch is a trivial mapper.

### 6.12.4 Validation summary

- Document Studio scope: **47 files / 526 specs**, all green (was 45 / 468 at end of Epic E9; +2 files / +58 specs from E10).
- `npx tsc --noEmit -p .` clean across the full server tsconfig.
- `npx eslint --fix` clean for the new modules + tests; only pre-existing-pattern `any`-coercion warnings inside `getAuthContext` survive (matching the E5 / E6 / E7 / E8 / E9 baseline).
- Backward-compatible additive types: pre-E10 schemas / route surface continue to function unchanged. Lifecycle service in `documentLifecycleService.ts` is intentionally NOT gated on approval state in this epic — the route layer can introduce a soft gate later by checking `getActiveApprovalForArtifact` before transitioning `in_review → approved`, but enabling the gate is a policy-decision rollout (Phase 1: observe; Phase 2: enforce) that lives outside the data-plane epic.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - **Lifecycle gating integration**. `getActiveApprovalForArtifact` is the integration seam, but the actual hard-stop (refuse `transitionDocumentStatus(... to: 'approved')` when no resolved approval exists) is gated behind an explicit policy switch and a per-tenant feature flag. Lands when the V8 publish-review service exposes its policy hook.
    - **System-default content block seeds**. The library is fully tenant-scoped today; future slices may ship a small set of `'system'`-org seeds (universal compliance disclaimer, standard methodology preamble) overlaid into reads à la audience profiles. Plumbing supports it (the DAO key prefix already isolates `'system'` from tenant rows); content not yet authored.
    - **Multi-user concurrent edit detection**. The MVP-5 charter calls out collaboration on the same schema; today the version-snapshot + rollback infrastructure (Epic E5) covers conflict detection but not real-time presence. Real-time presence requires the V8.1 substrate, which the Document Studio MUST NOT modify per §9 of this plan.
    - **Frontend Approval Center + Library picker**. Server-only today; the consultant UI surface (Menu 3 right-side action: "Request approval…", "Insert from library…") + Reviewer Inbox view are owned by Epic E11.
    - **Persistence migration**. Both DAOs (approvals + content blocks + audits) sit on the in-memory store consistent with the rest of MVP-2..MVP-5; the wave5 Postgres migration is shared infrastructure landing across all Document Studio modules at once.

---

## 6.13 Epic E11 — Execution-module UI/UX standard (Doc 3-strefa + Deck collapse + Teresa-only)

Epic E11 turns the SSOT-codified "Standard Modułów Wykonawczych (Doc / Excel / Deck Builder)" from `DRD/UI_UX_SOURCE_OF_TRUTH.md` (lines 249-304) into a machine-readable contract + validator + reference catalogue + governance API. The Markdown SSOT remains the human-canonical source — the codification work in E11 is a derived projection that:

1. encodes every dimension of the standard (3-zone layout · Menu 2 chip canonical order · right-panel collapse contract · Teresa-only agent constraint · Menu 3 AI actions placement) as frozen TypeScript constants;
2. exposes a pure validator (`validateExecutionModuleManifest`) that consumes a per-module manifest and returns a structured `{ ok, mustViolations, shouldViolations }` envelope with stable `ruleId`s so CI / governance gates can pin known-deferred violations without losing audit signal;
3. ships three frozen reference manifests (`doc-builder`, `deck-builder`, `excel-builder`) modeling the canonical implementations the SSOT describes — every reference manifest validates clean (zero must + zero should violations);
4. surfaces the canonical standard + manifest catalogue + the validator over HTTP via a thin read-only governance API so the frontend, governance docs, and CI pipelines can all consume one source of truth.

### 6.13.1 Slice 11.1 — Standard codification (commit `1e5fe1792`)

- New `services/executionModuleStandard/` folder.
- New `executionModuleStandardTypes.ts` declares the full type surface:
    - `ExecutionModuleId`, `ExecutionModuleZoneId` (`'leftNav' | 'canvas' | 'rightPanel'`), `ExecutionModuleZoneSpec`.
    - `ExecutionModuleMenu2ChipId` (10-id enum: internal · theme · history · qa · governance · analytics · audit · share · agent · run; MELS-aligned with `src/components/shared/ExecutiveModuleShell/ChipDescriptor.ts`), `ExecutionModuleMenu2CtaLabel` (`'Prezentuj' | 'Eksportuj'`), `ExecutionModuleMenu2ChipDeclaration`.
    - `ExecutionModuleRightPanelCollapseContract` (collapsedWidthPx=32, expandedWidthRangePx 280..360, persistence='per_user_per_module', triggerPosition='top_left_seam', triggerStyle='soft_chevron') + `ExecutionModuleRightPanelDeclaration` (with `parallelPanelsAllowed: false` invariant).
    - `ExecutionModuleAgentDeclaration` (`exposedAgentIds`, `teresaSurface: popover|drawer|side_panel`, `contextAwareOn: section|slide|sheet|block`).
    - `ExecutionModuleAiActionsDeclaration` (`slot: commandRowRightContent | DynamicTabs.rightContent | localCommandRowRight | pending_migration`, `actionIds[]`, `duplicatedInCanvas` invariant).
    - Composite `ExecutionModuleManifest` + validation envelope (`ExecutionModuleViolation` with stable `ruleId` + severity must|should + dimension layout|menu2|rightPanel|agent|aiActions, `ExecutionModuleValidationResult`).
- New `executionModuleStandard.ts` exports:
    - Frozen canonical constants: `EXECUTION_MODULE_ZONE_ORDER`, `EXECUTION_MODULE_ZONES` (with per-zone responsibility + constraint list), `EXECUTION_MODULE_MENU2_CHIP_ORDER`, `EXECUTION_MODULE_CTA_LABELS`, `EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT`, `EXECUTION_MODULE_ALLOWED_AGENT_IDS=['teresa']`, `EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS`.
    - `validateExecutionModuleManifest(manifest)` — pure validator with five per-dimension validators and stable rule ids: `manifest_invalid`, `layout_zone_count`, `layout_zone_order`, `menu2_unknown_chip`, `menu2_chip_duplicate`, `menu2_chip_order`, `menu2_cta_label_missing`, `menu2_chip_hidden` (soft), `right_panel_missing` + `right_panel_collapse_trigger_position` + `right_panel_collapse_trigger_style` + `right_panel_collapsed_width` + `right_panel_expanded_width_range` + `right_panel_persistence` + `right_panel_parallel_disallowed`, `agent_missing` + `agent_empty` + `agent_disallowed` + `agent_teresa_required` + `agent_surface_invalid`, `ai_actions_missing` + `ai_actions_slot_invalid` + `ai_actions_slot_pending_unjustified` + `ai_actions_slot_pending_migration` (soft) + `ai_actions_duplicated_in_canvas` + `ai_actions_invalid_id` + `ai_actions_duplicate_id`.
    - `validateAllManifests(manifests)` — aggregate envelope; `ok=true` only when every manifest is `ok`. Used by CI for catalogue conformance.
    - `makeViolation` exported as a test helper.
- 30 specs in `executionModuleStandard.test.ts`: canonical constants (6) — zone order, chip order, collapse contract, Teresa-only allowed agents, allowed AI slots, frozen invariants. Happy path (2). Layout (2). Menu 2 (5). Right panel (2). Agent (5). AI actions (6). validateAllManifests (2).

### 6.13.2 Slice 11.2 — Reference manifests (manifests in commit `62420b17b`, attribution + lint touchups in `07040f370`)

- Three frozen, system-owned reference manifests in `executionModuleStandardManifests.ts`:
    - **`DECK_BUILDER_MANIFEST`** — the canonical reference module the SSOT was originally extracted from. Slide-unit canvas, primary CTA `'Prezentuj'`, `contextAwareOn: 'slide'`. AI actions: `ai.regenerate_slide` / `ai.apply_layout` / `ai.refine_speaker_notes` / `ai.run_qa`.
    - **`DOC_BUILDER_MANIFEST`** — Document Studio's consultant-facing UI; section-unit canvas, primary CTA `'Eksportuj'` (Markdown / DOCX / PDF), `contextAwareOn: 'section'`. AI actions cover the full E1..E10 surface: `ai.refine_section`, `ai.run_qa`, `ai.suggest_brand_voice`, `ai.render_audience_variant`, `ai.request_approval`, `ai.insert_from_library`.
    - **`EXCEL_BUILDER_MANIFEST`** — sheet-unit canvas, primary CTA `'Eksportuj'` (XLSX / CSV), `contextAwareOn: 'sheet'`. AI actions: `ai.summarize_sheet`, `ai.suggest_formula`, `ai.detect_anomalies`, `ai.run_qa`.
- All three share the canonical right-panel collapse contract (`top_left_seam` / `soft_chevron` / 32px collapsed / 280..360 expanded / `per_user_per_module` persistence / `parallelPanelsAllowed=false`), declare every canonical Menu 2 chip as `present` (cta label is module-local copy), expose Teresa as the single chat agent in a drawer surface, and mount AI actions on `commandRowRightContent` with `duplicatedInCanvas=false`.
- Registry helpers: `SYSTEM_EXECUTION_MODULE_MANIFESTS` (frozen array), `getSystemExecutionModuleManifest(moduleId)` (returns `null` for unknown ids), `isSystemExecutionModuleId(moduleId)`.
- 15 conformance specs in `executionModuleStandardManifests.test.ts`: structural identity per module (CTA + unit + drawer + 10 chips + collapse contract + AI slot + freeze, 6 specs), validator-clean conformance per manifest (parametrized via `it.each`, 2 specs covering zero-must + zero-should violations and `validateAllManifests` over the registry), registry helpers round-trip + null-on-unknown + thin-id-check (4 specs). Frozen invariants for all three manifests.
- **Attribution caveat (audit-trail honesty):** the two manifest files (`executionModuleStandardManifests.ts` + the matching test) were authored as part of E11.2 but were mistakenly bundled into a parallel `chore(tabele): C-S0 preflight` commit (`62420b17b`) by a concurrent workflow that ran `git add .` from a different working directory at 21:08:08 UTC+2 — 4 seconds after the E11.1 commit landed. The file content is correct; only the commit attribution is wrong. The follow-up commit `07040f370` documents this for the audit trail and ships the residual ESLint trailing-comma normalisation that the lint pass produced while validating E11.2.

### 6.13.3 Slice 11.3 — Routes (commit `4f991954a`)

- New `server/src/routes/execution-modules.routes.ts` ships 4 read-only governance endpoints, mounted under `/api/execution-modules` adjacent to `/api/document-studio` in `Gateway.ts`:
    - `GET  /api/execution-modules/standard` — returns the canonical standard envelope: `{ zones, zoneOrder, menu2ChipOrder, ctaLabels, rightPanelCollapseContract, allowedAgentIds, allowedAiActionSlots }`. Used by the frontend to render governance docs / settings panels off the same source the validator consumes.
    - `GET  /api/execution-modules/manifests` — `{ manifests: ExecutionModuleManifest[] }` with the three system-owned reference modules.
    - `GET  /api/execution-modules/manifests/:moduleId` — single reference manifest; 404 `module_not_found` on unknown id.
    - `POST /api/execution-modules/manifests/:moduleId/validate` — body is a candidate `ExecutionModuleManifest`; returns `{ result: ExecutionModuleValidationResult }`. The route forces `moduleId` from the URL path to override any payload value so the audit envelope stays consistent. Pure governance gate — no caching, no persistence; CI / pre-release UI panels can call this on every push.
- All four endpoints sit behind `verifyToken` via `router.use()` plus a `requireAuthContext()` defensive 401 guard so an upstream misconfiguration does not let an anonymous request through. The standard / manifests / validation surface is governance metadata with no tenant boundary (the standard is the same for every tenant), so no tenant-scoping is applied beyond authentication.
- Following the E5 / E6 / E7 / E9 / E10 pattern, route-level integration tests are intentionally not added — the data plane is fully covered at the service layer (E11.1: 30 specs, E11.2: 15 specs) and the routes are thin wrappers that surface the validator result envelope directly.

### 6.13.4 Validation summary

- Document Studio + Execution-module-standard scope: **49 vitest files / 571 specs** green (was 47 / 526 at end of Epic E10; +2 files / +45 specs from E11).
- `npx tsc --noEmit -p .` clean for the execution-module-standard surface (services + routes + Gateway wiring). Pre-existing tsc errors in `src/services/tablePlatform/AiUsageService.ts` (3 errors, lines 287-289, `last_reset_at` on `{}`) are out of scope — they are owned by the parallel "tabele" workflow and predate this epic.
- ESLint clean for every new file. The same pre-existing baseline warnings as E10 (`no-useless-escape` in `documentQaService.ts:1548` from Recovery Sprint 6 §6.5; non-null-assertion `!` warnings on test fixtures matching the E5..E10 baseline) remain.
- **Deferred to follow-up slices** (intentional, called out so they do not get re-discovered as gaps):
    - **Frontend Document Studio surface itself.** This epic codifies the contract any execution-module React surface MUST satisfy and ships the validator any pre-release CI gate can call. Building the actual React surface against the existing E1..E10 server APIs (Menu 2 chip row + 3-zone layout + right-panel collapse + Teresa drawer + Menu 3 AI actions for `ai.refine_section` / `ai.run_qa` / `ai.suggest_brand_voice` / `ai.render_audience_variant` / `ai.request_approval` / `ai.insert_from_library`) is a separate frontend-track epic that consumes this manifest to drive its layout decisions.
    - **CI gate wiring.** `validateAllManifests(SYSTEM_EXECUTION_MODULE_MANIFESTS)` is the canonical CI hook; integrating it into the actual pre-release pipeline (fail the build when `ok=false`, post the violation envelope to a release-readiness dashboard) is shared infrastructure landing alongside the wave5 release-gating work.
    - **Tenant-custom manifests.** Today only the three system-owned reference manifests ship. A future slice may add a tenant-scoped registry (mirroring brand-voice / audience-profile DAOs from E7 / E9) so a tenant can declare that its custom Excel surface intentionally hides specific chips; the validator would then surface those as `should` violations rather than `must`.
    - **`pending_migration` slot governance.** The escape-hatch slot is wired in the validator but no module currently uses it. When a legacy module needs a temporary migration runway, the SSOT update + the manifest update happen together; the validator already enforces that `slotJustification` is required.
    - **Persistence.** The three reference manifests + the standard are shipped as in-process frozen constants (the right shape for system-owned canonical data). When tenant manifests arrive, they land on the same DAO + write-through pattern as E7 / E9 / E10 and the wave5 Postgres migration covers them in lockstep.

This closes Epic E11 and the full V1 Document Studio implementation plan.

### 6.13.5 Slice 11.5 — MELS chip-id reconciliation (post-closeout follow-up)

Discovered during the FE-E1 reconnaissance: the production frontend ships a shared `ExecutiveModuleShell` (MELS) under `src/components/shared/ExecutiveModuleShell/` that already implements the 3-zone shell + 10-chip canonical row + collapse contract + keyboard shortcuts. The MELS chip ids are English-canonical (`internal · theme · history · qa · governance · analytics · audit · share · agent · run`) and Tabele consumes them via `TabeleTopBarChips.tsx` already.

The Slice 11.1 codification mistakenly introduced Polish-phonetic ids (`motyw · udostepnij · cta_primary`) that diverged from MELS naming. Both encodings refer to the same SSOT line 265 (`Internal · Motyw · History · QA · Governance · Analytics · Audit · Udostępnij · Agent · Prezentuj/Eksportuj`) — the SSOT specifies *display labels*, not ids — but parallel naming would have forced a frontend adapter at the boundary.

Slice 11.5 reconciles the manifest ids to MELS naming so the FE wiring stays adapter-free:

- `ExecutionModuleMenu2ChipId` enum: `motyw → theme`, `udostepnij → share`, `cta_primary → run`.
- `EXECUTION_MODULE_MENU2_CHIP_ORDER` constant updated.
- All three reference manifests (doc / deck / excel) re-emit chip ids in MELS order.
- Validator's `menu2_cta_label_missing` rule now references `run` instead of `cta_primary` (rule id stable; only the message copy changed).
- All 45 specs in the executionModuleStandard suite re-validated post-rename — green.
- Per-module `label` and `ctaLabel` (`Prezentuj` / `Eksportuj`) continue to carry the Polish display copy, so the SSOT-mandated user-visible labels are preserved.

The reconciliation is internal-API only (the manifests are not yet consumed by any external client) and the change is a pure rename; no business behaviour shifted.

---

## 6.14 Frontend Document Studio epic family (FE-E1..FE-E5) — kickoff

The server-side Epic E11 + reconciliation E11.5 unblock a Frontend Document Studio epic family that brings the consultant-facing UI under `src/components/DocumentStudio/` into compliance with `DOC_BUILDER_MANIFEST` and adds the deferred frontend surfaces from E5..E10.

Epic outline (each epic ~3-5 slices):

- **FE-E1** — Manifest loader + 3-zone shell + Menu 2 chips + collapse contract. New `DocumentStudioWorkspace` consumes the existing shared `ExecutiveModuleShell` (MELS) under `src/components/shared/ExecutiveModuleShell/` and replaces the flat `DocumentStudioDocumentPanel` for the `document` phase. Right-panel collapse uses the existing `useRailState` (already MELS-canonical: 32px collapsed, 280..360 expanded, localStorage persistence per `mels.rail.{moduleKey}`).
- **FE-E2** — Right panel tabs MVP: Sources / Properties / QA. Reuses existing `DocumentStudioQaPanel`.
- **FE-E3** — Menu 2 chip wiring (History / Governance / Audit / Theme/Brand-voice). Consumes existing endpoints from E5 (snapshots + rollback + status transitions), audit events, and E7 (brand voice picker).
- **FE-E4** — Comments + Approvals + Library (E6 + E10 surfaces). Block-level comment markers in canvas, right-panel Comments + Approvals tabs, Reviewer Inbox view at `/document-studio/inbox`.
- **FE-E5** — Audience Variant picker + Teresa drawer + closeout. Menu 3 `ai.render_audience_variant` action (E9), Teresa-only chat drawer, final manifest conformance check via `POST /api/execution-modules/manifests/doc-builder/validate`.

### 6.14.1 Slice FE-E1.1 — Manifest loader hook + API client (commit `8967420fc`, mis-attributed)

- New `src/services/executionModuleStandard/`:
    - `types.ts` — frontend mirror of the server-side `executionModuleStandardTypes.ts` (the monorepo does not currently expose a shared types package). Mirrors every type the manifest surface needs: `ExecutionModuleManifest`, `ExecutionModuleStandard` envelope, `ExecutionModuleValidationResult`, plus the chip / right-panel / agent / AI-actions sub-types. MELS-aligned chip ids.
    - `api.ts` — fetch wrappers around the four governance endpoints from Slice E11.3: `fetchExecutionModuleStandard`, `fetchExecutionModuleManifests`, `fetchExecutionModuleManifest(moduleId)` (throws `ExecutionModuleNotFoundError` on 404 with the moduleId attached), `validateExecutionModuleManifest(moduleId, candidate)`. All four reuse the shared `baseClient` retry / auth / response-handling.
    - `useExecutionModuleManifest.ts` — React hook returning `{ manifest, isLoading, error, refetch }`. Module-level cache keyed by moduleId so subsequent mounts of the same id are served from cache. `forceRefetch` + `refetch()` bypass the cache. `abortOnUnmount=true` cancels state updates when the fetch resolves after unmount. 404 sets `error` to `ExecutionModuleNotFoundError` and leaves `manifest=null` so consumers render a graceful empty state instead of crashing.
- 13 frontend specs in `__tests__/useExecutionModuleManifest.test.tsx` (`@vitest-environment jsdom`):
    - API client (6): standard / manifests / manifest happy paths, 404 throws `ExecutionModuleNotFoundError` with the moduleId, validate returns the result envelope, `encodeURIComponent` on moduleId path segments.
    - Hook (7): first mount triggers fetch + resolves; cache hit on second mount; `forceRefetch=true` bypasses cache; `refetch()` bypasses cache; 404 → `ExecutionModuleNotFoundError` + `manifest` stays null; other errors set `error` + `manifest` stays null; unmount cancels in-flight state updates.
- Validation: 13 frontend specs green; 58 specs total across the 3 `executionModuleStandard` test files (45 server + 13 frontend); ESLint clean for the new modules; `tsc --noEmit` clean for the new modules.

**Attribution caveat (third occurrence of the parallel sync agent issue):** the four FE-E1.1 files (`types.ts`, `api.ts`, `useExecutionModuleManifest.ts`, `__tests__/useExecutionModuleManifest.test.tsx`) were authored as Slice FE-E1.1 but were mistakenly bundled into the parallel `feat(presentation-studio,s2)` commit `8967420fc` by a concurrent workflow that ran `git add .` from a different working directory. Earlier in the session the same kind of mis-attribution affected:
- E11.2 manifest files → bundled into `chore(tabele): C-S0 preflight` commit `62420b17b`;
- mid FE-E1.1 the parallel agent transiently deleted the `__tests__/` folder between the lint pass and the next test run (re-created and the test file re-written verbatim before commit, no data loss).

The file content in `8967420fc` is correct (verified via `git show`); only the commit attribution is wrong. FE-E1 work is paused after FE-E1.1 until the parallel-sync coordination issue is resolved at the workspace level (e.g. dedicated worktrees per agent, or a lockfile around `git add .`).

---

## 6.15 Backend gap-closing slices (post-FE pause) — E3.5 → E3.6 → E5.6 → E14

While the frontend work is parked on the parallel-sync coordination issue, the backend track keeps moving. Source-of-truth driver: `CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md` §10 (Top-10 gaps) and §16 (recommended backlog). Sequence is chosen for highest impact / lowest blast-radius — every slice is BE-only and touches files that do not collide with the active parallel agents (presentation-studio, table-platform).

### 6.15.1 Slice E3.5 — Methodology + Source editor HTTP routes (5-scope doctrine closure)

**Why.** SSOT §6 mandates a 5-scope edit doctrine (`local / section / global / methodology / source`). The methodology + source services have existed since slices E3.1 + E3.2 (`createMethodologyEditProposal`, `createSourceEditProposal` in `documentStudioService.ts`) but were never exposed over HTTP. As a result the Teresa intent classifier's methodology / source branches could not be invoked end-to-end and the frontend `DocumentEditorScope` union was capped at 3 values. Slice E3.5 closes the doctrine breach.

**Scope.**

- `server/src/routes/document-studio.routes.ts` — add `POST /:artifactId/editor/proposals/methodology` and `POST /:artifactId/editor/proposals/source` mirroring the existing `/local`, `/section`, `/global` route shape: `instruction: string` + optional `useLlm: boolean`, returns `{ proposal: DocumentEditorProposal }`.
- Error mapping:
    - `artifact_not_found` → 404.
    - `instruction is required` → 400.
    - `no_methodology_sections` (methodology only) → 400 (artifact exists but no methodology-aligned section is surfaced; UI surfaces a remediation hint).
    - `no_source_anchored_blocks` (source only) → 400 (artifact exists but no block carries a `sourceRef`; UI surfaces an "attach sources" remediation hint).
- `src/components/DocumentStudio/types.ts` — widen `DocumentEditorScope` from `'local' | 'section' | 'global'` to also include `'methodology' | 'source'`. The 6th scope (`'transformative'`) lands in slice E3.6.
- `src/components/DocumentStudio/api.ts` — add `createDocumentStudioMethodologyProposal(artifactId, { instruction }, options)` and `createDocumentStudioSourceProposal(artifactId, { instruction }, options)` mirroring the existing `createDocumentStudioGlobalProposal` shape.
- `src/components/DocumentStudio/DocumentStudioEditorPanel.tsx` — defensively handle the widened union. The manual editor panel still exposes only the 3 chips (`local`, `section`, `global`) — methodology + source UI lands in FE-E2/E3. The `else` fall-through to `createDocumentStudioGlobalProposal` is replaced with an explicit `else if (scope === 'global')` + a guarded `else` that throws `documentStudio.editor.unsupportedScope`, so a stray scope value cannot silently be re-routed to global semantics.

**Coverage.** Service-level coverage already exists from slices E3.1 (`documentStudioEditorMethodologyScope.test.ts`, 5 specs) + E3.2 (`documentStudioEditorSourceScope.test.ts`, 5 specs). Route-level integration tests follow the existing pattern from E5/E6/E7/E8/E9/E10 routes (no per-route integration tests; service-level coverage + tsc + lint).

**Validation.** Document Studio + Execution Module Standard suite **571/571 green**; tsc clean for `documentStudio` + `executionModuleStandard` scope (pre-existing tablePlatform errors are out of scope); ESLint clean for the modified files (pre-existing warnings on legacy `any` usage in unrelated route handlers untouched).

**Closes gaps.** §10.1 of the gap-vs-target report (5-scope HTTP exposure) — DONE. The 6-scope (`transformative`) closure is delegated to slice E3.6.

---

### 6.15.2 Slice E3.6 — Transformative scope (6th poziom edycji, SSOT 6-scope doctrine closure)

**Why.** SSOT §6 mandates a 6-scope edit doctrine ending with `transformative`: an explicitly user-authorized "rebuild from scratch" mode. Until E3.6, the editor stack only supported 5 scopes; users who asked Teresa to "completely rewrite" or "przepisz od nowa" silently fell through to `global`, which preserves the existing structure and only refines prose. This slice adds the 6th scope end-to-end: types, refiner, service, intent classifier, HTTP route, FE types + API client, tests.

**Refiner contract.** Adds `'transformative'` to `EditorRefinerScope`. The system prompt header explicitly authorizes the model to merge / split paragraphs, shift register fundamentally, expand stub bullets into prose, or compress prose into bullets. The model is still bound by the absolute safety net (non-empty + 4× growth + 4000 char absolute cap) and by an anti-fabrication clause ("MUST NOT fabricate new factual claims, KPIs, sources, citations, dates, currencies or proper names that were not in the original"). NO source-preservation guard runs — the user has consciously authorized a rebuild.

**Service.** New `createTransformativeEditProposal(params)` mirrors the global-scope service shape but tags the audit envelope with `details.authority = 'user_explicit_rebuild'` so reviewers can filter for elevated-authority proposals when triaging. Errors: `instruction is required` (400), `artifact_not_found` (404), `document_has_no_sections` (400). Approval / execution / audit flow is unchanged.

**Intent classifier.** New `TRANSFORMATIVE_PHRASES` lexicon (PL+EN, ~45 phrases). Promoted to **highest precedence** in `detectTeresaEditorIntent` — outranks `source` / `methodology` / `global` because explicit rebuild signals trump every other intent. Lexicon is intentionally narrow ("from scratch", "from the ground up", "completely rewrite", "rebuild", "przepisz od nowa", "przebuduj") so garden-variety phrases like "rewrite this paragraph" stay LOCAL and "tighten language across the document" stays GLOBAL. The new `TERESA_INTENT_LEXICONS.transformative` is exposed for tests + future i18n.

**HTTP.** `POST /api/document-studio/:artifactId/editor/proposals/transformative` mirrors the existing `/global` route shape. Single new endpoint.

**Frontend.** `DocumentEditorScope` widened from 5 → 6 values (`'local' | 'section' | 'global' | 'methodology' | 'source' | 'transformative'`). New API client wrapper `createDocumentStudioTransformativeProposal(artifactId, { instruction }, options)` mirrors the existing global wrapper. The defensive `else { throw }` already added in slice E3.5's `DocumentStudioEditorPanel` still prevents stray scope values from re-routing to global semantics — `transformative` cannot be triggered from the manual editor panel today (only via Teresa or programmatically), which is intentional: the rebuild intent should require explicit user confirmation; the proper UI affordance lands in FE-E5 (Teresa drawer).

**Coverage.**
- `documentEditorRefinerScopes.test.ts`: +3 specs (TRANSFORMATIVE prompt header propagated, no source-preservation guard runs under transformative, 4× growth absolute safety still enforced).
- `documentTeresaIntent.test.ts`: +6 specs (transformative beats source/methodology/global in PL+EN, narrow-lexicon discipline: "rewrite this paragraph" stays local, "transform passive sentences" stays global).
- `documentStudioEditorTransformativeScope.test.ts` (new): 5 specs (empty-instruction reject, artifact-not-found reject, no-sections reject, all-sections target, audit `authority: 'user_explicit_rebuild'` tag).

**Validation.** Document Studio + Execution Module Standard suite **585/585 green** (+14 from E3.6). tsc clean for documentStudio + executionModuleStandard scope (pre-existing tablePlatform errors out of scope). ESLint clean for the modified files.

**Closes gaps.** §10.2 of the gap-vs-target report (6-scope `transformative` closure) — DONE. SSOT 6-scope edit doctrine is now fully delivered end-to-end.

---

### 6.15.3 Slice E5.6 — Source-version pinning on `DocumentSourceRef` (NFR-17 substrate)

**Why.** NFR-17 requires that an approval-gated render flow can distinguish between "source v3 at generation time" and "source v5 at render time". Without version pinning, a document could be approved against a snapshot of the underlying transcript / source pack and then silently re-render against a mutated source, drifting the meaning of approved content. The data substrate to detect that drift was missing on `DocumentSourceRef`.

**Scope (substrate-only, no behavior change).**
- `documentStudioTypes.ts` — extend `DocumentSourceRef` with two backwards-compatible optional fields:
    - `sourceVersion?: string` — semantic version / hash / monotonic id of the source as it existed when the document was generated.
    - `sourceSnapshotId?: string` — pointer to a durable snapshot (e.g. a `SourcePackVersion` id, content hash, or artifact registry pin) so the document can be rolled back / re-rendered against the exact bytes the author saw, even after the live source mutates / archives / deletes.
- `documentSourceRefHasVersionPin(ref)` helper codifies the contract used by the renderer + audit pipeline: a ref is pinned iff EITHER `sourceVersion` OR `sourceSnapshotId` carries a non-empty trimmed string. Whitespace-only values (`"   "`) are NOT pinned — callers cannot bypass the contract by writing junk.
- `src/components/DocumentStudio/types.ts` — frontend mirror; same two optional fields added with an explanatory comment for the FE-E2 right-panel Sources tab.

**Backwards compatibility.** Pre-E5.6 schemas have neither field and are treated as "version unspecified" — the same shape the registry has always produced. Every existing consumer (renderer, QA pipeline, projector, audit emitter) continues to function unchanged. The QA-side warning that surfaces "source drift detected" runs on top of this substrate in a follow-up slice; E5.6 only delivers the type contract so the follow-up has a stable target.

**Coverage.** New `documentSourceRefVersionPin.test.ts` with 10 specs:
- pre-E5.6 ref (no version / snapshot) → unpinned;
- non-empty `sourceVersion` → pinned;
- non-empty `sourceSnapshotId` → pinned;
- both fields populated → pinned;
- whitespace-only `sourceVersion` → unpinned;
- whitespace-only `sourceSnapshotId` → unpinned;
- empty-string both → unpinned;
- `undefined` input → false (no throw);
- `null` input → false (no throw);
- `sourceTitle` is unrelated to pinning.

**Validation.** Document Studio + Execution Module Standard suite **595/595 green** (+10 from E5.6). tsc clean for documentStudio + executionModuleStandard scope. ESLint clean for the modified files.

**Closes gaps.** §10.8 of the gap-vs-target report (NFR-17 source-version pinning) — substrate DELIVERED. The QA-side "drift detected" warning + UI affordance ("render against pinned snapshot") are scheduled as a follow-up on top of this substrate.

---

### 6.15.4 Slice E14 — Template registry product fields (FR-06 substrate)

**Why.** FR-06 ("discover the right template") requires registry-side signal that drives sort order + visibility in the FE-E2 template picker. The recommender needs:
- usage telemetry (how often is this template applied?),
- quality aggregate (what consultant rating did its outputs receive?),
- classification tags (persona / region / brand / dependency) so the recommender can scope templates to the active context (audience profile, tenant region, organization industry, source-pack contents).

Until E14, the registry only carried structural metadata (category, status, blueprint, formatting). Recommendation surfaces had nothing to anchor on.

**Substrate-only scope (no DB migration in this slice).** The DAO / migration that persists these fields across process restarts is delegated to a follow-up slice (`E14.persistence`) — keeping this slice substrate-only avoids file collisions with parallel agents currently active in the DAO layer.

- `documentStudioTypes.ts` — extend `DocumentTemplate` with **8** backwards-compatible optional product fields:
    - `usageCount?: number`
    - `lastUsedAt?: string`
    - `feedbackQualityScore?: number` (running 1..5 average)
    - `feedbackSampleSize?: number` (number of ratings folded into the average — surfaced in the UI to disambiguate "5.0 from 1 rating" vs. "5.0 from 38 ratings")
    - `personaTags?: string[]`
    - `regionTags?: string[]`
    - `brandTags?: string[]`
    - `dependencyTags?: string[]`
- `TemplateAuditAction` extended with two new actions: `'template_usage_recorded'` + `'template_feedback_recorded'`.
- `documentTemplateService.ts` — two new service helpers:
    - `recordTemplateUsage({ templateId, organizationId, userId, occurredAt?, artifactId? })`: increments `usageCount` (treats `undefined` → 0 → 1 on first call), refreshes `lastUsedAt`, emits a `template_usage_recorded` audit entry with prev/next counts and the optional `artifactId` so the audit trail can drill from registry aggregate to source artifact.
    - `recordTemplateFeedback({ templateId, organizationId, userId, rating, comment?, occurredAt? })`: O(1) running-average update via `nextScore = (prevScore × prevSize + rating) / (prevSize + 1)`. Validates `rating` is a finite integer in `[1..5]`; out-of-range / NaN / non-integer values return `null` without mutating state. Emits a `template_feedback_recorded` audit entry with rating + prev/next aggregates + optional consultant comment.
- `src/components/DocumentStudio/types.ts` — frontend mirror of all 8 optional product fields with explanatory comment for the FE-E2 template picker.

**Backwards compatibility.** Pre-E14 templates omit all 8 fields and are treated as "no signal yet". Existing seeders, hydration, persistence, draft / approve / deprecate flows, and the audit pipeline continue to function unchanged. The DAO does not yet persist the new fields — they survive only for the lifetime of the process; on restart, the running counters reset to `undefined`. The follow-up slice `E14.persistence` adds the migration + DAO writes; FE-E2 wiring waits until persistence lands.

**Coverage.** New `documentTemplateProductFields.test.ts` with 13 specs:
- pre-E14 templates start with all 8 fields `undefined`;
- usage increments from `undefined` → 1 → 2 → 3;
- usage emits audit entry with prev/next counts + `artifactId` propagation;
- usage rejects empty IDs and missing templates;
- feedback first rating: score = rating, sampleSize = 1;
- feedback running average converges across multiple ratings (5, 3, 4 → 4.0);
- feedback emits audit entry with rating + prev/next aggregates + comment;
- feedback rejects out-of-range ratings (0, 6, -1, 1.5, NaN, Infinity);
- feedback rejects empty IDs;
- feedback returns null for unknown template;
- audit-action union accepts both new E14 actions via the test helper.

**Validation.** Document Studio + Execution Module Standard suite **608/608 green** (+13 from E14). tsc clean for documentStudio + executionModuleStandard scope. ESLint clean for the modified files.

**Closes gaps.** §10.6 of the gap-vs-target report (FR-06 closure / template product fields) — SUBSTRATE DELIVERED. DB persistence of the new fields + FE-E2 picker wiring are scheduled as follow-ups on top of this substrate.

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
