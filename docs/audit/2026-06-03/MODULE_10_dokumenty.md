# Module 10 — Dokumenty — Re-Audit (2026-06-03)

**Readiness: 71/100 — Tier: Beta (baseline 52 → 71, Δ +19)**
**One-line verdict:** Four of the five June-02 P0 blockers are resolved — editor state is now DB-persisted, `/document-studio` has a sidebar entry, `/wordy` redirects cleanly, and PDF figure embedding is real — but block-level LLM prose remains opt-in/off-by-default and the sidebar entry is locked on public production (`consultify.ai`) by the same non-core-modules lock that gates all non-Chat/Interview items.

---

## Functionality (real/mock/broken)

**REAL (verified):**
- Artifact persistence: `documentStudioService.ts → createWave5Artifact` → DB (`dbRun`/`dbAll`). `src/components/DocumentStudio/api.ts:41` confirms `/api/document-studio` base.
- Editor-state persistence (NEW): `documentEditorStateRegistryDao.ts` with migration `server/migrations/20260603_document_studio_editor_state.sql`. Three tables: `document_studio_editor_proposals`, `document_studio_editor_audit`, `document_studio_schema_overlay`. Write-through from `documentStudioService.ts:65–71` (imports all DAO funcs) with lazy hydration on cold start (`ensureEditorStateHydrated`, line 212).
- Block-level LLM prose (NEW): `documentBlockProseGenerator.ts` calls real `generateChatResponse` with a grounded consulting-grade system prompt. Wired in `documentStudioService.ts:490–493` when `useLlm=true`. Opt-in checkbox visible in `DocumentStudioIntakeForm.tsx:297`. Falls back deterministically on any LLM failure.
- PDF figure embedding (NEW): `documentPdfRenderer.ts:593–618` — `decodeImageBlockBytes` reads `dataBase64` from image blocks and calls `doc.image(imageBytes, ...)` via PDFKit. Falls back to `Figure N — caption` placeholder only when no bytes present.
- Export (DOCX/PDF): `documentDocxRenderer.ts` and `documentPdfRenderer.ts` both real (no stubs).
- Template registry, QA engine, share links, approvals, source packs, brand voice, audience profiles: unchanged from June-02 audit — all real, DB-backed.

**MOCK / degraded:**
- `documentContentGenerator.ts:143` — deterministic outline still emits placeholder prose ("Substantive content for…"). The LLM block-prose layer (`documentBlockProseGenerator.ts`) overwrites these when `useLlm=true`, but `useLlm` defaults to `false` in `DocumentStudioView.tsx:41` and `DocumentStudioIntakeForm.tsx:83`. Most users receive placeholder-quality bodies unless they enable the toggle.
- `documentNarrativePlanner.ts` — outline structure comes from a hardcoded `SECTION_LIBRARY` map. No AI inference of section order from free-text intake. Unchanged.

---

## Intra-module flow & states

Full three-phase flow verified in `DocumentStudioView.tsx`:
- **intake** → `DocumentStudioIntakeForm` renders, loading/error states covered (line 232–236).
- **outline** → `DocumentStudioOutlinePanel` with back/generate actions (line 237–241).
- **document** → `DocumentStudioDocumentPanel` (2,033+ lines); resume via URL param `/:artifactId` hydrates schema from API (lines 66–87).
- **Empty/error fallback**: line 252–256 renders error message or "No document loaded." — no spinner on error, only on `loadingArtifact`.
- **Mode 3** (template-direct): skips outline panel (lines 96–124).

Tab navigation (Generate / Plan template) is rendered, templates tab mounts `DocumentStudioTemplateArchitectView`.

---

## UI/UX adherence

- Design tokens: `navy-900`, `navy-950`, `primary-500`, `slate-*` — consistent with system palette (`DocumentStudioView.tsx:185–191`).
- Shell: `DocumentStudioView.tsx` uses a bespoke tab-header + flex column (not `ExecutionModuleShell`). `DocumentStudioDocumentPanel.tsx:1996` does use `ExecutiveModuleShell` with `moduleKey="document-studio"`, so the document-viewing phase is properly shell-wrapped.
- Sidebar entry: `menuConfig.ts:131–136` — `MODULE_DOCUMENT_STUDIO`, label "Documents", `badge: 'beta'`, resolves via `AppView.WORDY → ROUTES.DOCUMENT_STUDIO → /document-studio`.
- On `consultify.ai` (public production): `publicProduction.ts:39` — only `AI_CHAT` and `INTERVIEW` are core; all others (including `MODULE_DOCUMENT_STUDIO`) receive `isLocked: true` from `lockMainMenuForPublicProduction`. The route itself has no `ProductionModuleGate` (`AppRoutes.tsx:2026–2044` — only `ProtectedRoute requireAuth`), so direct URL access works; the sidebar entry is locked/greyed.

---

## Cross-module handoffs

- **Outputs Hub → Document Studio**: `ReportsAndPresentationsHub.tsx:916` — `navigate('/document-studio')` button labeled "New AI document (Document Studio)". Real and wired.
- **`/wordy` → `/document-studio`**: `AppRoutes.tsx:1304–1313` — `RedirectPreservingQuery` with `reason="wordy_merged_into_document_studio"`. Route-identity tests in `src/routes/__tests__/documentModuleRouteIdentity.test.ts` confirm both `/document-studio` and `/document-studio/:artifactId` map to `AppView.WORDY`.
- **`routeConfig.ts:354`**: `[AppView.WORDY]: ROUTES.DOCUMENT_STUDIO` — sidebar active-highlight fires on `/document-studio`.
- No handoff from Chat/Interview into Document Studio detected (no deeplink from conversation threads).

---

## Risks / regressions / runtime

1. **Migration runner gap (low–medium risk)**: The new `20260603_document_studio_editor_state.sql` lives in `server/migrations/` and matches the `\d{8}_*.sql` pattern used by both `DatabaseInitializer.ts:3103` and `tablePlatform/migrationRunner.ts`. However, the June-02 audit flagged that fresh-Postgres bootstrap skips ~194 tables already. The editor-state tables are new and will be applied by the runner — but if the runner itself fails to run (the known schema-bootstrap drift), these tables remain absent. The DAO is failure-tolerant (`try/catch → []`), so the service degrades silently to pure in-process Maps rather than erroring — acceptable short-term, not acceptable for GA.
2. **LLM prose is off by default**: Most generated documents ship with placeholder prose. Users who don't notice the opt-in toggle receive structurally correct but substantively empty deliverables. No in-UI indicator that generated content is placeholder-grade.
3. **Public production sidebar lock**: `MODULE_DOCUMENT_STUDIO` is locked in the sidebar on `consultify.ai` — the module is functionally reachable by direct URL but invisible via navigation. Deliberate based on the non-core gate, but limits discoverability for beta users.
4. **Image embedding requires inline base64**: PDF figures only embed when `block.content.dataBase64` is populated (`documentPdfRenderer.ts:593`). The UI flow has no mechanism to attach image bytes to a block during intake/generation — figure embedding is only reachable via API/programmatic schema construction. Real for the rendering layer, effectively unreachable from the standard UI flow.

---

## Top remaining gaps

1. **LLM prose on by default (or smart default)** — placeholder prose on default path is the primary output-quality risk. Consider enabling `useLlm=true` by default with a "fast (no AI)" toggle, or at minimum add a visible banner when content is deterministic.
2. **Schema-bootstrap drift coverage** — the new editor-state tables depend on the migration runner executing correctly on fresh Postgres; verify the runner's reliability for the `20260603` batch (see `schema-bootstrap-orphans.md`).
3. **Image upload/attach UI** — PDF figure embedding is real at the renderer level but requires `dataBase64` in the schema; expose a file-attach step in intake or the document panel.
4. **Sidebar unlock strategy for GA** — decide whether Documents moves to the core-menu set (`PUBLIC_PRODUCTION_CORE_MENU_IDS`) or stays behind a role/flag gate.
5. **Chat → Document Studio deeplink** — no path from a Chat/Interview session to pre-populate Document Studio intake from conversation context.
