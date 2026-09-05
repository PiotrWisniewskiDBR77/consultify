# Analiza finansowa — F‑P4 + F‑P5 (05.09.2026)

Gałąź `fin/analiza-fp4-fp5`, baza `origin/staging` (`d963af93b0`), 5 commitów, **bez push**.
Zlecenie: „analiza historyczna ma pokazywać realne wskaźniki, a nie pustą tabelę/404".

---

## 1. Stan stagingu — pomiar na żywej bazie (tylko odczyt)

Baza: `thomas.proxy.rlwy.net:52567/railway` (DATABASE_PUBLIC_URL usługi `consultify`, env `staging`).
Organizacja DBR77 = `a3e05d4a-5397-419d-b486-8e44366c0063`.

| Co | Liczba |
| --- | :-: |
| Artefakty kanoniczne DBR77: `STATEMENT_PACK` | **5** |
| … `HISTORICAL_ANALYSIS` / `BASELINE_MODEL` / `PREDICTION_SCENARIO` / `VALUATION_CASE` | 1 / 2 / 2 / 4 |
| Wersje biznesowe w stanie `APPROVED` (cała baza, każdy typ) | **0** |
| `finance_analysis_definitions` / `_kpi_values` / `_benchmarks` (cała baza) | **0 / 0 / 0** |
| `finance_analysis_kpi_catalog` `ACTIVE` (seed P0) | **18** |
| `finance_stmt_calendars` / `_periods` / `_entities` / `_lines` (cała baza) | **0 / 0 / 0 / 0** |
| `finance_lineage_edges` (cała baza) | **0** |
| `finance_baseline_models` | **0** |
| Legacy `financial_statement_packs` DBR77 | 20 |
| Legacy `financial_statements` DBR77 (P&L/BS/CF 2023, 2024, 2025) | 14+, zaimportowane 05.09 11:22–11:33 |

**Wniosek pomiaru.** Dane DBR77 istnieją, ale **wyłącznie w torze legacy** (`financial_statements`).
Tor kanoniczny ma 5 pakietów‑skorup: zero jednostek, zero okresów, zero linii. To ustawia
kolejność blokad inaczej, niż zakładało zlecenie: blokadą **nie** jest brak `APPROVED` (F‑M6),
tylko brak okresów/jednostek/linii (**F‑M5**, niescalone — `financeCalendarService` nie istnieje
w repo).

---

## 2. Co zbudowano

### F‑P4 — producent definicji analizy i wierszy selekcji (ZROBIONE)

- `server/src/services/finance/canonical/analysisDefinitionService.ts` (nowy, 320 linii) —
  `createAnalysisDefinitionWithSelection()`: w jednej transakcji zakłada
  `finance_analysis_definitions` + iloczyn **katalog × okresy pakietu × jednostki pakietu**
  w `finance_analysis_kpi_values` (puste komórki `value_status='MISSING'`). Świadomy o transakcji
  wołającego (`getCurrentPgTransactionClient`, ten sam wzorzec co `lineageService.insertEdge`).
  - „Okresy pakietu" = `DISTINCT period_id` z `finance_stmt_lines` tej wersji — schemat CELOWO
    nie ma tabeli „okresy tego pakietu" (ADR WP‑D01 §2.1), to jedyna uczciwa definicja.
  - Waluta/jednostka prezentacji wyprowadzone z linii pakietu (`resolvePresentation`), nie zgadnięte.
  - Idempotentne: `ON CONFLICT` na `uq_finance_analysis_def_bv` i `uq_finance_analysis_kpi_values_cell`.
- `server/src/routes/v8/finance-v2/lineage-navigator.routes.ts:~330` — wpięcie w
  `POST /versions/:sourceVersionId/derived-analysis`, w TEJ SAMEJ transakcji co `createArtifact`
  i `insertEdge`. Trasa przyjmuje teraz `name`, `periodIds`, `kpiCodes`, `industryCode`
  (wybór z kreatora — do tej pory nie miał gdzie trafić) i zwraca blok `selection`.
- `server/migrations/20260905_finance_analysis_definition_name.sql` (NOWY plik, addytywny) —
  `finance_analysis_definitions.analysis_name TEXT`. Powód: tabela nie miała żadnej kolumny na
  nazwę, a `finance_artifacts.natural_key` jest w tej trasie kluczem idempotencji
  (`derived-analysis:<sha256>`) — wpisanie tam nazwy zepsułoby wyszukiwanie powtórki.

**Decyzje własne (zakładam odpowiedzialność):**

1. **Bez benchmarków.** `finance_analysis_benchmarks` zostaje bez producenta. Tabela wymaga
   realnego źródła (`source_name`, `as_of_date`, `p25/median/p75`); nie mamy dostawcy ani licencji,
   a wpisanie wymyślonych percentyli byłoby sfabrykowaniem danych finansowych pokazywanych klientowi.
2. **Nie wymagam `APPROVED` pakietu źródłowego.** Zlecenie prosiło o kontrolę negatywną „pakiet
   niezatwierdzony → odmowa"; SSOT (F1 §F‑P4 §4/§6) tego nie wymaga. Twardy wymóg `APPROVED`
   odebrałby dziś działającą akcję „+ Nowa analiza" na wszystkich 5 pakietach DBR77 (wszystkie
   `DRAFT`) i zablokował właściciela. Zamiast tego odmowa jest **danych**, nie statusu: brak
   okresów albo jednostek ⇒ `409` + komunikat po polsku + **zero zapisu** (transakcja wycofuje
   artefakt i krawędź). To ta sama wartość dowodowa („nie powstaje analiza‑widmo"), bez regresji
   funkcji. Krawędzie rodowodu są append‑only — analiza‑widmo zostałaby w grafie na zawsze.

### F‑M6 — POMINIĘTE, z pomiarem zamiast domysłu

F‑P4 nie potrzebuje `APPROVED`, więc F‑M6 nie jest blokadą dla analizy. Zmierzyłem natomiast na
jednorazowym PG, gdzie realnie zatrzymuje się ścieżka zatwierdzania (skrypt sondujący, niecommitowany):

```
start:            { status: 'DRAFT', version: 1 }
submit_for_review -> OK   { status: 'READY_FOR_REVIEW', version: 2 }
start_review      -> OK   { status: 'IN_REVIEW',        version: 3 }
approve AUTOREM   -> APPROVAL_BLOCKED: Cannot approve: freshness is NEVER_COMPUTED, not CURRENT
approve INNYM     -> APPROVAL_BLOCKED: Cannot approve: freshness is NEVER_COMPUTED, not CURRENT
```

**Blokadą nie jest bramka autor≠recenzent** (hipoteza F‑M6 §3), tylko `freshness=NEVER_COMPUTED`:
pakiet musi mieć przeliczoną/ostemplowaną zawartość, zanim wejdzie w `APPROVED`. Pytanie o SoD
zostaje **nierozstrzygnięte** — łańcuch zatrzymuje się wcześniej. Kontrolki UI istnieją
(`src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx:163,481`).

### F‑P5 — kreator, flaga, 404, „—" (ZROBIONE)

- `src/services/api/financeV2.api.ts` — nowy klient `createDerivedFinanceAnalysis()`.
- `src/components/Finance/Analysis/AnalysisWorkspace.tsx:~450` — `handleWizardComplete` woła
  `derived-analysis` z **całym** wyborem kreatora (poprzednio: `void payload` + `POST /artifacts`
  bez krawędzi), przelicza **nową** wersję i oddaje ją przez `onAnalysisCreated`. Nazwa własna
  proponowana z etykiety pakietu źródłowego.
- `src/components/Economics/FinanceHub.tsx` — `openCanonicalAnalysis` przełącza ekran na nowo
  utworzoną analizę (wcześniej użytkownik zostawał na starym rekordzie).
- `src/hooks/useFinanceAnalysisWorkspaceFlag.ts:31` — `defaultValue: false → true`. Zero flag
  chowających pracę; lokalny override `false` zostaje jako hamulec awaryjny.
- **Diagnoza 404 (zmierzona, nie zgadnięta):** `GET /api/v8/finance/analyses/:id/ratios`
  (`server/src/routes/v8/finance.routes.ts:3791`) sprawdza id w `listAnalyses()`, czyli w LEGACY
  rejestrze `financial_analyses` (`server/src/services/financialAnalysisService.ts:446`), a
  kanoniczna analiza ma id z `finance_artifacts`. **Dwie różne przestrzenie identyfikatorów** —
  dla rekordu kanonicznego ta trasa MUSI zwrócić 404, tak samo jak fallback
  `/api/economics/financial-analyses/:id/ratios` (ten sam rejestr). Naprawa
  (`src/components/Economics/hooks/useFinanceSelection.ts:801`): dla rekordu z
  `canonicalBusinessVersionId` w ogóle nie wołamy tras legacy — czytamy
  `GET /finance-v2/analysis/:bv/kpi-values` (pusto = pusto, nie 404).
- `src/components/Economics/FinancePreviewPanel.tsx:480` — `—` zamiast pustej wartości przed
  dwukropkiem („Analiza finansowa: Waluta: Liczba okresów: 0").

---

## 3. Testy i mutacje (jednorazowy kontener Postgres, pełne migracje)

Kontener: `pgvector/pgvector:pg16`, port 55440, świeża baza + `server/scripts/migrate.postgres.ts`
(cały łańcuch migracji od zera, w tym nowa migracja `20260905_…`).

| Suita | Wynik | Mutacja (zabezpieczenie) | RED |
| --- | :-: | --- | :-: |
| `server/src/services/finance/canonical/__tests__/analysisDefinitionService.pg.test.ts` (6 testów) | 6 passed | usunięcie `INSERT`‑a wierszy selekcji | 3 failed (testy 1, 2, 5) |
| `server/src/routes/v8/finance-v2/__tests__/derivedAnalysisSelection.routes.pg.test.ts` (2 testy, realne HTTP) | 2 passed | wycofanie wpięcia producenta w trasę (`git checkout origin/staging -- lineage-navigator.routes.ts`) | 2 failed |
| `src/components/Finance/Analysis/__tests__/AnalysisWorkspace.lineage.test.tsx` (3 testy) | 3 passed | przywrócenie `createFinanceArtifact` w `handleWizardComplete` | 3 failed |

- **Kontrola negatywna bramki** (obowiązkowa): ta sama suita `.pg` bez `RUN_DB_TESTS=1` →
  `1 skipped / 6 skipped`, **nigdy `passed`**.
- **Odczyt na zimno**: liczby wierszy czytane osobnym zapytaniem po fakcie, nie z odpowiedzi serwisu.
- Kontrole negatywne w suicie: pakiet bez okresów → `SOURCE_PACK_HAS_NO_PERIODS`, 0 wierszy, 0 definicji;
  pakiet bez jednostek → `SOURCE_PACK_HAS_NO_ENTITIES`, j.w.; przez HTTP: `409` + **zero** nowych
  artefaktów i **zero** nowych krawędzi rodowodu.
- `src/components/Finance/Analysis/__tests__/AnalysisWorkspace.flag.test.tsx` zaktualizowany do
  nowego kontraktu (domyślnie ON; OFF przez jawny override dalej wygasza ekran przed `reload()`).

**Zastane (NIE moje) czerwone, zmierzone także na czystym `origin/staging`:**

- `src/components/Finance/Analysis/__tests__/analysisKpiTable.contract.test.ts` — 2 testy,
  formatowanie procentów (`expected '35%' to be '0,35'`); pliki nietknięte tą paczką.
- `server/src/routes/v8/finance-v2/__tests__/lineage-navigator.routes.pg.test.ts` — 3 testy
  `DERIVED ANALYSIS` padają na **401** (podpisany JWT) identycznie przed i po zmianie
  (sprawdzone przez `git checkout origin/staging -- lineage-navigator.routes.ts`, ten sam wynik).
  Dlatego dowód przewodu HTTP dostał własny plik na niepodpisanym harnessie.

---

## 4. Skrypt danych i liczby

`server/scripts/finance-analiza-dbr77.ts` — `--dry-run` (domyślnie) / `--apply`, przez **te same
serwisy co UI** (`createArtifact` → `insertEdge` → `createAnalysisDefinitionWithSelection` →
`computeAnalysisKpis`), zero surowego SQL‑a zapisującego.

**Na jednorazowym PG (`--apply`, pakiet z 2 okresami i 1 jednostką):**

```
# Wiersze selekcji: 36            (18 wskaźników × 2 okresy × 1 jednostka)
# Przeliczono wskaźników: 36
# Komórek z realną wartością (odczyt na zimno): 13
```

Rozkład statusów: `PRESENT_NONZERO` 13, `MISSING` 16, `NA` 3, `NOT_APPLICABLE` 4 — reszta jest pusta
uczciwie, bo fikstura ma tylko 9 kodów linii. Wartości sprawdzone ręcznie:
`CURRENT_RATIO` = 56 500 000 / 17 500 000 = **3,2286**; `REVENUE_GROWTH_YOY` = **0,1111** (1/0,9−1);
`ROE` = **0,1791`; `DSO` = **49,54**.

**Na stagingu (`--dry-run`, tylko odczyt):**

```
# Organizacja: DBR77 (a3e05d4a-5397-419d-b486-8e44366c0063)
# Aktywny katalog wskaźników: 18
# Pakiety sprawozdań (STATEMENT_PACK): 5
  - cafc575d… | DRAFT | jednostki=0 okresy=0 linie=0 | Sprawozdanie 2025
  - 30e7a391… | DRAFT | jednostki=0 okresy=0 linie=0 | financial_statement_packs:8e5fadde…
  - a6cfac3f… | DRAFT | jednostki=0 okresy=0 linie=0 | financial_statement_packs:901581c8…
  - 6d759cef… | DRAFT | jednostki=0 okresy=0 linie=0 | financial_statement_packs:19ff7554…
  - fa76db4d… | DRAFT | jednostki=0 okresy=0 linie=0 | CD PROJEKT Group 2025
WYNIK: BLOKADA — żaden pakiet nie ma jednostek i okresów z danymi (F-M5 niescalone).
```

**Komenda apply dla nadzorcy** (dopiero PO scaleniu F‑M5 i ponownym imporcie pakietu DBR77 —
dziś zwróciłaby tę samą blokadę):

```
DATABASE_URL="<staging DATABASE_PUBLIC_URL>" npx tsx server/scripts/finance-analiza-dbr77.ts \
  --apply --org=a3e05d4a-5397-419d-b486-8e44366c0063 --pack=<businessVersionId pakietu z okresami>
```

---

## 5. Domknięcie

- `cd server && npx tsc --build tsconfig.build.json` → **exit 0**.
- `npx tsc --noEmit` na `server/scripts/finance-analiza-dbr77.ts` (poza `include` tsconfig.build) → **exit 0**.
- esbuild każdego dotkniętego pliku frontendu → **0 błędów** (6 plików).
- `bash scripts/check-list-canon.sh` → **exit 0** („naruszeń 361, baseline 364 — dług nie rośnie").
- `git diff --name-only origin/staging..HEAD -- server/migrations` → **tylko `A` (nowy plik)**.
- `npx vitest run src/components/Finance/Analysis src/components/Economics/__tests__` →
  253 passed / 2 failed (obie zastane, §3).

## 6. Czego NIE ma i dlaczego

1. **Wskaźników DBR77 na stagingu nie będzie, dopóki nie wejdzie F‑M5.** Pakiety kanoniczne DBR77
   są puste (0 jednostek / 0 okresów / 0 linii); dane leżą w torze legacy `financial_statements`.
   F‑P4 jest producentem selekcji, nie producentem okresów. Zbudowanie kalendarza/okresów
   (`financeCalendarService`) i materializacji linii to zakres F‑M5 — nie wchodziłem w niego, żeby
   nie zderzyć się z równolegle wydaną paczką (ten sam plik i ta sama nazwa).
2. **Benchmarki** — patrz decyzja 1 w §2.
3. **Pole nazwy w kreatorze** — nazwa jest proponowana z etykiety pakietu i zmienialna akcją
   „Zmień nazwę"; osobnego inputu w kreatorze nie dokładałem (kanon Triady, osobny odbiór wzrokowy).
   UWAGA: `renameFinanceArtifact` nadpisuje `natural_key`, czyli klucz replayu idempotencji tej
   trasy — **zastana pułapka**, nie wprowadzona tutaj; warta osobnego dyżuru.
4. **Zrzuty ekranu** — brak. Zgodnie z CLAUDE.md #7 właściciel nie jest pierwszym testerem
   wizualnym; ekran Analizy pokaże wskaźniki dopiero po F‑M5, więc zrzut zrobiony dziś pokazywałby
   pusty stan i nie byłby odbiorem.

## 7. Ryzyka

- **Krawędzie rodowodu są append‑only.** Dlatego odmowa jest przed zapisem, a nie po
  (test HTTP dowodzi: `409` ⇒ zero nowych krawędzi).
- **Zmiana kontraktu trasy `derived-analysis`**: pakiet bez danych daje teraz `409` zamiast `201`.
  To celowe (koniec analiz‑widm), ale zmienia zachowanie akcji „+ Nowa analiza" w `FinanceHub`
  dla dzisiejszych pustych pakietów DBR77 — właściciel zobaczy komunikat „Pakiet sprawozdań nie ma
  jeszcze zarejestrowanych jednostek…", nie pusty ekran. Cofnięcie: `git revert` commitu `b8d7e3db64`.
- **Flaga `financeAnalysisWorkspaceV1` domyślnie ON** — ekran Analizy staje się widoczny bez
  override. Cofnięcie: lokalny override `false` (natychmiastowe), potem `git revert` commitu `7e8783bbeb`.
