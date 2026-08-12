# Results Next — CHECKPOINT / HANDOFF (controlled freeze)

> Dokument opisuje stan **zmierzony**, nie zamierzony. Każde twierdzenie ma
> komendę, którą integrator może je odtworzyć bez zaufania do autora.

---

## Tożsamość pracy

| | |
|---|---|
| **Moduł** | Results Next (KPI · ROI · OKR), fale RN-G5 i RN-G6 |
| **Właściciel** | sesja orkiestratora (Opus) w imieniu Piotra |
| **Worktree** | `/Users/piotrwisniewski/rn-g2-lanes/g5-integration` |
| **Branch** | `rn-g5-integration` |
| **HEAD** | `177104d40987fd46b8f33cb2865f2fae73d2f21c` |
| **Baseline** | `codex/results-vnext-g0-20260809` @ `8b03e2dba59055cd9abc74b48cea2990d12c0d3b` |
| **Upstream** | **NONE** — `git rev-parse @{u}` zwraca `no upstream configured` |
| **Ahead/behind vs baseline** | 153 / 0 |
| **Ahead/behind vs `origin/demo`** | 492 / 2 |
| **Osiągalność z remote** | **NIE ZWERYFIKOWANA** — `git branch -r --contains HEAD` pusty; gałąź nigdy nie była wypchnięta (push zabroniony) |
| **Stan drzewa** | **CLEAN** — `git status --porcelain=v2 --branch` zwraca wyłącznie nagłówek gałęzi |

**Trwałość checkpointu**: gałąź jest zwykłym refem w współdzielonym katalogu
`.git` repozytorium, osiągalnym z każdego worktree tego repo. **Nie zależy od
brudnego worktree** — drzewo jest czyste. Istnieje jednak **wyłącznie lokalnie**.

---

## Zakres

153 commity w 22 pakietach scalonych `--no-ff`, 698 zmienionych plików.

Rozkład: `docs/` 433 · `tests/` 123 · `server/src/` 61 · `src/components/` 56 ·
`dev-render/` 12 · `scripts/` 10 · `src/routes/` 2 · `src/services/` 1.

Pełna lista: `docs/product/results-vnext/RN_G6_CHANGED_FILES_MANIFEST.txt`
(698 wierszy). Odtworzenie:
```
git diff --name-only 8b03e2dba5..177104d409
```

### Pakiety (commity scalające)
```
git log --oneline --merges 8b03e2dba5..177104d409
```
Dziesięć torów RN-G5: `harness` · `polish2` · `kpicreate` · `deeplink` ·
`scopegap` · `teresa` · `interactive` · `crossdomain` · `platform` · `authz`.
Dwanaście pakietów RN-G6: P0-A · P0-C · naprawa ról · fikstury akceptacyjne ·
odbiór akceptacyjny · audyty A1 i A2 · kontrakt zdarzeń A3 · środowisko
uruchomieniowe · złoty przepływ KPI · **P0-D** · dokumentacja.

---

## Pliki wspólne i kolizyjne — DOKŁADNIE CZTERY

Powierzchnia kolizji jest celowo minimalna. **Zero** dotknięć:
`src/components/standard/**` · `src/components/shared/**` · `RowActionsMenu` ·
`StandardTable` · `StandardPreview` · `TableWithPreviewLayout` · `PreviewPane` ·
`server/migrations/**` · `Dockerfile` · konfiguracja Railway · `package.json` ·
`tsconfig*`.

| Plik | Dlaczego zmieniony | Kontrakt | Przenośny selektywnie? | Kolizja z |
|---|---|---|---|---|
| `src/services/apiUtils.ts` | **P0-D**: `X-Correlation-ID` generowany jako `Math.random().toString(36)` — nie UUID — trafiał do kolumny `UUID NOT NULL`, przez co **każdy zapis w Results Next zwracał 500** w świeżej sesji | kolumna `rvn_platform_events.correlation_id UUID NOT NULL` | **TAK** — samodzielna zmiana generatora + odrzucenie nieprawidłowej wartości z `sessionStorage` | dowolny moduł czytający ten nagłówek; zasięg zbadany: to **jedyna** kolumna typu UUID dla tego nagłówka w repo, reszta `TEXT` |
| `src/components/ui/primitives/Modal.tsx` | modal otwarty z trwałego CTA Menu 2 gubił fokus na `<body>` po Esc; modale z kebaba działały poprawnie | handbook §11 „focus return po preview/popover/dialog" | **TAK** | **36 konsumentów**, w tym 10 poza Results Next — przetestowane 13 plikami / 59 testami + 3 nowe testy regresyjne dla konsumentów bez pokrycia |
| `src/routes/AppRoutes.tsx` | montaż tras: pełne narzędzia ROI/OKR, `PIR_OUTCOMES`, `/results/attention` | master plan §11, D03 (klasa L) | **TAK** — zmiany addytywne | każdy moduł dodający trasy; historycznie konflikt addytywny |
| `src/routes/routeConfig.ts` | stałe tras (były zadeklarowane, nigdy zamontowane) | master plan §11 | **TAK** — addytywne | jw. |

### Serwer poza własnym zakresem — dwa pliki

| Plik | Dlaczego | Decyzja integratora? |
|---|---|---|
| `server/src/utils/platformRoles.ts` | **P1**: `normalizePlatformRole(membershipRole) \|\| userRole` — lewa strona zawsze prawdziwa (nienullowalny typ zwrotny), więc fallback był **martwym kodem**; użytkownik bez wiersza członkostwa tracił rolę i odbijał z `/results/*` na `/interview` | **TAK** — funkcja ról używana w całej aplikacji. Wszyscy wywołujący sprawdzeni; jedyny importer to `auth.routes.ts` i nie bierze zmienionej funkcji |
| `server/src/services/v8/teresaCopilotService.ts` | realny caller produkcyjny bramkowanych komend KPI; bez pola `access` `tsc` nie kompiluje, a runtime rzucałby `TypeError` | **NIE** — konieczność, 26 linii, same dodania w 3 miejscach |

Własny zakres serwera: `server/src/services/resultsVnext/**` (45 plików),
`server/src/routes/resultsVnext/**` (13 plików).

---

## Zmiany spoza zakresu / obce

**NONE w checkpointcie.**

Pięć plików **równoległej sesji** pozostaje nietkniętych w worktree bazowym
`.../consultify-results-vnext-g0-20260809` i **nie wchodzi** do tej gałęzi:
```
server/src/database/PostgresDatabase.ts                                   (M)
tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts    (M)
tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts            (M)
tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts (M)
server/migrations/20260810_fix_initiatives_status_default.sql             (??)
```
Zweryfikowane: `grep` po liście plików zmienionych przez **wszystkie dziesięć
torów** — zero trafień. Nie utworzono trzeciej konkurencyjnej naprawy
`initiatives.status`.

---

## Znane defekty

### Otwarte, w zakresie Results Next
1. **Brak zakładki historii KPI** — żaden endpoint historii nie istnieje.
2. **Brak interfejsu tworzenia karty wyników** — komponent gotowy, świadomie
   niezacommitowany (zero importerów łapie `check-gestosc`); wpięcie opisane w
   `RN_G5_SCOPEGAP_DESIGN.md` §2.
3. **Nawigacja wewnątrz aplikacji gubi flagę domenową** — powrót wymaga adresu
   z parametrem.
4. **Do `/results/*` dociera wyłącznie OWNER i ADMIN**; MEMBER/CONSULTANT/GUEST
   odbijają na `/interview`. Blokuje wykonanie macierzy ról z handbooka §11.
5. **Zakładka kontraktu bez danych definicji**, brak pola kadencji i właściciela,
   wybór KPI pokazuje surowy identyfikator.
6. **Zniekształcony payload migawki wywala listę przeglądów**
   (`kpiScorecardRepository.ts:153`).
7. **D08/B2 niezamknięte**: powód `not_calculable` nie jest persystowany dla
   Zestawu OKR ani check-inu — `null` i „nieobliczalne" renderują się identycznie.
8. **Brak trasy dyspozycji szkicu Teresy dla refleksji OKR** (ROI ma).
9. **Luki B3**: brak `GET` dla działań korygujących i weryfikacji skuteczności;
   brak odwrotnego `kpi → scorecards`; **brak trasy `listScenarioOverrides`** —
   nadpisanie scenariusza ROI da się zapisać i **nie da się odczytać**.
10. **P2**: pozycja destrukcyjna `disabled` w kebabie czyta się jako aktywna
    (przyczyna w `RowActionsMenu.tsx` — komponent wspólny, **świadomie
    nietknięty**, przekazany do osobnej sesji właściciela).

### Poza Results Next — zgłoszone, NIE naprawione
11. **`BROKEN_RUNTIME_CONTRACT` bramki decyzji inicjatywy** — pięć przejść cyklu
    życia strukturalnie niewykonalnych przez realnego użytkownika. Zapis idzie do
    starej tabeli `decisions`, odczyt do nowej `initiative_lifecycle_gate_decisions`;
    jedyna funkcja pisząca do nowej nie ma callera w trasach. Pusty `catch`
    maskuje błędy infrastruktury jako brak decyzji.
12. **Fałszywy sukces w Manager Cockpit** — akcja „unblock"
    (`managerActionExecutionService.ts:314-321`) ustawia status `IN_PROGRESS`,
    **nieistniejący** w `initiatives_status_check`; `DbPromise.run()` połyka błąd
    SQL, kod nie sprawdza wyniku → **HTTP 200 „Initiative moved out of blocked
    state" przy zerowym efekcie**.
13. **Defekt parytetu migracji** — `report_builder_reports.source_refs_json`
    istnieje tylko w `server/migrations-v2/`, niepodłączonym do
    `migrate.postgres.ts`; **każda świeża instalacja wg udokumentowanej procedury**
    ma zepsute `POST /api/results/kpi-reports`.
14. **`initiatives.status DEFAULT 'step3'`** łamie własny CHECK (bloker B4,
    naprawa należy do równoległej sesji) — 26 plików `tests/resultsVnext` pada w
    `beforeAll`.

---

## Blockery kandydata

- **Macierz UI/CX (handbook §11–13) NIE została wykonana** na żadnym SHA.
- **Złote przepływy ROI i OKR NIE zostały przejechane** od początku do końca na
  realnych danych. KPI: 14/20 kroków, 4 trwale zablokowane defektami 1–6 wyżej.
- **Defekt #4** (dostęp tylko OWNER/ADMIN) uniemożliwia macierz siedmiu ról.
- **D08/B2** wymaga decyzji właściciela albo zmiany w `server/**`.

---

## Czego dowody NIE dowodzą

- **Zrzuty z harnessu `dev-render` nie są dowodem o endpointach ani trwałości** —
  harness podstawia warstwę sieciową. Dowodem tego jest P0-D: dziewięć torów,
  ~250 zrzutów i dziesiątki raportów „kliknąłem i działa" **nie mogły zobaczyć**,
  że każdy zapis zwraca 500, bo identyfikator korelacji nigdy nie docierał do bazy.
- Testy przekrojowe wołają komendy **bezpośrednio, w procesie** — bez HTTP, bez
  middleware uwierzytelniania, bez walidacji żądania.
- **Nie wiadomo, ilu realnych klientów** dotyczą defekty 11–14. Zbiory są zasiane
  skryptem, nie skopiowane z demo.
- Izolacja tenantów kart wyników jest **warstwowa** — zielona kontrola negatywna
  na jednej linii **nie dowodzi**, że to punkt egzekwowania.
- `dev-render/` jest **poza zasięgiem `tsc`** (`"include": ["src","*.ts","*.tsx"]`).
- Cztery z 36 konsumentów `Modal.tsx` nie mają ani testu, ani ręcznej weryfikacji.
- Zrzuty ścieżki P0-A **nie zostały zapisane na dysk** (opisane, nie sfotografowane).

---

## Potwierdzenia

- **Nic nie wypchnięte.** Gałąź nie istnieje na żadnym remote.
- **Nic nie zmergowane do `demo`/`main`/`develop`.**
- **Nic nie wdrożone.** Zero zmian Railway.
- **Trzy flagi domenowe domyślnie OFF** — rozstrzygnięcie kończy się `return false`.
- **Brak `reset`/`clean`/`stash`/`checkout` przywracającego pliki.**
- **Brak usuwania worktree i gałęzi.**
- **Brak szerokiego `git add`** — każdy commit stage'owany po ścieżkach.
- `.claude/launch.json` **nigdzie nie zacommitowany** (plik wspólny między sesjami).

---

# AKTUALIZACJA — domknięcie zakresu po korekcie polecenia

Checkpoint z pierwszej części tego dokumentu opisywał stan na `177104d409`.
Po korekcie („checkpoint nie oznacza przerwania niedokończonej pracy") zakres
został **dokończony**. Poniżej trzy wymagane sekcje.

## REMAINING WORK AT START

Stan na `c5852ace32`, pozycje zakresu Results Next:

1. złoty przepływ **ROI** — nigdy nie przejechany end-to-end na realnych danych
2. złoty przepływ **OKR** — jw.
3. złoty przepływ **KPI** — 4 z 20 kroków zablokowane
4. brak endpointu **historii KPI**
5. **tworzenie karty wyników** — komponent gotowy, niewpięty
6. **nawigacja gubi flagę** domenową
7. zakładka kontraktu bez danych; brak pola kadencji i właściciela; surowy identyfikator w wyborze KPI
8. zniekształcony payload migawki wywala listę przeglądów
9. **D08/B2** — powód `not_calculable` niepersystowany dla Zestawu OKR i check-inu
10. **B3** — brak `GET` działań korygujących, `kpi→scorecards`, `listScenarioOverrides`, punktu odkrycia `cadenceOccurrenceId`
11. brak trasy dyspozycji szkicu Teresy dla refleksji OKR
12. trzy punkty wpięcia z toru zakresu
13. zrzuty ścieżki P0-A niezapisane na dysk
14. **macierz UI/CX** — nie wykonana na żadnym SHA
15. **pakiet dowodowy**

## COMPLETED IN THIS RUN

| # | Pozycja | Dowód |
|---|---|---|
| 1 | ROI 24/24 kroki, **6 defektów naprawionych** | `RN_G6_C2_ROI_GOLD_FLOW.md` |
| 2 | OKR 20/20 kroków, **2 defekty naprawione** | `RN_G6_C3_OKR_GOLD_FLOW.md` |
| 3 | KPI — odblokowany przez P0-D, ścieżka poprawki potwierdzona | `RN_G6_EVIDENCE_PACKET.md` |
| 4 | historia KPI — **N/A**, brak endpointu po stronie serwera; zgłoszone | `RN_G6_UIFIX.md` |
| 5 | modal karty wyników wpięty, realne `201 Created` | `RN_G6_UIFIX.md` |
| 6 | flaga przeżywa nawigację — naprawiona **przyczyna**, nie objaw | `RN_G6_UIFIX.md` |
| 7 | zakładka kontraktu z realnymi danymi; identyfikator rozwiązywany na nazwę | `RN_G6_UIFIX.md` |
| 8 | UI **już był odporny** — potwierdzone wstrzyknięciem złego wiersza | `RN_G6_UIFIX.md` |
| 9 | D08 zamknięte migracją **addytywną** | `RN_G6_SRV_GAPS.md` |
| 10 | trzy trasy odczytu dodane | `RN_G6_SRV_GAPS.md` |
| 11 | trasa dyspozycji Teresy dla OKR dodana | `RN_G6_SRV_GAPS.md` |
| 12 | wpięte albo potwierdzone jako już obecne | `RN_G6_UIFIX.md` |
| 13 | 8 zrzutów + weryfikacja **programowa** kopiowania pól | `RN_G6_EVIDENCE_PACKET.md` |
| 14 | macierz wykonana, **8 znalezisk**, 29/30 kontrastu AA | `RN_G6_UICX_MATRIX.md` |
| 15 | pakiet zbudowany z cytatów z 13 raportów | `RN_G6_EVIDENCE_PACKET.md` |

**Ponadto, znalezione i naprawione w trakcie:** P0-D (cała powierzchnia zapisu
zwracała 500), maker-checker nieużywalny dla drugiego recenzenta, refleksja OKR
permanentnie niezapisywalna, utrwalanie stanu rejestru KPI wraz z ujawnionym
przez nie defektem deep-linku, dwa wycieki notatek deweloperskich do interfejsu,
zdublowany prefiks w powodach blokady.

## REMAINING WORK AT END

**Zakres modułu Results Next: NONE.**

Pozostają wyłącznie **udowodnione zależności poza zakresem modułu**, każda z
reprodukcją, żadna nienaprawiona jednostronnie:

| # | Pozycja | Dlaczego poza zakresem | Dokument |
|---|---|---|---|
| Z1 | do `/results/*` dociera wyłącznie OWNER i ADMIN | decyzja właściciela o modelu dostępu; blokuje macierz siedmiu ról | `RN_G6_B3_ROUTE_INVENTORY.md` |
| Z2 | zerwana bramka decyzji cyklu inicjatyw + **fałszywy sukces** w Manager Cockpit | moduł Inicjatyw; naprawa samych fikstur zamaskowałaby zagrożenie realnych danych | `RN_G6_A2_*.md` |
| Z3 | defekt parytetu migracji — świeża instalacja bez kolumny | Report Builder + mechanizm migracji | `RN_G6_A1_*.md` |
| Z4 | `FilterableTable`: brak `aria-sort`, brak obcinania nagłówka | komponent **wspólny**, dotyczy całej aplikacji | `RN_G6_UICX_MATRIX.md`, `RN_G6_OKRTEXT.md` |
| Z5 | wyszarzona pozycja destrukcyjna w kebabie | `RowActionsMenu.tsx` — **równoległa sesja właściciela** | `RN_G5_POLISH_EVIDENCE.md` |

**Luki w dowodach, świadomie niezamknięte** (nie defekty, granice pokrycia):
stany zapisywania i konfliktu (żeby nie zepsuć współdzielonych danych) · pułapka
fokusu w prawdziwym dialogu · pstryczek kolumn i zaznaczenie wielokrotne ·
kontrast wewnątrz pełnych narzędzi · `prefers-reduced-motion` · uzgodnienie ROI
z Finansami · pełne zamknięcie ROI z trzecim aktorem · macierz ról dla ról
niedostępnych (Z1).

## BRAMKI NA FINALNYM SHA `152529c1a7`

| Bramka | Wynik |
|---|---|
| `tsc --noEmit` (root) | **exit 0, 0 błędów** |
| `tsc --noEmit -p server` | exit 1, **18 błędów, wszystkie w `roiCalculationEngine.ts`** — przedistniejąca baza, zero nowych |
| `git diff --check` | **exit 0** |
| `check-list-canon.sh` | **408 przy baseline 409** — dług spadł |
| `check-artefakt.sh` | **7 przy baseline 7** — bez zmian |

Zakres: **191 commitów, 904 pliki** wobec baseline `8b03e2dba5`.
