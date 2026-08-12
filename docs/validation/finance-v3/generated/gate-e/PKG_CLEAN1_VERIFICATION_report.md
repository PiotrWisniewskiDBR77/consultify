# PKG_CLEAN1 — INDEPENDENT VERIFICATION

Weryfikator: niezależna sesja, NIE autor paczki. Worktree:
`/Users/piotrwisniewski/consultify-wt/fv3p-d-statements`, gałąź
`codex/fv3p-clean1-types` @ `c06fe3c652`, baza `2b797bdeb1`. Baza danych:
świeży klaster izolowany `clean1_verify` (`/Users/piotrwisniewski/fv3-pg/newdb.sh clean1_verify`,
127.0.0.1:54330), usunięty po zakończeniu (`dropdb`). Zero połączeń do
demo/staging/prod. Żadna operacja niedestrukcyjna na drzewie autora — jedyna
modyfikacja robocza (podmiana 5 plików serwisowych na wersję pre-fix dla
kontroli negatywnej) została w pełni cofnięta i potwierdzona czystym
`git status --porcelain` przed przejściem dalej.

## Tabela werdyktów

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1a | `tsc --noEmit` z korzenia → exit 0 | Uruchomiłem sam: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit`. **EXIT 0**, log pusty (0 błędów), czas rzeczywisty **1:49 (109s)**, 126s user CPU, 117% CPU — realny, wielosekundowy przebieg całego drzewa, nie natychmiastowy OOM-abort udający sukces | **POTWIERDZONE** |
| 1b | `tsc --noEmit -p server/tsconfig.json` → exit 0 | Uruchomiłem osobno. **EXIT 0**, log pusty, czas rzeczywisty **1:24 (84s)**, 82s user CPU, 101% CPU — analogicznie realny przebieg | **POTWIERDZONE** |
| 2 | Zero maskowania (`any`/`@ts-ignore`/`@ts-expect-error`/`as unknown`/`eslint-disable`/tsconfig) | Grep całego diffu `2b797bdeb1..c06fe3c652` (case-insensitive, wszystkie dodane linie) po tych wzorcach: **zero trafień w kodzie** — jedyne trafienie to prosa w samym raporcie `PKG_CLEAN1_report.md` OPISUJĄCA twierdzenie, nie kod. `git diff --stat ... -- '*tsconfig*'` → **puste** (żaden plik tsconfig dotknięty) | **POTWIERDZONE** |
| 2a | 8× TS2783 — martwa linia przysłaniana przez `...overrides`, zero zmiany zachowania | Policzyłem usunięcia: `CanonicalStatementTableV2.test.tsx`(1) + `ReconciliationLedgerPanel.test.tsx`(2) + `RelatedArtifactsSection.test.tsx`(2) + `StatementPackWorkspaceV2.test.tsx`(1) + `deriveStatementTable.test.ts`(2) = **8, zgadza się**. W KAŻDYM z 5 plików zweryfikowałem, że `...overrides` jest spreadowane jako OSTATNIA właściwość obiektu, PO usuniętej linii, a sygnatura funkcji wymusza `overrides: Partial<X> & { pole: string }` — więc pole zawsze jest w `overrides` i spread je nadpisuje identyczną wartością. Usunięta linia była faktycznie martwa (dlatego TS2783 = "specified more than once, overwritten"). Zero zmiany zachowania | **POTWIERDZONE** |
| 2b | TS7053 w `CanonicalStatementTableV2.tsx:96` — naprawiona przyczyna źródłowa w `deriveStatementTable.ts`, nie obejście w miejscu objawu | Diff `deriveStatementTable.ts`: zwracany typ `pickHeaderCurrencyAndScale()` zmieniony z `{ currency: string; unit: string }` na `{ currency: string; unit: FinanceValue['unit'] }`. Odczytałem `CanonicalStatementTableV2.tsx:96` — `UNIT_LABELS[headerScale.unit]`, gdzie `UNIT_LABELS` to `Record<FinanceValue['unit'], string>`; wcześniej indeksowanie zwykłym `string` dawało TS7053, teraz typ wąski przechodzi. Realna naprawa przyczyny (typ funkcji źródłowej), nie rzutowanie w miejscu użycia | **POTWIERDZONE** |
| 3a | Kontrola negatywna — cofnięcie naprawy idempotencji czerwieni test | Cofnąłem 5 plików (`computeJobService.ts`, `valuationComputeService.ts`, `baselineComputeService.ts`, `kpiComputeService.ts`, `predictionComputeService.ts`) do wersji SPRZED naprawy (`git show aa4948b1d1:<plik>` — rodzic `faf5025bc9`, commitu który wprowadził `claimForCompute()`). **OBA testy poszły na CZERWONO**: `expected 500 to be 200` i `expected 500 to be 409` — dokładnie ten sam błąd co opisany oryginalny defekt P1. Przywróciłem pliki z backupu, `git status --porcelain` czysty, ponowny przebieg **2/2 zielone** | **POTWIERDZONE — realna wartość dowodowa** |
| 3b | Dwa nierozgałęzione testy (sukces vs still-running→409), nie zlane w jeden | Przeczytałem plik: dwa osobne `it()`, każdy z jednoznaczną, niewarunkową asercją (`toBe(200)`/`toBe(409)` + `toBe('JOB_NOT_RUNNING')`), zero `if`/branching na statusie | **POTWIERDZONE** |
| 3c | Asercja "dokładnie jeden wiersz" przez niezależny odczyt SQL | `countComputeJobOutputs()` robi surowy `SELECT id FROM compute_job_outputs WHERE job_id = ?` przez `withPinnedPostgresTransaction`, nie czyta z odpowiedzi HTTP ani z wartości zwróconej przez serwis | **POTWIERDZONE** |
| 3d | `vi.spyOn` na `completeJobSuccess` — uczciwe odwzorowanie przeplotu | Przechwycenie sprawdza REALNY stan bazy (`readJobStatus` musi zwrócić `'running'`, inaczej fixture rzuca błąd) przed wysłaniem drugiego żądania z wnętrza przechwycenia — nie jest atrapą całej bazy, tylko punktowym opóźnieniem jednego wywołania na już-realnym stanie. Ta sama technika jest już precedensem w `idempotentComputeRetry.pg.test.ts` (potwierdzone w komentarzu pliku i w historii `faf5025bc9`) | **POTWIERDZONE — uczciwa technika, nie atrapa** |
| 4 | 59 plików / 636 testów, wszystkie przeszły | Uruchomiłem sam pełny zestaw `server/src/routes/v8/finance-v2` + `server/src/services/finance/canonical` na realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test`, `--maxWorkers=2`): **Test Files 59 passed (59) / Tests 636 passed (636)**, 0 failed, czas 24.38s | **POTWIERDZONE** |
| 5 | Pakiet D: 8 plików / 68 testów | Uruchomiłem `npx vitest run src/components/Finance/statementPackWorkspaceV2` z korzenia: **8 plików, ALE 69 testów, nie 68**. Sprawdziłem `PKG_CLEAN1_report.md` — autor SAM ujawnia tę rozbieżność: "(8 files / 68 tests at that point in the session — task 3 later added a 9th file's worth of new tests to SourceEvidencePanel.test.tsx/financeV2.types.test.ts...)". Zweryfikowałem, że ten opis się zgadza: `SourceEvidencePanel.test.tsx` dostał +1 nowy test (pairwise distinctness) w zadaniu enum-label. Liczba nie jest zawyżeniem — jest STARYM zrzutem z wcześniejszego etapu sesji, uczciwie oznaczonym jako taki | **POTWIERDZONE (z zastrzeżeniem już ujawnionym przez autora — 69 aktualnie, nie 68)** |
| 6 | Odrzucenie `ValuationWorkspace.tsx` (#110) jako bazy, rozszerzenie `financeValueStatusLabel` obok `financeValueDisplayReasonLabel` | `src/components/Benefits/ValuationWorkspace.tsx`: `valuationStatusLabel(raw: unknown, t: TranslateFn)` operuje na enumie `'DRAFT'|'REVIEW'|'APPROVED'` (workflow, ZERO wspólnych wartości z `FinanceValueStatus`), etykiety angielskie przez i18n `t()`, zależność od komponentu React. Wymuszenie reużycia oznaczałoby albo import i18n do czystego pliku TS, albo obsługę tylko 3 z 5 wymaganych stanów. Odrzucenie MERYTORYCZNIE uzasadnione, nie wygodne. Grep po innych mapowaniach `FinanceValueStatus→etykieta` w repo: jedyne inne trafienie to `FINANCE_VALUE_STATUS_MEANING` w `server/src/types/finance/financeValueSemantics.ts` — to angielski opis DEWELOPERSKI (dokumentacja semantyki w mirror-typie Zod), nigdy renderowany użytkownikowi, więc `financeValueStatusLabel` jest realnie DRUGIM mechanizmem UI-label w PAKIECIE (obok `financeValueDisplayReasonLabel`), nie czwartym równoległym | **POTWIERDZONE — decyzja merytoryczna, nie wygodna** |
| 6b | Wszystkie 5 stanów ma etykiety parami różne, surowy token zniknął z widocznego tekstu | `financeValueStatusLabel`: PRESENT_ZERO="Obecna wartość: zero", PRESENT_NONZERO="Obecna wartość", MISSING="Brak danych", NA="Nie dotyczy (analityk)", NOT_APPLICABLE="Nie dotyczy (struktura)" — wizualnie zweryfikowałem w kodzie, plus test `financeV2.types.test.ts` sprawdza `new Set(labels).size === 5` (uruchomiłem — zielony). W `SourceEvidencePanel.tsx` diff: `{cell.value.status}` zamienione na `{financeValueStatusLabel(cell.value.status)}`, surowy token przeniesiony WYŁĄCZNIE do `data-value-status={cell.value.status}` (atrybut strukturalny). Test dodaje `not.toHaveTextContent('PRESENT_ZERO')` — aktywnie sprawdza NIEOBECNOŚĆ surowego tokenu w treści widocznej | **POTWIERDZONE** |
| 7 | Zaktualizowane asercje testów nie zostały osłabione | Diff `SourceEvidencePanel.test.tsx`: `toHaveTextContent('PRESENT_ZERO')` → `toHaveTextContent(financeValueStatusLabel('PRESENT_ZERO'))` PLUS DODANE `not.toHaveTextContent('PRESENT_ZERO')` PLUS DODANE `toHaveAttribute('data-value-status', ...)` — trzy asercje zamiast jednej, sprawdzają WIĘCEJ niż wcześniej (obecność etykiety I nieobecność surowego tokenu I poprawność atrybutu). Dodana zupełnie nowa kontrola negatywna "all five status labels are pairwise distinct". To WZMOCNIENIE, nie osłabienie | **POTWIERDZONE — testy wzmocnione** |
| 8 | Allowlista nienaruszona | `git diff --stat 2b797bdeb1..c06fe3c652` → dokładnie **12 plików**, żaden nie pasuje do `comments.routes.ts`, `saved-views.routes.ts`, `Finance/Analysis/**`, `Finance/Valuation/**`, `analysisKpiTable.contract.ts`. Sprawdziłem jawnym `git diff --name-only` na tych ścieżkach — puste | **POTWIERDZONE** |
| 9 | Brak `.skip`/`.only`, brak nieuzasadnionych usunięć asercji | Grep całego diffu po `\.(skip\|only)\(` w dodanych liniach → **zero trafień**. Wszystkie usunięte linie `expect(...)` to: (a) stare asercje idempotencji dowodzące buga — zastąpione, zweryfikowane kontrolą negatywną (pkt 3a); (b) stare asercje surowego enuma — zastąpione mocniejszymi (pkt 7). Żadne usunięcie bez wyjaśnienia/zastąpienia | **POTWIERDZONE** |

## Kluczowy wynik: kontrola negatywna (pkt 3a) — szczegóły

```
1) Backup 5 plików post-fix do scratchpad.
2) git show aa4948b1d1:<plik> > <plik>  (dla 5 serwisów canonical)
3) npx vitest run valuation-independent-verifier.pg.test.ts
   → 2 testy failed
   → "a byte-identical repeat POST..." : expected 500 to be 200
   → "a repeat POST while the FIRST attempt is still `running`..." : expected 500 to be 409
4) Przywrócenie plików z backupu; git status --porcelain PUSTY
5) Ponowny przebieg: 2 testy passed
```

To jest bezpośredni dowód, że test wykrywa regresję identyczną z oryginalnym
defektem P1 (nieobsłużony 500 zamiast idempotentnej odpowiedzi) — flip
asercji NIE jest osłabieniem testu.

## Kody wyjścia — podsumowanie

- `tsc --noEmit` z korzenia: **EXIT 0** (109s, log pusty)
- `tsc --noEmit -p server/tsconfig.json`: **EXIT 0** (84s, log pusty)
- Pełny zestaw `finance-v2` + `canonical` na realnym PG: **59/59 plików, 636/636 testów, 0 failed**
- Pakiet D z korzenia: **8/8 plików, 69/69 testów** (autor: 68 w chwili pisania raportu — rozbieżność ujawniona i zweryfikowana jako uzasadniona)
- Idempotency test przy HEAD: **2/2 passed**
- Idempotency test z cofniętą naprawą (kontrola negatywna): **0/2 passed (oba failed, zgodnie z oczekiwaniem)**

## Nowe defekty znalezione podczas weryfikacji

Brak. Nie znalazłem żadnego maskowania, osłabienia testu ani nieuzasadnionej
zmiany zakresu. Jedyna drobna nieścisłość (68 vs 69 testów w Pakiecie D) była
już samodzielnie ujawniona przez autora we własnym raporcie z poprawnym
wyjaśnieniem przyczyny — zweryfikowałem, że wyjaśnienie jest prawdziwe.

## Ocena końcowa

**PASS.**

Wszystkie dziewięć twierdzeń POTWIERDZONE niezależnym pomiarem, w tym
najcięższe (idempotency test) przeszło pełną kontrolę negatywną z
rzeczywistym cofnięciem kodu produkcyjnego i ponownym uruchomieniem na
realnym Postgresie — test naprawdę czerwienieje bez naprawy i naprawdę
zieleni się z naprawą. Grep po wzorcach maskowania (`any`/`@ts-ignore`/
`@ts-expect-error`/`as unknown`/`eslint-disable`/tsconfig) dał zero trafień
w kodzie. Obie zmiany merytoryczne (TS2783 martwa linia, TS7053 przyczyna
źródłowa w typie) zweryfikowane jako realne, nie kosmetyczne. Decyzja o
nierozszerzaniu `ValuationWorkspace.tsx`'s enum-label mechanizmu jest
merytorycznie uzasadniona, nie wygodna — nowa funkcja jest drugim (nie
czwartym) mechanizmem etykiet UI w tym pakiecie. Zaktualizowane asercje
testów zostały WZMOCNIONE, nie osłabione. Allowlista w pełni zachowana.

Ta paczka CLEAN-1 jest gotowa jako część czystego candidate SHA.

---
*Weryfikator: niezależna sesja (nie autor paczki). Baza weryfikacji: klaster
izolowany `clean1_verify`, usunięty po zakończeniu. Zero zmian w kodzie
produkcyjnym poza tymczasową, w pełni cofniętą podmianą do kontroli
negatywnej.*
