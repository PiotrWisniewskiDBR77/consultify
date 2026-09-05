# Realizacja — Praca · Zasoby · Kokpit · Trend KPI · Karty wyników (05.09.2026)

Gałąź: `agent/realizacja-praca-zasoby-kokpit-20260905` (baza: `81460544f4`, linia m03)
Zrzuty PO: `evidence/realizacja-20260905/` — jasny motyw, 1440 px, własny vite na porcie 3055,
backend stagingu (`b852ade6164e`), sesja z `ODBIOR_AUTH_STATE`, **zero błędów konsoli w każdym zrzucie**.

## Tabela: defekt → przyczyna → naprawa → test

| # | Defekt (zgłoszenie odbioru) | Przyczyna (zmierzona) | Naprawa | Test + dowód mutacyjny | SHA |
|---|---|---|---|---|---|
| A | `execution-tab-work` — „Loading canonical work" na zawsze, liczniki Menu 3 na zerach, choć widoczne zapytania wracają 200 | Staging **NIE ODPOWIADA** na `/api/initiatives/runtime-v1/execution-cases/a3e05d4a-…--acceptance--execution-case/work` (`curl -m 30` → `http=000`; ten sam nagłówek daje 200 dla pozostałych 5 realizacji, a `/milestones` i sam rekord case'a odpowiadają w 0,2–0,3 s). Powierzchnia składała dane przez `await Promise.all(cases.map(...))`, które czeka na najwolniejszą obietnicę → jedna wisząca realizacja zabijała całą zakładkę | Nowy `fanOutExecutionCases` (`src/components/Execution/executionCaseFanOut.ts`): per realizacja `AbortSignal` + limit 12 s + wyścig; jedna wisząca/błędna realizacja degraduje się do siebie. Uczciwy stan częściowy („Nie udało się pobrać pracy z N realizacji") zamiast cichej luki; komunikat ładowania po polsku | `executionCaseFanOut.test.ts` (4) + `ExecutionSurfaces.hangingCase.test.tsx` (3 dla Pracy). Mutacja: powrót do `Promise.all` → 3/4 + 4/5 padają (2× timeout) | `f0181d8aa0` |
| B | `execution-tab-resources` — pusty biały obszar, bez tabeli, podglądu i bez komunikatu | Dwie przyczyny w jednym pliku: (1) ten sam wachlarz `Promise.all` — Zasoby pobierają dla każdej realizacji przydziały **oraz** pracę, więc ta sama wisząca realizacja blokowała komplet; (2) render miał gałęzie **wyłącznie** dla `state === 'READY'`, więc podczas ładowania komponent zwracał `null` — „pusty ekran bez błędu" to nie był błąd, tylko brak widoku dla stanu ładowania | `fanOutExecutionCases` + jawny stan ładowania po polsku + ten sam stan częściowy. `readOperationalAllocations` przyjmuje `AbortSignal` | `ExecutionSurfaces.hangingCase.test.tsx` (2 dla Zasobów). Mutacja: (1) `Promise.all` → 4/5 padają; (2) usunięcie gałęzi LOADING → test „komunikat ładowania zamiast pustego, białego obszaru" pada | `8e42d2c0b7` |
| C | `execution-tab-summary` — „Kokpit" zbudowany, flaga ON, deep-link `?tab=summary` przekierowuje na listę, brak wejścia w Menu 2 | Dwie decyzje w dwóch odległych miejscach 6100-liniowego `ExecutionHub.tsx` i rozjechały się: lista dozwolonych `?tab=` (bez `summary`) i tablica `tabs` Menu 2 (bez pozycji Kokpit). W całym pliku **zero** `onClick` prowadzącego do tej zakładki | `executionModuleTabs.ts` — obie listy liczą się z JEDNEJ kolejności zakładek. Kokpit pierwszy w Menu 2, etykieta z istniejącego klucza `execution.tabs.summary` (pl „Kokpit" / en „Dashboard", oba realnie przetłumaczone). Zakładka dołączona do chromeless (jak rollout). **Bramka flagi zostaje** — przy `summaryOneLook` OFF Menu 2 jest 1:1 jak dotąd | `executionModuleTabs.test.ts` (9, w tym bezpiecznik „ExecutionHub realnie z tego korzysta"). Mutacja: usunięcie `'summary'` → padają OBA testy osiągalności naraz | `6e192cbd82` |
| D | `execution-tab-rollout` — kolumna Trend pisze „No history yet" zamiast wykresów | **Defekt kodu, nie tylko brak danych.** Wiersz w `rollout_kpi_history` powstawał wyłącznie w `PATCH /kpis/:id`; `POST /kpis` nie zapisywał nic, więc wartość, z którą KPI zakładano, nie trafiała do serii nigdy. `KpiSparkline` wymaga DWÓCH punktów → trend mógł się pojawić najwcześniej po DRUGIEJ edycji wartości. Do tego jeden angielski napis dla dwóch różnych sytuacji (0 pomiarów vs 1 pomiar) | `POST /kpis` zapisuje punkt startowy (best-effort — nieudany zapis nie wywraca utworzenia KPI). Stan pusty po polsku i rozróżnialny: „Brak pomiarów — trend pojawi się po dwóch" / „Jeden pomiar — trend od drugiego" | `tests/unit/backend/rolloutKpiHistorySeed.test.ts` (2) + `RolloutTab.kpiTrend.test.tsx` (3). Mutacja: (1) usunięcie wstawki z POST → test punktu startowego pada; (2) powrót do jednego „No history yet" → padają oba testy stanu pustego | `159f70c7d7` |
| E | `results-vnext-kpi-scorecards` — komponent istnieje, ZERO wołaczy w `src/` | Gałąź `tab === 'scorecards'` w `ResultsKpiRegistryPage` w pełni zbudowana, ale stan `tab` dało się ustawić **wyłącznie** propem `initialTab`, którego żadna trasa nigdy nie przekazywała; w całym pliku ani jednego `onClick`. Nieosiągalny rejestr = nieosiągalna także trasa `/results/kpi/scorecards/:scorecardId`, bo jej jedyne wejście to klik w wiersz tego rejestru | Pigułka nawigacyjna „Karty wyników" w Menu 3 rejestru KPI (ten sam kształt, którym ExecutionHub dokłada pigułki-wejścia obok filtrów) + droga powrotna „Rejestr KPI" + deep-link `?kpiView=scorecards`. Identyfikatory pigułek z prefiksem `view:`, więc `setStatusFilter` ich nie zobaczy | `resultsKpiScorecardsEntry.test.tsx` (4). Mutacja: usunięcie pigułki + gałęzi `onChipChange` + odczytu `?kpiView` → padają wszystkie 4 | `c7075d7868` |
| F | (znalezione na WŁASNYM zrzucie PO, nie w zgłoszeniu) `execution-tab-work` — trzy kłamiące etykiety na realnych danych | Treść zakładki nigdy wcześniej nie była widoczna, bo ekran wisiał. Po naprawie widać: (1) surowy `IN_PROGRESS` obok polskich statusów w sąsiednich wierszach tej samej tabeli — mapa `workStatusLabel` nie znała statusu, który realne zadania niosą; (2) angielskie `UNKNOWN` w każdym wierszu „Termin / SLA" (realne zadania nie mają `slaAt`); (3) UUID przerobiony na coś, co WYGLĄDA jak imię i nazwisko: „D2b6a316 08c5 47cf 9bf7 4ba50311d5a2" | `IN_PROGRESS` → „W toku"; `UNKNOWN` → „brak"; UUID zostaje UUID-em (ten sam kontrakt w tabeli i w panelu podglądu obok) | `ExecutionSurfaces.hangingCase.test.tsx` (3 etykietowe). Mutacja: przywrócenie każdej z trzech etykiet osobno → pada odpowiadający jej test (3/3) | `2dd8708bdb` |

## Zrzuty PO (do odbioru oczami)

| Plik | Co pokazuje |
|---|---|
| `A-praca-PO.png` | Zakładka Praca: 15 pozycji, realne liczniki Menu 3 (Zadania 11 · Decyzje 4 · Zablokowane 1 · Przeterminowane 3), pomarańczowy pasek „Nie udało się pobrać pracy z 1 realizacji", statusy „W toku"/„Otwarte", „SLA brak", identyfikator zamiast zmyślonego nazwiska |
| `B-zasoby-PO.png` | Zakładka Zasoby: tabela renderuje się (1 przydział, „Controls Engineer"), ten sam uczciwy pasek |
| `C-kokpit-deeplink-PO.png` | `?tab=summary` **nie** przekierowuje już na listę — „Kokpit menedżera" z pięcioma kaflami |
| `C-kokpit-klik-PO.png` | Ten sam ekran osiągnięty KLIKIEM w pozycję „Kokpit" w Menu 2 (metadane zrzutu notują `kliki: ['text=Kokpit']`) |
| `D-rollout-trend-PO.png` | Kolumna Trend: polski, rozróżnialny stan pusty zamiast „No history yet" |
| `E-karty-wynikow-PO.png` | Rejestr Kart wyników osiągalny; pigułki „Rejestr KPI" / „Karty wyników 1", realny rekord ze stagingu („Karta wyników transformacji") |
| `E-karta-wynikow-szczegol-PO.png` | Trasa `/results/kpi/scorecards/:id` — ekran z zatwierdzonego obrazu (Pozycje · Migawki przeglądu · Dodaj KPI); pusty, bo ta realna karta ma 0 pozycji |

## FAKTY, KTÓRYCH NIE NAPRAWIAM (do decyzji, nie do przemilczenia)

1. **Backend stagingu wisi na jednej realizacji.** `/api/initiatives/runtime-v1/execution-cases/a3e05d4a-5397-419d-b486-8e44366c0063--acceptance--execution-case/work` nie zwraca odpowiedzi (30 s bez nagłówka), podczas gdy `/milestones` i sam rekord case'a odpowiadają normalnie. To defekt SERWERA, a nie fasady — moja naprawa sprawia, że frontend już przez niego nie ginie, ale realizacja nadal nie pokaże swojej pracy. Wymaga diagnozy po stronie bazy stagingu (podejrzenie: zapytanie `listExecutionTasks` z `ORDER BY (payload_json->>'dueAt')::timestamptz`).
2. **`canViewAggregate` w `initiativesExecutionRuntime.routes.ts:1312` zawsze przepuszcza.** Funkcja zwraca `authorizeProjects(...)`, które produkuje `Map` — a `await` na `Map` jest ZAWSZE prawdziwe, także dla pustej mapy. Bramka `if (!(await canViewAggregate(...))) return 404` nie odrzuci więc niczego. Nie dotykam — to zmiana uprawnień, wymaga własnego dyżuru i dowodu „obcy nie widzi / właściciel widzi".
3. **Historia KPI wstecz.** Poprawka `POST /kpis` działa od chwili wdrożenia. KPI już istniejące na stagingu (widoczne na `D-rollout-trend-PO.png`) nadal nie mają punktu startowego — uzupełnienie wymagałoby migracji danych, czyli osobnej decyzji.
4. **Kolumna „Właściciel / osoba decyzyjna" pokazuje identyfikator.** Ta powierzchnia nie ma żadnego źródła nazwisk poza katalogiem demo `executionReviewPeople`. Dopóki API pracy nie poda `assigneeName` albo nie będzie tu odpytania katalogu osób, realne dane pokażą UUID. Świadomie wolę uczciwy identyfikator niż zmyślone nazwisko.
5. **Menu 2 Realizacji różni się teraz od zatwierdzonego obrazu.** `execution-tab-summary__PO__light.png` był robiony z flagą wymuszoną z adresu, więc nie miał pozycji „Kokpit". Dołożenie wejścia było celem zadania, ale formalnie zmienia pasek — **wymaga ponownego akceptu właściciela na `C-kokpit-klik-PO.png`.**
6. **Czerwień ZASTANA, nie moja:** `src/components/ResultsVNext/__tests__/resultsVNextLegacyArchiveWiring.test.tsx` — 4 testy padają. Zmierzone: padają identycznie na linii `m03` (`d7563578c1`) bez moich zmian.

## Jak odtworzyć zrzuty

Kanoniczny skrypt dostał opcję `--port` (domyślnie 3000, więc zero zmiany dla dotychczasowych wywołań).
Powód: sesja z `ODBIOR_AUTH_STATE` jest zapisana dla `http://localhost:3000`, a `localStorage`
(w tym `token`) jest zakresowany PER ORIGIN — bez przepisania portu aplikacja uznaje, że nikt nie
jest zalogowany. Skrypt przepisuje origin na KOPII w pamięci, plik sesji zostaje nietknięty.

```
ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json \
  node scripts/dev/odbior-zywo/zrzut.mjs --port=3055 \
    --url='/execution?tab=work' --out=evidence/realizacja-20260905/A-praca-PO.png --czekaj=20000
```
