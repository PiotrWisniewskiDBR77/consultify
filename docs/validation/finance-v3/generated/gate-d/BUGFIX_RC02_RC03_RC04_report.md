# Fix report — RC-02 / RC-03 / RC-04 (real-company proof findings, Apator)

**Zakres:** trzy defekty P1 z `REAL_COMPANY_PROOF_report.md` §5 — znalezione dopiero na prawdziwym,
złożonym sprawozdaniu IFRS Grupy Apator. Syntetyczny oracle GoldCo nie mógł ich złapać: jest
denominowany w `unit='UNITS'` (RC-03 nie ma jak się ujawnić), spełnia tożsamość zysków zatrzymanych
z konstrukcji (RC-02), i nosi koszty ze znakiem dodatnim (RC-04).

**Data:** 2026-08-10 · **Gałąź:** `codex/finance-v3-gate-a-20260809`
**Commity:** `e5bc971e29` (RC-02 + RC-03, migracja) · `675884c5b1` (RC-04, kod) · `35d7fc4a76` (13 testów)
**Werdykt:** wszystkie trzy naprawione, dowód czerwony-przed / zielony-po na realnych liczbach Apatora,
pełna regresja `server/src/services/finance/canonical/__tests__/` zielona **222/222** (baseline 209 + 13 nowych).

**Bazy:** wyłącznie własne efemeryczne klastry PostgreSQL 15.15 (Homebrew `postgresql@15`, `initdb --locale=C`,
`LC_ALL=C` przy initdb i przy `pg_ctl start`, porty sprawdzone `lsof`-em: **56731** i **57841**, katalogi
`/private/tmp/rc-bugfix-pgdata` i `/private/tmp/rc-fresh-pgdata`, `pg_ctl stop` + `rm -rf` po przebiegu).
**Zero kontaktu z demo / dev / prod.** Vitest uruchamiany **z katalogu `server/`** (z roota daje
„No test files found" + exit 1, czyli fałszywy sukces).

---

## 1. RC-03 (P1, naprawione pierwsze) — tolerancja bilansu porównywana w złej skali

### Przyczyna

`finance_stmt_balance_tolerance()` (`server/migrations/20260809_finance_v3_d01_statements_02_integrity.sql:41-68`)
zwracała jako część „rounding" wartość `finance_stmt_unit_value(p_unit)` — czyli **1000 dla `THOUSANDS`** —
i porównywała ją z różnicą `value_decimal`. Ale `value_decimal` **jest już wyrażone w jednostce
prezentacji**: przy `unit='THOUSANDS'` zapis `965357` znaczy 965 357 tys. PLN. Komentarz w migracji mówi
„1 full presentation unit" (czyli 1 000 PLN), a efektywnie dopuszczone było 1000 jednostek prezentacji,
czyli **1 000 000 PLN**. Przy `unit='MILLIONS'` — miliard.

To dotyczy bramki, która ma być ostatnią linią obrony przed niezbilansowanym pakietem, oraz — przez ten
sam helper — roll-forwardu gotówki, roll-forwardu zysków zatrzymanych i kontroli wyłączeń.

### Naprawa

Nowa **addytywna** migracja `server/migrations/20260810_finance_v3_d01c_real_company_integrity_fix.sql`
(`CREATE OR REPLACE FUNCTION`; już zaaplikowany plik migracji NIE był edytowany). Część „rounding"
tolerancji jest teraz wyrażona w **tej samej skali co porównywana wartość**: dwie niezależnie zaokrąglone
sumy cząstkowe niosą najwyżej po 0,5 jednostki prezentacji błędu, więc najgorszy przypadek to 1 pełna
jednostka prezentacji — a 1 jednostka prezentacji wyrażona w jednostkach prezentacji to **1,0**, niezależnie
od tego co mówi `unit`.

Część „materiality" (`materiality_pct * ABS(total_assets)`) była od początku poprawna skalowo (ułamek
wartości w tej samej skali) i jest nietknięta, tak samo reguła `LEAST(rounding, materiality)` oraz
zachowanie „nierozpoznana jednostka → NULL".

Sonda na żywym, świeżo zmigrowanym klastrze:

```
   unit    | unit_multiplier | tolerance_post_fix
-----------+-----------------+--------------------
 UNITS     |               1 |                  1
 THOUSANDS |            1000 |                  1     <- przed naprawą: 1000
 MILLIONS  |         1000000 |                  1     <- przed naprawą: 1 000 000
 BILLIONS  |      1000000000 |                  1
 NONSENSE  |          (null) |             (null)
```

Przy `unit='UNITS'` zwracana tolerancja to nadal 1 — czyli **każde istniejące oczekiwanie GoldCo jest
nietknięte** (probe BUG-GOLDCO-02 w logach raportuje `tolerance=1` i dalej tak raportuje). Zmiana jest
wyłącznie **zacieśnieniem** dla pakietów THOUSANDS/MILLIONS/BILLIONS.

### Dowód czerwony-przed / zielony-po (realny bilans Apatora FY2024, `TOTAL_ASSETS = 965 357` tys. PLN)

| test | przed naprawą | po naprawie |
|---|---|---|
| nierównowaga **500 tys.** → odrzucona | ✗ `promise resolved ... instead of rejecting` (**ZAAKCEPTOWANA**) | ✓ odrzucona |
| komunikat triggera raportuje `tolerance=1` | ✗ raportował `tolerance=1000` | ✓ `diff=500 tolerance=1` |
| nierównowaga 1 500 tys. → odrzucona | ✓ (już działało) | ✓ |
| zbilansowany bilans → commit | ✓ | ✓ (brak nadmiarowego odrzucania) |
| różnica 1 jednostki (zaokrąglenie) → commit | ✓ | ✓ |

---

## 2. RC-02 (P1) — roll-forward zysków zatrzymanych wywracał import prawidłowego IFRS

### Przyczyna

`finance_stmt_check_retained_earnings_rollforward()` egzekwowała
`opening_RE + NET_INCOME − DIVIDENDS_DECLARED = closing_RE` przez `RAISE EXCEPTION`, a ponieważ jest to
`CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, wyjątek **przerywał całą transakcję
mapowania w momencie COMMIT** — analityk nie dostawał ostrzeżenia ani pozycji do rozstrzygnięcia, tylko
utratę całego importu.

Na realnym skonsolidowanym sprawozdaniu Apatora ta tożsamość **nie obowiązuje i nie jest to błąd danych**:

| Rok | opening RE | + NI | − dywidendy | = implikowane | raportowane closing RE | luka (tys. PLN) |
|---|---:|---:|---:|---:|---:|---:|
| FY2023 | −29 215 | 8 504 | 14 612 | −35 323 | **−72 699** | **37 376** |
| FY2024 | −72 699 | 73 214 | 17 428 | −16 913 | **8 590** | **25 503** |

Skonsolidowany kapitał IFRS legalnie zmienia się także poza wynikiem netto i dywidendami: pozostałe
całkowite dochody (OCI) przeksięgowane na zyski zatrzymane, korekty lat ubiegłych / błędów, transakcje
z właścicielami (akcje własne, płatności w formie akcji), przeniesienia między zyskami zatrzymanymi
a pozostałymi kapitałami, ruchy udziałów niekontrolujących.

Twarde wywrócenie importu jest wprost sprzeczne z **DEC-FIN-009** („system nie blokuje pracy z powodu
błędów danych; blokują tylko naruszenie bezpieczeństwa/tenanta i operacja matematycznie nieokreślona").

### Naprawa (ta sama addytywna migracja)

**(a) Dodatkowe legalne składniki wchodzą do tożsamości, gdy dane je niosą.** Addytywna linia
taksonomii `OTHER_EQUITY_MOVEMENTS` (`BS`, `is_system`, id `fsl-bs-other-equity-movements`) — tym samym
wzorcem, którym oryginalna migracja §8.2 dodała `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED`. Zbiera dokładnie
te legalne ruchy zysków zatrzymanych, które nie są wynikiem netto ani zadeklarowaną dywidendą. Gdy pakiet
ujawnia most, tożsamość domyka się co do grosza i nie dzieje się nic.

**(b) Resztowa luka ponad tolerancję nie wywraca niczego.** Zamiast `RAISE EXCEPTION` trigger:

1. zapisuje wiersz `RAISED` do `finance_exceptions` (`reason_code='RE_ROLLFORWARD_UNEXPLAINED'`),
   z `expected` (implikowane closing), `observed` (raportowane closing), `delta`, `unit`, pełnym
   `source_ref` i `evidence` (wszystkie składniki mostu + tolerancja + użyty próg istotności),
   oraz z czytelnym `reason` podpowiadającym zmapowanie mostu na `OTHER_EQUITY_MOVEMENTS`;
2. degraduje `finance_business_versions.result_quality` do `PROVISIONAL` (severity `MATERIAL`) albo
   `CONDITIONAL` (severity `WARNING`), nigdy nie podnosząc z powrotem już ustawionego `PROVISIONAL`
   i nigdy nie dotykając wersji `APPROVED`;
3. **zostawia import zacommitowany.**

**Stopniowanie istotności:** luka odniesiona do `GREATEST(ABS(closing_RE), ABS(opening_RE))`, porównana
z progiem istotności zamrożonym na ostatnim przebiegu rekonsyliacji tej wersji, a gdy takiego nie ma —
z 5-procentowym placeholderem `PROVISIONAL_PENDING_OWNER_DECISION`
(`statementReconciliationService.PROVISIONAL_MATERIALITY_THRESHOLD_PCT`). Apator FY2023:
37 376 / 72 699 = **51,4% → `MATERIAL` → wersja `PROVISIONAL`**.

**Deduplikacja:** trigger jest `FOR EACH ROW` (Postgres nie ma constraint triggerów `FOR EACH STATEMENT`),
więc bez zabezpieczenia logowałby jeden wyjątek na każdy wiersz BS/P&L w partii. `dedup_key` =
`RE_ROLLFORWARD:<version>:<entity>:<period>:<basis>:<scope>` daje **dokładnie jeden** wyjątek na komórkę
(potwierdzone testem).

**Czego naprawa NIE rusza:** `Aktywa = Pasywa` (§8.1) dalej **twardo odrzuca**. To tożsamość księgowa,
która nie może legalnie nie zajść — inaczej niż roll-forward RE. Nietknięta jest też reguła
„`DIVIDENDS_DECLARED` w stanie `MISSING` ⇒ nie da się zweryfikować, pomiń (nigdy ciche zero)" oraz
obsługa zakresów `STANDALONE`/`CONSOLIDATED` z poprawki d01b.

### Dowód czerwony-przed / zielony-po (realny most Apatora FY2022→FY2023)

Przed naprawą, dosłownie z logu (identyczny komunikat jak w raporcie źródłowym):

```
error: finance_stmt_lines: retained earnings roll-forward failed for version=0c73a45a-… scope=CONSOLIDATED:
       opening=-29215 + NI=8504 - dividends=14612 != closing=-72699 (diff=37376, tolerance=1000)
```

| test | przed | po |
|---|---|---|
| import się COMMITUJE (4 wiersze realnie w `finance_stmt_lines`) | ✗ cała transakcja wywalona | ✓ |
| wyjątek `MATERIAL` / `RE_ROLLFORWARD_UNEXPLAINED`, `expected=−35 323`, `observed=−72 699`, `|delta|=37 376`, `evidence.gap=37 376`, `unit=THOUSANDS`, stan `OPEN` | ✗ brak (nie było czego zapisać) | ✓ |
| dokładnie **1** wyjątek na komórkę, nie jeden na wiersz partii | ✗ | ✓ |
| `result_quality='PROVISIONAL'`, `status='DRAFT'` | ✗ | ✓ |
| ujawniony most (`OTHER_EQUITY_MOVEMENTS = −37 376`) → 0 wyjątków, `result_quality` NULL | ✗ (kod linii nie istniał, import dalej wywalony) | ✓ |
| `Aktywa = Pasywa` dalej twardo odrzuca (10 000 tys. rozjazdu) | ✓ | ✓ |

---

## 3. RC-04 (P1) — `sign_convention='CONTRA'` zapisywane, ale nigdy nie stosowane

### Przyczyna

`kpiComputeService.loadStmtLineCells()` pobierało
`entity_id, canonical_line_id, period_id, consolidation_scope, accumulation_basis, value_status, value_decimal`
— **bez `sign_convention`**. Realne sprawozdanie niesie koszty ze znakiem ujemnym „as filed"
(Apator FY2024 `COGS = −913 065` tys. PLN); pakiet deklarował dla tej linii `sign_convention='CONTRA'`
i zapis się udawał, ale odczyt tej kolumny nie widział. Ujemny mianownik + `negative_denominator_policy='FORCE_NA'`
na DIO i DPO ⇒ oba KPI wychodziły `NOT_APPLICABLE`. Jedynym wyjściem dla analityka było fizyczne
odwrócenie znaku w pakiecie, co niszczy wartość „as filed".

### Naprawa

`server/src/services/finance/canonical/kpiComputeService.ts` — `sign_convention` w projekcji SELECT
+ zastosowanie konwencji przy odczycie (`CONTRA` ⇒ negacja), dokładnie ten sam odczyt, który trigger
kontroli wyłączeń już robi w SQL (`…_02_integrity.sql` §8.5:
`SUM(CASE WHEN sign_convention = 'CONTRA' THEN -value_decimal ELSE value_decimal END)`).
`value_status` świadomie **nie** jest przeliczany — negacja nie zamieni `PRESENT_NONZERO` w `PRESENT_ZERO`
ani `MISSING` w cokolwiek. Wiersze `NATURAL` (czyli każdy istniejący fixture i każdy wiersz GoldCo)
są bit w bit takie same jak przed zmianą.

### Dowód czerwony-przed / zielony-po (realne liczby Grupy Apator, tys. PLN)

Dane: `INVENTORY` FY2023 = 242 296 / FY2024 = 225 460 · `AP` FY2023 = 93 591 / FY2024 = 722 ·
`COGS` FY2024 = −913 065 (`CONTRA`). FY2024 to rok przestępny ⇒ `DAYS_IN_PERIOD = 366`, więc
COGS/dzień = 2 494,7131.

| KPI | oczekiwane (liczone ręcznie) | przed naprawą | po naprawie |
|---|---:|---|---|
| DIO | 233 878 / 2 494,7131 = **93,7495** (raport: 93,749) | ✗ `NOT_APPLICABLE` | ✓ `PRESENT_NONZERO`, 93,7495 |
| DPO | 47 156,5 / 2 494,7131 = **18,9026** (raport: 18,903) | ✗ `NOT_APPLICABLE` | ✓ `PRESENT_NONZERO`, 18,9026 |

Dosłownie z logu przed naprawą: `AssertionError: expected 'NOT_APPLICABLE' to be 'PRESENT_NONZERO'`.

Test asercjonuje dodatkowo, że **zapisana wartość dalej jest ujemna** (`value_decimal = −913 065`,
`sign_convention = 'CONTRA'`) — naprawa nie polega na „przepisz pakiet". Drugi test bierze te same liczby
z ręcznie znormalizowanym, dodatnim COGS (`NATURAL`) i wymaga **identycznych** DIO/DPO: naprawa zmienia
zasięg, nie wyniki.

---

## 4. Przebiegi weryfikacyjne

### 4.1 Czerwony przed / zielony po

Klaster efemeryczny **56731**, zmigrowany bez nowej migracji d01c; kod RC-04 cofnięty w drzewie roboczym
do wersji z commita rodzica (`git show e5bc971e29:…/kpiComputeService.ts`, bez użycia `git stash` — stash
jest w tym repo współdzielony między worktree i już raz wywołał wyścig między sesjami):

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:56731/finance_v3_rc \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/statementServices.pg.test.ts \
    src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts --no-file-parallelism
```

**Przed: `Tests  8 failed | 16 passed (24)`** — padło dokładnie 8 nowych testów dotykających trzech
defektów (5 RC-03/RC-02 na tolerancji i imporcie, 1 RC-04; pozostałe 5 nowych to asercje spójności, które
przechodziły także przed naprawą, np. „1 500 tys. dalej odrzucone", „`Aktywa = Pasywa` dalej twarde").
Żaden istniejący test nie zaczerwienił się przy cofniętej naprawie.

**Po (migracja d01c zaaplikowana, kod przywrócony): `Test Files 2 passed (2)`, `Tests 24 passed (24)`.**

### 4.2 Pełna regresja

```
… npx vitest run --config vitest.config.ts src/services/finance/canonical/__tests__/ --no-file-parallelism
```

**16 plików, `Tests 222 passed (222)`** — poprzedni pomiar tego katalogu to 209/209, więc 209 baseline
+ 13 nowych testów, **zero regresji**. Żaden istniejący test nie wymagał zmiany.

### 4.3 Świeża instalacja od zera

Drugi, niezależny klaster efemeryczny **57841** (`initdb --locale=C`, `LC_ALL=C`), migracja całego repo
od pustej bazy: **609 plików migracji zaaplikowanych, exit 0**, nowa migracja d01c w kolejce na swoim
miejscu (faza „dated", po plikach `20260809_…`). Pełna regresja na tym świeżym klastrze: ponownie
**16 plików, 222/222**.

### 4.4 Sprzątanie

Oba klastry (`/private/tmp/rc-bugfix-pgdata` port 56731 i `/private/tmp/rc-fresh-pgdata` port 57841)
zatrzymane `pg_ctl stop` i usunięte `rm -rf` po przebiegu.

---

## 5. Zmienione pliki

- `server/migrations/20260810_finance_v3_d01c_real_company_integrity_fix.sql` (**nowy, addytywny**) —
  RC-03 (`finance_stmt_balance_tolerance`), RC-02 (linia taksonomii `OTHER_EQUITY_MOVEMENTS`
  + `finance_stmt_check_retained_earnings_rollforward`). Żaden już zaaplikowany plik migracji nie
  został zmieniony; nazwa bez słowa „seed" i bez SQLite-owego `DATETIME`, więc runner jej nie wyklucza.
- `server/src/services/finance/canonical/kpiComputeService.ts` — RC-04 (projekcja `sign_convention`
  + `applySignConvention()` przy odczycie). Zmiana ograniczona do `loadStmtLineCells()`.
- `server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts` — 11 nowych testów
  regresyjnych (5× RC-03, 6× RC-02).
- `server/src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts` — 2 nowe testy
  regresyjne (RC-04).
- ten raport.

---

## 6. Co pozostaje otwarte (poza zakresem tego pakietu)

- **RC-00 (P0)** — błąd 1000× dla dokumentów z angielskim separatorem tysięcy (Tesla / Coca-Cola / BMW / bp).
  Nietknięty; to warstwa ekstrakcji, nie Gate D.
- **RC-01 / RC-05 / RC-06 / RC-07 / RC-08 / RC-09** — nietknięte, zgodnie z zakresem zadania.
  Uwaga do RC-05: użyta w teście RC-04 wartość `AP FY2024 = 722` jest **realnym defektem ekstrakcji**
  opisanym w RC-05 — test bierze ją świadomie, bo to liczba, która naprawdę przeszła przez potok,
  a przedmiotem testu jest konwencja znaku, nie wiarygodność AP.
- **Retrospektywna klasyfikacja istniejących danych.** Migracja jest czysto addytywna i nie przelicza
  wstecz żadnego już zaimportowanego pakietu: wersje zaimportowane przed nią, które przeszły przy
  1000× luźniejszej tolerancji, zachowują swoje `result_quality`. Ewentualny przegląd wsteczny to
  osobna decyzja właścicielska.
- **Sygnalizacja `PROVISIONAL` w UI.** Trigger ustawia `finance_business_versions.result_quality`;
  czy i jak Exception Inbox / nagłówek artefaktu pokazują ten stan analitykowi — poza tym pakietem.
