# DEEP RE-VERIFICATION — Module 10: Dokumenty / Document Studio

**Audit date:** 2026-06-03 · **Method:** end-to-end stack trace (UI → route → service → DB/LLM), no builds.
**Verdict:** Backend is genuinely LLM-grounded and DB-persisted. The Teresa *NL intent* layer is dead, but the editor still has a real LLM path via explicit scoped-proposal endpoints. Net: **functional Beta, gated/defaulted-off in places.**

---

## Per-feature table

| Feature | Stack path | Status | Evidence (file:line) |
|---|---|---|---|
| Intake → outline plan | `DocumentStudioView.tsx:129` → `api.planDocumentStudioOutline:115` → `/plan` route `document-studio.routes.ts:395` → `documentNarrativePlanner.ts` | WORKS (deterministic; LLM only refines tone) | `documentNarrativePlanner.ts:33` `DEFAULT_SECTIONS_BY_TYPE` static |
| AI generate (block prose) | `/generate` route `:426` → `documentStudioService.ts:490` → `generateBlockProse` `documentBlockProseGenerator.ts:167,179` → `generateChatResponse` | WORKS when `useLlm=true`; else stub | grounded system prompt `documentBlockProseGenerator.ts:92,101`; user prompt carries sources `:114,127` |
| AI generate default | `useLlm` state | PARTIAL (defaults FALSE → users get stub prose) | `DocumentStudioView.tsx:41`, `DocumentStudioIntakeForm.tsx:83` |
| Editor CRUD / edit (scoped) | `DocumentStudioEditorPanel.tsx:107` scope-dropdown + instruction → `createLocalEditProposal` etc → routes `/editor/proposals/{local,section,global,methodology,source,transformative}` `:3247,3383,3421,3460,3503,3543` → `documentStudioService.ts:979,1074,1153,1309,1423,1549` → `refineEditorTextWithLlm` `documentEditorRefiner.ts:180` (real LLM) | WORKS (real LLM, explicit scope) | `documentStudioService.ts:961,1091,1171,1330,1452,1568` |
| Proposal approve/reject (diff→apply→version) | routes `:3581,3612` → `approveEditProposal:1735` / `rejectEditProposal:1831` | WORKS | persisted via DAO below |
| Persistence (editor state) | `documentEditorStateRegistryDao.ts` 3 tables, migration `20260603_document_studio_editor_state.sql` | WORKS but DEGRADES SILENTLY to in-process Map on DB error | silent catch `documentEditorStateRegistryDao.ts:106,112`; comment `:18,24` |
| Export DOCX/PDF/markdown | `/export/:format` route `:3323,3332,3346` → `documentDocxRenderer.ts` / `documentPdfRenderer.ts` | WORKS | PDF figure embed real `documentPdfRenderer.ts:568` (needs `dataBase64`) |
| Image/figure upload UI | intake/panel | BROKEN (renderer ready, no UI to populate `dataBase64`) | `DocumentStudioIntakeForm.tsx`, `DocumentStudioDocumentPanel.tsx` — no attach control |
| Teresa NL intent classify | `documentTeresaIntent.ts:300,536` | MOCK/DEAD (imported only in `__tests__/`) | see Lens 3 |
| Create-from-chat-sources | `/chat/create-from-sources` route `:1127` → `createDocumentFromChatSourcePack` `documentStudioService.ts:2535` | PARTIAL (server real; no `api.ts` wrapper, no Chat CTA) | `src/components/DocumentStudio/api.ts` lacks wrapper |
| QA verdict | `documentQaService.ts`, `DocumentStudioQaPanel.tsx` | WORKS | deterministic |
| Real-time / collab | — | NONE (none designed) | n/a |
| AI Credits metering | LLM routes | MISSING | no credits middleware on `/plan`,`/generate`,`/editor/proposals/*` |

---

## 4 Lenses

### Lens 1 — Functionalities
Editor CRUD, scoped LLM edit, approve/reject with diff+version, DOCX/PDF export, QA — all WORK end-to-end. Two reachability gaps: (a) AI prose is **off by default** (`useLlm=false`), so a first-time user receives deterministic stub prose ("Substantive content for…") from `documentContentGenerator.ts` with no in-UI warning; (b) image blocks render in PDF but cannot be populated from any UI.

### Lens 2 — Cross-module flow
- **Feeds Outputs(09):** indirectly. Outputs hub → Document Studio nav exists (`ReportsAndPresentationsHub.tsx:905`), but Document Studio artifacts are NOT cross-listed in Outputs alongside presentations, and there is no `registerArtifactOrigin` call from doc generation. One-way nav only.
- **Consumes org context / upstream artifacts:** NO direct consumption. `grep` for `FROM initiatives|results|financ` / `orgContext` in `documentStudioService.ts` returns nothing. Generation is grounded ONLY in the explicit `sourcePack` attached to the schema (`documentSourcePackService.ts`). It does NOT auto-pull initiatives/results/finance. This is the biggest "AI-native consulting artifact" gap — prose is source-grounded but blind to the org's live data unless a human curates the pack.
- **Inbound from Chat:** server route exists, frontend path absent (P0).

### Lens 3 — Teresa wiring (real vs dead)
**CONFIRMED DEAD.** `documentTeresaIntent.ts` (`detectTeresaEditorIntent:300`, `detectTeresaCreationIntent:536`) is imported **only** in `__tests__/documentTeresaIntent.test.ts:13` and `__tests__/documentTeresaCreationIntent.test.ts:12`. Zero production import. The free-form "Teresa is the sole edit interface" contract (`26_DOCUMENT_STUDIO_UX.md:73`) is unmet.
**Nuance the prior dossier under-stated:** the editor is NOT non-functional. `DocumentStudioEditorPanel.tsx` exposes a **scope selector + instruction box** that calls the typed proposal endpoints, which DO invoke the real LLM (`refineEditorTextWithLlm` → `generateChatResponse`). So users get real AI editing via explicit scope picking — just not via natural-language Teresa routing. The dead file is the NL-classification convenience layer, not the edit engine.

### Lens 4 — Contextual memory in generation
Prose generation is grounded: `buildUserPrompt` (`documentBlockProseGenerator.ts:108,114,127`) injects intake + the schema's `sources` array into the LLM prompt with an explicit "ground every claim / flag assumptions" instruction (`:101`). This is real contextual grounding **scoped to the curated source pack**. There is NO retrieval of org memory, prior documents, or upstream module artifacts beyond that pack. Editor refiner (`documentEditorRefiner.ts:180`) passes the block-before + instruction but minimal surrounding-document context.

---

## P0 / P1 / P2

**P0**
- P0-1 LLM prose off by default — flip to true + amber "stub mode" banner. `DocumentStudioView.tsx:41`, `DocumentStudioIntakeForm.tsx:83`.
- P0-2 Teresa NL intent dead — wire `detectTeresaEditorIntent` into an edit route so free-form Teresa messages dispatch to the correct scoped refiner. `document-studio.routes.ts` (new) + `documentTeresaIntent.ts:300`.
- P0-3 Create-from-chat unreachable — add `api.ts` wrapper + Chat CTA. `src/components/DocumentStudio/api.ts`, route `:1127`.

**P1**
- P1-1 No upstream org-data grounding — optionally auto-assemble source pack from initiatives/results/finance. `documentStudioService.ts` generation path (no `FROM` queries today).
- P1-2 Silent DB degradation to in-process Map — promote catch to hard warn + startup table health-check. `documentEditorStateRegistryDao.ts:106,112`.
- P1-3 Image upload UI absent. `DocumentStudioIntakeForm.tsx`, `DocumentStudioDocumentPanel.tsx`.
- P1-4 Not cross-listed in Outputs(09); no `registerArtifactOrigin` on generate.

**P2**
- P2-1 AI Credits metering on `/plan`,`/generate`,`/editor/proposals/*`. `document-studio.routes.ts`.
- P2-2 AI-inferred outline (replace `DEFAULT_SECTIONS_BY_TYPE`). `documentNarrativePlanner.ts:33`.
- P2-3 E2E test for intake→generate(useLlm)→approve→export.
