# ZADANIE #1 (SYSTEMOWE / P0-program) — Czat jako sterownik aplikacji (Teresa → Canvas)

> **STATUS 2026-06-17 (Harvard 1, Fala 3):** Tryb B **ZAMKNIĘTY** (montaż deterministyczny + handoff event, commity `8a0e64b866`/`5278114d71`). Tryb A uczciwość persony + reasoning realny **ZROBIONE** (`persona.ts:303-319`; `AIPipeline.ts:331-413` natywny reasoning). **Tryb A function-calling ZBUDOWANY** (`a6aea8d2d5`+`e7bd755b04`): narzędzie `generate_deliverable` (doc/sheet/deck) → `plan/start` in-process → SSE `{type:'deliverable'}` → montaż canvasa; testy kontraktowe 6/6; **żywe S-A E2E (zalogowana sesja + LLM na staging) PENDING**. Tryb C (konsolidacja silników artefaktów) **NIE RUSZONY** — pozostaje Fala 3/post-BETA. Mapowanie linii w §2/§5 jest sprzed naprawy (podryfowało) — patrz teczki M01/M17/M18/M19/M20.

> Pełny work-package dla Uwagi #1 z `UWAGI_TESTY_2026-06-13.md`. Klasa: SYSTEMOWE — dotyczy wspólnej warstwy sterującej, nie modułu M02. Sporządzono 2026-06-13 na podstawie 2 równoległych rozpoznań kodu (binding lifecycle + tool contract). Każde twierdzenie z dowodem `plik:linia`. Status: ZDIAGNOZOWANE, fix nie rozpoczęty.

---

## 1. Problem (oczami właściciela)

Produkt opiera się na tezie: **Teresa STERUJE aplikacją** — z czatu po lewej tworzy i zmienia to, co widać po prawej (Canvas/dokument). Na żywym teście (staging) teza pęka już w pierwszym kroku: Teresa twierdzi „Plan został dodany do Twojego Canvasa", a po prawej wisi pusty szablon „Company Work Note"; potem sama przyznaje „wygląda na to, że nie dokończyłem". Jeśli kręgosłup pęka tu, pęka wszędzie, gdzie Teresa ma cokolwiek wykonać.

## 2. DWA odrębne tryby awarii (kluczowe rozróżnienie)

Pierwotna diagnoza widziała jeden problem. Rozpoznanie kodu pokazuje **dwa niezależne**, które trzeba naprawić osobno:

### Tryb A — HALUCYNACJA (brak akcji w ogóle)
Gdy sformułowanie użytkownika **nie trafia w wąski regex** wykrywania intencji, wiadomość idzie do Teresy jako zwykły czat. Teresa — mimo zakazu w personie — fabrykuje prozą „Plan został dodany do Canvasa". Żaden draft nie powstaje.
- Detektor intencji: `src/components/AIChat/documentIntentDetector.ts:1-51` — 22 wzorce typu „napisz/stwórz/przygotuj/wygeneruj/opracuj raport|dokument". Frazy jak **„chcę to mieć w Canvasie z boku"** ich NIE pasują → brak interceptu.
- Kontrakt persony (łamany): `server/src/ai/persona.ts:303-319` — „**PROPONUJ, nie udawaj wykonania**… Nigdy nie twierdź, że coś zrobiłeś, jeśli nie możesz tego potwierdzić."
- Teresa **nie ma żadnego narzędzia** (function-calling) do tworzenia/montażu dokumentu — zero rejestracji tooli w personie/`ai.routes.ts`. Działa jako czysty generator tekstu; „wykonanie" robi za nią przechwytywacz na froncie, którego ona nie widzi.

### Tryb B — REALNA-ALE-ZERWANA WIĘŹ (akcja jest, render nie)
Gdy intent trafia (albo użytkownik klika „Otwórz jako dokument"), draft **realnie powstaje** (`work_canvas_drafts`, od razu jako szkielet), ale prawy panel ściga się do szablonu „Company Work Note" i nie pokazuje nowego draftu deterministycznie.
- Przechwyt + pipeline: `src/components/AIChat/UnifiedChatPanel.tsx:2400-2628` (`detectDocumentIntent` → `planDocGeneration` → `setRequestedCanvasDraftId` → poll → `deliverables:draft-ready`).
- Backend tworzy draft natychmiast jako szkielet: `server/src/services/deliverables/docGenerationRuntime.ts:657-725` (`planDoc`), treść w tle `:901-1012` (`startDoc`, `useLlm:true`, twarda bramka anty-placeholder), poll `:1014-1053`.
- „Otwórz jako dokument": handler `src/components/AIChat/UnifiedChatPanel.tsx:4341-4376` (POST `/api/work-canvas/drafts` → `setRequestedCanvasDraftId(draftId)`).
- **Wyścig montażu** (rdzeń trybu B): `src/components/AIChat/WorkCanvasDocumentPanel.tsx`:
  - `:704-706` reset `mountOverride=null` przy każdej zmianie propsów.
  - `:722-726` gdy `mountOverride==null` i starter≠'presentation' → `mounted.kind='base'` = **szablon „Company Work Note"**.
  - `:767-773` świeży stan startuje z szablonu, **bez `draftId`**; hydracja draftu jest async (`:898-1028`).
  - Wewnętrzny listener `deliverables:draft-ready` `:1035-1070` odświeża TYLKO gdy `readyDraftId === documentState.draftId` i treść to wciąż szkielet → dla świeżego, jeszcze-nie-zhydratowanego draftu **wychodzi wcześniej**.
  - Skutek: w oknie przed zakończeniem hydracji panel pokazuje `base` (szablon), a jeśli nastąpi kolejny re-render, zostaje na szablonie.

### Tryb C (pochodny) — DWA równoległe systemy artefaktów
Legacy `ArtifactsPanel`/`useArtifactsStore` (render `src/components/layout/SplitLayout.tsx:461`) vs `WorkCanvasDocumentPanel` (render `src/components/AIChat/UnifiedChatPanel.tsx:5908-5918`). Niełączone typy `Artifact.type` (`src/types/core.ts:2248`) vs `ActiveCanvasDocument.kind`. Pipeline rejestruje deliverable także w store (`UnifiedChatPanel.tsx:496-510` `registerConversationDeliverable`) → ten sam artefakt w dwóch miejscach, użytkownik może patrzeć na panel bez aktywnego montażu. Wymaga konsolidacji albo jawnego mostu store↔panel (większy refaktor, nie blokuje fixu A/B).

## 3. Zasięg systemowy (blast radius)

Wspólny kręgosłup: `UnifiedChatPanel` + `documentIntentDetector`/`canvasStreamIntentDetector` + persona Teresy + pipeline `deliverables:draft-ready` → `WorkCanvasDocumentPanel` (montuje doc/sheet jako markdown, deck przez `CanvasPresentationView`). Każdy przepływ „z czatu zrób deck/doc/sheet/notatkę" przechodzi tędy. **Do POTWIERDZENIA przy wejściu w fix** (nie nadinterpretować): czy standalone studia M18 Document / M19 Presentation / M20 Table reużywają tego panelu, czy to osobne powierzchnie (flaga OFF kieruje na legacy `/wordy`/`/prezentacje`/`/excele` — `deliverablesGeneration.ts:45`, `UnifiedChatPanel.tsx:2211`). Niezależnie od tego: po naprawie kręgosłupa → **re-ocena wymiaru D (Żywa użyteczność) dla wszystkich modułów z wejściem od Teresy** w `_TRACKER.md` (smoke mierzył render, nie sterowanie).

## 4. Przyczyny pierwotne (skrót)

1. **[Tryb A] Wykrywanie intencji jest wąskie i kruche** (regex na froncie) + **Teresa nie ma narzędzia**, więc gdy regex chybia, model fabrykuje sukces zamiast wykonać/zaproponować. Architektonicznie: brak function-callingu = brak związku między słowem a czynem.
2. **[Tryb B] Brak deterministycznego montażu świeżego draftu** — fallback do `base` (szablon) wygrywa w oknie hydracji; guard wewnętrznego listenera odrzuca świeży draft.
3. **[Tryb C] Dwa silniki artefaktów** bez wspólnego SSOT widoku.

## 5. Projekt naprawy (fazami, z celami w kodzie)

### Fala 1 — Tryb B (najszybsza dźwignia, niskie ryzyko)
Deterministyczny montaż: gdy przychodzi `initialDraftId` (i starter≠'presentation'), natychmiast ustaw `mountOverride={kind:'doc', draftId}` — pomija wyścig do `base`.
- Cel: nowy `useEffect` po `WorkCanvasDocumentPanel.tsx:720` obserwujący `props.initialDraftId`.
- Efekt: panel od razu wchodzi w keyed mount `switched-doc-<id>`, świeży edytor hydratuje treść; brak nawrotu do szablonu.
- Skutek uboczny do sprawdzenia: czy auto-montaż nie nadpisze dokumentu, który użytkownik właśnie edytuje (montaż tylko przy ZMIANIE `initialDraftId`, więc bezpieczne — potwierdzić w Fazie 4).
- Weryfikacja: „Otwórz jako dokument" → dokument widoczny po prawej w <1s, po reloadzie trwały.

### Fala 2 — Tryb A (prawdomówność Teresy)
Cel docelowy: **dać Teresie realne narzędzie** (`tool_generate_deliverable({type, intent, title})`), rejestrowane w `ai.routes.ts`/personie, tak by „dodałem do Canvasa" padało DOPIERO po zwrocie toola z `generationId`. Krok pośredni (mniejszy): rozszerzyć/uodpornić wykrywanie intencji (także frazy „chcę to w Canvasie", „pokaż z boku", „zapisz to") i — gdy flaga OFF — zabronić w personie twierdzeń o Canvasie, kierując do właściwego modułu.
- Cele: `server/src/ai/persona.ts` (sekcja narzędzi/zasada flagi), `server/src/routes/ai.routes.ts` (obsługa tool-calla), `src/components/AIChat/documentIntentDetector.ts` (szersze wzorce) — albo lepiej przeniesienie decyzji na backend/tool.
- Weryfikacja: fraza spoza regexu („chcę to mieć w Canvasie") → albo realny montaż, albo jawna propozycja z przyciskiem; ZERO fałszywego „dodałem".

### Fala 3 — Tryb C (konsolidacja, większy refaktor)
Jeden silnik artefaktów lub jawny most `useArtifactsStore` ↔ `WorkCanvasDocumentPanel`; usunięcie martwego `commitProposalToDomain` (karta M02 `1d`). Poza ścieżką krytyczną BETA.

## 6. Plan weryfikacji (DoD zadania)

1. **Faza 4 żywa (osobiście, przeglądarka, staging)** — 4 scenariusze: (S-A) fraza spoza regexu; (S-B) „Otwórz jako dokument"; (S-C) deck/doc/sheet z czatu → render+reload; (S-D) patch otwartego dokumentu z czatu. Dowody: screenshoty do `Harvard/modules/M02-canvas/evidence/f4_*`.
2. **Testy regresji** — montaż świeżego draftu (Tryb B) jako test FE; brak fałszywego „dodałem" gdy flaga OFF (Tryb A).
3. **Flaga** — potwierdzić wartości `ENABLE_DELIVERABLES_LIGHT` / `VITE_ENABLE_DELIVERABLES_LIGHT` na staging i prod (decydują, czy pipeline w ogóle żyje; OFF = legacy redirect + ryzyko halucynacji).
4. **Re-ocena D** w `_TRACKER.md` dla modułów dotykających Teresy.

## 7. Ryzyka / uwagi
- Flaga OFF na środowisku = pipeline martwy → najpierw potwierdzić stan flag, inaczej „fix" trybu B nie ma czego montować.
- Tryb A docelowo wymaga function-callingu — to zmiana w warstwie AI, testować na staging, prod tylko za zgodą ([[feedback_prod_caution]]).
- Nie ruszać prod-DB; dev backend bywa wpięty w prod (`finding_railway_db_topology`).

## 8. Szacunek
- Fala 1 (Tryb B): mały, ~1 plik, kilka godz. + Faza 4. **Najlepszy stosunek wartości do ryzyka — rekomendowany pierwszy.**
- Fala 2 (Tryb A): średni (persona + tool + routes + detektor), 1–2 dni, testy AI.
- Fala 3 (Tryb C): duży refaktor, osobno po BETA.
