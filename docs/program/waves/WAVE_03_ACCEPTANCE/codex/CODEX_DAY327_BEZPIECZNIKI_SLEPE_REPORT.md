# CODEX DAY 327 — bezpieczniki ślepe

Stan: W TOKU. Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`.

## Wejście

`MARKER OK`; `HEAD=1c3d3da844ae03c87985a8f5dc74846a073c0220`; status po utworzeniu worktree: pusty. Tip `github-backup/grafika/m03-20260902` uciekł o 9 commitów; praca rozpoczęta dokładnie z markera. Dysk: 66 GiB przed utworzeniem worktree, 63 GiB po. Porty 6353 i 5493: puste; kontenery `cx-day327`: 0. `list-canon=0`, `artefakt=0`, `focus-canon=0`.

Nie postawiłem kontenera, więc nie istnieje baza tego dyżuru, w której mogłaby być konfiguracja SMTP. `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` zwrócił `BRAK ZMIENNYCH POCZTY`. Grep drenaży w `server/src/Gateway.ts`: zero trafień. Baza nie była potrzebna: wszystkie badane bezpieczniki są skanerami plików.

## R0 — inwentarz rodziny

Mianownik zmierzony w `bash`: 21 nazw `check:*`, 16 skanerów w `tests/`, 11 skanerów w `src/**/__tests__`/`server/src/**/__tests__`; razem 48 pozycji. „N/Z” oznacza, że mutacji deklarowanego kształtu jeszcze nie wykonano — nie jest to werdykt szczelności.

| bezpiecznik | mianownik fizyczny / ograniczenie | czego broni asercja | mutacja deklaracji | werdykt |
|---|---|---|---|---|
| check:colors | skrypt `check-hardcoded-colors.cjs` | twarde kolory | N/Z | N/Z |
| check:colors:update | ten sam skaner, zapis baseline | baseline kolorów | N/Z | N/Z |
| check:colors:list | ten sam skaner, lista | raport kolorów | N/Z | N/Z |
| check:a11y-jsx | `check-a11y-jsx.cjs` | wzorce a11y JSX | N/Z | N/Z |
| check:a11y-jsx:update | ten sam skaner, zapis baseline | baseline a11y | N/Z | N/Z |
| check:a11y-jsx:list | ten sam skaner, lista | raport a11y | N/Z | N/Z |
| check:a11y-focus | `check-a11y-focus.cjs` | fokus | N/Z | N/Z |
| check:triada | `check-triada.sh` | triada UI | N/Z | N/Z |
| check:triada:all | ten sam skaner, pełny zakres | triada UI | N/Z | N/Z |
| check:triada:update | ten sam skaner, zapis baseline | baseline triady | N/Z | N/Z |
| check:gestosc | `check-gestosc.sh` | gęstość UI | N/Z | N/Z |
| check:artefakt | `check-artefakt.sh` | artefakty | uruchomiony: exit 0, bez mutacji | N/Z |
| check:list-canon | `check-list-canon.sh --all` | listy kanoniczne | uruchomiony: exit 0, bez mutacji | N/Z |
| check:p0p1-e1 | `p0p1-licznik-e1.mjs`; cudzy teren 328 | licznik P0/P1 | N/Z | N/Z |
| check:list-canon:update | skaner list, zapis baseline | baseline list | N/Z | N/Z |
| check:sqlsql | `check-sqlsql.sh` | SQL-in-SQL | N/Z | N/Z |
| check:z31 | `check-z31.sh` | reguła Z31 | N/Z | N/Z |
| check:z31:ci | ten sam skaner, CI | reguła Z31 | N/Z | N/Z |
| check:z31:update | ten sam skaner, zapis baseline | baseline Z31 | N/Z | N/Z |
| check:ssot | dwa skanery SSOT | ścieżki/rejestr SSOT | N/Z | N/Z |
| check:ui | kompozycja 4 skanerów | zbiorcza bramka UI | N/Z | N/Z |
| rvn-outbox-finance-projection | 1 jawny plik źródłowy w statycznym proof | brak legacy `financial_*` | N/Z | N/Z |
| organizations-trial-tokens migration | migracje + jawne pliki | slot/checksum/runner | N/Z | N/Z |
| m01 migration discovery | katalog migracji z filtrami/allowlistą | discovery/determinism | N/Z | N/Z |
| m02b preflight checksum | katalog migracji + jawne pliki | checksum/discovery parity | N/Z | N/Z |
| partner-economics mounted auth | 1 migracja odczytana | zamontowany auth/PG | N/Z | N/Z |
| alignmentNoScoreMutation | 3 jawne pliki | zakazane mutacje OKR | N/Z | N/Z |
| teresa-kpi-forbidden-verbs | 2 jawne pliki | zakazane czasowniki KPI | N/Z | N/Z |
| teresa-okr-forbidden-verbs | 3 jawne pliki | zakazane czasowniki OKR | N/Z | N/Z |
| teresa-roi-forbidden-verbs | 3 jawne pliki | zakazane czasowniki ROI | N/Z | N/Z |
| noRuntimeDdl | całe `server/src`, ale cicho pomija `__tests__` | runtime DDL vs allowlista | probe przed: zielony | WĄSKI MIANOWNIK |
| noRawErrorMessage | 550 deklarowanych przez algorytm; pomija `__tests__` | surowe błędy HTTP | `.catch((problem)=>...)` przed: zielony | WĄSKI MIANOWNIK |
| focusCanonZero | 1 baseline + skrypt | fokus crimson | exit 0, bez mutacji | N/Z |
| rawEnumLeakScanner | `Finance/**`, jawne wykluczenia | raw enum w UI | N/Z | N/Z |
| noRawErrorInJsx | deklaruje 6, faktycznie czyta 3 | raw error w JSX | probe przed: zielony | WĄSKI MIANOWNIK |
| action-coverage-inventory | CSV + backlog + baseline | spójność inwentarza | N/Z | N/Z |
| no-hardcoded-credentials | rooty repo minus allowlista | sekrety literalne | ma syntetyczne kontrolki | N/Z |
| closeoutCo8RuntimeDdl | jawne runtime DDL + migracja | default/status PG | N/Z | N/Z |
| demoAcceptanceFixturePlan | jawny plan/run.ts | bezpieczeństwo fixture | N/Z | N/Z |
| fin005SeedAtelierFinance | moduł + jawne zależności | fail-closed seed | N/Z | N/Z |
| coldReopen | oracle JSON | integralność cold reopen | N/Z | N/Z |
| hashConsolidationGuard | Finance tree + allowlista | inline SHA-256 | N/Z | N/Z |
| roiFinanceReconciliationAdapter | migracja | real-PG adapter | N/Z | N/Z |
| valuationLegacySuccessor | artefakt PPTX | canonical valuation | N/Z | N/Z |
| migrationsV2Baseline | repo tree z filtrami | legacy-only migrations-v2 | N/Z | N/Z |
| roiReadSurfaceInventory | jawne rooty + inventory | nieznane read surfaces | ma syntetyczne kontrolki; nieuruchomione | N/Z |
| financeWorkspaceResolver | 1 jawny source | tabela resolvera | N/Z | N/Z |
| chatV9FeatureFlags | `src/utils` filtrowane po nazwie + dokumenty | spójność rejestru flag | N/Z | N/Z |

Imienna lista już potwierdzonych przypadków innych niż `SZCZELNY`: `noRuntimeDdl`, `noRawErrorMessage`, `noRawErrorInJsx`. Nie orzekam o pozostałych 45 bez mutacji. Pełny R0 pozostaje `PARTIAL`, bo wymagane 48 mutacji nie zostało jeszcze wykonane.

## Korekty wobec instrukcji

- `.catch((ident) => …)` w `server/src/routes`: pomiar własny 71, instrukcja 72.
- `grep -c "^  'src/" noRawErrorInJsx.test.ts` zwraca 12, bo liczy także klucze obiektu baseline; fizyczna tablica `COVERED_FILES` ma 6 pozycji.

## §0.2e

Pakiet pięciu skanerów nie montuje `ApiGateway`, `verifyToken`, `v8FeatureGate` ani `resultsInternalBetaVisibility`; pułapki (a)–(d) nie leżą na jego ścieżce. Pułapka (e) dotyczy `noRawErrorInJsx`: dotychczas asercja długości listy nie dowodziła odczytu. Przebieg przed zmianami: 16/16, pełne nazwy w `/private/tmp/cx-day327-bezpieczniki-slepe-artefakty/przed-nazwy.txt`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Szczelność 45 pozycji R0 bez przeprowadzonej mutacji pozostaje niezweryfikowana.
- Klasy i liczby narzędzia dnia 297 nie zostały jeszcze odczytane z cudzej gałęzi.
- Realność długu odsłoniętego R1–R4 nie została jeszcze sklasyfikowana.
