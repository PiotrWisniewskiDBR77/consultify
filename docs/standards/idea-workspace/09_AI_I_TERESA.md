# 09 — AI i Teresa

Ten rozdział ustala jeden model AI dla wszystkich 4 reprezentacji (5 poziomów zasięgu, jedno nazewnictwo, jeden mechanizm propozycji) oraz domyka Z4 — zasadę, że **Teresa steruje wszystkim**. Rejestr akcji (`_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`) jest jednocześnie listą narzędzi Teresy: nie ma akcji AI opisanej w tym rozdziale, która nie ma wpisu `teresa.description` + `parameters` w rejestrze.

## 1. Pięć poziomów AI

| Poziom | Zasięg (scope) | Co obejmuje | Wejście w UI | Przykład |
|---|---|---|---|---|
| 1. Cała Idea | `workspace` | AI działa na całym grafie/rekordzie Idei, niezależnie od aktywnej reprezentacji | Teresa (czat) | „Skonwertuj to na inicjatywę”, „Podsumuj całą ideę” |
| 2. Aktualny widok | `current_view` | AI działa na tym, co widać w aktywnej reprezentacji (cała mapa/tablica/proces/tabela) | Menu 3, menu tła canvasu | „Ułóż mi ten proces”, „Wypełnij luki na tej tablicy” |
| 3. Zaznaczenie | `selected_items` | AI działa na aktualnie zaznaczonych elementach (1 lub wiele) | rail (popover AI), pasek zaznaczenia | „Rozwiń zaznaczoną gałąź”, „Znajdź tematy w zaznaczonych karteczkach” |
| 4. Element | `single_item` / `edge` | AI działa na jednym elemencie lub jednej krawędzi | menu elementu, pasek 1-elementu | „Zmień nazwę tego kroku na X”, „Przeredaguj ten węzeł” |
| 5. Dane tabeli | `table_column` / `table_row` / `table_cell` | AI działa na komórkach/kolumnach/wierszach tabeli | menu komórki/kolumny, Menu 3 Tabeli | „Wypełnij puste komórki w kolumnie Koszt” |

Każdy poziom MUSI być osiągalny zarówno z UI, jak i rozmową z Teresą — to ten sam wpis w rejestrze, dwa wejścia (Z4).

## 2. Nazewnictwo — zakaz etykiety ogólnej

**Zasada:** etykieta akcji AI musi nazywać rzeczywiste działanie, nie ogólne „AI”. Zakaz jednej uniwersalnej etykiety „AI rozwiń” powtórzonej wszędzie z różnym efektem.

| ✖ Zakazane (ogólne, myli o realnym efekcie) | ✅ Wymagane (nazywa działanie) | Uzasadnienie |
|---|---|---|
| „AI rozwiń” użyte i dla `mm_ai_expand` (dodaje węzły do mapy) i dla generatorów, które tylko wypełniają pole czatu | „Rozbuduj temat” (dodaje węzły) vs „Zapytaj AI o ten węzeł” (otwiera czat) | użytkownik musi wiedzieć z samej etykiety, czy AI zmieni dane, czy tylko poda kontekst do rozmowy |
| „AI Generators” (Whiteboard, panel `IdeaAISuggestionsPanel`) — przycisk „Auto-clustering (AI)” | nazwać wprost co się stanie: „Wstaw pusty klaster” (jeśli to insert bez LLM) ALBO podłączyć do realnego `wb_ai_find_themes`/`wb_ai_name_clusters` i wtedy nazwać „AI: Znajdź tematy” | patrz defekt §5 — dziś etykieta obiecuje LLM, którego nie ma |
| „Auto-grupowanie” / `mm_auto_cluster` nazwane w niektórych miejscach jako AI | „Auto-grupowanie (reguły słów kluczowych)” — bez słowa AI, bo to heurystyka `if/else`, nie LLM | patrz zakaz w §5 |

## 3. Model propozycji — obowiązkowy dla każdej AI zmieniającej dane

**Zasada (rejestr: `mutates: true` ⇒ `requiresPreview: true`):** każda akcja AI, która zmienia graf/rekord, przechodzi przez ten sam cykl:

```
generuj → PODGLĄD (diff/karta propozycji) → akceptuj / odrzuć (per-item lub wszystkie) → wpis w Historii → dostępne Cofnij
```

| Krok | Wymóg | Komponent docelowy |
|---|---|---|
| Generuj | wywołanie `generateAIProposal()` / równoważnego, z jawnym kontekstem (scope + dane wejściowe) | jeden wspólny serwis, nie kopiowany per narzędzie |
| Podgląd | pokazuje CO się zmieni, zanim się zmieni; per-item accept/reject + accept-all/reject-all | jeden wspólny widget `IdeaProposalReview` (dziś: 2–3 niezależne kopie — Mind Map/workspace-level, Whiteboard-level, Process Flow ma osobny `AIProposalPanel` — do konsolidacji w jedną instancję, Z1) |
| Akceptuj/odrzuć | odrzucenie = zero zmian w danych; akceptacja = zapis + wpis historii | `applyAIProposalRuntime` (już współdzielony silnik patchowania — utrzymać jako jeden) |
| Historia | KAŻDE wykonanie (akceptacja) trafia do zakładki Historia, oznaczone jako AI + autor polecenia (Z4, patrz §8) | filtr w Historii, nie osobna zakładka |
| Cofnij | dostępne z historii LUB ze stosu undo narzędzia | `undo: UndoDescriptor` w rejestrze — wymagany, gdy `mutates: true` |

**Wzorzec do skopiowania (najlepiej zbudowany dziś):** Process Flow `edit_step` — proposal z porównaniem before/after i walidacją przed zapisem. Whiteboard ma dodatkowo dedykowany log aktywności AI (`createWhiteboardActivityEntry('ai', ...)`) — wzorzec do rozszerzenia na pozostałe 3 reprezentacje (patrz §8).

## 4. Zakaz auto-apply — dziś łamany, do naprawy

**Zasada:** żadna akcja AI nie zmienia danych bez kroku akceptacji z §3. Wyjątków nie ma.

| Akcja | Reprezentacja | Dowód (kod) | Dlaczego to złamanie zasady | Naprawa |
|---|---|---|---|---|
| `tbl_autofill_from_artifact` | Table | `useTableQuickActions.ts` — `nodesUndo.push(...)` wywołane PO zapisaniu danych, nie przed | nadpisuje pola wybranych wierszy natychmiast po odpowiedzi AI; jedyne zabezpieczenie to ogólny Ctrl+Z tabeli, nie dedykowany podgląd | przepiąć przez `IdeaProposalReview` — pokazać diff pól przed zapisem |
| `tbl_refresh_artifact_data` | Table | jw. | jw. | jw. |
| `convert_initiative` / `convert_decision` / `convert_task_set` / `convert_report` / `convert_presentation` (+ warianty `wb_/pf_/tbl_convert_*`) | wszystkie 4 | `handleConvert()` → `POST /my-ideas/:id/convert` | tworzy realny nowy rekord natychmiast po kliknięciu, zero podglądu, zero potwierdzenia „czy na pewno?”, brak dedykowanego cofnięcia (trzeba ręcznie skasować nowy rekord) | Convert to akcja `mutates: true` tworząca `external_artifact` — wymaga `confirmBeforeRun: true` (destrukcyjne w sensie: tworzy trwały obiekt) + potwierdzenia z podglądem docelowych pól przed utworzeniem |

**Uwaga rozróżniająca:** Convert sam w sobie nie wywołuje LLM w momencie konwersji (to field-mapping z już zapisanych danych) — ale nadal jest akcją `mutates: true` tworzącą trwały artefakt, więc podlega tej samej zasadzie potwierdzenia, niezależnie od tego, czy w danym kroku jest LLM.

## 5. Zakaz etykiety „AI” bez wywołania LLM — dziś łamany

**Zasada:** przycisk nazwany „AI” musi wywoływać model językowy. Jeśli tylko wstawia pusty element albo uruchamia heurystykę `if/else`, nie wolno używać słowa AI w etykiecie.

| Miejsce | Co się dzieje naprawdę | Dlaczego to złamanie | Naprawa |
|---|---|---|---|
| `IdeaAISuggestionsPanel.tsx` („AI Generators”, Whiteboard) — przyciski „Auto-clustering (AI)” / „Extract themes (AI)” / „Identify outcomes” | dispatchują `wb_add_cluster`/`wb_add_theme`/`wb_add_outcome` — zwykłe wstawienie PUSTEGO bloku (`handlers.addElement(...)`), zero wywołania LLM | etykieta obiecuje generatywność, której nie ma; realne generatory (`wb_ai_find_themes`/`wb_ai_name_clusters`) istnieją, ale nie są w ogóle wystawione w tym panelu | podłączyć panel do realnych `wb_ai_*` generatorów ZAMIAST atrap, albo usunąć słowo „AI” z etykiety i zostawić jako zwykłe „Dodaj klaster (pusty)” |
| `mm_auto_cluster` (Mind Map, „Auto-grupowanie”) | czysta logika `if/else` po słowach kluczowych (`useMindMapQuickActions.ts` ~linia 785), zero AI | dziś część dokumentacji/UI nazywa to „AI cluster” | zostawić bez słowa AI — to jest reguła, nie model |
| Walidacja „Waliduj” (Process Flow, `validateFlow.ts`) | czysta heurystyka bez LLM | „AI validate” jako kategoria nie istnieje i nie powinna sugerować LLM w tym miejscu | zostawić jako heurystykę nazwaną wprost („Waliduj strukturę”), bez etykiety AI |

## 6. AI per reprezentacja — co konkretnie (stan dojrzałości wg audytu)

| Reprezentacja | Akcje AI realne (LLM, proposal) | Akcje AI ograniczone (delegacja do czatu, nie structured) | Ryzyko |
|---|---|---|---|
| Mind Map | `mm_ai_expand`/`mm_ai_expand_node` (proposal, `AIProposalDiffModal`), `mm_ai_rewrite_node` (proposal, ale zbiera instrukcję przez `window.prompt()` — prymitywny UX do poprawy), `ai_suggest_links`/`mm_dependency_detect` (proposal) | `mm_ai_summarize`, `mm_ai_auto_connect`, `mm_ai_gap_analysis`, `mm_ai_deepen`, `mm_chat_about_node` — wszystkie tylko wypełniają prompt do czatu Teresy, nie generują structured proposal | żadne — delegacja do czatu jest jawna, nie udaje strukturalnej AI |
| Whiteboard | `wb_ai_find_themes`, `wb_ai_name_clusters`, `wb_ai_extract_actions` (wszystkie proposal, per-item accept) | `wb_to_map_branches`/`wb_to_table` („transform to…”) — real LLM, proposal, ALE po akceptacji ląduje jako sticky notes na TEJ SAMEJ tablicy, nie tworzy faktycznie nowego artefaktu innego typu mimo nazwy | nazwa myląca względem efektu — do jawnego zapisania w UI („wynik zostanie wstawiony tu jako karteczki, przełącz narzędzie ręcznie, by zobaczyć jako mapę/tabelę”) do czasu realnego mapowania cross-tool (D3 kontraktu — osobny projekt) |
| Process Flow | `edit_step` (proposal z before/after, najlepiej zbudowana ścieżka), `pf_create`/`flow_generator` (proposal), `node_expand` | AI Coach (`process_coach`) i Process Summary — tylko odczyt, nie modyfikują canvasu (jawnie oznaczyć jako „AI (tylko odczyt)”, nie sugerować że coś zmieniają) | brak dedykowanego logu aktywności AI analogicznego do whiteboardowego — ⟦DO USTALENIA⟧ czy istnieje |
| Table | `tbl_categorize` (proposal, per-item Apply/Apply all, ale własny UI zamiast wspólnego widgetu) | — | `tbl_autofill_from_artifact`/`tbl_refresh_artifact_data` — auto-apply, patrz §4; brak dedykowanego logu AI w ogóle |

## 7. AI krawędzi — dziś nie istnieje jako samodzielna kategoria

Żaden `EdgeContextMenu`/`EdgeStylePopover` w żadnej z 4 reprezentacji nie ma pozycji AI operującej WPROST na istniejącej krawędzi (tylko manualne: etykieta, styl, kierunek, usuń — patrz rozdział 08 §4). Najbliższe substytuty TWORZĄ nowe krawędzie, ale nie operują na już istniejącej:

| Substytut | Reprezentacja | Co robi |
|---|---|---|
| `mm_ai_auto_connect` | Mind Map | deleguje do czatu, ma tworzyć cross-links w całej mapie — brak structured proposal |
| `mm_dependency_detect` (`AIDependencyDetector.tsx`) | Mind Map | wykrywa zależności międzygałęziowe, proponuje NOWE krawędzie z etykietą relacji (`depends_on`/`enables`/`conflicts_with`/`related_to`) — Add pojedynczo/Add All |

**Docelowo:** po dodaniu menu krawędzi we wszystkich reprezentacjach (rozdział 08 §4), dopisać tam pozycję „AI: zasugeruj typ relacji” działającą na już istniejącej, zaznaczonej krawędzi — ⟦DO USTALENIA⟧ dokładny generator backendowy, nie ma go dziś.

## 8. Historia AI = FILTR w zakładce Historia, nie osobna zakładka

Zgodnie z kanonem prawego panelu (`_DECYZJE_I_KANON_WSPOLNY_2026-07-23.md`, decyzja D1): panel ma 5 zakładek — Przegląd · Właściwości · Powiązania · Komentarze · Historia. AI **nie dostaje własnej zakładki** — każde zdarzenie AI jest wpisem w Historii, wyróżnionym typem „AI”, filtrowalnym razem z resztą zdarzeń (ręczna edycja, import, konwersja).

| Wymóg | Stan dziś | Docelowo |
|---|---|---|
| Wpis Historii dla każdej zaakceptowanej propozycji AI | Whiteboard: tak (`createWhiteboardActivityEntry('ai', ...)` — generated/accepted/rejected/accepted-all/rejected-all) | wzorzec do rozszerzenia na Mind Map, Process Flow, Table |
| Filtr „Pokaż tylko AI” w zakładce Historia | ⟦DO USTALENIA⟧ — nie potwierdzone w źródłach | wymagane (Z4 §9 poniżej — „każde wykonanie przez Teresę trafia do Historii z oznaczeniem AI i autorem polecenia”) |
| Autor polecenia widoczny przy wpisie (np. „Piotr, przez Teresę: rozwiń tę gałąź”) | ⟦DO USTALENIA⟧ | wymagane |
| Convert — ślad w historii | dziś tylko `createLinkGraphEdge` (relacja idea→artefakt), NIE jest to wpis „historii AI” | Convert (jako `mutates: true`) musi też trafić do Historii jako zdarzenie, niezależnie od tego czy typ „AI” czy „konwersja” |

## 9. ★ „Teresa steruje wszystkim" (Z4)

To najważniejsza sekcja tego rozdziału. Mechanizm w pełni opisany w `_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md` — tu jego konsekwencje dla AI.

### Zasady wiążące

1. **Rejestr akcji JEST listą narzędzi Teresy.** Nie ma osobnego „katalogu AI dla Teresy” — to ten sam `ActionRegistry`, który renderuje menu i paski.
2. **Każda akcja ma `teresa: {description, parameters, confirmBeforeRun?}`.** Pole `description` opisuje działanie językiem użytkownika (nie nazwą techniczną), `parameters` to JSON Schema tego, czego akcja potrzebuje (np. `nodeId`, `instruction`, `columnKey`).
3. **Teresa nie ma akcji spoza UI — i odwrotnie.** Jeśli akcja jest dostępna w menu/pasku, MUSI być w rejestrze z wpisem `teresa`. Jeśli Teresa może coś zrobić, użytkownik musi móc znaleźć tę samą akcję w UI. Brak „ukrytych mocy” w żadną stronę.
4. **Każda akcja mutująca idzie przez ten sam proposal-review co UI.** Teresa nie ma skrótu omijającego podgląd — `requiresPreview: true` obowiązuje niezależnie od tego, kto wywołał akcję (użytkownik klikiem czy Teresa rozmową).
5. **`confirmBeforeRun` dla akcji destrukcyjnych** (usunięcie, import nadpisujący graf, konwersja tworząca trwały artefakt) — Teresa musi zapytać wprost przed wykonaniem, nie tylko pokazać podgląd.
6. **Każde wykonanie przez Teresę trafia do Historii**, oznaczone jako „AI” + autor polecenia (kto i jakim poleceniem to wywołał) — patrz §8.
7. **Teresa musi umieć powiedzieć, czego NIE potrafi**, zamiast udawać wykonanie. Jeśli żądana funkcja nie ma wpisu w rejestrze (bo jeszcze nie istnieje albo jest `disabledReason`), Teresa odpowiada wprost, że tego nie potrafi — nie próbuje improwizować zastępczego działania poza rejestrem.

### Tabela przykładów: polecenie → akcja rejestru → zakres → potwierdzenie

| Polecenie użytkownika | Akcja z rejestru | Zakres (scope) | Wymaga potwierdzenia (`confirmBeforeRun`)? | Uwaga |
|---|---|---|---|---|
| „Skonwertuj to na inicjatywę” | `idea.convert` (target: initiative) | `workspace` | **Tak** — tworzy trwały nowy rekord | dziś (§4) brak potwierdzenia w ogóle — do naprawy |
| „Ułóż mi ten proces” | `flow.auto_layout` | `current_view` | Nie — odwracalne, nie niszczy danych | — |
| „Rozwiń zaznaczoną gałąź” | `map.expand_branch` | `selected_items` | Nie (idzie przez proposal, nie przez confirm — to różne mechanizmy: proposal pokazuje CO się zmieni, confirm pyta CZY wykonać coś nieodwracalne) | proposal wystarcza |
| „Zmień nazwę tego kroku na X” | `flow.rename_step` | `single_item` | Nie | edycja odwracalna |
| „Wypełnij puste komórki w kolumnie Koszt” | `table.ai_fill` | `table_column` | Nie, ale **wymaga** `requiresPreview: true` (dziś auto-apply, §4 — łamane) | po naprawie: proposal per komórka |
| „Pokaż mi to jako tabelę” | `view.switch` | `current_view` | Nie | preferencja lokalna, nie zmienia danych |
| „Usuń tę gałąź razem z dziećmi” | `map.delete_branch` | `single_item` | **Tak** — nieodwracalne bez dedykowanego undo poza sesją | destrukcyjne |
| „Zaimportuj ten plik BPMN, zastąp obecny diagram” | `flow.import` | `workspace` | **Tak** — nadpisuje cały graf (dziś: brak confirm, R3 z audytu) | krytyczny brak — patrz naprawa danych P0 |
| „Znajdź tematy w zaznaczonych karteczkach” | `whiteboard.find_themes` | `selected_items` | Nie | proposal wystarcza |
| „Czy umiesz zmienić typ tej kolumny?” | — (brak akcji w rejestrze, ⟦DO USTALENIA⟧ D9/D10 rozdziału 08) | — | n/d | Teresa odpowiada: „Nie potrafię jeszcze zmieniać typu kolumny — ta funkcja nie jest jeszcze zaimplementowana” (zasada 7) zamiast prób obejścia |

### Konsekwencja dla poprzednich rozdziałów

Każda pozycja menu/paska opisana w rozdziale 08 (`08_MENU_KONTEKSTOWE.md`) musi mieć odpowiadający wpis `teresa.description` w rejestrze. Tabele defektów D1–D10 tamtego rozdziału pokrywają się z lukami tego rozdziału (D2 z §4 tam = brak akcji AI na krawędzi tutaj w §7).

## Kryteria odbioru

- [ ] Każda akcja AI opisana w tym rozdziale ma wpis `teresa: {description, parameters}` w rejestrze — bez wyjątków.
- [ ] Etykiety AI nazywają rzeczywiste działanie; brak jednej uniwersalnej „AI rozwiń” z różnym efektem w różnych miejscach.
- [ ] `IdeaAISuggestionsPanel` (Whiteboard) albo podłączony do realnych generatorów `wb_ai_*`, albo pozbawiony słowa „AI” w etykietach niebędących LLM.
- [ ] `tbl_autofill_from_artifact` i `tbl_refresh_artifact_data` przechodzą przez podgląd/akceptację, nie auto-apply.
- [ ] Convert (`convert_*`, wszystkie warianty) wymaga potwierdzenia przed utworzeniem trwałego artefaktu.
- [ ] Jeden wspólny widget proposal-review (nie 2–3 niezależne kopie) używany przez wszystkie 4 reprezentacje.
- [ ] Historia ma filtr „AI”, każdy wpis AI pokazuje autora polecenia.
- [ ] Menu krawędzi (po wdrożeniu rozdziału 08) ma pozycję AI działającą na istniejącej krawędzi, ⟦DO USTALENIA⟧ generator zamknięty decyzją.
- [ ] Teresa wykonuje wyłącznie akcje z rejestru; przy braku akcji odpowiada wprost, że nie potrafi, zamiast improwizować.
- [ ] Destrukcyjne akcje (usunięcie, import nadpisujący, konwersja) mają `confirmBeforeRun: true` i realny dialog potwierdzenia w UI.
- [ ] Weryfikacja wzrokiem: podgląd propozycji AI wygląda i działa tak samo w Mind Map/Whiteboard/Process Flow/Table (Z1), w obu motywach.
