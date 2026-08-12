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
