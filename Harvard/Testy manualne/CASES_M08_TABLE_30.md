# CASES_M08_TABLE_30 — Ideas Table (M08) · 30 bogatych case'ów eksploatujących pełnię narzędzia

> **Cel:** 30 realistycznych scenariuszy pracy konsultanta z danymi tabelarycznymi (model Airtable/Notion-database) wewnątrz narzędzia **Ideas → Table** (My Work). Każdy case eksploatuje konkretną funkcję/zestaw funkcji udowodnione w kodzie. Format: **Co się dzieje · Efekty pracy · Grafika · Funkcjonalność (file:line)**.
>
> **Źródło kodu (zweryfikowane):**
> - Orkiestrator: `src/components/MyWork/IdeaTableTool.tsx` (163 KB; quick-actions, heatmap state, scoring/pipeline montaż).
> - Katalog `src/components/MyWork/table/`: `tableTypes.ts` (typy kolumn + 28 operatorów filtra + agregacje + paleta scoringu), `useTableQuickActions.ts` (router 30+ akcji paska), `useTableKeyboard.ts` (Tab/Enter/strzałki/Ctrl), `InlineAIFill.tsx` (`InlineAIFill` + `BatchAIFillButton`), `IdeaScoringModel.tsx`, `IdeaPipeline.tsx`, `AICategorizeTool.tsx`, `AICopilotMode.tsx`, `ExportToPresentation.tsx`, `CrossTableRelations.tsx`, `EmbeddedAnalytics.tsx` (`computeHeatmapStyles`/`HeatmapControls`), `FormulaEditor.tsx` + `formulaEngineCore.ts`, `FilterBuilder.tsx`/`filterEval.ts`, `useTablePlatformViews.ts` (zapisane widoki CRUD), `useTablePersistence.ts` (hydrate + queueSync/flushNow), `VoiceImageInput.tsx` (Web Speech + OCR), `csvUtils.ts`.
>
> **Legenda znaczników:**
> - `[REAL]` — funkcja działa lokalnie (deterministyczny kod, brak AI).
> - `[REAL-AI]` — funkcja realna, wymaga backendu AI (`Api.getIdeaAIFill` / `Api.getIdeaAISuggestions` / `Api.generateIdeaAI`).
> - `[FLAG]` — zachowanie zależy od flagi `tablePlatformMetadataFirst` (`src/hooks/useFeatureFlags.tsx:138`; bridge w `useTablePlatformBridge.ts:148`). OFF = ścieżka legacy (zapis przez `Api.syncMyIdeaMap`), ON = metadata-first Table Platform.
>
> **Konwencja danych:** dataset wiodący = priorytetyzacja inicjatyw transformacji (15–25 pomysłów, kolumny `impact`/`effort`/`status`/`owner`/`category`). Dataset wtórny = macierz ryzyk i backlog.

---

## Grupa A — Kolumny i typy pól (MC-08-01…05)

### MC-08-01 · Budowa schematu 24 typów pól dla rejestru inicjatyw · [Kolumny/typy]
**Co się dzieje** Konsultant zakłada tabelę „Inicjatywy Q3", przez dialog dodawania kolumn wstawia kolejno: `text` (Nazwa), `number` (Impact 1-10), `number` (Effort 1-10), `select` (Obszar: Sprzedaż/Operacje/HR), `status` (todo/in_progress/done/blocked), `date` (Deadline), `person` (Właściciel), `currency` (Budżet PLN), `rating` (Pewność ★), `progress` (% realizacji), `checkbox` (Quick win?). Sprawdza, że każdy typ renderuje właściwy edytor i kolor nagłówka.
**Efekty pracy** Schemat 11 kolumn zapisany w definicji tabeli; każda kolumna ma `type`, `width`, `visible`, kolor z `COLUMN_TYPE_COLORS`; `status` dziedziczy `STATUS_OPTIONS` (4 wartości PL/EN + kolory pastelowe); dane utrwalone przez warstwę persystencji.
**Grafika** Grid z 11 nagłówkami, każdy nagłówek z ikoną typu i akcentem koloru (`number`=zielony #10b981, `select`=indygo #6366f1, `status`=amber #f59e0b, `date`=amber, `person`=różowy #ec4899, `formula`=fiolet #a855f7). Pigułki statusu w pastelach.
**Funkcjonalność** `AddColumnDialog.tsx`; typy `ColumnType` (24 warianty) `tableTypes.ts:8-33`; kolory `COLUMN_TYPE_COLORS` `tableTypes.ts:279-305`; `STATUS_OPTIONS` `tableTypes.ts:159-164`; etykiety `COLUMN_TYPE_LABELS` `tableTypes.ts:166-192`. `[REAL]` `[FLAG]` (metadata-first zmienia warstwę zapisu schematu).

### MC-08-02 · Kolumny `multiselect` + `select` z własną paletą kolorów opcji · [Kolumny/typy]
**Co się dzieje** Do rejestru ryzyk konsultant dodaje `multiselect` (Tagi: regulacyjne/finansowe/operacyjne/wizerunkowe) i `select` (Priorytet: Krytyczny/Wysoki/Średni/Niski). Przypisuje kolory opcjom z palety `SELECT_COLORS`, ręcznie nadpisuje „Krytyczny" na czerwień. Wpisuje po 2-3 tagi na wiersz.
**Efekty pracy** `options` + `optionColors` zapisane w `ColumnDef`; komórki multiselect renderują wiele pigułek; pojedynczy select pokazuje jedną kolorową pigułkę; wartości utrwalone.
**Grafika** Komórki z chipami w kolorach z 10-elementowej palety `SELECT_COLORS` (#e0e7ff…#f3e8ff); „Krytyczny" czerwony. Dropdown wyboru opcji.
**Funkcjonalność** `ColumnDef.options/optionColors` `tableTypes.ts:41-42`; `SELECT_COLORS` `tableTypes.ts:307-318`; `CellRenderer.tsx`/`CellEditor.tsx`. `[REAL]`

### MC-08-03 · Kolumna `relation` + `rollup` (agregacja po powiązanych rekordach) · [Kolumny/typy]
**Co się dzieje** Konsultant tworzy `relation` „Powiązane zadania" wskazującą inną tabelę, przypina po 2-4 zadania do inicjatywy, następnie dodaje `rollup` „Suma roboczogodzin" z funkcją `sum` po polu źródłowym powiązanych rekordów oraz drugi rollup `count` „Liczba zadań".
**Efekty pracy** `relationTarget`, `rollupSource`, `rollupFunction` zapisane; komórki rollup auto-przeliczają (`count`/`sum`/`avg`/`min`/`max`/`percent_empty`/`percent_not_empty`); LinkedRecordPicker zapamiętuje powiązania.
**Grafika** Komórka relacji = chipy linkowanych rekordów (LinkedRecordDisplay); rollup = wartość liczbowa wyrównana do prawej; nagłówek rollup w kolorze #0ea5e9.
**Funkcjonalność** `ColumnDef.relationTarget/rollupSource/rollupFunction` `tableTypes.ts:47-49`; `LinkedRecordPicker.tsx`, `LinkedRecordDisplay.tsx`, `useRollupComputation.ts`, `NewColumnRenderers.tsx`. `[REAL]`

### MC-08-04 · Pola systemowe audytu: `created_time`/`created_by`/`last_edited_time`/`last_edited_by` · [Kolumny/typy]
**Co się dzieje** Konsultant dodaje 4 kolumny systemowe, by śledzić kto i kiedy utworzył/zmienił rekord. Edytuje kilka wierszy, sprawdza że `last_edited_*` aktualizuje się automatycznie i nie da się ich ręcznie edytować.
**Efekty pracy** Kolumny read-only wypełniane automatycznie; ścieżka audytu rejestruje zmiany pól (oldValue/newValue/author).
**Grafika** Kolumny w neutralnej szarości (#94a3b8); wartości czasu sformatowane wg locale; awatar/nazwa autora.
**Funkcjonalność** typy `created_time/created_by/last_edited_time/last_edited_by` `tableTypes.ts:30-33`; `NodeActivity` `tableTypes.ts:130-138`; `AuditTrailPanel.tsx`, `useAuditTrail.ts`, `ActivityFeed.tsx`. `[REAL]`

### MC-08-05 · Reorder, freeze, resize i ukrywanie kolumn (zarządzanie szerokim schematem) · [Kolumny/typy]
**Co się dzieje** Przy 14 kolumnach konsultant zamraża „Nazwa" (frozen, zostaje przy przewijaniu poziomym), zwęża `effort` do minimum, rozszerza „Opis" do maksimum, ukrywa 3 kolumny robocze i przeciąga „Status" przed „Właściciel".
**Efekty pracy** `frozen`, `width` (clamp 60-600), `visible`, kolejność zapisane per kolumna; widok respektuje stan przy następnym otwarciu.
**Grafika** Zamrożona kolumna z cieniem krawędzi przy scrollu; uchwyt resize na granicy nagłówka; ukryte kolumny znikają z grida (dostępne w menedżerze pól).
**Funkcjonalność** `ColumnDef.frozen/width/visible` `tableTypes.ts:39,44`; `DEFAULT/MIN/MAX_COLUMN_WIDTH` `tableTypes.ts:155-157`; `FieldManager.tsx` (31 KB), `GridView.tsx`. `[REAL]`

---

## Grupa B — Filtry, sortowanie, grupowanie (MC-08-06…11)

### MC-08-06 · Filtr `between` na Impact + `gt` na Budżet (top kandydaci) · [Filtry/sort/grupy]
**Co się dzieje** Z 22 inicjatyw konsultant buduje filtr złożony: `Impact between 7 and 10` AND `Budżet gt 50000` AND `Status notEquals done`. Sprawdza, że tylko 5 wierszy przechodzi.
**Efekty pracy** `FilterGroup` z logiką `and` i 3 regułami zapisany; grid pokazuje przefiltrowany podzbiór; licznik wyników w pasku; zdarzenie `ideas_table_filter_applied` w analityce.
**Grafika** Panel/builder filtra z dropdownami pól, operatorów (zależnych od typu) i pól wartości; nad gridem badge „3 filtry · 5 z 22".
**Funkcjonalność** `FilterRule/FilterGroup` `tableTypes.ts:81-91`; operatory typo-zależne `FilterBuilder.tsx:28-125` (40 operatorów / 7 grup typów); ewaluacja `filterEval.ts`; otwarcie via `tbl_filter` `useTableQuickActions.ts:111-115`. `[REAL]`

### MC-08-07 · Filtr tekstowy `contains`/`startsWith`/`doesNotContain` na nazwach · [Filtry/sort/grupy]
**Co się dzieje** Konsultant szuka inicjatyw „cyfrow*": `Nazwa contains "cyfr"`, potem zawęża `Nazwa doesNotContain "pilot"`, na koniec testuje `startsWith "Auto"`.
**Efekty pracy** Reguły tekstowe stosowane na żywo; lista zawężana bez utraty danych źródłowych.
**Grafika** Builder z grupą operatorów tekstowych (Contains/Starts with/Does not contain/Is empty…); pole tekstowe wartości.
**Funkcjonalność** `TEXT_OPERATORS` `FilterBuilder.tsx:28-42`; mapowanie grup typów `getOperatorsForType` `FilterBuilder.tsx:120-125`; operatory camelCase w `FilterOperator` `tableTypes.ts:63-79`. `[REAL]`

### MC-08-08 · Filtr dat `isWithin`/`isBefore`/`isOnOrAfter` (deadline'y kwartału) · [Filtry/sort/grupy]
**Co się dzieje** Konsultant filtruje `Deadline isWithin <ten kwartał>`, potem `Deadline isBefore <dziś>` (przeterminowane), potem `isOnOrAfter` dla planu na przyszłość.
**Efekty pracy** Reguły datowe zawężają backlog; widać liczbę zaległych.
**Grafika** Operatory daty: Is before/Is after/Is on or before/Is on or after/Is within; picker daty/zakresu.
**Funkcjonalność** `DATE_OPERATORS` `FilterBuilder.tsx:77-92`; operatory `isBefore/isAfter/isOnOrBefore/isOnOrAfter/isWithin` `tableTypes.ts:76-79`. `[REAL]`

### MC-08-09 · Filtr select `isAnyOf`/`isNoneOf` (wielokrotny wybór obszarów) · [Filtry/sort/grupy]
**Co się dzieje** Konsultant zostawia obszary `isAnyOf [Sprzedaż, Operacje]`, potem przełącza na `isNoneOf [HR]` by wykluczyć HR z przeglądu zarządu.
**Efekty pracy** Multi-wartościowa reguła zapisana z `value: string[]`; grid pokazuje sumę zbiorów.
**Grafika** Operatory single/multi-select: Is / Is not / Is any of / Is none of; multi-chip selektor wartości.
**Funkcjonalność** `SINGLE_SELECT_OPERATORS`/`MULTI_SELECT_OPERATORS` `FilterBuilder.tsx:55-77`; `FilterRule.value: string[]` `tableTypes.ts:85`. `[REAL]`

### MC-08-10 · Sortowanie wielopoziomowe + szybki toggle asc/desc · [Filtry/sort/grupy]
**Co się dzieje** Konsultant sortuje: primary `Score desc`, secondary `Effort asc`. Następnie testuje szybką akcję paska, która przy braku sortu ustawia `label asc`, a przy istniejącym przełącza kierunek.
**Efekty pracy** `SortConfig[]` (klucz + kierunek) zapisany; kolejność wierszy stabilna; zdarzenie `ideas_table_sort_applied`.
**Grafika** Strzałki ▲/▼ w nagłówkach sortowanych kolumn; numerki priorytetu sortu przy wielopoziomowym.
**Funkcjonalność** `SortConfig` `tableTypes.ts:93-96`; szybki toggle `tbl_sort` `useTableQuickActions.ts:101-109`; multi-sort w `SavedView.sort` `tableTypes.ts:101`. `[REAL]`

### MC-08-11 · Grupowanie po `status` (swimlane'y backlogu) z agregacją sekcji · [Filtry/sort/grupy]
**Co się dzieje** Konsultant grupuje tabelę po `Status`; wiersze zwijają się w sekcje todo/in_progress/done/blocked. Włącza agregację `sum` na Budżecie i `count` w stopce każdej grupy.
**Efekty pracy** `groupBy` zapisany w widoku; nagłówki grup z licznikiem; agregacja per grupa wyliczona (`computeAggregation`).
**Grafika** Sekcje z kolorowymi paskami statusu i sumami budżetu pod każdą grupą; sticky group-header.
**Funkcjonalność** `SavedView.groupBy` `tableTypes.ts:104`; `computeAggregation` (sum/avg/count/min/max) `tableTypes.ts:333-354`; `ColumnDef.aggregation` `tableTypes.ts:46`; render w `GridView.tsx`. `[REAL]`

---

## Grupa C — Scoring & Pipeline (MC-08-12…16)

### MC-08-12 · Model scoringowy ważony Impact/Effort/Pewność z normalizacją · [Scoring/pipeline]
**Co się dzieje** Konsultant otwiera Model scoringowy. System auto-wykrywa kolumny `number/rating/progress/currency`. Ustawia wagi Impact=40%, Effort=30% (invert ↓, bo niższy lepszy), Pewność=20%, dociąga suwaki do sumy 100%. Tabela liczy ranking 1..N.
**Efekty pracy** Każdy pomysł dostaje `score` (0-100) i `rank` po normalizacji min-max; po „Zastosuj ranking" wartości zapisują się do `data.score`/`data.rank` na wierszach; breakdown per kryterium.
**Grafika** Modal 560px: suwaki wag z licznikiem %, pasek sumy (zielony przy 100%, amber inaczej), lista rankingu z koroną dla top-3, kolorowe paski score per wiersz.
**Funkcjonalność** `IdeaScoringModel.tsx`: `SCORABLE_TYPES` :46, normalizacja+invert :88-105, sort+rank :108-112, `onApplyScores` :166-169; otwarcie `tbl_scoring` `useTableQuickActions.ts:73`. `[REAL]` (sam scoring lokalny, deterministyczny).

### MC-08-13 · AI-kalibracja wag scoringu · [Scoring/pipeline]
**Co się dzieje** Zamiast ręcznie, konsultant klika „AI kalibracja". AI proponuje wagi (uwzględniając, że wyższy impact i niższy effort = lepiej), suwaki przeskakują na sugerowane wartości.
**Efekty pracy** Wagi nadpisane wartościami z AI (`weights[]` z JSON); ranking przelicza się natychmiast.
**Grafika** Przycisk „AI kalibracja" z ikoną Sparkles i spinnerem podczas ładowania; suwaki animują się do nowych pozycji.
**Funkcjonalność** `handleAICalibrate` `IdeaScoringModel.tsx:133-164` → `Api.getIdeaAISuggestions` (prompt o wagi, parsowanie JSON). `[REAL-AI]`

### MC-08-14 · Pipeline Pomysł → Inicjatywa z bramkami kryteriów · [Scoring/pipeline]
**Co się dzieje** Konsultant otwiera Pipeline (Szkic → Zwalidowany → Zatwierdzony → Inicjatywa). Klika etap „Zwalidowany", widzi kryteria (Oceniony wpływ / Oszacowany wysiłek / min. 1 zwolennik). System per wiersz liczy spełnione kryteria N/total; promocja możliwa tylko gdy 100%.
**Efekty pracy** `data.pipelineStage` aktualizowany przy promocji; lejek pokazuje liczności i % konwersji do „Inicjatywy"; przycisk „Promuj" zablokowany przy niespełnionych bramkach.
**Grafika** Modal 680px: pasek lejka z 4 etapami (kolory szary→amber→zielony→indygo, ikony Flag/Shield/Check/Rocket), strzałki między etapami, badge konwersji %, listy z paskiem postępu kryteriów (zielony=komplet, amber=brak).
**Funkcjonalność** `IdeaPipeline.tsx`: `DEFAULT_STAGES` :38-75, `evaluateCriteria` :86-122, `handlePromote` (blokada bez kompletu) :167-181, `conversionRate` :162-165; otwarcie `tbl_pipeline` `useTableQuickActions.ts:75`. `[REAL]`

### MC-08-15 · Konwersja do modułu Inicjatyw na ostatniej bramce · [Scoring/pipeline]
**Co się dzieje** Pomysł spełnia kryteria etapu „Zatwierdzony" (Scoring>60, Budżet, Sponsor). Konsultant promuje do „Inicjatywa" — wyzwala to konwersję do modułu inicjatyw + przypisanie zespołu.
**Efekty pracy** `onConvertToInitiative(nodeId)` woła handler montażu inicjatywy; `pipelineStage='initiative'`; pomysł znika z wcześniejszego etapu, wpada do ostatniego kubełka lejka.
**Grafika** Przycisk promocji w kolorze docelowego etapu (#6366f1), spinner podczas konwersji; lejek aktualizuje konwersję %.
**Funkcjonalność** `handlePromote` gałąź `nextStage === 'initiative'` `IdeaPipeline.tsx:174-177`; prop `onConvertToInitiative` :83. Kryterium scoring threshold parsowany z tekstu :105-107. `[REAL]` (montaż inicjatywy zależny od handlera w orkiestratorze).

### MC-08-16 · Macierz priorytetów 2×2 (Impact × Effort) jako widok decyzyjny · [Scoring/pipeline]
**Co się dzieje** Konsultant przełącza na widok Matrix; pomysły rozkładają się na 4 ćwiartki (Quick wins / Big bets / Fill-ins / Time sinks) wg Impact (oś Y) i Effort (oś X). Przeciąga jeden pomysł między ćwiartkami, co aktualizuje jego wartości.
**Efekty pracy** Pozycje w macierzy odzwierciedlają dane liczbowe; przeciągnięcie nadpisuje impact/effort wiersza; widok zapamiętany jako `layout: 'matrix'`.
**Grafika** Plansza 2×2 z etykietami osi i ćwiartek; bąble pomysłów w kolorach akcentu; linie pomocnicze.
**Funkcjonalność** `MatrixView.tsx`; przełączenie `tbl_matrix`→`'matrix'` `useTableQuickActions.ts:90`; skrót Ctrl+Shift+M `useTableKeyboard.ts:103-105`; `SavedView.layout` `tableTypes.ts:106`. `[REAL]`

---

## Grupa D — AI-fill, Copilot, Categorize (MC-08-17…23)

### MC-08-17 · Inline AI-fill pojedynczej pustej komórki (różdżka) · [AI-fill/Copilot/Categorize]
**Co się dzieje** W kolumnie „Uzasadnienie" brakuje opisu dla jednej inicjatywy. Konsultant najeżdża na pustą komórkę, klika różdżkę; AI generuje treść na bazie kontekstu wiersza (label + dane) oraz `aiPrompt` kolumny.
**Efekty pracy** Komórka wypełniona wartością z `Api.getIdeaAIFill`; gdy AI nic nie zwróci — toast „AI nie zwróciło wartości" (nie cicha pustka).
**Grafika** Mała różdżka (Wand2) pojawia się na hover komórki (opacity 0→70%); spinner podczas generowania.
**Funkcjonalność** `InlineAIFill` `InlineAIFill.tsx:19-66`: `Api.getIdeaAIFill` :33, fallback prompt z `column.aiPrompt`/label :30-32, obsługa pustego wyniku :42-45. `[REAL-AI]`

### MC-08-18 · Batch AI-fill wszystkich pustych komórek zaznaczonych wierszy · [AI-fill/Copilot/Categorize]
**Co się dzieje** Konsultant zaznacza 8 nowych pomysłów z pustymi kolumnami (Kategoria, Uzasadnienie, Ryzyko) i klika „AI Fill (N)". System przechodzi kolumna-po-kolumnie, zbiera puste wiersze, robi batch-request per kolumna.
**Efekty pracy** Wypełnione komórki per kolumna; toast „Wypełniono N komórek"; pomija `type` i `label`; gdy nic — „AI nie zwróciło żadnych wartości".
**Grafika** Przycisk „AI Fill (liczba_pustych)" w pasku/zaznaczeniu; licznik pustych liczony na żywo; spinner.
**Funkcjonalność** `BatchAIFillButton` `InlineAIFill.tsx:76-162`: licznik pustych :87-97, pętla po kolumnach z `Api.getIdeaAIFill` :107-129, summary toast :131-135. `[REAL-AI]`

### MC-08-19 · Autofill z powiązanych artefaktów (knowledge → wiersze) · [AI-fill/Copilot/Categorize]
**Co się dzieje** Konsultant zaznacza wiersze mające `artifactLinks` (dokumenty/wywiady) i odpala „Autofill z artefaktu". AI mapuje treść artefaktów na pola wierszy.
**Efekty pracy** `view_patch.autofillMappings` aplikowane na pola wierszy przez undo-able push; toast „Zastosowano X pól z N mapowań"; warianty „Odśwież dane z artefaktów" i „Połącz artefakt z wierszem".
**Grafika** Toast 🤖 „Generuję mapowania autofill…"; po sukcesie zielony toast z liczbą pól.
**Funkcjonalność** `tbl_autofill_from_artifact` `useTableQuickActions.ts:124-186` → `Api.generateIdeaAI({generatorType:'ai_autofill_mappings'})`; refresh :189-250; link :253-267; push undo :157-170. `[REAL-AI]`

### MC-08-20 · AI Copilot — tryb Burza mózgów (generowanie nowych pomysłów) · [AI-fill/Copilot/Categorize]
**Co się dzieje** Konsultant otwiera Copilota w trybie „Burza mózgów", pisze „daj 5 inicjatyw cyfryzacji obsługi klienta". AI streamuje odpowiedź; parsuje JSON [{label,description,category}]; każdą sugestię można dodać jako wiersz.
**Efekty pracy** Nowe wiersze (`source:'ai_copilot'`) dodane przez `onAddRows`; historia czatu w panelu; efekt strumieniowania (typing).
**Grafika** Panel 480px / 70vh: selektor 4 trybów (Burza/Adwokat/Rozwiń/Podsumuj — ikony+kolory), bąble czatu, kursor ▊ podczas streamu, przy sugestiach przycisk „+ Dodaj".
**Funkcjonalność** `AICopilotMode.tsx`: `MODE_CONFIG.brainstorm` :55-62, `handleSend`→`Api.getIdeaAISuggestions` :157-170, `simulateStreaming` :117-131, parsowanie JSON+`handleAddSuggestion` :178-233; otwarcie `tbl_copilot` `useTableQuickActions.ts:76`. `[REAL-AI]`

### MC-08-21 · AI Copilot — Adwokat diabła + Rozwiń + Podsumuj · [AI-fill/Copilot/Categorize]
**Co się dzieje** Konsultant uruchamia kolejno: „Adwokat diabła" (AI wskazuje słabości/ryzyka/założenia), „Rozwiń" (bierze najlepszy pomysł i rozgałęzia w 5 kierunków jako JSON), „Podsumuj" (executive summary z rekomendowaną priorytetyzacją).
**Efekty pracy** Krytyka jako tekst; rozwinięcia jako dodawalne wiersze; podsumowanie jako notatka — wszystko w wątku Copilota.
**Grafika** Każdy tryb innym kolorem (Adwokat=czerwień #f43f5e, Rozwiń=indygo, Podsumuj=niebieski); szybkie akcje jako chipy gdy brak wiadomości.
**Funkcjonalność** `MODE_CONFIG.devils_advocate/expand/summarize` `AICopilotMode.tsx:63-87`; `handleQuickAction` :235-242. `[REAL-AI]`

### MC-08-22 · AI Kategoryzacja & klastry tematyczne · [AI-fill/Copilot/Categorize]
**Co się dzieje** Konsultant ma 20 niezklasyfikowanych pomysłów; klika „Analizuj 20 pomysłów". AI przypisuje 2-3 tagi i klaster tematyczny (nazwa + hex) per pomysł, ze score pewności. „Zastosuj wszystko" koloruje i taguje wiersze.
**Efekty pracy** `onApplyTags` + `onApplyCluster(nodeId, cluster, color)` na każdym wierszu; wiersze pogrupowane w klastry z kolorami; fallback lokalny po pierwszym słowie gdy AI zwróci nie-JSON.
**Grafika** Modal 520px, zakładka „Klastry (N)": sekcje klastrów z kropką koloru, chipy tagów, przycisk ✓ apply per wiersz / „Zastosuj wszystko".
**Funkcjonalność** `AICategorizeTool.tsx`: `handleAnalyze`→`Api.getIdeaAISuggestions` :57-125, fallback keyword :95-118, `handleApplyAll` :136-142; otwarcie `tbl_categorize` `useTableQuickActions.ts:72`. `[REAL-AI]`

### MC-08-23 · AI wykrywanie duplikatów + scalanie · [AI-fill/Copilot/Categorize]
**Co się dzieje** W zakładce „Duplikaty" AI pokazuje pary pomysłów >70% podobieństwa z powodem. Konsultant scala parę (zachowaj A, usuń B).
**Efekty pracy** `onMergeNodes(keepId, removeId)` łączy wiersze; lista duplikatów z procentem podobieństwa i uzasadnieniem; po scaleniu liczba wierszy maleje.
**Grafika** Karty amber z ikoną GitMerge, „85% podobieństwo", para nazw z ↔, tekst powodu, przycisk „Scal".
**Funkcjonalność** `AICategorizeTool.tsx`: zakładka duplicates :298-337, `onMergeNodes` prop :21, parsowanie `duplicates[]` :92. `[REAL-AI]`

---

## Grupa E — Relacje i heatmapa (MC-08-24…26)

### MC-08-24 · Relacje między tabelami (cross-table) z typami zależności · [Relations/heatmap]
**Co się dzieje** Konsultant otwiera „Relacje między tabelami", wybiera mapę „Strategia cyfrowa", zaznacza źródło z bieżącej tabeli, wybiera typ relacji `depends_on`/`blocks`/`related_to`/`duplicates`/`parent_of` i łączy z węzłem zewnętrznej mapy.
**Efekty pracy** `TableEdge` z `data.crossTable=true`, `targetIdeaId`, `relationType` dodany przez `onAddEdge`; zakładka „Sieć" pokazuje wszystkie połączenia kolorowane wg typu.
**Grafika** Modal 600px: lewa lista innych map pomysłów (z liczbą elementów), prawa lista węzłów + selektor typu relacji + przyciski „Połącz"; zakładka Sieć z badge'ami typów (kolory: depends_on=amber, blocks=czerwień, parent_of=zielony).
**Funkcjonalność** `CrossTableRelations.tsx`: `RELATION_TYPES` :62-73, `handleCreateLink`→`onAddEdge` :154-181, lista map `Api.listIdeaMaps`/`getMyIdeaMap` :97-152, zakładka network :398-445; otwarcie `tbl_cross_relations` `useTableQuickActions.ts:78`. `[REAL-AI]` (lista map z API; przy braku — dane demo).

### MC-08-25 · Rollup cross-table (agregacja z powiązanej tabeli) · [Relations/heatmap]
**Co się dzieje** W zakładce „Rollups" konsultant dodaje kolumnę rollup agregującą pole z innej tabeli (np. count powiązanych zadań, sum budżetów inicjatyw zależnych).
**Efekty pracy** `onAddRollupColumn({sourceIdeaId, sourceField, aggregation, label})` dokłada kolumnę rollup do schematu; wartości agregowane z tabeli źródłowej.
**Grafika** Zakładka Rollups z ikoną Sigma, przycisk „Dodaj kolumnę rollup".
**Funkcjonalność** `CrossTableRelations.tsx` zakładka rollups :447-475, `RollupConfig` :45-50, `onAddRollupColumn` prop :59. `[REAL]`

### MC-08-26 · Heatmapa wartości w gridzie (warm/cool/diverging) · [Relations/heatmap]
**Co się dzieje** Konsultant włącza heatmapę na kolumnach Impact, Effort, Budżet; wybiera paletę „diverging" (czerwień=niska, biel=środek, zieleń=wysoka). Komórki dostają tło proporcjonalne do wartości względem min-max kolumny.
**Efekty pracy** `heatmapColumns` (Set) + `heatmapPalette` w stanie; `computeHeatmapStyles` liczy styl tła per komórka; ułatwia wizualne odczytanie skupisk wartości.
**Grafika** Komórki kolumn objętych heatmapą z gradientowym tłem; kontrolki palety (warm/cool/diverging); toggle per kolumna.
**Funkcjonalność** `IdeaTableTool.tsx`: stan :625-627, `toggleHeatmapColumn` :1006, `heatmapStyles` via `computeHeatmapStyles` :1015-1018, aplikacja stylu w komórce :1257; `EmbeddedAnalytics.tsx` `computeHeatmapStyles` :156 + `HeatmapControls` :195; otwarcie `tbl_heatmap` `useTableQuickActions.ts:79`. `[REAL]`

---

## Grupa F — Widoki, eksport, formuły, import/głos, klawiatura (MC-08-27…30)

### MC-08-27 · Zapisane widoki: „Zarząd", „Operacyjny", „Moje zaległe" · [Widoki]
**Co się dzieje** Konsultant konfiguruje widok (filtr top-impact + sort score desc + grupowanie po obszarze + ukryte kolumny robocze + layout matrix) i zapisuje jako „Zarząd". Tworzy drugi „Operacyjny" (layout table, filtr in_progress). Przełącza się między nimi, edytuje i usuwa jeden.
**Efekty pracy** `SavedView` (filters+sort+groupBy+columns+layout) utrwalony przez CRUD; przełączenie `applyView` odtwarza pełny stan; `updateSavedView`/`deleteSavedView` zmieniają zestaw.
**Grafika** Strip/switcher zapisanych widoków z ikonami; aktywny widok podświetlony; menu Edytuj/Usuń.
**Funkcjonalność** `SavedView` `tableTypes.ts:98-107`; `useTablePlatformViews.ts`: `savedViews` :24, `applyView` :33/:90, `updateSavedView` :131-170, `deleteSavedView` :173-188; `ViewSwitcher.tsx`, `ShareViewDialog.tsx`. `[REAL]` `[FLAG]` (metadata-first vs legacy nośnik widoków).

### MC-08-28 · Eksport do CSV oraz do prezentacji (6 typów slajdów) · [Eksport]
**Co się dzieje** Konsultant eksportuje dane do CSV (do Excela), a następnie do prezentacji: zaznacza slajdy Tytuł/Tabela/Macierz/Podsumowanie AI/Ranking, klika „Eksportuj" — tworzy się deck w module prezentacji.
**Efekty pracy** CSV pobrany (`idea-<id>.csv`); deck JSON zbudowany ze slajdów (heading/table/list/stats/ranking), utworzony przez `Api.createPresentationDeck(source:'idea_table')`, `onExportComplete(deckId)`.
**Grafika** CSV: natychmiastowy download. Modal eksportu 440px: checkboxy 6 typów slajdów (Ranking aktywny tylko gdy są score'y, Kanban/Matrix wg bieżącego layoutu), licznik „N slajdów · M pomysłów", stan „Wyeksportowano!".
**Funkcjonalność** CSV: `tbl_export_csv`→`exportToCSV`+`downloadCSV` `useTableQuickActions.ts:117-121`, `csvUtils.ts`. Deck: `ExportToPresentation.tsx` `buildDeckJson` :99-230, `handleExport`→`Api.createPresentationDeck` :232-256; otwarcie `tbl_export_pptx` `useTableQuickActions.ts:74`. `[REAL]` (slajd „Podsumowanie AI" generuje treść; ranking wymaga policzonych score z MC-08-12).

### MC-08-29 · Formuły komórek: priorytet, koszt jednostkowy, etykieta warunkowa · [Formuły]
**Co się dzieje** Konsultant dodaje kolumnę `formula` „Priorytet" = `{impact} * 2 - {effort}`, drugą „Koszt/punkt" = `ROUND({budget} / {impact}, 0)`, trzecią warunkową = `IF({score} > 60, "Go", "Hold")`. Wstawia funkcje z palety edytora formuł.
**Efekty pracy** `ColumnDef.formula` zapisana; wartości auto-przeliczane silnikiem AST (nie `new Function`); `{field}` rozwiązywane po nazwie kolumny; błąd → „—".
**Grafika** Edytor formuł z paletą funkcji pogrupowanych (math: SUM/AVG/MIN/MAX/ABS/ROUND/CEIL/FLOOR; logic: IF/AND/OR/NOT/SWITCH), podpowiedzi sygnatur, wstawianie pól `{...}`.
**Funkcjonalność** `FormulaEditor.tsx` `FORMULA_FUNCTIONS` :60-134; `evaluateFormula`→`evaluateFormulaStringCore` `tableTypes.ts:320-331`; silnik `formulaEngineCore.ts` / `FormulaEngineV2.ts`. `[REAL]`

### MC-08-30 · Wejście głosowe + OCR zdjęcia + nawigacja klawiaturą i undo/redo · [Import/voice]
**Co się dzieje** Konsultant dyktuje 5 pomysłów (Web Speech, pl-PL), AI parsuje transkrypt na wiersze. Potem wkleja screenshot tablicy z warsztatu — OCR ekstrahuje rekordy. Na koniec wprowadza dane czysto z klawiatury: Tab/Enter/strzałki między komórkami, Ctrl+N nowy wiersz, Ctrl+Z/Ctrl+Y undo/redo, Delete kasuje zaznaczone.
**Efekty pracy** Transkrypt → wiersze (`ParsedIdea[]`); obraz → wiersze przez AI-OCR; nowe wiersze dodane; pełna ścieżka undo/redo na `nodes`; usuwanie bulk zaznaczonych. Stan utrwalony (queueSync/flushNow).
**Grafika** Panel VoiceImage z trybami voice/image, podgląd transkryptu/obrazu, drag&drop zone; w gridzie focus-ring wędruje po komórkach; `KeyboardShortcutsPanel` po `?`.
**Funkcjonalność** `VoiceImageInput.tsx` (Web Speech `recognition.lang` pl-PL/en-US :73-76, tryby voice/image :32, OCR parsing); otwarcie `tbl_voice` `useTableQuickActions.ts:77`. Klawiatura `useTableKeyboard.ts`: Tab/Enter/strzałki :145-182, Ctrl+Z/Y :72-81, Ctrl+N add :87-91, Delete :134-139, `?` shortcuts :128-131, Ctrl+Shift+K/M/T view-switch :94-120; `useUndoRedo.ts`; persystencja `useTablePersistence.ts` (hydrate :161, queueSync/flushNow :110). `[REAL]` (parsing głosu/OCR = `[REAL-AI]`; Web Speech zależny od wsparcia przeglądarki).

---

## Indeks szybkiego pokrycia funkcji

| Funkcja | Case'y |
|---|---|
| 24 typy kolumn + select/multiselect/status colors | 01, 02 |
| relation + rollup (in-table) | 03 |
| pola systemowe / audit trail | 04 |
| freeze / resize / reorder / hide | 05 |
| filtry (40 operatorów, 7 grup typów) | 06-09 |
| sortowanie wielopoziomowe | 10 |
| grupowanie + agregacje sekcji | 11 |
| scoring model (normalizacja, invert, ranking) | 12, 13 |
| pipeline + bramki + konwersja inicjatywy | 14, 15 |
| macierz 2×2 priorytetów | 16 |
| inline / batch AI-fill | 17, 18 |
| autofill z artefaktów | 19 |
| AI Copilot (4 tryby + streaming) | 20, 21 |
| AI kategoryzacja / klastry / duplikaty | 22, 23 |
| cross-table relations + rollup | 24, 25 |
| heatmapa w gridzie | 26 |
| zapisane widoki (CRUD + layouty) | 27 |
| eksport CSV + prezentacja | 28 |
| formuły (AST, math+logic) | 29 |
| głos + OCR + klawiatura + undo/redo | 30 |
