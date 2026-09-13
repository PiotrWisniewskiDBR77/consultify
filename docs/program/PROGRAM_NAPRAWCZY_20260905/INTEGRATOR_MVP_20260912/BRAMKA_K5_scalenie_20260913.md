# BRAMKA K5 — pomiar scalonego kandydata 1475518275 (2026-09-13)

Stanowisko: `/Users/piotrwisniewski/Developer/wt/kandydat-20260913`, gałąź
`integracja/kandydat-20260913`, HEAD `1475518275` ("scalenie: gora podgladow
Realizacji (Work/Risk/Reports) 1:1 jak wzorzec — executionPreviewHead
[ODMROZENIE 06_EXECUTION DEC-491] [ODMROZENIE WSPOLNE DEC-491]").

Baza porównawcza: `cf3fded7e4` (worktree `wt/gate-base`, detached).

Pomiar kontynuował sesję nadzorcy, który wykonał kroki 1–4 i uruchomił testy
per plik w tle, po czym przerwał turę po 49/106 plikach. Ta sesja
zweryfikowała ponownie kroki 1–4, dokończyła pozostałe 57 plików testowych
w pierwszym planie, zbudowała kandydata i zrobiła smoke wizualny 4 ekranów.

## Werdykt

**CZERWONA (1 nowa regresja testowa)** — `ExecutionResources.wiszacaRealizacja.test.tsx`
przechodzi na bazie `cf3fded7e4`, ale nie przechodzi na kandydacie `1475518275`.
Pozostałe 9 czerwonych plików testowych to dług ZASTANY (fail identycznie na
bazie, kandydat go nie pogłębia). Wszystkie pozostałe bramki (tsc, kanon,
artefakt, język, build) — ZIELONE, bez wzrostu długu.

## Tabela kroków

| Krok | Komenda / zakres | Wynik | Próg | Werdykt |
|---|---|---|---|---|
| 1. tsc serwer | `cd server && npx tsc --noEmit -p tsconfig.json` | EXIT=0 | EXIT=0 | ZIELONY |
| 2. tsc front | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json \| grep -c 'error TS'` | 189 | ≤189 | ZIELONY (na granicy) |
| 3. kanon tabel | `bash scripts/check-list-canon.sh` | 322 naruszenia (baseline 357, pełny skan repo — staging pusty) | ≤322 | ZIELONY (dług spadł o 35) |
| 4. kanon artefaktów | `bash scripts/check-artefakt.sh` | crimson 8 / R2+R3 0 / danger-* 117 | 8-0-117 | ZIELONY (bez wzrostu) |
| 5. bramka językowa | pomiar-jezyka `--baseline` vs `cf3fded7e4` | "BRAMKA JĘZYKOWA: OK (nic nie wzrosło)." | bez wzrostu | ZIELONY |
| 6. testy per plik | 106 plików (diff vs `cf3fded7e4` w Execution/Initiatives/shared/ModuleHub/standard __tests__) | 96 PASS / 10 FAIL → 1 NOWA, 9 ZASTANE | 0 nowych | **CZERWONY** (1 nowa) |
| 7. build | `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | EXIT=0 | EXIT=0 | ZIELONY |
| 8. czystość drzewa po buildzie | `git status --short \| grep -v '^??'` | puste | puste | ZIELONY |
| 9. SHA256 dist/index.html | `shasum -a 256 dist/index.html` | `b11d2b79af20566e1d6135f95a1ae43c383db8bf7a6d5e7a4ed11f1f062a1145` | — | informacyjny |
| 10. smoke wizualny | 4 ekrany dev-render, 1440×900, jasny | patrz niżej | patrz niżej | ZIELONY z 1 uwagą harnessu |

## Czerwienie testowe — klasyfikacja

### NOWA (regresja wprowadzona przez kandydata)

- **`src/components/Execution/__tests__/ExecutionResources.wiszacaRealizacja.test.tsx`**
  Test: `Zasoby — realizacja, która nie odpowiada > oznacza wiszącą realizację na liście wyboru, gdy minie limit`
  Błąd: `TestingLibraryElementError: Unable to find an element with the text: Akceptacja ACO — nie odpowiada.`
  Baza `cf3fded7e4`: **PASS** (6/6 testów). Kandydat `1475518275`: **FAIL** (1/6).

### ZASTANA (dług pre-istniejący, fail identycznie na bazie `cf3fded7e4`)

| Plik | Kandydat | Baza cf3fded7e4 |
|---|---|---|
| `Execution/__tests__/ExecutionRuntimeSpine.contract.test.ts` | FAIL (2/4) | FAIL (2/4) |
| `Execution/__tests__/ExecutionWorkSurface.edycjaWierszem.test.tsx` | FAIL (8/14) | FAIL (8/14) |
| `Execution/__tests__/ExecutionWorkSurface.ownerNames.test.tsx` | FAIL (1/2) | FAIL (1/2) |
| `Initiatives/__tests__/InitiativesHub.menu3Chips.test.tsx` | FAIL | FAIL (1/3) |
| `Initiatives/__tests__/PlanScenarioSurface.listaPlanow.test.tsx` | FAIL | FAIL (0/2) |
| `Initiatives/__tests__/a19-jedna-tabela-render.test.tsx` | FAIL | FAIL (0/3) |
| `Initiatives/__tests__/capacityAnalysis.brakPresji.test.tsx` | FAIL | FAIL (4/5) |
| `standard/__tests__/registry.kompletnosc.test.ts` | FAIL | FAIL (3/4) |
| `tests/unit/initiatives-execution/executionReportsSurface.test.tsx` | FAIL | FAIL (3/8) |

Wszystkie 9 powyższych plików istnieją na `gate-base` i failują tam identycznie
(ten sam zestaw asercji) — kandydat nie pogłębia tego długu.

## Smoke wizualny (jasny, 1440×900)

Zrzuty: `/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/ff2cdccb-5f25-4e7b-8c89-b49d8cf2aabd/scratchpad/gate-scalenie/shots/`
- `k5-preview-bank.png` — bank z otwartym podglądem (kliknięty pierwszy wiersz
  „Component stock optimisation"). Kolumna tytułowa (INITIATIVE/CASE) szeroka,
  „Copy link" widoczny bez przewijania, brak sekcji „What's next". ZGODNE.
- `k5-preview-work.png` — zakładka Work, lista zadań z „Days overdue". ZGODNE.
- `k5-raporty-realizacja.png` (`?runs=0`) — „New report" widoczny w nagłówku.
  UWAGA HARNESZU: parametr `?runs=0` nie wymusił pustego stanu rejestru migawek
  (widać 2 pozycje z demo-fallbacku produktu zamiast `All 0`) — stub
  `window.fetch` w tym NOWYM pliku dev-render (`k5-raporty-realizacja.tsx`,
  nie istnieje na `gate-base`) przechwytuje inny URL niż realnie woła
  `ExecutionReportsSurface`, więc komponent spada na wbudowany demo-fallback.
  To wada samego harnessu (plik dev-render, nie wchodzi na demo runtime), nie
  produktu — nie blokuje bramki, wymaga poprawki stubu przy kolejnej turze.
- `inicjatywy-lista.png` — 3 chipy Menu (All 9 · Pending approval 4 · In
  execution 2) obecne i poprawne. ZGODNE.

Harness dev-render uruchomiony na porcie 5318 (proces zastany z poprzedniej
tury sesji, cwd = kandydat-20260913), zatrzymany po zrzutach.

## Uwagi metodyczne

- Wynik testów per plik miał duplikaty w `test-results.tsv` (57 plików z listy
  „remaining" pojawiło się dwukrotnie — artefakt nieprzekierowanego stdin w
  pętli `while read` z procesem w tle). Zdeduplikowano
  (`test-results.dedup.tsv`, pierwsze wystąpienie), bez konfliktów kodów
  wyjścia między duplikatami — liczby w tabeli są ze zdeduplikowanego zbioru.
- `node_modules` w `wt/gate-base` jest dowiązaniem symbolicznym do
  `wt/kandydat-20260913/node_modules` (nie do `Consultify/node_modules` jak
  sugerował runbook) — ustawione przez poprzednika tej tury; działa poprawnie
  dla uruchomienia testów porównawczych.
