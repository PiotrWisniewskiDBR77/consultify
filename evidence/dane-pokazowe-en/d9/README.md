# D9 — dosiew po teście TEST-DANE · dowód z kopii lokalnej

**Zlecenie:** `docs/program/TEST_JEZYK_I_DANE_20260909/RAPORT_DANE.md` §5 — pięć braków.
**Etap:** `server/scripts/seed/demo-en/09-dosiew-po-tescie.ts`.
**Data:** 2026-09-09.

## Stanowisko pomiaru

| Element | Wartość |
|---|---|
| Baza | `consultify_kopia_d31` — kopia szablonu `consultify_staging_czysta` (zrzut stagingu po czystce 09.09), Postgres 18, kontener `consultify-pg18`, `127.0.0.1:54418` |
| Kod | worktree `~/Developer/wt/dane-d9`, gałąź `mvp/dane-d9-dosiew-0909` |
| API | port **4210**, `NODE_ENV=development`, `CI=true`, `ENABLE_V8_GLOBAL=true`, `DB_MANAGED_SCHEMA=off`, `MOCK_REDIS=true` |
| Vite | port **3228**, `--mode test`, 34 flagi `VITE_*` ze stagingowego `server.env` |
| Organizacja | Northwind Manufacturing Ltd. `468b234c-66c4-54e1-b626-5e0fb3a92f6a` |
| Konto | `james.whitfield@northwind.example` (OWNER), EN, **1440×900** |
| Zrzuty PRZED | `evidence/test-jezyk-dane-0909/dane/` — 70 ekranów przebiegu 2 testu TEST-DANE, **na tym samym szablonie bazy**; nie powtarzaliśmy ich |
| Zrzuty PO | ten katalog, `PO-*.png` (11 ekranów) |

> **Motyw:** zrzuty PO są w motywie CIEMNYM, zrzuty PRZED (TEST-DANE) w JASNYM.
> Motyw nie był przedmiotem tej paczki i nie wpływa na żadną z mierzonych liczb,
> ale pary PRZED/PO nie są przez to identyczne wizualnie — przy porównywaniu
> patrz na treść pól i liczby, nie na kolory.

## PRZED → PO — pięć braków

Liczby PRZED: [`pomiar-PRZED.txt`](pomiar-PRZED.txt) · PO: [`pomiar-PO.txt`](pomiar-PO.txt)
(oba z tego samego skryptu [`pomiar-5-brakow.sql`](pomiar-5-brakow.sql)).

| # | Brak | PRZED (SQL) | PO (SQL) | PO (UI, zrzut) |
|---|---|---|---|---|
| 1 | **Organizacja — profil** | `industry_code` puste · `strategic_priorities` `[]` · `technology_stack` `[]` · `primary_markets` `[]` · `digital_maturity_overall` NULL · `profile_completeness` **0** | kod `C25.62` · priorytety **4** · stos **5** · rynki **4** · dojrzałość **3,4/7** · kompletność **100 %** | INDUSTRY pokazuje **„Manufacturing"** zamiast „—”; chipy ekranu Identity: **All 13 · Filled in 13 · To fill in 0**; panel DATA STATE: **13/13** — `PO-brak1-organizacja-profil.png` |
| 2 | **Wywiad — przydziały** | `interview_assignments` **0** · członkowie **0** · w skrzynce właściciela **0** | przydziały **3** (`assigned`/`submitted`/`approved`) · członkowie **7** · w skrzynce właściciela **3** | Inbox ma **3 wiersze** zamiast „No assignments”: Approved · Submitted · Assigned, właściciele Robert Chen · Sarah Mitchell · James Whitfield — `PO-brak2-wywiad-inbox.png` |
| 3 | **Wyniki — migawka przeglądu** | migawek **0** (stąd jedyne 4xx całego testu) | **1** `published`, `snapshot_payload.items` = **8** | zakładka **Review snapshots**: wiersz „Jul 1, 2026 – Oct 1, 2026 · **Published** · Sep 9, 2026”; **0 odpowiedzi 4xx** na całej ścieżce — `PO-brak3c-migawka-przegladu.png` |
| 4 | **Realizacja — rozkład w czasie** | popyt **356 h** w oknie 8 tygodni · wykorzystanie **13 %** · zaległość **73 h** | popyt **1230,4 h** · wykorzystanie **45–46 %** · zaległość **169 h u 6 osób** · **8 z 8** tygodni z popytem | pasek Zasobów: „people 9 · demand **1230.4 h** · supply 2704 h · **utilisation 46 %** · backlog **169 h across 6 people**”; kolumna **BACKLOG (H)** pokazuje liczby (7 h, 18 h) zamiast samych „—” — `PO-brak4-realizacja-zasoby.png` |
| 5 | **Pola pochodne** | `current_stage` **0/13** · `baseline_end_date` **0/13** · `axis` **0/13** · `exportFormat` **0/7** · pozycje karty KPI z AREA **0/8** | **13/13** · **13/13** · **13/13** · **7/7** · **8/8** | raport KPI grupuje wiersze po obszarach: **MANUFACTURING PERFORMANCE · QUALITY · SUPPLY CHAIN · ENERGY & SUSTAINABILITY** (przedtem jedna grupa „No area”) — `PO-brak3b-wyniki-przeglad-karty.png`; FORMAT/SOURCE 7/7 z tej samej trasy, z której czyta lista — [`brak5-artefakty-api.json`](brak5-artefakty-api.json) |

## Bramki

| Bramka | Wynik |
|---|---|
| `09-dosiew-po-tescie.ts --verify` | **25/25 OK** (5 kontroli, po jednej na brak) — [`verify-PO.txt`](verify-PO.txt) |
| `99-verify.ts --verify` | **40/40 OK** (D1 + 16 kontroli D9) |
| `vitest run --config vitest.orphans.config.ts server/tests/seed-demo-en/09-dosiew.test.ts` | **33/33** |
| `tsc -p server/tsconfig.json --noEmit` | **0** |
| Idempotencja (drugi `--apply`) | `utworzono=0 zmieniono=1 pominieto=77`; liczby stabilne (przydziały 3, członkowie 7, migawki 1). `zmieniono=1` to bezwarunkowy PUT profilu — pełny ładunek, nie przyrost |
| Błędy konsoli / 4xx / 5xx na 11 zrzutach | **0 / 0 / 0** — [`zrzuty-wynik.json`](zrzuty-wynik.json) |

## Co się okazało DEFEKTEM KODU, nie danych

| Co | Ustalenie |
|---|---|
| **D-03 — INDUSTRY „—”** | **To był defekt DANYCH i został naprawiony zasiewem.** UI czyta `profile.industry` (wypełnione: „Industrial Manufacturing”), ale rysuje je natywnym `<select>`, którego opcje pochodzą wyłącznie ze słownika `INDUSTRIES` (`organizationProfileTaxonomy.tsx:164-183`). „Industrial Manufacturing” w tym słowniku **nie występuje** (są osobno „Manufacturing” i „Industrial”), więc `<select>` pokazywał `emptyLabel = '—'`. Wartość musi należeć do słownika → `industry = 'Manufacturing'`, doprecyzowanie w `industry_subsector` i `industry_code`. Poprawka poszła też do `01-rdzen.ts`, inaczej ponowny `01 --apply` cofnąłby ją przez `ON CONFLICT DO UPDATE` |
| **Cztery liczniki kompletności profilu** | `profile_completeness` **nie jest liczone przez serwer** — trasa `PUT /api/organization-profiles/:orgId` (`:439,502`) przyjmuje tę liczbę z ciała żądania. Liczy ją front. W module żyją CZTERY różne definicje: 13 pól (chipy ekranu Identity — to z nich pochodziło raportowe „8/13”), 15 pól (`completenessChecks`, trafia do kolumny), 5 pól (własne liczenie backendu w `GET`, `:226-235`) i sama kolumna. **Dług kodu, nie danych** |
| **D-08 — kolumna BACKLOG (H)** | Nie jest zepsuta. Serwis stawia zaległość **tylko w wierszu pierwszego tygodnia** (`workloadCapacityService.ts:995`), w pozostałych 0 → front rysuje „—” (`ExecutionResourcesSurface.tsx:489`) i to jest ZAMIERZONE (żeby nikt nie zsumował jej ośmiu razy). Przy 72 wierszach liczba stoi w co najwyżej 9 z nich. Osobno: zaległość liczy się z `estimated_hours − actual_hours` zadań po terminie, a zadania osobiste właściciela nie miały ANI JEDNEJ estymaty — stąd jego wiersz był pusty |
| **D-18 — kolumny FORMAT i SOURCE** | Obie mają `defaultVisible: false` (`OutputsAggregateTabContent.tsx:479,550`), więc **nie widać ich na zrzucie bez ręcznego pstryczka kolumn**. Dane są: 7/7 artefaktów ma `exportFormat` i `originRuntime` — dowód z tej samej trasy, z której czyta lista, w `brak5-artefakty-api.json` |
| **D-18 — kolumna AREA/AXIS** | `initiatives.area` było wypełnione **13/13 już przed D9**, a kaskada `resolveInitiativeAreaOrAxis` zaczyna od `area` (`initiativeRegisterColumns.shared.ts:142-160`). Ta kolumna nie była pusta z powodu danych. `axis` uzupełniono (0/13 → 13/13), bo zasila etykietę typu realizacji |
| **D-12 — „VII 2026”** | Nadal widoczne na ekranie Wyników (rzymski miesiąc, konwencja polska) — **kod, poza zakresem D9** |
| **D-17 — „3 V9 overrides”** | Nadal na każdym zrzucie — **kod, poza zakresem D9** |

## Dwie pułapki stanowiska (dla następnego, kto to uruchomi)

1. **`server.env` przekierowuje API na staging.** Plik niesie `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` wskazujące staging i **nie ma `DATABASE_URL`**. Samo podanie `DATABASE_URL=…kopia…` NIE wystarcza — aplikacja bierze `DB_*`, próbuje połączyć się ze stagingiem i **wisi w ciszy** na „[Server] Initializing database…” (jeden zmangłowany wiersz `error: %s` i nic więcej; port nigdy nie zaczyna słuchać). Trzeba nadpisać **wszystkie** `DB_*`. Poza tym `DISABLE_RATE_LIMIT=true` z tego pliku wywraca start, a linia 32 (`DEMO_ORG_NAME=Demo Organization`, bez cudzysłowów) psuje `source`.
2. **Wzorzec czytania hasła z harnessu TEST-DANE zwraca datę.** `/(has(?:ł|l)o[^:]*:\s*(\S+))/i` trafia teraz w NOWĄ pierwszą linię pliku sekretów („Rotacja hasła: 2026-09-09T18:23…”) i zwraca datę zamiast hasła. Objaw: logowanie wisi, `waitForURL` kończy się timeoutem, ani słowa o haśle. Skrypt D9 celuje w konkretną linię.
