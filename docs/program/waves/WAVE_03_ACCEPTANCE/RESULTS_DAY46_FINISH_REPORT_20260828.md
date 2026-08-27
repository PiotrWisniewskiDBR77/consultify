# RESULTS Day 46 — raport wewnętrznego domknięcia (day46-finish)

Data wykonania: 2026-08-27/28
Gałąź: `day46-finish-b-20260828` (pushed do `github-backup`), oparta na tipie `codex/results-day46c-20260828` (`00e2753eba`)
Commity wykonawcze: `4ce00bf5c9` (F.2) → `4b0c5a8ec6` (D.2) → `4f0f38f2bd` (E.1) → `846d38990a` (G.1)
Nadzorca: Fable/Sonnet, sesja wewnętrzna (nie Codex)

## Zmiana punktu wyjścia w trakcie sesji

Sesję zaczęto od gałęzi `codex/results-day46b-20260828` i wykonano tam C.1/C.2
(fixes dla ROI next-action i OKR owner-name — commity `a5f515678d`,
`da8883909d` na gałęzi `day46-finish-20260828`). W trakcie pracy nadzorca
przekierował na `codex/results-day46c-20260828` (kontraktor dowiózł
równoległą partię C.1/C.2 + częściowe D.2 + G.1 + R.1). Commity
`day46-finish-20260828` **zostały porzucone jako zduplikowane/nadpisane**
przez day46c — NIE cherry-pickowane, bo dotykały tych samych plików
(`roiRegistryPresenters.tsx`, `okrRegistryPresenters.tsx`,
`ResultsOkrHub.tsx`) innym podejściem niż kontraktor. Gałąź
`day46-finish-20260828` pozostaje wypchnięta na `github-backup` jako
zapis pracy, ale nie jest podstawą tego raportu.

Priorytet 1 przesunięto na **F.2 (izolacja najemcy)** na wyraźne polecenie
nadzorcy — patrz sekcja F.2 poniżej.

## Stan pozycji — tabela zbiorcza

| Pozycja | Stan wejściowy (day46c) | Stan po tej sesji | Dowód |
|---|---|---|---|
| F.2 | `NIE_ZACZĘTE` (0/135) | **Realna dziura bezpieczeństwa znaleziona i naprawiona**; 4/135 mutatorów, 3/9 rodzin dowiedzione mutacyjnie | `4ce00bf5c9` |
| D.2 | `CZĘŚCIOWO` (brak 5 scenariuszy HTTP + 5 zrzutów) | **ZAMKNIĘTE** — 5/5 scenariuszy realnym Gatewayem, 5 zrzutów (light/dark/empty/error) | `4b0c5a8ec6` |
| E.1 | `NIE_ZACZĘTE` | **ZAMKNIĘTE** — jedna nowa flaga, link do Raportu Zarządczego, zweryfikowany wizualnie ON/OFF | `4f0f38f2bd` |
| G.1 | `CZĘŚCIOWO_ZWERYFIKOWANE` (brak odczytów przez Gateway) | **ZAMKNIĘTE** — 3/3 odczyty realnym Gatewayem seeda RN-G6 | `846d38990a` |
| D.1 | `NIE_UKOŃCZONE` | **Inwentarz sporządzony** (agent badawczy, patrz niżej) — werdykty per plik, kilka pozycji per-route dla plików wskazanych jako podejrzane | ten raport, sekcja D.1 |
| F.1 | `NIE_ZACZĘTE` | Pokryte tym samym inwentarzem co D.1 (te dwie pozycje w praktyce się pokrywają — „inwentarz tras" i „inwentarz powierzchni bez wołających" to to samo ćwiczenie) | ten raport, sekcja D.1 |
| C.1/C.2 | `WYMAGA_NAPRAWY` / `CZĘŚCIOWO_NAPRAWIONE` | **BEZ ZMIAN** — zgodnie z poleceniem nadzorcy, priorytet przesunięty na F.2 | — |

## F.2 — izolacja najemcy (priorytet 1)

### Co znaleziono

`proposeInitiativeKpiImpact` (`server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts`)
jest jedynym CREATE w tym pliku bez wcześniejszego `loadForUpdate` — `kpiId`
przychodzi wprost z body żądania. Jego lokalny `loadKpiOwnerUserId` **nie
filtrował po `organization_id`** — w przeciwieństwie do KAŻDEGO analogicznego
helpera w programie (`addScorecardItem` w `kpiScorecardCommands.ts`,
`loadRoiCaseOwnerUserId` we wszystkich 4 plikach ROI). `assertCommandCapability`
przepuszcza każdego OWNER/ADMIN przez `ADMIN_UNRESTRICTED_SENTINEL`/`'*'`
niezależnie od tego, czyja jest nazwana KPI (zweryfikowane w
`effectiveAccessService.ts`) — więc luka była realnie wykorzystywalna:
OWNER/ADMIN organizacji B mógł wskazać prawdziwe `kpiId` organizacji A i
dostać wstawiony wiersz `rvn_kpi_initiative_impacts` z `organization_id`=B,
`kpi_id`=A (FK na `kpi_id` wymaga tylko istnienia KPI GDZIEKOLWIEK, nie
zgodności organizacji).

**Dowód mutacyjny (N1):** po odtworzeniu starego (nieskopowanego) zapytania
żądanie zakończyło się `201`, a ciało odpowiedzi pokazało dokładnie ten
mismatch: `"organizationId":"rn-g6-org-doradztwo"` (org B) razem z
`"kpiId":"4d5db4f2-...` (prawdziwe KPI org A). Po przywróceniu poprawki:
`409 KPI_NOT_FOUND`, brak wiersza w bazie (odczyt niezależnym połączeniem).

### Naprawa

`loadKpiOwnerUserId` przyjmuje teraz `organizationId` i filtruje po nim;
brak wiersza w organizacji wołającego rzuca `KpiInitiativeImpactValidationError`
`KPI_NOT_FOUND` (409) — dokładnie ten sam kod/status co istniejący wzorzec
`addScorecardItem`, więc handler trasy nie wymagał zmian. Kształt tabeli
`rvn_kpi_initiative_impacts` NIETKNIĘTY (tylko zapytanie). Pozostałe 3
analogiczne helpery w pakiecie KPI (`kpiDefinitionCommands.ts`,
`kpiMeasurementCommands.ts`) zbadane osobno — bezpieczne, bo zawsze
otrzymują `kpiId` z JUŻ zeskoptowanego `currentRow`, nigdy z surowego body.

### Dowód izolacji — 4 punkty końcowe, 3 rodziny

`tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts`
(4/4 PASS, realny `ApiGateway`, realny PG,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `--retry=0`, realny
fixture RN-G6 dwóch organizacji):

- **N1** (KPI, propose initiative-impact) — naprawiona luka powyżej.
- **N2** (KPI, `PUT /:kpiId/draft`) — już poprawne; dowód mutacyjny wymagał
  złamania JEDNOCZEŚNIE bramki trasy (`getKpi` org-scoped) I warstwy
  komendy (`loadDefinitionVersionForUpdate` org-scoped) — złamanie tylko
  jednej z nich nie dawało czerwieni (podwójna ochrona, realnie
  potwierdzona empirycznie, nie założona).
- **N3** (ROI, `POST /cases/:caseId/transitions/start-modeling`) — jak N2;
  po złamaniu obu warstw żądanie dotarło do walidacji stanu biznesowego
  (`409` zamiast `404`) — dowód, że bramka faktycznie coś blokuje.
- **N4** (OKR, `PATCH /programs/:programId/draft`) — jak N2; po złamaniu
  obu warstw org B **realnie nadpisał** nazwę programu org A
  (`"outcome":"applied"`, `updatedBy: rn-g6-user-b-admin`,
  `organizationId: rn-g6-org-przemysl`) — najsilniejszy możliwy dowód.

Po każdym dowodzie: przywrócenie kodu, ponowne uruchomienie → zieleń
(4/4). Jeden przypadkowo zmutowany wiersz (nazwa programu OKR org A)
przywrócony przez czysty, idempotentny re-seed RN-G6 (potwierdza przy
okazji idempotencję seeda po raz trzeci).

### Uczciwy mianownik

**4/135 mutatorów, 3/9 rodzin** (KPI, ROI, OKR) mają dowód izolacji.
**Nie pokryte**: KPI legacy, ROI legacy, OKR legacy, KPI deviation-cases,
KPI scorecards (5/9 rodzin, ~131/135 mutatorów pozostałych). Nie wolno na
tej podstawie twierdzić, że reszta modułu jest wolna od wycieku
międzyorganizacyjnego — dowiedziono tylko tych 4 konkretnych punktów.

## D.2 — Search: 5 scenariuszy HTTP + 5 zrzutów (ZAMKNIĘTE)

`tests/integration/results/day46.search-gateway-scenarios.realpg.test.ts`
(5/5 PASS, realny Gateway/PG/enforce): hit, empty, q&lt;2, invalid cursor
(400 `INVALID_CURSOR`), foreign tenant (org B zapytanie dokładnym tytułem
KPI org A → zero trafień).

Nowy harness `dev-render/screens/results-vnext-search-registry.tsx`
montuje REALNY `<ResultsSearchRegistry>` (ten sam komponent co
`ResultsKpiRegistryPage.tsx` przy `?resultsView=search`), zarejestrowany w
`dev-render/main.tsx`. 5 zrzutów w
`docs/qa/screens/results-day46-finish/search/` (skrypt jednorazowy
`scripts/day46-finish-search-screenshots.mjs`, Playwright): krótkie
zapytanie (uczciwy stan „wpisz min. 2 znaki"), wyniki jasny, wyniki ciemny
(`&theme=dark` — potwierdzone realnie przełącza klasę `.dark`, nie
`prefers-color-scheme`), pusty (odrębny tekst od krótkiego zapytania —
zweryfikowałem osobiście przed napisaniem tego zdania), błąd 503.

**Obserwacja nierozwiązana**: zrzut stanu błędu (`05-blad-light.png`) nie
pokazuje nagłówków kolumn tabeli, podczas gdy stan pusty je zachowuje —
TRIADA §2.2 wymaga nagłówków w OBU stanach. Może to być zachowanie
współdzielone przez `StandardTable` we wszystkich rejestrach vNext, nie
tylko w Search — nie zbadane głębiej, zgłaszam jako obserwację dla osoby
prowadzącej odbiór właścicielski, nie jako naprawione.

## E.1 — wejście do raportu zarządczego (ZAMKNIĘTE)

Jedna nowa flaga `managementReportEntry` (domyślnie OFF wszędzie, ten sam
konserwatywny kształt co `resultsSearch`). Wpięta centralnie w
`ResultsVNextRegistryShell.tsx` (nie per-domena) — jedna zmiana pokrywa
KPI/ROI/OKR/Search jednocześnie. Realny `<a href={ROUTES.REPORTS.MANAGEMENT}>`
(NIE `useNavigate()` — dwa istniejące testy montują tę powłokę bez
przodka-Routera; wersja z `useNavigate()` je łamała, cofnięta). Zero zmian
w `src/components/Reports/Management/**`, `ManagementReportRepository.ts`,
`managementReportsService.ts` — poza zakresem tego dyżuru.

Zweryfikowane wizualnie (harness dev-render,
`?screen=results-vnext-kpi-registry`): link obecny z
`?ff_resultsVNextManagementReportEntry=1`, nieobecny z `=0` — realny
przełącznik. 25/25 testów przechodzi (3 nowe + 22 istniejące niezmienione,
w tym oba testy powłoki bez Routera).

## G.1 — odczyt seeda przez realny Gateway (ZAMKNIĘTE)

`tests/integration/results/day46.seed-readback.realpg.test.ts` (3/3
PASS): `GET /api/vnext/results/kpi`, `/roi/cases`, `/okr/sets`
uwierzytelnione jako realny seedowany OWNER org A zwracają niepuste listy
zawierające deterministyczne ID-y z manifestu seeda RN-G6.

**Nie pokryte**: zrzut KPI z seeda przez PEŁNĄ aplikację (nie harness) —
wymagałoby jednoczesnego uruchomienia backendu i frontendu, poza zakresem
tego pliku testowego. Istniejące zrzuty `docs/qa/screens/results-day46/`
pokazują dane z mock-harnessu, nie z tego seeda.

## D.1 / F.1 — inwentarz powierzchni/tras (agent badawczy)

Zlecono osobnemu agentowi wyczerpujący przegląd plików tras `resultsVnext`
(poziom pliku) + szczegółowy przegląd per-trasa dla
`kpiPerspectives.routes.ts` i plików bez żadnego wołającego. Pełne
komendy grep i cytaty linii — patrz transkrypt sesji; poniżej streszczenie
werdyktów.

### Najważniejsze odkrycie

`src/components/Results/ResultsHub.tsx` (stare drzewo komponentów, wołające
wszystkie 6 rodzin legacy `/api/results*`) **nie jest importowane ani
renderowane NIGDZIE osiągalnym w aplikacji**. `/results` renderuje
`<ResultsOwnerReviewEntry />`, która robi `<Navigate to={ROUTES.RESULTS_KPI.ROOT}
replace />` z komentarzem „The retired ResultsHub must never reappear".
Skutek: całych 6 rodzin legacy (`/api/results`, `/api/results-v4`,
`/api/results-value`, `/api/results-strategic`, `/api/results-driver-tree`,
`/api/results-extended`, ~51 tras razem) ma technicznie istniejący kod
wołający, ale ten kod jest martwy — nieosiągalny przez żadnego
użytkownika. Werdykt dla całej tej grupy: **DO_DECYZJI_WŁAŚCICIELA** (nie
„PODŁĄCZ" mimo istnienia wołającego, bo wołający sam jest martwy; nie
prosty „USUŃ" bo to ~90 tras + cały katalog `src/components/Results/` —
decyzja architektoniczna, nie punktowa naprawa).

### Konkretne, bezpieczne kandydaci `USUŃ` (brak wołającego NAWET w martwym drzewie)

1. `GET /api/vnext/results/kpi/my` (`kpiPerspectives.routes.ts:247`) —
   brak jakiejkolwiek funkcji klienckiej, nie tylko brak wywołania.
2. `GET /api/vnext/results/initiatives/:initiativeId/kpi-impacts`
   (`kpiPerspectives.routes.ts:519`) — potwierdza tezę 5 pierwotnej
   instrukcji Codexa; nadal `grep -rn "kpi-impacts" src` = pusto.
3. `GET /kpi/:kpiId/trend`, `/history`, `/next-obligation`
   (`kpi.routes.ts:433,469,496`).
4. `GET /kpi/scorecards/for-kpi/:kpiId` (`kpiScorecard.routes.ts:459`).
5. `POST /roi/visibility-policy`, `POST /roi/finance-owner-grants`
   (`roi.routes.ts:3172,3204`).
6. `PATCH /roi/cases/:caseId`, `POST /roi/cases/:caseId/archive`
   (`roi.routes.ts:672,726`).
7. `GET /okr/sets/:setId/attention`, `.../check-in-summary`
   (`okr.routes.ts:3440,3488`).
8. Wszystkie 8×3=24 trasy szczegółowe (nie-index) w
   `kpiLegacyArchive.routes.ts`/`okrLegacyArchive.routes.ts`/
   `roiLegacyArchive.routes.ts` — jawnie udokumentowane jako poza
   zakresem w `legacyArchiveApi.ts:24-33`.
9. `GET /api/results/metrics-semantic-layer`, `GET /api/results/kpi-definitions`
   — nawet martwe drzewo `ResultsHub` ich nie woła.

### Rodziny/pliki z werdyktem PODŁĄCZ (wołający istnieje i jest osiągalny)

`search.routes.ts`, większość `kpi.routes.ts`, `kpiDeviation.routes.ts`,
większość `kpiScorecard.routes.ts`, większość `okr.routes.ts`, większość
`roi.routes.ts`, `roiPerspectives.routes.ts`, 6 z 8 tras
`kpiPerspectives.routes.ts` (attention, initiative-impacts CRUD).

### Rodziny z werdyktem PODŁĄCZ_PO_NAPRAWIE

3 pliki legacy-archive (`kpiLegacyArchive.routes.ts`,
`okrLegacyArchive.routes.ts`, `roiLegacyArchive.routes.ts`) — trasa
index jest wołana, ale jedyny konsument
(`ResultsVNextLegacyArchivePanel.tsx`) sam nigdy nie jest zamontowany.

Pełna tabela plik-po-pliku z liniami i komendami grep: patrz sekcja
„D.1 — inwentarz" w transkrypcie sesji roboczej tego dyżuru (agent
badawczy `Explore`, ~130k tokenów analizy, 83 wywołania narzędzi).

## Testy — mianownik (z `enforce`)

- `day46.mutator-tenant-isolation.realpg.test.ts`: 4/4 PASS
- `day46.search-gateway-scenarios.realpg.test.ts`: 5/5 PASS
- `day46.seed-readback.realpg.test.ts`: 3/3 PASS
- `registryShell.managementReportEntry.test.tsx`: 3/3 PASS (nowy)
- `resultsVNextFeatureFlags.test.ts`: 13/13 PASS (12 istniejących + 1 nowy)
- `registryShell.sampleBanner.test.tsx` + `ResultsVNextRegistryShell.focusEscape.test.tsx`: 9/9 PASS (bez zmian, potwierdzone brak regresji)
- `okrRegistryOwnerName.test.tsx`, C.1/C.2 testy: **NIE dotyczą tej gałęzi** — to praca z porzuconej `day46-finish-20260828`, nadpisana przez day46c

**Nie uruchomiono** szerokiego pakietu (684-testowego) ponownie — poza
zakresem tej sesji, priorytety były punktowe.

**Pre-istniejąca, niezwiązana usterka** (potwierdzona identyczna z i bez
mojej zmiany F.2):
`tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`
(3 testy) rzuca `CommandCapabilityDeniedError` w tym środowisku — nie
zbadane głębiej, nie moja regresja.

## Środowisko

- PG własny: `cx-fin46-pg`, port `5831`, baza `cx_fin46`, kontener
  usunięty po pracy (`docker stop/rm cx-fin46-pg`).
- Migracje: `NODE_ENV=test` (bypass lokalnego hosta) + `migrate.postgres.ts`
  — 858 migracji, pierwszy przebieg.
- Seed: `scripts/rn-g6-seed-runtime-dataset.ts`,
  `SEED_CONFIRM=YES_SEED_RN_G6_LOCAL` — uruchomiony 3× w trakcie sesji
  (raz na początku, dwa razy po celowych mutacjach F.2 do przywrócenia
  stanu), za każdym razem idempotentnie, identyczny manifest ID-ów.
- Każda komenda testowa: `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`
  w tej samej linii, `--retry=0` dla testów bezpieczeństwa/izolacji.
- `npm ci` we własnym worktree (`/private/tmp/finish-46b`) — bez
  symlinku do cudzego `node_modules`.

## Twierdzenia niezweryfikowane

- Nie zweryfikowano owner acceptance dla ŻADNEJ pozycji w tym raporcie.
- Nie zweryfikowano pozostałych 131/135 mutatorów F.2 (5/9 rodzin: KPI
  legacy, ROI legacy, OKR legacy, KPI deviation-cases, KPI scorecards) —
  jawnie NIE_POKRYTE, nie „prawdopodobnie bezpieczne".
- Nie zweryfikowano runtime produkcyjnego/demo/staging — zero połączeń
  poza własnym kontenerem `cx-fin46-pg` (Z28 przestrzegane).
- Nie zweryfikowano, czy TRIADA §2.2 (nagłówki w empty+error) jest
  faktycznie złamane wszędzie, czy tylko w moim nowym harness Search —
  obserwacja, nie potwierdzony defekt zakresowo.
- D.1/F.1: inwentarz sporządzony przez agenta badawczego na podstawie
  grepów tekstowych — dowodzi ISTNIENIA/BRAKU łańcucha wołającego, NIE
  osiągalności przez realny HTTP (żadna z tras D.1 nie została uderzona
  realnym żądaniem w ramach tego ćwiczenia, poza tymi już pokrytymi przez
  F.2/D.2/G.1 testy). Werdykty D.1 są więc na poziomie „PODŁĄCZ wg grepa",
  nie „PODŁĄCZ wg zmierzonego zachowania" — zgodnie z regułą programu
  „grep dowodzi istnienia łańcucha, nie że działa".
- Nie zweryfikowano C.1/C.2 dalej — świadomie porzucone na polecenie
  nadzorcy, pozostają `WYMAGA_NAPRAWY`/`CZĘŚCIOWO_NAPRAWIONE` z day46c.
- Nie uruchomiono pełnego pakietu 684 testów ponownie po zmianach —
  czerwony baseline z day46c (`155 PASS / 414 FAIL / 18 SKIPPED` server)
  pozostaje niezweryfikowany po tej sesji.

## Commity (kolejność chronologiczna)

1. `4ce00bf5c9` — fix(results): F.2 — naprawa realnej dziury cross-tenant + dowód izolacji 4 punktów
2. `4b0c5a8ec6` — feat(results): D.2 — 5 scenariuszy HTTP + 5 zrzutów Search
3. `4f0f38f2bd` — feat(results): E.1 — wejście do raportu zarządczego za flagą
4. `846d38990a` — test(results): G.1 — odczyt seeda przez realny Gateway
5. `MODULE_ACCEPTANCE.md` — nowy wpis `RES-PF-011` (ten commit, patrz git log)

Wszystkie na gałęzi `day46-finish-b-20260828`, wypchnięte na
`github-backup` po każdym commicie. Zero push na `origin`.
