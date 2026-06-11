# M02 Canvas — FAZA 2: Testy (raport agenta TESTY)

> Branch: `feat/deliverables-light` · Data: 2026-06-11 · Pełny log: `f2_tests.log`
> Metoda: realne uruchomienie (`npx vitest run`), bez cytowania briefu. Worktree `.claude/worktrees/*` pominięte.

---

## 0. TL;DR (potwierdzenie/obalenie hipotez briefu)

| Hipoteza briefu | Werdykt | Fakt |
|---|---|---|
| „7 zestawów = 97/97 PASS" | **CZĘŚCIOWO OBALONE (na plus)** | Faktycznie **99/99 PASS**. Brief zaniżył: `docGenerationRuntime` urosło z 16 do **25** testów. Pozostałe 6 zestawów dokładnie zgodne. |
| „14 faili UnifiedChatPanel.test.tsx" | **POTWIERDZONE** | Dokładnie **14 FAIL / 15 PASS** (29). |
| „pre-existing dryf mocków (store bez .getState)" | **POTWIERDZONE co do natury, doprecyzowane** | Mock **ma** `.getState`, ale obiekt stanu **nie ma** `setConversationChatLanguage`. To test-only dryf mocka, NIE regresja produkcyjna. |
| „2 błędy tsc w AIChatWelcomeView/FullRolloutView" | nie weryfikowane w F2 (zakres: testy, nie tsc) | — |

---

## 1. Inwentarz testów modułu Canvas/deliverables

### 1a. 7 zestawów rdzeniowych (objęte twierdzeniem 97/97)

| Plik | Czego dotyczy | Testów | Środowisko |
|---|---|---|---|
| `tests/unit/AIChat/canvasEmissionHeuristic.test.ts` | B4 auto-emisja chip „Otwórz jako dokument" — heurystyka rozpoznania odpowiedzi-dokumentu | 8 | FE (vitest jsdom) |
| `tests/unit/AIChat/canvasPatchOps.test.ts` | B3 patch-mode — parse JSON ops, strip fences, locate/apply anchorów, all-or-nothing, diff accept | 13 | FE |
| `tests/unit/mywork/ideaMapToMarkdown.test.ts` | C5 „Omów z Teresą" — mapa myśli → markdown seed | 9 | FE |
| `tests/unit/mywork/notebookExpandToDocument.test.ts` | C3 „Rozwiń w dokument" — notatka → draft | 5 | FE |
| `tests/unit/reports/duplicateArtifactToDraft.test.ts` | D2 „Duplikuj/Użyj jako szablonu" w Outputs Library | 7 | FE |
| `tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx` | Panel dokumentu Canvas: widoki Doc/MD, eksport, wersje, workflow, autosave, save-as-note, bloki artefaktów | 32 | FE (jsdom + stub fetch) |
| `server/src/services/deliverables/__tests__/docGenerationRuntime.test.ts` | L2/L3 runtime generacji: plan/start/status doc+sheet, bramka anty-placeholder, B2 grounding, B3 sekcja Źródła, B4 auto-skan, A3 streaming | **25** | BE (vitest node) |

### 1b. Szerszy ekosystem testów Canvas/deliverables (poza twierdzeniem 97, istotne dla pokrycia)

- `tests/integration/routes/work-canvas.routes.test.ts` — **~45 it** (materializacja idei, capability-403, share-token, export MD/CSV/JSON + heavy, version restore, block transform, dataset→dashboard, research/decision block, konflikty stale). **Najbogatszy test integracyjny modułu.**
- `tests/integration/routes/work-canvas.workflow-contracts.routes.test.ts` — kontrakty workflow.
- `tests/unit/AIChat/canvasStreamIntentDetector.test.ts`, `canvasDiffOps.test.ts`, `canvasViewMode.test.ts`, `useCanvasAIStream.test.ts` — intent/diff/view/stream.
- `tests/unit/canvas/canvasMutationRisk.test.ts`, `workCanvasActionErrorMessage.test.ts` — ryzyko mutacji, bezpieczne komunikaty błędów.
- `tests/components/AIChat/CanvasMarkdownRenderer`, `CanvasRichEditor`, `WorkCanvasShell` — render/editor/shell.
- `server/src/services/deliverables/__tests__/deliverablesMetricsService.test.ts` — telemetria §8.
- E2E: `tests/e2e/smoke/work-canvas-*.spec.ts` (core-flow, editor-flow, split, deeplink, research-lineage, manual-preflight) — **6 plików**.

---

## 2. Wyniki uruchomienia (PASS/FAIL/SKIP + czas)

### 7 zestawów rdzeniowych — **99 PASS / 0 FAIL / 0 SKIP**

| Zestaw | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|
| canvasEmissionHeuristic | 8 | 0 | 0 | (część batcha FE 14.5s) |
| canvasPatchOps | 13 | 0 | 0 | — |
| ideaMapToMarkdown | 9 | 0 | 0 | — |
| notebookExpandToDocument | 5 | 0 | 0 | — |
| duplicateArtifactToDraft | 7 | 0 | 0 | — |
| WorkCanvasDocumentPanel | 32 | 0 | 0 | — |
| **FE razem (6 plików)** | **74** | 0 | 0 | **14.53s** |
| docGenerationRuntime (BE) | 25 | 0 | 0 | **0.72s** |
| **SUMA** | **99** | **0** | **0** | — |

> **Werdykt 97/97:** OBALONE jako liczba — faktycznie **99/99 PASS**. Brief był nieaktualny (zaniżony o testy `docGenerationRuntime`). Wszystkie zielone.
> Uwaga jakościowa: WorkCanvasDocumentPanel emituje ostrzeżenia `act(...)` przy autosave (3 testy) — testy przechodzą, ale to dług (nieobudowane w `act` aktualizacje stanu po debounce). Nie blokuje, do uprzątnięcia.

### UnifiedChatPanel.test.tsx — **15 PASS / 14 FAIL / 0 SKIP** (29) + 4 unhandled rejections, 7.15s

**Root-cause (zweryfikowany w kodzie):**
- Kod prod `src/components/AIChat/UnifiedChatPanel.tsx:3030` wywołuje `useConversationStore.getState().setConversationChatLanguage(...)`.
- Realny store **MA** tę metodę: `src/store/useConversationStore.ts:576` (typ) i `:1421` (impl).
- Mock w teście (`tests/components/AIChat/UnifiedChatPanel.test.tsx`, obiekt `conversationStoreState` linie 90-108) **NIE zawiera** klucza `setConversationChatLanguage`. `getState` jest obecny (`:111`), ale zwraca niekompletny stan.
- ⇒ `TypeError: ...setConversationChatLanguage is not a function` w 14 testach + unhandled rejections.

**Klasyfikacja: test-only dryf mocka (NIE regresja).** Fix trywialny: dodać `setConversationChatLanguage: vi.fn()` (i ewentualnie inne brakujące langage-actions) do `conversationStoreState`. To NIE jest moduł Canvas sensu stricto — to test czatu, który zaczął zależeć od nowszej akcji store.

---

## 3. Mapa pokrycia scenariuszy krytycznych S1–S8

Legenda PR-gate: **default branch = `Londyn`**. `test-suite.yml` triggeruje wyłącznie `pull_request: [main, develop]` ⇒ **dla PR do `Londyn` żaden job test-suite nie biegnie**. Jedyny PR-triggerowany workflow to `i18n-check.yml` (tylko `public/locales/en/**`). Kolumna „PR-gate" = czy realnie blokuje PR na obecnym workflow brancha.

| # | Scenariusz | FE? | BE? | E2E? | PR-gate (Londyn)? |
|---|---|---|---|---|---|
| S1 | Deck z czatu (intent→checklista→deck) | ◐ intent (`canvasStreamIntentDetector`), emisja (`canvasEmissionHeuristic` 8) | ✅ runtime planDeck w `docGenerationRuntime`/`deliverablesGenerationService` | ◐ `work-canvas-core-flow` (smoke, nie tier0) | ❌ |
| S2 | Doc z czatu (anty-placeholder gate) | — | ✅ `docGenerationRuntime` (bramka anty-placeholder, 2 testy + start) | ◐ smoke | ❌ |
| S3 | Sheet GFM round-trip | ◐ `canvasMarkdownConversion` (pośrednio) | ✅ `docGenerationRuntime` planSheet/startSheet (4 testy) | — | ❌ |
| S4 | Patch-mode diff accept/reject | ✅ `canvasPatchOps` (13), `canvasDiffOps`, `useCanvasAIStream` | ✅ `work-canvas.routes` replace_selection+version snapshot | ◐ `work-canvas-editor-flow` smoke | ❌ |
| S5 | Wersje + restore | ✅ WorkCanvasDocumentPanel (load history, restore) | ✅ `work-canvas.routes` (stale restore 409, restore read-back) | ◐ smoke | ❌ |
| S6 | Public share + revoke + viewer | — | ◐ **tylko** create share-token (`work-canvas.routes:999`); **BRAK** testu `/public/artifacts/:token`, revoke (404/410), sanityzacji payloadu | ❌ brak E2E share/viewer | ❌ |
| S7 | Promote/materializacja do encji (org-guard) | — | ◐ happy-path materializacji idei + capability-403; **BRAK** testu org-guard `assertOrgScopedReferences` / `CANVAS_CROSS_ORG_REFERENCE` | ❌ | ❌ |
| S8 | Eksport 7 formatów | ✅ WorkCanvasDocumentPanel (MD/CSV/JSON, asercja na URL/format) | ✅ `work-canvas.routes` (MD/CSV/JSON + heavy adapter); `UnifiedExportService.test` | ◐ `presentations-export-contract` (nie work-canvas, nie tier0) | ❌ |

**Wniosek pokrycia:** żaden z 99 testów Canvas nie jest w PR-gate dla PR do `Londyn`. Nawet po merge do `main`: FE 6 zestawów wpada do `tests/unit`+`tests/component` (gate'owane), `docGenerationRuntime` (server/) **w ogóle nie jest w żadnym workflow CI**, a work-canvas E2E **nie są w tier0** (jedyny E2E w test-suite) — biegają tylko w nightly/weekly (schedule).

---

## 4. Pułapki

| Pułapka | Ustalenie | Ocena |
|---|---|---|
| **WorkCanvasDocumentPanel — realny zapis czy mock?** | Mockuje globalny `fetch` (`vi.stubGlobal('fetch', fetchMock)`, linie 102/150/193…). Asercje na URL+payload (`/api/work-canvas/drafts`, `/export?format=...`). Testuje **kontrakt wywołań FE→API**, nie realną persystencję DB. | Solidne dla FE, ale „zapis"=mock. Realny zapis pokryty osobno w `work-canvas.routes` integration (sqlite/mock repo). |
| **Ścieżka za flagą ENABLE_DELIVERABLES_LIGHT — ON czy OFF?** | `docGenerationRuntime.ts` **sam nie czyta flagi** — flaga gate'uje na poziomie route'a (`deliverablesGenerations.routes.ts`, `FeatureFlags.ts`, `Gateway.ts`). Test wywołuje runtime bezpośrednio ⇒ zawsze testuje **ścieżkę ON** (logikę). | **Luka**: brak testu route'a z flagą OFF→404 i ON→202. Zachowanie gate'a (additywność, legacy redirect) nieprzetestowane automatycznie. |
| **act(...) warnings** | 3 testy autosave w WorkCanvasDocumentPanel logują React act-warning (stan po debounce poza `act`). | Dług testowy, nie fail. |

---

## 5. Backlog testowy (priorytetyzowany)

| # | Typ | Plik docelowy | Scenariusz | Priorytet |
|---|---|---|---|---|
| BT-1 | unit (fix) | `tests/components/AIChat/UnifiedChatPanel.test.tsx` | Dodać `setConversationChatLanguage: vi.fn()` (i inne language-actions) do mocka `conversationStoreState` → odblokowuje 14 FAIL + 4 rejections | **P0** |
| BT-2 | integration (BE) | `server/src/services/__tests__/canvasMaterialize.orgGuard.test.ts` (nowy) | **S7 org-guard**: materializacja z `sourceRefs` z innej org → `403 CANVAS_CROSS_ORG_REFERENCE` w obu writerach (save + accept-proposal). To zamknięty P0 audytu 2026-06-10 BEZ regresji-guarda. | **P0** |
| BT-3 | integration (BE) | `server/src/routes/__tests__/public-artifacts.routes.test.ts` (nowy) | **S6**: viewer `/public/artifacts/:token` (200 sanitizowany), revoke→410, zły token→404, rate-limit, brak auth-leak | **P0** |
| BT-4 | integration (BE) | `server/src/routes/__tests__/deliverablesGenerations.flag.test.ts` (nowy) | Flaga `ENABLE_DELIVERABLES_LIGHT`: OFF→404, ON→202+poll; legacy redirect verbatim przy OFF | **P1** |
| BT-5 | e2e (PR-gate) | dodać do `test:e2e:tier0` (package.json) | Włączyć min. 1 work-canvas smoke (np. `work-canvas-core-flow`) do tier0, by S1/S4/S5 miały gate na PR | **P1** |
| BT-6 | CI config | `.github/workflows/test-suite.yml` lub nowy `canvas-pr-gate.yml` | Dodać trigger `pull_request: [Londyn]` LUB job uruchamiający `server/` testy (m.in. `docGenerationRuntime`) — obecnie server-side testy poza CI | **P1** |
| BT-7 | e2e | `tests/e2e/smoke/work-canvas-share.spec.ts` (nowy) | S6 end-to-end: share → otwórz public viewer → revoke → 410 | **P2** |
| BT-8 | refactor (jakość) | `tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx` | Owinąć autosave-asercje w `act()`/`waitFor` — usunąć 3 act-warnings | **P2** |

### Scenariusze krytyczne BEZ testu E2E w PR-gate (wprost)
- **S6 (share/revoke/viewer)** — brak testu viewera/revoke jakiegokolwiek poziomu (tylko create-token w integration); brak E2E.
- **S7 (materializacja org-guard)** — brak testu cross-org 403; happy-path jest, regresja-guard nie.
- **S8 (eksport)** — eksport pokryty unit+integration, ale work-canvas eksport **nie ma E2E w tier0/PR-gate**.
- W praktyce: **wszystkie S1–S8 nie mają PR-gate** na obecnym workflow brancha (Londyn) — to systemowa luka CI, nie braki testów per se dla S1–S5/S8.
