# RECEIPT — C6 etap 1: oś czasu planu (DEC-615, SPEC §8) + bramka §7.5

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
