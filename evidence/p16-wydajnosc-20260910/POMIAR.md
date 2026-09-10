# Pomiar wydajności ekranów flagowych — staging, 2026-09-10

Kryterium: `TRZY_POJEMNIKI_PRACY_20260906.md`, Pojemnik 2, kryterium 4 / pozycja 2.5:
„każdy ekran flagowy < 3 s do treści na stagingu, szkielety z P5 potwierdzone na żywo, Megatrendy 200."

Metodologia: przeglądarka (Claude Browser MCP), konto `james.whitfield@northwind.example`
(organizacja Northwind Manufacturing — dane, nie pusta org), staging.consultify.ai,
2-3 nawigacje na ekran, zrzuty w oknach czasowych (skumulowane od nawigacji):
~0.3-1.0s / ~1.5s / ~3.0s / (dalej co potrzeba). Czas = pierwszy moment, w którym
widoczna jest REALNA treść (nie pusta ramka, nie sam spinner/skeleton).
Definicja "ekran flagowy" = główny ekran listowy każdego z 16 modułów (lista własna,
przyjęta na starcie — patrz meldunek; brak osobnej, spisanej listy "ekranów flagowych"
w docs/program lub docs/ssot).

| # | Ekran (moduł) | Trasa | Mediana | Najgorszy | Szkielet? | Werdykt (< 3s) |
|---|---|---|---|---|---|---|
| 1 | Czat | /chat | <1.0s | <1.0s | n/d (bez opóźnienia) | PASS |
| 2 | Moja Praca (Skrzynka) | /my-work | ~1.5s | ~1.5s | TAK (skeleton kart+wierszy) | PASS |
| 3 | Wywiad | /interview | ~2.0s | ~3.0s | TAK, ale 1. klatka bywa całkiem pusta (navy blank) przed skeletonem | PASS (na granicy) |
| 4 | Narzędzia | /discovery-tools | ~3.75s | ~4.5s | TAK (skeleton wierszy), ale liczniki Menu3 pokazują "0" zanim wskoczą prawdziwe wartości | **FAIL** |
| 5 | Ocena | /assessment | ~3.0s | ~5.0s | TAK (ten sam generyczny skeleton co inne ekrany) | **FAIL (worst), granica (median)** |
| 6 | Inicjatywy | /initiatives | ~3.0s | ~5.0s | TAK, ale liczniki Menu3 "All 0 / Pending 0 / In execution 0" widoczne, zanim wskoczą prawdziwe (12/1/4) | **FAIL (worst), granica (median)** |
| 7 | Realizacja → Dostawy (domyślna zakładka) | /execution | ~2.0s | ~3.0s | CZĘŚCIOWO — w oknie ok. 1.5s pokazuje FAŁSZYWY pusty stan „No initiatives in execution" zanim doładują się realne dane | PASS (na granicy), ale fałszywy pusty stan to defekt |
| 7b | Realizacja → Praca | /execution?tab=work | ~2.2s | ~3.0s | NIE — okno ładowania jest całkiem puste (biała/granatowa pustka), liczniki „All 0/Overdue 0/Blocked 0" kłamią przed danymi | PASS (na granicy), brak szkieletu = defekt |
| 7c | Realizacja → Zasoby (znany p.zapalny) | /execution?tab=resources | ~2.2s | ~3.0s | TAK — napis „Loading…" + spinner, nie pusto | PASS — **ogromna poprawa vs. 15-22s z audytu 05.09** |
| 8 | Wyniki | /results | ~3.0s | ~3.0s | TAK (skeleton kart) | PASS (na granicy) |
| 9 | Finanse | /finance | ~1.5s | ~1.5s | NIE — tylko spinner, ale szybko | PASS |
| 10 | Materiały | /presentations | ~3.0s | ~3.0s | CZĘŚCIOWO — spinner + napis „Loading", nie prawdziwy skeleton | PASS (na granicy) |
| 11 | Audyty | /audit-programs | ~1.5s | ~1.5s | NIE — od razu treść po spinnerze | PASS |
| 12 | Spotkania | /meetings | ~1.5s | ~1.5s | n/d — moduł celowo poza MVP, ekran „planned for Wave 2" | PASS (nie mierzy danych) |
| 13 | Organizacja | /organization | ~1.5s | ~1.5s | NIE — szybko od razu treść | PASS |
| 14 | Panel administratora | /admin | ~1.5s | ~1.5s | NIE — szybko od razu treść | PASS |
| 15 | Ustawienia | /settings | ~1.5s | ~1.5s | NIE — szybko od razu treść | PASS |
| 16 | Portal partnerski | /partner/dashboard | ~3.0s | ~3.0s | CZĘŚCIOWO (dim shell) | PASS (na granicy); Northwind nie jest kontem partnerskim — ekran to legalny pusty stan "not connected", NIE zmierzono prawdziwego dashboardu z danymi |

## Powyżej 3 sekund (worst-case lub median)

- **Narzędzia** (`/discovery-tools`) — mediana ~3,75 s, najgorszy ~4,5 s. Powtarzalnie powyżej progu.
- **Ocena** (`/assessment`) — mediana ~3,0 s (na granicy), najgorszy ~5,0 s (2 z 3 pomiarów w normie, 1 wyraźnie powyżej).
- **Inicjatywy** (`/initiatives`) — mediana ~3,0 s (na granicy), najgorszy ~5,0 s (1 z 3 pomiarów wyraźnie powyżej, wysoka wariancja 1,5-5 s).

## Megatrendy

**NIE odpowiadają poprawnie.** `GET /api/megatrends/baseline?industry=automotive` → **503**
(`"type":"not_configured"`, komunikat UI: „Could not load megatrends — The megatrend baseline
for this industry could not be fetched"). To NIE jest powrót starego błędu importu ESM opisanego
w `P5_SZKIELETY_I_404.md` (ten jest już naprawiony — `server/src/services/megatrendService.ts`
robi dziś statyczny import, `/api/health` zwraca `megatrendsAvailable:true`, serwis wystartował
poprawnie). Przyczyna leży w `server/src/models/megatrend.ts:62-90` (`getBaselineTrends`) —
zapytanie `SELECT … WHERE industry = ?` nie znajduje wiersza dla `industry='automotive'`
(przemysł organizacji Northwind) i model świadomie rzuca `FEATURE_UNAVAILABLE` (503) przy zerze
wierszy. **To brak danych bazowych (seed) dla branży „automotive" w tabeli megatrendów na
stagingu, nie błąd kodu.** Zrzut: `megatrendy-broken.png`.

## Przyczyny (ekrany powyżej progu)

- **Narzędzia** (`/discovery-tools`): biblioteka narzędzi (38 pozycji) renderuje generyczny
  skeleton, ale realne wiersze (nazwa/tagi/licencja/status) czekają na osobną odpowiedź, która
  konsekwentnie ląduje w oknie 3-4,5 s. Brak w tym pomiarze dowodu na N+1 (nie widziałem wachlarza
  zapytań per-narzędzie w Network) — wygląda na jedno wolniejsze zapytanie listy/agregacji
  (być może join po tagach/kategoriach dla 38 rekordów) niż na brak stronicowania czy limitu.
  Wymaga profilowania zapytania po stronie serwera (nie zrobione w tym pomiarze — poza „wąskie
  i pewne").
- **Ocena** (`/assessment`) i **Inicjatywy** (`/initiatives`): wysoka WARIANCJA (1,5 s do 5 s na tej
  samej trasie, tych samych danych, kolejne nawigacje) wskazuje raczej na coś współdzielonego i
  niestabilnego (cache/connection warm-up, kolejkowanie zapytań startowych — obie strony ładują
  dużo tego samego co Chat: `/api/auth/me`, `/api/organizations/current`,
  `/api/feature-flags/runtime`, itd. — 15-20 zapytań "bootstrap" nim właściwa lista w ogóle
  wystartuje) niż na jeden zły punkt w kodzie tego ekranu. Menu 3 na obu ekranach pokazuje
  liczniki "0" (All 0/Pending 0…) zanim wskoczą prawdziwe wartości — to dokładnie wzorzec z
  `P5_SZKIELETY_I_404.md` (MyWorkHub liczniki) powtórzony w innych modułach, nienaprawiony tam.

## Realizacja → Zasoby (P16 kontrolne dla znanego problemu z audytu 05.09)

Historyczny pomiar (05.09, `AUDYT_AWARD_20260905`): 15,5-22 s, ekran całkowicie pusty bez
informacji zwrotnej. Dziś (10.09): **~2,2-3,0 s**, widoczny napis „Loading…" ze spinnerem.
Kod `src/components/Execution/executionCaseFanOut.ts` (mechanizm `fanOutExecutionCases`,
timeout per-realizacja 12 s, degradacja pojedynczej wiszącej realizacji zamiast całej zakładki)
został wdrożony i DZIAŁA — to bezpośrednia przyczyna poprawy.

**Architektura pozostaje N+1** (potwierdzone w Network): dla każdej z 4 realizacji w
`execution-cases` osobne zapytania `…/execution-cases/:id/work` ORAZ `…/execution-cases/:id/allocations`
(8 dodatkowych zapytań przy 4 realizacjach), plus zestaw ~11 identycznych endpointów
`execution-control/manager/lanes/*/problems` wołanych DWUKROTNIE (raz dla zakładki Praca, raz dla
Zasoby) przy jednej nawigacji na `/execution?tab=resources`. Przy dzisiejszej objętości danych
(4 realizacje) mieści się w progu 3 s dzięki równoległości i timeoutowi z fanOut. **To nie jest
"wąskie i pewne" do naprawy dziś** (wymaga zbiorczego endpointu `work+allocations` dla wielu
realizacji naraz, czyli przebudowy odczytu) — **STOP z lokalizacją**: batchowanie
`GET …/execution-cases/:id/work` i `.../allocations` w `src/services/initiatives-execution/runtimeApi.ts`
(wołane z `ExecutionResourcesSurface.tsx`/`ExecutionWorkSurface.tsx` przez `fanOutExecutionCases`,
plik `src/components/Execution/executionCaseFanOut.ts`). Szacunek: 1 sesja Opus (nowy endpoint
serwerowy zbiorczy + zmiana wołającego klienta + test kontraktowy) — do zrobienia gdy liczba
realizacji w Realizacji przekroczy kilkanaście (dziś 4, próg bólu z audytu był osiągnięty przy
większej liczbie/wolniejszym środowisku).

## Fałszywe puste stany (przy okazji, nie w zakresie naprawy dziś)

- `/execution` (zakładka Dostawy, domyślna): w oknie ~1,5 s pokazuje "No initiatives in execution.
  Move initiatives to execution first." zanim doładują się 4 prawdziwe rekordy. To fałszywy
  negatyw (pattern z pamięci projektu: "zero nie jest dowodem"), nie prawdziwy pusty stan.
- `/execution?tab=work`: liczniki "All 0 / Overdue 0 / Blocked 0" i całkowicie pusty obszar treści
  (bez skeletonu, bez tekstu) w oknie do ~1,5-2s przed załadowaniem 46 zadań.
- `/initiatives`, `/discovery-tools`: liczniki Menu 3 na "0" w oknie pośrednim, zanim wskoczą
  prawdziwe wartości.

Wszystkie trzy pasują do zdiagnozowanej w `P5_SZKIELETY_I_404.md` przyczyny źródłowej A
(`MyWorkHub.tsx:1005` init liczników na `{all:0,...}` zamiast `null`) — wzorzec NIE został
naprawiony globalnie, tylko (przypuszczalnie) punktowo. Nie naprawiane w tym pomiarze — to więcej
niż jeden plik/moduł zamrożony (Initiatives, Execution, Tools), wymaga markerów odmrożenia per
moduł zgodnie z CLAUDE.md.

## Zrzuty (evidence/p16-wydajnosc-20260910/)

- `ocena-assessment.png` — Ocena po pełnym załadowaniu (dla porównania wizualnego, nie w oknie FAIL)
- `narzedzia-discovery-tools.png` — Narzędzia po pełnym załadowaniu
- `inicjatywy-initiatives.png` — Inicjatywy po pełnym załadowaniu
- `megatrendy-broken.png` — Megatrendy, realny błąd 503 widoczny na ekranie
