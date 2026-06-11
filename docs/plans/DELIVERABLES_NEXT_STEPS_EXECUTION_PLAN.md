# Deliverables — precyzyjny plan następnych kroków (stan po 2026-06-10)

> **Punkt wyjścia:** triada deck/doc/sheet działa chat-natywnie za flagami (L1–L3 DONE,
> `docs/plans/DELIVERABLES_LIGHT_TARGET.md` §10–12; raport dnia `docs/reports/2026-06-10-…`).
> **Cel planu:** od „działa za flagą na dev" do „to jest TO doświadczenie, włączone dla klientów".
> Każdy krok: pliki → kryterium DONE → właściciel. Kolejność = zależności, nie priorytet emocjonalny.
> Spec docelowa (jak ma działać całość): `DELIVERABLES_TARGET_EXPERIENCE_SPEC.md`.

**Właściciele:** `[D]` workstream deliverables · `[C]` workstream canvas (druga sesja) · `[P]` decyzja Piotra.

---

## FAZA A — Domknięcie pętli Kimi (bez tego doświadczenie jest 90%, nie 100%)

### A1. Fix zewnętrznej synchronizacji treści edytora `[C]` — BLOKER dla A2–A4
- **Problem (dowiedziony):** `CanvasRichEditor` ignoruje zewnętrzne zmiany `contentMd` —
  effect ~l.146 (`editor.commands.setContent(html, { emitUpdate: false })`). Ten sam korzeń:
  (a) szkielet nie podmienia się na finalną treść po generacji, (b) cichy no-op canvas-streamingu.
- **Kroki:** 1) test jednostkowy reprodukujący (mount → zmiana prop `contentMd` → assert HTML
  edytora); 2) sprawdzić sygnaturę `setContent` dla wersji TipTapa w repo (obiekt vs boolean
  jako 2. argument) i guard `isExternalUpdateRef`; 3) fix + test zielony.
- **DONE gdy:** wysłanie `deliverables:draft-ready` (kontrakt w
  `docs/handoff/DELIVERABLES_X_CANVAS_REFRESH_HANDOFF.md`) podmienia szkielet na treść
  bez przeładowania strony — wideo/screenshot.

### A2. Switcher artefaktów honoruje nowe generacje `[C]`
- Po `deliverables:draft-ready` aktywnym artefaktem rozmowy staje się świeży draft
  (dziś tab „Working document"/boilerplate potrafi przykryć wynik generacji).
- **DONE gdy:** generacja doc/sheet ⇒ jej tab aktywny; „Working document" nie powstaje
  jako efekt uboczny remountu (nie tworzyć boilerplate-draftu, gdy `initialDraftId` jest podany).

### A3. Streaming treści do panelu (upgrade z „szkielet→podmiana” do „rośnie na oczach") `[D]` ✅ DONE
- **Zrobione (744283a5):** `runStreamingDocGeneration` generuje sekcja-po-sekcji (każde wywołanie
  widzi tytuły poprzednich sekcji → koherencja), zapisuje draft progresywnie po każdej sekcji
  → panel re-hydratuje. Za flagą `ENABLE_DELIVERABLES_DOC_STREAMING` (OFF ⇒ one-shot).
- **DONE — live-proof:** pierwsza sekcja w ~3s (vs ~18s one-shot), 5 sekcji 3→18s, realna proza.
  Time-to-first-content — metryka §8 — drastycznie w dół. Padnięte sekcje znaczone inline; all-fail ⇒ error.

### A4. Retest triady E2E + smoke wizualny `[D]`
- Pełny przebieg deck/doc/sheet na świeżej konwersacji; screenshoty do `docs/qa/runs/<data>/`.
- **DONE gdy:** 3/3 formaty: checklista → artefakt od szkieletu → finalna treść bez reloadu.

## FAZA B — Wejście z encji + grounding w danych org (moat; D-L2-1/2 część 2)

### B1. Afordancja „Zrób z tego…” na kartach encji `[P]→[D]`
- **Najpierw decyzja UX `[P]`:** umiejscowienie per kanon `TABLE_AND_PREVIEW_CANON` /
  Menu 1/2/3 — proponuję pozycję w Menu 3 (akcje wiersza/karty): „Zrób z tego → Dokument /
  Prezentację / Arkusz" dla: insight, notatka, inicjatywa, wynik wywiadu.
- **Implementacja `[D]`:** klik → otwiera czat z prefillem intencji + `sourceRefs=[{sourceType,
  sourceId, sourceTitle}]` → istniejący kontrakt (`setup.sourceRefs` już przyjmowany przez
  `planDoc`/`planSheet`; deck: mapowanie na `SourceArtifact[]`).
- **DONE gdy:** z karty insightu jednym klikiem powstaje dokument ugruntowany w tym insighcie.

### B2. Resolver sourceRefs → treść (doc/sheet) `[D]`
- Deck ma `buildContextPack`; doc/sheet przekazują dziś `sourceHints` bez gwarancji użycia.
- **Kroki:** w `startDoc`/`startSheet` budować ContextPack z sourceRefs (reuse
  `contextPackBuilder.buildContextPack`) i wstrzykiwać do promptu D11/sheet jako sekcję
  „Źródła organizacji”; w outputach lista źródeł na końcu dokumentu (already: renderer Sources).
- **DONE gdy:** dokument z B1 cytuje fakty z encji źródłowej (manualny przegląd treści vs encja).

### B3. Chipy źródeł i założeń per sekcja (UI) `[D]`
- v1: pod każdą sekcją pasek chipów: źródła (klik → otwiera encję) + licznik założeń;
  v1 NIE robi chipów per zdanie (spec §6 doc. docelowego).
- **DONE gdy:** wygenerowany dokument pokazuje skąd pochodzi sekcja; klik prowadzi do źródła.

### B4. Auto-grounding (Teresa sama szuka) `[D]+[C]` — synergia z `ENABLE_TERESA_RETRIEVAL`
- Reuse świeżych narzędzi retrieval (searchOrgNotes/searchInsights/getInitiative) jako
  pre-step planu: intencja → top-N encji → propozycja źródeł w checkliście
  („Znalazłam 6 źródeł — użyć? [Tak] [Wybierz]”).
- Zakres v1: 4 typy encji (wywiady, insighty, inicjatywy, KPI) — zgodnie z decyzją z dyskusji.
- **DONE gdy:** „napisz raport o transformacji” bez wskazywania źródeł daje dokument
  z chipami źródeł znalezionych automatycznie.

## FAZA C — Edycja-lekka: dokończenie pętli pracy nad artefaktem

### C1. Per-sekcja akcje dokumentu `[D]`
- Pasek nad sekcją (hover): **Rozwiń · Skróć · Zmień ton · Podeprzyj danymi · Regeneruj**.
- Reuse: selection-shortcuts E1 (już w canvas: Skróć/Rozwiń/Ton/Wyjaśnij na zaznaczeniu) —
  per-sekcja = te same operacje z automatycznym zaznaczeniem zakresu sekcji. Wymaga A1.
- **DONE gdy:** każda akcja działa z accept/reject diff na jednej sekcji, bez naruszania reszty.

### C2. Edytowalny outline przed generacją `[D]`
- Kontrakt już przyjmuje edytowany plan (`StartGenerationRequest.plan`); brakuje UI.
- v1: checklista planu w czacie z toggle per sekcja + „Generuj” (przycisk zamiast auto-startu —
  ZA flagą wariantową, default auto-start zostaje; pomiar która ścieżka lepsza).
- **DONE gdy:** użytkownik może wyłączyć sekcję planu i dostaje dokument bez niej.

### C3. Per-karta akcje decka `[D]`
- **KOREKTA (2026-06-11, code-verified):** `regenerateSlide` w `presentationGeneratorService`
  to STUB — zwraca istniejący slajd bez regeneracji. Realne C3 = wywołanie LLM per slajd
  + spójna aktualizacja `unified_json` ORAZ `deck_json` (builder-cache czytany pierwszy).
  Pół dnia chirurgii na silniku decka; koordynować z workstreamem canvas (deck hygiene d61f532f).
- **DONE gdy:** regeneracja jednej karty nie dotyka pozostałych; widoczny stan ładowania karty.

## FAZA D — Droga na produkcję

### D1. QA staging z flagami ON `[D]`
- Pełny charter: 3 formaty × (happy path, błąd LLM, podwójny start, restart serwera w trakcie,
  RBAC: VIEWER bez `presentation_create`, cross-org izolacja draftów), eksporty (PPTX/DOCX/PDF/XLSX),
  mostek Table Studio. Raport do `docs/qa/runs/`.
### D2. Telemetria `[D]`
- Zdarzenia: `deliverable_generation_{requested,plan_ready,completed,failed}` z {format, durationMs,
  sectionCount, groundingMode, language} do istniejącego analytics. Bez tego nie zmierzymy §8 spec.
### D3. Włączenie flag `[P]`
- Kolejność: staging ON (po D1) → prod ON dla DBR77/demo → prod ON dla klientów.
  Zależność zewnętrzna: promocja Londyn→prod (osobny projekt). Rollback = flagi OFF (bez migracji).
### D4. L4 retire-list `[D]` — DOPIERO po ≥1 tyg. stabilnych flag-on
- Wygasić: chat-redirecty legacy (kod za `else` flagi), wejściowy formularz Document Studio
  (zostaje „tryb pro”/governance), martwy `PresentationsHub`, nadmiarowe ścieżki PDF (§6 planu).
- Każde wygaszenie osobnym commitem z grep-dowodem braku referencji.

## FAZA E — Różnicujące (po D — to nadbudowa, nie fundament)

- **E1. Żywe sekcje** (D-L2-4): blok spięty z KPI/inicjatywą, „Odśwież dane” → diff „co się
  zmieniło”; model bloków ma już `is_refreshable`.
- **E2. Standing artifacts:** „raport miesięczny” jako stały artefakt — Teresa aktualizuje
  cyklicznie i pisze w czacie podsumowanie zmian.
- **E3. Konwersje między formatami:** „zrób z tego dokumentu prezentację” — kontrakt wspólny,
  konwerter blok→karta (doktryna §2.1 mówi, że to ten sam model treści).

---

## Kolejność wykonania (ścieżka krytyczna)

```
A1 ──► A2 ──► A4 ──► D1 ──► D2 ──► D3 ──► D4
 │             ▲
 └─► A3 ───────┘        B1 ──► B2 ──► B3 ──► B4   (równolegle do A3/A4, po decyzji P w B1)
                        C1 (po A1) · C2 · C3      (równolegle do B)
                        E1–E3 (po D3)
```

**Pierwsze trzy konkretne akcje od jutra:**
1. `[C]` A1 — test + fix `setContent` w `CanvasRichEditor` (odblokowuje wszystko).
2. `[P]` B1 — decyzja: gdzie na kartach encji siedzi „Zrób z tego…” (5 min decyzji).
3. `[D]` B2 — ContextPack w `startDoc`/`startSheet` (niezależne od A1, czysto serwerowe).


---

## Statusy wykonania (2026-06-11, code-verified)

A1–A4 ✅ (A1 root-cause: stale autosave szkieletu, nie edytor) · **B1 ✅** (6ddca907 — akcja na
podglądzie inicjatywy, API-proof groundingMode=source_refs) · **B2 ✅** (eef8ca1d) · **B3 ✅**
(c8c57a7e — sekcja Źródła w doc+sheet; klikalne chipy = iteracja UI) · **B4 ✅** (e4c92767 —
auto-skan insighty+notatki, linia „Źródła organizacji" w checkliście) · **D2 ✅** (telemetria,
DB-proof). P2-6 i18n checklisty — zamknięte decyzją: dwujęzyczna mapa PL/EN to wzorzec docelowy
(język artefaktu = język wiadomości, niezależny od async bundli i18n UI). Otwarte: A3 streaming
sekcji, C1–C2, C3 (re-scoped po odkryciu stuba), D1/D3/D4, klik-through B1 w stabilnym środowisku.
