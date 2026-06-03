# COMPLETION DOSSIER — Module 12: Prezentacje / Presentation Studio + DeckBuilder

**Audit date:** 2026-06-03  
**Score trajectory:** 62 (2026-06-02) → 79 (2026-06-03 re-audit) → **current: ~79/100**  
**Gap to 100%:** 21 points across 9 concrete items

---

## 1. Purpose / Goal / Vision

Vision (`docs/UI_UX/27_PRESENTATION_STUDIO_UX.md`, `docs/modules/12_prezentacje/01_PURPOSE.md`, `docs/RAW/presentation-studio/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`):

Presentation Studio creates **Gamma-class enterprise decks as living consulting artifacts** — not a slide generator but an AI-operated system that plans narrative, generates controlled layouts, performs QA, executes proposal→diff→approve→version cycles, and exports editable PPTX/PDF.

**At 100%** the module must:
- Generate a deck from prompt, with source pack from any Consultify artifact (Research/Interview/Docs/KPI/Risk/Decisions), a visible narrative plan (thesis, storyline, proof points), and layout taxonomy enforcement — all before the user clicks Generate.
- Teresa operates the deck (propose, diff, approve/reject) using **real LLM calls** through `modelRouter`, not keyword heuristics.
- Reading vs speaking intent (show / document / briefing / workshop) actively shapes PPTX layout and text density — not just stored metadata.
- PPTX export is pixel-faithful (not SVG-primitive for PNG); full template registry with status/version.
- PresentationStudioPage adopts the ModuleHub shell (not a bespoke command row).
- Seven operational modes (generate, plan template, generate from approved template, AI-edit existing, convert artifacts→deck, convert deck→other artifacts, live data deck) are all reachable.

---

## 2. Readiness to 100% — Score and Gap

**Current honest score: 79/100**

### What is real and working (verified):

| Feature | File:Line | Status |
|---|---|---|
| PPTX generation end-to-end | `server/src/services/presentationGeneratorService.ts:1473`, `PptxPipelineService.ts` | Real |
| PDF export (pdfkit) | `server/src/routes/presentations.routes.ts:1555` | Real |
| PNG export (SVG-primitive, sharp) | `presentations.routes.ts:5826`, 4 Vitest tests | Real (limited fidelity) |
| Narrative engine (LLM L4) | `narrativeEngine/linguisticRealization.ts:15` uses `modelRouter` | Real for text-heavy slides |
| Source pack preflight | `presentationSourcePackService.ts`, 4-preview Studio flow | Real |
| Narrative plan (deterministic) | `presentationNarrativePlannerService.ts` | Real (no LLM) |
| DeckBuilder autosave 30 s | `useVersionHistory.ts:189-238`, route `:2116` | Real |
| Version history server-persisted | `useVersionHistory.ts:129-151`, route `:5998` / `:6026` | Real |
| Teresa agent-edit (heuristic) | `presentationAgentEditService.ts:46-159`, route `:2180` | Real but heuristic |
| MELS shell default ON | `melsDeckBuilderFlag.ts:19,43` | Real |
| Quality gates block export | route `:5711`, `DeckBuilder.tsx:750-755` | Real |
| Governance card | route `:2426`, `DeckBuilder.tsx:400-418` | Real |
| Source traceability per card | `CardRenderer.tsx:24,212`, `SourceTraceability.tsx` | Real |
| Template gallery (browse/clone) | `DeckTemplateGallery.tsx:86-110`, route `/presentations/templates` | Real |
| Artifact registry linkage | `presentations.routes.ts:460-470` | Real |
| Outputs hub → deck link | `PresentationsTabContent.tsx:208`, `artifactLinks.ts:290` (one-hop via `/prezentacje`) | Functional, indirect |
| Presentation mode: show/document/briefing/workshop | `wizard/types.ts:7`, used in `presentationGeneratorService.ts:1467` | Real (shape partially) |

---

## 3. Teresa Integration — Depth and Missing

### What exists

**Wizard source step** (`wizard/SourceStep.tsx:109`): calls `GET /artifacts?limit=80` to populate source candidates. Real artifact cross-reference.

**Outline step** (`wizard/OutlineStep.tsx`): client-side AI suggestion strip (rule-based, `aiSuggestions` useMemo) adds slide type recommendations but is **not Teresa**. No LLM call.

**DeckBuilder Teresa slot** (`DeckBuilder.tsx:299,1000-1044`): `UnifiedChatPanel` is mounted with `onModuleIntent={handleTeresaDeckIntent}`. Teresa chat sends prompt → `POST /decks/:deckId/agent-edit` → `parsePresentationEditIntent` (pure regex/keyword) → `applyPresentationEditPlan` (deterministic mutations).  
**Critical gap**: the agent-edit route (`presentations.routes.ts:2199-2230`) never calls `modelRouter` or any LLM. All mutations (shorten, add slide, reorder, branding) are heuristic pattern-matches in `presentationAgentEditService.ts:46-598`. Teresa's reply is template text, not LLM-generated content.

**Narrative Engine** (`narrativeEngine/linguisticRealization.ts:15,237`): calls `modelRouter` for L4 linguistic realization only for `executive_summary / key_messages / next_steps / recommendation_portfolio` slides (`presentationGeneratorService.ts:1245-1289`). LLM is **real** here but scoped to 4 of 15 intents, and only at generation time (not on edit).

**PresentationStudioPage** (`PresentationStudioPage.tsx`): no Teresa panel, no `UnifiedChatPanel`. The 4-preview + approval flow is manual trigger only. No AI-driven narrative improvement loop in Studio.

### What is missing for 100%

- **Real LLM agent-edit**: `applyPresentationEditPlan` must route through `modelRouter` for content generation (`presentations.routes.ts:2221` — swap heuristic for LLM with deck context).
- **Teresa in PresentationStudioPage**: Studio's source-pack and narrative plan need a Teresa correction loop (user can say "my audience is CFO, re-plan the narrative").
- **Narrative engine for all intents**: 11 intents (cover, comparison, assessment, roadmap, risk_management, etc.) get no LLM enrichment.
- **AI outline generation**: `OutlineStep.tsx` AI suggestions are rule-based chips. There is no `POST /generate-outline` that sends prompt + sources to LLM to propose a full deck structure.

---

## 4. System Integration

### Outputs Hub
`PresentationsTabContent.tsx:208` → `getArtifactPath('presentation', id)` → `/prezentacje?artifactId=${id}` (`artifactLinks.ts:290`). `PrezentacjeView.tsx:142,199-254` reads `artifactId` and auto-opens deck. **Works but adds one navigation hop.** No direct `/presentations/builder/:deckId` shortcut.

### Artifact Registry
Deck creation registers via `artifactRegistryService.registerArtifactOrigin` (`presentations.routes.ts:460`). Source-pack selections are stored as `source_refs` on the deck. Backlinks wired (`DeckBuilder.tsx:638-678`).

### Template Registry
`DeckTemplateGallery.tsx` fetches `GET /presentations/templates`. Templates expose `is_system`, `deck_type`, `outline_json`. **Missing**: template status lifecycle (draft/approved/deprecated), version field, owner — specs required by `docs/UI_UX/27_PRESENTATION_STUDIO_UX.md:line 43`. `DeckTemplate` interface in `DeckTemplateGallery.tsx:29-45` has no `status`, `version`, or `owner` fields.

### Collaboration
Stripped cleanly — `useCollaboration` absent everywhere, no disconnected presence UI. `presenceSlot` prop on `DeckBuilderMelsView.tsx:79` exists but renders null.

### PresentationStudioPage shell
Self-described as not yet adopting `ModuleHub` shell (`PresentationStudioPage.tsx:24-25`). Uses bespoke sticky header, not `ExecutiveModuleShell` / `ModuleNavBar`.

---

## 5. Completion Plan to 100%

### P0 — Blockers to production-quality vision (–12 pts if not fixed)

| # | Item | File:Line | Effort |
|---|---|---|---|
| P0-1 | **Agent-edit: replace heuristic with real LLM call** — `applyPresentationEditPlan` must use `modelRouter` with deck context JSON as system prompt; keep heuristic as fallback. | `server/src/services/presentationAgentEditService.ts:46` → new `callLLM` branch; `presentations.routes.ts:2221` | L (3–4 d) |
| P0-2 | **AI outline generation endpoint** — `POST /presentations/decks/generate-outline` that takes prompt + selected sources → LLM → returns structured `OutlineItem[]`; wire into `OutlineStep.tsx` replacing the rule-based suggestion chips | `server/src/routes/presentations.routes.ts` new route; `wizard/OutlineStep.tsx:92-121` | M (2 d) |
| P0-3 | **Narrative engine for all 15 intents** — extend `narrativeIntents` array in `presentationGeneratorService.ts:1245` to include `comparison / assessment / roadmap / risk_management / single_insight / performance_overview` | `presentationGeneratorService.ts:1245` | S (0.5 d) |

### P1 — Important quality gaps (–7 pts)

| # | Item | File:Line | Effort |
|---|---|---|---|
| P1-1 | **Teresa in PresentationStudioPage** — add `UnifiedChatPanel` in Studio preview phase so user can refine narrative plan / source pack before approving generation | `PresentationStudioPage.tsx` (add Teresa slot) | M (1.5 d) |
| P1-2 | **Template registry status/version fields** — add `status` (`draft`/`approved`/`deprecated`), `version`, `owner_id` to `DeckTemplate` type, DB schema, and `DeckTemplateGallery.tsx` badges | `DeckTemplateGallery.tsx:29-45`; new DB column; `presentations.routes.ts` templates endpoints | M (1 d) |
| P1-3 | **Direct Outputs → builder shortcut** — add second `artifactLinks.ts:290` path: when deck already exists in DB, route to `/presentations/builder/:deckId` directly (skip AI lane) | `src/components/ReportsAndPresentations/artifactNavigation.ts`, `artifactLinks.ts:290` | S (0.5 d) |
| P1-4 | **PresentationStudioPage → ModuleHub shell** — adopt `ExecutiveModuleShell` + `ModuleNavBar`, move action buttons to `commandRowRightContent` per `ai-actions-menu3.mdc` | `PresentationStudioPage.tsx:24` | M (1 d) |

### P2 — Polish / debt (–2 pts)

| # | Item | File:Line | Effort |
|---|---|---|---|
| P2-1 | **PNG export fidelity caveat in UI** — `renderCardToSvg` renders only title + 5 block texts; rich blocks (charts, KPI, SmartDiagram) are absent. Add UI note `"PNG: layout-primitive; use PPTX for full fidelity"` | `presentations.routes.ts:5826`; export button in `DeckBuilder.tsx` | XS (0.5 d) |
| P2-2 | **E2E smoke test: wizard → PPTX download** — no end-to-end test covering full generate → download path | `server/scripts/smoke-v3-presentations-runtime.ts` (extend) | S (1 d) |
| P2-3 | **Deprecate legacy 3-panel layout** — `?ff_melsDeckBuilder=0` still loads old shell; add deprecation warning or remove entirely | `melsDeckBuilderFlag.ts`, `DeckBuilder.tsx:910-920` | S (0.5 d) |

---

## Score Model

| Dimension | Current | Target |
|---|---|---|
| Entry-point accessibility | 10 | 10 |
| Core generation (PPTX/PDF/PNG) | 19 | 20 |
| Version history + autosave | 10 | 10 |
| Teresa / AI operator (LLM-real) | 5 | 15 |
| Narrative plan + outline AI | 4 | 9 |
| Source traceability | 8 | 8 |
| Template registry + governance | 4 | 7 |
| UI shell consistency + cross-module | 8 | 10 |
| Tests + verification | 7 | 7 |
| Presentation mode semantics | 4 | 4 |
| **Total** | **79** | **100** |

**Estimated effort to 100%:** ~12 dev-days (P0: 5.5 d, P1: 4 d, P2: 2.5 d).
