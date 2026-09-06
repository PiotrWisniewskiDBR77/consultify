# Finanse — seed skonsolidowanego sprawozdania Grupy Kapitałowej CD PROJEKT za 2025 r.

Gałąź `fin/seed-cdprojekt-2025`, baza `origin/staging` (`59e282df88`), **bez push**.
Polecenie właściciela: „moduł Finanse ma być zaseedowany prawdziwym skonsolidowanym sprawozdaniem
Grupy CD PROJEKT za 2025 r. (z porównaniem 2024), a wszystkie inne pakiety/przykłady w Finansach
na stagingu mają zniknąć".

---

## 1. Źródło i przepisanie danych

PDF: `docs/modules/08_finanse/zalaczniki/CD_PROJEKT_skonsolidowane_2025.pdf` (98 str., 1,8 MB,
w repo). Przepisane RĘCZNIE do `server/scripts/data/cdprojekt-2025.json`.

| Co | Liczba |
| --- | :-: |
| Pozycji w pliku danych | **146** |
| … zmapowanych na kody kanoniczne | **119** |
| … wykluczonych z jawnym powodem | **27** |
| Sekcje | P&L 33 (str. 5 + Noty 4/5) · OCI 11 (str. 6) · BS 48 (str. 7–8) · CF 54 (str. 10–11) |
| Okresy | FY2024 (01.01–31.12.2024, „dane przekształcone") + FY2025 |
| Jednostka / waluta | tys. PLN, MSSF |

**Trzy pozycje są WYLICZONE** (nie ma ich w PDF, bo MSSF ich nie definiuje) i oznaczone polem
`derived` ze wzorem przy pozycji:

- `EBITDA` = EBIT + amortyzacja z przepływów → 2025 **539 317** (470 648 + 12 148 + 56 521),
  2024 **486 315** (366 548 + 14 289 + 105 478)
- `FCF` = CFO − nakłady na majątek trwały i prace rozwojowe → 2025 **(21 878)**, 2024 **173 839**
- `TOTAL_LIABILITIES` = zobowiązania długo- + krótkoterminowe → 2025 **213 461**, 2024 **252 379**

**27 pozycji bez kodu kanonicznego** (nic nie ginie po cichu, każda ma powód w pliku):

| Powód | Ile | Przykład |
| --- | :-: | --- |
| `NO_CANONICAL_TARGET` — luka taksonomii | 19 | „Zysk netto z działalności zaniechanej" (MSSF 5 nie ma kodu), sumy pośrednie „Wpływy"/„Wydatki" w przepływach, odsetki OTRZYMANE w działalności inwestycyjnej, „ZOBOWIĄZANIA DŁUGOTERMINOWE" (jest `TOTAL_LIABILITIES` i `CURRENT_LIABILITIES`, nie ma sumy długoterminowych) |
| `PER_SHARE_UNIT_MISMATCH` — decyzja analityka | 6 | zysk na akcję (w zł, a pakiet w tys. zł — zapis zafałszowałby wartość 1000×) |
| `DUPLICATE_OF_PL_NET_INCOME` / `DUPLICATE_OF_NET_CHANGE_CASH` | 2 | „Zysk netto" powtórzony w sprawozdaniu z całkowitych dochodów; „Bilansowa zmiana stanu środków pieniężnych" |

**Zero pozycji `UNMAPPED`** przy zapisie — każda pozycja albo ma kod, albo jawne wykluczenie.

### Decyzje mapowania, które biorę na siebie

1. `LONG_TERM_DEBT` ← „Pozostałe zobowiązania finansowe (długoterminowe)" (21 743 / 17 706).
   Noty 27/28/34: to zobowiązania leasingowe — jedyne oprocentowane zadłużenie Grupy
   (CD PROJEKT nie ma kredytów ani obligacji własnych). Wskaźnik `DEBT_TO_EQUITY` żąda tego kodu.
2. `INTEREST_EXPENSE` ← **Nota 4, „Koszty z tytułu odsetek"** = 679 / 875, a NIE „Koszty finansowe"
   (41 826 / 14 201), które są w ~98% różnicami kursowymi i wyceną instrumentów.
3. `RETAINED_EARNINGS` **świadomie NIE użyty**. CD PROJEKT pokazuje „Niepodzielony wynik finansowy"
   i „Wynik finansowy bieżącego okresu" jako DWIE pozycje kapitału — żadna nie jest „zyskami
   zatrzymanymi ogółem", więc trigger rolki (`opening RE + NET_INCOME − dywidendy = closing RE`)
   słusznie by je odrzucił. Idą pod `RETAINED_EARNINGS_PRIOR` / `RETAINED_EARNINGS_CURRENT`,
   a trigger pozostaje uśpiony **z konstrukcji**, nie przez pominięcie dywidend.
4. `INTANGIBLES_SOFTWARE` ← „Nakłady na prace rozwojowe" (skapitalizowana produkcja gier);
   pozycja rozłączna z „Aktywa niematerialne" (`INTANGIBLES`).

---

## 2. Sumy kontrolne — PDF vs plik danych vs BAZA

Wszystkie trzy kolumny są zgodne. Kolumna „baza" to odczyt **na zimno** ze stagingu
(`SELECT … FROM finance_stmt_lines JOIN financial_statement_lines … JOIN finance_stmt_periods`).

| Pozycja | PDF 2025 | PDF 2024 | plik | baza |
| --- | ---: | ---: | :-: | :-: |
| Aktywa razem | 3 503 320 | 3 026 438 | ✓ | ✓ |
| Pasywa razem | 3 503 320 | 3 026 438 | ✓ | ✓ |
| Kapitał własny | 3 289 859 | 2 774 059 | ✓ | ✓ |
| Zysk netto | 594 708 | 444 253 | ✓ | ✓ |
| Przychody ze sprzedaży | 866 989 | 798 372 | ✓ | ✓ |
| CF operacyjny | 590 880 | 521 297 | ✓ | ✓ |
| CF inwestycyjny | (474 582) | (470 547) | ✓ | ✓ |
| CF finansowy | (127 069) | (103 918) | ✓ | ✓ |
| CF razem | (10 771) | (53 168) | ✓ | ✓ |
| Środki pieniężne na początek | 124 886 | 178 054 | ✓ | ✓ |
| Środki pieniężne na koniec | 114 115 | 124 886 | ✓ | ✓ |

Kontrole strukturalne (sprawdzane w kodzie przy KAŻDYM uruchomieniu, przed zapisem):

- bilans: AKTYWA RAZEM = PASYWA RAZEM (oba lata),
- pasywa: kapitał własny + zobowiązania = PASYWA RAZEM,
- rolka gotówki: stan początkowy + zmiana netto = stan końcowy (oba lata),
- przepływy: operacyjne + inwestycyjne + finansowe = razem,
- gotówka bilansowa = stan końcowy z przepływów,
- zysk brutto na sprzedaży = przychody − koszt własny,
- zysk netto = kontynuowana + zaniechana,
- pozycje wyliczone (EBITDA, FCF) = ich własny wzór.

**Zapis jest WSTRZYMANY**, gdy którakolwiek kontrola padnie (`exit 4`, zero zapisu).

---

## 3. Co powstało

### `server/scripts/finance-seed-cdprojekt.ts`

`--dry-run` (domyślnie) / `--apply` / `--rollback [--cascade]` / `--prune-others [--dry-run|--apply]`,
opcje `--org=<id|fragment nazwy>`, `--tag`.

Zakłada **oba tory**, bo moduł Finanse czyta z dwóch miejsc:

1. **LEGACY** (lista sprawozdań w UI): 1 pakiet + **6 sprawozdań** (2 okresy × P&L/BS/CF) +
   **292 pozycje**. Dokładnie 2 okresy, bo wzór `pack_readiness_status`
   (`financialStatementPackService.ts:163-181`) zapala „Gotowe" tylko przy 2 okresach, komplecie
   P&L/BS/CF, jednym `entity_name`, jednej walucie i skali oraz wszystkich sprawozdaniach
   `confirmed` + `ready`. **Wynik: `pack_readiness_status = ready`.**
2. **KANONICZNY** (na nim stoi analiza): przez TE SAME serwisy co import z UI —
   `createArtifact` → `financeCalendarService.ensureStatementPackTemporalContext` →
   `statementMappingService.mapStatementLines`. Zero surowego SQL-a piszącego linie kanoniczne.

Kolejność zapisu jest podyktowana odroczonymi triggerami, nie estetyką: FY2024 (P&L → OCI → CF → BS),
potem FY2025 (j.w.). Dzięki temu BS ma w JEDNEJ transakcji komplet `TOTAL_ASSETS` +
`TOTAL_LIABILITIES_EQUITY` (`finance_stmt_check_balance`), a BS FY2025 zamyka się jako ostatni,
więc rolka gotówki (`finance_stmt_check_cash_rollforward`) widzi już `CASH` FY2024 = 124 886
i `NET_CHANGE_CASH` FY2025 = (10 771) → `CASH` FY2025 = 114 115.

### Naprawa taksonomii — ZNALEZISKO Z PRZYCZYNĄ

Pierwszy `--apply` na stagingu dał **114 z 238 linii `UNMAPPED`** (`CANONICAL_LINE_NOT_FOUND`).
Pomiar zamiast domysłu:

```
SELECT id, statement_type, line_code FROM financial_statement_lines
 WHERE id IN ('fsl-pl-gross','fsl-bs-equity','fsl-cf-operating','fsl-cf-fcf');
  fsl-pl-gross     | P&L | GROSS_PROFIT     <- migracja 565 deklaruje GROSS_MARGIN
  fsl-bs-equity    | BS  | TOTAL_EQUITY     <-                       EQUITY
  fsl-cf-operating | CF  | OPERATING_CF     <-                       CFO
  fsl-cf-fcf       | CF  | FREE_CASH_FLOW   <-                       FCF
```

**Przyczyna:** obie migracje taksonomii (`565_kpi_time_series_roi_attribution_finance.sql`
i `20261058_finance_statement_canonical_mapping_taxonomy.sql`) wstawiają wiersze
`ON CONFLICT (id) DO NOTHING`. Na stagingu te ID-ki istniały wcześniej z INNEJ rodziny nazw,
więc obie migracje zameldowały `success` (rejestr `schema_migrations` to potwierdza:
`20261058_finance_statement_canonical_mapping_taxonomy.sql | 2026-08-28 | success`)
i **nie wstawiły nic**. Katalog wskaźników P0 żąda `GROSS_MARGIN`, `EQUITY`, `CFO`, `FCF` —
czyli **cztery z osiemnastu wskaźników były na stagingu martwe od zawsze**, a 134 kodów obecnych
na świeżej bazie na stagingu nie istniało w ogóle. (To jest z nazwiskiem ten sam „dług
taksonomiczny", który `evidence/finanse-fm5-20260905/RAPORT.md` §4 opisał jako obserwację.)

**Naprawa (`ensureTaxonomyTargets`):** dokładamy BRAKUJĄCE cele mapowania jako globalne wiersze
systemowe z własnymi ID-kami `fsl-cdpseed-…`, wyłącznie dla par (typ, kod), których seed używa
i których nie ma. Tabela nie ma UNIQUE na `(statement_type, line_code)` — tylko PK na `id` —
więc nic nie jest nadpisywane. **Na stagingu dołożono 57 wierszy.** Zero nowych migracji.
**Uczciwie:** taksonomia ma teraz dwie rodziny nazw obok siebie (`GROSS_PROFIT` i `GROSS_MARGIN`);
uzgodnienie ich migracją to OSOBNY dyżur, nie jest tu po cichu „naprawione".

---

## 4. Liczby — jednorazowy PostgreSQL i staging

Kontener `pgvector/pgvector:pg17`, port **55913**, świeża baza + `server/scripts/migrate.postgres.ts`
(cały łańcuch od zera, `exit 0`). Port 5433 nietknięty.

| Krok | Lokalnie (jednorazowy PG) | Staging (`thomas.proxy.rlwy.net:52567`) |
| --- | :-: | :-: |
| Sprawozdania legacy | 6 | 6 |
| Pozycje legacy | 292 | 292 |
| `pack_readiness_status` | **ready** | **ready** |
| Okresy kanoniczne | 2 (+2 miesiące domknięcia) | 2 (+2) |
| Jednostki | 1 (`GRUPA_KAPITALOWA_CD_PROJEKT`) | 1 |
| Linie kanoniczne | **238** | **238** |
| Kody kanoniczne (różne) | 119 | 119 |
| Kubełki mappera | `MAPPED=238, EXCLUDED=54, UNMAPPED=0` | to samo |
| Wiersze selekcji analizy | 36 (18 × 2 × 1) | 36 |
| **Komórek z realną wartością** | **27** | **27** |
| **Wskaźników z wartością** | **17 z 18** | **17 z 18** |
| … w tym na OBA okresy | 10 | 10 |
| Powtórny `--apply` | 0 nowych wierszy | 0 nowych |
| `--rollback --cascade` | linie 0, okresy 0, jednostki 0, legacy 0 | (nie uruchamiany na stagingu) |

**Wskaźniki na obu okresach (10):** `CURRENT_RATIO` 7,4023 / 6,3196 · `QUICK_RATIO` 7,3897 / 6,3118 ·
`CASH_RATIO` 0,6329 / 0,5434 · `GROSS_MARGIN_PCT` 0,9089 / 0,8524 · `EBITDA_MARGIN_PCT` 0,6221 / 0,6091 ·
`NET_MARGIN_PCT` 0,6859 / 0,5564 · `DEBT_TO_EQUITY` 0,0066 / 0,0064 · `INTEREST_COVERAGE` 693,15 / 418,91 ·
`OPERATING_CASH_FLOW_MARGIN` 0,6815 / 0,6530 · `FCF_MARGIN` −0,0252 / 0,2177.

**Wskaźniki tylko na FY2025 (7)** — bo `AVERAGE_CURRENT_AND_PRIOR` / `PRIOR_YEAR_SAME_PERIOD` nie mają
poprzednika dla pierwszego okresu; to kontrakt katalogu, nie defekt seeda: `ROE` 0,1961 · `ROA` 0,1822 ·
`DSO` 61,69 · `DIO` 9,43 · `DPO` 306,02 · `CASH_CONVERSION_CYCLE` −234,90 · `REVENUE_GROWTH_YOY` 0,0859.

**Jedyny bez wartości: `DEBT_TO_EBITDA`** — żąda `EBITDA[LTM_SUM_4Q]`, a dane są roczne. Uczciwie
`MISSING`; to samo znalazł raport F‑M5 na danych DBR77.

**Wartości sprawdzone ręcznie z PDF:**
`CURRENT_RATIO` 2025 = 1 334 673 / 180 304 = **7,4023** ·
`NET_MARGIN_PCT` = 594 708 / 866 989 = **0,6859** ·
`ROE` = 594 708 / ((3 289 859 + 2 774 059)/2) = **0,1961** ·
`INTEREST_COVERAGE` = 470 648 / 679 = **693,15** ·
`DSO` = ((125 441 + 167 628)/2) / (866 989/365) = **61,69**.

---

## 5. Testy i mutacja

`server/src/services/finance/canonical/__tests__/financeSeedCdprojekt.pg.test.ts` — 14 testów.

| Bramka | Wynik |
| --- | :-: |
| `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres…` | **14 passed** |
| bez bramki (kontrola negatywna) | **7 passed / 7 skipped**, nigdy `passed` na torze bazodanowym |

**Dowód mutacyjny — celuje w ZABEZPIECZENIE, nie w mechanizm.** Zabezpieczeniem jest
„żadna kwota nie zmieni się niezauważona":

- test 4: `TOTAL_ASSETS` FY2025 + 1 → `verifyControls` PADA (i ta sama funkcja na nietkniętych
  danych dalej przechodzi — kontrola negatywna mutacji),
- test 5: `OPENING_CASH` FY2025 + 1000 → pada kontrola rolki gotówki,
- test 14: kopia pliku z rozspojonym bilansem podstawiona przez `CDPROJEKT_DATA_PATH` → skrypt
  **odmawia zapisu** (`Zapis WSTRZYMANY`, niezerowy kod wyjścia), do bazy nie trafia nic.

Gdyby ktoś wypatroszył `verifyControls` do `return []`, czerwone robią się testy 2, 3, 4 i 5,
a test 1 („plik się wczytuje, ma 146 pozycji") dalej zielony — mutacja rozróżnia zabezpieczenie
od mechanizmu.

Pozostałe: 8 (2 okresy / 238 linii / legacy `ready`), 9 (sumy z PDF = sumy z BAZY, odczyt na zimno),
10 (≥15 wskaźników, wartości sprawdzone co do czwartego miejsca), 11 (powtórny `--apply` = 0 nowych),
12 (`--prune-others` czyści TĘ organizację i NIE dotyka innej), 13 (`--rollback` = zero, potem
`--apply` odtwarza 238 linii).

---

## 6. „Wywal resztę" — co zniknęło ze stagingu

Organizacja DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063`. **Żadne dane innych organizacji nie były
dotykane** — każde zapytanie ma `organization_id = ?` (zweryfikowane testem 12).

**Stan PRZED** (odczyt 05.09, przed zmianami): 73 sprawozdania legacy w 7 firmach
(Apator S.A. 6 · CD PROJEKT Group 3 · DBR77 Sp. z o.o. 44 · Grupa Kapitałowa Apator 6 ·
Tesco PLC 3 · Tesla, Inc. 3 · bez nazwy 8), 20 pakietów legacy, 16 artefaktów kanonicznych,
37 linii kanonicznych, 6 wskaźników z wartością.

**Stan PO:** **1 pakiet legacy, 6 sprawozdań, 1 firma — „Grupa Kapitałowa CD PROJEKT",
2 widoczne artefakty kanoniczne (pakiet + analiza), 238 linii, 27 wskaźników z wartością.**

### Co dało się USUNĄĆ, a co tylko ZARCHIWIZOWAĆ (i dlaczego)

Twarde usunięcie okazało się niemożliwe dla części obiektów — **to defekty ZASTANE, nie moje**:

1. **`artifact_lifecycle_events` jest append-only** (`trg_artifact_lifecycle_events_deny_delete`),
   a `createArtifact` ZAWSZE dopisuje zdarzenie. Efekt: artefaktu kanonicznego nie da się usunąć.
   Ścieżka serwisowa też jest zamknięta — `lifecycleService` T10 `archive` prowadzi wyłącznie
   z `APPROVED`, a puste pakiety-śmieci są `DRAFT`.
   **Uwaga:** `finance-backfill-dbr77.ts` (scalony) w swoim `--rollback` próbuje właśnie tego
   `DELETE`-a — na bazie z tym triggerem ta ścieżka podnosi wyjątek. Warte osobnego dyżuru.
2. **Cztery tabele paragonów rządzenia** (`finance_statement_source_receipts` 44 wiersze,
   `finance_statement_confirmation_receipts` 15, `finance_statement_manual_mapping_decisions`,
   `finance_statement_pack_archive_command_receipts` 6) trzymają FK `NO ACTION` na sprawozdania,
   pakiety i przebiegi importu, a każda ma trigger `…_immutable`. Kaskada z trasy UI
   `DELETE /finance-statements/packs/:id` (`finance-statements.routes.ts:2945-2974`) **ich nie zna**,
   więc ta trasa wywala się na każdym potwierdzonym sprawozdaniu:
   `violates foreign key constraint "fk_fin_stmt_source_receipt_ingest_owner"`. **Defekt zastany
   w produkcyjnej trasie kasowania — osobny dyżur.**

Dlatego skrypt sprawdza PRZED usunięciem, czy obiekt jest zablokowany, i wybiera:

Rozliczenie CO DO SZTUKI (przed = zrzut CSV sprzed prune, po = odczyt na zimno):

| Obiekt | Przed | Po | Los |
| --- | :-: | :-: | --- |
| Pakiety legacy — aktywne (Apator ×2, Grupa Apator ×2, Tesla, Tesco, CD PROJEKT Group, DBR77, bez nazwy ×5) | 14 | 0 | **12 USUNIĘTYCH** (kaskada jak w trasie UI) + **2 ZARCHIWIZOWANE** (`19ff7554-…`, `901581c8-…` — po 10 paragonów rządzenia każdy) |
| Pakiety legacy — zarchiwizowane wcześniej przez aplikację | 6 | 6 | nietknięte (i tak niewidoczne na liście) |
| Pakiety legacy razem | 20 | 8 archiwalne + 1 CD PROJEKT | — |
| Sprawozdania legacy | 73 (37 `confirmed`, 29 `mapped`, 7 `draft`, **0 archiwalnych**) | 44 archiwalne + 6 CD PROJEKT | **29 USUNIĘTYCH**, **44 ZARCHIWIZOWANE** (`status='archived'`) |
| Artefakty kanoniczne | 16 widocznych | 2 widoczne (CD PROJEKT) | **16 ZARCHIWIZOWANYCH** (`archived_at`), ich dane (linie/jednostki/wskaźniki) skasowane |

Archiwizacja jest skuteczna względem UI, bo listy filtrują właśnie te kolumny:
`artifactVersionService.listArtifacts:182` → `AND a.archived_at IS NULL`;
`financialStatementPackService:382` i `:835` → `COALESCE(status,'draft') <> 'archived'`.

**Zarchiwizowane artefakty kanoniczne (id — odwracalne jednym UPDATE-em):**
`0073fc01-9072-4cae-8a2b-38caa06a0b75` (BASELINE_MODEL „Budżet wdrożenia robotyzacji 2027") ·
`b223da23-c9d0-4f27-a555-f0c9e8b37376`, `9daed0c4-91d9-467d-bcdf-2240bb56f0b1`,
`4bd023c0-51e8-45d7-92c0-c2074b35649a`, `a14c8b7d-db58-49be-ac91-795adc65f25d` (VALUATION_CASE) ·
`191668a1-a3e5-496d-8e77-d69e9a5fc0fe` (HISTORICAL_ANALYSIS „CD PROJEKT Group analysis") ·
`11ab320f-68c2-422b-a4e8-d4d81b70d92e`, `31ca7524-661e-438a-84e1-4ff0572625b8`,
`1e6706bc-0311-44f8-a02c-fe444e699e32`, `4fc1e09f-9ede-4cb3-ace3-3f99a3b5598c`,
`9b04b20b-6bc3-49d9-92ae-49f2c05910a5` (STATEMENT_PACK, w tym 5 pustych DRAFT z raportu F‑M5) ·
`c280af66-6146-4395-a96f-491f6bf01a4b`, `376c0708-2664-4f43-a9a4-4152198c1385` (PREDICTION_SCENARIO) ·
`314dfbc9-fc64-4581-a84b-039877ea6ecc` (BASELINE_MODEL „DBR77 — Model bazowy 2023-2025") ·
**`b1308bf7-7cdd-40fb-a7c5-ef2038bd373f`** (pakiet backfillu DBR77, wersja `288a4c42-…`) ·
**`c899bde4-9368-447e-8bba-a3d1432a06f0`** (analiza backfillu, wersja `289b6f70-…`).

**ZOSTAJE:** pakiet legacy `cdp2025-pack-e2daa0b810`, artefakt kanoniczny
`67f0e754-ef65-49ab-90da-af9d55994b26` (wersja `e57594d1-9be2-4903-9685-adeaa8f84759`)
i analiza `33077995-3ae7-4d44-87f0-32d9ce47d9e8` (wersja `ad991749-b1c0-477a-ad2b-fc1d37cd505f`) —
zostaje ONA, bo `--prune-others` zachowuje przechodnie domknięcie grafu rodowodu od pakietu CD PROJEKT
(poprawka po pomiarze: bez tego prune skasowałby analizę zbudowaną minutę wcześniej).

**Kopia bezpieczeństwa przed usunięciem:** `staging-legacy-przed-prune.csv.tgz` w tym katalogu —
pełne zrzuty CSV `financial_statement_packs` (20), `financial_statements` (73) i
`financial_statement_values` (1 851 wierszy) organizacji DBR77 sprzed prune.

---

## 7. Dowód odczytem przez REPOZYTORIA APLIKACJI (nie surowym SQL-em)

```
DATABASE_URL=<staging> npx tsx <probe wołający listArtifacts + listStatementPacks>

--- listArtifacts (to widzi UI) ---
  HISTORICAL_ANALYSIS | derived-analysis:script:e57594d1-9be2-4903-9685-adeaa8f84759 | status=DRAFT
  STATEMENT_PACK      | seed:finance-cdprojekt-2025:a3e05d4a-…:GRUPA_KAPITALOWA_CD_PROJEKT | status=DRAFT
--- listStatementPacks (lista sprawozdan w UI) ---
  cdp2025-pack-e2daa0b810 | Grupa Kapitałowa CD PROJEKT | readiness=ready | sprawozdan=6
```

Ponowny `--prune-others --dry-run` → `# Do usunięcia: 0` (nic nie zostało).

---

## 8. Komendy

```bash
# podgląd (tylko odczyt)
DATABASE_URL="$STAGING_DATABASE_PUBLIC_URL" DB_TYPE=postgres \
  npx tsx server/scripts/finance-seed-cdprojekt.ts --dry-run --org=a3e05d4a-5397-419d-b486-8e44366c0063

# zapis seeda (legacy + kanoniczny + naprawa taksonomii)
DATABASE_URL="…" DB_TYPE=postgres \
  npx tsx server/scripts/finance-seed-cdprojekt.ts --apply --org=a3e05d4a-5397-419d-b486-8e44366c0063

# analiza wskaźnikowa na pakiecie z kroku wyżej
DATABASE_URL="…" DB_TYPE=postgres \
  npx tsx server/scripts/finance-analiza-dbr77.ts --apply --org=a3e05d4a-… --pack=e57594d1-9be2-4903-9685-adeaa8f84759

# sprzątanie reszty
DATABASE_URL="…" DB_TYPE=postgres \
  npx tsx server/scripts/finance-seed-cdprojekt.ts --prune-others --dry-run --org=a3e05d4a-…
DATABASE_URL="…" DB_TYPE=postgres \
  npx tsx server/scripts/finance-seed-cdprojekt.ts --prune-others --apply  --org=a3e05d4a-…

# testy (bramka obowiązkowa)
CI=true DB_TYPE=postgres DATABASE_URL="postgres://…" RUN_DB_TESTS=1 MOCK_DB=false \
  npx vitest run server/src/services/finance/canonical/__tests__/financeSeedCdprojekt.pg.test.ts
```

### Cofnięcie

```bash
# 1. cofnięcie seeda CD PROJEKT (dane seeda do zera; artefakt zostaje zarchiwizowaną skorupą)
DATABASE_URL="…" DB_TYPE=postgres \
  npx tsx server/scripts/finance-seed-cdprojekt.ts --rollback --cascade --org=a3e05d4a-…

# 2. przywrócenie zarchiwizowanych artefaktów kanonicznych (odwracalne w całości)
UPDATE finance_artifacts SET archived_at = NULL
 WHERE organization_id = 'a3e05d4a-5397-419d-b486-8e44366c0063' AND archived_at IS NOT NULL;
--   UWAGA: przywraca artefakt na listę, ale jego DANE (linie/jednostki/wskaźniki) zostały
--   skasowane przez --prune-others i nie wracają.

# 3. przywrócenie zarchiwizowanych sprawozdań i pakietów legacy
UPDATE financial_statements       SET status = 'confirmed' WHERE organization_id = 'a3e05d4a-…' AND status = 'archived';
UPDATE financial_statement_packs  SET pack_status = 'draft' WHERE organization_id = 'a3e05d4a-…' AND pack_status = 'archived';

# 4. przywrócenie USUNIĘTYCH pakietów/sprawozdań legacy — z kopii CSV w tym katalogu
tar xzf evidence/finanse-cdprojekt-20260905/staging-legacy-przed-prune.csv.tgz
```

---

## 9. Domknięcie

- `cd server && npx tsc --build tsconfig.build.json` → **exit 0**
- `git diff --diff-filter=M --name-only origin/staging..HEAD -- server/migrations` → **0 plików**
  (paczka nie potrzebowała żadnej migracji; naprawa taksonomii jest addytywnym INSERT-em w skrypcie)
- `bash scripts/check-list-canon.sh` → **exit 0** (naruszeń 361, baseline 364 — dług nie rośnie)
- `npx esbuild` na dotkniętym skrypcie → 0 błędów
- Pliki w diffie (4): PDF źródłowy, `server/scripts/data/cdprojekt-2025.json`,
  `server/scripts/finance-seed-cdprojekt.ts`, test `.pg.test.ts` (+ ten raport i kopia CSV)

---

## 10. Ryzyka i dług, który zostaje

1. **Dwie rodziny nazw w taksonomii.** Po naprawie `financial_statement_lines` ma obok siebie
   `GROSS_PROFIT` i `GROSS_MARGIN`, `TOTAL_EQUITY` i `EQUITY`, `OPERATING_CF` i `CFO`,
   `FREE_CASH_FLOW` i `FCF`. Stare importy mapują na stare kody, katalog P0 czyta nowe.
   Uzgodnienie wymaga osobnej migracji i decyzji, która rodzina jest kanoniczna.
2. **Trasa UI `DELETE /finance-statements/packs/:id` jest zepsuta** dla każdego sprawozdania,
   które przeszło potwierdzenie — nie kasuje czterech tabel paragonów, a te mają FK `NO ACTION`
   i triggery `…_immutable`. Właściciel klikający „usuń" dostanie błąd 500.
3. **`finance-backfill-dbr77.ts --rollback` podnosi wyjątek** na `DELETE FROM artifact_lifecycle_events`
   (append-only). Ten skrypt tego nie robi; tamten nie był poprawiany w tej paczce.
4. **Usunięcie 18 pakietów legacy jest nieodwracalne w bazie** — odtworzenie tylko z kopii CSV
   dołączonej do tego raportu.
5. **Wskaźniki na średnim saldzie mają wartość tylko dla FY2025.** To kontrakt katalogu
   (`AVERAGE_CURRENT_AND_PRIOR` / `PRIOR_YEAR_SAME_PERIOD` nie mają poprzednika dla pierwszego
   okresu), nie defekt danych. Trzeci rok porównawczy dałby komplet, ale PDF go nie zawiera,
   a `pack_readiness_status` i tak wymaga DOKŁADNIE dwóch okresów.
6. **`DEBT_TO_EBITDA` zostaje pusty** — żąda `LTM_SUM_4Q` na danych kwartalnych, a sprawozdanie
   jest roczne.
7. **Ekranów NIE oglądałem.** Zgodnie z CLAUDE.md #7 właściciel nie jest pierwszym testerem
   wizualnym — ale odbiór wzrokowy modułu Finanse z tymi danymi jest osobnym krokiem i nie został
   tu wykonany. Dowód w §7 to odczyt przez repozytoria aplikacji, nie zrzut ekranu.
