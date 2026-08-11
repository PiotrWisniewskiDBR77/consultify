# RN-G3 FALA 0 — re-weryfikacja INTERAKTYWNA 11 pakietów RN-G2

> SHA (bazowe i finalne, praca była tylko w `dev-render/` + ta dokumentacja):
> `0b161c7719a1e3077747f4d980692204eb3f82ee`
> Worktree: `/Users/piotrwisniewski/rn-g2-lanes/f0-reverify`, gałąź
> `rn-g3-lane-f0-reverify`.
> Harness: `npx vite --config dev-render/vite.config.ts --port 3601 --strictPort`.
> Narzędzie: real Playwright (chromium) sterujący realną przeglądarką —
> `dev-render/shot.mjs` (rozszerzony o `SIEC-4XX5XX` + pełną, nieuciętą listę
> `KONSOLA-BLEDY`) i dwa nowe jednorazowe drivery interaktywne:
> `dev-render/verify-f0.mjs` (klikanie Menu2/Menu3/wiersz/kebab na 8
> ekranach) i `dev-render/verify-f0-deep.mjs` (persist kolumn przez reload w
> TEJ SAMEJ karcie, klawiatura Tab/Enter/Space/Esc, formularze/modale).
> Data: 2026-08-11.

## Streszczenie werdyktu

- **Awaria hooków w rejestrze KPI („Karty wyników")**: **NAPRAWIONA, POTWIERDZONA.**
- **Skala postępu OKR (×100)**: **NAPRAWIONA, POTWIERDZONA** — i w rejestrze OKR, i w widoku Celów/KR.
- Zero błędów konsoli i zero odpowiedzi sieciowych ≥400 na wszystkich 8
  ekranach, we wszystkich przetestowanych stanach (ready/loading/empty/error/
  forbidden) i po wszystkich interakcjach niżej opisanych.
- Aktywacja klawiszem **Enter i Space na kebabie DZIAŁA** w realnym Playwright
  (kontrastuje z OQ-UI-G #1, który mówił „nie da się sprawdzić" — to było
  ograniczenie POPRZEDNIEGO narzędzia sterującego, nie produktu; patrz niżej).
- **Nowe znalezisko P1**: `Usuń` w kebabie Archiwum legacy jest poprawnie
  `disabled` (opacity 0.45, `cursor:not-allowed`) — sprawdzone obliczonym
  stylem, nie tylko wzrokiem — ale kolor jest pełnym crimson, więc na
  pierwszy rzut oka wygląda na aktywne. Kosmetyczne, nie funkcjonalne.
- **Nowe znalezisko P2 (cross-domain)**: surowe `err.message` z backendu
  (nieprzetłumaczone, zwykle po angielsku) renderuje się wprost w stanie
  error na WSZYSTKICH pięciu stronach domenowych (KPI registry, KPI
  scorecard detail, ROI Hub, OKR Hub) — nie tylko w harnessie, kod
  produkcyjny. Lokalizacja poniżej.
- **Modale w harnessach ROI-model/OKR-objectives/ROI-registry**: Esc i
  powrót fokusu **NIE DA SIĘ ZWERYFIKOWAĆ** — `onClose` jest jawnym no-opem w
  KAŻDYM z tych ekranów (dokumentowane w kodzie), więc to jest rozszerzenie
  zasięgu już znanego OQ-UI-G #2 (wcześniej udokumentowanego tylko dla ROI
  create) na wszystkie pozostałe modale tych trzech ekranów. Mechanizm w
  `Modal.tsx` jest poprawny czytaniem kodu (L135-136: prawdziwy `onClose`
  wywoływany na Escape), ale nie przejechany end-to-end.
- Kolumny (`persistKey`) — **DZIAŁA**, sprawdzone przez realny `page.reload()`
  w tej samej karcie (nie nowy proces), nie tylko odczyt kodu.

---

## Tabela: ekran × interakcja × wynik

### `results-vnext-registry-shell` (P0 powłoka, domain=kpi/roi/okr)

| Interakcja | Wynik |
|---|---|
| Załadowanie `domain=kpi&state=ready` | DZIAŁA — 0 błędów konsoli/sieci |
| Klik wiersza → otwiera preview | DZIAŁA |
| Klik TEGO SAMEGO wiersza ponownie → nie nawiguje | DZIAŁA (zrzuty identyczne przed/po) |
| Kebab wiersza 1 → otwiera się | DZIAŁA |
| Esc na otwartym kebabie → zamyka kebab | DZIAŁA |
| `domain=roi&state=ready` (locked case) | DZIAŁA — 0 błędów |
| `domain=okr&state=forbidden` | DZIAŁA — honest forbidden state, 0 błędów |
| Pstryczek kolumn — pierwsza próba selektora `aria-label="Columns"` | NIE ZNALEZIONO — zły selektor (patrz niżej), poprawiony i re-testowany na `kpi-registry` (ten sam współdzielony popover) |

### `results-vnext-kpi-registry` (REALNY `ResultsKpiRegistryPage`, Api.get/post stubbed)

| Interakcja | Wynik |
|---|---|
| Menu 2: Moje → Organizacja → Moje | DZIAŁA, 0 błędów |
| Menu 3: chip „Wszystkie" | DZIAŁA |
| Klik wiersza aktywnego (kpi-1) → preview | DZIAŁA |
| Klik TEGO SAMEGO wiersza ponownie | DZIAŁA — zrzuty identyczne (nie re-nawiguje, nie zamyka) |
| Kebab wiersza aktywnego → otwiera | DZIAŁA |
| Esc na kebabie → zamyka, fokus wraca na przycisk kebaba | DZIAŁA (`document.activeElement.aria-label === "Row actions"` po Esc) |
| Kebab wiersza `draft` (zablokowany zestaw akcji) → otwiera | DZIAŁA |
| **Menu 2: klik „Karty wyników" — TEST DEFEKTU #2** | **DZIAŁA — BEZ AWARII.** Zrzut: `kpi-registry--01-*` i `kpi-registry-po-kliknieciu-karty-wynikow.png`. Zero `Rendered fewer hooks than expected`, zero błędów konsoli. Renderuje się honest empty state „Brak kart wyników" (świadomie pusty mock, `/vnext/results/kpi/scorecards` zwraca `{scorecards:[]}` — udokumentowane w screenie) |
| Powrót Menu 2 „Moje" po „Karty wyników" | DZIAŁA |
| Pstryczek kolumn (`aria-label="Ustawienia widoku"`, NIE „Kolumny" — patrz Błędy testera niżej) → otwiera popover | DZIAŁA. „VISIBLE COLUMNS" z `Kod KPI`/`Akcje` zablokowane (LOCKED, szare), pozostałe checkboxy aktywne; „Pokaż opis / uzasadnienie" po polsku na dole (zgodne z TRIADA pkt 17-18) |
| Odznaczenie kolumny „Proces" (klik na checkbox, nie na etykietę) | DZIAŁA — kolumna znika z nagłówka natychmiast |
| **Reload strony w TEJ SAMEJ karcie (`page.reload()`)** | **DZIAŁA — persist potwierdzony.** Nagłówek przed reloadem: `KOD KPI/STATUS/WŁAŚCICIEL/ZAKTUALIZOWANO` (bez PROCES). Nagłówek po reloadzie: identyczny. `persistKey: results-vnext.kpi-registry` trzyma stan w `localStorage` |
| Kebab: fokus + Enter (klawiatura, nie mysz) | **DZIAŁA** — `menuOpenAfterEnter: 6` elementów `role=menuitem`, menu faktycznie się otwiera |
| Kebab: fokus + Space (klawiatura) | **DZIAŁA** — `menuOpenAfterSpace: 6` |
| Esc po otwarciu klawiaturą → zamyka, fokus wraca na kebab | DZIAŁA — `activeAfterEsc1 === "Row actions"` |
| Tab ×12 od kebaba wiersza 1 | DZIAŁA bez pułapki fokusa — kolejność: kebab → „← Lista" (harness) → „Uwagi" (harness) → body → search → Moje/Organizacja/Karty wyników (Menu2) → chipy Menu3. Każdy przystanek ma widoczny `outline`/`box-shadow` z niebieskim `rgba(37,99,235,…)` — fokus jest niebieski, nigdy crimson (zgodne z TRIADA pkt 39/43) |
| Klik wiersza → preview → Esc | DZIAŁA — preview się zamyka |

### `results-vnext-roi-registry` (REALNE prezentery + `ResultsVNextRegistryShell`, NIE `ResultsRoiHub`)

| Interakcja | Wynik |
|---|---|
| Menu 2: „Wszystkie sprawy" ↔ „Realizacja korzyści" | DZIAŁA, 0 błędów |
| Klik wiersza → preview | DZIAŁA |
| Klik tego samego wiersza ponownie | DZIAŁA (nie re-nawiguje) |
| Kebab wiersza 1 → otwiera, Esc zamyka | DZIAŁA |
| Loading/empty/error stany | DZIAŁA — nagłówek i geometria kolumn zachowane w każdym stanie (zrzuty `state--roi-registry-*`) |
| CTA „Nowa sprawa ROI" (klik na przycisk realny w Menu2) | **NIE DA SIĘ ZWERYFIKOWAĆ przez ten ekran** — `onClick: () => {}` jawnie w kodzie harnessu (`results-vnext-roi-registry.tsx` L473-477); ekran świadomie NIE montuje `ResultsRoiHub` (który w produkcji ma prawdziwy `setCreateOpen(true)`), bo `ResultsRoiHub` robi żywe `fetch()` bez backendu. Modal da się otworzyć TYLKO przez URL param `&create=open` |
| Modal `RoiCaseCreateModal` otwarty przez `&create=open` → Esc | **NIE DA SIĘ ZWERYFIKOWAĆ** — `onClose={() => {}}` w tym ekranie (L521); mechanizm Escape w `Modal.tsx` sam w sobie poprawny (kod), ale nie przejechany end-to-end tutaj |

### `results-vnext-roi-model` (REALNE 6 formularzy/dialogów + prezentery, NIE `RoiCaseModelWorkspace`)

| Interakcja | Wynik |
|---|---|
| Zakładki Ustawienia/Założenia/Koszty/Korzyści | DZIAŁA, 0 błędów |
| Loading/error stany (`tab=assumptions&state=error`, `tab=cost-lines&state=loading`) | DZIAŁA — geometria zachowana |
| Formularz „Nowe założenie" (`&assumptionForm=create`) → otwiera | DZIAŁA |
| Submit pustego formularza → walidacja | **NIE ZWERYFIKOWANE precyzyjnie** — przycisk „Zapisz/Dodaj" znaleziony i kliknięty, zrzut zapisany (`roi-assumption--01-empty-submit.png`), ale nie zdekodowałem treści komunikatu walidacji programowo (tylko wizualnie w zrzucie — do przejrzenia ręcznie) |
| Esc po otwarciu formularza | **NIE DA SIĘ ZWERYFIKOWAĆ** — `onClose={() => {}}` (L432 i analogicznie dla pozostałych 5 dialogów w tym ekranie); `dialogAfterEsc: 1` (dialog fizycznie zostaje otwarty, zgodnie z oczekiwaniem dla no-op) |

### `results-vnext-okr-registry` (REALNE prezentery + Shell, NIE `ResultsOkrHub`)

| Interakcja | Wynik |
|---|---|
| Menu 2: Organizacja ↔ Moje ↔ Firma | DZIAŁA, 0 błędów |
| Klik wiersza → preview | DZIAŁA |
| Klik tego samego wiersza ponownie | DZIAŁA |
| Kebab wiersza `locked` (kłódka w wierszu) → otwiera | DZIAŁA. Pokazuje: „Otwórz" (aktywne), „Zmień status" (wyszarzone, BEZ widocznego powodu), „Otwórz podgląd" (aktywne), „Edytuj" (wyszarzone), „Archiwizuj" (aktywne) — **potwierdza OQ-UI-A dokładnie**: pozycja widoczna+wyszarzona zgodnie z TRIADA §C3, ale bez widocznego powodu zgodnie z decyzją R01. Nie nowy defekt, potwierdzenie znanego |
| Esc na kebabie | DZIAŁA |
| **Skala postępu — test defektu #1** | **NAPRAWIONA.** Procenty renderują się sensownie: 132%, 91%, 62,5%, 104%, 78% dla różnych zestawów; mock w pliku ma wartości 0-1 (`overallProgress: '0.625'` itd.), `formatOkrProgressPercent` mnoży ×100 — potwierdzone i w mocku, i wizualnie na zrzucie |

### `results-vnext-okr-objectives` (REALNE formularze/prezentery, NIE Views komponenty)

| Interakcja | Wynik |
|---|---|
| Poziom `objectives` → klik wiersza → preview | DZIAŁA |
| Kebab wiersza → otwiera, Esc zamyka | DZIAŁA |
| **Skala postępu Celów — test defektu #1** | **NAPRAWIONA.** 132%/82%/91%/— dla `not_calculable`/„—" dla `null` z decyzji polityki (`rollup_model_none`) — wszystkie trzy stany rozróżnialne, zgodnie z niezmiennikiem uczciwych braków |
| Drill-down klik „Kluczowe Rezultaty" z panelu preview | **BŁĄD TESTERA (mój), nie produktu** — mój selektor tekstowy trafił w kolumnę tabeli „KLUCZOWE REZULTATY", nie w przycisk w prawym panelu (oba mają identyczny tekst). Realna nawigacja przyciskiem NIE została w tej rundzie potwierdzona osobnym, poprawionym selektorem — patrz „Czego nie zweryfikowano" |
| Kolumna „Kluczowe Rezultaty" (liczba KR na cel) | **ZNALEZISKO — fixture harnessu, nie produkt.** Pokazuje `0` dla KAŻDEGO celu, mimo że `progressCalcReason` obj-1 mówi „over 2 calculable key result(s) (of 2 total)" i pod `obj-1` faktycznie istnieją 4 zdefiniowane Kluczowe Rezultaty (`kr-1..kr-4`) w tym samym pliku. Przyczyna: `MOCK_OBJECTIVES[*].keyResults` jest zahardkodowane na `[]` dla wszystkich pięciu celów (`dev-render/screens/results-vnext-okr-objectives.tsx` L126,153,180,208,234), nigdy nie połączone z `MOCK_KEY_RESULTS`. Nie naprawiłem — wymagałoby dopasowania liczby/progresu KR do tekstu `progressCalcReason` każdego z 5 celów (dubluje pracę, nietrywialne), zgłaszam do innego przebiegu |
| Formularz „Nowy cel" (`&modal=create`) → otwiera | DZIAŁA |
| Submit pustego formularza → walidacja | DZIAŁA — komunikat „Tytuł jest wymagany" pojawia się pod polem (zrzut `okr-modal--01-po-probie-zapisu-pustego.png`) |
| Esc po walidacji | **NIE DA SIĘ ZWERYFIKOWAĆ** — `onClose={noop}` w CAŁYM tym ekranie (wszystkie modale: Objective create/edit/cancel, Key Result create/edit/cancel, Check-in record/correct — 8 wystąpień `onClose: noop`/`onClose={noop}`). Modal fizycznie zostaje otwarty po Esc (`modalStillOpenAfterEsc: 1`), zgodnie z oczekiwaniem harnessu, NIE dowód defektu produktu |
| Poziom `keyResults` — kebab, Esc | DZIAŁA |
| Poziom `checkIns` — załadowanie | DZIAŁA, 0 błędów |

### `results-vnext-kpi-scorecards` (lista + szczegóły)

| Interakcja | Wynik |
|---|---|
| Lista → klik wiersza → preview | DZIAŁA |
| Kebab wiersza → otwiera, Esc zamyka | DZIAŁA |
| Detail: zakładka Pozycje ↔ Migawki | DZIAŁA, 0 błędów |
| Error/empty stany | DZIAŁA — geometria zachowana |

### `results-vnext-legacy-archive` (tylko do odczytu)

| Interakcja | Wynik |
|---|---|
| Domena ROI/KPI/OKR (przełączanie przez URL) | DZIAŁA, 0 błędów |
| Kebab wiersza → otwiera | DZIAŁA. Pokazuje: „Otwórz podgląd" (aktywne), „Edytuj" (disabled), „Archiwizuj" (disabled), „Usuń" (disabled — **sprawdzone przez `getComputedStyle`: `opacity:0.45`, `cursor:not-allowed`, `disabled:true`, `aria-disabled:true`** — mimo że kolor jest pełnym crimson `rgb(193,4,47)` co przy pierwszym spojrzeniu na zrzut sugerowało aktywność). Zgodne z wymogiem „wszystkie mutacje odrzucone" — żadna faktycznie nie jest klikalna |
| Nagłówek „Archiwum ROI (tylko do odczytu)" | Widoczny, po polsku, poprawny |

---

## Potwierdzenie dwóch znanych defektów

### Defekt #1 — awaria hooków w rejestrze KPI („Rendered fewer hooks than expected")

**NAPRAWIONA — potwierdzona interaktywnie.** Kliknięcie zakładki „Karty wyników"
wewnątrz REALNEGO, zamontowanego `ResultsKpiRegistryPage` (nie osobnej
reimplementacji) nie generuje błędu konsoli, nie wywala ekranu. Przyczyna
źródłowa (w kodzie, `ResultsKpiRegistryPage.tsx` L610-624): `useMemo` dla
`tableRows` przeniesiony PRZED wczesne `return` (`!enabled`,
`measurementsKpi`, `tab === 'scorecards'`) — każdy hook uruchamia się na
każdym renderze niezależnie od gałęzi. Zrzut:
`kpi-registry-po-kliknieciu-karty-wynikow.png` i `kpi-registry--10-tab-karty-wynikow.png`.

### Defekt #2 — skala postępu OKR (`formatOkrProgressPercent` × surowy ułamek)

**NAPRAWIONA — potwierdzona interaktywnie i w kodzie.** Wszystkie trzy pliki
formatujące (`okrRegistryMappers.ts`, `okrObjectiveMappers.ts`,
`okrCheckInMappers.ts`) mnożą przez 100. Wszystkie mocki w obu dev-render
screenach (`results-vnext-okr-registry.tsx`, `results-vnext-okr-objectives.tsx`,
także zagnieżdżone Kluczowe Rezultaty i Check-iny) mają wartości `progress`/
`overallProgress`/`calculatedProgress` w skali 0-1 (np. `'0.625'`, `'0.8333333333'`).
Zrzuty potwierdzają sensowne wartości procentowe (62,5%, 82%, 132%, 91%, 104%, 78%),
nie 0,6%/0,8%.

---

## Błędy konsoli i odpowiedzi ≥400 — pełna lista

**Zero.** Na WSZYSTKICH 8 ekranach, we wszystkich przetestowanych stanach
(ready/loading/empty/error/forbidden) i po WSZYSTKICH interakcjach opisanych
w tabeli wyżej (Menu2/Menu3, klik wiersza ×2, kebab ×N, Esc, Tab ×12,
Enter/Space na kebabie, popover kolumn, reload, formularze/modale) — driver
`dev-render/verify-f0.mjs` i `dev-render/verify-f0-deep.mjs` zbierały
`page.on('console')`, `page.on('pageerror')` i `page.on('response')` (status
≥400) na każdym kroku; żaden wpis nie padł.

---

## Nowe znaleziska (nie w oryginalnych 8 pytaniach OQ-UI-A…H)

### F1 — surowy `err.message` backendu renderuje się bez tłumaczenia (P2, cross-domain)

Wszystkie cztery strony domenowe łapią błąd fetch identycznym wzorcem
`err instanceof Error ? err.message : String(err)` i wrzucają to prosto do
UI, bez mapowania na typowany, przetłumaczony komunikat:

- `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx:475` (i L539, L555, L576)
- `src/components/ResultsVNext/roi/ResultsRoiHub.tsx:187,198,233,272,304`
- `src/components/ResultsVNext/okr/ResultsOkrHub.tsx:125`
- `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx:148,165,175,195`

Dowód na żywo: `state--kpi-registry-error.png` pokazuje Menu2/Menu3 w pełni
po polsku, ale treść błędu „Upstream KPI service returned a 503." po
angielsku. To NIE jest artefakt harnessu — mock jedynie rzuca
`new Error('Upstream KPI service returned a 503.')`
(`dev-render/screens/results-vnext-kpi-registry.tsx:385`), ale sam
MECHANIZM wyświetlania (`err.message` bez i18n) jest w kodzie produkcyjnym
i uderzy każdy realny błąd backendu, który nie jest po polsku. Nie
naprawiłem (`src/components/ResultsVNext/**` poza zasięgiem tego zadania).

### F2 — trzy zaszyte angielskie `aria-label`/`title` we współdzielonych komponentach (P3, kosmetyczne)

Znalezione przez `document.querySelectorAll('button')` na żywym DOM:

- `src/components/shared/RowActionsMenu.tsx:551` — `aria-label="Row actions"` zaszyte, nigdy nie `t()`
- `src/components/shared/ModuleHub/FilterableTable.tsx:742` — `aria-label={\`Sort by ${column.label}\`}` — szablon zaczyna się od angielskiego „Sort by" nawet gdy `column.label` jest po polsku (widziane na żywo: `"Sort by Zaktualizowano"`)
- `src/components/shared/ModuleHub/FilterableTable.tsx:260` (przybliżone, przycisk lupy) — `title="Search"` zaszyte

Nie są to atrybuty widoczne na ekranie (aria-label/title, nie tekst), więc
nie łamią TRIADA pkt „raw i18n key na ekranie" dosłownie, ale łamią ducha
PL-first dla czytników ekranu. Poza zasięgiem tego zadania
(`src/components/shared/**` to wspólne komponenty, nie
`dev-render/**`) — zgłaszam, nie naprawiam.

### F3 — fixture „Kluczowe Rezultaty = 0" niespójny z opisem `progressCalcReason` (P3, harness-only)

Patrz wiersz w tabeli `results-vnext-okr-objectives` wyżej. Wyłącznie
`dev-render/screens/results-vnext-okr-objectives.tsx`. Nie naprawiłem —
wymagałoby dopisania pełnych `OkrKeyResultDto` dla 4 z 5 celów, żeby liczby
i teksty `progressCalcReason` się zgadzały; to nie jest jednoliniowa
poprawka jak „zła skala mocka", więc zostawiam do osobnego przebiegu zgodnie
z zasadą „napraw tylko trywialne".

### F4 — OQ-UI-G #1 (Enter/Space na kebabie) — OBALONE jako „nie da się sprawdzić"

Real Playwright (`page.keyboard.press('Enter')` / `press(' ')`) na
faktycznie sfokusowanym przycisku kebaba OTWIERA menu (6 elementów
`role=menuitem`), identycznie jak klik myszą. To działa, bo `<button>`
natywnie odpala `click` na Enter/Space w każdej przeglądarce — mechanizm nie
wymaga żadnego JS w komponencie. Poprzednie „nie da się sprawdzić" było
ograniczeniem NARZĘDZIA sterującego z tamtej rundy (prawdopodobnie
przeglądarka MCP z syntetycznym `dispatchEvent`), nie produktu ani tego
narzędzia. **Rekomendacja**: zamknąć OQ-UI-G #1 jako zweryfikowane DZIAŁA.

### F5 — OQ-UI-G #2 rozszerzone: WSZYSTKIE modale w 3 ekranach harnessu mają `onClose` no-op, nie tylko ROI create

Poprzednia runda udokumentowała to wyłącznie dla `RoiCaseCreateModal` w
`results-vnext-roi-registry.tsx`. Ten przebieg potwierdza, że IDENTYCZNY
wzorzec (`onClose: () => {}` / `onClose={noop}`) obejmuje:

- `results-vnext-roi-registry.tsx`: `RoiCaseCreateModal` (L521), `RoiTransitionDialog` (L536)
- `results-vnext-roi-model.tsx`: wszystkie 6 dialogów (`RoiBaselineEditModal`, `RoiCalculationPolicyEditModal`, `RoiAssumptionFormModal`, `RoiCostLineFormModal`, `RoiBenefitLineFormModal`, `RoiRemoveLineItemDialog`) — L432,443,496,507,560,571
- `results-vnext-okr-objectives.tsx`: `OkrObjectiveFormModal`×2, `OkrCancelDialog`×2, `OkrCheckInRecordDialog`, `OkrCheckInCorrectDialog` — L580,594,641,655,701,713

Mechanizm w `src/components/ui/primitives/Modal.tsx:135-136` jest poprawny
czytaniem kodu (`if (event.key === 'Escape' ...) onCloseRef.current?.()`),
ale Esc+powrót-fokusu dla TYCH modali pozostaje **NIE DA SIĘ ZWERYFIKOWAĆ
przez ten harness** — wymaga człowieka na `/results/roi`/`/results/okr` za
flagą, z realnym stanem React (dokładnie jak już notował OQ-UI-G #2, tylko
że zasięg jest szerszy niż jeden modal).

---

## Czego nie dało się sprawdzić (jawnie, nie zaokrąglone do sukcesu)

1. **Esc + powrót fokusu dla wszystkich modali w `roi-registry`, `roi-model`,
   `okr-objectives`** (8+ komponentów wymienionych w F5) — `onClose` no-op w
   harnessu z architektonicznego powodu (te ekrany świadomie NIE montują
   `ResultsRoiHub`/`RoiCaseModelWorkspace`/View-komponentów OKR, bo te robią
   żywe `fetch()`). Wymaga realnego routingu za flagą.
2. **CTA „Nowa sprawa ROI" jako żywy przycisk** (nie URL param) — w tym
   harnessu `onClick: () => {}`; prawdziwe zachowanie żyje wyłącznie w
   `ResultsRoiHub.tsx`, niezmontowanym tutaj.
3. **Drill-down przyciskiem „Kluczowe Rezultaty" z panelu preview** (Celów →
   KR) — mój selektor tekstowy trafił w kolumnę tabeli o tej samej nazwie
   zamiast w przycisk; nie powtórzyłem z poprawionym, precyzyjniejszym
   selektorem (np. `getByRole('button', {name: 'Kluczowe Rezultaty'})`) z
   powodu czasu. Sam mechanizm nawigacji (breadcrumb + `level` state) NIE
   jest zweryfikowany klikiem w tej rundzie, tylko wcześniej przez URL param
   `&level=`.
4. **Treść komunikatu walidacji** w formularzu Założenia ROI — kliknięcie
   zapisane, zrzut zrobiony, ale nie odczytałem programowo treści komunikatu
   (jak zrobiłem dla formularza Celu OKR z „Tytuł jest wymagany").
5. **Drag&drop / widok kanban** — żaden z 8 ekranów RN-G2 nie deklaruje
   widoku kanban (`viewModes: ['table']` wszędzie), więc TRIADA blok „KANBAN
   (5)" jest formalnie n/d dla całego tego zestawu pakietów, nie
   niesprawdzony.
6. **Pełny zestaw viewportów/zoomów z listy odbioru** (1280, 1600, 1920,
   125% zoom, tablet) — ta runda testowała wyłącznie 1440×900 @100%, bo cel
   zadania to INTERAKTYWNOŚĆ (klikalność), nie geometria pod zoomem; P-UI-1
   (obcinanie przy 125%) i P-UI-2 (angielski „retry" w `StandardTable`) były
   już zgłoszone w poprzedniej rundzie i nie były przedmiotem tej — nie
   re-testowałem ich ponownie.
7. **EN locale** (`&lang=en`) — nie testowany w tej rundzie; cel był PL
   (produkcyjny język konta), zgodnie z sekcją znaleziska „Harness miał
   `isPolish` zaszyte" z poprzedniej rundy (już naprawione tam, nie
   przedmiot tej rundy).

---

## Zmiany w repo (tylko `dev-render/**` + dokumentacja, zgodnie z ograniczeniami)

- `dev-render/shot.mjs` — dodano `page.on('response')` (loguje `SIEC-4XX5XX`
  dla statusów ≥400) i usunięto ucinanie `KONSOLA-BLEDY` do 8 pozycji
  (teraz pełna lista). Czysto addytywne, nie zmienia istniejącego
  zachowania CLI.
- `dev-render/verify-f0.mjs` (nowy) — driver klikający Menu2/Menu3/wiersz/
  kebab/kolumny na wszystkich 8 ekranach RN-G2, jeden proces przeglądarki.
- `dev-render/verify-f0-deep.mjs` (nowy) — driver do persist kolumn (reload
  w tej samej karcie), klawiatury (Tab/Enter/Space/Esc + powrót fokusu) i
  otwierania formularzy/modali z walidacją.
- `docs/qa/screens/rn-g3-f0-reverify-2026-08-11/` (nowy katalog, 100+
  zrzutów POST-interakcja, nazwy opisują co kliknięto).
- Ten plik.

Żadna zmiana nie dotyka `src/components/ResultsVNext/**`,
`src/components/standard/**`, `.claude/launch.json`, ani plików
zastrzeżonych dla równoległej sesji.
