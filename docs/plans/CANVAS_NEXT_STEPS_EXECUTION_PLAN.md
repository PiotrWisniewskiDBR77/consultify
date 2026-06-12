# Canvas — precyzyjny plan następnych kroków (2026-06-10, po falach 1–3)

Stan wejściowy: triada deck/doc/sheet DONE (agent Kimi); fale 1–3 programu Canvas DONE
(C8, B1, D1+D1b, C6, E1, B2, C7, C4) — patrz `CANVAS_FULL_INTEGRATION_PLAN.md` (status w nagłówku).

**Dokumenty siostrzane (ten sam dzień, drugi wątek):** `DELIVERABLES_NEXT_STEPS_EXECUTION_PLAN.md`
+ `DELIVERABLES_TARGET_EXPERIENCE_SPEC.md` — plany są ZBIEŻNE: tamtejsze A1/A2 `[C]` = tutejszy
KROK 1; tamtejsza FAZA dot. sourceRefs = tutejsze KROKI 4–5 `[D]`. Uwaga dla wykonawcy A1:
sygnatura `setContent(html, {emitUpdate:false})` jest już ZWERYFIKOWANA jako poprawna dla
TipTap 3.14 — punkt "sprawdzić sygnaturę" z planu deliverables można pominąć.
Kolejność poniżej jest ZALEŻNOŚCIOWA — nie przestawiać kroków 1–3 przed dalsze.

Zasady: additive, type-check po kroku, commit per krok, RULE verify-before-claiming
(UI = preview + screenshot), wzorzec ConversationStore dla komunikatów w czacie.

---

## KROK 0 — Środowisko (5 min, przed wszystkim)
- [ ] Włączyć `ENABLE_TERESA_RETRIEVAL=true` w `.env.staging.local` (deliverables-flagi już są — potwierdził Kimi w handoffie).
- [ ] `npm run dev:stable` musi wstawać czysto; jeśli nie — najpierw to.

## KROK 1 — P0: bug-korzeń "edytor nie przyjmuje zewnętrznej treści" (0.5–1 d)
Źródło: `docs/handoff/DELIVERABLES_X_CANVAS_REFRESH_HANDOFF.md`. Jeden fix zamyka DWA objawy:
(a) skeleton nie zamienia się w finalną treść po `deliverables:draft-ready`,
(b) cichy no-op canvas-streamingu (audyt `DOC_ENTRY_UX_AUDIT.md` §1D).

**Fakt zweryfikowany 2026-06-10:** sygnatura `setContent(html, { emitUpdate: false })`
w `CanvasRichEditor.tsx:155` jest POPRAWNA dla TipTap 3.14 (sprawdzone w
`node_modules/@tiptap/core/dist/index.d.ts:3030-3050`). NIE szukać tam. Debug celować w:

1.1 Repro z instrumentacją: "Napisz raport o X" w czacie → log w trzech punktach:
    (i) listener `deliverables:draft-ready` w `WorkCanvasDocumentPanel` (czy odpala i czy
    `documentState.draftId` faktycznie pasuje do `detail.draftId`),
    (ii) czy `setDocumentState` po fetchu dostaje NOWE `contentMd`,
    (iii) czy prop `contentMd` w `CanvasRichEditor` SIĘ ZMIENIA (effect :146 — guard
    `contentMd === lastExternalMdRef.current`).
1.2 Hipoteza główna (po wykluczeniu sygnatury): **switcher/mountOverride** (B2) montuje inny
    draft niż draft generacji — po remoncie aktywny jest "Working document" (boilerplate),
    a finalna treść ląduje w draftcie, którego panel nie pokazuje. Sprawdzić `mountOverride`
    + `activeArtifactId` w momencie eventu.
1.3 Fix: (a) switcher nasłuchuje `deliverables:draft-ready` → ustawia draft generacji jako
    aktywny artefakt (`useArtifactsStore.setActiveArtifact`), (b) jeśli dodatkowo przepływ
    propsa jest zerwany — naprawić go (stale closure listenera / klucz mountu).
1.4 Tym samym torem zweryfikować streaming: przy otwartym dokumencie "dopisz sekcję o celach"
    → tekst pojawia się w edytorze; gdy strumień nie wystartuje → widoczny błąd w czacie
    (koniec cichych porażek).

**AC:** szkielet → finalna treść bez przeładowania (screenshot przed/po); streaming do
otwartego dokumentu działa PL/EN; test regresji: zwykła edycja + autosave nieuszkodzone.

## KROK 2 — Smoke wizualny fal 1–3 (0.5 d, równolegle z krokiem 1 na drugim ekranie)
W preview, po kolei, ze screenshotami:
- [ ] B1: historia wersji — lista, podgląd, Przywróć, nowy wpis `restore_version`.
- [ ] E1: Skróć/Rozwiń/Ton/Wyjaśnij — diff accept/reject; Wyjaśnij NIE zmienia dokumentu.
- [ ] B2: 2 artefakty w rozmowie → switcher; chip po zamknięciu panelu; reload → chip żyje.
- [ ] C4: save-to-workspace → klikalny "Otwórz"; lista "Utworzone z tego dokumentu"; badge
      "Źródło: Canvas" na notatce.
- [ ] C7: deck z `sourceType: INITIATIVE` → sekcja "Artefakty" na inicjatywie.
- [ ] D1/D1b regresja: share → incognito → revoke → 404.
Znaleziska naprawiać od ręki (małe) albo dopisywać do tego planu (duże).

## KROK 3 — Bug M-5 (S; chip task_51148b11 albo inline)
`work-canvas.routes.ts` M-5 endpoint: `originRuntime: 'work_canvas' as any` → zod odrzuca → 500.
Fix: dodać `'work_canvas'` do enum `ArtifactOriginRuntime` (`server/src/types/artifactRegistry.ts`)
+ schema zod w `artifactRegistryService`. **AC:** endpoint 200 + wpis w registry.

## KROK 4 — C1: `sourceRefs[]` w kontrakcie generacji (M, server-only)
4.1 `CreateGenerationRequest` + `sourceRefs?: Array<{type:'note'|'insight'|'initiative'|'interview'|'artifact', id}>`
    (`server/src/types/deliverablesGeneration.ts`) — UZGODNIĆ z formatem `sourceHints`,
    który L2/L3 już częściowo czyta (`docGenerationRuntime` → `intake.sourceHints`); jeśli
    sourceHints wystarcza — tylko go skanonizować i udokumentować, NIE dublować pola.
4.2 Nowy `server/src/services/deliverables/sourceResolver.ts`: per typ pobiera treść
    (notebookService / insight service / initiativeService / transkrypt wywiadu), walidacja
    org-scope (wzorzec guardu z canvasMaterialize), cap ~8KB łącznie, zwraca
    `{ref, title, content, url}[]`.
4.3 Wpiąć w `docContentGenerator`/`generateOutline`: sekcje cytują źródła → chipy źródeł
    per sekcja (D-L2-2a); bez źródeł → założenia inline (D-L2-2b, już działa).
**AC:** `POST /generations {format:'doc', sourceRefs:[{note,id}]}` → dokument cytuje treść
notatki; cross-org id → 403/pominięte z warningiem.

## KROK 5 — C2: akcje "Zrób dokument/prezentację z tego" na encjach (M; po kroku 4)
Kolejność encji: **notatka → inicjatywa → insight → wywiad** (każda następna = S po pierwszej).
Wzorzec (identyczny dla wszystkich): przycisk/menu na widoku encji → nawigacja do czatu
z seedem `{intent: 'doc'|'deck', sourceRefs:[{type,id}], tytuł sugerowany}` → istniejący
intercept flow (checklista → Canvas). ZERO formularzy. Seed przez ten sam mechanizm,
którym chip "Documents" kiedyś robił kickoff (sprawdzić `setChatKickoffMessage` — naprawiony
przepływ z L2). **AC per encja:** 1 klik → checklista → artefakt ugruntowany; screenshot.

## KROK 6 — C3: "Rozwiń w dokument" na notatce (S/M; po kroku 5-notatka)
Wariant C2 bez generacji: utwórz draft Canvas z markdown notatki (provenance
`{sourceType:'notebook', sourceId}`), otwórz split-view. Zapis → NOWA strona notatnika
z linkiem do oryginału (decyzja D-C-2: kopiowanie, nie sync).
**AC:** notatka → draft z pełną treścią → edycja z Teresą → save-as-note z backlinkiem.

## KROK 7 — B3: patch-mode (M; po kroku 1!)
Tryb `patch` w `useCanvasAIStream`: polecenie w czacie → AI zwraca operacje
`{anchor (nagłówek sekcji lub old_str), replacement}` (≤4 op; więcej → fallback replace-section)
→ aplikacja przez `canvasDiffOps` (istniejące marki accept/reject). Prompt serwera:
rozszerzenie istniejącego trybu w `/api/ai/chat/stream` (nie nowy endpoint).
**AC:** "zmień tytuł sekcji 2" w 5-stronicowym dokumencie → diff TYLKO na celu, <5 s.

## KROK 8 — C5: Ideas ↔ czat (M)
8.1 Po save-to-idea: CTA "Otwórz mapę" (deep-link już zwracany przez materializer).
8.2 Na mapie (IdeaMapWorkspace): "Omów z Teresą" → serializacja nodes/edges do markdown
    (lista zagnieżdżona wg krawędzi) → seed czatu. Dalej standardowy flow ("zrób z tego
    dokument/inicjatywę" działa przez kroki 4–5).
**AC:** mapa → czat zna strukturę → wygenerowany dokument odzwierciedla gałęzie mapy.

## KROK 9 — B4: auto-emisja artefaktu (M)
Heurystyka na finalnej odpowiedzi Teresy (handler odpowiedzi, nie streaming): samodzielna
treść dokumentowa >~15 linii markdown z nagłówkami → chip "Otwórz jako dokument"
(tworzy draft z treści; NIE auto-otwiera panelu — decyzja D-C-4). Konserwatywny próg;
wykluczyć odpowiedzi konwersacyjne, listy kroków "jak coś zrobić", odpowiedzi z toolingu.
**AC:** raportowa odpowiedź → chip; 10 zwykłych odpowiedzi → zero chipów (test listą promptów).

## KROK 10 — D2: Use-as-template / Duplicate w Outputs Library (S/M)
Akcja na artefakcie: duplikuj → nowy draft w Canvas (kopiuje treść + typ; provenance
`duplicatedFrom`). **AC:** duplikat edytowalny, oryginał nietknięty.

## KROK 11 — E2 + E3: polish generacji (S + M)
E2: checklista → rozwijane karty kroków (które źródła użyte per sekcja — dane z kroku 4.3).
E3: per-card AI menu w decku (Regenerate / Alternative layout) w `CardRenderer`.
**AC:** regeneracja 1 karty nie zmienia pozostałych.

## KROK 12 — D3 + L4: Outputs Library upgrade + retire (L; OSOBNA decyzja ownera przed startem)
Hub: chipy filtrów (Type/Owner/Status/Tag), statusy Draft/Review/Final/Sent, akcje.
Retire-list z `DELIVERABLES_LIGHT_TARGET.md` §6: wygaszenie `/presentation-studio`,
`PresentationsHub`, nadmiarowych ścieżek PDF; Document Studio → "pro mode".

## KROK 13 — QA + merge (po krokach 1–9)
- [ ] Pełny E2E run: J1–J7 ze specyfikacji (`CANVAS_TARGET_FUNCTIONAL_SPEC.md`) — raport
      do `docs/qa/runs/<data>/`.
- [ ] Merge `feat/deliverables-light` → `Londyn` (staging), smoke na staging.
- [ ] Produkcja: wyłącznie przez plan promotion (osobny projekt staging→prod, bez skrótów).

---

## Przydział i równoległość
- **Wątek 1 (Kimi / deliverables):** kroki 4 → 5 → 11(E2) — kontynuacja jego L2/L3 sourceHints.
- **Wątek 2 (canvas):** kroki 1 → 2 → 3 → 7 → 9 — pliki CanvasEditor/stores/panel.
- **Wątek 3 (dowolny):** kroki 6, 8, 10 — pliki encji, niezależne.
- Merge-pointy: po kroku 1 (odblokowuje 7), po krokach 4+5 (odblokowują 6, 11).

## Szacunki łączne
Kroki 1–3: ~1.5–2 d · 4–6: ~3 d · 7–9: ~3 d · 10–11: ~1.5 d · 13: ~1 d. **Razem ~9–10 dni
agentów do pełnej funkcjonalności** (bez kroku 12, który wymaga osobnej decyzji).

---

## Statusy (2026-06-11, runda Opus)

Cała ścieżka canvas DOMKNIĘTA poza live-smoke i fazą D3/L4:
- **KROK 6 C3 ✅** (51750182) · **KROK 7 B3 patch-mode ✅** (835936ac) · **KROK 8 C5 ✅** (72e9a470 —
  „Omów z Teresą" na mapie) · **KROK 9 B4 auto-emisja ✅** (5115dbe6 — chip „Otwórz jako dokument",
  heurystyka 8/8, decyzja D-C-4 = chip nie auto-panel) · **KROK 10 D2 ✅** (4fd92adf — „Duplikuj/
  Użyj jako szablonu" w Outputs).
- Sibling (Kimi): entity-grounding (C1/C2), sekcja Źródła, telemetria, D1 charter — DONE.
- **KROK 11 E3 ✅** (`36a6f240`) — `regenerateSlide` real LLM impl (narrative engine dla text-heavy
  slides + contextPack snapshot) + route + CardCanvas hover menu + DeckBuilder handler.
- **KROK 3 M-5 ✅** (`b4c7eb3c`) — `'work_canvas'` dodane do `ArtifactOriginRuntimeValues`; `sourceRefs`
  shape naprawiony na `{sourceType, sourceId, sourceTitle}`; eliminuje `as any` casts + runtime 500.
- **KROK 11 E2 ✅** (`7f8b0e58`) — `deckGenerationChecklist` + `planItems[]` + `sources[]`; tytuły sekcji
  planu jako pod-punkty po `plan_ready`; tytuły źródeł org jako pod-punkty; wszystkie 3 formaty (deck/doc/sheet).
- **Pozostało:** live-smoke wizualny B3/B4/C5/D2 (jedna sesja preview);
  KROK 12 D3+L4 (osobna decyzja ownera — retire-lista). UnifiedChatPanel.test: 29/29 PASS.
