# INSTRUKCJA DYŻURU nr 11 — Codex — „Execution (Realizacje): cztery raporty zarządcze wg kontraktu właściciela — EXE-WORK-REPORT-01, EXE-RESOURCES-REPORT-01, EXE-CONTROL-REPORT-01 i unijny generator EXE-REPORT-GENERATOR-01, za flagą OFF"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–10. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

Data wystawienia: 2026-08-25.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Poprzednie dyżury domykały inne moduły (Admin/My Work/Results/Finance/
Initiatives/Assessment/Meetings). **Ten dyżur ich nie kontynuuje.** To osobny
obszar budowy: **cztery raporty zarządcze w module Execution (Realizacje)**,
wg zaakceptowanego jako `EXPERT_SPEC_COMPLETE` kontraktu właściciela z uwag
`EXE-OWN-006` i `EXE-OWN-007`.

**Uwaga o numeracji.** Execution ma w repozytorium katalog rejestru
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/` i **tylko on jest
wiążący przy szukaniu plików**. Katalog `09_RESULTS` to **inny moduł** — nie
on jest przedmiotem tego dyżuru.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Cała nowa treść czterech raportów powstaje za JEDNĄ nową flagą, domyślnie
WYŁĄCZONĄ WSZĘDZIE (łącznie z demo). Przy OFF runtime Execution wygląda
i zachowuje się DOKŁADNIE tak, jak go zastałeś — co do piksela i co do
zdarzenia.**

1. **Powstaje dokładnie JEDNA nowa flaga (nazwa robocza `execReportsIntelligence`).**
   To jedyny wyjątek od zwyczajowego zakazu tworzenia flag i **wymaga imiennej
   zgody nadzorcy** — dopóki jej nie masz na piśmie, flaga jest pozycją otwartą
   `E-O2` (§1.7), a nie faktem. Każda **druga** nowa flaga = **STOP**.
2. **★ Wzorzec flagi to `changeSignals`, NIE domyślny fallback M14.** Plik
   `src/components/Execution/executionFeatureFlags.ts` ma DWA modele:
   - większość flag (`intelligence`, `ganttBaseline`, `whatIfSandbox`,
     `rolloutStages`, `benefits`, `summaryOneLook`) dziedziczy fallback D-D
     (`:116-120`) = **domyślnie ON wszędzie POZA produkcją publiczną**;
   - `changeSignals` (`:56-60`, `:105`, `:115`) jest **specjalnie wyłączona
     wszędzie, także na demo**, aż Piotr zaakceptuje czysty zrzut (reguła #7).
     **Twoja flaga MUSI iść wzorcem `changeSignals`** — inaczej nowe raporty
     wjadą właścicielowi na demo bez pstryczka. Skopiuj special-case z `:105`
     i `:115`, **nie** pozwól nowej fladze wpaść w fallback `:120`.
3. **★ Bramkujesz TREŚĆ raportów, nie powłokę Execution.** Powierzchnia
   list/kanban/preview/tabela Realizacje·Praca·Zasoby·Sterowanie·Raporty
   **jest solidna, na kanonie i zostaje** (`StandardTable`/`StandardPreview` —
   §2.9). Flaga włącza wyłącznie **nowe raporty-intelligence i unijny
   generator**. Rejestr definicji/uruchomień raportów w
   `ExecutionReportsSurface.tsx` **NIE jest przedmiotem przebudowy**.
4. **Dowód OFF jest częścią DoD każdej pozycji** (§0.4 pkt 10). Nie „chyba nic
   nie zmieniłem" — test renderujący ekran z flagą OFF i asertujący dzisiejsze
   zachowanie oraz **zero żądań** do nowych endpointów raportowych.
5. **Odbiór wizualny i włączanie flagi = właściciel, po dyżurze.** W raporcie
   piszesz „gotowe do zrzutu przez nadzorcę", **nigdy** „gotowe do włączenia
   flagi", **nigdy** „gotowe do pokazania właścicielowi".
6. Powód: CLAUDE.md reguła 7 (właściciel nigdy nie jest pierwszym testerem
   wizualnym) i reguła 9 (zakaz masowego włączania flag).

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.
   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main` ani z żadnej
   gałęzi `codex/preserve-*`/`codex/wave3-16-module-acceptance-*`. Załóż
   raport, wpisz pozycję STOP z wynikiem obu komend powyżej i zakończ dyżur.

3. **Sprawdź, że materiały wiążące faktycznie widzisz** (warunek wstępny):

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md   # oczekiwane 308
   grep -c "EXE-WORK-REPORT-01\|EXE-RESOURCES-REPORT-01\|EXE-CONTROL-REPORT-01\|EXE-REPORT-GENERATOR-01" \
     docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md          # >0
   wc -l src/components/Execution/executionFeatureFlags.ts                                   # oczekiwane 124
   ```

   Brak któregokolwiek = **STOP**.

4. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/execution-day11-<data> codex/m03-admin-20260824
   ```

   (Podmień `<data>` na format `YYYYMMDD`, np. `codex/execution-day11-20260825`.)

5. Pracujesz we **własnym worktree**, nigdy w cudzym:
   ```bash
   git worktree add /private/tmp/consultify-execution-day11 codex/execution-day11-<data>
   cd /private/tmp/consultify-execution-day11
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                     | Dlaczego                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź                                                                                                                                                                                                                                                                                                                       | Push wykonuje wyłącznie nadzorca sesji głównej                                                               |
| Z2      | **Nie dotykasz `origin/demo`** ani lokalnego `demo`                                                                                                                                                                                                                                                                                                                       | `demo` = święta baza deployu                                                                                 |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**                                                                                                                                                                                                                                                                         | Krach 3/4 powstał dokładnie tak                                                                              |
| Z4      | **NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików `PRESERVED_PRODUCT_WIP`/`NO_COPY`                                                                                                                                                                                                                                                                      | Wymagania są **już** przełożone na kontrakt `EXE-OWN-006/007`                                                |
| Z5      | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git diff`, ani `cat`**                                                                                                                                                                                                                                        | Chroniony, brudny worktree właściciela                                                                       |
| Z6      | **Nie dotykasz cudzych worktree** `/private/tmp/consultify-*` innych dyżurów                                                                                                                                                                                                                                                                                              | Część jest w użyciu przez równoległe dyżury                                                                  |
| Z7      | **Nie zajmujesz portów** 3987, 3982/3983, 3986, 4280/4281, 4290/4291 ani innych zajętych runtime'ów odbiorowych                                                                                                                                                                                                                                                           | Jeśli potrzebujesz lokalnego runtime — **4310/4311**, dev-render — **3357**                                  |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, env, redeployu, logów produkcyjnych                                                                                                                                                                                                                                                                                   | Produkcja/demo poza Twoim zakresem                                                                           |
| Z9      | **Żadnej bazy poza jednorazowym lokalnym kontenerem** — nigdy baza demo/staging/produkcyjna                                                                                                                                                                                                                                                                               | „Dane demo = twarz produktu"; nie powtarzasz zanieczyszczenia krzyżowego                                     |
| **Z10** | **Powstaje CO NAJWYŻEJ JEDNA nowa flaga (`execReportsIntelligence`, wzorzec `changeSignals`, OFF wszędzie), i tylko po imiennej zgodzie nadzorcy. Żadna istniejąca flaga nie zmienia wartości domyślnej. Żadna inna flaga nie powstaje**                                                                                                                                  | Krach 07-12 + CLAUDE.md reguła 9                                                                             |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`**, guardów ról, `BetaGate`/`ProductionModuleGate` w `src/routes/AppRoutes.tsx`; **nie zmieniasz tras** `/execution/*` ani banera V8 (`DEC-2026-08-24-03`)                                                                                                                                                             | Decyzje bezpieczeństwa P0 spoza Twojego zakresu                                                              |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY11_REPORT_<data>.md`                                                                                                                                                                                                                   | Repo tonie w dokumentach-duchach                                                                             |
| Z13     | **Nie zmieniasz decyzji z `OWNER_DECISION_LEDGER_2026-08-24.md`** (w tym `DEC-2026-08-24-03` `:25`) i **nie zmieniasz `modules/06_EXECUTION/MODULE_ACCEPTANCE.md`** ani `owner_feedback/**/EXECUTION`                                                                                                                                                                     | Rejestr decyzji jest `FINAL`; rejestr uwag to rejestr, nie Twój notatnik                                     |
| **Z14** | **Nie budujesz generowania treści modelem** (Teresa/Agent jako silnik AI). Sekcję „Analiza AI" traktujesz jako **powierzchnię nad istniejącym serwerowym endpointem** albo jako **uczciwy `BRAK_UI_JEST_API`** — nie wolno Ci budować ani podpinać dostawcy modelu                                                                                                        | Agent = osobny moduł, ostatni w programie                                                                    |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/nieokreślonych.** W tym kontrakcie to wprost: `UNKNOWN`, `NOT_APPLICABLE`, `NOT_VERIFIED`, `INSUFFICIENT_DATA` i liczbowe `0` są **osobnymi stanami** (`EXE-OWN-006`, `EXE-CONTROL-REPORT-01`)                                                                                                                  | Uczciwy pusty stan > udawany raport. `0` ≠ brak danych ≠ zielony                                             |
| **Z16** | **Nie dotykasz plików serwerowych report/analytics/control** — `server/src/routes/managementReports*.routes.ts`, `server/src/routes/executionAnalytics.routes.ts`, `server/src/routes/executionControl.routes.ts`, `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`, `server/src/domain/initiatives-execution/**`. **WOLNO czytać i cytować; zmiana = STOP** | Kontrakt backendu naprawiany in-house; brak endpointu = STOP, nie improwizacja                               |
| **Z17** | **★ Zakaz wszystkiego poza czterema raportami Execution.** Nie dotykasz żadnego innego modułu. **W samym Execution granica jest węższa:** rejestr list/kanban/preview/tabela pięciu powierzchni (Realizacje·Praca·Zasoby·Sterowanie·Raporty) jest **poza zakresem** — jest solidny i na kanonie. Ostra ramka „WOLNO/NIE WOLNO" niżej                                      | Program konsolidacji = „jeden moduł na raz"; przypadkowa zmiana kanonicznej listy kasuje zaakceptowaną pracę |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie Z18 = automatyczne odrzucenie CAŁEGO dyżuru**                   | Lekcja dnia 2: cicha zmiana globalnego mocka wywaliła 27 testów w cudzych modułach                           |

**Zasięg Z18 — konkretnie:**

```
tests/setup.ts        tests/helpers/**        tests/__mocks__/**
vitest.config.ts      vitest.*.config.ts      server/vitest.config*.ts
tests/integration/**/vitest.*.config.ts
```

**Gdy potrzebujesz innego zachowania mocka** — dokładnie jedno z dwóch, zawsze
opt-in: (1) `vi.mock` lokalnie w Twoim pliku testowym; (2) dedykowany helper
w **NOWYM** pliku, importowany tylko przez Twoje testy. Nie wolno: „tylko dodam
jedno pole do globalnego mocka". Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — konkretnie. Granica jest ostra:**

```
WOLNO (Twój zakres):
  src/components/Execution/reports-intelligence/**        (NOWY katalog na 4 raporty-intelligence)
  src/components/Execution/reports-intelligence/__tests__/**
  src/components/Reports/reportContentGenerator.ts        (rozszerzenie sekcji — tylko jeśli §E.4 to wybierze, addytywnie)
  src/components/Reports/Wizard/ReportGeneratorWizard.tsx (rozszerzenie kroków — tylko addytywnie, za flagą)
  src/services/api/v8/execution-control.ts               (klient — tylko odczyt/dodanie metody odczytowej)
  src/services/initiatives-execution/runtimeApi.ts       (klient — TYLKO ODCZYT istniejących funkcji)
  src/components/Execution/executionFeatureFlags.ts       (WYŁĄCZNIE dopisanie jednej flagi wzorcem changeSignals)
  src/components/Execution/ExecutionHub.tsx               (WYŁĄCZNIE dopięcie zakładki Menu 3 raportu za flagą — patrz §2.2)
  public/locales/{pl,en}/translation.json                (TYLKO klucze w gałęzi execution.*)
  dev-render/screens/execution-report-*.tsx               (NOWE ekrany harnessu, addytywnie)
  docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY11_REPORT_<data>.md   (jedyny nowy dokument)

NIE WOLNO:
  src/components/Execution/ExecutionReportsSurface.tsx    ← rejestr definicji/uruchomień, StandardTable — NA KANONIE, nie ruszasz
  src/components/Execution/ExecutionWorkSurface.tsx       ← rejestr Praca — nie ruszasz (poza dopięciem zakładki raportu w Hubie)
  src/components/Execution/ExecutionResourcesSurface.tsx  ← rejestr Zasoby — nie ruszasz
  src/components/Execution/ExecutionControlSurface.tsx    ← rejestr Sterowanie — nie ruszasz
  src/components/standard/**  ·  src/components/shared/**  ← WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ
  src/routes/AppRoutes.tsx  ·  src/routes/routeConfig.ts
  server/**                                               ← CAŁY katalog serwera TYLKO ODCZYT (Z16); zmiana = STOP
  tests/e2e/**  ·  tests/acceptance/**                    ← cudzy tor odbiorowy — NIE URUCHAMIASZ
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
czego brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(execution): add execReportsIntelligence flag (changeSignals-model) + OFF proof (E.0)
  feat(execution): Work Intelligence Report — executive pulse + KPI drill-down (E.1)
  test(execution): flag-off proof for four intelligence reports (T.2)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach commita:
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
- **Testy dowodowe TYLKO BEHAWIORALNE.** Test grep-po-źródłach nie liczy się do
  minimum DoD. **KAŻDA nowa powierzchnia = minimum TRZY testy zachowania**:
  happy / ścieżka błędu (4xx/5xx z API) / pusty stan — **plus czwarty: dowód OFF**.
- **Testy celowane per pozycja — nigdy pełny `tsc` ani pełny `vitest` repo:**
  ```bash
  npx vitest run tests/unit/initiatives-execution/executionReportsSurface.test.tsx
  npx esbuild <plik>.tsx --loader:.tsx=tsx --outfile=/dev/null   # typecheck punktowy
  ```
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `src/` dodają się normalnie.
- **★ MIGRACJE: w tym dyżurze ŻADNEJ. Zero.** Backend raportowy istnieje
  (§2.5). Jeśli uznasz, że migracja jest konieczna → **STOP** (najczęściej
  oznacza, że wchodzisz w zakres serwera — Z16). Cały katalog `server/` ma
  w diffie zostać PUSTY.
- **Hooki pre-commit działają i będą Cię blokować.** Nie obchodź ich przez
  `--no-verify`. Jeśli hook blokuje — popraw kod, nie hook.
  ```bash
  bash scripts/check-list-canon.sh 2>&1 | tail -5
  ```
  **`scripts/check-list-canon.sh --update` jest ZAKAZANE.** Baseline
  (`scripts/check-list-canon.baseline.txt`, `143` linie) **nie zmienia się**
  i jest jednym z dowodów Bloku 5.

### 0.3a. ★ HIGIENA DOCKERA — obowiązkowa przy KAŻDEJ jednorazowej bazie

Uruchamiasz bazę **wyłącznie** gdy chcesz odpalić testy `*.realdb.test.ts`
(§2.12). Bez bazy pomijają się cicho i to jest dopuszczalny wynik — wtedy
deklarujesz `ZASIĘG CZĘŚCIOWY`.

```bash
# (1) START — zawsze --rm, zawsze --tmpfs, nazwa z dyżurem
docker run --rm -d \
  --name consultify-execution-day11-pg \
  --tmpfs /var/lib/postgresql/data:rw,size=3g \
  -e POSTGRES_PASSWORD=disposable \
  -e POSTGRES_DB=consultify_execution_day11_disposable \
  -p 5441:5432 \
  postgres:16-alpine

# (2) UŻYCIE — zmienne środowiskowe TYLKO dla tej jednej komendy testowej
DATABASE_URL=postgresql://postgres:disposable@127.0.0.1:5441/consultify_execution_day11_disposable \
  npx vitest run tests/integration/routes/executionAnalytics.routes.test.ts

# (3) SPRZĄTANIE — NATYCHMIAST po zakończeniu
docker rm -f consultify-execution-day11-pg
docker volume ls -q --filter "dangling=true" | xargs -r docker volume rm

# (4) POTWIERDZENIE PUSTYCH LISTINGÓW — wynik OBU komend wklejasz do raportu
docker ps -a --filter "name=consultify-execution-day11" --format '{{.Names}}'   # oczekiwane: PUSTO
docker volume ls --filter "dangling=true" -q                                     # oczekiwane: PUSTO
df -h / | tail -1
```

Cztery twarde reguły: `--tmpfs` obowiązkowy; `--rm` plus jawny `docker rm -f`;
nigdy nie podłączasz się do klastrów na 5432/5433/5435; Twój port to **5441**.
Potwierdzenie pustych listingów (krok 4) jest jednym z dowodów Bloku 5, nawet
gdy bazy w ogóle nie uruchamiałeś.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane** — odczyt idzie do backendu przez istniejące klienty
   (`runtimeApi.ts`, `execution-control.ts`, `/api/management-reports/*`,
   `/api/execution-analytics/*`). Zero mocków, zero `sampleData`, zero zaszytych
   tablic, zero `localStorage` jako źródła prawdy. Pusty wynik z API = uczciwy
   pusty stan, nie fikcyjne dane. Fixture DEV-only z `EXE-OWN-004` **nigdy nie
   nadpisuje niepustej odpowiedzi API** i **nie wchodzi do produkcji/testów**.
2. **Uczciwość liczb, nie readback zapisu** — raporty są powierzchniami
   **odczytu/analizy** (kontrakt `EXE-WORK-REPORT-01`: „Report views are read/
   analysis surfaces. Governed mutations occur only inside the source task or
   decision tool"). **Nie budujesz mutacji w raporcie.** Każdy agregat, który
   pokazujesz, **musi rekoncyliować się z drill-down** (DoD kontraktu). Liczba
   bez rodowodu (źródło·wersja·czas·klasa wartości) = atrapa (§0.6).
3. **Zgodność z kontraktem właściciela** — kolejność sekcji, nazwy, kubełki
   czasowe, słownik KPI i zakazy wg `MODULE_ACCEPTANCE.md` §`EXE-OWN-006`
   (`:127-145`) i czterech zadań (`:147-286`). **Kolejność narracji zarządczej
   jest kontraktem**, nie sugestią. Rozbieżność świadoma = wpis w „Korektach
   wobec kontraktu"; nieświadoma = defekt.
4. **Minimum 3 testy celowane, BEHAWIORALNE** przechodzą: happy / błąd /
   pusty stan.
5. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson
   `#85182F`. Czerwień (`--c-danger`) ma jedno dopuszczalne zastosowanie
   semantyczne: **stan `RED`/`critical`/`OVERDUE`** w RAG i horyzoncie. Nic
   więcej. CTA i stany aktywne = neutralne, **nigdy `bg-c-accent`**, **nigdy
   `btn-primary` jako „zakładka aktywna"**. Fokus = niebieski
   `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
6. **i18n PL + EN OD RAZU**, w tym samym commicie co kod. **Uwaga o wzorcu —
   §2.10:** komponenty Execution mieszają `useTranslation()` (Hub i panele)
   z zaszytymi literałami PL (`ExecutionReportsSurface`/`WorkSurface`), a
   `reportContentGenerator.ts` używa `tr(pl, en)`. **Trzymasz się wzorca pliku,
   który tworzysz/edytujesz**, ale **zero literałów jednojęzycznych w JSX** —
   ani PL, ani EN. Nowe raporty-intelligence budujesz z **kluczami
   `execution.*`** w obu plikach naraz.
7. **Light i dark** — powierzchnia poprawna w obu motywach. Sprawdzasz zrzutem,
   nie deklaracją (§2.11).
8. **Plik przepuszczony przez `prettier`** przed commitem.
9. **Wpis w raporcie**: `pozycja → commit SHA → status`.
10. **★ DOWÓD OFF** — test w tym samym commicie renderujący dotkniętą trasę
    z `execReportsIntelligence` **wyłączoną**, asertujący, że widać
    **dzisiejszy** rejestr, a NIE nowy raport, oraz że **nie leci ani jedno
    żądanie** do nowego endpointu raportowego. Bez tego pozycja jest
    **CZĘŚCIOWA**.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja dnia 2:** raport deklarował „N/N PASS" liczone tylko na plikach
własnych, gdy 27 testów w cudzych modułach było czerwonych przez plik
współdzielony.

**Przed oddaniem raportu:**

1. Wypisz wszystkie dotknięte pliki:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Wyodrębnij pliki **współdzielone** — jawnie, nie z pamięci:
   ```bash
   grep -rln "useFeatureFlags\|executionFeatureFlags" src/ | wc -l
   grep -rln "reportContentGenerator" src/ | head
   grep -rln "ReportGeneratorWizard" src/ | head
   grep -rln "runtimeApi" src/ | head
   ```
   W tym dyżurze pliki współdzielone z definicji:
   `src/components/Execution/executionFeatureFlags.ts` (importowany szeroko),
   `src/components/Execution/ExecutionHub.tsx` (5698 l., montuje pięć
   powierzchni i `ReportGeneratorWizard`),
   `src/components/Reports/reportContentGenerator.ts` (810 l., konsumowany też
   poza Execution),
   `public/locales/{pl,en}/translation.json` (całe repo).
3. **Uruchom testy KATALOGÓW konsumentów**, nie tylko własnych plików:
   ```bash
   npx vitest run tests/unit/initiatives-execution
   npx vitest run tests/unit/execution
   npx vitest run src/components/Execution/__tests__
   npx vitest run tests/components/ExecutionChangeSignalsPanel.test.tsx tests/components/ExecutionIntelligencePanel.test.tsx
   ```
   jeśli ruszałeś `ExecutionHub.tsx`:
   ```bash
   npx vitest run src/components/Execution/__tests__/ExecutionHub.reportingMenu.smoke.test.tsx
   ```
   jeśli ruszałeś `public/locales/*`:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
   node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"
   ```
4. **W raporcie deklarujesz zasięg jawnie**: `ZASIĘG PEŁNY` (uruchomiłeś
   katalogi konsumentów) albo `ZASIĘG CZĘŚCIOWY` (tylko własne pliki lub
   pominięte `*.realdb` — wtedy piszesz to wprost i wymieniasz, czego nie
   uruchomiłeś i dlaczego). „N/N PASS" tylko na własnych plikach = zasięg
   częściowy.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**

Zatrzymujesz się i opisujesz problem, gdy:

- endpoint, na który liczyłeś, nie istnieje albo ma inny kontrakt niż tu
  opisano (szczególnie prawdopodobne przy: rekonstrukcji stanu na historyczną
  datę, mapowaniach initiative→objective/BSC, danych dostępności/absencji ludzi,
  eksporcie PDF/XLSX z runtime-v1);
- musiałbyś **dodać migrację** (dozwolonych: **zero**);
- musiałbyś **stworzyć drugą flagę** albo zmienić domyślną wartość istniejącej (Z10);
- musiałbyś **zmienić plik serwerowy** (Z16) — to jest w tym dyżurze
  **najczęstszy przewidywany STOP i jest to wynik dobry, nie porażka**;
- musiałbyś **zmienić trasę** albo baner V8 (Z11);
- musiałbyś **wpisać `0`/`safe`/`green` tam, gdzie nie ma obronionej wartości**
  — poprawny stan to `UNKNOWN`/`NOT_APPLICABLE`/`NOT_VERIFIED`, nie zero;
- musiałbyś **zgadnąć konfigurowalny próg/wagę** (wagi wpływu, kryterium
  krytyczności zależności, progi saturacji, bufor operacyjny, taksonomia
  severity, reaction SLA) — **nie zgadujesz**, piszesz propozycję i STOP (§1.7);
- musiałbyś **zbudować silnik AI** albo podpiąć dostawcę modelu (Z14);
- **test nie przechodzi i naprawa wymagałaby zmiany GLOBALNEGO mocka/configu
  vitest (Z18)** — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- **kafelek/sekcja/przycisk wyszedłby pusty albo bez efektu** — §0.6.

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

### 0.6. ★ ZAKAZ ATRAP

W raportach zarządczych atrapa jest szczególnie groźna, bo „liczba na kafelku"
wygląda wiarygodnie. **Trzy rzeczy, które są ATRAPĄ i każda to STOP, nie „DONE
z gwiazdką":**

| Atrapa                     | Jak wygląda                                                                                        | Co robisz zamiast                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Liczba bez rodowodu**    | KPI „Overdue: 7" bez numeratora/denominatora, znacznika czasu i drill-down do dokładnie 7 rekordów | Każdy KPI pokazuje `wartość · num/denom · czas obliczenia · dokładny zbiór drill-down` (kontrakt `EXE-OWN-006`). Brak drill-down = nie renderujesz KPI                                              |
| **Kafelek bez treści**     | „Świeżość danych: —" zawsze, bo pole nie przychodzi z API                                          | Nie renderujesz kafelka albo renderujesz z jawnym `BRAK_API`. **Nigdy `—` udające wartość**                                                                                                         |
| **Sekcja BSC bez mapowań** | Matryca ryzyka celów z zerami, bo brak mapowań initiative→objective                                | Kontrakt jest jawny: „Until credible objective mappings exist, label the view as an operational backlog report rather than a BSC strategy report" (`:137`). Robisz wariant operacyjny + STOP `E-O3` |

**Reguła operacyjna:** zanim zbudujesz jakąkolwiek sekcję/KPI, **najpierw
znajdź endpoint i policz drill-down**, potem renderuj. Uczciwy `BRAK_API`
z pełną tabelą werdyktów jest w tym dyżurze wynikiem **DOBRYM**.

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

23 sierpnia właściciel przeszedł moduł Execution ekran po ekranie i zostawił
osiem uwag (`EXE-OWN-001..008`, rejestr w `MODULE_ACCEPTANCE.md:106-113`).
Uwagi 001–005 i 008 są **zamknięte technicznie / czekają na retest** — rejestr
Realizacje jest przywrócony, lista/preview/dokument działają, tożsamość
inicjatywy jest kanoniczna. **Rdzeniem tego dyżuru są dwie uwagi P0, obie
`NOT_IMPLEMENTED`:**

> `EXE-OWN-006` (`:111`): „powinien się otwierać raport, w którym powinniśmy
> mieć jakąś analizę (…) co się zbliża i co jest już dziś w backorder" —
> status `OWNER_REQUIREMENT_CAPTURED / EXPERT_SPEC_COMPLETE / NOT_IMPLEMENTED`.

> `EXE-OWN-007` (`:112`): „Robimy raporty na dany tydzień (…) prognozujemy
> przyszłość — wywołujemy 'zrób raport' (…) pobiera wszystkich ludzi będących
> w projektach i pokazuje ich poziom obciążenia (…) wyłącznie te raporty bez
> żadnych dodatkowych wstawek między tabelami raportów a menu trzecim." —
> status `4 IMPLEMENTATION TASKS SPECIFIED / NOT_IMPLEMENTED`.

Kontrakt jest **pełny i zaakceptowany jako `EXPERT_SPEC_COMPLETE`** — dwie
niezależne syntezy eksperckie (McKinsey-style + BSC + workforce + program-
control) zostały uzgodnione w cztery zadania implementacyjne. **Specyfikacja
produktowa NIE jest niedookreślona.** Niedookreślone są wyłącznie: (a)
konfigurowalne progi/wagi, które właściciel świadomie zostawił jako „configurable"
(§1.7), (b) dostępność danych w backendzie (weryfikujesz w Bloku 0), (c)
architektura flagi i kanonicznego backendu generatora (§1.7 `E-O1`, `E-O2`).

### 1.2. Dokumenty wiążące merytorycznie

| Plik                                                 | Co z niego bierzesz                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (308 l.) | `EXE-OWN-006` kontrakt produktowy raportu Praca (`:127-145`); `EXE-WORK-REPORT-01` (`:147-232`); `EXE-RESOURCES-REPORT-01` (`:234-248`); `EXE-CONTROL-REPORT-01` (`:250-264`); `EXE-REPORT-GENERATOR-01` (`:266-286`); osiem uwag (`:106-113`); zasady SSOT tożsamości `EXE-OWN-008` (`:118-125`) |
| `OWNER_DECISION_LEDGER_2026-08-24.md` (112 l.)       | `DEC-2026-08-24-03` (`:25`) — baner V8, zamyka `EXE-OWN-001`; **wiążące, nie dotykasz**                                                                                                                                                                                                           |
| `CLAUDE.md`                                          | reguła 7 (pierwszy tester wizualny), 9 (zakaz masowego włączania flag), złote reguły (weryfikuj runtime, nie audyt)                                                                                                                                                                               |

**Kontrakt czytasz w całości — to nie jest opcjonalne i nie zastąpisz tego tą
instrukcją.** Jeśli instrukcja i kontrakt się rozjeżdżają — **wygrywa
kontrakt**, a rozbieżność idzie do „Korekt wobec instrukcji".

### 1.3. Identyfikatory — jak je piszesz w raporcie

Pozycje tego dyżuru: `E.0` (flaga + dowód OFF), `E.1` (Work), `E.2` (Resources),
`E.3` (Control), `E.4` (Generator), `T.1..T.6` (testy przekrojowe), `R.1..R.2`
(rejestr/dowody). Uwagi właściciela cytujesz jako `EXE-OWN-00X`, zadania jako
`EXE-*-REPORT-01`, pozycje otwarte jako `E-O1..E-O7`.

### 1.4. Decyzje wiążące

- `DEC-2026-08-24-03` (baner V8) — **nie dotykasz** guardu ani banera (Z11).
- **Brak decyzji akceptującej wygląd raportów** — więc nie ma akceptu
  wizualnego, więc raporty idą za flagą OFF (reguła 7), a Ty kończysz przed
  krokiem „zrzut nadzorcy".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **★ REKONESANS MÓWI „brak generatora" — RUNTIME MÓWI INACZEJ. Zweryfikuj
   sam (złota reguła CLAUDE.md: audyty starzeją się w ~3 dni).** Na tipie
   istnieją: `ExecutionReportsSurface.tsx:1001` „Generator raportu" (workbench
   uruchomień), `src/components/Reports/Wizard/ReportGeneratorWizard.tsx`
   (655 l.) zamontowany w `ExecutionHub.tsx:5693`, oraz
   `src/components/Reports/reportContentGenerator.ts` (810 l., produkuje typowany
   dokument z sekcjami progressSummary/blockedItems/dueSoon/decisionsNeeded, RAG,
   metryki). **To nie jest kontraktowy raport-intelligence.** Istniejący
   generator produkuje **operacyjne podsumowania**, a nie: executive pulse
   ≤8 KPI z num/denom i rekoncyliacją, macierz ryzyka BSC, heatmapę obłożenia
   osób-tygodni, rozdział historia/`as-of`/prognoza, niezmienną publikację
   z kontraktowym cyklem życia. **W Bloku 0 (E.0) precyzyjnie mapujesz deltę:
   co realnie istnieje vs czego brakuje do kontraktu** — i to jest główny
   werdykt tego dyżuru. „NOT_IMPLEMENTED" w rejestrze = **niezaimplementowane
   do kontraktu**, mimo że istnieje generyczny szkielet.
2. **★ DWA BACKENDY RAPORTÓW — split-brain (`E-O1`).** Współistnieją:
   (a) **runtime-v1 report-runs/report-definitions** — event-sourced domena
   `server/src/domain/initiatives-execution/reportRun.ts:299` (cykl
   `DRAFT → VALIDATED → FROZEN → APPROVED → PUBLISHED`, `contentHash`,
   `frozenSnapshot`, `exportPackage` **format JSON**), mount
   `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`, klient
   `runtimeApi.ts:1429-1460`, ścieżka `/api/initiatives/runtime-v1/report-runs`;
   (b) **`/api/management-reports/*`** — dojrzały podsystem
   `server/src/routes/managementReports.routes.ts:460` (`/generate`, `/history`,
   `/templates`, `/schedules`, `/pending-approvals`, `/:id/submit`, `/approve`,
   `/versions`, `/versions/compare`, `/comments`, `/audit-log`, `/finalize`,
   `/unlock`, `/pdf`, `/pptx`, `/share`, `/bulk-export`), plus
   `/api/execution-analytics/*` (`/predict`, `/triage`, `/dependencies/analyze`,
   `/capacity/analyze`, `/capacity/signals`, `/readiness/analyze`,
   `/:projectId/intelligence`). **Kontraktowy cykl życia generatora
   (`GENERATING → DRAFT_DYNAMIC → READY_TO_REVIEW → IN_REVIEW → READY_TO_PUBLISH
→ PUBLISHED_SNAPSHOT → SUPERSEDED/ARCHIVED` + `INCOMPLETE`/`FAILED`) NIE
   pasuje dokładnie do żadnego z nich.** Który backend jest kanoniczny =
   **STOP `E-O1` do nadzorcy** przed jakąkolwiek pracą nad generatorem.
   Nie wolno Ci zmieniać żadnego z nich (Z16).
3. **Baner V8 to kontrakt, nie defekt.** `DEC-2026-08-24-03` dopuszcza baner
   wyłącznie wokół pojedynczego panelu realnie wymagającego V8. **Nie
   „naprawiasz" go i nie owijasz nim raportów.**
4. **Rejestr pięciu powierzchni jest na kanonie.** `ExecutionReportsSurface.tsx`
   osadza `StandardTable` (`:689`, `:965`) i `StandardPreview` (`:623`, `:900`).
   To jest wzór poprawny (jak Materials/Tools). **Nie przerabiasz go.** Jego
   testy-strażnicy (`tests/unit/initiatives-execution/executionReportsSurface.test.tsx`)
   muszą przeżyć dyżur bez jednej zmiany.
5. **Fixture DEV-only z `EXE-OWN-004` istnieje i jest niebezpieczne.** Deterministyczny
   pakiet review „nigdy nie nadpisuje niepustej odpowiedzi API i nie wchodzi do
   produkcji/testów". **Weryfikując raport, nigdy nie opieraj dowodu na fixture
   review** — pokażesz dane, których nie ma w bazie.
6. **`UNKNOWN` ≠ `0` ≠ zielony — to kontrakt, nie estetyka.** `EXE-OWN-006`:
   „An item without a due date is a data-risk item, never green and never
   silently counted as formally overdue." `EXE-WORK-REPORT-01`: „`UNKNOWN`,
   `NOT_APPLICABLE` and numerical zero are separate states."
7. **FACT / INFERENCE / RECOMMENDATION to wymóg testowalny.** Każdy raport
   musi wizualnie i semantycznie rozdzielać fakty, wnioski modelu i rekomendacje
   (`EXE-OWN-006`, `EXE-CONTROL-REPORT-01`). To pokrywasz testem, nie deklaracją.
8. **i18n Execution jest niejednorodny.** `ExecutionReportsSurface`/`WorkSurface`
   mają zaszyte literały PL (`'Raport'`, `Intl('pl-PL')`); Hub i większość
   paneli używają `useTranslation()`; `reportContentGenerator.ts` używa
   `tr(pl,en)`. **Twoje nowe raporty budujesz z kluczami `execution.*` w obu
   plikach naraz** (§2.10).

### 1.6. ★ Reguła 7 — dlaczego nic nie idzie na ekran właściciela

CLAUDE.md reguła 7: **właściciel nigdy nie jest pierwszym testerem wizualnym.**
Kolejność: (a) kontrakt/opis → (b) **Ty renderujesz realny ekran i sam robisz
zrzut** (DoD 8) → (c) zrzut czysty → (d) dopiero wtedy patrzy nadzorca, potem
właściciel — do **akceptu**, nie do odkrywania zepsucia. W raporcie piszesz
„gotowe do zrzutu przez nadzorcę", nigdy „gotowe do włączenia flagi".

### 1.7. Pozycje otwarte — czego NIE ZGADUJESZ

Każda kończy się **STOP-em z propozycją** w raporcie (format §0.5). STOP tu
kosztuje minuty i **odblokowuje decyzję** — dyżur bez tych STOP-ów zostawia
nadzorcę bez pytań, na które musi odpowiedzieć.

| Poz.     | Kwestia                                                                                                                                                                                                                                    | Rodzaj                                    | Twój produkt                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E-O1** | Który backend jest kanoniczny dla generatora i publikacji: runtime-v1 report-runs (event-sourced, eksport JSON) czy `/api/management-reports` (generate/pdf/pptx/versions/approvals) — skoro kontraktowy cykl życia nie pasuje do żadnego? | **STOP nadzorcy (architektura)**          | Propozycja robocza: **runtime-v1 jako SSOT niezmiennej publikacji** (ma `frozenSnapshot`+`contentHash`), a `/management-reports/pdf                                                                                                                     | pptx` jako pipeline eksportu. **Nie wdrażasz bez decyzji** — dotyka wyboru serwera (Z16) |
| **E-O2** | Nazwa i granulacja flagi: jedna umbrella `execReportsIntelligence` czy per-raport?                                                                                                                                                         | **STOP nadzorcy (zgoda na flagę)**        | Propozycja: **jedna umbrella, wzorzec `changeSignals`, OFF wszędzie**. Iron rule = max jedna nowa flaga z imienną zgodą. Bez zgody flaga nie powstaje                                                                                                   |
| **E-O3** | Czy backend ma wiarygodne mapowania `initiative/milestone → objective/BSC-perspective` (Financial/Customer/Internal/People/Governance)?                                                                                                    | **STOP weryfikacji + decyzja produktowa** | Kontrakt sam rozstrzyga: przy braku mapowań **etykietuj widok jako „raport operacyjnego backlogu", nie „BSC strategy" (`:137`)**. Werdykt `BRAK_API` dla warstwy strategicznej + STOP                                                                   |
| **E-O4** | Domyślne progi/wagi Work: wagi wpływu, kryterium krytyczności zależności, próg „at-risk 7 dni", SLA decyzji                                                                                                                                | **STOP-decyzji Piotra (configurable)**    | Kontrakt mówi „explicit impact weight × dependency criticality" i „never label as money without verified exposure" — ale **wartości domyślnych nie podaje**. Proponujesz zestaw, oznaczasz jako konfigurowalny, **nie zaszywasz na twardo** bez decyzji |
| **E-O5** | Źródło danych Zasoby: dostępność po absencjach, stałe obowiązki, przyjęte rezerwacje, bufor operacyjny, umiejętności/role — czy backend to zwraca? Domyślne progi saturacji i wartość bufora                                               | **STOP weryfikacji + decyzji Piotra**     | Weryfikujesz endpointy `capacity/*`; brak danych = `UNKNOWN` per kontrakt + STOP. Progi saturacji i bufor = konfigurowalne, propozycja + STOP                                                                                                           |
| **E-O6** | Rekonstrukcja stanu na historyczną `as-of` datę (wymóg reprodukowalności w DoD wszystkich raportów) — czy backend potrafi?                                                                                                                 | **STOP weryfikacji (dependency)**         | Sprawdzasz kontrakt read-model; jeśli backend nie rekonstruuje historii → **STOP `BRAK_API`** (zmiana serwera = Z16), dostarczasz „stan bieżący" + jawną adnotację „replay historyczny niedostępny"                                                     |
| **E-O7** | Eksport i „Analiza AI": runtime-v1 `exportPackage` to tylko JSON; kontrakt wymaga PDF/XLSX. „Analyze AI" wymaga powierzchni FACT/INFERENCE/RECOMMENDATION                                                                                  | **STOP weryfikacji (dependency) + Z14**   | PDF przez `/management-reports/:id/pdf`; XLSX — sprawdź, czy istnieje, brak = STOP. „Analyze AI" = **powierzchnia nad istniejącym endpointem** (`execution-analytics/*`) albo uczciwy `BRAK_UI_JEST_API`. **Nie budujesz silnika** (Z14)                |

**Które raporty wymagają STOP-decyzji Piotra przed pełnym domknięciem:**

- **Work (E.1)** — `E-O3` (BSC mapowania → operacyjny vs strategiczny), `E-O4`
  (wagi/progi). Warstwa operacyjna (executive pulse, horyzont, przyczynowość,
  trend 12-tyg.) jest budowalna **bez** decyzji Piotra, jeśli backend zwraca
  dane; warstwa strategiczna BSC jest **warunkowa**.
- **Resources (E.2)** — `E-O5` (dane dostępności + progi saturacji/bufor).
  Bez źródła dostępności ludzi raport jest niebudowalny ponad `UNKNOWN`.
- **Control (E.3)** — decyzje Piotra o **taksonomii severity i reaction SLA**
  (`EXE-CONTROL-REPORT-01`: „qualification sets category, severity, … reaction
  SLA"), wartości domyślne nie podane.
- **Generator (E.4)** — `E-O1` (kanoniczny backend) i `E-O2` (flaga) to
  **twarde STOP-y architektoniczne do nadzorcy**, bez których nie zaczynasz.

**Reguła wspólna:** wolno przygotować kod tak, żeby decyzja była jedną podmianą
stałej/jednym propsem, i zaimplementować propozycję **za flagą OFF** — ale
pozycja ma w raporcie oznaczenie `STOP — DO ZATWIERDZENIA` i pełny format §0.5.
**Cicha decyzja jest gorsza niż brak decyzji.**

---

## 2. MAPA TECHNICZNA — skrót niezbędny

**Wszystkie liczby linii i numery poniżej są zweryfikowane na tipie
`5f96e936ac`.** Twoim pierwszym zadaniem w Bloku 0 jest sprawdzenie, czy nadal
się zgadzają, i wpisanie rozbieżności do „Korekt wobec instrukcji".

### 2.1. Rozmiar obszaru — żebyś wiedział, w co wchodzisz

| Plik                                                      | Linie | Rola                                                                                                                                             |
| --------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/Execution/ExecutionHub.tsx`               |  5698 | powłoka modułu, pięć zakładek, montuje `ReportGeneratorWizard` (`:5693`)                                                                         |
| `src/components/Execution/ExecutionReportsSurface.tsx`    |  1222 | rejestr definicji/uruchomień raportów + workbench „Generator raportu" (`:1001`); `StandardTable`/`StandardPreview` — **na kanonie, NIE ruszasz** |
| `src/components/Execution/ExecutionWorkSurface.tsx`       |   999 | rejestr Praca — nie ruszasz                                                                                                                      |
| `src/components/Execution/ExecutionResourcesSurface.tsx`  |   620 | rejestr Zasoby — nie ruszasz                                                                                                                     |
| `src/components/Execution/ExecutionControlSurface.tsx`    |  1195 | rejestr Sterowanie — nie ruszasz                                                                                                                 |
| `src/components/Execution/executionFeatureFlags.ts`       |   124 | flagi kokpitu; `changeSignals` special-case (`:105`,`:115`) — Twój wzorzec                                                                       |
| `src/components/Reports/Wizard/ReportGeneratorWizard.tsx` |   655 | generyczny kreator raportu (typy/harmonogram)                                                                                                    |
| `src/components/Reports/reportContentGenerator.ts`        |   810 | generyczne sekcje operacyjne, `tr(pl,en)`                                                                                                        |
| `src/services/initiatives-execution/runtimeApi.ts`        |  1646 | klient runtime-v1; report-runs/definitions `:1429-1460`                                                                                          |

### 2.2. Trasy i montaż — jak raport trafia na ekran

- Trasa `/execution` → `ExecutionHub` (`AppRoutes.tsx:2399`, lazy `:110`).
  **Trasy nie dotykasz** (Z11).
- Zakładki Menu 2: `list · work · resources · control · reports`
  (`ExecutionHub.tsx:743`, `:933`).
- **Kontrakt nawigacji raportu (`EXE-OWN-005` + `EXE-WORK-REPORT-01` pkt 1-4):**
  raport otwiera się jako **kontekstowa zakładka Menu 3** pod swoją powierzchnią
  (`Praca → Raport pracy`), na pełnej powierzchni roboczej, **nigdy pod
  rejestrem**. Powrót/zamknięcie przywraca listę i jej filtry/zaznaczenie/scroll.
  Otwarcie pojedynczego zadania/decyzji z raportu → **osobna zakładka Menu 3
  narzędzia zadania**, przez istniejący mechanizm dokumentu dynamicznego.
- **Dopięcie zakładki raportu robisz w `ExecutionHub.tsx` addytywnie, za flagą.**
  Wzorzec montażu Menu 3 istnieje (`ExecutionHub.tsx:781`, `:1180`, `:1900-1950`
  — nasłuch reportów kreatora). Przy fladze OFF zakładka „Raport …" **nie
  pojawia się** — dzisiejszy rejestr zostaje.

### 2.3. Flagi i wszystkie tylne drzwi

`src/components/Execution/executionFeatureFlags.ts`:

- flagi z fallbackiem D-D „ON poza produkcją" (`:116-120`): `intelligence`
  (`:19`), `ganttBaseline` (`:24`), `whatIfSandbox` (`:29`), `rolloutStages`
  (`:34`), `benefits` (`:39`), `summaryOneLook` (`:47`);
- **`changeSignals` (`:56-60`) — special-case OFF wszędzie** (`:105`
  demo-profile ON tylko jawnie; `:115` `return false` **przed** fallbackiem
  D-D). To jest **jedyny** poprawny wzorzec dla nowej, jeszcze niezrzuconej
  powierzchni;
- rozstrzyganie: URL query → localStorage → env → default (`:101-121`).

**Twoja flaga `execReportsIntelligence`:** dopisujesz wpis do `FLAGS`
(query `ff_execReportsIntel`, localStorage `ff.exec_reports_intel`, env
`VITE_EXEC_REPORTS_INTELLIGENCE_ENABLED`) **oraz** special-case w
`isExecutionFlagEnabled` dokładnie jak dla `changeSignals` (`:115`), żeby
**nie** wpadła w fallback `:120`. Bez tego special-case flaga byłaby ON na
demo — naruszenie reguły 7.

### 2.4. ★ Techniczny wzorzec bramkowania — obowiązkowy

1. **Jeden odczyt flagi na komponent trasy, na górze.** `isExecutionFlagEnabled('execReportsIntelligence')`
   czytasz raz; sekcje dostają **prop**, nie własny odczyt.
2. **Wczesny return / warunek montażu przed fetchem.** Przy OFF nie leci ani
   jedno żądanie do nowych endpointów raportowych (asercja testowa: spy na
   `fetch`/klient = `toHaveBeenCalledTimes(0)`).
3. **`data-testid` stanu wyłączenia jest kontraktem testu.**
4. **Zero nowych `||`/tylnych drzwi** obok istniejącego rozstrzygania flag.
5. Nie owijasz rejestru w `{flagOn ? <Nowy/> : <Stary/>}` w sposób
   duplikujący powłokę — nowa zakładka Menu 3 **dochodzi** obok, przy ON.

### 2.5. Backend — co JEST gotowe (i czego NIE budujesz od nowa)

**Wszystko serwerowe = TYLKO ODCZYT (Z16). Brak endpointu = STOP, nie zmiana
serwera.** Zweryfikuj kontrakty w Bloku 0, bo mapa mogła się zestarzeć:

```
/api/initiatives/runtime-v1/report-runs · /report-definitions
    domena: server/src/domain/initiatives-execution/reportRun.ts (299 l.)
    cykl: DRAFT→VALIDATED→FROZEN→APPROVED→PUBLISHED; contentHash; frozenSnapshot; exportPackage(JSON)
    klient: runtimeApi.ts:1429 createReportRun · :1432 transitionReportRun
            :1438 getReportDefinition · :1457 listReportDefinitions · :1459 listReportRuns
/api/management-reports/*        managementReports.routes.ts (460 l.)
    /generate :37 · /history :88 · /templates :110 · /schedules :147
    /:id/versions :218 · /:id/versions/compare :240 · /:id/pdf :343 · /:id/pptx :377
    /:id/finalize :323 · /:id/approve :210 · /bulk-export :445
/api/management-reports/analytics  managementReportsAnalytics.routes.ts (36 l.)  /usage :19 · /types :28
/api/execution-analytics/*        executionAnalytics.routes.ts (311 l.)
    /predict :87 · /triage :102 · /dependencies/analyze :119 · /capacity/analyze :146
    /capacity/signals :178 · /readiness/analyze :208 · /:projectId/intelligence :235
/api/… control                    executionControl.routes.ts (1085 l.)  sygnały/interwencje
    klient front: src/services/api/v8/execution-control.ts
```

**Trzy udokumentowane luki, które prawdopodobnie skończą się `STOP/BRAK_API`
(cytuj, nie zasypuj):** rekonstrukcja stanu na historyczną `as-of` datę
(`E-O6`), mapowania BSC objective (`E-O3`), eksport XLSX z runtime-v1
(`exportPackage` jest JSON-only — `reportRun.ts:42`, `E-O7`).

### 2.6. Wzorce do naśladowania — wszystkie w repo

- **Uczciwe liczniki** — `reportContentGenerator.ts` pokazuje wzór `tr(pl,en)`
  i typowane bloki (`ReportMetric`, `ReportTableRow`, `ReportSection`,
  `ReportDocument`, `RagLevel`); wielokrotnego użytku buildery sekcji
  (`:164` progressSummary, `:218` blockedItems, `:245` dueSoon, `:316`
  decisionsNeeded). Nowy raport-intelligence **może budować na tych typach**,
  ale dokłada kontraktowe: num/denom, drill-down, klasę wartości.
- **Kanon list/preview** — `ExecutionReportsSurface.tsx` osadza realny
  `StandardTable`/`StandardPreview`. Twój **register/tabela wewnątrz raportu**
  (auditable register) idzie przez `StandardTable`.
- **Flaga OFF-wszędzie** — `executionFeatureFlags.ts` `changeSignals`.

### 2.7. Kontrakt uczciwych wartości — TYLKO ODCZYT

Klasy wartości wymagane przez kontrakt generatora (`:280`): `SOURCE`,
`CALCULATED`, `MANUAL`, `AI`, `UNKNOWN`. Stany epistemiczne Control (`:260`):
`UNKNOWN`, `NOT_VERIFIED`, `INSUFFICIENT_DATA`, `OWNER_MISSING`,
`DECISION_REQUIRED`. **Nie wymyślasz drugiego słownika** — jeśli w
`reportContentGenerator.ts`/`runtimeApi` istnieje enum, używasz go.

### 2.8. Testy zastane — co Cię pilnuje

| Plik                                                                           | Rola                                                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/initiatives-execution/executionReportsSurface.test.tsx`            | **STRAŻNIK** rejestru: fail-closed, publikacja tylko zamrożonej migawki, wersjonowanie definicji, follow-up task. **Musi przeżyć bez zmiany** |
| `tests/unit/execution/executionReportPdfExport.test.ts`                        | eksport PDF — kontrakt                                                                                                                        |
| `tests/unit/execution/executionReportCron.test.ts`                             | harmonogram                                                                                                                                   |
| `src/components/Execution/__tests__/ExecutionHub.reportingMenu.smoke.test.tsx` | menu raportowania w Hubie                                                                                                                     |
| `tests/integration/routes/executionAnalytics.routes.test.ts`                   | analytics (realdb)                                                                                                                            |

**Dowód stanu wyjściowego tych plików** (przed/po) wklejasz do raportu.

### 2.9. Kanon UI — co obowiązuje

- Raport-intelligence to **artefakt-dokument pełnoekranowy** (archetyp B/Dokument
  wg SPEC-A), otwierany jako zakładka Menu 3. Tabele WEWNĄTRZ (auditable
  register, listy drill-down) idą przez **`StandardTable`**. Hook
  `check-list-canon.sh` odpala się na każdym `src/components/**.tsx`.
- **Ekran-lista Raporty ma zostać czysty (`EXE-REPORT-GENERATOR-01`
  list-screen contract, `:272`):** „No KPI cards, banners, dashboards, forms or
  decorative sections may appear between the menu and table." Twoje kafelki KPI
  żyją **wewnątrz otwartego raportu**, nigdy między menu a tabelą listy.
- **Tokeny kolorów** — jedyne dozwolone: `--c-text{,-secondary,-muted}`,
  `--c-surface{,-raised}`, `--c-border{,-subtle}`, `--c-success`, `--c-danger`,
  `--c-info`, `--c-focus`. `--c-accent`/`primary-*` = crimson = wyłącznie marka.
  `--c-danger` wyłącznie dla `RED`/`OVERDUE`/`critical`. `warning`/`AMBER` =
  pomarańcz. Fokus zawsze `ring-[color:var(--c-focus)]`.
- **Stany rozróżnialne BEZ koloru.** Każdy RAG/severity/horyzont/klasa wartości
  ma **słowo**, nie tylko kolor (kontrakt „screen reader" + druk czarno-biały).

### 2.10. i18n — wzorzec, którego się trzymasz

- Namespace najwyższego poziomu **`execution`** istnieje w obu plikach —
  **tam dopisujesz klucze**, nie tworzysz nowej przestrzeni.
- Nowe raporty-intelligence: `useTranslation()` + `t('execution.reports.…',
'English fallback')`, **oba pliki `public/locales/{pl,en}/translation.json`
  w tym samym commicie**. Fallback nie zwalnia z dodania klucza do OBU plików.
- Jeśli rozszerzasz `reportContentGenerator.ts` — trzymasz jego wzorzec
  `tr(pl, en)`, nie mieszasz kluczy do pliku, który ich nie używa.
- Sprawdzenie przed commitem:
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
  node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"
  grep -rnE ">[^<>{]*[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ][^<>{]*<" <Twoje pliki .tsx>   # każde trafienie oglądasz
  ```

### 2.11. ★ Harness `dev-render` — Twoje zrzuty, przed raportem

Harness istnieje i nie wymaga logowania ani bazy. Wzorzec ekranu Execution:
`dev-render/screens/execution-change-signals.tsx` (rejestr
`dev-render/main.tsx:843`). **Nie ma jeszcze ekranu raportu-intelligence** —
dokładasz **nowe** `dev-render/screens/execution-report-*.tsx` addytywnie, za
nowym parametrem URL, tak żeby dotychczasowe działały bez zmian. Zmiana
`dev-render/main.tsx`/`vite.config.ts`/`shot.mjs` w części współdzielonej =
ostrożnie i tylko addytywnie (nowy wpis w rejestrze) — reszta STOP.

```bash
npx vite --config dev-render/vite.config.ts --port 3357
node dev-render/shot.mjs evidence/execution-day11/<plik>.png "http://localhost:3357/?screen=execution-report-work&state=ready"
```

`shot.mjs` wypisuje `KONSOLA-BLEDY` i `SIEC-4XX5XX` — **oba wklejasz do raportu
przy każdym zrzucie**. Zrzuty kładziesz w `evidence/execution-day11/`
(katalog `evidence/` istnieje) i wymieniasz ścieżkami w raporcie; nie
commitujesz binariów do `docs/`.

**Obowiązkowy zestaw zrzutów — minimum osiem:** Work (jasny), Work (ciemny),
Work (pusty/błąd), **Work OFF** (rejestr dzisiejszy), Resources, Control,
Generator (kreator), lista Raporty czysta po OFF. Zasady zrzutu (CLAUDE.md #7c):
zero ozdób/adnotacji; wyłącznie tokeny `c-*`; crimson poza `RED`/`OVERDUE` =
defekt do naprawy przed raportem.

### 2.12. Testy `*.realdb` i Docker — kiedy w ogóle

Testy przeciw prawdziwemu Postgresowi (m.in. `executionAnalytics.routes.test.ts`)
bez `DATABASE_URL` **pomijają się cicho** — „0 failed" bez bazy niczego nie
dowodzi. Uruchamiasz je tylko przez jednorazowy kontener (§0.3a) i podajesz
osobno liczbę **wykonanych** i **pominiętych**.

---

## §E. SEKCJA RAPORTY — pięć pozycji

Metoda dla E.1–E.3 jest wspólna: **(1) znajdź endpoint i policz drill-down →
(2) zbuduj sekcje w kolejności narracji zarządczej z kontraktu → (3) każdy KPI
z num/denom + rodowód + drill-down → (4) rozdziel FACT/INFERENCE/RECOMMENDATION
→ (5) uczciwy `UNKNOWN`/`BRAK_API` tam, gdzie danych nie ma → (6) tabela
werdyktów w raporcie.** Kolejność sekcji to kontrakt, nie sugestia.

### E.0 — Flaga + mapa delty + dowód OFF (PIERWSZA, obowiązkowa)

1. **Zgoda na flagę (`E-O2`)** — jeśli nadzorca nie nadał imiennej zgody, cała
   sekcja §E jest `STOP` do zatwierdzenia; robisz mapę delty (pkt 2) i STOP-y,
   nic nie commitujesz poza raportem.
2. **★ Mapa delty runtime vs kontrakt** — główny werdykt dyżuru. Dla każdego
   z czterech zadań wypełniasz tabelę: `element kontraktu → JEST / JEST_CZĘŚCIOWO
/ BRAK_UI_JEST_API / BRAK_API → dowód plik:linia`. To rozstrzyga pułapkę 1
   (§1.5): co realnie daje istniejący generyczny generator, a czego brakuje do
   kontraktu.
3. **Flaga** — dopisujesz `execReportsIntelligence` wzorcem `changeSignals`
   (§2.3). **Dowód OFF od razu** (test T.2, minimum): przy OFF trasa Execution
   renderuje dzisiejszy rejestr, nowa zakładka raportu **nie istnieje**, **zero
   żądań** do nowych endpointów.

**DoD E.0:** tabela delty dla 4 zadań; flaga wzorca `changeSignals` z dowodem,
że nie wpada w fallback `:120`; dowód OFF; STOP-y `E-O1`, `E-O2` opisane.

### E.1 — `EXE-WORK-REPORT-01` Raport pracy (kontrakt `:127-232`)

**Kolejność sekcji — narracja zarządcza (`:163-173`), literalna:**

1. **Kontekst i pasek zaufania** — data stanu, strefa czasowa, ostatnia
   synchronizacja, zakres, filtry, okres porównania, świeżość, wynik
   kompletności danych.
2. **Executive Pulse** — **maksymalnie osiem** kart KPI, każda:
   `wartość · num/denom · delta · kierunek · severity · dokładny drill-down`.
3. **Co boli dziś** — overdue tasks/decisions, SLA breach, due-today, aktywne
   blokery, krytyczne braki danych — rankowane po ekspozycji biznesowej.
4. **Co się zbliża** — horyzont `1–7 · 8–14 · 15–30 · 31–90 · >90 DNI · NO DUE
DATE`, rozdzielając tasks/decisions/milestones.
5. **Co jest zagrożone** — matryca ryzyka BSC (Financial/Customer/Internal/
   People/Governance). **Przy niepełnych mapowaniach: etykieta „operacyjny",
   nie „strategiczny" (`E-O3`).**
6. **Dlaczego** — przyczynowość: blokujące decyzje, zaległe zależności,
   powtarzane przesunięcia, konflikty zasobów, brak właściciela/dowodu;
   **jedna przyczyna źródłowa nie rozdmuchana w wiele alertów**.
7. **Jak system się zmienia** — trend 12-tygodniowy inflow/throughput/net
   backorder/aging/blocked days/decision latency z bazą porównawczą.
8. **Co zarząd ma zrobić** — 3–5 rekomendacji z dowodem, spodziewanym
   odblokowanym przepływem, celami, właścicielem decyzji, odwracalnością,
   pewnością.
9. **Auditable register** — dokładne rekordy, te same filtry i deterministyczne
   formuły co sekcje wyżej; przez `StandardTable`.

**Kanoniczne formuły (`:175-188`)** — przenosisz DOKŁADNIE, wersjonowane
i widoczne z UI: `formalBackorder`, `slaBackorder`, `undatedRisk`, `agingDays`,
`decisionLatency`, `blockedDays`, `throughputRatio`, `netBackorderChange`,
`impactWeightedBackorder` (waga wpływu — `E-O4`), `dataCompleteness`.
`UNKNOWN`/`NOT_APPLICABLE`/`0` = osobne stany.

**Drill-down (`:190-195`):** `KPI → objective/perspective → initiative/team →
owner → task/decision → dependencies/evidence`. Każde zadanie/decyzja otwiera
własną zakładkę Menu 3; powrót przywraca filtry/okres/scroll. **Raport nie
omija governance** — zero mutacji w raporcie.

**Analiza AI (`:197-206`, Z14):** powierzchnia nad istniejącym endpointem albo
`BRAK_UI_JEST_API`. Każde zdanie oznaczone `FACT`/`INFERENCE`/`RECOMMENDATION`
ze źródłem/pewnością/właścicielem. **AI nie zmienia statusu/właściciela/daty.**

**Testy E.1 (min 5, behawioralne):** happy (sekcje w kolejności kontraktu —
asercja na DOM); rekoncyliacja (agregat KPI == liczność drill-down); brak
danych ≠ zielony (undated → data-risk, nie green, nie liczony jako overdue);
błąd API sekcji (jedna sekcja pada → reszta raportu żyje); **dowód OFF**.

**DoD E.1:** tabela werdyktów (8 KPI + 9 sekcji + 10 formuł); rekoncyliacja
udowodniona testem; `E-O3`/`E-O4` opisane STOP-em; drill-down otwiera zakładkę
Menu 3; ≥5 testów; i18n `execution.*`; light/dark; **cztery zrzuty**; prettier;
wpis w raporcie.

### E.2 — `EXE-RESOURCES-REPORT-01` Raport zasobów (kontrakt `:234-248`)

**Objective:** dla wybranego tygodnia bazowego i horyzontu **4/8/12/26 tyg.**
pokazać **każdą osobę** przypisaną do wybranych projektów (także osoby bez
zadania w tygodniu bazowym), jej dostępność, przypisania, projekty, wymagany
wysiłek, zakres saturacji, konflikty, wolną moc, brakujące role/umiejętności
i jawną niepewność danych.

**Workflow (`:240`):** `Nowa analiza → kontekst/zakres → świeżość źródeł →
walidacja braków → deterministyczne obliczenie → przegląd/komentarze człowieka
→ Analyze AI → approve/publish niezmiennej wersji`.

**Layout (`:242`):** pasek zaufania; podsumowanie KPI; **heatmapa obłożenia
osoba×tydzień**; widok Osoby (rola, umiejętności, dostępność, przypisany
wysiłek, zakres saturacji, projekty); widok Projekt (wymagane role, przypisani
ludzie, popyt, pokrycie, wpływ na harmonogram); rejestry konfliktów/braków ról/
braków umiejętności/nieprzypisanej pracy/wolnej mocy; rekomendacje AI;
założenia/rodowód/audyt.

**Miary kanoniczne (`:244`):** dostępna moc po absencjach, stałych obowiązkach,
przyjętych rezerwacjach i **jawnym buforze operacyjnym** (`E-O5`); popyt jako
wartość źródłowa/zakres/klasa/prognoza/`UNKNOWN`; saturacja jako **zakres**
(`demand/capacity`) z konfigurowalnymi progami (`E-O5`); koncentracja alokacji;
udział nieprzypisanej pracy; pokrycie ról/umiejętności; kolejne tygodnie
przeciążenia; świeżość i pewność. **Agregacja nigdy nie ukrywa wejść o niskiej
pewności.**

**Granica AI (`:246`, Z14):** propozycja tworzy governed change proposal dla
Praca/Sterowanie; **nigdy nie mutuje przypisania/osoby/projektu/daty**.

**Testy E.2 (min 4):** wszystkie osoby obecne (także bez zadania w tygodniu
bazowym); drill osoba↔projekt rekoncyliuje; fakty/prognozy/założenia/unknowny
rozróżnialne; **dowód OFF**. Deterministyczność obliczeń saturacji pod testem.

**DoD E.2:** heatmapa + dwa widoki + rejestry; `E-O5` STOP (źródło dostępności

- progi/bufor); niezmienna wersja po publikacji; ≥4 testy; i18n; light/dark;
  zrzuty; prettier; wpis.

**★ Uwaga:** bez potwierdzonego źródła dostępności ludzi (`E-O5`) raport jest
niebudowalny ponad `UNKNOWN`. Jeśli endpointu brak → **STOP `BRAK_API`** i
dostarczasz szkielet z uczciwym `UNKNOWN` wszędzie, nie wymyślasz obłożenia.

### E.3 — `EXE-CONTROL-REPORT-01` Raport sterowania (kontrakt `:250-264`)

**Objective:** zamienić luźną tabelę sygnałów/interwencji w audytowalną pętlę
sterowania dla tygodnia i horyzontu **2/4/8/12 tyg.**: `signal → qualification
→ analysis → human decision → intervention → execution task → outcome
verification → resolve/escalate/reopen`.

**Granice (`:256`):** Praca = źródło zadań; Zasoby = źródło mocy; Sterowanie
**interpretuje wpływ międzydomenowy i rządzi decyzjami/interwencjami**;
Raporty = migawki. **Sterowanie nie duplikuje wykonania zadań ani kalendarzy
zasobów.**

**Layout (`:258`):** pasek tygodnia/zakresu/zaufania; KPI (plan-delivery,
blocked-work, milestone, initiative-risk, dependency, capacity, decision-latency,
intervention-effectiveness); zunifikowany rejestr sygnałów/problemów; widok
przyczynowo-skutkowy; oczekujące/zaległe decyzje; portfel interwencji
(baseline/target/verification deadline); scenariusze forward
(base/optimistic/pessimistic); executive summary + aneks dowodowy.

**Kontrakt epistemiczny (`:260`):** każde zdanie `FACT`/`INFERENCE`/
`RECOMMENDATION`; fakty cytują wersjonowane źródło i czas; wnioski cytują fakty

- pewność; rekomendacje pokazują wpływ/koszt/skutki uboczne/właściciela. Stany
  jawne: `UNKNOWN`, `NOT_VERIFIED`, `INSUFFICIENT_DATA`, `OWNER_MISSING`,
  `DECISION_REQUIRED`.

**Governed workflow (`:262`):** kwalifikacja ustawia kategorię/severity/zakres/
właściciela/**reaction SLA** (taksonomia i wartości = decyzja Piotra); odrzucenie
wymaga uzasadnienia. **AI grupuje/proponuje, ale nie decyduje, nie akceptuje
ryzyka, nie mutuje planów, nie publikuje.** Zamknięcie bez kryteriów sukcesu +
dowodu jest blokowane albo `NOT_VERIFIED`; nieskuteczna interwencja może
otworzyć problem ponownie.

**Testy E.3 (min 4):** pełny rodowód dwukierunkowy (agregat↔sygnał↔decyzja↔
interwencja↔zadanie↔weryfikacja) pod testem; KPI rekoncyliuje; `NOT_VERIFIED`
przy zamknięciu bez dowodu; **dowód OFF**.

**DoD E.3:** pętla sterowania + rejestr + scenariusze; taksonomia severity/SLA
STOP-decyzji Piotra; niezmienna publikacja; ≥4 testy; i18n; light/dark; zrzuty;
prettier; wpis. **Buduje na istniejących sygnałach/interwencjach
(`executionControl.routes.ts`) — nie duplikujesz backendu (Z16).**

### E.4 — `EXE-REPORT-GENERATOR-01` Unijny generator „Zrób raport" (kontrakt `:266-286`)

**★ Zaczynasz od STOP `E-O1` (kanoniczny backend) i `E-O2` (flaga).** Bez
decyzji nie budujesz — robisz mapę delty i STOP-y.

**List-screen contract (`:272`) — twardy:** `Execution → Raporty` zawiera
**tylko** Menu 3, `Zrób raport`, filtry tabeli i tabelę. **Zero kart KPI,
banerów, dashboardów, formularzy i dekoracji między menu a tabelą.** Otwarcie/
generowanie raportu = zamykalna, pełnoekranowa dynamiczna zakładka Menu 3;
wiele raportów naraz, przywracane po odświeżeniu przy ważnej autoryzacji.
**To już częściowo istnieje** (`ExecutionReportsSurface`, `ReportGeneratorWizard`)
— Twoja praca to **domknięcie do kontraktu za flagą**, nie druga implementacja.

**Generator — kreator (`:274`):** (1) typ/nazwa/cel/właściciel/audytorium/język/
wersja bazowa; (2) okres historyczny, osobny `as-of`, tydzień raportowy,
horyzont prognozy, kalendarz/strefa; (3) organizacja/projekty/inicjatywy/statusy/
zespoły/ludzie/role + uzasadnione wykluczenia; (4) wybór sekcji Work/People/
Control/Forecast/AI/data-annex; (5) deterministyczne progi/baseline/RAG; (6)
walidacja przed generacją (świeżość, przypisania, dostępność, estymaty,
własność, daty, ryzyka, baseline); (7) generacja sekcja-po-sekcji z wznawialną
częściową porażką i automatycznym otwarciem zakładki.

**Cykl życia (`:278`):** `GENERATING → DRAFT_DYNAMIC → READY_TO_REVIEW →
IN_REVIEW → READY_TO_PUBLISH → PUBLISHED_SNAPSHOT → SUPERSEDED/ARCHIVED` +
jawne `INCOMPLETE`/`FAILED`. **Wyrenderowany ekran to nie dowód gotowości.**
Odświeżenie draftu pokazuje zmiany źródeł, zachowuje komentarze i **wymaga
potwierdzenia przed nadpisaniem edytowanego tekstu**. **Publikacja jest
atomowa i niezmienna; korekta = nowa wersja z rodowodem.** ★ Ten cykl **nie
pasuje** do żadnego istniejącego backendu (`E-O1`) — mapowanie/decyzja przed
budową.

**Layout pełnego raportu (`:280`):** summary; Praca; Zasoby (osoba→projekty,
projekt→ludzie, moc tygodniowa, umiejętności); Sterowanie; Forecast;
Rekomendacje; Data/Methodology; Version history/Audit. **Fakt historyczny
i prognoza forward — wizualnie i semantycznie rozdzielone.** Każda liczba
drilluje do `źródło/wersja · czas · transformacja · klasa (SOURCE/CALCULATED/
MANUAL/AI/UNKNOWN)`.

**Granica AI i obliczeń (`:282`, Z14):** load/agregacja/RAG **deterministyczne**;
AI wyjaśnia, ale ujawnia execution ID/model/prompt/źródła/pewność, nie ukrywa
braków, nie mutuje źródeł, nie publikuje.

**Publikacja/eksport/bezpieczeństwo (`:284`, `E-O7`):** publikacja zamraża
snapshot/definicję/wersje/korekty/ostrzeżenia/identyfikator integralności.
Reprodukowalny PDF i XLSX (opcjonalnie PPTX/CSV), jawne oznaczenie dynamicznych
draftów. Uprawnienia Viewer/Creator/Editor/Reviewer/Publisher/Admin na poziomie
org/projekt/osoba/sekcja/eksport; **raport nigdy nie rozszerza dostępu do
źródeł**; wszystkie operacje audytowane.

**Testy E.4 (min 5):** czystość ekranu-listy (asercja: między menu a tabelą
brak kart/banerów); kreator rozdziela history/as-of/forecast; wiele raportów
naraz; niezmienność publikacji (po PUBLISHED próba mutacji odrzucona);
**dowód OFF**.

**DoD E.4:** `E-O1`/`E-O2` STOP; mapa delty vs istniejący kreator; kontrakt
czystości listy udowodniony testem; rozdział history/as-of/forecast; niezmienna
publikacja; ≥5 testów; i18n; light/dark; zrzuty; prettier; wpis. **Realistyczny
oczekiwany wynik: `CZĘŚCIOWO` + zestaw STOP-ów** — i to jest wynik dobry.

---

## §T. SEKCJA TESTY — sześć pozycji przekrojowych

Testy §T dowodzą, że **kontrakt modułu nie został złamany** i przeżywają dłużej
niż pojedyncza sekcja raportu. Wszystkie **behawioralne**.

### T.1 — Testy istniejące: jedyny dozwolony przypadek zmiany

Zasada: **NIE ZMIENIASZ** testu, który istniał przed dyżurem. Jeśli Twoja
implementacja go zapala — implementacja jest podejrzana, nie test. Jedyny
wyjątek: test asertuje mechanikę, którą kontrakt każe zmienić — wtedy
**przepisujesz pod nową mechanikę, nigdy nie osłabiasz** (liczba asercji nie
maleje), wypełniasz tabelę `asercje przed/po/osłabiona?` i wklejasz diff.
**Strażnik `executionReportsSurface.test.tsx` musi zostać zielony bez zmiany.**

### T.2 — ★ Dowody OFF zebrane w jednym miejscu

Najważniejszy test przekrojowy. Nowy plik
`src/components/Execution/reports-intelligence/__tests__/reportsFlagOff.test.tsx`.
Minimum sześć asercji: (1) przy OFF trasa Execution renderuje dzisiejszy
rejestr; (2) nowa zakładka „Raport …" **nie istnieje** w Menu 3; (3) **zero
żądań** do nowych endpointów raportowych (spy `toHaveBeenCalledTimes(0)`);
(4) przy ON zakładka istnieje i render **różni się** od OFF (test niezależny od
flagi dowodzi fantomu, nie bramki); (5) flaga Execution nie odblokowuje raportu
innego modułu; (6) na hoście produkcyjnym flaga jest OFF (special-case
`changeSignals` działa).

### T.3 — Enumeracja bramek: żadnego nowego obejścia

Przed/po: liczba miejsc odczytu flag Execution i liczba obejść `||`. Zero nowych
obejść. Wynik do raportu.

### T.4 — Uczciwość wartości: `UNKNOWN` ≠ `0` ≠ zielony

Nowy plik. Minimum: item bez due date → data-risk, **nigdy green, nigdy liczony
jako formal overdue**; KPI bez danych → `UNKNOWN`, nie `0`; saturacja bez
źródła → `UNKNOWN`, nie `0%`; klasa wartości renderowana (`SOURCE/CALCULATED/
MANUAL/AI/UNKNOWN`).

### T.5 — Rekoncyliacja i rodowód

Dla zbudowanych KPI: agregat == dokładna liczność drill-down (asercja
behawioralna). Każda pokazana liczba ma rodowód. To jest rdzeń DoD kontraktu.

### T.6 — Dostępność, responsywność, motywy, FACT/INFERENCE/RECOMMENDATION

Role/etykiety (`getByRole` z `name`); klawiatura (nawigacja sekcji/zakładek,
brak pułapki Tab); fokus widoczny `--c-focus`; stany rozróżnialne bez koloru
(słowo obok koloru); PL i EN nie gubią treści; **FACT/INFERENCE/RECOMMENDATION
rozróżnialne semantycznie**. Plus `KONSOLA-BLEDY`/`SIEC-4XX5XX` z każdego zrzutu.

---

## §R. SEKCJA REJESTR I DOWODY — dwie pozycje

### R.1 — Mapa delty jako produkt (nie zmiana MODULE_ACCEPTANCE)

Tabela delty z E.0 (4 zadania × elementy kontraktu × werdykt × dowód) trafia
**do raportu dyżuru**, nie do `MODULE_ACCEPTANCE.md` (Z13). To jest wejście do
decyzji nadzorcy o kolejnym pakiecie.

### R.2 — Komplet dowodów (Blok 5)

Sześć dowodów (§8 Blok 5), zrzuty, higiena Dockera, testy przed/po, deklaracja
zasięgu, oświadczenie o chronionym WIP.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~60 min, NIE pomijasz)

1. `git fetch --all --prune`; weryfikacja markera:
   ```bash
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   Brak → **STOP i koniec dyżuru**.
2. Weryfikacja materiałów wiążących (§0.1 pkt 3). Brak → **STOP**.
3. Gałąź + worktree (§0.1 pkt 4–5).
4. **Przeczytanie kontraktu w całości** — `MODULE_ACCEPTANCE.md:106-125`
   (uwagi + SSOT) oraz `:127-286` (kontrakt + cztery zadania). Rozjazd
   z instrukcją → wygrywa kontrakt, wpis do „Korekt".
5. **★ WERYFIKACJA MAPY TECHNICZNEJ (§2) — mapa mogła się zestarzeć.** Wykonaj
   wszystko, każdą rozbieżność do „Korekt":
   ```bash
   wc -l src/components/Execution/ExecutionReportsSurface.tsx        # oczekiwane 1222
   wc -l src/components/Execution/ExecutionWorkSurface.tsx            # 999
   wc -l src/components/Execution/ExecutionResourcesSurface.tsx       # 620
   wc -l src/components/Execution/ExecutionControlSurface.tsx         # 1195
   wc -l src/components/Execution/executionFeatureFlags.ts            # 124
   wc -l src/components/Reports/Wizard/ReportGeneratorWizard.tsx      # 655
   wc -l src/components/Reports/reportContentGenerator.ts             # 810
   wc -l server/src/domain/initiatives-execution/reportRun.ts         # 299
   wc -l server/src/routes/managementReports.routes.ts               # 460
   grep -n "changeSignals" src/components/Execution/executionFeatureFlags.ts   # :56 :105 :115
   grep -n "ReportGeneratorWizard" src/components/Execution/ExecutionHub.tsx   # :59 :5693
   grep -n "report-runs\|report-definitions" src/services/initiatives-execution/runtimeApi.ts
   grep -rn "isExecutionFlagEnabled(" src/components/Execution | grep -v __tests__ | grep -v executionFeatureFlags.ts
   ```
6. **★ MAPA DELTY runtime vs kontrakt (E.0 pkt 2)** — dla czterech zadań;
   to jest główny werdykt. Wynik do raportu **zanim** cokolwiek zbudujesz.
7. **Dowód stanu wyjściowego testów** (§2.8) — przed/po do raportu:
   ```bash
   npx vitest run tests/unit/initiatives-execution/executionReportsSurface.test.tsx
   npx vitest run tests/unit/execution/executionReportPdfExport.test.ts
   npx vitest run src/components/Execution/__tests__/ExecutionHub.reportingMenu.smoke.test.tsx
   ```
8. **Stan zastany kanonu** (punkt odniesienia dla Bloku 5):
   ```bash
   bash scripts/check-list-canon.sh 2>&1 | tail -5     # baseline 143 — nie rośnie
   ```
9. **Harness `dev-render` i jeden zrzut kontrolny** (port 3357) — żeby wiedzieć,
   że narzędzie działa. Wynik konsoli jako stan zastany.
10. Założenie pliku raportu (§9) i wpisanie wyników kroków 1–9.

### Blok 1 — flaga + bramka + STOP-y architektoniczne (E.0 → T.2 → T.3)

E.0 pierwsze (flaga + dowód OFF), bo bez pstryczka cała reszta jest
niebezpieczna. Natychmiast T.2 (dowody OFF) i T.3 (brak nowych obejść).
STOP `E-O1`/`E-O2` opisane — **jeśli brak zgody na flagę, zatrzymujesz się tu**.

### Blok 2 — Work (E.1)

Najważniejsza i najdroższa pozycja — właściciel wskazał raport pracy imiennie
(`EXE-OWN-006`). Wewnątrz: sekcje 1-4 (kontekst→pulse→dziś→horyzont) przed
5-9, bo BSC (5) zależy od `E-O3`. Jeśli zabraknie czasu — E.1 domknięte wg DoD
lepsze niż cztery raporty „prawie".

### Blok 3 — Resources i Control (E.2 → E.3)

E.2 zaczynasz od weryfikacji `E-O5` (źródło dostępności). Brak → STOP `BRAK_API`,
szkielet z `UNKNOWN`. E.3 buduje na istniejących sygnałach.

### Blok 4 — Generator (E.4)

Tylko jeśli `E-O1`/`E-O2` rozstrzygnięte. Priorytet: (1) kontrakt czystości
listy (tani, chroni akcept właściciela), (2) rozdział history/as-of/forecast,
(3) niezmienność publikacji, (4) reszta. Realistyczny wynik: `CZĘŚCIOWO` + STOP-y.

### Blok 5 — domknięcie (obowiązkowo, ~60 min, NIE pomijasz)

1. **T.4 · T.5 · T.6 · R.1 · R.2** dla tego, co faktycznie zbudowałeś.
2. **Pomiar zasięgu** wg §0.4a (deklaracja `ZASIĘG PEŁNY`/`CZĘŚCIOWY`).
3. **SZEŚĆ DOWODÓW — wszystkie do raportu:**
   ```bash
   # (1) Z18 — globalna infra testowa                       oczekiwane: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"
   # (2) Serwer nietknięty (Z16) — CAŁY server/ PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/"
   # (3) Flagi — dokładnie jedna nowa, wzorzec changeSignals, zero zmian domyślnych
   git diff codex/m03-admin-20260824...HEAD -- src/components/Execution/executionFeatureFlags.ts
   # (4) Z17 — zakres plików (każdy spoza ramki WOLNO wymaga uzasadnienia)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -vE "^(src/components/Execution/reports-intelligence/|src/components/Execution/executionFeatureFlags.ts|src/components/Execution/ExecutionHub.tsx|src/components/Reports/|dev-render/screens/execution-report-|public/locales/|evidence/execution-day11/|docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY11_REPORT)"
   # (5) Rejestr ExecutionReportsSurface nietknięty
   git diff codex/m03-admin-20260824...HEAD -- src/components/Execution/ExecutionReportsSurface.tsx   # PUSTY
   # (6) Baseline kanonu nietknięty
   git diff codex/m03-admin-20260824...HEAD -- scripts/check-list-canon.baseline.txt                  # PUSTY
   ```
4. **Kanon:** `bash scripts/check-list-canon.sh 2>&1 | tail -5` (143, nie rośnie).
5. **Dowód, że flaga bramkuje** — wynik T.2 asercji 4.
6. **Higiena Dockera** (§0.3a krok 4) — jeśli uruchamiałeś bazę.
7. Ponowne uruchomienie testów stanu wyjściowego (Blok 0) — „po" obok „przed".
8. **Zrzuty** — minimum osiem (§2.11), ze ścieżkami i konsolą.
9. Domknięcie raportu.

### Zasada nadrzędna kolejności

**Lepiej dwie pozycje domknięte wg DoD niż pięć „prawie".** Priorytet: **T.2
(dowód OFF)** → **E.1 (Work)** → **STOP-y `E-O1`/`E-O2`/`E-O3`/`E-O5`**. Blok 5
nie jest opcjonalny. Cztery pozycje otwarte NIE są odkładalne — ich produktem
jest STOP w raporcie, a to kosztuje minuty.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY11_REPORT_<data>.md
```

Raport leży **na poziomie fali**, nie w `modules/06_EXECUTION/` (rejestr modułu
chroniony — Z13). Zrzuty (`.png`) w `evidence/execution-day11/`, wymieniane
ścieżkami. Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Execution dzień 11 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź robocza: codex/execution-day11-<data>
Worktree: /private/tmp/consultify-execution-day11
Zgoda na flagę execReportsIntelligence: NADANA / BRAK (E-O2)
Porty użyte: 3357 (dev-render) / 5441 (jednorazowy PG) / żadne
Kontener PG: consultify-execution-day11-pg (usunięty: TAK/NIE/nie stawiałem)
Czas pracy: <od>–<do>

## Oświadczenie o chronionym WIP (Z4/Z5)

Nie otwierałem, nie czytałem i nie kopiowałem katalogu
/Users/piotrwisniewski/Developer/Consultify. Jedynym źródłem wymagań były
kontrakt modułu, rejestr decyzji i kod w repozytorium. TAK / NIE

## Materiały wiążące — potwierdzenie dostępu

| Plik | Widoczny | Przeczytany |
| modules/06_EXECUTION/MODULE_ACCEPTANCE.md (308 l.) | | :106-125 :127-286 |
| OWNER_DECISION_LEDGER_2026-08-24.md (112 l.) | | :25 (DEC-03) |

## Warunki wstępne — wynik sprawdzenia

| Sprawdzenie | Oczekiwane | Wynik | Dowód |
| Marker przodkiem tipa | TAK | | merge-base |
| ExecutionReportsSurface.tsx = 1222 | TAK | | wc -l |
| executionFeatureFlags.ts = 124, changeSignals :56/:105/:115 | TAK | | grep |
| reportRun.ts = 299, cykl DRAFT→PUBLISHED | TAK | | grep |
| managementReports.routes.ts = 460 | TAK | | wc -l |
| ReportGeneratorWizard montowany w Hubie | TAK | | :5693 |
| executionReportsSurface.test (przed) | X/X PASS | | |
| ExecutionHub.reportingMenu.smoke (przed) | X/X PASS | | |
| check-list-canon: 143 / baseline 143 | dług nie rośnie | | skrypt |

## ★ MAPA DELTY runtime vs kontrakt (główny produkt E.0)

### EXE-WORK-REPORT-01

| Element kontraktu (:147-232) | Werdykt | Dowód plik:linia | Uwaga |
(werdykt ∈ JEST · JEST_CZĘŚCIOWO · BRAK_UI_JEST_API · BRAK_API)

### EXE-RESOURCES-REPORT-01 / EXE-CONTROL-REPORT-01 / EXE-REPORT-GENERATOR-01

(analogicznie)

## Pozycje — tabela zbiorcza

| Pozycja | Zakres | Status | Commit | Testy | Dowód OFF | Zrzut | Uwagi |
| E.0 | flaga + mapa delty + dowód OFF | | | | | | |
| E.1 | Work Intelligence Report | | | | | | |
| E.2 | Resources Capacity Report | | | | | | |
| E.3 | Control Loop Report | | | | | | |
| E.4 | unijny generator | | | | | | |
| T.1..T.6 | testy przekrojowe | | | | | | |
| R.1..R.2 | rejestr/dowody | | | | | | |
(Status ∈ ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · JUŻ_BYŁO · BRAK_API · BRAK_UI_JEST_API · NIE_ZACZĘTE)

## Tabele werdyktów — główny produkt pozycji

### E.1 — Executive Pulse: osiem KPI

| KPI | num/denom obecne? | drill-down rekoncyliuje? | rodowód? | Werdykt | Dowód |

### E.1 — dziewięć sekcji w kolejności kontraktu

| # | Sekcja | Werdykt | Dowód |

### E.2/E.3/E.4 — analogicznie

## Pozycje otwarte — STOP-y do zatwierdzenia

### STOP — E-O1 kanoniczny backend generatora

### STOP — E-O2 zgoda i granulacja flagi

### STOP — E-O3 mapowania BSC (operacyjny vs strategiczny)

### STOP — E-O4 progi/wagi Work (decyzja Piotra)

### STOP — E-O5 źródło dostępności + progi saturacji (decyzja Piotra)

### STOP — E-O6 replay historycznej daty as-of

### STOP — E-O7 eksport PDF/XLSX + Analiza AI

### STOP — <pozostałe>

## Znaleziska (problemy w istniejącym kodzie — NIE naprawiane przeze mnie)

| # | Plik:linia | Co znalazłem | Dlaczego nie naprawiłem |

## Korekty wobec instrukcji

(miejsca, gdzie instrukcja mówiła coś innego niż zastany kod — z dowodem)

## Testy

### Testy własne

| Plik testowy | Nowy/zmieniony | Behawioralny? | Liczba asercji | Wynik |

### Zmiana testu istniejącego

| Test | Asercje przed | Asercje po | Osłabiona? |
| (oczekiwane: BRAK ZMIAN) | | | MUSI BYĆ: NIE |

### Zasięg

ZASIĘG PEŁNY / CZĘŚCIOWY — <co uruchomione, co pominięte i dlaczego>

## Sześć dowodów Bloku 5

(wyniki sześciu komend + kanon + higiena Dockera)

## Zrzuty

| # | Ekran | Motyw | Ścieżka | KONSOLA-BLEDY | SIEC-4XX5XX |

## Gotowość

Gotowe do zrzutu przez nadzorcę: TAK / NIE (per pozycja)
```

---

**Koniec instrukcji nr 11.**
