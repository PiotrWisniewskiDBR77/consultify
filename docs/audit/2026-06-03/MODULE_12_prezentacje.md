# Module 12 — Prezentacje — Readiness Scorecard

**Readiness: 79/100 — Tier: Beta+**
**Baseline: 62/100 (2026-06-02) — Delta: +17**
**Route(s):**
- `/prezentacje` — NOW self-serve: `ProtectedRoute requireAuth={true}` only; `KimiModuleGate` removed (gap #1 closed).
- `/presentations/builder/:deckId` — `DeckBuilder` (MELS shell now DEFAULT).
- `/presentations/studio` — `PresentationStudioPage` (unchanged, real).
- `/presentations/wizard` — `PresentationWizard` (unchanged, real).

**One-line verdict:** Four of five audit gaps closed — contact-gate removed, collab dead-code stripped, version history server-persisted, MELS on by default, PNG export verified. Remaining blocker: Outputs→DeckBuilder cross-module nav routes through `/prezentacje?artifactId=` (AI lane), not `/presentations/builder/:deckId` directly, so the canonical editor is only one hop away rather than immediate.

---

## Gap closure verification (vs June 2 audit)

### Gap #1 — Contact-gate removed [CLOSED]
`src/routes/AppRoutes.tsx:1329` comment explicitly: "The contact-required KimiModuleGate was removed (Module 12 audit gap #1)." Route now wraps only `<ProtectedRoute requireAuth={true}>` — no module-access API call, no `V4ComingSoonView` fallback. Any authenticated user reaches `PrezentacjeView` directly.

### Gap #2 — Collab presence dead-code stripped [CLOSED]
`useCollaboration` is no longer called anywhere in `src/components/Presentations/`. Zero hits on grep. `DeckBuilderTopBar.tsx` (311 lines) has no presence/avatar/peer references. `DeckBuilderMelsView.tsx:79` exposes `presenceSlot?: React.ReactNode` but it is intentionally omitted by `DeckBuilder.tsx` (no `presenceSlot=` prop passed at lines 926–1060), so the slot renders nothing — no disconnected chips.

### Gap #3 — Version history server-persisted [CLOSED]
`useVersionHistory.ts:129-151`: on mount calls `GET /api/presentations/decks/:deckId/versions`, merges server rows (marked `persisted: true`) with in-session snapshots. Autosave at line 234 calls `fetchServerVersions()` after each successful PUT. Restore of persisted snapshots hits `POST /api/presentations/decks/:deckId/versions/:versionId/restore` (line 259). Server endpoints exist and query `presentation_deck_versions` table (`presentations.routes.ts:5998` and `6026`). Autosave at route `:2161` and agent-edit accept at `:2320` both INSERT version rows. Fully end-to-end persisted.

### Gap #4 — MELS DeckBuilder default ON [CLOSED]
`src/utils/melsDeckBuilderFlag.ts:19,43`: comment "Default: ON (Module 12 audit gap #4)". `readEnvFlag()` returns `true` when no env override set. `DeckBuilder.tsx:917` branches into `DeckBuilderMelsView` when `isMelsDeckBuilderEnabled()` — now the standard path for all users.

### Gap #5 — PNG export verified [CLOSED]
`presentations.routes.ts:5849`: `renderCardToSvg()` is exported and produces valid 1920×1080 SVG with theme-aware bg/text/accent colors. Line 5826: `sharp(Buffer.from(svg, 'utf-8')).png().toBuffer()` rasterizes it. `server/src/routes/__tests__/presentationPngExport.test.ts:25-73` has 4 Vitest cases covering SVG well-formedness, sharp PNG output, dimension round-trip, and XSS-hostile content escaping. Note: SVG-to-PNG is layout-primitive (title + block text only), not pixel-perfect slide rendering — acceptable for v1 export.

---

## Functionality status

| Feature | Status | Evidence |
|---|---|---|
| Generate deck → PPTX download | Real, end-to-end | `presentations.routes.ts:2161`, `PptxPipelineService.ts`, `exports/*.pptx` on disk |
| PDF export | Real | `presentations.routes.ts:1555`, pdfkit inline |
| PNG export (zip) | Real (SVG-primitive) | `presentations.routes.ts:5826`, `sharp`, 4 test cases |
| Autosave (30 s) | Real, server-persisted | `useVersionHistory.ts:189-238`, route `:2116` |
| Version history | Real, server-persisted | `useVersionHistory.ts:129-151`, route `:5998` |
| Version restore | Real | `useVersionHistory.ts:259`, route `:6026` |
| Agent-edit (Teresa) | Real | route `:2180`/`:2299`/`:2389`, `DeckBuilder.tsx:814-836` |
| Quality gates | Real | route `:5711`, blocks export |
| Governance card | Real | route `:2426` |
| Collaboration | Stripped (not stubbed) | No `useCollaboration` call anywhere in Presentations |
| Shared deck analytics | Real | `ShareAnalyticsPanel.tsx:56` |

---

## Intra-module flow

`/prezentacje` → AI generator lane → creates deck (POST `/presentations/decks`) → redirects to `/presentations/builder/:deckId` with MELS shell (DEFAULT). In the builder: Slide Sorter (left) | CardCanvas (center) | Block/Media/Activity rail (right) | Teresa aside. TopBar chips: Internal → Theme → History → Quality → Governance → Analytics → Audit → Share → Teresa → Present. All chips wired and functional.

`/presentations/wizard` → `PresentationWizard` → generates via Studio flow or direct → same builder. `/presentations/studio` → 4-step preview+approval → generate → builder.

Empty-deck guard: `runEnabled: deck.cards.length > 0` — Present chip disabled until slides exist.

---

## Cross-module handoffs

**Outputs hub → Deck**: `PresentationsTabContent.tsx:208` calls `resolveArtifactOpenPath({ kind: 'presentation', originRecordId: row.id })` → `getArtifactPath('presentation', id)` → `/prezentacje?artifactId=${id}` (`artifactLinks.ts:290`). `PrezentacjeView.tsx:142,199-254` reads `artifactId` param and auto-opens the deck. This routes through the AI lane, not directly to the builder — one extra hop but functional. No direct `/presentations/builder/:deckId` shortcut from Outputs.

**Chat → Deck**: `useOpenChatWithContext` wired in `PresentationsTabContent.tsx:65`, functional.

**Template use**: `resolveTemplateUsePath('presentation')` → `/prezentacje?templateArtifactId=…` — routes to AI generator lane with template pre-loaded.

---

## UI/UX adherence

MELS shell (`ExecutiveModuleShell`) now default. `DeckBuilderMelsChips.tsx` chip order matches canonical MELS standard (mirrors Tabele/Wordy). Design tokens in `designTokens.ts:57` use `003A70` (dark navy) as primary. Brand color override supported (`designTokens.ts:155`). `DeckThemeProvider` with `initialColorSetId: 'midnight_navy'` default. PPTX atomics and composites use slate/navy palette consistently. No crimson token — slide brand uses navy/indigo per consulting palette (correct for HBS use-case).

---

## Risks and residual gaps

1. **Outputs → builder UX friction** — `getArtifactPath('presentation', id)` routes to `/prezentacje?artifactId=` (AI lane) rather than directly to `/presentations/builder/:id`. Works but adds an extra navigation step and depends on `PrezentacjeView` correctly resolving the `artifactId` to a deck. Medium risk.
2. **SVG-only PNG export** — `renderCardToSvg` renders title + first 5 block texts at fixed positions. Rich blocks (charts, KPI widgets, diagrams) are not rasterized. Advertised as "PNG export" but output fidelity is low. Low risk for v1, worth a clear caveat in UI.
3. **`presenceSlot` prop exists but unused** — `DeckBuilderMelsView.tsx:79` documents the slot; `DeckBuilder.tsx` passes nothing. No dead UI — slot renders null — but the API surface implies future collab without a plan. Cosmetic risk.
4. **No E2E test for full generate → download pipeline** — still absent. Unit coverage is deep but no integration smoke test across wizard → PPTX file.
5. **Legacy 3-panel layout retained** — accessible via `?ff_melsDeckBuilder=0`. Two layouts to maintain until deprecated.

---

## Score delta

| Dimension | Jun-02 | Jun-03 | Delta |
|---|---|---|---|
| Entry-point accessibility | 5 | 10 | +5 |
| Core functionality (generate/export) | 18 | 20 | +2 |
| Autosave + version history | 5 | 10 | +5 |
| UI/UX shell consistency (MELS) | 5 | 9 | +4 |
| Cross-module handoffs | 5 | 7 | +2 |
| Tests + verification | 7 | 9 | +2 |
| Collab hygiene | 4 | 8 | +4 |
| Architecture / debt | 13 | 6 | -7 (debt accounted) |
| **Total** | **62** | **79** | **+17** |
