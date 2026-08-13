# Finance v3 — handoff sesji „Complete Product Integration" (2026-08-11)

Sesja przerwana **wyczerpaniem budżetu tokenów**, nie blokerem technicznym.
Cztery pakiety fali C zatrzymane w locie i **zabezpieczone** — patrz §6.

---

## 1. STAN ZAMROŻONY — nie dotykać (bez zmian)

**`codex/finance-v3-closeout-fanin` @ `19b4b06934`** — ROI-E007 Round 1, zaakceptowany przez
właściciela. **Zweryfikowane w tej sesji:** nadal przodek swojej gałęzi (tip `36ae9b3665`),
**nietknięta** — zero merge'ów, zero pushów, zero połączeń ze staging/demo/produkcją.

---

## 2. GAŁĄŹ INTEGRACYJNA — punkt startu

**`codex/finance-v3-complete-product-integration` @ `45c39d68d0`**
Worktree: `~/consultify-wt/fv3-product`

Zbudowana z `8f16403ff6` (tip poprzedniej sesji) + `d06a8d5965` (korekta z sesji równoległych).
Scalone pakiety: **M, B, A, B2, C**.

### Stan mierzalny na `45c39d68d0`

| Bramka | Wynik |
|---|---|
| Migracje STRICT, świeża baza (bez `--safe`) | **exit 0, 637**, 1580 tabel |
| `tsc --noEmit -p server/tsconfig.json` | **exit 0, zero linii** |
| **Powierzchnia HTTP `/api/v8/finance-v2/*`** | **32 endpointy** (na starcie: **2**) |
| `src/services/finance` | 50 plików / 741 testów (pomiar pakietu A) |

**NOT PUSHED / NOT MERGED / NOT DEPLOYED / STAGING NOT VERIFIED / PRODUCTION NOT VERIFIED.**

---

## 3. ★ USTALENIE, KTÓRE STERUJE CAŁYM PROGRAMEM

Zmierzone, nie założone, na starcie sesji:

> **Finance v3 miał 61 plików serwisów i 2 endpointy HTTP.**
> Silniki pięciu domen były skończone i **nieosiągalne z zewnątrz**.
> Frontend miał 66 komponentów Finance wołających **wyłącznie legacy** `/api/v8/finance`.

Dlatego **warstwa API była wąskim gardłem** i pakiety produktowe **nie mogły** ruszyć równolegle —
nie miałyby czego wołać. Kolejność fal wynikała z zależności, nie z ostrożności.

Po tej sesji: **32 endpointy zamontowane produkcyjnie**, a pakiet B3 (przerwany) doprowadził
na swojej gałęzi do **53**.

---

## 4. CO ZOSTAŁO DOSTARCZONE I ODEBRANE

| Pakiet | Gałąź | Tip | Status | Zawartość |
|---|---|---|---|---|
| **M** — inwentaryzacja UI + harness | `codex/fv3p-m-inventory` | `1a6c507f0d` | `PASS` | mapa 66 komponentów, stan 22 wymagań właścicielskich, **naprawa martwego harnessu**, 7 zrzutów |
| **B** — powierzchnia HTTP | `codex/fv3p-b-api` | `40ff98a94e` | `PASS` | inwentaryzacja 61 serwisów, 2→12 endpointów, cross-tenant 8/8 |
| **A** — determinizm | `codex/fv3p-a-determinism` | `1ac575a661` | `PARTIAL` | 25 zapytań w audycie, 5 naprawionych, 20 świadomie zostawionych |
| **B2** — endpointy domenowe | `codex/fv3p-b2-domainapi` | `d0a9f13acb` | `PASS` (z uwagą) | 12→32, cross-tenant 10/10, D2/D3 naprawione |
| **C** — platforma UI | `codex/fv3p-c-uiplatform` | `ffc4c168ad` | `PARTIAL` | klient API, `FinanceWorkspaceBar`, Focus Mode, error boundary, 20 zrzutów |

### Najważniejsze ustalenia merytoryczne

**Pakiet M — harness był MARTWY.** Brakowało jednego pliku
(`dev-render/screens/tools-sesja-wyjscie.tsx`), co wywalało **wszystkie 136 ekranów**.
Ten sam wzorzec „jeden brakujący plik = cały harness" wystąpił w tym repo już kilkakrotnie.
Naprawiony minimalnie.
**`FinanceHub` (lista+preview) JEST zgodny z TRIADA — wszystkie 5 workspace'ów szczegółu jest bespoke.**
Zakres przebudowy jest więc węższy, niż się wydawało: **listy zostają** (`OWN-FIN-001`).
**Martwy kod:** 19/20 `Economics/panels/`, 9/9 `Economics/charts/`, `financeValuationApi.ts` —
zero mountów produkcyjnych; w `dev-render` siedział komentarz **fałszywie** twierdzący,
że dwa panele są „wired to real data".
**0/22 wymagań właścicielskich spełnionych w pełni**, 3 częściowo, 17 wcale.

**Pakiet B — `401` nie dowodzi montażu.** Auth stoi przed routingiem, więc fałszywa trasa też
zwraca 401. Działający wzorzec: z ważnym kontekstem porównaj **`404` z `code:'NOT_FOUND'`**
(trasa jest, zasobu brak) z **`404` bez `code`** (trasy nie ma). **Powtarzać w każdym pakiecie API.**

**Pakiet A — dwa NOWE defekty poza trzema znanymi**, w `predictionPreflightService`:
`assumption_set_semantic_hash` liczony z nieuporządkowanych zapytań oraz `layer2Combined`
sumowany z nieuporządkowanego `jsonb_agg`. Decyzja DEC-FIN-012: **`DISCRETIONARY_REPAYMENT`
przed `FACILITY_DRAWDOWN`**, zaimplementowana jako **nazwana, eksportowana stała**
`FINANCING_KIND_PROCESSING_RANK` — audytowalna, nie ukryta w sortowaniu inline.
Rachunek permutacyjny: **5040 permutacji → 6 różnych sum float64**.
**★ Pułapka metodyczna:** pierwsza losowo wybrana permutacja **przypadkowo pokryła się**
z kolejnością bazową — trzeba było zweryfikować konkretną permutację skryptem, zanim
użyto jej jako kontroli negatywnej.

**Pakiet B2 — `preflight` i `calculate` są OSOBNYMI endpointami** (DEC-FIN-004).
Uwaga do odnotowania: agent tknął **6 plików serwisowych**, nie 2 zadeklarowane w podsumowaniu.
Sprawdzone — wszystkie to **czysto addytywne cienkie readery, zero usunięć**, raport je opisuje.

**Pakiet C — nie napisał logiki paska od zera.** Odkrył, że fala AP zbudowała już backendowe
kontrakty (`workspaceBarContract.ts`, `focusModeContract.ts`, `lineageNavigatorContract.ts`)
i **sportował je do Reacta**. Przy testach klienta złapał **dwa realne bugi**: `approveFinanceModel`
zwracał `undefined` (endpoint oddaje płaskie ciało bez koperty `{data}`), a `.code` błędu żyje
pod `.data.code`. Flaga `financeWorkspacePlatformV1`, `defaultValue: false`, **zero importerów
produkcyjnych**.

---

## 5. ★ ODBIÓR WIZUALNY PRZEZ OPUS — czego raporty tekstowe NIE pokazały

Zgodnie z regułą #7 orkiestrator **osobiście obejrzał zrzuty**. Poniższe **nie było**
w żadnym raporcie agenta.

### 5A. Workspace Models (stan zastany) — sześć naruszeń, zakres pakietu F

| # | Naruszenie | Źródło wymagania |
|---|---|---|
| **V-1** | **`Oś czasu zdarzeń` jest zakładką w Baseline** | Baseline jest z definicji **no-decision** (DEC-FIN-002); zdarzenia należą do Prediction |
| **V-2** | **`Wyceń model` w pasku głównym** | `OWN-FIN-018` — wycena jest downstream |
| **V-3** | **Cztery główne widoki zamiast dwóch** | `OWN-FIN-017` — mają być `Założenia` i `Wyliczenia` |
| **V-4** | **Mieszanka językowa**: `GROUNDED ON`, `Seeded from statement`, `IMPORTED FROM STATEMENT`, `Refresh from source`, `Version history` obok polskiego | Jednolity język UI; `REVENUE`/`COGS` dopuszczalne jako skróty kanoniczne, reszta nie |
| **V-5** | **~50% szerokości to martwa przestrzeń** | Limit 25% |
| **V-6** | Wielopiętrowy nagłówek, brak fullscreen, `Version history` w treści strony, pływające `← Lista`/`Uwagi` nachodzące na obszar roboczy | `OWN-FIN-011`/`004`/`012`/`013` |

**Do rozstrzygnięcia odczytem:** pole `Gotówka` pokazywało `0` z podpisem `IMPORTED FROM STATEMENT`.
Realne zero — poprawne. **Brak danych wyrenderowany jako zero — łamie twardą zasadę produktu.**

### 5B. `FinanceWorkspaceBar` (pakiet C) — kryterium spełnione, ale…

**Twarde kryterium PRZESZŁO:** 60-znakowa nazwa przy 1280 px **bez nakładania**,
po prawej **dokładnie 5 kontrolek**, fullscreen ostatni, jeden pasek zamiast trzech pięter.

**Ale: status jest podany TRZY RAZY** w jednym pasku — chip `v3 · robocza`, chip `Wersja robocza`
i menu lifecycle też `Wersja robocza`. Kanon: tożsamość to nazwa + wersja/status, reszta do
Context popover. **Do naprawy w pakietach D–H.**

---

## 6. ★ PRACA ZATRZYMANA W LOCIE — ZABEZPIECZONA, NIE SCALONA

Cztery pakiety fali C przerwane. **Commity są w gicie**; część pracy została **niescommitowana
na dysku** w worktree. **Nie scalać bez weryfikacji** — to kod w połowie edycji, nietestowany.

**Wszystko zostało ZACOMMITOWANE** przed końcem sesji — każdy pakiet ma na szczycie commit
`wip(...)` **jawnie oznaczony jako UNVERIFIED**. Drzewa robocze są czyste (0 niescommitowanych).

| Pakiet | Gałąź | Tip (WIP) | Commitów | Co zawiera commit WIP |
|---|---|---|---|---|
| **B3** Valuation API | `codex/fv3p-b3-valuationapi` | **`9604652e27`** | 3 | 2 pliki testów (`valuation.routes.pg.test.ts`, `valuation-cross-tenant.routes.pg.test.ts`) — **napisane, nieuruchomione** |
| **D** Statements | `codex/fv3p-d-statements` | **`53c2a6e382`** | 3 | `ReconciliationLedgerPanel`, `RelatedArtifactsSection`, `SourceEvidencePanel` + test |
| **E** Analysis | `codex/fv3p-e-analysis` | **`1aa63c0385`** | 5 | `AnalysisKpiDetailCard`, `AnalysisKpiTable`, `useFinanceAnalysisWorkspaceFlag` |
| **F** Baseline | `codex/fv3p-f-baseline` | **`2057e0c888`** | 2 | `BaselineWorkspace.tsx`, katalog `baseline/`, flaga, **modyfikacje `financeV2.api.ts`/`.types.ts`** |

**★ Commity WIP nie były typecheckowane, testowane ani recenzowane.** Niektóre pliki mogą być
w połowie edycji i składniowo niekompletne. Zacommitowane **wyłącznie po to, żeby praca
przetrwała do następnej sesji** — traktuj każdy plik jak szkic i przed rozbudową uruchom
progi odbioru danego pakietu od nowa.

**★ B3 doszedł najdalej: na swojej gałęzi powierzchnia HTTP to 53 endpointy** (32 → 53,
21 nowych `/finance-v2/valuation/*`). Testy kontraktowe i cross-tenant **napisane, ale
niezacommitowane i nieuruchomione** — to jest pierwsza rzecz do domknięcia.

**Uwaga kolizyjna:** pakiet F zmodyfikował `src/services/api/financeV2.api.ts` i `.types.ts` —
te same pliki rozszerzają D i E. **Przy fan-inie spodziewaj się konfliktu w kliencie API.**

---

## 7. CO ZOSTAŁO DO ZROBIENIA — kolejność

### Natychmiast (domknięcie fali C)
1. **B3** — zacommitować i uruchomić 2 gotowe pliki testów; udowodnić montaż wzorcem
   404-z-`code`; macierz cross-tenant; **dowód `N/A` ≠ `PLN 0`** dla metody bez danych;
   sprawdzić zachowanie wag (koszyk = 100%, cross-checki **nieważone**).
2. **D, E, F** — dokończyć; **F ma dodatkowo zamknąć V-1…V-6** i dostarczyć zrzut „przed/po".
3. **Fan-in** — konflikt w `financeV2.api.ts`/`.types.ts` rozwiązać zachowując **wszystkie** rozszerzenia.

### Luki `EVIDENCE_MISSING` odziedziczone z tej sesji
- **Happy path `POST /baseline/:id/compute`** (zbieżny solver) i **`POST /prediction/:id/calculate`**
  (stan `COMPUTED`) — pakiet B2 testował tylko ścieżki błędów, bo fikstura solvera przekraczała
  budżet. **Zakres pakietu F.**
- **Pakiet A `PARTIAL`** — brak fikstury e2e dla `runOverlayCompute()`/`runPreflight()`;
  takiej fikstury **nie ma nigdzie w repo**.
- **Pakiet C** — `CompactLineageTrail` i `RelatedArtifactsDrawer` niepokryte;
  backend ma gotowy `lineageNavigatorContract.ts`.
- Niepokryte obszary API: compare, comments/review, saved views, import/export, collaboration;
  Statements source evidence i Analysis benchmark **nie mają writerów w repo** — endpoint byłby
  trwale pusty.

### Potem
4. **G (Prediction)** i **H (Valuation)** — piony produktowe; H zależy od domknięcia B3.
5. **I** (a11y/design-system), **K** (browser E2E + dowody wizualne), **J** (RealDB/security),
   **L** (adwersaryjny CFO/model-risk).
6. **Pełny przebieg na jednym candidate SHA** — protokół i skrypt gotowe, patrz §9.

---

## 8. BLOKERY ZEWNĘTRZNE — nieosiągalne lokalnie, nie próbować

| Pozycja | Dlaczego |
|---|---|
| **FC-09, FC-10** (16 warunków) | Wymagają wyrenderowanego UI i pomiaru czasu użytkownika — **adresowane przez ten program**, ale dopiero po D–H |
| **FC-12** (6 warunków) | Wymaga **niezależnego recenzenta CFO** — człowieka z zewnątrz |
| **Aktywacja RLS** | Wymaga **least-privileged roli DB** na Railway. Dziś jedyna rola to `postgres` — superuser z `rolbypassrls`, właściciel wszystkich tabel. **Superuser omija RLS zawsze, nawet z `FORCE`.** Polityki są napisane i przetestowane, ale **inertne** |
| **Cutover / rollback / shadow parity** | Wymaga prawdziwego stagingu |
| **SLO produkcyjne p50/p95/p99** | Rozrzut **9,3×** między dwoma przebiegami na tej samej maszynie. Zadeklarowano tylko **próg regresyjny CI** |
| **EM-5 pula workerów** | `compute_jobs` **nie ma kolumny payloadu** — nie da się odtworzyć parametrów zadania, którego się samemu nie zakolejkowało |
| **Stan demo/staging** | Nikt nie sprawdził, czy tabela ochronna tam istnieje i ma triggery |

**Ustalenie zmieniające kalkulację ryzyka:** **Finance v3 nie istnieje na żadnej żywej bazie.**
Odczyt `information_schema` dał: PROD **0**, DEMO **2** (stary, niezwiązany moduł), DEV **1**
tabel `finance\_%`. `finance_analysis_kpi_values`, `finance_working_revisions`,
`compute_job_outputs` — **nie ma ich nigdzie**. Liczba zapisanych `content_semantic_hash`,
które naprawy mogłyby unieważnić, wynosi **ZERO**; spór o backfill jest **bezprzedmiotowy**,
dopóki migracje nie wejdą na demo.

---

## 9. PROTOKÓŁ PEŁNEGO PRZEBIEGU NA JEDNYM SHA

Skrypt: `single_sha_evidence_run.sh` w korzeniu worktree `~/consultify-wt/fv3-fanin2`
(poprzednia sesja). Użycie: `bash single_sha_evidence_run.sh <PORT> <TAG>`.

Ma **twardą bramkę na starcie**: brudne drzewo = przerwij, bo „jeden candidate SHA" przy
niescommitowanych plikach jest fikcją. Bramka **zadziałała** — zatrzymała własny przebieg
na nieśledzonym katalogu wyników poprzedniego.

Kroki: migracje STRICT → finance → **kontrola negatywna bramki DB** → canonical → roi →
resultsVnext → `tsc` → dług typów testów.

**Krok 08 (dług typów w testach) jest `EVIDENCE_MISSING`** — pomiar był źle skonstruowany
trzykrotnie: (1) 2274 błędy `TS6059` = artefakt dziedziczonego `rootDir: server`;
(2) po poprawce **exit 134 (OOM), który przy zerze błędów wygląda na sukces**;
(3) po obu poprawkach 7218 błędów, **nieporównywalnych**, bo zakres objął całe drzewo testowe
i brak globali vitest. Wiarygodny pomiar delty to **353 → 48** z `W9_TYPEDEBT_B_VERIFICATION_report.md`.

**Zakres uczciwy:** ten przebieg domyka **warstwy 1–3** protokołu §16A.
**Warstwa 4 (Playwright E2E) i 5 (odbiór CFO/QA/design) są nieosiągalne** bez UI i recenzenta.

---

## 10. PUŁAPKI ŚRODOWISKOWE — dwanaście, wszystkie zweryfikowane

1. **Bramka DB wymaga TRZECH naraz**: `RUN_DB_TESTS=1` **i** `MOCK_DB=false` **i** jawny
   `DATABASE_URL`. Bez `DATABASE_URL` config podstawia adres, który **na tej maszynie odpowiada**
   → podłączysz się do cudzej bazy zamiast się pominąć. `NODE_ENV=test` bez `RUN_DB_TESTS=1`
   = **cichy mock**.
2. **postgresql@15, NIE @16** — @16 nie ma pgvector, migracje padają.
3. **`LC_ALL=C` przy `initdb` ORAZ `pg_ctl start`** — inaczej „postmaster became multithreaded".
4. **Vitest: `server/src/**` z katalogu `server/`, `tests/**` z korzenia repo.**
   Zły katalog → „No test files found" + exit 1, mylone z „nic do zrobienia".
5. **`server/tsconfig.json` wyklucza `**/*.test.ts`, vitest używa esbuilda** → **zmiana sygnatury
   funkcji nie ma ŻADNEJ automatycznej ochrony**. Po każdej grepuj wywołujących w `server/src`
   **oraz** `tests/`. W poprzedniej sesji taka zmiana złamała test z innego strumienia.
6. **`tsc` pada z exit 134 (SIGABRT/OOM) i przy zerze błędów WYGLĄDA NA SUKCES** —
   sprawdzaj kod wyjścia. `NODE_OPTIONS=--max-old-space-size=12288`.
7. **Tymczasowy tsconfig `extends` z `server/tsconfig.json` dziedziczy `rootDir: server`**
   → lawina `TS6059` udająca regresję. Nadpisz `rootDir: "."`.
8. **`git stash` jest WSPÓŁDZIELONY** między worktree — **nigdy** go nie używaj.
   Do cofania: `git show <parent>:<plik> > <plik>`.
9. **Jeden worktree = jeden agent.** Vitest zbiera z dysku, nie z indeksu gita.
10. **PGDATA nigdy w katalogu scratchpada sesji** — inna sesja skasowała agentowi `PGDATA`
    w trakcie przebiegu.
11. **`.claude/launch.json` jest WSPÓŁDZIELONY** — tylko dopisuj wpisy, nigdy `git checkout --`.
12. **Maszyna bywa saturowana przez równoległe sesje** (load dochodził do **264**).
    `tsc`, który schodzi w 7 s, potrafi trwać 10+ minut. **To nie jest regresja** — zweryfikuj,
    zanim zdiagnozujesz.

**Migracje uruchamiaj STRICT, bez `--safe`** — `--safe` zamienia padniętą migrację
w `skipped` + exit 0 i ukrywa awarię.

---

## 11. METODA, KTÓRA SIĘ SPRAWDZIŁA

- **Jeden worktree = jeden agent + jawny podział własności PLIKÓW w briefie.**
  Osiem gałęzi poprzedniej fali scaliło się z **jednym** trywialnym konfliktem.
- **Weryfikację zleca inny agent niż autor.** Tak wyszła mutacja międzytenantowa `claim()`,
  której pierwotny pomiar nie zauważył, bo zaufał założeniu ADR o puli workerów, **która nie istnieje**.
- **Kontrola negatywna obowiązkowa** — wielokrotnie ujawniła obronę wielowarstwową:
  cofnięcie serwisu nie odtwarzało defektu, bo bronił już klucz obcy.
- **★ Przy defektach zależnych od kolejności z Postgresa nie opieraj dowodu na powtarzaniu
  przebiegów** — Postgres nie ma obowiązku rozjechać się na żądanie. Uzupełnij **rachunkiem
  permutacyjnym**.
- **`EVIDENCE_MISSING` pisany wprost**, nie zaokrąglany w górę.
- **Reguła #7 działa i wyłapuje rzeczy, których raporty nie pokazują** — sześć naruszeń kanonu
  wyszło z **obejrzenia zrzutu**, nie z czytania tekstu.
