# F‑M5 — ogniwo 1: import zakłada kalendarz, okresy i jednostkę + backfill DBR77

Gałąź `fin/fm5-kalendarz-okresy`, baza `origin/staging` (`86dcd149a2`), **bez push**.
Zlecenie: „na stagingu ma powstać realna analiza finansowa DBR77".

---

## 1. Co zbudowano

### `server/src/services/finance/canonical/financeCalendarService.ts` (NOWY)

Siódmy brakujący producent z audytu F0 §2.3. Sprawdziłem liczbę sam, zanim ruszyłem kod:

```
grep -rn "INSERT INTO finance_stmt_periods"   server/src --include='*.ts' | grep -v __tests__
  -> server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:122        (1 trafienie, skrypt dowodowy)
grep -rn "INSERT INTO finance_stmt_calendars" server/src --include='*.ts' | grep -v __tests__
  -> server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:105        (1 trafienie, skrypt dowodowy)
```
**Zgodne z audytem: zero producentów produkcyjnych.**

Eksporty: `ensureCalendar`, `ensurePeriods`, `ensureStatementPackEntity`,
`ensureStatementPackTemporalContext` (orkiestrator), `derivePeriodShape`, `entityCodeFromName`,
`readLegacyPackPeriods`. Wszystkie świadome transakcji wołającego
(`getCurrentPgTransactionClient`, wzorzec z `analysisDefinitionService`).

### Wpięcie w `confirmAndRegisterStatementPack`

`statementPackRegistrationService.ts` — `ensureTemporalContextForPack` woła się w **tej samej
transakcji**, we **wszystkich trzech** ścieżkach powrotu (świeża rejestracja + dwie ścieżki
powtórki). Powtórka też zakłada okresy: pakiety potwierdzone przed F‑M5 nie mają okresów,
więc ponowne potwierdzenie ma je **dołożyć**, a nie oddać ten sam pusty pakiet.
Wynik ma nowe pole `temporalContext` — zawsze obecne, bo brak okresów kończy się wyjątkiem
i wycofaniem CAŁEJ transakcji.

### Decyzje własne (biorę odpowiedzialność)

1. **`period_type` wyprowadzony z DANYCH, nie z konfiguracji.** Rozpiętość dat sprawozdania:
   ~12 mies. → `FY`, ~3 mies. → `Q`, ~1 mies. → `MONTH`. Rozpiętość poza wzorcem dostaje
   najbliższy typ **oraz** `is_stub=true` z jawnym powodem — nigdy cichego zaokrąglenia.
2. **Rok roczny dostaje dodatkowo okres `MONTH` domknięcia (grudzień).** Powód: §8 paczki.
   `baselineContextService.ts:505` żąda `period_type='MONTH'` dla okresu otwarcia bilansu
   i wszystkich okresów prognozy (`INVALID_CONTEXT_PERIOD`). Historia roczna to `FY`, więc bez
   tego ogniwo 6 nie miałoby ani jednego kandydata na okres otwarcia. Miesiąc domknięcia jest
   PUSTY (żadna linia go nie używa), więc nie zaburza analizy —
   `analysisDefinitionService.loadSourcePeriodIds` liczy okresy przez `finance_stmt_lines`,
   nie przez tabelę okresów. Łańcuchy `previous_period_id` są rozdzielne per `period_type`
   (osobne indeksy `uq_finance_stmt_period_fy/_q/_month`), więc miesiące prognozy z F‑P2
   dokleją się do tego samego łańcucha `MONTH` bez kolizji z `FY`.
3. **Idempotencja kalendarza na blokadzie doradczej, nie na `ON CONFLICT`.** `entity_code` bywa
   `NULL`, a Postgres traktuje `NULL` w `UNIQUE` jako różne wartości — `uq_finance_stmt_cal_scope`
   NIE złapałby drugiego kalendarza domyślnego. Stąd `pg_advisory_xact_lock` + `SELECT` przed
   `INSERT`. **Zero nowych migracji** (§2 paczki: tabele istnieją).
4. **Konflikt kształtu okresu = ODMOWA, nie podmiana.** Gdy okres `FY 2024` istnieje w kalendarzu
   z innymi datami niż importowane → `PERIOD_SHAPE_CONFLICT` i zero zapisu. Nie podstawiam cudzego
   okresu pod nowe dane.
5. **NIE zmieniałem wzoru `pack_readiness_status`** (`financialStatementPackService.ts:152-153`).
   Wzór wymaga DOKŁADNIE 2 okresów × 3 typów = 6 sprawozdań, a właściciel zamroził to
   testem odbiorowym (`statementOwnerAcceptance.pg.test.ts:782,819`: trzeci okres → `INVALID_PERIOD_COUNT`,
   NIE `ready`). To jest **WARUNEK STOP z §10**, nie defekt: dla DBR77 (3 lata) legacy pakiet
   nigdy nie osiągnie `ready`, bo taki jest zamrożony kontrakt „okres + porównawczy".
   Dlatego backfill buduje **pakiet KANONICZNY** (tor `finance_stmt_lines` nie ma limitu 2 okresów),
   a nie kolejny pakiet legacy. Uczciwie: chip „Gotowe" przy 3‑letnim pakiecie legacy wymaga
   ODDZIELNEJ decyzji właściciela o zmianie wzoru — nie podejmuję jej za niego.

### `server/scripts/finance-backfill-dbr77.ts` (NOWY)

`--dry-run` (domyślnie) / `--apply` / `--rollback [--cascade]`, opcje `--org`, `--entity`,
`--years`, `--tag`. Przez **te same serwisy co UI**: `createArtifact` →
`ensureStatementPackTemporalContext` → `statementMappingService.mapStatementLines`.
Reguły mapowania nie są wymyślane — powstają z decyzji już podjętych w torze legacy
(`financial_statement_values.canonical_line_id`); pozycja bez decyzji idzie do mappera BEZ reguły
i wraca jako `UNMAPPED` (nigdy zgadnięta, nigdy po cichu pominięta).
Klucz naturalny: `seed:finance-backfill-dbr77-20260905:<orgId>:<entityCode>`.

**Przedlot bilansu w dry‑runie** (dodany po pomiarze stagingu): baza ma trigger
`finance_stmt_check_balance`, który odrzuca rok z kompletem `TOTAL_ASSETS` +
`TOTAL_LIABILITIES_EQUITY`, jeśli się nie spinają. Dry‑run mówi o tym ZANIM apply padnie w połowie.

### `server/scripts/finance-analiza-dbr77.ts` (poprawka idempotencji)

Powtórny `--apply` na tym samym pakiecie padał na `uq_finance_artifacts_org_natural_key`
(`createArtifact` nie ma `ON CONFLICT`) — **zmierzone, nie założone**. Teraz istniejąca analiza
o tym kluczu wchodzi w tryb POWTÓRKI: bez drugiego artefaktu, dokłada brakującą selekcję i liczy.

---

## 2. Testy i mutacja (jednorazowy kontener Postgres, pełne migracje)

Kontener `pgvector/pgvector:pg16`, port **55471**, świeża baza + `server/scripts/migrate.postgres.ts`
(cały łańcuch od zera). Port 5433 nietknięty.

| Suita | Wynik |
| --- | :-: |
| `financeCalendarService.pg.test.ts` (7 testów, NOWA) | **7 passed** |
| ta sama suita **bez** `RUN_DB_TESTS=1` (kontrola negatywna bramki) | **7 skipped**, nigdy `passed` |
| `statementPackRegistrationService.pg.test.ts` (zastana, dotknięta sprzątaniem fikstury) | 5 passed |
| `statements.routes.pg.test.ts` + `derivedAnalysisSelection.routes.pg.test.ts` + 2 suity tras statements | 31 passed |

**DOWÓD MUTACYJNY.** Usunięcie wywołania `ensurePeriodsTx` z `ensureContextTx`
(okresy zastąpione pustą listą, reszta bez zmian):

```
przed mutacją:  7 passed
po mutacji:     4 failed | 3 passed
                × 2. liczba okresów / łańcuch previous_period_id
                × 3. period_type z danych + miesiąc domknięcia
                × 6. KONTROLA NEGATYWNA (odmowa bez zapisu)
                × 7. okresy są używalne (linia wpina się w okres)
                ✓ 1. kalendarz    ← artefakt i kalendarz DALEJ powstają
                ✓ 5. jednostka    ← jednostka DALEJ powstaje
po przywróceniu: 7 passed
```
Mutacja celuje w **zabezpieczenie** („pakiet bez okresów jest bezużyteczny"), nie w mechanizm
rejestracji: testy 1 i 5 przechodzą pod mutacją, bo artefakt, alias i jednostka dalej powstają.

**Kontrola negatywna w suicie (test 6):** sprawozdanie z bezsensownym okresem (`period_end` =
`period_start`) → wyjątek, a odczyt na zimno pokazuje **0 okresów, 0 kalendarzy, 0 jednostek,
0 artefaktów** i sprawozdanie dalej w stanie `mapped` (nie `confirmed`). Cała transakcja się cofa.
Uwaga uczciwa: „sprawozdanie BEZ okresu" jako `NULL` jest w torze legacy nieosiągalne —
`financial_statements.period_start/period_end` są `NOT NULL`; osiągalny kształt tego samego
defektu to okres bezsensowny i taki jest w teście.

**Zastane czerwone (NIE moje) w `src/services/finance/canonical`: 11 testów / 14 plików.**
Moje 6 plików: `financeCalendarService.ts`, `statementPackRegistrationService.ts`, dwa testy,
dwa skrypty. Żaden z padających plików ich nie dotyczy. Przyczyny (odczytane, nie zgadnięte):
- 6 × `digitizationAnalysis*.pg.test.ts` → `Digitization archive proof requires an explicitly
  guarded disposable database` (bramka środowiskowa),
- 4 × `rlsPilotEnforcement.pg.test.ts` → `SASL: client password must be a string` (test wymaga
  osobnej roli nie‑superusera z hasłem),
- `hashConsolidationGuard.test.ts` → `canonical/budgetApprovalCommandService.ts: found 1,
  allowlisted 0` (plik nietknięty tą paczką),
- `budgetRegistrationService.pg.test.ts` (4 testy migracyjne), `kpiComputeService.determinism`
  (`JOB_NOT_RUNNING … already has a committed output`), `w2FalseSuccessW9B2`, `financeSettings`,
  `roiFinance*` — wszystkie poza łańcuchem sprawozdań.
- `statementOwnerAcceptance.pg.test.ts` **nie dał się uruchomić**: `FINANCE_STATEMENT_ACCEPTANCE_PDF
  is required` (wymaga pliku PDF z zewnątrz). Tego NIE zmierzyłem — mówię wprost.

---

## 3. Liczby końcowe na jednorazowym PG (pełny łańcuch)

Fikstura realistyczna (nie kopia stagingu): DBR77 Sp. z o.o., 3 lata × P&L/BS/CF = 9 sprawozdań
legacy, 81 pozycji (69 z decyzją mapowania, 12 bez — realny ślad importu PDF), PLN/units,
bilans spinający się, `NET_CHANGE_CASH` zgodny z rolką gotówki.

| Krok | Wynik (odczyt na zimno, osobnym zapytaniem) |
| --- | --- |
| `--apply` backfillu | kalendarz **1**, okresy **6** (3 × `FY` + 3 × `MONTH` domknięcia), jednostka **1**, linie **69** |
| kubełki mappera | `MAPPED=69`, `UNMAPPED=12` |
| `finance-analiza-dbr77.ts --apply` | selekcja **54** wiersze (18 wskaźników × 3 okresy × 1 jednostka), przeliczono **54** |
| wartości realne | **44** komórki z `value_decimal`, **17 różnych wskaźników** (próg zlecenia ≥10) |
| powtórny `--apply` | okresy nowych **0**, kalendarz nowy **false**, jednostka nowa **false**, linie **69 → 69** (przyrost 0) |
| `--rollback --cascade` | linie **0**, okresy **0**, jednostki **0**, kalendarze **0** |
| `--apply` + analiza PO rollbacku | znowu 69 linii / 54 wiersze / **44** wartości |

Wartości sprawdzone ręcznie: `CURRENT_RATIO` 2025 = 59 000 000 / 18 000 000 = **3,2778**;
`REVENUE_GROWTH_YOY` 2024 = 165/150 − 1 = **0,1000**; `ROE` 2025 = 17,01 / ((80+90)/2) = **0,2001**;
`DSO` 2025 = ((24+26)/2) / (182/365) = **50,14**. Jedyny wskaźnik bez ani jednej wartości:
`DEBT_TO_EBITDA` (żąda `LTM_SUM_4Q`, a dane są roczne — uczciwie `MISSING`).

---

## 4. Staging — TYLKO ODCZYT (`--dry-run`)

Baza: `thomas.proxy.rlwy.net:52567/railway` (`DATABASE_PUBLIC_URL`, env `staging`).
Organizacja DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063`. **Zero zapisu.**

- Sprawozdań legacy nie‑archiwalnych z okresem: **73**. Firmy w tej jednej organizacji:
  `(bez nazwy)`, `DBR77 Sp. z o.o.`, `Grupa Kapitałowa Apator`, `Apator S.A.`, `Tesla, Inc.`,
  `CD PROJEKT Group`, `Tesco PLC` — dlatego skrypt ma `--entity` (domyślnie `DBR77`).
- Sprawozdań DBR77 przed deduplikacją: **44**; po deduplikacji (typ × okres, najnowsze wygrywa): **9**.

| id sprawozdania | typ | rok | status | pozycje / zmapowane |
| --- | :-: | :-: | :-: | :-: |
| `14a94bba-dc7d-4220-a742-1e342afcda94` | BS | 2023 | mapped | 18 / 15 |
| `e9cc9e81-84af-4e5a-a4ac-f6c34bdad733` | CF | 2023 | confirmed | 11 / 11 |
| `02bdd457-1bc3-4f5f-8559-356abcd9e99e` | P&L | 2023 | confirmed | 11 / 11 |
| `b52c589b-f3c0-4387-befc-21bc3f2ff563` | BS | 2024 | confirmed | 15 / 15 |
| `765af470-0b28-4ed0-b131-8998d7131dbe` | CF | 2024 | confirmed | 11 / 11 |
| `c2ef4162-3144-43d2-9bde-50d4a800fc80` | P&L | 2024 | confirmed | 11 / 11 |
| `eb0ddd4c-94de-42b0-a460-866f42db361e` | BS | 2025 | confirmed | 14 / 14 |
| `04de2f66-4789-4bbe-9c32-5a0e37b094c9` | CF | 2025 | confirmed | 12 / 12 |
| `48ed63bc-b6ec-434e-99e0-8a91b00c9b4a` | P&L | 2025 | confirmed | 11 / 11 |

**Powstanie:** okresy **3** (`FY 2023/2024/2025`) **+3** okresy `MONTH` domknięcia = **6**;
jednostka **1** (`DBR77_SP_Z_O_O`); pozycji źródłowych **114**, linii kanonicznych **111**.

**Pozycje, które NIE zmapują się (3, wszystkie w BS 2023):**
`Koszty odsetkowe 2024`, `Zysk przed opodatkowaniem 2024`, `Podatek dochodowy 2024`.
To pozycje **RZiS wklejone do bilansu** przy imporcie — defekt toru legacy, nie skryptu.

**5 pustych pakietów DRAFT DBR77 — NIE kasuję żadnego** (raportuję id):
`fa76db4d-d0e3-42c8-9e00-57161ee75f41` (CD PROJEKT Group 2025) ·
`6d759cef-a7ba-4de0-be71-0ab6add2a7b8` · `a6cfac3f-9ec3-4e82-b6f2-bd84736e5723` ·
`30e7a391-81c2-445f-8856-a8bef2bb1199` · `cafc575d-4eb4-481b-960c-8a7c4b9146d4` (Sprawozdanie 2025)
— wszystkie `jednostki=0 okresy=0 linie=0`.

### ⚠ BLOKADA ZNALEZIONA NA STAGINGU — apply padnie, dopóki jej nie zdejmiesz

```
2024: TOTAL_ASSETS = 27 000 vs TOTAL_LIABILITIES_EQUITY = 10 276  (różnica 16 724 tys. PLN)
```
Trigger `finance_stmt_check_balance` odrzuci zapis roku 2024 (tolerancja bez reconciliation-runu
= JEDNA jednostka prezentacji). Przyczyna jest w torze legacy: przy imporcie BS 2024 ktoś zmapował
na `TOTAL_LIABILITIES_EQUITY` pozycję, która nią nie jest. **Dwie drogi dla nadzorcy:**
(a) poprawić mapowanie w sprawozdaniu `b52c589b-…` i puścić pełne 3 lata, albo
(b) puścić najpierw `--years=2023,2025` (2 okresy wystarczą do wskaźników YoY) i dołożyć 2024 po naprawie.

**Pokrycie wskaźników na realnych danych DBR77** (policzone z `formula_ast` katalogu vs kody obecne
w tych 9 sprawozdaniach): **12 z 18** wskaźników ma komplet kodów, plus `CASH_CONVERSION_CYCLE`
(liczony z DSO/DIO/DPO — te trzy mają komplet) ⇒ **13 wskaźników × 3 lata**.
Sześć bez kompletu, bo tor legacy DBR77 używa INNYCH nazw kanonicznych niż katalog P0:
`ROE`/`DEBT_TO_EQUITY` ← brak `EQUITY` (jest `TOTAL_EQUITY`), `GROSS_MARGIN_PCT` ← brak
`GROSS_MARGIN` (jest `GROSS_PROFIT`), `OPERATING_CASH_FLOW_MARGIN` ← brak `CFO` (jest `OPERATING_CF`),
`FCF_MARGIN` ← brak `FCF`, `DEBT_TO_EBITDA` ← `LTM_SUM_4Q` na danych rocznych.
To **osobny dług taksonomiczny** (aliasy kodów), nie blokada tej paczki.

### Komendy APPLY dla nadzorcy (w tej kolejności)

```
# 1. backfill: legacy -> pakiet kanoniczny z kalendarzem, okresami, jednostką i liniami
DATABASE_URL="<staging DATABASE_PUBLIC_URL>" npx tsx server/scripts/finance-backfill-dbr77.ts \
  --apply --org=a3e05d4a-5397-419d-b486-8e44366c0063
#    (dopóki BS 2024 się nie spina, użyj: --apply --org=… --years=2023,2025)

# 2. analiza wskaźnikowa na pakiecie z kroku 1 (businessVersionId wypisze krok 1)
DATABASE_URL="<staging DATABASE_PUBLIC_URL>" npx tsx server/scripts/finance-analiza-dbr77.ts \
  --apply --org=a3e05d4a-5397-419d-b486-8e44366c0063 --pack=<businessVersionId>

# cofnięcie (gdyby coś poszło nie tak):
DATABASE_URL="…" npx tsx server/scripts/finance-backfill-dbr77.ts --rollback --cascade \
  --org=a3e05d4a-5397-419d-b486-8e44366c0063
```

---

## 5. Domknięcie

- `cd server && npx tsc --build tsconfig.build.json` → **exit 0**
- `git diff --diff-filter=M --name-only origin/staging..HEAD -- server/migrations` → **0 plików**
  (cały diff migracji jest pusty — paczka nie potrzebowała żadnej migracji)
- `bash scripts/check-list-canon.sh` → **exit 0** („naruszeń 361, baseline 364 — dług nie rośnie")
- esbuild każdego dotkniętego pliku → 0 błędów
- Pliki w diffie (6): `financeCalendarService.ts`, `statementPackRegistrationService.ts`,
  `__tests__/financeCalendarService.pg.test.ts`, `__tests__/statementPackRegistrationService.pg.test.ts`,
  `scripts/finance-backfill-dbr77.ts`, `scripts/finance-analiza-dbr77.ts`

---

## 6. Ryzyka

1. **Okresy są append‑only i wspólne dla organizacji.** `ensurePeriods` tylko dokłada; `--rollback`
   kasuje okres wyłącznie wtedy, gdy nic go nie używa (linie, wskaźniki, kontekst modelu bazowego,
   następnik w łańcuchu) — i robi to w pętli, bo łańcuch `previous_period_id` trzyma poprzedników.
2. **`period_type` historii = `FY`.** Jeśli ktoś kiedyś uzna, że historia ma być miesięczna,
   zmiana typu istniejących okresów NIE jest bezpieczna (wiszą na nich linie i wskaźniki) —
   trzeba założyć nowy komplet, nie przepisywać stary.
3. **`finance_lineage_edges` jest append‑only na poziomie bazy.** Dlatego `--rollback` kasuje DANE,
   ale artefakt zostaje pustą skorupą, gdy wisi na nim krawędź. Skrypt mówi to wprost zamiast
   udawać czyste cofnięcie. Ponowny `--apply` napełnia tę samą skorupę.
4. **`--cascade` kasuje WYNIKI analiz zbudowanych na pakiecie** (`finance_analysis_kpi_values` +
   `_definitions`). Bez `--cascade` rollback ODMAWIA i wypisuje, co blokuje — żeby nie skasować
   cudzej pracy po cichu.
5. **`mapStatementLines` nie ma `ON CONFLICT`** (`statementMappingService.ts:393`), więc powtórny
   `--apply` odświeża zawartość WŁASNEGO pakietu (kasuje jego linie i pisze od nowa). Kontraktu
   współdzielonego mappera nie ruszałem — jego wykrywanie duplikatów jest celowe.
6. **Chip „Gotowe" przy 3‑letnim pakiecie legacy nie zapali się** — patrz decyzja 5 w §1.
   To warunek STOP z §10 paczki, wymaga decyzji właściciela o zmianie wzoru gotowości.
