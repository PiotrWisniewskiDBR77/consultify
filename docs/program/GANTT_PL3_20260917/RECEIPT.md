# RECEIPT — C6 etap 1 + etap 1b: oś czasu planu (DEC-615, SPEC §8) + bramka §7.5

Data: 2026-09-17 · Stanowisko: C · Gałąź: `qoder/plan-timeline-v2-20260917`
Baza gałęzi: `origin/integracja/20260911` = `e7b784b5c0` (punkt wyjścia); po rebase: `fa075366be`.
Flaga: `VITE_PLAN_TIMELINE_V2` (domyślnie OFF, fail-closed jak `initiativesPlanFlag.ts:6`);
`ARG`/`ENV` dopisane w `Dockerfile.api`, `npm run check:flagi:dockerfile` → `brakujace=0`.
Zakres etapu 1 (SPEC §8): kolumna nazw 208px · siatka tyg./mies. · przełączniki 1/3/6/12 + Day/Week/Month ·
filtr statusu · linia + plakietka TODAY · paski na tokenach · zamrożenie (w realizacji + plan opublikowany) ·
„poza horyzontem" · legenda w jednej linii · usunięcie listy tekstowej z centrum. **BEZ drag** (etap 2).

## §7.1 Testy (pkt 1, 4, 5, 6, 7)

| Plik | Testy | Wynik |
|---|---|---|
| `src/components/Initiatives/__tests__/InitiativeGantt.planTimeline.test.tsx` (NOWY) | 8 | 8 passed |
| `src/components/Initiatives/__tests__/InitiativeGantt.frozenWindows.test.tsx` | 6 | 6 passed |
| `src/components/Initiatives/__tests__/InitiativeGantt.planHorizon.test.tsx` | 1 | 1 passed |
| `src/utils/__tests__/planTimelineV2Flag.test.ts` (NOWY) | 1 | 1 passed |
| **RAZEM (4 pliki)** | **16** | **16 passed** |

Sprostowanie własnego błędu (zmierzone, nie zgadywane): wcześniejszy szkic tego RECEIPT-a podawał
`planHorizon = 3` (suma 18). Ponowny bieg wszystkich czterech plików mierzy `Tests 16 passed (16)`,
a `grep` potwierdza JEDEN blok `it` w `planHorizon.test.tsx`. Liczba poprawiona przed meldunkiem.

Pokrycie punktów: **1** (kolumna nazw + siatka 12 kolumn + geometria pasków jak w makiecie),
**4** (PUBLISHED = zero `onPointerDown` + komunikat read-only + przycisk nowej wersji),
**5** (IN_EXECUTION nieprzeciągalne także na DRAFT; planowany pasek przeciwnie),
**6** („poza horyzontem" = plakietka przy prawej krawędzi, bez paska po lewej),
**7** (flaga OFF = stara lista tekstowa i brak kolumny nazw; ON = oś v2; PUBLISHED = notice).

## §7.3 Mutacje — PRZED i PO

PRZED (bez mutacji): `Test Files 1 passed (1)` / `Tests 8 passed (8)`.

(a) `canDrag` bez `!frozen` → PO: `FAIL … pkt 5: IN_EXECUTION nieprzeciągalne TAKŻE na DRAFT` ·
`Test Files 1 failed (1)` / `Tests 1 failed | 7 passed (8)`. **ZABITA.**

(b) usunięta bramka `status==='DRAFT'` (`planEditable = … || true`) → PO:
`FAIL … pkt 4: PUBLISHED — żaden pasek nie ma onPointerDown` +
`FAIL … pkt 4 w karcie: PUBLISHED — oś tylko do odczytu z akcją nowej wersji` ·
`Tests 2 failed | 6 passed (8)`. **ZABITA.**

(c) `ring-c-chart-2` → `ring-c-danger` na ścieżce krytycznej → PO:
`FAIL … pkt 1: siatka = 12 kolumn tygodniowych bez marginesu, geometria paska jak w makiecie` ·
`Tests 1 failed | 7 passed (8)`. **ZABITA.**
UCZCIWE UZUPEŁNIENIE (zmierzone, nie z SPEC): ta mutacja **NIE** czerwieni
`scripts/check-list-canon.sh` (346/346) ani `scripts/check-artefakt.sh` (8/8) — bezpieczniki
nie patrzą w głąb komponentu Gantta; łapie ją wyłącznie asercja vitest. Melduję stan zmierzony.

(d) flaga: `=== 'true'` → `!== 'false'` w `planTimelineV2Flag.ts` → PO: `Tests 1 failed`
(fail-closed przestaje domykać). **ZABITA.**

(5.) geometria paska w pikselach zrzutu (pkt 3 SPEC) — przeżyła: etap 1 nie ma testu
pikselowego zrzutu (dowód = porównanie z makietą poniżej, nie test). Udokumentowane, nie „zielone".

## §7.4 Zrzuty + porównanie z makietą + kontrast

4 zrzuty 1440×900 EN, harness `dev-render/screens/z3x-inicjatywy-plan.tsx` (realny `<InitiativesHub />`),
motyw przez zustand (`useAppStore.setState`), `--bez-chrome`, konsola czysta (`KONSOLA-BLEDY` brak):
`evidence/qoder-gantt-pl3-etap1-20260917/pl3-{light,dark}-{draft,published}.png`.

Geometria w DNIACH od Sep 14 (zmierzona ze zrzutu, px/dzień = 9.01 przy Week):

| Inicjatywa | Makieta (start/span dni) | Zrzut (start/span dni) | Δ |
|---|---|---|---|
| Energy Monitoring | 14 / 28 | 13.99 / 27.97 | ≤0.06 dnia (≤0.6px) |
| Supplier Quality Gate | 49 / 28 | 48.95 / 27.97 | ≤0.06 dnia |
| Shift Handover | 56 / 28 | 55.94 / 27.97 | ≤0.06 dnia |
| Predictive Maintenance (CNC) | 0 / 49 | 0 / 48.95 | ≤0.06 dnia |
| MES Rollout | 0 / 84 (clip) | 0 / 97.9 (clip do końca toru) | clip |
| Warehouse Automation | 0 / 42 | 0 / 41.96 | ≤0.06 dnia |
| Skills Matrix | 7 / 70 | 6.99 / 69.93 | ≤0.06 dnia |
| Scrap Reduction | plakietka „poza horyzontem", bez paska | tak samo | 0 |

Różnice ≥4px lub koloru (wypisane, nie naprawiane — poza zakresem linii etapu 1):
1. **Horyzont 14 kolumn (Sep 14–Dec 21) vs 12 w makiecie (Sep 14–Nov 30).** Źródło: `PlanCard.tsx:295–301`
   (`ganttRange` = dziś + 3 mies.), poza dozwolonym zakresem `:618–751` → propozycja etapu 2.
   Skutek: procentowe szerokości inne (energy 28/98 = 28.6% vs 33.3% makiety) przy identycznej geometrii w dniach.
2. **Overflow poziomy:** tor 98 dni × 9.01px ≈ 883px > ~590px widocznego toru w kolumnie środkowej Huba
   przy 1440×900 → prawe kolumny i plakietka „poza horyzontem" za przewinięciem; makieta mieści wszystko.
3. **Wysokość wiersza 40px stałe** vs makieta `.lrow{flex:1}` (wypełnia wysokość karty).
4. **Legenda 5 pozycji** vs 6 w makiecie (brak „Conflict" — etap 3).
5. **Etykieta dat w pasku** (SPEC §3.1: 10,5px/600 wyśrodkowana) — makieta HTML ma puste paski;
   zrzut zgodny ze SPEC; akceptowany PNG stagingu miał nazwy w paskach (stan PRZED, legacy).
6. **Brak uchwytów drag i ściętych brzegów** (etap 2) oraz **obwódki/chipu konfliktu i strzałek
   ABSOLUTE/CONDITIONAL** (etap 3); moje łączniki = istniejące szare elbow L (prop-driven).
7. **Ciemny motyw:** makieta tylko jasny; ciemny = mapowanie tokenów (`c-chart-1` #5aa3d4 z granatowym
   tekstem, zamrożone #f4f7fb z granatowym tekstem) — zmierzone poniżej.

Kontrast pikselowy ze zrzutu (próbka = modalny kolor tekstu vs modalne tło, próg 4.5:1):

| Miejsce | Jasny | Ciemny |
|---|---|---|
| etykieta na pasku planowanym | 5.48 (#ffffff na #2f6f95) | 6.48 (#0f172a na #5aa3d4) |
| etykieta na pasku w realizacji | 17.85 (#ffffff na #0f172a) | 16.61 (#0f172a na #f4f7fb) |
| plakietka konfliktu | N/A — etap 3 (SPEC §8); 0 konfliktów w fiksturze | N/A |
| tekst legendy | 4.76 (#64748b na #ffffff) | 6.18 (#8a99b0 na #0f172a) |
| nazwa w kolumnie | 17.85 (#0f172a na #ffffff) | 16.61 (#f4f7fb na #0f172a) |
| (dodatkowo) plakietka TODAY | 17.85 (#ffffff na #0f172a) | 16.61 (#0f172a na #f4f7fb) |

Naprawa zmierzona w etapie 1: tekst paska planowanego był `text-c-tag-foreground` (biel) → w ciemnym
motywie 2.75:1 na #5aa3d4 (PONIEJ progu). Zmienione na `text-c-surface` (jasny: biel 5.48:1;
ciemny: #0f172a 6.48:1). Przed poprawką zrzuty mierzyły 2.75 — liczby powyżej są PO poprawce.

Fiksatura harnessu: okna dat były `T00:00:00.000Z` → na maszynie America/Chicago to 19:00 POPRZEDNIEGO
dnia i każdy pasek siadał dzień w lewo od makiety. Zmienione na północ lokalną (bez `Z`), jak w testach.

## §7.5 Bramki

| Bramka | Wynik |
|---|---|
| `cd server && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| front `tsc --noEmit` (bez potoku) | 167 błędów = baza 167 (delta 0; zero w moich plikach) |
| `bash scripts/check-list-canon.sh` | 346 / baseline 346 — dług nie rośnie |
| `bash scripts/check-artefakt.sh` | 8 / baseline 8 — dług nie rośnie |
| `npm run check:jezyk:ci` | OK (nic nie wzrosło) |
| `npm run check:flagi:dockerfile` | `brakujace=0` |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | exit 0 |
| vitest katalogu Initiatives | 5 czerwonych = ZASTANE (poniżej) |

Czerwone ZASTANE (zmierzone identycznie na bazie `e7b784b5c0`): `a19-jedna-tabela-render.test.tsx`
(3 testy), `capacityAnalysis.brakPresji.test.tsx` (1), `registerPreviewKanon.k5.test.ts` (1) →
`Tests 5 failed | 10 passed (15)`; oraz `.pg.`/`realpg` (2 FAIL + 8 skipped — wymagają kontenera PG,
na bazie tak samo). ZERO nowych czerwonych.

## §5.2 Unifikacja — TYLKO wypis, BEZ wykonania (wejście osobnej fali)

| ŻYWE, własna siatka + paski | Linie | Gdzie / budowa kolumn |
|---|---|---|
| `src/components/Execution/ExecutionTimelineView.tsx` | 1618 | Execution; `:185 generateWeeks()`, `:206 getMonthsFromWeeks()`, paski `:460`, drag `:520` |
| `Initiatives/gantt/InitiativeGantt.tsx` | ~539+ | przedmiot specu; wołacze `PlanCard.tsx:13` i `sections/TimelineSection.tsx:40` |
| `Initiatives/InitiativePortfolioScheduleView.tsx` | 220 | `:26–42 buildInitiativeScheduleAxis()` |
| `Execution/ExecutionBankViews.tsx` + `executionBankModel.ts` | 1271 + 1195 | `:1112 weeklyBuckets` / `:1130 monthlyBuckets` |
| `MyWork/table/TimelineView.tsx` | 407 | `:132 headerCells`, `:157 getBarStyle()` |
| `MyWork/table/views/GanttView.tsx` | 472 | `:78 buildSlots()`, `:122 dateToPixel()` |
| `MyWork/DecisionsTimelineView.tsx` | 498 | `:108–118`, `:124 getXForDate()` |

MARTWE — do czystki, nie do adopcji: `src/components/RoadmapGantt.tsx` (1136),
`src/components/Portfolio/PortfolioTimelineView.tsx` (403, tylko barrel),
`src/components/Execution/ExecutionWorkloadView.tsx` (772, import bez użycia).
**Nie wykonywano żadnej unifikacji w tym zleceniu.**

---

# ETAP 1b (Wpis 74) — domknięcie 2×P2 + P3 po odbiorze CTO

Zakres: wyłącznie `InitiativeGantt.tsx` (P2-1, P2-2) i fikstura harnessu (P3). `PlanCard.tsx`
NIE dotknięty (P2-1 naprawione w Gantcie, zgodnie ze zleceniem).

## P2-1 — overflow poziomy chował dowód „poza horyzontem"

Przyczyna zmierzona: `gridMinWidth = max(480, totalDays × PX_PER_DAY[zoom])` dawał przy 14 kolumnach
(98 dni × 9px) ≈ 882px minWidth na torze ~700px, a kontener `overflow-x-auto` przewijał prawą krawędź
z plakietką poza widok. Naprawa: w trybie planu `gridMinWidth = undefined` (siatka flex wypełnia tor,
kolumny = szerokość/N) i kontener `overflow-hidden` zamiast `overflow-x-auto`; oś legacy (bez
`rowLabels`) bez zmian (minWidth + przewijanie zostają).
Test: „etap 1b P2-1" — przy 8 inicjatywach i horyzoncie 3 mies. brak `overflow-x-auto`, brak px
`minWidth`, a symulowana szerokość siatki = max(px minWidth, szerokość toru) mieści plakietkę
(`gridWidth − 4 ≤ track.clientWidth`, plakietka ma `right-1`).
Mutacja: przywrócenie px `minWidth` → `minWidth='756px'` → 752 > 700 → test CZERWONY. ZABITA.

## P2-2 — kolumna nazw: `truncate` → `line-clamp-2`

Zgodnie ze SPEC §3.1 (nazwa 11.6px/600, `line-clamp:2`). Konsekwencja: `PLAN_ROW_H` 40 → 52px,
bo dwuliniowa nazwa (~28px) + linia roli (~13px) + `py-1` nie mieściły się w 40px i druga linia
wylewała się z komórki o stałej wysokości.
Test: „etap 1b P2-2" — asercja klasy `line-clamp-2` (i brak `truncate`) na nazwie oraz `truncate`
na linii roli (meta ma zostać jednoliniowa z elipsą, SPEC §3.1).
Mutacja: przywrócenie `truncate` na nazwie → test CZERWONY. ZABITA.

## P3 — fikstura bez `roleDemand`

`z3x-inicjatywy-plan.tsx`: dodane `role` do 8 inicjatyw i `roleDemand[].roleLabel` do okien, dzięki
czemu drugi wiersz etykiety („Planned · Energy lead" itd.) renderuje się w dowodzie jak w makiecie.
`ganttRowLabels` w `PlanCard.tsx:359–382` czyta `roleDemand[].roleLabel` — bez zmian.

## Testy etapu 1b

| Plik | Testy | Wynik |
|---|---|---|
| `InitiativeGantt.planTimeline.test.tsx` | 10 (8 z etapu 1 + 2 nowe) | 10 passed |
| `InitiativeGantt.frozenWindows.test.tsx` | 6 | 6 passed |
| `InitiativeGantt.planHorizon.test.tsx` | 1 | 1 passed |
| `planTimelineV2Flag.test.ts` | 1 | 1 passed |
| **RAZEM (4 pliki)** | **18** | **18 passed** |

Czerwone ZASTANE (6, identyczne na bazie `27f6bb5ea9`): `tests/components/Initiatives/`
{render, features, drag-reschedule, rollback}.test.tsx — asercje legacy (`bg-primary-500`,
today-marker) sprzed tokenizacji; moja zmiana dodaje 0 nowych czerwonych.

## Zrzuty etapu 1b + porównanie z makietą

4 zrzuty 1440×900 EN, ten sam harness, motyw przez zustand, `--bez-chrome`, konsola czysta
(`KONSOLA-BLEDY` brak we wszystkich 4): `evidence/qoder-gantt-pl3-etap1b-20260917/pl3-{light,dark}-{draft,published}.png`.
Zrzut obejmuje oś (sekcja „Dependencies and conflicts" przewinięta do siatki), więc dowody są widoczne:

- **Plakietka „Starts Jan 12 — outside this horizon →"** widoczna przy PRAWEJ krawędzi toru we
  wszystkich 4 zrzutach (zmierzone: `badge.right = 1048 ≤ 1440`); w etapie 1 była za przewinięciem.
- **Nazwy w 2 liniach** (`line-clamp-2`): „Energy Monitoring and ISO 50001" i „Predictive Maintenance
  for CNC Line" łamią się na 2 linie, nic nie ucięte elipsą.
- **Role widoczne**: „Planned · Energy lead", „Planned · Quality lead", „In execution · Maintenance" itd.
- **14 kolumn tygodniowych (Sep 14 – Dec 14) mieści się w całości bez przewijania poziomego** —
  jak makieta mieści swoje 12; geometria w DNIACH bez zmian (tabela etapu 1 nadal ważna).
- PUBLISHED: notice read-only + „Create a new version (draft)", zero uchwytów drag (bez zmian).

Różnice wobec makiety pozostające (wypisane, poza zakresem 1b): horyzont 14 vs 12 kolumn
(`ganttRange` = dziś + 3 mies., `PlanCard.tsx:295–301`, poza dozwolonym zakresem → propozycja etapu 2);
wysokość wiersza 52px stałe vs makieta `.lrow{flex:1}`; legenda 5 vs 6 pozycji („Conflict" = etap 3).

## Kontrast ponownie dla zmienionych miejsc (próg 4.5:1)

| Miejsce (zmienione w 1b) | Jasny | Ciemny |
|---|---|---|
| nazwa w kolumnie (`line-clamp-2`) | 17.85 (#0f172a na #ffffff) | 16.61 (#f4f7fb na #0f172a) |
| linia roli (nowo widoczna) | 4.76 (#64748b na #ffffff) | 6.18 (#8a99b0 na #0f172a) |
| plakietka „poza horyzontem" (nowo widoczna) | 4.76 (#64748b na #ffffff) | 6.18 (#8a99b0 na #0f172a) |

Metoda: próbka pikselowa zrzutu (modalny kolor tekstu vs modalne tło) dla nazwy i roli; dla
plakietki (tekst 10px, silny antyaliasing zniekształca próbkę modalną) kolor tekstu z computed
style (`rgb(100,116,139)` / `rgb(138,153,176)`) na tle powierzchni, liczony `scripts/contrast-ratio.mjs`.
Wszystkie ≥4.5:1 w obu motywach.

## Bramki etapu 1b (obie liczby)

| Bramka | Wynik |
|---|---|
| `cd server && npx tsc --noEmit -p tsconfig.json` | exit 0 (0 błędów) |
| front `tsc --noEmit` | 167 = baza 167 (delta 0) |
| `bash scripts/check-list-canon.sh` | 346 / baseline 346 |
| `bash scripts/check-artefakt.sh` | 8 / baseline 8 |
| `npm run check:jezyk:ci` | OK (nic nie wzrosło; spadki K4obj −4, K5en −1, K8sen −3) |
| `npm run check:flagi:dockerfile` | `analyzedFlags=198 brakujace=0` |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | exit 0 |

# ETAP 2 (Wpis 90) — przeciąganie pasków z zapisem (DEC-627, SPEC §4 + §8 row „2")

Zakres: uchwyty na paskach, drag ze snapem dziennym, podpowiedź „Drag to move · N weeks",
zapis przez `onWindowChange` → `writePlanScenario` (JEDEN zapis na `pointerup`, nigdy na
`pointermove`; zapis CAŁEGO scenariusza z `expectedVersion` — SPEC §2.3), optimistic UI,
obsługa 409 (pasek wraca + komunikat), undo jednego poziomu, minimalny zestaw klawiaturowy
§13.3c. Drag TYLKO na szkicu (DRAFT) i tylko paski nie-zamrożone.

## Pomiar wstępny (KROK 0)

- `onReschedule` NIE istniał w `InitiativeGantt` (grep = 0 trafień przed zmianą) — przeciąganie
  nie miało drogi zapisu; `commit` w osi był czysto lokalny.
- `writePlanScenario` (`runtimeApi.ts:1070`) już istnieje i rzuca `RuntimeApiError(status, code,
  rule)` przy `!response.ok` — 409 CAS jest osiągalny, brakowało tylko mostka UI→zapis.
- `PlanScenarioSurface` zapisuje CAŁY scenariusz z `expectedVersion` (`persistScenario`,
  `:933`), więc adapter w karcie musiał zwracać `boolean`, by oś wiedziała, czy cofnąć pasek.
- Fikstura harnessu (`z3x-inicjatywy-plan.tsx`) NIE miała gałęzi POST — zapis wpadałby w GET
  (ta sama ścieżka) i 409 nigdy by się nie odtworzyło; dodano stub POST + `?conflict=1`.

## §7.1 Testy (`src/components/Initiatives/__tests__/InitiativeGantt.planDrag.test.tsx`, 16/16)

| Test | Czego dowodzi |
|---|---|
| drag planowanego paska w DRAFT zapisuje RAZ z oknem +14 dni | `pointerdown→pointermove(×N)→pointerup` = JEDEN `onReschedule`, snap dzienny (+14 d, nie +13/+15) |
| drag z wieloma `pointermove` nadal zapisuje RAZ | zapis NIGDY na `pointermove` (preview tylko lokalny) |
| błąd zapisu (409) → pasek WRACA | `onReschedule` reject → optimistic UI cofnięty |
| klawiatura: ←/→ = ±7 dni, Shift = ±1 dzień, Enter zapisuje, Esc cofa | §13.3c zestaw minimalny |
| Ctrl/Cmd+Z po zapisie cofa okno | undo jednego poziomu |
| pasek zamrożony: aria-disabled, strzałki NIC nie robią | drag/klawiatura tylko nie-zamrożone |
| PUBLISHED: aria-disabled, drag i strzałki bez zapisu | drag TYLKO na szkicu |
| PlanCard: drag → `onWindowChange` RAZ z całym `{earliest,target,latest}` +14 d | most oś→zapis przesuwa wszystkie trzy daty o to samo Δ |
| PlanCard: `onWindowChange=false` (409 z CAS) → pasek WRACA | brak cichej utraty zmiany |
| PlanCard: 409 → komunikat konfliktu widoczny PRZY osi czasu | `role=alert` w sekcji zależności (nie tylko w „Decyzje") |

Bieg: `npx vitest run …planDrag.test.tsx --retry=0` → `16 passed (16)`.
Sąsiedzi: `npx vitest run src/components/Initiatives --retry=0` → 5 plików czerwonych,
WSZYSTKIE zmierzone na bazie (worktree `HEAD`) = te same 5 → ZASTANA, zero NOWYCH
(`a19-jedna-tabela-render`, `capacityAnalysis.brakPresji`, `registerPreviewKanon.k5` po 5
testów łącznie + 2× `*.pg./realpg` wymagające żywego kontenera PG, nieuruchomionego).

## §7.3 Mutacje — PRZED i PO

| Mutacja (cofnij zabezpieczenie) | PRZED (czerwony) | PO (przywrócone) |
|---|---|---|
| A: `onMove` commituje na każdym `pointermove` | `6 failed \| 9 passed` | 16/16 |
| B: `planEditable = true` (drag na PUBLISHED) | `1 failed \| 14 passed` | 16/16 |
| C: `canDrag` bez `!frozen` (drag zamrożonych) | `2 failed \| 13 passed` | 16/16 |
| B+D: gate PUBLISHED w karcie bez `&& editable` | `2 failed \| 13 passed` | 16/16 |
| E: blok `errorLabel` w sekcji zależności usunięty | `1 failed \| 15 skipped` (test komunikatu) | 16/16 |

Każda mutacja przywrócona dokładnie; po przywróceniu pełny plik zielony.

## §7.4 Zrzuty 1440×900 EN (realny Hub, `dev-render`) + kontrast

Pliki w `evidence/qoder-gantt-pl3-etap2-20260918/` (harness `?screen=z3x-inicjatywy-plan`,
`VITE_PLAN_TIMELINE_V2=true`, motyw przez store aplikacji, `uwagi=0`, ścieżka 409 `conflict=1`):

| Zrzut | Co widać | bledyKonsoli |
|---|---|---|
| `pl3-light-drag-hint.png` | środek przeciągania: pasek „Oct 12 → Nov 09", uchwyty, ring fokusa, chip „Drag to move · 4 weeks", TODAY | 0 |
| `pl3-dark-drag-hint.png` | to samo w ciemnym motywie | 0 |
| `pl3-light-409.png` | PO odrzuceniu: pasek WRÓCIŁ do „Sep 28 → Oct 26" + czerwony komunikat „Plan changed or its Portfolio basis is stale. Reopen before retrying." | 0 |
| `pl3-dark-409.png` | to samo w ciemnym motywie | 0 |

Przeciąganie = PRAWDZIWA mysz Playwright (trusted pointery), `dx = pół szerokości paska`
→ +14 dni dla 28-dniowego okna Energy; pomiar `style.left` PRZED/PO = `14.2857%` → revert.

Kontrast podpowiedzi (chip `bg-c-text` / `text-c-surface`), `scripts/contrast-ratio.mjs`:
jasny **17.85:1**, ciemny **16.61:1** — oba ≥4.5:1.

Uwaga naprawcza etapu 2: komunikat 409 renderował się dotąd TYLKO w zwiniętej gałęzi
powierzchni (`PlanScenarioSurface:1824`) i w sekcji „Decyzje", więc przy zapisie z osi czasu
pasek wracał bez słowa. Dodano `errorLabel` (`role=alert`) w sekcji zależności tuż nad osią
(`PlanCard.tsx`) — stąd mutacja E i zrzuty „po 409" z widocznym komunikatem.

## §7.5 Bramki etapu 2

| Bramka | Wynik |
|---|---|
| `cd server && npx tsc --noEmit -p tsconfig.json` | exit 0 (0 błędów) |
| front `tsc --noEmit` (8 GB, pierwszy plan) | 156 = baza 156 (delta 0); 0 błędów w dotkniętych plikach |
| mutacja przyrządu tsc (`const tscProbe: number = "s"`) | 156 → 157 (+1) → cofnięte |
| `bash scripts/check-list-canon.sh` | 345 / baseline 346 (dług nie rośnie) |
| `bash scripts/check-artefakt.sh` | 8 / baseline 8 |
| `npm run check:jezyk:ci` | OK (nic nie wzrosło; spadki K4en −1, K4obj −4, K5pl −26, K5en −19, K8sen −3) |
| `npm run check:flagi:dockerfile` | `analyzedFlags=200 brakujace=0` |
| `node scripts/check-dev-render-parytet.mjs --ekran=z3x-inicjatywy-plan` | CZYSTO (R1/R2/R3/PODPIS = 0 nowych) |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | exit 0 |

