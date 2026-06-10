# DEEP RE-VERIFICATION — Module 12: Prezentacje / Presentation Studio + DeckBuilder

**Audit date:** 2026-06-03 · **Method:** end-to-end stack trace, no builds.
**Verdict:** Strongest *generation* pipeline (PPTX/PDF real, narrative LLM real for text-heavy slides, real upstream-data consumption) but the headline Teresa "agent-edit" is a **regex/keyword heuristic with zero LLM**, and generation-time LLM enrichment covers only 4 of 15 slide intents.

---

## Per-feature table

| Feature | Stack path | Status | Evidence (file:line) |
|---|---|---|---|
| PPTX generation | `presentationGeneratorService.ts:1473` → `PptxPipelineService.ts` | WORKS | real end-to-end |
| PDF export | `presentations.routes.ts:1555` (pdfkit) | WORKS | — |
| PNG export | `presentations.routes.ts:5826` (SVG-primitive via sharp) | PARTIAL (title + 5 block texts only; charts/KPI absent) | `renderCardToSvg` limited |
| Narrative LLM enrichment | `presentationGeneratorService.ts:1245` `narrativeIntents` → `generateNarrative` → `narrativeEngine/linguisticRealization.ts:15` `modelRouter` | WORKS for 4 intents only | gated list `:1245-1250`: executive_summary, key_messages, next_steps, recommendation_portfolio |
| Narrative plan | `presentationNarrativePlannerService.ts` | WORKS (deterministic, no LLM) | — |
| Source pack preflight | `presentationSourcePackService.ts`, `wizard/SourceStep.tsx:109` (`GET /artifacts?limit=80`) | WORKS | real artifact cross-ref |
| Teresa agent-edit | `DeckBuilder.tsx:299` UnifiedChatPanel → `/decks/:deckId/agent-edit` `presentations.routes.ts:2180,2199,2221` → `parsePresentationEditIntent:46` → `applyPresentationEditPlan:308` | MOCK-LLM (heuristic regex; NO modelRouter) | see Lens 3 |
| Autosave (30s) | `useVersionHistory.ts:189`, route `:2116` | WORKS | — |
| Version history (persisted) | `useVersionHistory.ts:129`, routes `:5998`,`:6026` | WORKS | server-persisted |
| Proposal → diff → approve | `presentations.routes.ts:2232` `saveAiOperation` + `buildDeckDiffSummary` | WORKS (but proposal content is heuristic) | `:2235` |
| Quality gates block export | route `:5711`, `DeckBuilder.tsx:750` | WORKS | — |
| Governance / source traceability | route `:2426`; `CardRenderer.tsx:24,212`, `SourceTraceability.tsx` | WORKS | — |
| Template gallery (browse/clone) | `DeckTemplateGallery.tsx:86` → `/presentations/templates` | WORKS | no status/version/owner fields `:29-45` |
| Outputs(09) → deck | `PresentationsTabContent.tsx:208` → `artifactLinks.ts:290` → `/prezentacje?artifactId=` | WORKS (1 nav hop, indirect) | — |
| AI outline generation | `wizard/OutlineStep.tsx` | MOCK (rule-based `aiSuggestions` useMemo chips; NO LLM) | — |
| Teresa in PresentationStudioPage | `PresentationStudioPage.tsx` | MISSING (no UnifiedChatPanel) | — |
| Collaboration | `DeckBuilderMelsView.tsx:79` `presenceSlot` | NONE (renders null) | clean-stripped |

---

## 4 Lenses

### Lens 1 — Functionalities
Generate→PPTX/PDF WORKS end-to-end with real LLM narrative for text-heavy slides. Version history + autosave + quality-gate-on-export all WORK. The two AI-headline features are weak: **agent-edit is heuristic** and **outline AI is rule-based chips**. PNG export is layout-primitive only.

### Lens 2 — Cross-module flow
- **Feeds Outputs(09):** YES. Deck creation registers via `registerArtifactOrigin` (`presentations.routes.ts:460`); Outputs→deck nav via `artifactLinks.ts:290` (one hop). Backlinks wired (`DeckBuilder.tsx:638`).
- **Consumes org context / upstream artifacts:** YES — REAL and the strongest of the three. `presentationGeneratorService.ts` directly queries org tables: initiatives at `:785` (`SELECT id,name,status,priority,axis,progress,expected_roi FROM initiatives WHERE organization_id=? ... LIMIT 20`) and again `:846` for roadmap (active initiatives by target_end_date). Source packs cross-reference any Consultify artifact (`wizard/SourceStep.tsx:109`). NOTE: finance/results/risk tables are NOT directly queried — only initiatives + curated source pack. So upstream consumption is real but partial.
- **Consumes from Table(11):** YES via `ExportToPresentation.tsx:237` (reverse direction, flag-independent).

### Lens 3 — Teresa wiring (real vs dead)
**CONFIRMED FAKE-LLM for agent-edit.** `applyPresentationEditPlan` (`presentationAgentEditService.ts:308`) and `parsePresentationEditIntent` (`:46`) contain ZERO LLM/modelRouter usage (grep on the file returns nothing). The route `presentations.routes.ts:2199-2230` calls `parsePresentationEditIntent` (regex slide-number extraction `:20`, keyword section hints `:29`, keyword mutation classification `:65-120`) then `applyPresentationEditPlan` performs deterministic string mutations: summary slide injection (`:333`), `text.slice(0,180)` truncation for "concise" (`:385`), speaker-note templating (`:411`). Teresa's reply is template text, not generated content. The UnifiedChatPanel UI in `DeckBuilder.tsx:299` presents a chat that *looks* like an LLM operator but routes to pattern-matching.
**Where LLM IS real:** generation-time narrative engine (`linguisticRealization.ts:15` `modelRouter`) — but only for the 4 `narrativeIntents` (`presentationGeneratorService.ts:1245`), and never on edit.

### Lens 4 — Contextual memory in generation
At generation the narrative engine receives a `context_pack` + `organizationId` + report config (audience→register, density, language) and runs post-check validation (`presentationGeneratorService.ts:1245-1295`), tracking `facts_used`/`observations_used` — genuine grounded enrichment, but ONLY for the 4 text-heavy intents. The other 11 intents (cover, comparison, assessment, roadmap, risk_management, etc.) get deterministic templating with no LLM/context. Agent-edit carries no contextual memory at all (heuristic).

---

## P0 / P1 / P2

**P0**
- P0-1 Agent-edit fake-LLM → route `applyPresentationEditPlan` through `modelRouter` with deck-context system prompt; keep heuristic as fallback. `presentationAgentEditService.ts:308`, `presentations.routes.ts:2221`.
- P0-2 AI outline generation endpoint `POST /presentations/decks/generate-outline` (prompt+sources→LLM→`OutlineItem[]`); wire into `wizard/OutlineStep.tsx` replacing rule-based chips.
- P0-3 Extend narrative LLM to all 15 intents (add comparison/assessment/roadmap/risk_management/single_insight/performance_overview). `presentationGeneratorService.ts:1245`.

**P1**
- P1-1 Teresa panel in `PresentationStudioPage.tsx` (refine narrative/source pack pre-generation).
- P1-2 Template registry `status`/`version`/`owner` fields. `DeckTemplateGallery.tsx:29-45` + DB + routes.
- P1-3 Direct Outputs→`/presentations/builder/:deckId` shortcut (skip 1 hop). `artifactLinks.ts:290`.
- P1-4 `PresentationStudioPage` → adopt `ExecutiveModuleShell`/`ModuleNavBar`. `PresentationStudioPage.tsx:24`.
- P1-5 Consume finance/results/risk upstream tables in generator (today only `initiatives`). `presentationGeneratorService.ts:785,846`.

**P2**
- P2-1 PNG fidelity UI caveat ("use PPTX for full fidelity"). `presentations.routes.ts:5826`.
- P2-2 E2E smoke wizard→PPTX download.
- P2-3 Deprecate legacy 3-panel layout (`?ff_melsDeckBuilder=0`). `melsDeckBuilderFlag.ts`.
