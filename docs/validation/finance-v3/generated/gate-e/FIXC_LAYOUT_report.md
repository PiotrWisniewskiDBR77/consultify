# FIXC — martwa przestrzeń (3 ekrany) + wyciek enuma — raport zamknięcia

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-d-statements`
Gałąź: `codex/fv3p-fixc-layout`
Baza sesji: `57fe0543cc` (drzewo czyste na starcie)
Końcowy SHA: **`d5a5a18f1b`**

Równolegle w tej samej sesji: FIX-A (`FinanceLegacyBridgeGate`, `EmptyStateInline`,
`FinanceStatusAnnouncer`, panele komentarzy/zapisanych widoków), FIX-B (pliki serwerowe, test
skanera). Żaden plik z ich zakresu nie był dotykany w tym worktree.

## Commity (chronologicznie)

| SHA | Treść |
|---|---|
| `65bc7b5576` | fix(valuation): pełny łańcuch lineage w kroku Źródło + `w-full` (kod + PO-zrzuty) |
| `626053941a` | docs: PRZED-zrzuty dla Valuation/Source |
| `d10ab43cbf` | fix(prediction): tryb C — 3 inicjatywy zamiast 1 (harness) (kod + PO-zrzuty) |
| `7eb078a346` | docs: PRZED-zrzuty dla Prediction |
| `494083087c` | fix(analysis): pełny zestaw KPI dla MANUFACTURING (harness) (kod + PO-zrzuty) |
| `13e68457e9` | docs: PRZED-zrzuty dla Analysis |
| `d5a5a18f1b` | fix: dwa wycieki surowego enuma + wyzerowanie `KNOWN_UNFIXED_LEAKS` |

`git diff --stat 57fe0543cc HEAD`: **33 pliki, 446 wstawień(+), 37 usunięć(-)** (24 z tych plików to
PNG dowodowe, reszta kod produkcyjny/testowy/harness + 2 skrypty narzędziowe nowe).

Pliki produkcyjne dotknięte (poza harnessem i testami):
- `src/components/Finance/Valuation/steps/SourceStep.tsx`
- `src/components/Finance/Prediction/PredictionWorkspace.tsx`
- `src/components/Finance/FinancialStatementPackWorkspace.tsx`

Pliki harness (dev-render, nie produkcja):
- `dev-render/screens/finance-valuation-workspace.tsx`
- `dev-render/screens/finance-prediction-workspace.tsx`
- `dev-render/screens/finance-analysis-workspace.tsx`

Nowe narzędzia pomiarowe (tymczasowe, wzorowane na `apmount-deadspace-measure.mjs` /
`pkgf-baseline-screenshots.mjs`):
- `scripts/dev/fixc-deadspace-measure.mjs`
- `scripts/dev/fixc-screenshots.mjs`

---

## ZADANIE 1 — martwa przestrzeń powyżej limitu

### Metoda pomiaru

Playwright, headless Chromium, **świeży `browser.newContext()` per pomiar/zrzut** (nie jeden
współdzielony `page` — `localStorage` przenosi się między nawigacjami w ramach jednego kontekstu i
już raz zafałszował dowody w tej sesji, więc `fixc-deadspace-measure.mjs`/`fixc-screenshots.mjs`
otwierają nowy kontekst za każdym razem). Serwer: `npx vite --config dev-render/vite.config.ts
--port 58123` uruchomiony ręcznie z TEGO worktree (wpis `fv3p-d-statements` w `.claude/launch.json`
— `preview_start` rozwiązuje `launch.json` względem katalogu orkiestratora, nie worktree, więc
podpiąłby się do cudzego portu, patrz `AP_MOUNT_report.md`).

Dla każdego ekranu:
1. Wysokość paska `[data-testid="finance-workspace-bar"]` → `availableHeight = viewportHeight - barHeight`.
2. `contentBox` = bounding box kontenera treści (selektor per ekran, patrz skrypt) — mierzy, czy
   kontener WYPEŁNIA dostępną przestrzeń (zwykle tak, `flex-1`/`h-full`).
3. `innerContentBox` = **ciasny bounding box wszystkich liści DOM z realną treścią** wewnątrz
   kontenera (unia bboxów węzłów bez dzieci, `width>0 && height>0`) — to mierzy, ile z dostępnej
   przestrzeni jest REALNIE pomalowane treścią, nie tylko czy kontener jest duży.
4. `areaUsedPct = (innerWidth × innerHeight) / (availableWidth × availableHeight) × 100`.
5. `deadSpacePct = 100 − areaUsedPct` (wartość ujemna = treść PRZEKRACZA canvas, tzn. przewija się
   — realnie 0% martwej przestrzeni, w tabeli poniżej pokazane jako liczba ujemna dla przejrzystości
   metody, interpretowane jako 0%).

Ta sama metoda i te same selektory co `scripts/dev/apmount-deadspace-measure.mjs` (poprzednia
naprawa, `e36d275410`), rozszerzona o drugi viewport (1280×800 obok 1440×900) i osobny kontekst
przeglądarki per pomiar.

### Wynik

| ekran | martwa przestrzeń PRZED (1280) | PO (1280) | PRZED (1440) | PO (1440) | przyczyna | metoda naprawy |
|---|---|---|---|---|---|---|
| **Prediction** (tryb C) | 48,0% | **0%** (treść 137,5% — przewija się) | 54,1% | **0%** (treść 121,4% — przewija się) | OBJĘTOŚĆ TREŚCI | Harness miał 1 inicjatywę / 1 wpływ mimo że tryb C jest zaprojektowany na WIELE inicjatyw naraz (`FundamentalInitiativePanel`'s własny nagłówek: "łańcuch: inicjatywa → założenie → driver/KPI → linia sprawozdania → prognoza"). Dodano 2 kolejne inicjatywy z 1 wpływem każda, kody driverów (`REVENUE_GROWTH_YOY`, `DIO_DAYS`) wzięte z JUŻ ISTNIEJĄCYCH fixture'ów testów serwerowych, nie wymyślone. |
| **Analysis** (`draft-with-kpis`) | 47,5% | **0%** (treść 105,1% — przewija się w poziomie) | 58,9% | **17,7%** | OBJĘTOŚĆ TREŚCI | Katalog KPI miał 3 z 6 kodów, które `analysisKpiCatalog.ts` WŁASNA lista `UNIVERSAL_RECOMMENDED_CODES`+`INDUSTRY_ADDITIONAL_CODES.MANUFACTURING` deklaruje dla organizacji produkcyjnej. Dodano brakujące 3 (`REVENUE_GROWTH_YOY`, `NET_MARGIN_PCT`, `ASSET_TURNOVER`) + wypełniono lukę `INVENTORY_DAYS` 2025 — dopełnienie już zadeklarowanej taksonomii, nie nowa. |
| **Valuation / krok Źródło** | 78,1% | **6,7%** | 83,0% | **18,1%** | **UKŁAD** (błąd renderowania, nie brak danych) + resztkowo objętość | `SourceStep.tsx` czytał WYŁĄCZNIE `lineage.ancestors[0]` — `getAncestors()` (`lineageService.ts`) to rekurencyjne CTE zwracające CAŁY łańcuch (Statement Pack → Baseline → Scenariusz → Wycena), więc realne dane były pobrane i odrzucane po pierwszym elemencie. Naprawiono renderując WSZYSTKIE krawędzie (mapowanie zamiast `[0]`) + zdjęto `max-w-5xl` (`w-full`) skoro wysokość i tak była już prawie pełna, a szerokość — nie. |

Wszystkie trzy ekrany teraz **≤25%** (limit kanonu) przy OBU viewportach. Prediction i Analysis przy
1280px mają realnie 0% (treść przewija się, co jest oczekiwanym zachowaniem dla gęstej,
wieloinicjatywowej/wielo-KPI treści, nie defektem).

### Uwaga o klasyfikacji (dlaczego to NIE jest naciąganie dowodu)

`AP_MOUNT_report.md` (poprzednia sesja) sklasyfikował pozostałą pustkę na wszystkich trzech
ekranach jako "OBJĘTOŚĆ TREŚCI, nic więcej nie istnieje do pokazania" i uznał to za PARTIAL, nie
naprawiony. Weryfikacja w tej sesji obaliła tę przesłankę częściowo:
- Dla **Prediction**/**Analysis** przesłanka była słuszna w duchu, ale **niekompletna w praktyce** —
  "nic więcej nie istnieje" mylono z "harness nie POKAZYWAŁ tego, co już istnieje w kodzie/typach"
  (tryb C wspiera wiele inicjatyw; katalog KPI deklaruje 6 kodów, harness renderował 3). To rozróżnienie
  jest jawnie wymagane przez zadanie: "dane mają być REALISTYCZNE, nie napompowane" — użyto
  WYŁĄCZNIE kodów/kształtów już zadeklarowanych w produkcyjnym kodzie (typy, fixture'y testów
  serwerowych, istniejące konwencje z innych harnessów), zero nowych wymyślonych wartości.
- Dla **Valuation/Źródło** przesłanka była **wprost błędna** — to nie była objętość treści, tylko
  literalny błąd programistyczny (`ancestors[0]` zamiast pełnej tablicy) odrzucający realne,
  już pobrane dane. To jest UKŁAD w najdosłowniejszym sensie: błąd renderowania.

Zasada #3 z zadania ("jeśli po wzbogaceniu danych ekran NADAL przekracza 25% — to jednak układ")
zadziałała dla Valuation/Źródło: samo wzbogacenie łańcucha do 3 krawędzi (bez zmiany szerokości)
dawało 1440px→47,3% pustki — WCIĄŻ za dużo. Dopiero zdjęcie `max-w-5xl` (realny fix układu)
sprowadziło to do 18,1%.

### Zrzuty PRZED/PO

`docs/validation/finance-v3/generated/gate-e/visual/fixc/` — 24 pliki, wzorzec nazw
`{PRZED|PO}-{ekran}-{1280|1440}-{light|dark}.png`:
- `PRZED-prediction-*` / `PO-prediction-*`
- `PRZED-analysis-*` / `PO-analysis-*`
- `PRZED-valuation-source-*` / `PO-valuation-source-*`

PRZED-zrzuty zdobyte przez chwilowe cofnięcie dotkniętych plików do stanu bazowego
(`git show 57fe0543cc:<plik> > <plik>`, NIGDY `stash`/`reset`/`clean` — stash jest współdzielony
między worktree w tej sesji), zrzut, potem przywrócenie (`git show <commit-po-naprawie>:<plik> >
<plik>`) — `git diff --stat` potwierdzony pusty po każdym przywróceniu, patrz commity
`626053941a`/`7eb078a346`/`13e68457e9`.

Obejrzane osobiście (CLAUDE.md #7): zero crimsona na CTA/zakładkach, status nigdy wyłącznie
kolorem, jednolity polski, light+dark parytet potwierdzony wizualnie na próbkach 1440. Pływająca
etykieta "← Lista"/"Uwagi" widoczna w prawym dolnym rogu to umeblowanie harnessu `PanelUwag.tsx`
(CLAUDE.md), nie defekt produktu — nie liczona do martwej przestrzeni (mierzony selektor to
kontener treści workspace'u, nie cały viewport).

### Testy (per ekran)

| Zakres | Plików | Testów | Wynik | Czas |
|---|---|---|---|---|
| `src/components/Finance/Valuation --maxWorkers=2` | 4 | 63 | PASS, exit 0 | ~5,5s |
| `src/components/Finance/Prediction --maxWorkers=2` (po dead-space) | 6 | 90 | PASS, exit 0 | ~9,5s |
| `src/components/Finance/Prediction --maxWorkers=2` (po enum-fix, re-run) | 6 | 90 | PASS, exit 0 | ~6,5s |
| `src/components/Finance/Analysis --maxWorkers=2` | 11 | 123 | PASS, exit 0 | ~13,2s |

---

## ZADANIE 2 — wyciek surowego enuma

### Znaleziony i naprawiony (mandat)

`src/components/Finance/FinancialStatementPackWorkspace.tsx` renderowało `{file.status}` — surowe
`pending`/`ready`/`recoverable` z `s.readinessStatus` (linia ~1361), nieprzetłumaczone, mimo że
TEN SAM plik ma poprawną etykietę dla bratniego pola `packRow.status` ~600 linii wyżej
(`t('finance.pack.status{Ready,Recovery,Draft}', ...)`). Sprawdzono warstwę etykiet PRZED napisaniem
nowej — istniejące trzy klucze `t()` pasują 1:1 do trzech wartości `file.status` (ready/recoverable/
inne), więc naprawiono przez REUŻYCIE dokładnie tej samej trójki, zero nowych stringów i18n:

```tsx
{file.status === 'ready'
  ? t('finance.pack.statusReady', 'Ready')
  : file.status === 'recoverable'
    ? t('finance.pack.statusRecovery', 'Recovery')
    : t('finance.pack.statusDraft', 'Draft')}
```

Wpis w `KNOWN_UNFIXED_LEAKS` (`tests/unit/finance/rawEnumLeakScanner.test.ts`) — jedyny, jaki
kiedykolwiek tam był — **usunięty** (zbiór wyzerowany, nie skasowany, żeby przyszły naprawdę
zablokowany wyciek miał gdzie trafić, zgodnie z regułą pliku: tylko dla udokumentowanego,
sesyjnego powodu blokady).

### Drugi wyciek, odkryty PRZY OKAZJI (nieplanowany, ale w mandacie "wyciek enuma")

Uruchomienie skanera zaraz po naprawie #1 **nie przeszło** — ujawniło DRUGI, wcześniej
nieblokowany offender: `src/components/Finance/Prediction/PredictionWorkspace.tsx` renderowało
`{mountCheck.version.status}` surowo (np. "status: DRAFT") w banerze "honest scratch". Sprawdzono
`git show 57fe0543cc:...PredictionWorkspace.tsx` — wyciek istniał JUŻ w bazie sesji (wprowadzony
commitem `2e61d2eeff`, fix ID_BRIDGE, PO tym jak plik skanera był ostatnio aktualizowany — nigdy nie
trafił na allowlistę, po prostu nikt nie uruchomił skanera po tamtej zmianie). Ponieważ ten plik już
należał do zakresu tej sesji (naprawa martwej przestrzeni Prediction, patrz Zadanie 1) i istniała
GOTOWA funkcja etykiety (`businessVersionStatusLabel()`, `financeV2.types.ts` — dokładnie ta, którą
własny komentarz skanera wskazuje jako właściwą naprawę dla `status`), naprawiono w tej samej
sesji zamiast zostawić drugi wpis na allowliście:

```tsx
status: {businessVersionStatusLabel(mountCheck.version.status)}
```

### Kontrola negatywna (WYŁĄCZNIE dla naprawy #1, per mandat)

1. Stan PO naprawie, commit `d5a5a18f1b`: `npx vitest run tests/unit/finance/rawEnumLeakScanner.test.ts`
   → **5/5 PASS, exit 0**.
2. Cofnięcie WYŁĄCZNIE `FinancialStatementPackWorkspace.tsx` do stanu bazowego:
   `git show 57fe0543cc:src/components/Finance/FinancialStatementPackWorkspace.tsx >
   src/components/Finance/FinancialStatementPackWorkspace.tsx` (bez stash/reset/clean).
3. Ponowne uruchomienie skanera → **1/5 CZERWONY**, dokładny komunikat:
   ```
   AssertionError: expected [ Array(1) ] to deeply equal []
   + Received
   + [ "src/components/Finance/FinancialStatementPackWorkspace.tsx: {file.status}" ]
   ```
   Test poprawnie nazwał plik i dopasowany fragment — dowód, że test faktycznie pilnuje TEGO
   konkretnego wycieku, nie przechodzi wpustuszo.
4. Przywrócenie: `git show d5a5a18f1b:src/components/Finance/FinancialStatementPackWorkspace.tsx >
   src/components/Finance/FinancialStatementPackWorkspace.tsx` — `git diff --stat` pusty (exit 0,
   brak wyjścia) — plik bit-for-bit identyczny z commitem.
5. Ponowne uruchomienie skanera → **5/5 PASS, exit 0** ponownie.

### Testy

| Zakres | Plików | Testów | Wynik | Czas |
|---|---|---|---|---|
| `tests/unit/finance/rawEnumLeakScanner.test.ts` (po obu naprawach) | 1 | 5 | PASS, exit 0 | ~1,7s |
| `tests/unit/finance/rawEnumLeakScanner.test.ts` (kontrola negatywna, mutant) | 1 | 5 (1 czerwony) | **FAIL — oczekiwane** | ~3,4s |
| `tests/unit/finance/rawEnumLeakScanner.test.ts` (po przywróceniu) | 1 | 5 | PASS, exit 0 | — |
| `src/components/Finance/Prediction --maxWorkers=2` (po enum-fix) | 6 | 90 | PASS, exit 0 | ~6,5s |
| `esbuild` per-plik (`FinancialStatementPackWorkspace.tsx`, `PredictionWorkspace.tsx`) | — | — | kompiluje się czysto, oba pliki | ~14ms / ~6ms |

---

## Weryfikacja zbiorcza

| Zakres | Plików | Testów | Wynik | Czas |
|---|---|---|---|---|
| `npx vitest run src/components/Finance --maxWorkers=2` (pełny, po wszystkich commitach) | 62 | 504 | **PASS, exit 0** | ~37,0s |
| `tsc -p . --noEmit` (korzeń, `NODE_OPTIONS=--max-old-space-size=12288`, kod wyjścia mierzony BEZ potoku: `cmd > plik 2>&1; code=$?`, osobno od filtrów) | — | — | **PASS, exit 0, 0 błędów** (log pusty — 0 linii) | **151s** |

---

## Ograniczenia kanonu — potwierdzenie zgodności

- Wszystkie zmiany są ZA ISTNIEJĄCYMI FLAGAMI domyślnie OFF (`financeValuationWorkspaceV1`,
  `financePredictionWorkspaceV1`) — żadna nowa flaga nie została dodana, żadna ścieżka OFF nie
  została dotknięta (zmiany są wewnątrz komponentów montowanych tylko gdy flaga ON).
- Zero crimsona: żadna z naprawionych klas nie używa `primary-*`/`#85182F` — zweryfikowane wizualnie
  na zrzutach i przez pre-commit hook (`check-artefakt`/`check-triada`/`check-focus-canon` —
  wszystkie przeszły bez nowych naruszeń przy każdym z 7 commitów).
- Skróty kanoniczne (REVENUE, COGS, EBITDA) zachowane bez zmian.
- Status nigdy komunikowany wyłącznie kolorem — obie naprawy enuma (Zadanie 2) to WŁAŚNIE o to:
  status teraz niesiony tekstem, nie tylko kropką koloru.
- `OWN-FIN-001` (układ list) nieużyty — żaden z trzech ekranów nie jest listą w rozumieniu tego
  zapisu (Prediction/Analysis/Valuation to ekrany robocze artefaktu, nie `StandardTable`).
- Pływająca nakładka harnessu `PanelUwag.tsx` nieużyta w pomiarze i nienaprawiana.

## Co NIE dostarczone i dlaczego

- **Nie przebudowano pozostałych sześciu kroków Valuation** (Assumptions/Methods&Weights/Results/
  Sensitivity/Advisor/Export) — mandat wymieniał wyłącznie krok Źródło; te sześć już przeszło przez
  `max-w-5xl` w poprzedniej sesji (`e36d275410`) i nie były zgłoszone jako wciąż przekraczające limit.
- **Nie dodano czwartego/piątego poziomu łańcucha lineage** w harnessie Valuation ponad 3 krawędzie
  — 3 (Statement Pack → Baseline → Scenariusz → Wycena) to realistyczna, kompletna reprezentacja
  typowego cyklu produkcyjnego tego typu bez sztucznego wydłużania.
- **Nie dodano więcej niż 3 inicjatyw w Prediction ani więcej niż 6 KPI w Analysis** — to jest
  KOMPLETNY zestaw, jaki istniejąca taksonomia (`analysisKpiCatalog.ts`) deklaruje dla organizacji
  MANUFACTURING; dalsze dodawanie wymagałoby wymyślania nowych kodów KPI/inicjatyw, co zadanie
  wyraźnie zabrania ("dane mają być REALISTYCZNE, nie napompowane").
