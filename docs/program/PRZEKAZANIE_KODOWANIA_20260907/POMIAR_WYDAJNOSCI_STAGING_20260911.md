# Pomiar wydajności ekranów flagowych — staging, 2026-09-11

Zadanie: Pojemnik 2, pozycja 2.5/2-C, kryterium 4 (`docs/program/TRZY_POJEMNIKI_PRACY_20260906.md:86`):
„Wydajność: każdy ekran flagowy < 3 s do treści na stagingu, szkielety z P5 potwierdzone na żywo,
Megatrendy 200."

Tylko odczyt — zero zapisów na stagingu, zero dotykania demo/produkcji. Konto testowe:
`james.whitfield@northwind.example` (OWNER, organizacja Northwind Manufacturing Ltd.,
`468b234c-66c4-54e1-b626-5e0fb3a92f6a`), sesja wstrzyknięta z gotowego tokenu — bez logowania hasłem.

Poprzedni pomiar tego samego kryterium: `evidence/p16-wydajnosc-20260910/POMIAR.md` (10.09, przeglądarka
ręczna Claude Browser MCP, 2-3 nawigacje/ekran, czas do widocznej treści z zegarkiem). Ten pomiar (11.09)
jest AUTOMATYCZNY (Playwright headless, `page.goto(..., waitUntil:'networkidle')`), 3 przebiegi na ekran
(1 zimny + 2 ciepłe), więc liczby nie są 1:1 porównywalne z 10.09 (inna definicja "koniec ładowania" —
`networkidle` zwykle PÓŹNIEJ niż "pierwsza widoczna treść" z pomiaru ręcznego) — traktuj 10.09 jako
punkt odniesienia jakościowy (który ekran był wolny, nie dokładną liczbę sekund).

## ★ Instrument skłamał na `networkidle` — ważne przed czytaniem tabeli

Pierwotny plan (`waitUntil:'networkidle'` jako miara „koniec ładowania") **zawiódł na większości
ekranów**: 4 z 16 tras (Interview, Tools, Initiatives, Settings) dały **TIMEOUT 20 s na WSZYSTKICH
3 przebiegach, przy 0 przechwyconych żądań `/api/*`** — co nie znaczy, że ekran ładował się 20+ s;
znaczy, że `networkidle` (brak aktywności sieci przez 500 ms) nigdy nie nastąpił w oknie 20 s, najpewniej
przez połączenie w tle (polling/WS) utrzymujące sieć "żywą" mimo widocznej treści. Pomiar ręczny 10.09
(`evidence/p16-wydajnosc-20260910/POMIAR.md`) mierzył Interview i Settings jako PASS (~1,5-3s do treści)
— rozjazd wskazuje na WADĘ PRZYRZĄDU na tych 4 trasach, nie na regresję produktu. Zgodnie z zasadą
projektu „przyrząd kłamie, oko przywyka" — nie biorę TIMEOUT za dowód winy produktu tam, gdzie
zero żądań API sugeruje, że coś w samym mechanizmie pomiaru (nie w ekranie) się zacięło.

Dodatkowo: przechwytywanie czasu pojedynczego żądania API przez `request.timing()` zwróciło `-1` dla
KAŻDEGO żądania (błąd instrumentu — Resource Timing przez CDP nie działa tu jak oczekiwano) — kolumna
„najwolniejsze zapytanie" per ekran z Playwrighta jest bezwartościowa i pominięta. Zamiast niej użyto:
(a) bezpośrednich pomiarów `curl` (poniżej, wiarygodne, zmierzone realnym zegarkiem), (b) LCP z
`PerformanceObserver` w stronie (wiarygodne, mierzone w kontekście strony, nie przez proxy CDP).

**Wniosek metodologiczny na przyszłość:** na tym SPA `networkidle` NIE nadaje się jako kryterium
końca ładowania — kolejny pomiar powinien wrócić do metody 10.09 (czas do widocznej treści, mierzony
ręcznie lub przez selektor DOM konkretnego elementu treści), ewentualnie `waitUntil:'load'` + osobny
watchdog na zniknięcie skeletonu.

## Metodologia

- Playwright chromium headless, z `node_modules` repo (zainstalowano brakujące binaria: `npx playwright
  install chromium`, brak w cache przed pomiarem).
- Dla każdego z 16 ekranów menu głównego: 1 nawigacja w ŚWIEŻYM kontekście przeglądarki (zimna pamięć,
  bez cache) + 1 nawigacja rozgrzewająca + 2 kolejne nawigacje w TYM SAMYM kontekście (ciepła pamięć,
  współdzielony cache/localStorage) — mediana liczona z 3 zmierzonych przebiegów (1 zimny + 2 ciepłe).
- Miara czasu: `page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })` — czas do braku aktywności
  sieciowej przez 500 ms (może być PÓŹNIEJSZY niż moment widocznej treści, jeśli ekran ma tło pollujące
  zapytania).
- LCP: `PerformanceObserver`/`performance.getEntriesByType('largest-contentful-paint')` w kontekście strony.
- Rejestrowane: wszystkie żądania `/api/*` (URL, status, czas), błędy konsoli, odpowiedzi 5xx.
- Surowe dane: `evidence/perf-2c/raw-results.json`.

## Lista 16 modułów (źródło: `src/components/navigation/Sidebar/menuConfig.ts`,
`src/routes/routeConfig.ts`)

`getMenuStructure()` (11 pozycji, Meeting pominięty — `isMeetingsModuleEnabled()` = OFF, DEC-425) +
`getAdminMenuItem` + `getOrganizationMenuItem` + `getInternalToolsMenuItem` + `getSettingsMenuItem` +
`getPartnerMenuItem` = 16. (`getSuperAdminMenuItem` pominięty — rola testowa to OWNER, nie SUPERADMIN,
ekran spoza menu głównego dla tego konta.)

Kolumny: mediana `networkidle` (3 przebiegi — może być zawyżona/TIMEOUT, patrz sekcja wyżej), mediana LCP
(gdy dostępna — bardziej wiarygodny sygnał „treść widoczna"), liczba żądań `/api/*` na nawigację
(zaokrąglona, wszystkie przebiegi podobne — wspólny „bootstrap" ~19-28 wywołań: `auth/me`,
`csrf-token`, `organizations/current`, `feature-flags/runtime`, `v8/admin/flags`,
`settings/preferences/accessibility` i inne, na KAŻDYM ekranie, nie tylko docelowe dane), werdykt.

| # | Moduł | Trasa | Mediana networkidle | Mediana LCP | API/nawigacja | Werdykt (< 3 s) |
|---|---|---|---|---|---|---|
| 1 | Chat | `/chat` | 6,6 s | 5,7 s (rozrzut 1,6-9,8 s) | ~22 | **FAIL** na zimno, PASS na ciepło (1,6 s) — zależne od cache |
| 2 | My Work | `/my-work` | 15,5 s | 7,4 s | ~25 | **FAIL** |
| 3 | Interview | `/interview` | 20,0 s (TIMEOUT 3/3, 0 API) | brak danych | 0 | **NIEROZSTRZYGNIĘTE** (wada przyrządu — 10.09 ręcznie: PASS ~2-3s) |
| 4 | Tools | `/discovery-tools` | 20,0 s (TIMEOUT 3/3, 0 API) | brak danych | 0 | **NIEROZSTRZYGNIĘTE** (wada przyrządu; 10.09 ręcznie: **FAIL** ~3,75-4,5s — zgodny kierunek, wymaga rewery) |
| 5 | Assessment | `/assessment/overview` | 19,1 s | 10,5 s (7,2-13,7 s) | ~10-25 | **FAIL** |
| 6 | Audits | `/audit-programs` | 20,0 s (TIMEOUT 3/3) | 13,1 s (1 z 3 próbek, pozostałe 0 API) | 0-19 | **NIEROZSTRZYGNIĘTE**, niska pewność — 10.09 ręcznie PASS ~1,5s, dziś sprzeczne, do ponownego zmierzenia |
| 7 | Initiatives | `/initiatives` | 20,0 s (TIMEOUT 3/3, 0 API) | brak danych | 0 | **NIEROZSTRZYGNIĘTE** (wada przyrządu; 10.09 ręcznie: FAIL/granica ~3-5s — zgodny kierunek) |
| 8 | Execution | `/execution` | 20,0 s (2/3 TIMEOUT) | 11,4 s (7,2-15,6 s) | 0-40 | **FAIL** |
| 9 | Results (Wyniki) | `/results/kpi` | 10,1 s | 5,1 s (1,7-8,5 s) | ~24 | **FAIL** median, ale 1 z 3 przebiegów 1,7s PASS — wysoka wariancja |
| 10 | Finance | `/finance` | 5,4 s | **2,2 s** | ~25 | **PASS** |
| 11 | Materials | `/presentations` | 17,3 s | 8,6 s (2,6-14,7 s) | 0-28 | **FAIL** na zimno (14,7s), PASS na ciepło (2,6s) |
| 12 | Admin | `/admin` | 10,2 s | 6,2 s (5,8-6,6 s) | 0-20 | **FAIL** — sprzeczne z 10.09 ręcznie PASS ~1,5s, do rewery |
| 13 | Organization | `/organization/profile` | 15,3 s | 5,1 s (2,7-7,5 s) | 0-21 | **FAIL** median, 1 przebieg 2,7s PASS |
| 14 | Internal Tools (AI OS) | `/ai` | 20,0 s (TIMEOUT 2/3) | brak danych | 0-20 | **NIEROZSTRZYGNIĘTE** (wada przyrządu; brak baseline 10.09 — nowa pozycja po ukryciu Spotkań) |
| 15 | Settings | `/settings/profile` | 20,0 s (TIMEOUT 3/3, 0 API) | brak danych | 0 | **NIEROZSTRZYGNIĘTE** (wada przyrządu; 10.09 ręcznie: PASS ~1,5s) |
| 16 | Partner Portal | `/partner` | 20,0 s (TIMEOUT 2/3) | 2,2 s (1 z 3 próbek) | 0-18 | PASS na jedynej ważnej próbce; niska pewność |

**5xx: 0** na wszystkich 48 nawigacjach × wszystkich żądaniach `/api/*` przechwyconych przez Playwright,
oraz 0/24 w bezpośrednich wywołaniach `curl`. Błędy konsoli: 7, wszystkie identyczne — jedno żądanie
`403` na 7 z 16 tras (Chat, Assessment, Audits, Execution, Finance, Materials, Internal Tools);
prawdopodobnie jeden wspólny endpoint odrzucający rolę OWNER (nie zdiagnozowano dokładnie który —
poza zakresem tego pomiaru, tylko odczyt).

## TOP 3 najwolniejsze ekrany i hipoteza przyczyny

Ranking po medianie LCP (jedyny wiarygodny sygnał „treść widoczna" z tego pomiaru; Audits pominięty
mimo najwyższej pojedynczej wartości 13,1s — tylko 1 z 3 próbek ważna, za niska pewność na TOP3):

**1. Execution (`/execution`) — mediana LCP 11,4 s**
Hipoteza (zgodna z wcześniejszą diagnozą, `evidence/p16-wydajnosc-20260910/POMIAR.md`): architektura
N+1 przy pobieraniu danych realizacji. `src/components/Execution/executionCaseFanOut.ts`
(`fanOutExecutionCases`) woła per-realizacja `…/execution-cases/:id/work` ORAZ
`…/execution-cases/:id/allocations` osobno (2×N zapytań), a zestaw ~11 endpointów
`execution-control/manager/lanes/*/problems` woła się DWUKROTNIE (raz na zakładkę Praca, raz na
Zasoby) przy jednej nawigacji na `/execution`. Wołający klient:
`src/services/initiatives-execution/runtimeApi.ts`. Napraw wymaga zbiorczego endpointu
`work+allocations` dla wielu realizacji naraz — nie „wąskie i pewne" do zrobienia w tym zleceniu
(pomiarowym, bez napraw).

**2. Assessment (`/assessment/overview`) — mediana LCP 10,5 s**
Hipoteza: wspólny „bootstrap" ~20-25 zapytań na każdej nawigacji (auth/me, csrf-token,
organizations/current, feature-flags/runtime, v8/admin/flags, settings/preferences/accessibility —
identyczny zestaw widoczny na WSZYSTKICH 16 ekranach) + wysoka wariancja pojedynczych zapytań
backendu potwierdzona bezpośrednim `curl` w tej sesji: `GET /api/initiatives` 0,89-7,12 s na TEJ
SAMEJ trasie w kolejnych wywołaniach (patrz sekcja API niżej) — sugeruje kolejkowanie/cold-start
połączenia z bazą po stronie serwera, nie kod konkretnie tego ekranu. Zgodne z obserwacją 10.09
(„coś współdzielonego i niestabilnego… 15-20 zapytań bootstrap nim właściwa lista w ogóle
wystartuje").

**3. Materials (`/presentations`) — mediana LCP 8,6 s (14,7 s zimno → 2,6 s ciepło)**
Hipoteza: różnica zimno/ciepło ~12 s wskazuje na koszt zasobów statycznych (bundle JS
Materiały/Studio, ewentualnie miniatury dokumentów w bibliotece) ładowanych raz i cache'owanych
przez przeglądarkę — NIE na wolne zapytanie API (liczba wywołań API podobna zimno/ciepło, ~27-28).
Wymaga profilowania Network→JS/obrazy po stronie klienta (nie zrobione w tym pomiarze).

**Do rewery priorytetowo (wada przyrządu, nie potwierdzona ani zaprzeczona dziś):** Tools
(`/discovery-tools`) — jedyny ekran z **potwierdzonym FAIL zarówno 10.09 (ręcznie, ~3,75-4,5s), jak
i dziś (sygnał pośredni: 0 żądań API przechwyconych w 20s — coś nie odpowiada normalnie)** —
najpilniejszy kandydat na realny pomiar metodą 10.09 (zegarek + zrzut), nie samym `networkidle`.

## Bezpośrednie zapytania API (Bearer, poza nawigacją stron)

3 przebiegi każde, mediana z `curl -w '%{time_total}'`:

| Endpoint | Przebieg 1 | Przebieg 2 | Przebieg 3 | Mediana |
|---|---|---|---|---|
| `GET /api/initiatives` | 7,12 s | 6,75 s | 0,89 s | **6,75 s** |
| `GET /api/decisions` | 2,67 s | 2,09 s | 0,76 s | **2,09 s** |
| `GET /api/tasks` | 2,89 s | 6,00 s | 1,34 s | **2,89 s** |
| `GET /api/execution-control/capacity/resource-plan?weeks=12` | 1,03 s | 2,75 s | 2,50 s | **2,50 s** |
| `GET /api/my-work/inbox/canonical/stats` | 0,78 s | 2,57 s | 1,49 s | **1,49 s** |
| `GET /api/megatrends/baseline?industry=Industrial%20Manufacturing` | 1,54 s | 2,99 s | 2,56 s | **2,56 s** |

Uwaga: `/api/capacity/resource-plan` w treści zlecenia miało wołanie z `projectId` — w kodzie
(`src/services/execution/resourcePlanApi.ts:83`) rzeczywisty parametr to `weeks`, nie `projectId`;
zmierzono realne wołanie z kodu, nie z opisu zlecenia. `/api/my-work/inbox` (goły endpoint) nie istnieje
w `src/services/api.ts` — najbliższy odpowiednik listy/agregacji to `/my-work/inbox/canonical/stats`;
zmierzono ten.

**Wysoka wariancja pojedynczych wywołań** (np. initiatives 0,89–7,12 s na TEJ SAMEJ trasie, tych samych
danych, kolejne wywołania) — powtarza obserwację z 10.09 ("wysoka WARIANCJA... wskazuje raczej na coś
współdzielonego i niestabilnego, cache/connection warm-up, kolejkowanie zapytań startowych" —
`evidence/p16-wydajnosc-20260910/POMIAR.md`). Pierwsze wywołanie po dłuższej przerwie jest
systematycznie najwolniejsze — spójne z zimnym połączeniem DB/poolem po stronie serwera, nie z samym
zapytaniem.

## Megatrendy

**PASS — 200.** `GET /api/megatrends/baseline?industry=Industrial%20Manufacturing` → **200**, 5337 B,
3 przebiegi 1,54/2,99/2,56 s (mediana 2,56 s). 10.09 ten sam endpoint zwracał **503** dla
`industry=automotive` (branża zaszyta na sztywno w kliencie, `MegatrendsWorkspace.tsx:44`). Naprawione
commitem `e7ec2f8ac1` („fix(megatrendy): default industry from org, general fallback instead of 503",
10.09 wieczorem, ODMROZENIE 03_TOOLS DEC-463) — branża domyślna czytana teraz z
`organizations.industry`, fallback na `'general'` zamiast twardego `'automotive'`. Potwierdzone dziś
na żywo: kryterium „Megatrendy 200" **SPEŁNIONE**.

## Ograniczenia pomiaru

- `networkidle` mierzy inny moment niż „widoczna treść" (pomiar 10.09) — może zawyżać czas na ekranach
  z długo działającym pollingiem/websocketem w tle nawet gdy treść jest już widoczna.
- Pojedyncza sesja/organizacja (Northwind) — te same dane co pomiar 10.09, więc porównanie jakościowe
  (który ekran jest wolny) jest wiarygodne, ale absolutne liczby zależą od chwilowego obciążenia
  współdzielonego stagingu (nie jest to izolowane środowisko).
- Nie naprawiano niczego — zgodnie ze zleceniem, to WYŁĄCZNIE pomiar.
