# R-12 i R-8 — pomiar robotnika (2026-09-03/04), gałąź `agent/mw-triage-kafel-20260903`

Worktree: `/private/tmp/ag-mw-triage` (baza `HEAD` = `58ef0771d7`). Port dev-render: 5436 (zatrzymany po pomiarze).

## WYNIK: żadna z dwóch pozycji NIE ZOSTAŁA wykonana literalnie wg brifu.
Mój pomiar przeczy obu przesłankom brifu w sposób możliwy do zweryfikowania
grepem/kodem/realnym renderem. Zgodnie z regułą „Jeśli Twój pomiar przeczy
mojej liczbie, obowiązuje Twój" — nie wykonałem żadnej fabrykowanej zmiany.
Zero linii kodu produkcyjnego zmienione. Poniżej pełny dowód i rekomendacja.

---

## R-12 — „Podłączyć InboxTriage.tsx do trasy /my-work/inbox/:id/triage"

### Przesłanka brifu
„InboxTriage.tsx (585 linii) ma gotową trasę serwera, a jedynym odwołaniem do
niej jest re-eksport w index.ts:220 — zbudowane, ale niepodłączone."

### Mój pomiar (sprzeczny)
1. `git grep -n "InboxTriage" -- src dev-render tests` — jedyny prawdziwy
   importer to re-eksport `src/components/MyWork/index.ts:220`. POTWIERDZONE:
   `InboxTriage.tsx` faktycznie ma 0 realnych konsumentów.
2. ALE trasa serwera `POST /my-work/inbox/:id/triage`
   (`server/src/routes/my-work.routes.ts:2261-2337`) JUŻ MA realnego wołacza —
   niezależnie od `InboxTriage.tsx`:
   - `src/components/MyWork/InboxContent.tsx:2851` —
     `V8MyWorkApi.triageCanonicalInboxItem(item.id, {...})` z fallbackiem
     `.catch()` na `Api.post(\`/my-work/inbox/${item.id}/triage\`, ...)`
     (linia 2859) — dokładnie ta sama trasa.
   - Drugie wywołanie: `InboxContent.tsx:2941/2946` (snooze → ta sama trasa,
     `action: 'archive', params: { snooze: preset }`).
   - `src/services/api/v8/my-work.ts:279` —
     `triageCanonicalInboxItem` klienta V8 celuje w
     `/my-work/inbox/${itemId}/triage` — identyczny path co trasa serwera.
3. Ta trasa jest wywoływana z **kebaba wiersza Skrzynki, który już istnieje
   i jest DOMYŚLNIE WŁĄCZONY**:
   `buildInboxKebabSections()` (`InboxContent.tsx:2019-2138`) — akcje: Open,
   „Apply AI (…)" (gdy `item.suggestedAction`), Focus→Dziś/Ten tydzień/Później,
   Done, Save, Save as note, Snooze (presety), Archive, Reject — WSZYSTKIE
   wołają `h.onTriage`/`h.onSnooze`, które trafiają w `triage()`/`handleSnooze()`
   powyżej, czyli w tę samą trasę `/my-work/inbox/:id/triage`.
   Flaga renderu StandardTable (`ff_m03InboxStandardTable`,
   `src/utils/m03InboxStandardTableFlag.ts`) jest **domyślnie ON od
   2026-07-16 (akcept Piotra)** — to jest bieżący, realny render, nie martwa
   gałąź za flagą OFF. Zweryfikowane na żywym renderze (`dev-render` port
   5436, `?screen=mywork-inbox`, zrzuty 1440/1024 light/dark) — kebab „⋮" przy
   wierszu jest widoczny i aktywny.
4. `InboxTriage.tsx` ładuje dane z **INNEJ, starszej trasy**: `Api.get('/my-work/inbox')`
   (linia 341) → `GET /my-work/inbox` (`my-work.routes.ts:1687-1710`,
   „Derived inbox items + triage state") — to NIE jest ten sam zbiór danych co
   `InboxContent.tsx`, który czyta z `/my-work/inbox/canonical`
   (`V8MyWorkApi.getCanonicalInboxTable`). Dwa równoległe źródła prawdy dla
   Skrzynki.
5. `InboxTriage.tsx` łamie twardy kanon UI (§9 CLAUDE.md — „Ekrany listowe
   WYŁĄCZNIE StandardTable/StandardModuleBar"): własny nagłówek
   (gradient `from-blue-500 to-indigo-600`), własny filtr `<select>`, własny
   pasek bulk-akcji, własne karty (`InboxItemCard`) z `ring-brand`,
   `bg-slate-100` — zero `StandardTable`/`StandardModuleBar`, zero `c-*`
   tokenów w większości klas. Podłączenie go jako nowego ekranu/modala
   naruszyłoby hook `check-list-canon.sh`.

### Rejestr właściciela — to pytanie było i JEST otwarte, nie zdecydowane
- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:149`
  (`MYW-INB-REC-001`, status `NIEZROBIONE`) — cytat wprost: „Dead code
  candidate: `Inbox/InboxTriage.tsx` (585 lines, own triage API, 0
  importers)." Uwaga wymaga `FALA_4_OWNER_DECISION` (item 7): „is
  InboxTriage.tsx the foundation to wire up, or dead code to delete?"
- `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md:83`
  — status **„DO ROZMOWY"**, nieobecne w ledgerze.
- `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md:211` — rekomendacja
  audytora „PODŁĄCZ — zapłacone, niepodane", ale status pola decyzji to
  **„ZAMKNĄĆ ROZMOWĄ"** — czyli NIE jest to zamknięta decyzja właściciela,
  tylko rekomendacja czekająca na rozmowę.
- Prawdziwa treść uwagi właściciela (`RECOVERED_OWNER_FEEDBACK_2026-08-22.md:95`,
  `MYW-INB-REC-001`): chodzi o przycisk „AI Trash" — redukcję duplikatów,
  analizę krytyczności, porządkowanie całego inboxa. `InboxTriage.tsx` TEGO
  NIE ROBI (grupuje tylko wg `urgency`, te same akcje co już wdrożony kebab)
  — podłączenie go nie zamyka uwagi właściciela, tylko dokłada drugi,
  gorszy ekran nad już wdrożoną funkcją.
- Przycisk „AI Triage" w Menu 3 Skrzynki (`MyWorkHub.tsx:3480-3487`,
  `openTabAiContext('inbox')`, `MyWorkHub.tsx:2369-2414`) dziś tylko otwiera
  czat z gotowym promptem („Analyze my inbox and propose the next best
  action.") — to jest realny, nienazwany w brifie kandydat na „AI Trash", ale
  zbudowanie tam prawdziwego, rządzonego (governed) dedup+krytyczność to
  osobna, wielodniowa pozycja (rejestr: „ŚREDNIE 2 dni"), nie 1-sesyjne
  podłączenie kebaba.

### Decyzja robotnika
NIE wpiąłem `InboxTriage.tsx` — wpięcie byłoby (a) naruszeniem twardego
kanonu list, (b) zdublowaniem już wdrożonej, domyślnie-ON funkcji triage w
kebabie, (c) pokazaniem innego zbioru danych niż reszta ekranu, (d) fałszywym
zamknięciem pytania, które właściciel ma jeszcze rozstrzygnąć wprost
(„ZAMKNĄĆ ROZMOWĄ" w dwóch niezależnych rejestrach, jeden z 2026-09-04 —
PO dacie rzekomej decyzji z brifu). Rekomendacja: NIE podłączać istniejącego
pliku; albo (i) skasować `InboxTriage.tsx` jako martwy kod (opcja
„skasowanie DROBNE 0,5 dnia" z rejestru), albo (ii) potraktować „AI Trash"
jako osobną, właściwie wycenioną pozycję (dedup + krytyczność w
`openTabAiContext`/backend), z osobnym dyżurem.

---

## R-8 — „Usunąć kafel «MOJA PRACA» bez czytelnej roli"

### Przesłanka brifu
Element nawigacyjny (kafel) bez funkcji, „pod filtrami", do usunięcia.
Kandydat wskazany w brifie: pasek nawigacji `MyWorkHub.tsx`.

### Mój pomiar (sprzeczny)
1. Kandydat z rejestru (`MODULE_ACCEPTANCE.md:192`, `MYW-PHOTO-004`):
   „level-1 group pills, `MyWorkNav.tsx:264–281`". Zweryfikowane w kodzie:
   `MyWorkNav.tsx` (dwupoziomowa nawigacja grup) jest importowany, ale
   **NIGDY nie jest renderowany** — flaga `isMyWorkTwoLevelNavEnabled()`
   (`src/utils/myWorkTwoLevelNavFlag.ts`) nie jest wywoływana NIGDZIE w
   `MyWorkHub.tsx` poza komentarzami („always-off … never shipped",
   `MyWorkHub.tsx:1836`, `shared/useScrollEdges.ts:7`). Ten kandydat NIE
   MOŻE być tym, co Piotr widzi — jest martwy.
2. Realnie renderowany pasek nawigacji to płaski wiersz `tabs.map()`
   (`MyWorkHub.tsx:4368-4405`), zasilany z `const tabs = useMemo(...)`
   (`MyWorkHub.tsx:1715-1826`). Jedyny kandydat na „kafel bez roli" w tej
   liście — zakładka `home`/„Radar" — jest JUŻ wyłączona:
   `RADAR_ENABLED = false` (`MyWorkHub.tsx:255`) +
   filtr `if (tab.id === 'home' && !RADAR_ENABLED) return false;`
   (`MyWorkHub.tsx:1819`). Nie pojawia się w ogóle.
3. Realny render (dev-render, port 5436, `?screen=mywork-inbox`,
   `AppProviders`+`MyWorkHub` bez re-implementacji) sprawdzony na:
   1440×900 light, 1440×900 dark, 1024×768 dark, widok tabela i widok karty
   (sections) — w ŻADNYM z tych zrzutów nie ma dużego obramowanego elementu
   „MY WORK"/„MOJA PRACA" pod filtrami. Pasek Menu 3 to legalne chipy filtrów
   („Wszystkie 9 / Zaległe 2 / Zapisane 1 / AI 1 / Krytyczne 2 / Wymaga akcji 6
   / Dziś 4 / Ten tydz. 4 / Gotowe 1") + przycisk „Triage AI" — każdy ma
   jasną, działającą rolę (filtr / otwiera AI Triage w czacie).
4. Jedyne dwa realne miejsca w kodzie z tekstem „My Work"/„Moja Praca" jako
   klikalny element to:
   - `src/components/navigation/BottomNavigation.tsx:53` — kafel „My Work" w
     DOLNYM pasku MOBILNYM (`md:hidden`), z realną nawigacją
     (`setCurrentView(AppView.MY_WORK)`) i realnym stanem `active` — ma
     czytelną rolę, nie pasuje do opisu.
   - `src/components/navigation/Sidebar/Sidebar.tsx:325` — jeden, legalny
     wpis modułu w głównym sidebarze aplikacji.

### Rejestr właściciela — również otwarte, NIE zdecydowane
- `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md:89`
  — status **„DO ROZMOWY"**, cytat źródła: „brak zdefiniowanej roli/kontraktu,
  potrzebne potwierdzenie wizualne" (czyli nawet audytor nie potwierdził tego
  na zrzucie).
- `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md:164` (pozycja 30,
  **jeden dzień PO** rzekomej decyzji z 03.09 wieczór cytowanej w brifie) —
  status pola decyzji to nadal **„ZAMKNĄĆ ROZMOWĄ"**, nie „usuń".

### Decyzja robotnika
Nie znalazłem elementu opisanego w brifie w obecnym stanie gałęzi — ani w
kodzie (jedyny pasujący kandydat z rejestru jest martwym, niewyrenderowanym
komponentem), ani na żywym renderze (4 kombinacje viewport×motyw
sprawdzone). Nie usunąłem niczego, bo nie ma czego usunąć bez zgadywania —
usunięcie prawdziwego elementu nawigacji „na wszelki wypadek" byłoby
działaniem wbrew regule „Piotr nigdy nie jest pierwszym testerem wizualnym"
w drugą stronę: zepsułbym coś, czego nie potwierdziłem jako defekt.
Rekomendacja: poprosić Piotra o świeży zrzut EKRANU, na którym on to widzi
(wersja aplikacji/URL/tab), bo obecny render tego nie reprodukuje — element
albo już zniknął w innej naprawie, albo opis w rejestrze wskazuje niewłaściwy
plik.

---

## Co NIE zostało zrobione (zgodnie z zakazem słowa „gotowe" bez liczb)
- 0 linii kodu produkcyjnego zmienione.
- 0 nowych stanów `dev-render` (nie dołożono `?stan=triage` — R-12 nie został
  wykonany, więc nie ma czego dowodzić zrzutem).
- 0 usunięć w `MyWorkHub.tsx`/`MyWorkNav.tsx` — element nie zreprodukowany.
- Zrzuty z pomiaru (nieformalne, tylko do tego dokumentu, nie „PRZED/PO"
  kanoniczne `grafika-zrzuty.mjs`, bo nic się nie zmieniło): wykonane
  narzędziem przeglądarki w tej sesji, nie zapisane jako pliki PNG w repo
  (nie ma zmiany wizualnej do udokumentowania PRZED/PO).
- `bash scripts/check-list-canon.sh` — NIE URUCHOMIONY (zero zmian w plikach,
  które ten hook sprawdza).
- Testy jednostkowe — NIE DODANE (nie ma nowej akcji w menu do przetestowania).

## Commity na tej gałęzi
Brak commitów kodu. Jeden commit z tym plikiem dowodowym (poniżej).

## Rekomendacja dla nadzorcy/Piotra
Obie pozycje (R-12, R-8) wracają do rejestru ze statusem **„DO ROZMOWY"**
(zgodnym z tym, co już tam stoi) — potrzebna jest: (1) dla R-12 — decyzja
usuń/przebuduj `InboxTriage.tsx` + osobna wycena prawdziwego „AI Trash"
(dedup/krytyczność); (2) dla R-8 — świeży zrzut od Piotra pokazujący dokładnie
ten element, bo obecny build (branch `agent/mw-triage-kafel-20260903` na
`58ef0771d7`) go nie reprodukuje.
