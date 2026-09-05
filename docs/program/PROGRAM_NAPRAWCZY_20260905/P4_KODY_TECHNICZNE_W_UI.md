# P4 — Żadnych kodów w interfejsie

Pakiet z tabeli „Plan (I) Tydzień 1: fundamenty" w `docs/program/AUDYT_AWARD_20260905/D_SYNTEZA_I_PLAN.md`
(przyczyna źródłowa **#4**). Szablon: `docs/program/PROGRAM_NAPRAWCZY_20260905/00_SZABLON_PACZKI.md`.

## 1. Cel dla użytkownika

Tam, gdzie dziś widać kod bazy danych, nazwę wewnętrznej funkcji serwera, surowy identyfikator UUID albo
angielski enum bez etykiety, użytkownik zobaczy normalne polskie zdanie albo nazwisko/nazwę — nigdy ciąg
znaków, który ma sens tylko dla programisty.

## 2. Zakres

Co najmniej **15 ekranów/pól** w 5 modułach (liczba z wiersza #4 tabeli §2 w `D_SYNTEZA_I_PLAN.md`).
Poniżej każde odchylenie ma dowód ze zrzutu w `evidence/audyt-award-20260905/<modul>/` i źródło w
`docs/program/AUDYT_AWARD_20260905/{A,B,C}*.md`.

| # | Moduł | Ekran | Co widać | Dowód (audyt) |
| :-: | --- | --- | --- | --- |
| 1 | Moja Praca | Pomysły — podgląd | „Źródło: manual" | A §MP4, `evidence/audyt-award-20260905/moja-praca/06-pomysly-preview.png` |
| 2 | Wywiad | Zakładka Przydzielone (`?tab=managed`) | „commercial" w wierszach 1/4, „COMMERCIAL" w wierszach 2–3 tej samej kolumny | A §W4, `evidence/audyt-award-20260905/wywiad/03-tab-przydzielone.png`, zoom `03b-zoom-overflow-row.png` |
| 3 | Wywiad | Zakładka Szablony | ta sama niespójność wielkości liter, drugie miejsce w kodzie | A §W4 |
| 4 | Wyniki | Cel — podgląd (OKR, blokada edycji) | „ten zestaw jest w statusie innym (kod serwera: assertSetEditableForUpdate)" | B §4 (Top-10), `wyniki-15-cel-karta.png`, `wyniki-17-kluczowe-rezultaty.png` |
| 5 | Wyniki | Modal „Nowa karta wyników" — pole WŁAŚCICIEL | „Ty (d2b6a316-08c5-47cf-9bf7-4ba50311d5a2)" | B §Wyniki tabela + §6, `wyniki-07-scorecard-open.png` |
| 6 | Wyniki | Karta wyników — podgląd, pole „Cel zakresu" | „a3e05d4a..." (UUID ucięty) | B §Wyniki tabela + §6, `wyniki-08-scorecard-real.png` |
| 7 | Wyniki | Karta wyników — właściwości OKR/KPI, pole „Program" | „e4329f41-d509-4575-a49c-0a2d2e49edf2" | B §6, `wyniki-12-okr-cel.png` |
| 8 | Wyniki | Karta wyników — pola „Dodane przez / Utworzono przez / Opublikowano przez / Suma treści" (gdy brak nazwy) | ten sam skrócony-UUID fallback, 5 dalszych miejsc w jednym pliku | rg własny (patrz §3.6) — nie w audycie A/B/C wprost, ten sam wzorzec co #6/#7 |
| 9 | Realizacja | Obciążenie (Menu 3) | „2/2/2 MONTH" — jednostka okresu nieprzetłumaczona | B (tabela Realizacji), `inicjatywy-06-obciazenie-tab.png` |
| 10 | Realizacja | Zasoby | „MONTH" w kolumnie OKRES | B, `realizacja-04-zasoby.png` → `realizacja-04c-zasoby-22s.png` |
| 11 | Materiały | Dokumenty | kolumna formatu = „Unknown" | C (Materiały tabela) + Deduction 1, `materialy/02c-dokumenty.png` |
| 12 | Materiały | Arkusze | „Unknown" jak wyżej | C, `materialy/04c-arkusze.png` |
| 13 | Finanse | Sprawozdanie — podgląd 1-click | surowe kody enum w polu „Stan pakietu" | C (Finanse tabela) + Deduction 2, `finanse/02-sprawozdanie-detal.png` |
| 14 | Finanse | Sprawozdanie — pełny widok, blok gotowości | zdanie angielskie z kodami sklejonymi przecinkiem: „Statement pack needs attention: MISSING_PL, INVALID_PERIOD_COUNT…" | rg własny (patrz §3.1) — ten sam ekran co #13, głębszy poziom (pełny widok, nie tylko preview) |
| 15 | Ocena | Raport — status „Final" | etykieta i kolor po angielsku/wycofanym wariancie (zob. pakiet P6 dla koloru; etykieta sama w sobie jest wartością enum nieprzetłumaczoną: DRAFT/GENERATING/FINAL/PENDING_APPROVAL/APPROVED renderowane 1:1) | B/A nie objęły tego ekranu wprost — własny rg, `src/components/assessment/AssessmentHub.tsx:2955-2999` |

**Finanse jest formalnie poza MVP** (decyzja właściciela, §4 `D_SYNTEZA_I_PLAN.md`: „wyrzucamy z MVP") —
pozycje 13–14 zostają w tym dokumencie jako dowód wzorca (ten sam mechanizm co Wyniki/Moja Praca), ale
**nie wchodzą do kroków wykonania fali 1** — patrz §5, krok 5 (opcjonalny, fala 2).

## 3. Przyczyna źródłowa

Cztery różne mechanizmy produkują ten sam efekt — surowa wartość techniczna zamiast ludzkiego zdania.
Każdy zweryfikowany `rg`/`sed` na HEAD gałęzi `codex/m03-admin-20260824` (2026-09-05).

### 3.1 Enum bez mapy etykiet

- `src/components/MyWork/IdeaPreview.tsx:183` — pole właściwości: `value: String(idea.sourceType)`.
- `src/components/MyWork/IdeaPreview.tsx:318` — ten sam enum drugi raz, w `relationItems`:
  `` label: `${isPolish ? 'Źródło' : 'Source'}: ${idea.sourceType}` ``.
  Wartość realna to `manual`/`ai` — nigdzie nie ma mapy `manual→Ręcznie`, `ai→AI`.
- `src/components/Interview/InterviewHub.tsx:6887` — zakładka Przydzielone:
  `{assignment.template?.category || assignment.template?.name || '—'}` — surowa wartość z danych
  (`commercial`/`COMMERCIAL`) bez normalizacji wielkości liter.
- `src/components/Interview/InterviewHub.tsx:5719` — zakładka Szablony, ten sam wzorzec: `{row.category}`
  bezpośrednio w komórce tabeli.
- `src/components/assessment/AssessmentHub.tsx:2955-2999` (`REPORT_STATUS_CONFIG`) — klucze `DRAFT`,
  `GENERATING`, `FINAL`, `PENDING_APPROVAL`, `APPROVED`, `label` po angielsku, renderowane wprost jako
  treść pigułki statusu raportu.
- Realizacja „MONTH": jednostka okresu formatowana bez i18n — wartość enum backendu (`month`/`week`) trafia
  do UI bez przejścia przez słownik jednostek (plik dokładny nie zidentyfikowany w audycie B; do potwierdzenia
  przy kroku 3 — prawdopodobnie w warstwie formatującej `CapacityScenarioSurface`/Obciążenie, zob.
  `src/components/Initiatives/CapacityScenarioSurface.tsx`, gdzie już żyje `useOrganizationMemberNames`).
- Materiały „Unknown": kolumna formatu pliku pokazuje fallback `'Unknown'` z samych metadanych zamiast
  polskiego `—` (Deduction 1, plik dokładny do potwierdzenia w kroku wykonania — kandydat:
  `src/components/Materials`/`DocumentStudio` lista biblioteki, kolumna `format`).

### 3.2 Identyfikator zamiast nazwy — resolver „skróć UUID", nie „znajdź nazwę"

- `src/components/ResultsVNext/kpiScorecards/kpiScorecardMappers.ts:184-187`:
  ```ts
  export function shortKpiScorecardId(id: string | null | undefined): string {
    if (!id) return '—';
    return id.length > 10 ? `${id.slice(0, 8)}…` : id;
  }
  ```
  Ta funkcja jest **fallbackiem**, gdy pole `*Name` jest puste — używana w
  `src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters.tsx` w **ośmiu** miejscach:
  linie 354 (`kpiName`), 395 (`scopeId` — to jest „Cel zakresu: a3e05d4a…"), 483 (`kpiName` w tabeli),
  518 (`addedBy`), 608 (tytuł karty), 624 (`addedBy` we właściwościach), 786 (`createdBy`),
  788 (`publishedBy`), 795 (`contentHash`, tu skrót jest właściwy — to hash, nie identyfikator osoby).
  **Wzorzec:** ilekroć serwer nie dostarczy `*Name`, użytkownik widzi ucięty UUID zamiast normalnego
  „Nieznany" albo rozwiązanej nazwy.
- `kpiScorecardMappers.ts:189-197` (`kpiScorecardOwnerDisplay`) **już** rozwiązuje jeden przypadek
  poprawnie („Ty", gdy `ownerUserId === currentUserId"), ale poza tym woła ten sam `shortKpiScorecardId`
  zamiast sięgnąć po listę członków organizacji.
- `src/components/ResultsVNext/kpiScorecards/CreateKpiScorecardModal.tsx:314-323` — pole „Właściciel" w
  modalu tworzenia karty wyników pokazuje zawsze `Ty (${currentUserId})` — nawet gdy „Ty" już
  jednoznacznie identyfikuje osobę, obok dokleja się surowy UUID w monospace.
- **Kontrast:** `src/hooks/useOrganizationMemberNames.ts` (dodany 2026-09-05, dokumentacja w nagłówku
  pliku opisuje dokładnie tę samą rodzinę defektu — „surowe UUID zamiast nazwiska" — naprawioną w czterech
  innych miejscach: `ResultsAttentionPage`, `ResultsRoiHub`, `ResultsOkrHub`, `KpiToolPage`). Hook już
  istnieje i już umie: pobrać listę członków ze store, zbudować mapę `userId→etykieta` (obsługuje
  `camelCase` i `snake_case` naraz — bo serwer realnie zwraca `snake_case`), zwrócić uczciwe `null`
  zamiast zgadywać. **`kpiScorecardPresenters.tsx`/`CreateKpiScorecardModal.tsx` go nie używają** — to
  jest luka do zamknięcia, nie nowy mechanizm do wynalezienia.

### 3.3 Nazwa wewnętrznej funkcji serwera w komunikacie dla klienta

- `src/components/ResultsVNext/okr/okrObjectiveMappers.ts:185-186` (`getOkrSetChildEditLock`):
  ```ts
  pl: `Cele i Kluczowe Rezultaty można dodawać i edytować tylko, gdy zestaw OKR jest w statusie "Szkic"
       lub "Wymaga poprawek" — ten zestaw jest w statusie innym (kod serwera: assertSetEditableForUpdate).`,
  ```
  To **nie jest** wyciek z odpowiedzi API — to zdanie jest **na stałe wpisane w kodzie klienta**, celowo
  cytuje nazwę funkcji serwera (`server/src/services/resultsVnext/okr/okrObjectiveCommands.ts:121`) jako
  część treści. Pierwsze zdanie („Cele i KR można dodawać… Szkic/Wymaga poprawek") samo w sobie
  **wystarcza** — dopisek w nawiasie nie dodaje niczego użytkownikowi, tylko programiście.

### 3.4 Sklejony string serwera z kodami enum w środku (fala 2, Finanse)

- `server/src/services/financialStatementPackService.ts:147-161` — budowa tablicy `reasonCodes` z
  literałów `MISSING_PL`, `MISSING_BS`, `MISSING_CF`, `DUPLICATE_STATEMENT_TYPE`, `INVALID_PERIOD_COUNT`,
  `INVALID_MEMBER_COUNT`, `MISSING_PERIOD_STATEMENT`, `INCONSISTENT_ENTITY`, `INCONSISTENT_SOURCE`,
  `INCONSISTENT_CURRENCY`, `INCONSISTENT_SCALING`, `HAS_REJECTED_STATEMENT`, `HAS_PENDING_STATEMENT`,
  `HAS_RECOVERABLE_STATEMENT` (15 kodów razem).
- `financialStatementPackService.ts:226`: `` packQualitySummary = `Statement pack needs attention:
  ${reasonCodes.join(', ')}.` `` — zdanie po angielsku ZE SKLEJONYMI KODAMI, zapisywane do kolumny
  `pack_quality_summary` w bazie.
- `src/components/Economics/FinanceHub.tsx:1148-1150` — czyta tę kolumnę 1:1 do
  `readinessSummary: String(statement.pack_quality_summary || statement.quality_summary || '')`.
- `src/components/Finance/FinancialStatementWorkspace.tsx:830` — renderuje `detail.readinessSummary`
  wprost w pełnym widoku sprawozdania — użytkownik widzi dokładnie ten sklejony angielski string z kodami.
- **Częściowa naprawa już istnieje i jest niekompletna:** `src/components/Finance/statementReadinessCopy.ts`
  (komentarz w nagłówku: „FALA 1 / surowe identyfikatory w UI, 2026-07-27") mapuje **10 z 15** kodów
  (`REASON_COPY`) na zdania PL/EN przez `statementReasonSentences()` — ale to dotyczy
  `readinessReasonCodes` (tablicy, renderowanej osobno jako lista zdań w `FinancialStatementWorkspace.tsx`
  linie 839, 1100), **nie** dotyczy `readinessSummary` (string złożony po stronie serwera), który omija
  mapę całkowicie. Brakuje w `REASON_COPY`: `INVALID_PERIOD_COUNT`, `INVALID_MEMBER_COUNT`,
  `MISSING_PERIOD_STATEMENT`, `INCONSISTENT_ENTITY`, `INCONSISTENT_SOURCE` — właśnie te kody, które audyt C
  zobaczył na zrzucie „Stan pakietu".
- `src/components/Economics/FinancePreviewPanel.tsx:552-554` — pole „Pack status" (`t('finance.statements.
  validation', 'Pack status')`) renderuje `statementPreviewDetail.validationStatus` (=`pack_status`:
  `draft`/`partial`/`ready`/`confirmed`/`needs_review`/`archived`) z klasą CSS `capitalize` zamiast
  tłumaczenia — angielskie słowo z wielką literą, nie polska etykieta.

### 3.5 Weryfikacja negatywna (co NIE jest tym defektem)

`grep -rn "MISSING_PLAN"` (dokładna pisownia z audytu C) **nie znajduje nic** w repo — realny kod to
`MISSING_PL` (bez „AN" na końcu), audyt ma literówkę w transkrypcji zrzutu. Poprawiono w tabeli §2 wyżej.

## 4. Projekt rozwiązania

**Jedna decyzja architektoniczna, trzy mechanizmy — bo to trzy różne rodzaje surowizny, nie jeden.**

1. **Warstwa etykiet dla wartości słownikowych — `src/labels/` (nowy katalog, SSOT).**
   Jeden plik na domenę: `src/labels/ideaSourceLabels.ts` (manual/ai), `src/labels/interviewCategoryLabels.ts`
   (normalizacja wielkości liter kategorii szablonów/przydzieleń — funkcja `normalizeTemplateCategory`,
   wywoływana w OBU miejscach `InterviewHub.tsx:6887` i `:5719`), `src/labels/capacityUnitLabels.ts`
   (MONTH/WEEK→miesiąc/tydzień), `src/labels/fileFormatLabels.ts` (Unknown→„—" lub realny format),
   `src/labels/reportStatusLabels.ts` (DRAFT/GENERATING/FINAL/PENDING_APPROVAL/APPROVED — zastępuje
   `REPORT_STATUS_CONFIG` w `AssessmentHub.tsx`, viz. pakiet P6 dla koloru). Kształt jednolity z tym, co
   już istnieje i działa dobrze: `src/components/Finance/statementReadinessCopy.ts` (wzorzec `{key,
   fallbackEn}` + `t()` + jawny fallback „nieznany kod → ogólne zdanie") — **nie wymyślamy nowego
   kształtu, kopiujemy ten**. Zakaz: żaden komponent nie robi `String(enumValue)` ani nie renderuje
   `row.category`/`sourceType`/`readinessStatus` bezpośrednio — zawsze przez funkcję z `src/labels/`.

2. **Resolver nazw dla identyfikatorów — rozszerzenie `useOrganizationMemberNames`, NIE nowy mechanizm.**
   `src/hooks/useOrganizationMemberNames.ts` już jest kanonicznym miejscem (dokumentacja w pliku wprost
   nazywa to zjawisko i historię czterech duplikatów). Zadanie: (a) `kpiScorecardPresenters.tsx` i
   `CreateKpiScorecardModal.tsx` mają zacząć z niego korzystać zamiast `shortKpiScorecardId` dla pól
   `ownerUserId`/`addedBy`/`createdBy`/`publishedBy`; (b) `shortKpiScorecardId` zostaje TYLKO dla
   `contentHash` (to faktycznie hash, skrót jest właściwy) i jako **ostateczny** fallback, gdy resolver
   zwróci `null` — ale wtedy tekst ma brzmieć „Nieznany użytkownik (id ukryty)”, nie surowy skrót; (c) dla
   `scopeId` („Cel zakresu") potrzebny jest DRUGI, nowy resolver — nie użytkownika, tylko nazwy
   celu/zestawu OKR po id (`useOkrObjectiveNames` albo rozszerzenie istniejącego `okrObjectiveMappers.ts`
   o pobranie nazwy z już załadowanej listy zestawów, żeby uniknąć kolejnego round-tripu do API). Ten sam
   wzorzec dla „Program: e4329f41…" — id projektu/programu → nazwa z listy już posiadanej przez ekran.
   Zakaz: żaden komponent w folderze `ResultsVNext` nie pisze własnej kopii mapy `id→etykieta` — to
   dokładnie ten błąd, który `useOrganizationMemberNames.ts` już raz naprawił w czterech miejscach.

3. **Mapper komunikatów błędu na granicy klienta API — jedno miejsce, nie punktowe łatanie.**
   Nowy plik `src/services/api/errorMessageMapper.ts`: funkcja `mapServerErrorToUserMessage(code: string,
   fallback: {pl: string; en: string}) → string`. Wywoływana **wszędzie**, gdzie klient formułuje zdanie
   zawierające „kod serwera: X” / nazwę funkcji backendu / surowy kod HTTP-poziomu-aplikacji. Pierwsza
   ofiara do naprawy: `okrObjectiveMappers.ts:185-186` — usunąć dopisek `(kod serwera:
   assertSetEditableForUpdate)` z widocznego zdania PL/EN; jeśli potrzebny do diagnostyki, przenieść do
   `title`/tooltipa ikony „i” obok komunikatu, nie do głównej treści. Analogicznie
   `okrKeyResultCommands.ts`/`okrObjectiveCommands.ts` (trzy dalsze wywołania `assertSetEditableForUpdate`
   z tym samym wzorcem komunikatu) — sprawdzić przy kroku wykonania, czy mają osobne stringi PL z tym samym
   dopiskiem. Zasada ogólna (dla przyszłych przypadków spoza tego audytu): nieznany kod → generyczne
   „Coś poszło nie tak, spróbuj ponownie" + kod w `title=` tooltipa, NIGDY w treści zdania.
   Dla Finansów (fala 2): `statementReadinessCopy.ts` dostaje 5 brakujących wpisów w `REASON_COPY`
   (`INVALID_PERIOD_COUNT`, `INVALID_MEMBER_COUNT`, `MISSING_PERIOD_STATEMENT`, `INCONSISTENT_ENTITY`,
   `INCONSISTENT_SOURCE`) i `financialStatementPackService.ts:226` przestaje sklejać `reasonCodes.join(', ')`
   do `packQualitySummary` — zamiast tego serwer zapisuje SAM kod (albo tablicę kodów, tak jak już robi dla
   `packQualityReasonCodes`), a zdanie buduje klient przez `statementReasonSentences()` w OBU miejscach
   (pełny widok i preview panel).

**Kanon:** żadna z tych zmian nie dotyka `StandardTable`/`StandardModuleBar`/`StandardPreview` jako
komponentów — to zmiana w danych podawanych DO nich (kolumny/właściwości), nie w samych komponentach
wspólnych. Zero nowych kolorów, zero zmian w kebabie. i18n: każda etykieta ma parę pl+en (wzorzec
`{key, fallbackEn}` z `statementReadinessCopy.ts`).

## 5. Kroki wykonania

Kolejność: najpierw katalog `src/labels/` (bo kroki 2–4 go importują), potem resolver, na końcu mapper
błędów (najbardziej izolowany, zero zależności od pozostałych).

1. **[S] Katalog `src/labels/` + `ideaSourceLabels.ts`.** Plik nowy + użycie w
   `src/components/MyWork/IdeaPreview.tsx:183` i `:318` (2 miejsca, ten sam plik). Test jednostkowy:
   `ideaSourceLabels.test.ts` — asercja `sourceLabel('manual', true) === 'Ręcznie'`,
   `sourceLabel('unknown_future_value', true)` zwraca fallback, nie surowy string. Moduł: Moja Praca.
   **Zweryfikowane w `docs/program/MVP_FINAL_ZAMROZONE.json`:** `IdeaPreview.tsx` jest na liście `pliki`
   klucza `07_MY_WORK_AGENT` („Moja praca / Agent") → commit wymaga
   `[ODMROZENIE 07_MY_WORK_AGENT DEC-<nr>]`.
2. **[S] `interviewCategoryLabels.ts` (`normalizeTemplateCategory`).** Użycie w `InterviewHub.tsx:6887` i
   `:5719`. Test: wejście `'COMMERCIAL'`/`'commercial'`/`'Commercial'` → jedno wyjście. Moduł: Wywiad.
   **Zweryfikowane:** `src/components/Interview/InterviewHub.tsx` jest na liście `pliki` klucza
   `02_INTERVIEW` w `MVP_FINAL_ZAMROZONE.json` → commit wymaga `[ODMROZENIE 02_INTERVIEW DEC-<nr>]`.
   (Uwaga: klucz `03_TOOLS` zamraża INNY plik o tej samej nazwie —
   `src/components/Discovery/InterviewHub.tsx` — nie mylić przy odmrożeniu; ten pakiet dotyczy tylko
   `Interview/InterviewHub.tsx`.)
3. **[M] `capacityUnitLabels.ts` + `fileFormatLabels.ts`.** Wymaga najpierw zlokalizowania dokładnego
   pliku renderującego „MONTH" (Realizacja/Obciążenie) i „Unknown" (Materiały) — audyt B/C nie podał
   linii, tylko ekran; pierwsza połowa kroku to `rg` w `src/components/Initiatives/CapacityScenarioSurface.tsx`
   (zweryfikowane: TEN plik nie jest na liście `pliki` klucza `06_EXECUTION` w
   `MVP_FINAL_ZAMROZONE.json` — ale samo Realizacja JEST zamrożone jako moduł: sprawdzić plik dokładny po
   lokalizacji względem tej listy, zanim się założy brak markera) i bibliotece Materiałów (moduł
   **ZAMROŻONY**, klucz `11_MATERIALS`, 52 pliki na liście — `DocumentStructurePreview.tsx`/`types.ts`
   potwierdzone na liście, ale to nie brzmi jak plik z kolumną formatu; realny plik do zlokalizowania i
   sprawdzenia względem tej samej listy PRZED edycją — commit prawdopodobnie będzie wymagał
   `[ODMROZENIE 11_MATERIALS DEC-<nr>]`).
4. **[M] Rozszerzenie `useOrganizationMemberNames` na `ownerUserId`/`addedBy`/`createdBy`/`publishedBy`
   w `kpiScorecardPresenters.tsx` (8 wywołań `shortKpiScorecardId`, patrz §3.2) + poprawka
   `CreateKpiScorecardModal.tsx:320-322` (usunąć surowy `currentUserId` z widoku, zostawić samo „Ty").**
   Nowy resolver `useOkrObjectiveNames`/rozszerzenie `okrObjectiveMappers.ts` dla pola „Cel zakresu"
   (`scopeId`) i „Program". Moduł: Wyniki — **NIE zamrożony** (brak w `MVP_FINAL_ZAMROZONE.json`, dobra
   wiadomość — Wyniki i tak czeka na P7, więc to i tak w toku zmian).
5. **[S] `errorMessageMapper.ts` + poprawka `okrObjectiveMappers.ts:185-186`** (usunąć dopisek
   „kod serwera: assertSetEditableForUpdate" z treści PL/EN, przenieść do tooltipa). Sprawdzić przy okazji
   trzy pozostałe wywołania `assertSetEditableForUpdate` (`okrKeyResultCommands.ts:212,421,628`) — czy mają
   analogiczny wyciek. Moduł: Wyniki.
6. **[M] (fala 2, opcjonalny — Finanse poza MVP) `statementReadinessCopy.ts`: 5 brakujących kodów w
   `REASON_COPY` + zmiana `financialStatementPackService.ts:226`** (serwer przestaje sklejać zdanie,
   zwraca tylko kody) + `FinancePreviewPanel.tsx:552-554` (t łumaczenie `pack_status` zamiast
   `capitalize`). Ten krok NIE wchodzi do odbioru fali 1 — zostaje udokumentowany, żeby ktoś nie musiał
   odkrywać tego samego mechanizmu od zera, gdy Finanse wrócą do planu.
7. **[S] `reportStatusLabels.ts` dla `AssessmentHub.tsx:2955-2999`** — etykiety PL zamiast
   DRAFT/GENERATING/FINAL/PENDING_APPROVAL/APPROVED. Kolor tej samej mapy jest przedmiotem pakietu **P6**
   (indygo/fiolet → neutralny/dozwolony wariant) — jeden PR może zrobić oba na raz, bo to ten sam obiekt
   konfiguracyjny w kodzie. **Zweryfikowane: `AssessmentHub.tsx` JEST na liście `pliki` klucza
   `04_ASSESSMENT`** w `MVP_FINAL_ZAMROZONE.json` (179 plików na liście) → commit wymaga
   `[ODMROZENIE 04_ASSESSMENT DEC-<nr>]`. Moduł Ocena był zatwierdzony graficznie 05.09 (§4
   `D_SYNTEZA_I_PLAN.md` nie wymienia Ocenę wśród otwartych, ale audyt B ocenił Raport 1/1 i 0/2 — dwa
   ekrany tego modułu NIE są w praktyce gotowe mimo zamrożenia; potwierdzić z właścicielem przed
   odmrożeniem, czy to świadoma decyzja „zamrażamy mimo znanych usterek" czy przeoczenie).

**Zależności:** krok 1 i 2 niezależne od siebie i od reszty. Krok 4 i 5 mogą iść równolegle (różne pliki).
Krok 6 zależny od niczego, ale odłożony (fala 2). Krok 7 zależny koordynacyjnie od P6 (jeden PR, dwa
dokumenty źródłowe).

## 6. Testy

**Jednostkowe** (dowód mutacyjny — test musi failować, gdy funkcja etykiety zwraca surowy input):
- `ideaSourceLabels.test.ts`, `interviewCategoryLabels.test.ts`, `capacityUnitLabels.test.ts`,
  `fileFormatLabels.test.ts`, `reportStatusLabels.test.ts` — każdy asertuje pełną mapę + fallback dla
  wartości spoza słownika (mutacja: usuń jeden wpis z mapy → test na ten wpis musi się wywalić, nie
  przejść „przypadkiem" przez fallback).
- `useOrganizationMemberNames.test.ts` (już istnieje: `src/hooks/__tests__/useOrganizationMemberNames.
  test.ts`) — rozszerzyć o przypadek użycia w kontekście KPI Scorecard (member camelCase + snake_case).
- `errorMessageMapper.test.ts` — asercja: string zwrócony do UI NIE zawiera żadnej z fraz `assertSet`,
  `kod serwera`, `server rule` (regex negatywny) dla żadnego zarejestrowanego kodu.

**Guard test (nowy, cross-cutting)** — `tests/unit/i18n/no-raw-technical-values-in-ui.test.ts`:
renderuje (lub statycznie skanuje zbudowany bundle/źródło) komponenty z listy w §2 i asertuje regexem:
- brak dopasowania `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` (UUID) w tekście
  renderowanym użytkownikowi (poza polami jawnie oznaczonymi jako techniczne/dev, np. stopka „ID:” w
  panelu deweloperskim, jeśli taki istnieje — biała lista jawna w teście);
- brak dopasowania `^[A-Z][A-Z_]{2,}$` (SCREAMING_CASE) jako samodzielnej wartości tekstowej w komórce
  tabeli/właściwości (dozwolone wyjątki: skróty produktowe typu „OKR", „KPI", „ROI" — biała lista);
- brak frazy `kod serwera:`/`server rule:`/nazwy funkcji `assert[A-Z]\w+` w jakimkolwiek stringu
  widocznym dla użytkownika.
  Dowód mutacyjny: cofnięcie jednego z kroków 1–5 (np. przywrócenie `String(idea.sourceType)`) MUSI
  wywalić ten test.

**Wizualne** — zrzuty PRZED/PO dla wszystkich 15 pozycji z §2 (poza Finansami, fala 2), viewport 1440 px,
jasny motyw (ciemny — poza zakresem audytu źródłowego, patrz „Czego nie zmierzyliśmy" w
`D_SYNTEZA_I_PLAN.md` §5, ale dodać przy okazji jeśli tani kosztem).

**Przepływ klikany (Playwright)**: „otwórz podgląd pomysłu → sprawdź pole Źródło" (Moja Praca);
„otwórz zakładkę Przydzielone i Szablony → porównaj wielkość liter kategorii w obu" (Wywiad); „otwórz
zablokowany zestaw OKR w statusie ≠ szkic/wymaga poprawek → przeczytaj komunikat blokady" (Wyniki);
„otwórz modal Nowa karta wyników → sprawdź pole Właściciel" (Wyniki); „otwórz kartę wyników z pustym
`scopeId`.Name → sprawdź Cel zakresu" (Wyniki).

## 7. Kryterium odbioru właściciela

Na ekranie: pole „Źródło" pomysłu mówi „Ręcznie" albo „AI", nigdy „manual"; kategoria wywiadu wygląda
tak samo we wszystkich wierszach; komunikat blokady OKR kończy się na pierwszym zdaniu, bez nawiasu z
nazwą funkcji; modal nowej karty wyników pokazuje „Ty" bez UUID-u obok; „Cel zakresu" i „Program" pokazują
nazwę, nie ciąg znaków zaczynający się jak numer seryjny. Właściciel klika po kolei te 5 ekranów na
zrzucie i nie zadaje pytania „co to za kod".

## 8. Ryzyka i cofanie

- **Ryzyko:** rozszerzenie `useOrganizationMemberNames` na nowe wywołania może ujawnić przypadki, gdy
  lista członków organizacji nie jest jeszcze załadowana w kontekście `ResultsVNext` (inny store slice niż
  tam, gdzie hook już działa) — objaw: nagłe „Nieznany użytkownik" tam, gdzie wcześniej był chociaż UUID.
  Mitygacja: test integracyjny ładujący store przed renderem, nie tylko unit na czystej funkcji.
- **Ryzyko (Wywiad, zamrożony):** normalizacja kategorii może zmienić sortowanie/filtrowanie, jeśli gdzieś
  indziej kod polega na dokładnej wartości `'COMMERCIAL'` (np. filtr Menu 3). Mitygacja: `rg
  "'COMMERCIAL'|'commercial'"` przed zmianą, normalizacja TYLKO w warstwie prezentacji (render), nie w
  danych/filtrach.
- **Cofanie:** każdy krok to osobny plik nowy + 1–2 linie zmienione w miejscu użycia — `git revert` per
  commit bezpieczny, zero migracji bazy w krokach 1–5 i 7. Krok 6 (Finanse, fala 2) dotyka kolumny bazy
  (`pack_quality_summary`) tylko przez zmianę TREŚCI zapisywanej od teraz — dane historyczne zostają stare
  (nieszkodliwe, bo pole poza MVP).
- **Tag bezpieczny:** przed krokiem 2 (moduł zamrożony Wywiad) i krokiem 1 (moduł zamrożony Moja Praca)
  sprawdzić `demo-safe-<data>` istnieje i jest aktualny (`_RUNBOOK_COFANIA.md`).

## 9. Nakład

| Krok | Opis | Model | Osobodni |
| :-: | --- | :-: | :-: |
| 1 | `ideaSourceLabels` | Sonnet | 0,25 |
| 2 | `interviewCategoryLabels` | Sonnet | 0,25 |
| 3 | `capacityUnitLabels` + `fileFormatLabels` (wymaga lokalizacji plików) | Sonnet | 0,75 |
| 4 | Resolver nazw KPI Scorecard (8 miejsc + nowy resolver scope/program) | Opus (dotyka współdzielonego hooka) | 1,5 |
| 5 | `errorMessageMapper` + poprawka OKR lock message | Sonnet | 0,5 |
| 6 | Finanse (fala 2, opcjonalny) | Sonnet | 1,0 |
| 7 | `reportStatusLabels` (etykiety; kolor w P6) | Sonnet | 0,25 |
| Guard test | skan UUID/SCREAMING_CASE | Opus (test cross-cutting, ryzyko fałszywych trafień) | 0,5 |

**Razem fala 1 (kroki 1,2,3,4,5,7 + guard):** ~4 osobodni. Krok 6 osobno, po decyzji o powrocie Finansów.
**Równoleglenie:** kroki 1, 2, 3 mogą iść trzema różnymi robotnikami naraz (różne pliki, zero konfliktu).
Krok 4 wymaga Opusa ze względu na współdzielony hook używany w 5 innych ekranach (`useOrganizationMemberNames`)
— błąd tutaj cofa naprawę z 02.09 opisaną w nagłówku pliku.

---

## 10. Cel osiągnięty = samokontrola Codexa (praca do celu)

| Komenda | Oczekiwany wynik |
| --- | --- |
| `npx vitest run src/labels/__tests__ tests/unit/labels` | PASS; każdy słownik ma test „nieznana wartość → fallback, nigdy surowy string”; dowód mutacyjny: usunięcie mapowania `manual` → test pada |
| `npx vitest run src/components/ResultsVNext/kpiScorecards/__tests__ src/components/ResultsVNext/okr/__tests__` | PASS; 8 wywołań `shortKpiScorecardId` zastąpione nazwami; `okrObjectiveMappers` bez „kod serwera:” w treści |
| `npx vitest run tests/unit/ui/noRawTechnicalValues.test.ts` (nowy strażnik) | PASS; skanuje wyrenderowane teksty fikstur pod regex UUID `[0-9a-f]{8}-[0-9a-f]{4}-` i SCREAMING_CASE `\b[A-Z]{3,}(_[A-Z]+)+\b`; dowód mutacyjny: wstawienie `{row.ownerId}` do dowolnej komórki → test pada |
| `rg -n "shortKpiScorecardId\|String\(idea\.sourceType\)\|kod serwera" src` | 0 trafień poza testami |
| `bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh` | `OK` |
| `git log --format=%s origin/staging..HEAD` | commity w `07_MY_WORK_AGENT`, `02_INTERVIEW`, `11_MATERIALS` z `[ODMROZENIE <MODUL> DEC-397]` |

Pomiar na żywo (własny vite, `--dom=body` → pole `tekst` w `.json`): Pomysły podgląd, Wywiad Przydzielone, Realizacja Obciążenie, Materiały biblioteka, KPI tabela zestawień z podglądem, modal nowego zestawienia, OKR edycja zestawu z błędem walidacji (wywołać zapis niedozwolony).

Progi:
- Regex UUID w tekście widocznym = **0** trafień na 7 ekranach (dziś: „Cel zakresu a3e05d4a…”, UUID w modalu).
- Regex SCREAMING_CASE (`MISSING_PLAN`, `MONTH`, `INVALID_*`) = **0**; słowo „Unknown” = 0; „manual” jako etykieta = 0; jedna kolumna kategorii ma jedną formę (`Komercyjne`).
- Komunikat błędu OKR po polsku, bez nazwy funkcji serwera; kod dostępny wyłącznie w dymku.
- `bledyKonsoli` = 0.

**STOP:** progi spełnione → commit `evidence/p4-kody/` + raport z listą słowników (plik, liczba etykiet pl/en). Gdy wartość nie ma sensownej polskiej etykiety bez decyzji produktowej (np. nowy status bez definicji) → fallback „Nieznana wartość” + wpis w raporcie, nie zgadywanie. Zakazy: `--no-verify`, `git stash`, słownik z angielskimi wartościami w `pl`.

## 11. Wklejka dla Codexa

```
ZADANIE P4 — Koniec kodów technicznych w interfejsie. Praca do celu.

Katalog: świeży worktree z origin/staging (git worktree add -b codex/p4-kody <dir> origin/staging). Commit per krok, bez push, autor Piotr <piotr.wisniewski@dbr77.com>.
Specyfikacja: docs/program/PROGRAM_NAPRAWCZY_20260905/P4_KODY_TECHNICZNE_W_UI.md — przeczytaj całą.

CEL: użytkownik nigdy nie widzi surowej wartości technicznej: enumów (manual, MONTH, MISSING_PLAN), identyfikatorów (UUID zamiast nazwiska/nazwy), nazw funkcji serwera w komunikatach, niespójnej wielkości liter kategorii, „Unknown”. Rozwiązanie: katalog src/labels/ (jedno SSOT etykiet pl+en per domena), resolver nazw dla id (rozszerzyć useOrganizationMemberNames; nowy resolver dla zestawów/celów), mapper błędów na granicy klienta API (kod serwera → polskie zdanie, kod w dymku), strażnik testowy skanujący teksty pod UUID i SCREAMING_CASE.

KROKI: §5 (1→2→3→4→5; 6 poza MVP — Finanse). Markery [ODMROZENIE <MODUL> DEC-397] dla Moja Praca, Wywiad, Materiały; Wyniki bez markera.
CEL OSIĄGNIĘTY = §10: testy słowników i strażnika z dowodem mutacyjnym, rg wzorców = 0, na 7 ekranach zero trafień regex UUID i SCREAMING_CASE w widocznym tekście (odczyt z .json zrzutów --dom=body), komunikat błędu OKR po polsku. Raport z listą słowników i liczbami PRZED/PO. Zakazy: --no-verify, git stash, angielskie wartości w słowniku pl.
```
