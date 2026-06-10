# Canvas — plan pełnego wdrożenia i integracji ze strukturą komunikacji (2026-06-10)

Status: PROPOZYCJA do ratyfikacji (decyzje ownera D-C-1..D-C-5 na końcu).
Poprzednik: `docs/plans/CANVAS_VS_CLAUDE_ARTIFACTS_GAP_REVIEW.md` (przegląd luk vs Claude Artifacts)
oraz ratyfikowany `docs/plans/DELIVERABLES_LIGHT_TARGET.md` §11 (L2 Doc, D-L2-1..4).
Grunt: audyt kodu integracji (2026-06-10, branch `feat/deliverables-light`) — każdy krok poniżej
odwołuje się do realnego stanu kodu, nie do raportów.

---

## 0. Stan faktyczny (zweryfikowany w kodzie — korekty względem wcześniejszych raportów)

**Co JUŻ DZIAŁA (nie budować od nowa):**
- Startery Canvasa: `thoughts | document | research | decision | plan | presentation`
  (`src/types/canvasWorkspace.ts:3-11`). Research/decision = częściowe scaffoldy.
- **Canvas → workspace działa dla wszystkich 5 celów** (idea / note / initiative / decision / task):
  `POST /api/work-canvas/drafts/:draftId/save-to-workspace` → wspólny materializer
  `server/src/services/canvasMaterialize.ts:90-250`. Tworzy PRAWDZIWE rekordy:
  - idea → `my_ideas` + `my_idea_maps` (nagłówki H2 → węzły mapy!),
  - note → `notebookService.ingest()` z provenance,
  - decision/task/initiative → kanoniczne serwisy. Zwraca deep-linki do My Work.
- Streaming AI do edytora, TipTap, diff accept/reject, eksporty, L1 Deck E2E — patrz GAP_REVIEW §2.
- `notebookService.semanticSearch()` istnieje (FTS+embeddingi) — ale NIE jest podpięty do czatu.
- `artifact_registry` ma pola `sourceInitiativeId` + tabelę `ArtifactOriginLink` — ale canvas ich nie zasila
  i żaden widok ich nie czyta.

**Czego NIE MA (potwierdzone):**
- Starterów table/whiteboard/mindmap/processflow w Canvasie (wcześniejszy raport to przeszacował).
- Mostów zwrotnych: Notatka → Canvas, Idea → Canvas ("edytuj w Canvas").
- Akcji "Zrób dokument/deck z tego" na encjach (notatka, insight, inicjatywa, wywiad).
- `sourceRefs[]` w `CreateGenerationRequest` (jest tylko `sourceRef?` na pozycji planu — output, nie input).
- Narzędzi retrieval Teresy (search notes / insights / initiatives) — czat nie umie sam znaleźć źródła.
- UI historii wersji, switchera artefaktów, publicznego viewera share-linków.
- Walidacji org-scopingu w save-to-workspace (route nie sprawdza, czy target należy do org użytkownika).

**Bugi P0:** `canvas-stream-request` silent no-op; placeholdery "MVP-1…" (D-L2-3).

---

## 1. Architektura docelowa (jedno zdanie na warstwę)

```
        WEJŚCIA                         WARSZTAT                        WYJŚCIA
┌────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ Czat (intencja PL/EN)  │ →  │  CANVAS (split-view)     │ →  │ Outputs Library (registry)│
│ Encja: "zrób dokument  │    │  plan → generate →       │    │ Eksport PDF/DOCX/PPTX/XLSX│
│  z tego" (note/insight/│    │  validate → draft        │    │ Share link (public viewer)│
│  initiative/interview) │    │  + edycja TipTap + diff  │    │ Save-to-workspace:        │
│ Notatka → "rozwiń w    │    │  + wersje + patch-mode   │    │  Idea/Note/Initiative/    │
│  dokument"             │    │  + checklista Kimi       │    │  Decision/Task (DZIAŁA)   │
│ Teresa retrieval tools │    │                          │    │ Backlink na encji         │
└────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
```

Zasada: **Canvas = warsztat, Library = magazyn, encje (Notatki/Ideas/Inicjatywy) = obieg pracy.**
Każdy artefakt zna swoje źródła (sourceRefs → provenance) i swoje przeznaczenie (origin links → backlink).

Zasady wykonawcze (obowiązują każdy krok):
1. Additive, za flagą `ff_deliverablesLight` (lub nową `ff_canvasLifecycle` dla WS-B/C) — zero refaktorów wspólnych ścieżek.
2. Type-check po każdym kroku; commit per krok.
3. RULE verify-before-claiming: każda zmiana UI → preview + screenshot przed "done".
4. Wzorzec ConversationStore (332cf6a06e) dla wszystkich komunikatów interceptów.

---

## 2. Workstream A — Dokończenie rozpoczętego (L2 Doc + naprawy P0)

Pokrywa się z ratyfikowanym `DELIVERABLES_LIGHT_TARGET.md` §11.2. Tu doprecyzowane AC.

| # | Krok | Pliki | Acceptance criteria | Rozmiar |
|---|---|---|---|---|
| A1 | **Fix `canvas-stream-request` no-op.** Debug łańcucha: `canvasStreamIntentDetector` → CustomEvent (`WorkCanvasDocumentPanel.tsx:1416`) → `useCanvasAIStream`. Najpewniej: event emitowany zanim panel zamontuje listener / niezgodność draftId. Dodać: ack + komunikat błędu w czacie, gdy strumień nie wystartuje (koniec cichych porażek). | `src/components/AIChat/canvasStreamIntentDetector.ts`, `WorkCanvasDocumentPanel.tsx`, `useCanvasAIStream.ts` | Przy otwartym dokumencie "dopisz sekcję o celach" → tekst streamuje do edytora; gdy błąd → widoczny komunikat. Screenshot. | S |
| A2 | **D-L2-3: zero placeholderów.** Wyciąć "MVP-1…", "ASSUMPTION — NEEDS SOURCE" z output u użytkownika; założenia → inline badge. | generator dokumentów (stary path) + przyszły `docContentGenerator` | Żaden wygenerowany dokument nie zawiera tekstu deweloperskiego. | S |
| A3 | **`docContentGenerator.ts`**: `{intent, conversationContext?, sourceRefs[]}` → outline sekcji → realna proza per sekcja + mapa `sekcja → sources|assumptions`. | `server/src/services/deliverables/docContentGenerator.ts` (nowy) | Unit: dla intentu bez źródeł — proza + założenia inline; ze źródłami — cytowania per sekcja. | M |
| A4 | **Branch `doc`** w `deliverablesGenerationService` (`plan/start/status`) — ten sam kontrakt co deck. | `deliverablesGenerationService.ts`, `deliverablesGenerations.routes.ts` | `POST /generations {format:'doc'}` → 202 → poll → markdown w statusie draft. | S/M |
| A5 | **Intercept dokumentu w czacie**: `detectDocumentIntent` (już naprawiony) → checklista (wzorzec deck) → split-view starter `'document'` z wygenerowanym markdown w TipTap. Chip "Documents" przestaje przekierowywać do `/wordy`. | `UnifiedChatPanel.tsx` | "Napisz raport o X" → checklista → żywy dokument w Canvas; kontekst zachowany; PL i EN. Screenshot. | M |
| A6 | **Akcje per-sekcja v1**: Regenerate section (reuse selection→AI-edit). Expand/Condense — dopiero E1. | `CanvasAIFloatingMenu.tsx` | Regeneracja jednej sekcji nie zmienia pozostałych. | S |
| A7 | **Kosmetyka Document Studio** (z audytu): `&gt;` w starterze, breadcrumb, zły CTA. | Document Studio | Audyt §kosmetyka zamknięty. | S |

**Wyjście A:** Doc E2E = jakość L1 Deck. Czat jest jedynym potrzebnym wejściem dla dokumentów.

---

## 3. Workstream B — Cykl życia artefaktu (parytet z Claude Artifacts)

| # | Krok | Szczegół implementacji | Acceptance criteria | Rozmiar |
|---|---|---|---|---|
| B1 | **Historia wersji UI + restore.** Backend: tabela `work_canvas_versions` istnieje; dodać `POST /drafts/:id/versions/:versionId/restore` (restore = nowa wersja z treścią starej, bez kasowania historii). Frontend: selektor wersji w panelu (krokowanie ‹ › jak Claude), podgląd read-only przed przywróceniem. | `work-canvas.routes.ts`, nowy `CanvasVersionBar.tsx` | Cofnij się 3 wersje → podgląd → przywróć → nowa wersja na szczycie; autosave nie nadpisuje historii. | M |
| B2 | **Switcher artefaktów + chip w czacie.** (a) `activeArtifactId` do localStorage per conversation (dziś ginie po reloadzie); (b) dropdown/taby artefaktów rozmowy w nagłówku Canvasa (`useArtifactsStore` już trzyma listę); (c) **chip artefaktu w wiadomości czatu** — po zamknięciu panelu artefakt zostaje jako karta w transkrypcie, klik = reotwarcie (wzorzec Claude collapse-to-card). | `useArtifactsStore.ts`, `UnifiedChatPanel.tsx`, nowy `ArtifactChip.tsx` | 2 artefakty w jednej rozmowie → przełączanie bez utraty stanu; reload → ten sam aktywny artefakt; chip w czacie otwiera właściwy. | M |
| B3 | **Patch-mode (chirurgiczny update).** Analog `update` Claude: polecenie w czacie ("zmień tytuł sekcji 2") → AI zwraca operacje `{anchor: nagłówek/old_str, replacement}` zamiast pełnej regeneracji; aplikacja przez istniejące `canvasDiffOps` (marki accept/reject). Limit: ≤4 operacje per polecenie, inaczej fallback do replace-section. | `useCanvasAIStream.ts` (nowy mode `patch`), prompt serwera w `/api/ai/chat/stream` | Zmiana 1 zdania w 5-stronicowym dokumencie nie dotyka reszty (diff pokazuje tylko target); czas < 5 s. | M |
| B4 | **Auto-emisja artefaktu.** Heurystyka po stronie odpowiedzi Teresy: odpowiedź samodzielna i > ~15 linii markdown (raport/lista/spec) → zamiast ściany tekstu chip "Otwórz jako dokument" (tworzy draft z treści odpowiedzi). Bez auto-otwierania panelu (mniej inwazyjnie niż Claude) — decyzja D-C-4. | handler odpowiedzi w `UnifiedChatPanel.tsx` + reuse draft create | Długa odpowiedź → chip; klik → dokument w Canvas z pełną treścią; krótkie odpowiedzi bez chipa. | M |

**Wyjście B:** artefakt ma pełny cykl życia: powstaje (intencja/auto), żyje (wersje, patch), wraca (chip/switcher).

---

## 4. Workstream C — Połączenie ze strukturą komunikacji (dokumenty, Ideas, Notatki, encje)

To jest serce tego planu. Kierunek 1: **encja → Canvas** (twórz z kontekstu). Kierunek 2: **Canvas → encja**
(już działa — wzmocnić). Kierunek 3: **Teresa sama znajduje źródła** (retrieval).

| # | Krok | Szczegół implementacji | Acceptance criteria | Rozmiar |
|---|---|---|---|---|
| C1 | **`sourceRefs[]` w kontrakcie generacji.** Rozszerzyć `CreateGenerationRequest` o `sourceRefs?: Array<{type:'note'\|'insight'\|'initiative'\|'interview'\|'artifact', id: string}>`. Serwerowy **resolver źródeł**: per typ pobiera treść (notebook page / insight card / initiative charter / transkrypt) i podaje do `docContentGenerator` / `generateOutline` jako grounding. Walidacja org-scope w resolverze. | `server/src/types/deliverablesGeneration.ts`, nowy `server/src/services/deliverables/sourceResolver.ts` | `POST /generations {format:'doc', sourceRefs:[{note,id}]}` → sekcje cytują treść notatki (chips źródeł per sekcja — D-L2-2a). | M |
| C2 | **Akcja "Zrób dokument / prezentację z tego" na encjach.** Context action w widokach: notatka (notebook page), insight card, inicjatywa, wywiad (sesja). Klik → otwiera czat z prefilled intentem + `sourceRefs` → standardowy flow (checklista → Canvas). ZERO nowych formularzy. Kolejność wdrażania: notatka → inicjatywa → insight → wywiad. | widoki encji w `src/components/MyWork/`, `Initiatives/`, `Insights/`, `Interview/` + `UnifiedChatPanel` (przyjęcie seedu) | Z notatki: 1 klik → checklista → dokument ugruntowany w treści notatki. Screenshot per encja. | M (×4 encje, każda S po pierwszej) |
| C3 | **Notatka → Canvas ("Rozwiń w dokument" / "Otwórz w Canvas").** Wariant lekki C2 dla samej treści: utwórz canvas draft z markdown notatki (provenance: `{sourceType:'notebook', sourceId}`), edytuj/rozbuduj z Teresą, zapis: nowy artefakt LUB aktualizacja notatki (decyzja D-C-2 — rekomendacja: **kopiowanie z provenance, bez live-sync w v1**). | notebook page UI + `work-canvas` draft create | Notatka → draft w Canvas z pełną treścią; po edycji save-to-workspace(note) tworzy NOWĄ stronę z linkiem do oryginału. | S/M |
| C4 | **Backlink Canvas→encja (domknięcie pętli).** Po save-to-workspace: (a) komunikat w czacie z deep-linkiem (materializer już zwraca URL); (b) na utworzonej encji widoczny badge "Źródło: Canvas/rozmowa" (provenance już zapisywany — wystarczy wyrenderować); (c) draft dostaje `materializedTo[]`, widoczne w panelu. | `canvasMaterialize.ts` (bez zmian), widoki encji, `WorkCanvasDocumentPanel` | Idea utworzona z Canvasa pokazuje skąd pochodzi; z drafta widać, co z niego powstało. | S |
| C5 | **Ideas ↔ Canvas przez deep-link (NIE render w Canvasie — D-C-1).** (a) Canvas→Idea już tworzy mapę (H2→węzły) — dodać CTA "Otwórz mapę" po zapisie; (b) Idea→czat: akcja "Omów z Teresą" na mapie — serializuje nodes/edges do markdown i seeduje rozmowę (dalej standardowy flow, np. "zrób z tego inicjatywę/dokument"). Startery whiteboard/mindmap w Canvasie = anti-scope v1 (osobne narzędzia Ideas są lepsze; overhaul Ideas to oddzielny projekt). | `IdeaMapWorkspace.tsx`, `canvasMaterialize.ts` (CTA) | Mapa myśli → "Omów z Teresą" → czat zna strukturę mapy → "zrób dokument" działa z C1/C2. | M |
| C6 | **Narzędzia retrieval Teresy.** Tool `search_org_notes` (wrap `notebookService.semanticSearch()` — gotowy, niewpięty), `get_initiative`, `search_insights`. Rejestracja w tool-handlerze czatu + RBAC org-scope. Efekt: "zrób dokument z notatki o spotkaniu z Elkomtech" działa bez ręcznego wskazywania — Teresa znajduje notatkę, proponuje sourceRefs, user potwierdza. | server tool registry czatu (persona/handler), `notebookService.ts` | Zapytanie po nazwie tematu → Teresa cytuje właściwą notatkę i proponuje generację z niej; brak dostępu cross-org (test negatywny). | M/L |
| C7 | **Zasilanie artifact_registry + panel "Artefakty" na inicjatywie.** (a) Canvas output creation woła rejestrację artefaktu (`ArtifactOriginLink`: originRuntime='work_canvas', originRecordId=draftId, sourceInitiativeId gdy znane z sourceRefs); (b) na widoku inicjatywy panel "Powiązane artefakty" (filtr `sourceInitiativeId` już istnieje w `ArtifactListFilters`). | `work-canvas.routes.ts` (createOutputResource), `artifactRegistryService.ts`, widok inicjatywy | Deck wygenerowany z inicjatywy widoczny na karcie inicjatywy; klik → Outputs/Workspace. | M |
| C8 | **Security: org-scoping w save-to-workspace.** Walidacja, że target (np. initiativeId przy proposal) należy do org żądającego; testy negatywne. | `work-canvas.routes.ts:3772-3836` | Próba zapisu do cudzej inicjatywy → 403. | S |

**Wyjście C:** pełny obieg: notatka/insight/inicjatywa/wywiad → Canvas (ugruntowany dokument/deck)
→ Outputs Library → z powrotem jako Idea/Notatka/Inicjatywa/Decyzja/Task z provenance w obie strony.
Teresa zna treść organizacji (retrieval), więc komunikacja "zrób X z Y" działa językiem naturalnym.

---

## 5. Workstream D — Dystrybucja

| # | Krok | Szczegół | AC | Rozmiar |
|---|---|---|---|---|
| D1 | **Public share viewer.** Route `/public/artifacts/:token` (token już generowany) — read-only render dokumentu/decka, brand DRD, bez auth; revoke. | `work-canvas.routes.ts`, nowy public view | Link działa w incognito; revoke unieważnia. | M |
| D2 | **Use-as-template / Duplicate** w Outputs Library (odpowiednik Remix Claude; akcje z TARGET_DESIGN §3). | Outputs Library UI + registry | Duplikat artefaktu jako nowy draft w Canvas. | S/M |
| D3 | **Outputs Library upgrade** (chipy filtrów: Type/Owner/Status/Tag; akcje; statusy Draft/Review/Final/Sent) — wg L4 z TARGET_DESIGN. | hub Outputs | Wg §3 TARGET_DESIGN. | L |

## 6. Workstream E — Polish edycji (przewagi ChatGPT Canvas + Kimi/Gamma)

| # | Krok | AC | Rozmiar |
|---|---|---|---|
| E1 | Menu skrótów na zaznaczeniu: Skróć / Rozwiń / Zmień ton (formalny↔prosty) / Wyjaśnij (do czatu) — rozszerzenie istniejącego floating menu | 4 akcje działają przez istniejący diff accept/reject | S/M |
| E2 | Tool-trace w checkliście (Kimi): rozwijane karty kroków generacji (plan → źródła → sekcje) | Krok checklisty rozwija szczegół (które źródła użyte) | S |
| E3 | Per-card AI menu w decku (Gamma): Regenerate / Alternative layout na karcie w `CardRenderer` | Regeneracja 1 karty nie zmienia pozostałych | M |
| E4 | (Później) Anchored comments z Apply; edycja diagramów; L3 Sheet — poza zakresem tego planu | — | — |

---

## 7. Sekwencja i zależności

```
FAZA 1 (P0 — odblokowanie):        A1 → A2 → C8        [A1 blokuje B3 i sens całego L2]
FAZA 2 (L2 Doc E2E):               A3 → A4 → A5 → A6 → A7
FAZA 3 (obieg encji — rdzeń C):    C1 → C2(notatka) → C4 → C2(reszta encji) → C3
FAZA 4 (cykl życia):               B1, B2 (równolegle z Fazą 3 — inne pliki) → B3 → B4
FAZA 5 (inteligencja + registry):  C6, C7, C5 (niezależne od siebie)
FAZA 6 (dystrybucja + polish):     D1, D2, E1, E2, E3 → D3 (na końcu, L4)
```

Równoległość dla agenta-developera: Faza 3 (server+widoki encji) i Faza 4 (frontend Canvas) nie kolidują plikami —
mogą iść w dwóch wątkach. Faza 1 i 2 sekwencyjnie (wspólne pliki UnifiedChatPanel/useCanvasAIStream).

Szacunek łączny (dev-dni agenta, kalibracja: L1 Deck = 6 kroków ≈ 1 dzień):
Faza 1 ≈ 1 d · Faza 2 ≈ 2–3 d · Faza 3 ≈ 3 d · Faza 4 ≈ 3 d · Faza 5 ≈ 3–4 d · Faza 6 ≈ 3 d (bez D3).
**Razem ≈ 15–17 dni agenta** do pełnej realizacji funkcji Canvasa (bez D3/E4).

---

## 8. Ryzyka

1. **A1 (stream no-op) może być głębszy niż timing eventu** — jeśli problem leży w serwerowym SSE route,
   naprawa rośnie do M. Mitygacja: timeboxed debug 0.5 d, potem decyzja.
2. **C6 (tool registry)** — Teresa-chat ma SOT w `persona.ts` (patrz memory: assistant-prompt-SOT);
   dopisywanie tooli wymaga ostrożności, by nie zepsuć response-discipline. Mitygacja: feature-flag + testy promptów.
3. **Race między tym planem a agentem Kimi** — agent realizuje L2 z TARGET_TARGET §11; ten plan DODAJE
   workstreamy B–E, nie zmienia L2. Wymagana koordynacja: WS-A wykonuje agent Kimi, WS-B/C można zlecić drugiemu wątkowi.
4. **Org-scoping (C8)** — do zrobienia PRZED udostępnieniem share-linków (D1), inaczej eskalacja ryzyka wycieku.
5. **B4 (auto-emisja)** — ryzyko nadgorliwości (artefakt z każdej odpowiedzi). Mitygacja: konserwatywny próg + chip zamiast auto-otwarcia.

## 9. Decyzje do ratyfikacji przez ownera

| ID | Pytanie | Rekomendacja |
|---|---|---|
| D-C-1 | Ideas (mapa/whiteboard/flow) w Canvasie: render w split-view czy bridge deep-linkami? | **Bridge** (C5). Render = duplikacja silników, koliduje z Ideas-overhaul. Po unifikacji Ideas można wrócić do tematu. |
| D-C-2 | Notatka ↔ Canvas: live-sync czy kopiowanie z provenance? | **Kopiowanie z provenance** v1. Live-sync wymaga CRDT/locking — anti-scope. |
| D-C-3 | Zakres retrieval Teresy v1: same notatki czy notatki+insighty+inicjatywy? | **Wszystkie trzy** (C6) — bez tego "zrób dokument z X" działa tylko dla notatek, a klientela pracuje na insightach/inicjatywach. |
| D-C-4 | Auto-emisja artefaktu: auto-otwarcie panelu (jak Claude) czy chip "Otwórz jako dokument"? | **Chip** — mniej inwazyjne, zero ryzyka przykrycia czatu. |
| D-C-5 | Kto wykonuje: wszystko agent Kimi sekwencyjnie czy WS-B/C w równoległym wątku? | **Dwa wątki** (pliki nie kolidują); merge-points po Fazie 2 i 4. |
