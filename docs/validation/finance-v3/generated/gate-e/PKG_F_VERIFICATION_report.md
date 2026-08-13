# Pakiet F (Baseline Model) — NIEZALEŻNA WERYFIKACJA

Weryfikator: sesja niezależna, NIE autor pakietu.
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline` (czyste na starcie).
Gałąź: `codex/fv3p-f-baseline` @ `0a02ce621a`. Baza: `45c39d68d0`.
Raport autora zweryfikowany: `docs/validation/finance-v3/generated/gate-e/PKG_F_BASELINE_report.md`.

Metoda: każde twierdzenie zmierzone SAMODZIELNIE (własne przebiegi `vitest`/`tsc`, własny
odczyt kodu linia-po-linii, własna kontrola negatywna odtworzona od zera, własny worktree
Pakietu G do testu fan-in). Nic nie przyjęte na słowo autora.

## Tabela główna

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | „53/53 testy, exit 0, uruchomione dwukrotnie" | Odtworzone DOKŁADNIE komendą z raportu (`npx vitest run src/components/Finance/baseline src/components/Finance/shared/__tests__/FinanceWorkspaceBar.test.tsx src/components/Finance/shared/__tests__/financeWorkspaceBar.contract.test.ts src/hooks/__tests__/useFinanceBaselineWorkspaceFlag.test.ts src/services/api/__tests__/financeV2.baseline.api.test.ts --maxWorkers=2`), z korzenia repo. Uruchomione przeze mnie DWA RAZY: **7 plików / 53 testy / PASS / exit 0** za każdym razem. | **POTWIERDZONE** |
| 2 | `tsc --noEmit` (12GB sterty): exit 0, zero błędów; pierwszy przebieg złapał realny TS1355 w teście poprzednika, naprawiony | `NODE_OPTIONS="--max-old-space-size=12288" npx tsc --noEmit -p tsconfig.json` → **exit 0, 0 linii wyjścia** (nie 134/OOM-jako-sukces — realny pusty output). `tsconfig.json` ma `"include": ["src", ...]`, więc obejmuje pliki testowe. Sprawdzone w kodzie: `CalculationsView.antiplug.test.tsx:91` ma dziś `qualityFlag: null` (plain), NIE `null as const` — fix widoczny i zgodny z opisem. | **POTWIERDZONE** |
| 3 | V-1…V-6 wszystkie zamknięte | Patrz tabela osobna niżej. | **POTWIERDZONE** (6/6) |
| 4 | Punkt 1 (pływające „← Lista"/„Uwagi") = diagnoza harnessu, nie defekt produktu | `dev-render/PanelUwag.tsx` montowany RAZ w `dev-render/main.tsx:945`, poza `<Suspense>` renderującym wybrany ekran — obejmuje KAŻDY `?screen=` w harnessu, nie tylko Baseline. Zero wystąpień „Lista"/„Uwagi"/`PanelUwag` w `BaselineWorkspace.tsx`/`AssumptionsView.tsx`/`CalculationsView.tsx` (grep). `dev-render/` ma WŁASNY `vite.config.ts` (osobny wpis w `.claude/launch.json`, port 58023) — `npm run build` (root `vite.config.ts`) go nie dotyka, więc nie przecieka do produkcji. | **POTWIERDZONE** |
| 5 | Crimson naprawiony — czerwień wyłącznie dla gotówki <0, rutynowe ujemne P&L neutralne; fokus niebieski `c-focus` | Kod: `CalculationsView.tsx` — `isCriticalNegative = negative && isCashLine`, klasa `text-c-danger` TYLKO dla CASH. Token: `--c-danger: #e80538` (jasny) / `#ed5565` (ciemny) w `src/index.css` — ODRĘBNY od `--primary: 347 69% 31%` (#85182F). Zero `primary-N`/`bg-primary`/`text-primary` w plikach pakietu F (grep, 0 wyników). Fokus: 12 wystąpień `ring-c-focus` w `AssumptionsView.tsx`, `--c-focus` = niebieski `rgba(37,99,235,.4)`. Zrzut `PO-baseline-workspace-fundinggap-alarm.png` wizualnie potwierdza: CASH -85 000/-130 400 czerwone, COGS/OPEX/amortyzacja/odsetki/podatek czarne. | **POTWIERDZONE** |
| 6 | Punkt 3 naprawiony we współdzielonym `FinanceWorkspaceBar.tsx`, ZERO zmian propów/kontraktu, zweryfikowane wobec obu plików testowych | Diff pliku: zmiana WYŁĄCZNIE w ciele renderującym (`StatusBadge`→`IdentityBadge`), `WorkspaceBarConfig`/`FinanceWorkspaceBarProps` nietknięte. `FinanceWorkspaceBar.test.tsx` (8) + `financeWorkspaceBar.contract.test.ts` (13) PASS w tym worktree. **Dodatkowo, niezależnie od raportu autora**: zbudowałem osobny worktree z tipu `codex/fv3p-g-prediction` (`fca3639070`), nadpisałem `FinanceWorkspaceBar.tsx` DOKŁADNIE wersją z tego pakietu, uruchomiłem testy Pakietu G (`PredictionWorkspace.test.tsx`, `FinanceWorkspaceBar.test.tsx`, `financeWorkspaceBar.contract.test.ts`) → **3 pliki / 26 testów / PASS / exit 0**. Fan-in bezpieczny. | **POTWIERDZONE** |
| 7 | Test anty-plug + kontrola negatywna wykonane realnie | **Odtworzone przeze mnie od zera** (nie na podstawie opisu autora): wstrzyknąłem identyczny plug (`let value = ...; if (line === 'CASH' && value < 0) value = 0;`) do `aggregatedValueFor` w `CalculationsView.tsx`, uruchomiłem `CalculationsView.antiplug.test.tsx` → **dokładnie 1 test czerwony**: `AssertionError: expected '0' not to be '0'` na teście „CASH ujemna…", pozostałe 6 PASS. Cofnięte przez `git show HEAD:<plik> > <plik>` (NIE stash/reset), `git status` czyste, ponowny przebieg → **7/7 PASS**. | **POTWIERDZONE (odtworzone niezależnie)** |
| 8a | Stary `FinancialModelWorkspace.tsx` ma defekt „gotówka=0 + fałszywe imported" | Kod: `seededInputKeys` (linie 839-851) oznacza WSZYSTKIE 7 pól bilansowych jako „Imported" na podstawie JEDNEJ flagi `isGrounded`, bez sprawdzenia per-klucz. `value={assumptions[key] ?? 0}` (linia 1313) renderuje `undefined` jako „0". Zrzut `PRZED-finance-model-workspace-draft.png` pokazuje to na żywo: pole „Gotówka" / „IMPORTED FROM STATEMENT" = `0`. | **POTWIERDZONE** |
| 8b | Nowy Baseline Workspace NIE dziedziczy tego wzorca | Zero `?? 0` dla wartości finansowych w plikach pakietu F (grep). `formatFinanceValueForDisplay` (financeV2.types.ts:104) jawnie zwraca `—` dla `MISSING`/`NA`/`NOT_APPLICABLE`, `0` tylko dla realnego `PRESENT_ZERO`. Test `CalculationsView.antiplug.test.tsx` (sekcja „pięć stanów") dowodzi to explicite: CASH MISSING → `—`, CASH PRESENT_ZERO → `0`, oba odróżnialne. | **POTWIERDZONE** |
| 9 | Happy path na warstwie hooka, EVIDENCE_MISSING na warstwie routera — uczciwa ocena | `useBaselineCompute.test.ts` ma faktyczny happy-path test (`describe('...happy path...')`, linia 48). `server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts` (plik Pakietu B2, PRZEDISTNIEJĄCY, poza allowlistą F — `git diff 45c39d68d0..HEAD --stat -- server/` = PUSTE) ma we WŁASNYM docblocku jawny „SCOPE DECISION": happy-path solvera przez ten router NIE jest pokryty, celowo. Ocena zgadza się z tym, co plik sam o sobie mówi — nie jest to wygodne zaniżenie autorstwa F. | **POTWIERDZONE** |
| 10 | Allowlista czysta (bez śladów cache, bez dotknięcia innych plików współdzielonych poza `FinanceWorkspaceBar.tsx`) | `git diff --stat 45c39d68d0..HEAD` = 30 plików. Poza `FinanceWorkspaceBar.tsx`: `.claude/launch.json` (czysto addytywny nowy wpis, nie rusza innych) i `dev-render/main.tsx` (czysto addytywny import/wpis ekranu) — oba akceptowalne, addytywne, nie-produkcyjne/nie-konfliktowe. `git ls-files \| grep vite-cache` = PUSTE (incydent 514 plików naprawiony w `c334b1000e`, sprawdzony `git show --stat` = dokładnie 514 plików/618723 usunięć, same `.vite-cache/deps/*`). | **POTWIERDZONE** |
| 11 | Brak osłabionych testów (skip/only, usunięte asercje) | `grep -rn ".skip(\|.only(\|xit(\|xdescribe(\|it.todo"` po wszystkich nowych/dotkniętych plikach testowych pakietu F → **0 wyników**. | **POTWIERDZONE** |
| 12 | Zrzuty PO/PRZED odpowiadają deklarowanym naprawom | 4× `PO-*` + 4× `PRZED-NAPRAWA-*` + 1× `PRZED-finance-model-workspace-draft.png` (dziewiąty, dowód na stary ekran, nie liczy się do pary 4+4) — WSZYSTKIE obejrzane. Zgodność: (a) `PRZED-NAPRAWA-*assumptions` pokazuje dwie osobne odznaki `v1`/`Wersja robocza` + ucięte selecty („Średnia historycz…") — `PO-*assumptions` pokazuje jedną odznakę `v1 · Wersja robocza` + pełny tekst; (b) `PO-*fundinggap-alarm` pokazuje CASH -85 000/-130 400 czerwone, pozostałe ujemne linie czarne — zgodne z punktem 5; (c) `PO-*approved` pokazuje zielone `v1 · Zatwierdzone` + osobne menu `Zatwierdzone ⌄` — zgodne z punktem 3/V-6; (d) `PRZED-finance-model-workspace-draft.png` (stary ekran) pokazuje WSZYSTKIE sześć naruszeń V-1…V-6 naraz: zakładka „Oś czasu zdarzeń", przycisk „Wyceń model", 4 zakładki, mieszany PL/EN („Seed source and baseline”, „GROUNDED ON”), osobny pas „GROUNDED ON” + sekcja „Version history” w treści, i pole Gotówka=0 z fałszywym „IMPORTED FROM STATEMENT” — silna korroboracja całego raportu jednym zrzutem. Własnych zrzutów nie generowałem — istniejące wystarczyły do weryfikacji. | **POTWIERDZONE** |

## V-1…V-6 — weryfikacja osobna

| # | Wymóg | Kod | Zrzut | Werdykt |
|---|---|---|---|---|
| V-1 | Brak zakładki „Oś czasu zdarzeń" | `BaselineWorkspace.tsx` `viewNavigation.views` ma DOKŁADNIE 2 wpisy (`assumptions`, `wyliczenia`), zero wzmianki „zdarze"/„oś czasu" poza komentarzem opisującym USUNIĘCIE. Programowy test `BaselineWorkspace.canon.test.tsx` (`V-1: BRAK zakładki...`) asercją `queryByText(/zdarze/i)).not.toBeInTheDocument()`. | `PO-*` — pasek ma tylko „Założenia"/„Wyliczenia". | POTWIERDZONE |
| V-2 | Brak akcji „Wyceń model" | `actions.secondary: null`, `actions.more: null` w configu — brak jakiejkolwiek akcji wyceny. Test `V-2: BRAK akcji...` — `queryByText(/wycen/i)).not.toBeInTheDocument()`. | `PO-*` — jedyna akcja to „Przelicz". | POTWIERDZONE |
| V-3 | DOKŁADNIE dwa widoki | `viewNavigation.views` — literal array z 2 elementami w kodzie źródłowym. Test liczy programowo `getAllByRole('tab')` → `toHaveLength(2)`, plus kontrola negatywna realnie wykonana przez autora (dopisanie 3. widoku zaczerwieniło 3 testy, opisana w komentarzu testu — nie mogę tego zweryfikować retroaktywnie bez cofania kodu, ale mechanizm testu jest realny i deterministyczny, sprawdzony przeze mnie przez własne uruchomienie). | `PO-*` — 2 zakładki widoczne. | POTWIERDZONE |
| V-4 | Jednolity polski (skróty finansowe dozwolone) | Grep etykiet JSX/`baselineLabels.ts` w `AssumptionsView.tsx`/`CalculationsView.tsx` — zero angielskich fraz UI poza kanonicznymi skrótami (REVENUE/COGS/OPEX/DSO/DIO/DPO/CAPEX/EBITDA/EBIT/P&L/BS/CF), wszystkie etykiety, przyciski, tooltipy po polsku. | `PO-*` — spójny polski wizualnie. | POTWIERDZONE |
| V-5 | Brak martwej przestrzeni >25% | `BaselineWorkspace.tsx` — `flex h-full ... flex-1 flex-col`, `CalculationsView`/`AssumptionsView` — `flex-1 overflow-auto`. Wizualnie: `PO-*wyliczenia` — tabela wypełnia i PRZEKRACZA viewport (przewijalna), zero pustego bloku. `PO-*assumptions` — dolny margines ok. 19% wysokości (170/900px), pod progiem 25%. | `PO-*` — potwierdzone pomiarem na zrzucie. | POTWIERDZONE |
| V-6 | Jeden pasek, fullscreen obecny, brak „Version history" w treści | `FinanceWorkspaceBar` renderowany RAZ (`BaselineWorkspace.tsx:300`). Test `V-6: JEDEN pasek...` — `getAllByText(name)).toHaveLength(1)`, `queryByText(/version history/i)).not.toBeInTheDocument()`. Osobny test potwierdza fullscreen jako ostatnia bezpośrednia kontrolka (`rightControls?.lastElementChild === fullscreenButton`). | `PO-*` — jeden pasek, `⛶` w prawym rogu, brak „Version history"/„GROUNDED ON" w treści. | POTWIERDZONE |

## Punkty 4, 6, 7, 8 — rozstrzygnięcie (szczegółowe, jak zażądano)

**Punkt 4 (harness overlay):** OBALIĆ się nie dało — diagnoza jest poprawna. `PanelUwag.tsx`
jest montowany raz, globalnie, w `dev-render/main.tsx` poza granicą komponentu ekranu, obejmuje
KAŻDY `screen=` klucz zdefiniowany w `SCREENS` (dziesiątki ekranów wielu pakietów), a `dev-render/`
ma zupełnie osobny plik `vite.config.ts`/proces (potwierdzone w `.claude/launch.json`), więc
`npm run build` (produkcja) go nie widzi. Zero importu/referencji do `PanelUwag`/„Lista"/„Uwagi"
w komponentach produktu tego pakietu. **Diagnoza autora — potwierdzona, bezpiecznie odwoływalna
we wszystkich trzech pakietach, o których wspomniał Piotr.**

**Punkt 6 (fan-in na `FinanceWorkspaceBar.tsx`):** Największe ryzyko tego pakietu, sprawdzone
NIEZALEŻNIE (nie tylko odczyt propsów): zbudowany osobny worktree z tipu gałęzi Pakietu G,
podmieniona DOKŁADNIE wersja pliku z Pakietu F, uruchomione testy Pakietu G włącznie z jego
własnym `PredictionWorkspace.test.tsx` (montuje `FinanceWorkspaceBar` bezpośrednio) → 26/26 PASS,
exit 0. Fan-in bezpieczny w praktyce, nie tylko w teorii typów.

**Punkt 7 (anty-plug):** Odtworzony przeze mnie OD ZERA (własny plug, własne uruchomienie,
własne cofnięcie przez `git show HEAD:<plik> > <plik>`) — wynik identyczny co do słowa z opisem
autora (`expected '0' not to be '0'`, dokładnie 1 z 7 testów czerwony, czysty powrót do zielonego).
To jest najsilniejszy dowód w całym pakiecie, bo nie polega na zaufaniu do przebiegu, którego nie
widziałem — sam go wykonałem.

**Punkt 8 (Gotówka=0):** Obie połowy potwierdzone niezależnie. (a) Stary ekran: kod
(`seededInputKeys` all-or-nothing + `?? 0`) I zrzut `PRZED-finance-model-workspace-draft.png`
(pole „Gotówka" = 0 z etykietą „IMPORTED FROM STATEMENT") zgadzają się. (b) Nowy ekran: brak
wzorca `?? 0` w kodzie pakietu F, `formatFinanceValueForDisplay` jawnie rozróżnia MISSING/
PRESENT_ZERO, dowiedzione testem `CalculationsView.antiplug.test.tsx` (sekcja pięciu stanów).

## Nowe defekty / obserwacje znalezione podczas weryfikacji

Żadnego P0/P1. Jedna obserwacja, nie blokująca:

- **Kolumna „Akcje" (Reset per wiersz) w `AssumptionsView.tsx` znika z widoku w zrzucie
  `PO-baseline-workspace-assumptions.png`.** Po poszerzeniu kolumn „Reguła kalibracji"
  (`210px`) i „Jakość" (`140px`) w ramach naprawy punktu 4, suma `minWidth` wszystkich kolumn
  tabeli (`~1490px`) przekracza `min-w-[1200px]` deklarowany na `<table>` i statyczny viewport
  zrzutu (1440px) — ostatnia kolumna „Akcje" wypada poza widoczny obszar bez wskazówki
  scrollbara w samym zrzucie. Kod (`AssumptionsView.tsx:230`, `overflow-auto` wrapper) obsługuje
  to poprawnie jako przewijalne poziomo — to NIE jest utrata funkcji, tylko efekt uboczny
  szerszych kolumn nieujęty w opisie punktu 4. Nie testowałem interaktywnie przewijania w
  przeglądarce (poza zakresem tej weryfikacji tekstowej) — flagowane jako obserwacja do
  sprawdzenia wzrokiem/klikiem w kolejnym odbiorze wizualnym, nie jako defekt do naprawy teraz.

## Werdykt końcowy

**PASS.**

Wszystkie 12 głównych twierdzeń + 6 V-1…V-6 POTWIERDZONE niezależnym pomiarem (nie na słowo).
Trzy najważniejsze testy zaufania — fan-in na `FinanceWorkspaceBar.tsx` (punkt 6), kontrola
negatywna anty-plug (punkt 7), i diagnoza harnessu (punkt 4) — zostały ODTWORZONE OD ZERA przeze
mnie, nie tylko sprawdzone czytaniem raportu autora, i za każdym razem dały identyczny wynik.
Allowlista czysta, brak śladów po trzech incydentach sesji (zawieszenie agenta, awaria sieci,
514 plików cache), brak osłabionych testów. Jedyna obserwacja (kolumna „Akcje" poza widokiem)
jest kosmetyczna i nie unieważnia żadnego z sześciu zamkniętych naruszeń V-1…V-6.
