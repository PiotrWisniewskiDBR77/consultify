# Raport dyżuru 58 — przywrócenie wartości dowodowej CI

Stan raportu: roboczy, uzupełniany po każdej pozycji w kolejności wiążącej.

## 1. Marker i baza

`df -h /`: `/dev/disk3s1s1`, dostępne `11Gi` — próg 5 GB spełniony.

`git log --oneline -25 github-backup/codex/m03-admin-20260824` rozpoczął się od:

```text
b3179d0a52 docs(ledger): DEC-248 teza nadzorcy o katalogu czlonkow obalona pomiarem
c8d59a0397 docs(handoff): przekazanie roli nadzorcy — kodeks pracy dla agenta prowadzacego
2f99ef5ebe docs(ledger): DEC-247 Narzedzia 54 + FIX-y scalone, wykonawca obalil instrukcje nadzorcy
```

`git merge-base --is-ancestor b3179d0a52603f62b5cd3673caa754c8fc3b0055 github-backup/codex/m03-admin-20260824`:

```text
MARKER OK
```

Tip był równy markerowi; zakres `marker..tip` był pusty. Worktree: `/private/tmp/consultify-ci-day58`, gałąź `codex/ci-day58-20260828`.

## 2. Weryfikacja stanu wejściowego

- Port: `lsof -nP -iTCP:5858 -sTCP:LISTEN || echo "5858 WOLNY"` → `5858 WOLNY`.
- Macierz: `CI_MATRIX_REPO=/private/tmp/consultify-ci-day58 node /private/tmp/consultify-ci-day58-artefakty/ci-matrix.mjs ...` → `PODSUMOWANIE: 150 kombinacji; 32 = job zielony bez ani jednego kroku testowego.`
- Lint: `npm run lint` → `exit=1`, `48506 problems (48506 errors, 0 warnings)`, `48493 ... potentially fixable with --fix`.
- Type-check: `npm run type-check` → `exit=2`; własny grep policzył `24` diagnostyki TS w `16` plikach.
- Bramki DB: własne grepy → `38` zmiennych, `50` plików rodziny 1, `7` rodziny 2, unia `56`, w tym `51` plików testowych; `.github/` nie zawiera `DB_PREFIX`.
- Acceptance: `grep -rn "acceptance" .github/workflows/` → 0 trafień; `find tests/acceptance -mindepth 1 -maxdepth 1 -print | wc -l` → `152`.
- Retry: `playwright.config.ts:80` ma `retries: process.env.CI ? 2 : 0`; `vitest.config.ts:331` ma `retry: 0`.
- Cztery pakiety z §E, `--retry=0 --reporter=verbose`: `19 failed | 16 passed`; lista nazw jest zgodna z instrukcją.

## 3. Korekty wobec instrukcji

1. §B.0 potwierdzony: job `lint-typecheck` pada na pierwszym kroku, więc type-check nie jest osiągany w realnej sekwencji joba.
2. Inwentarz DB na markerze jest większy o jeden od pomiaru autora: `38/50/7/56/51`, nie `37/49/7/55/50`. Pełne listy są w artefaktach `db-prefix-vars.txt`, `db-f1.txt`, `db-f2.txt`, `db-union.txt`.
3. Jest `24` błędów TSC, lecz w `16`, nie `15` plikach; tabela autora również wymienia 16 ścieżek.

## 4. Tabela zbiorcza pozycji

| pozycja | werdykt | commit SHA | dowód |
| --- | --- | --- | --- |
| §B.0 | ZROBIONE_WG_DoD | `320f793182` | §B.0 |
| §B.1 | CZĘŚCIOWO | `f2574b8c1f` | §B.1; 3 błędy bez licencji pozostały |
| §A | ZROBIONE_WG_DoD | `ee49f5eb3b` | §A |
| §C | ZROBIONE_WG_DoD | `59c53e0d53` | §C |
| §D | CZĘŚCIOWO | `02146f1a2c` | §D |
| §E | CZĘŚCIOWO | `8cf04de2c7` | §E |
| §F | CZĘŚCIOWO | `46efce51e7` | §F |

## §B.0 — ESLint przed type-checkiem

Komenda główna:

```text
npm run lint > /private/tmp/consultify-ci-day58-artefakty/lint-PRZED.txt 2>&1
exit=1
✖ 48506 problems (48506 errors, 0 warnings)
48493 errors and 0 warnings potentially fixable with the --fix option.
```

Niezależny pomiar JSON:

```text
npx eslint . --quiet -f json -o /private/tmp/consultify-ci-day58-artefakty/eslint.json
exit=1
plikow z bledami: 1924 z 1924
prettier/prettier 47381
simple-import-sort/imports 1065
simple-import-sort/exports 27
prefer-const 18
react-hooks/rules-of-hooks 3
no-irregular-whitespace 2
no-extra-boolean-cast 2
no-useless-escape 2
@typescript-eslint/no-unused-expressions 2
@typescript-eslint/no-namespace 1
```

Rozstrzygnięcie: `lint-typecheck` kończy się na `npm run lint`; `npm run type-check` nie jest w tym jobie wykonywany. To nie jest artefakt jednego pliku ani odmiennej liczby nadzorcy. Nie wykonano `eslint --fix` ani `prettier --write`.

Warianty decyzji:

- W1 — osobny szeregowany dyżur pełnego formatowania, gdy nie żyją inne gałęzie. Cena: diff obejmujący ok. 1924 pliki i trudny merge; ryzyko: konflikt z aktywnym WIP. Zaleta: przywraca rygor bez osłabiania reguł.
- W2 — rozdzielić blokujący `typecheck` od tymczasowo nieblokującego lintu z zapadką liczbową względem zatwierdzonego baseline. Cena: dodatkowy job i utrzymanie baseline; ryzyko: dług formatowania pozostaje, ale nie może rosnąć. To wariant rekomendowany operacyjnie, jeśli W1 nie dostanie natychmiastowego okna wyłączności.
- W3 — zmienić `prettier/prettier` z `error` na `warn`. ODRZUCAM: to obniżenie progu, narusza Z9 i nie rozwiązuje błędów semantycznych.

`DECISION_REQUIRED`: czy właściciel wybiera jednorazowe pełne sformatowanie w szeregowanym oknie (W1), czy rozdzielenie joba z zapadką (W2)?

Niezweryfikowane dla §B.0: nie uruchamiałem realnego runnera GitHuba (Z8); nie mierzyłem jeszcze, czy wynik lintu różni się na `origin/Londyn`.

## §B.1 — inwentarz i klasyfikacja błędów TSC

Komenda PRZED: `npm run type-check > .../tsc-PRZED.txt 2>&1`; wynik `exit=2`. Komenda inwentarza: `grep -E "^[^ ].*\\([0-9]+,[0-9]+\\): error TS" .../tsc-PRZED.txt`. Mianownik: 24 diagnostyki w 16 plikach.

| plik | linie / kody | liczba | etykieta | wynik |
| --- | --- | ---: | --- | --- |
| `src/components/Audit/method/__tests__/AuditFindingsTab.test.tsx` | 96 TS2741 | 1 | NAPRAWIAM | dodano wymagane `reviewedAt: null` |
| `src/components/Audit/method/workspace/v2/__tests__/CriterionWorkspaceV2.test.tsx` | 287 TS2740 | 1 | NAPRAWIAM | fikstura odzwierciedla pełny `WorkspaceFinding` |
| `src/components/Execution/ExecutionHub.tsx` | 5932 TS2345 | 1 | NAPRAWIAM | lokalny alias `TFn` związano z `i18next.TFunction` |
| `src/components/Execution/reports-intelligence/__tests__/reportsFlagOff.test.tsx` | 54,57,60,63 TS2554 | 4 | NAPRAWIAM | mocki jawnie przyjmują props |
| `src/components/Initiatives/InitiativesHub.tsx` | 1243,2476,2540 TS2345 | 3 | NAPRAWIAM | chip ma wymagane pola; `TFn` = `TFunction` |
| `src/components/Initiatives/__tests__/initiativeRegisterProjection.scope.test.ts` | 18,21,27,29 TS2345/TS2339 | 4 | NAPRAWIAM | zachowano generyczny typ wiersza, matcher przyjmuje minimalny kształt |
| `src/components/Interview/InterviewHub.tsx` | 7523 TS2322 | 1 | NAPRAWIAM | jawny fallback statusu `UNKNOWN` |
| `src/components/MyWork/IdeaMapWorkspace.tsx` | 4512 TS2322 | 1 | NAPRAWIAM | `state` zawężony do deklarowanego `NodeStatus` |
| `src/components/MyWork/IdeaRecommendationMap.tsx` | 7365 TS2322 | 1 | NAPRAWIAM | brakujący seed mapowany na pusty tekst |
| `src/components/ResultsVNext/ResultsSearchRegistry.tsx` | 174 TS2322 | 1 | NAPRAWIAM | akcja dostosowana do `StandardPreviewActions` |
| `src/components/ResultsVNext/resultsSearchApi.ts` | 31 TS2558 | 1 | NAPRAWIAM | generyk usunięty z niegenerycznego `Api.get`; typ odpowiedzi przy granicy |
| `src/components/navigation/Sidebar/__tests__/menuConfig.interview.test.ts` | 26 TS2538 | 1 | NAPRAWIAM | indeksowanie dopiero po sprawdzeniu `viewId` |
| `src/routes/__tests__/interviewAliasRedirect.test.ts` | 21 TS2345 | 1 | NAPRAWIAM | callback tabelaryczny przyjmuje oba argumenty |
| `src/services/api.ts` | 12613 TS2345 | 1 | PRZEKROJOWY | REKOMENDUJĘ, aktywne zmiany z ostatnich 5 dni |
| `src/views/admin/AdminSettingsModule.tsx` | 500 TS2322 | 1 | REKOMENDUJĘ | teren dyżuru 53 |
| `src/views/superadmin/__tests__/PlatformOperationsView.test.tsx` | 33 TS2345 | 1 | REKOMENDUJĘ | aktywne zmiany superadmin z 25–26.08 |

Bilans: `NAPRAWIAM=21`, `REKOMENDUJĘ=2`, `PRZEKROJOWY=1`. PO: `npm run type-check > .../tsc-B1-PO.txt 2>&1` → `exit=2`; pozostały dokładnie trzy powyższe pliki i trzy diagnostyki. Żaden błąd z terenu 55/56/57 nie wystąpił.

Regresja skupiona: `npx vitest run <6 zmienionych plików testowych> --retry=0 --reporter=verbose` → `exit=0`, `6 passed`, `27 passed`. Strażnik `npx tsx scripts/testing/skip-scan-gate.ts` → `exit=1`: zastany mianownik `skip=338`, `only=0`, blokuje 26 `.skip()` wyłącznie w `tests/unit/backend/aiSettingsService.test.ts`; żaden zmieniony plik nie występuje w znaleziskach.

Gotowe rekomendacje nienałożone:

Dyżur przekrojowy / właściciel `src/services/api.ts` — przed wywołaniem V8 wymagane jest zawężenie opcjonalnego `start`:

```diff
@@
     try {
+      if (!body.start) throw new Error('CALENDAR_START_REQUIRED');
       return await V8MyWorkApi.createCalendarEvent(body);
```

Dyżur 53 — `AdminSettingsModule.tsx`: zawęzić `resolvedLocation.screen` do unii obsługiwanej przez `AdminCommandCenterPanel` przed przekazaniem prop; nie rozszerzać typu panelu o wszystkie ekrany admina. Dokładny docelowy diff wymaga wyboru zachowania dla nieobsługiwanych ekranów przez właściciela dyżuru 53.

Superadmin — uzupełnić nowo wymagane katalogi w fiksturze:

```diff
@@
       users: [{ id: 'user-1', name: 'ada@example.com', status: 'active' }],
+      connectors: [],
+      virtualWorkers: [],
```

Niezweryfikowane dla §B.1: nie rozstrzygałem zachowania ekranu admin dla nieobsługiwanych `screen`; trzy rekomendowane zmiany nie zostały nałożone ani uruchomione.

## §A — warunki jobów i PR gate

Własny mianownik PRZED: `ci-matrix.mjs` → `150` kombinacji, `32` zielone bez testów. Lista do zmiany wynikała z wierszy `push/Londyn`, `push/demo` i `pull_request/42/merge`, nie z listy autora. PO: `156` kombinacji (nowy job), globalnie `5` zielonych bez testów; dla trzech wymaganych kontekstów grep zwrócił zero wierszy `★ ZIELONY BEZ TESTOW`.

Zachowano warunki per krok, zamiast przepisywać dziesięć zróżnicowanych jobów na jeden kształt job-level: jest to mniejszy diff infrastrukturalny, zachowuje `workflow_dispatch`, warunki `always()` uploadów i istniejące job-level ograniczenia performance/patch. Warunek wykonania rozszerzono na PR, `Londyn` i `demo`. `demo` włączono, ponieważ jest aktywnym celem wdrożenia i zielony job bez treści na tej gałęzi ma zerową wartość dowodową.

Tabela pełna PRZED/PO dla wszystkich zmienionych kombinacji znajduje się w artefaktach `ci-matrix-PRZED.txt`, `ci-matrix-PO.txt`; zostanie wklejona do końcowej sekcji raportu §R. Najważniejszy mianownik:

| joby | zdarzenie | ref_name | PRZED | PO |
| --- | --- | --- | --- | --- |
| `levels-coverage-gates`, `unit-tests`, `component-tests`, `colocated-tests`, `integration-tests`, `e2e-tests`, `e2e-m06-gate`, `critical-path-coverage`, `patch-coverage` (zgodnie z eventowym job-if) | `pull_request` | `42/merge` | ★ ZIELONY BEZ TESTOW | TESTY LECA |
| joby z zastaną bramką per krok, zgodnie z macierzą | `push` | `Londyn` | ★ ZIELONY BEZ TESTOW | TESTY LECA |
| joby z zastaną bramką per krok, zgodnie z macierzą | `push` | `demo` | ★ ZIELONY BEZ TESTOW | TESTY LECA |
| `acceptance-tests` | PR / push | `42/merge`, `Londyn`, `demo` | BRAK JOBA | TESTY LECA |

`pr-gate` ma teraz `always()`, czyta `initiatives-tests` i `acceptance-tests`, a oba są wymagane przez `req_ok`. Lokalny mutant logiki bramki:

```text
PRE_INITIATIVES_FAILURE_EXIT=0
POST_INITIATIVES_FAILURE_EXIT=1
POST_ALL_SUCCESS_EXIT=0
```

YAML: parser pakietu `yaml` → `jobow: 26`, zero `BRAK runs-on`. Liczba jobów wzrosła o jeden; żaden job nie został usunięty. `grep -c 'req_ok'` → `17` (wlicza definicje i `req_ok_or_skipped`).

Pakiet acceptance zmierzony przed dodaniem joba na świeżym PG: `exit=1`, `114 failed | 19 passed | 6 skipped` plików; `380 failed | 589 passed | 143 skipped` przypadków. Job został dodany bez `continue-on-error`, więc obecnie świadomie blokowałby PR po usunięciu wcześniejszej blokady ESLint.

`DECISION_REQUIRED`: czy właściciel akceptuje natychmiastowe włączenie czerwonego `acceptance-tests` jako uczciwej bramki (blokada 380 przypadków), czy zatwierdza osobny plan naprawczy przed scaleniem §A? Wyciszenie lub `continue-on-error` nie jest wariantem.

Niezweryfikowane dla §A: realny runner GitHuba nie został uruchomiony (Z8); statyczny analizator nie modeluje `needs`, matrix ani dynamicznego outputu readiness.

## §C — testy bramkowane nazwą bazy

Mianownik z własnych komend: 38 unikalnych tokenów `*_DB_PREFIX`; rodzina 1 obejmuje 50 plików, rodzina 2 siedem, unia 56, z czego 51 ma nazwę `*.test.*`/`*.spec.*`. Pełna tabela `plik | zmienna | literał | teren` została wygenerowana z `db-union.txt`; dziewięć pozycji ma etykietę CUDZY: `financeSettingsCommandService.pg.test.ts`, trzy `tests/e2e/settings/*`, trzy `tests/integration/settings/*`, `meeting-basic.spec.ts`, `meeting-notebook-evidence.realdb.test.ts`. Pozostałe 47 są WOLNE. Żadnego z 56 plików nie zmieniono.

Werdykt architektoniczny: bramkowanie po indywidualnej nazwie bazy powinno zniknąć z testów. Docelowy wspólny warunek to `RUN_DB_TESTS=1 && MOCK_DB=false && DB_TYPE=postgres && DATABASE_URL` wskazujący PostgreSQL, a izolację zapewnia wspólny helper tworzący unikalną bazę. Utrzymanie obecnego modelu wymaga przekazywania 38 zmiennych i tworzenia wielu baz w CI; cena to duża konfiguracja i dalsze ryzyko cichych `SKIPPED`. Usunięcie wymaga osobnego szeregowanego dyżuru na 56 plików; ryzyko to kolizje z terenami 55/57, dlatego nie wykonano go tutaj.

Dowód wykonalności rodziny 2, oba z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test`, realnym PG na porcie 5858 i `--retry=0`:

```text
raid.routes.tenant-isolation.mounted.realdb.test.ts: exit=0; 1 file passed; 4 tests passed; zero SKIPPED
accessCodes.routes.cross-org-escalation.mounted.realdb.test.ts: exit=0; 1 file passed; 6 tests passed; zero SKIPPED
```

Acceptance na tej samej instancji: `exit=1`; pliki `114 failed | 19 passed | 6 skipped`, przypadki `380 failed | 589 passed | 143 skipped`. Pełna lista nazw jest w `C-acceptance.txt` (6506+ linii).

Niezweryfikowane dla §C: nie uruchomiono wszystkich 56 plików z odpowiadającymi im indywidualnymi bazami; nie udowodniono, że wspólny helper usunie wszystkie przyczyny `SKIPPED`.

## §D — pomiar Playwright retries

Porty 3374 i 3375 były wolne. Wykonano 15 wywołań CLI z `--retries=0` i wymaganymi URL/portami; pełne dane po nazwach są w `D-flake.txt`.

| specyfikacja | próby 1–5 | werdykt |
| --- | --- | --- |
| `presentations-role-wall.signed.spec.ts` | 5× `Process from config.webServer was not able to start. Exit code: 1` | BRAK_DANYCH o testach; harness deterministycznie niewykonalny |
| `partner-v8-zero-writer.signed.spec.ts` | próba 1: webServer fail; próby 2–5: ten sam test „uses governed company/campaign writers...” FAIL i ten sam „keeps signed SUPERADMIN...” PASS | testy stabilnie czerwony/zielony w czterech wykonalnych próbach; start harnessu niestabilny |
| `settings-mfa-lifecycle.signed.spec.ts` | 5× ten sam przypadek „enrols, recovers, regenerates, revokes and disables...” FAIL | stabilnie czerwony; teren 55, tylko rekomendacja |

Nie zmieniono `playwright.config.ts:80`: brak pięciu wykonalnych prób presentations oraz niestabilny start harnessu nie wspiera globalnego `retries:0`. Retry nie uratowałby deterministycznie czerwonych przypadków partner/settings, ale to nie wystarcza do decyzji globalnej. `e2e-nightly.yml` i `e2e-weekly.yml` nie zawierają własnego `--retries` ani `retries:`.

`DECISION_REQUIRED`: retries w Playwright — brak kompletnego lokalnego pomiaru niestabilności wszystkich trzech specyfikacji; czy czekamy na okno ze stabilnym harnessem (rekomendowane), czy właściciel świadomie zmienia globalnie w ciemno? Cena oczekiwania: retry może nadal maskować; cena zmiany w ciemno: fałszywie czerwone CI przez niestabilny start/kontekst.

Niezweryfikowane dla §D: wynik presentations po starcie przeglądarki; przyczyna porażki procesu webServer (odfiltrowany log CLI podał tylko exit 1); zachowanie realnego runnera GitHuba.

## §E — klasyfikacja 19 czerwonych przypadków

Pomiar zbiorczy: cztery pliki, `--retry=0 --reporter=verbose` → `19 failed | 16 passed`. Następnie każdy czerwony przypadek uruchomiono osobno przez `-t <pełna nazwa>`. To rozdzieliło realne luki od zanieczyszczenia kolejkami mocków. `vi.clearAllMocks()` czyści historię, ale nie resetuje niewykorzystanych `mockResolvedValueOnce`; dowód: test clone-on-write czerwony w pakiecie, a osobno `exit=0`.

| przypadek | etykieta | dowód izolowany / kod |
| --- | --- | --- |
| accessRoleBuilder — clone-on-writes factory template | BUG TESTU | osobno exit 0; poprzedni test kolejkuje `queryOne`, lecz wraca przed query na guardrail |
| AdminSessions — stale read-back po revoke single | BUG PRODUKTU | osobno exit 1; asercja wymaga widocznej sesji i potwierdzenia; `AdminSessionsView.tsx:260-272` |
| AdminSessions — usuwa dopiero po potwierdzeniu | BUG PRODUKTU | osobno exit 1; ten sam seam `loadData`/normalizacji |
| AdminSessions — bulk revoke bez fałszywego sukcesu | BUG TESTU | osobno exit 0; porażka tylko w sekwencji pliku |
| AdminSessions — wrapped session/stats | BUG PRODUKTU | osobno exit 1; normalizator nie odsłania sesji z testowego envelope |
| DLP — wrapped policy/violation | BUG PRODUKTU | osobno exit 1; brak akcji Resolve po normalizacji envelope |
| DLP — stale toggle/delete | BUG PRODUKTU | osobno exit 1; `DLPView.tsx:332-368` nie osiąga oczekiwanego widoku/read-back seam |
| DLP — delete read-back unavailable | BUG PRODUKTU | osobno exit 1; asercja poprawnie zabrania toastu sukcesu |
| DLP — violation pozostaje + safe dates | BUG PRODUKTU | osobno exit 1; `DLPView.tsx:371-383` |
| DLP — resolve read-back unavailable | BUG PRODUKTU | osobno exit 1; jw. |
| DLP — deeply wrapped create | BUG TESTU | osobno exit 0; porażka zależy od kolejności mocków |
| DLP — malformed payload nie jako empty | BUG TESTU | osobno exit 0; porażka zależy od kolejności mocków |
| SecurityIncidents — wrapped payload/actions | BUG PRODUKTU | osobno exit 1; normalizator nie odsłania wiersza/akcji |
| SecurityIncidents — staging row details | BUG PRODUKTU | osobno exit 1; `normalizeIncident`/render details seam |
| SecurityIncidents — stale resolve/delete | BUG PRODUKTU | osobno exit 1; `SecurityIncidentsView.tsx:356-399` |
| SecurityIncidents — delete read-back unavailable | BUG PRODUKTU | osobno exit 1; asercja poprawnie zabrania toastu sukcesu |
| SecurityIncidents — absent after resolve | BUG PRODUKTU | osobno exit 1; brak potwierdzonego przejścia UI |
| SecurityIncidents — deeply wrapped create | BUG TESTU | osobno exit 0; porażka zależy od kolejności mocków |
| SecurityIncidents — malformed payload nie jako empty | BUG TESTU | osobno exit 0; porażka zależy od kolejności mocków |

Bilans: `BUG PRODUKTU=13`, `BUG TESTU=6`, `ARTEFAKT ŚRODOWISKA=0`. Dla 13 błędów produktu nie nałożono zmian: `git log --all --since='5 days ago'` wykazał świeże commity w `src/views/superadmin/**`, więc zgodnie z licencją dostarczam rekomendację zamiast mutacji. Rekomendacja: wydzielić jeden rekursywny `unwrapEnvelope`, użyć go przed `hasListShape` we wszystkich trzech widokach, zachować obecne read-back guards, a akcje/toasty emitować wyłącznie po potwierdzonym snapshot. Dla sześciu błędów testu: w `beforeEach` użyć `mockReset()` dla każdego mocka z kolejkami `*Once` przed ustawieniem defaultów; nie zmieniać żadnej asercji.

Dowód mutacyjny napraw produktu: NIE WYKONANO — brak licencji na świeżo zajęte pliki superadmin. Dlatego §E jest `CZĘŚCIOWO`, nie `ZROBIONE_WG_DoD`.

Niezweryfikowane dla §E: dokładny wspólny diff produktu i jego czerwony→zielony→czerwony dowód; właściciel aktywnego toru superadmin musi wykonać go w swoim worktree.

## §F — dowód końcowy bramki

### Warstwa 1 — mutant testu

Kontrola pliku bazowego: `npx vitest run tests/unit/initiatives/computeCriticalPath.test.ts --retry=0` → `BASELINE_EXIT=0`, `4 passed`. Po skopiowaniu do `day58-mutant.test.ts` i dodaniu `expect(1).toBe(2)`, dokładna komenda workflow `npm run test:initiatives` → `MUTANT_EXIT=1`; log zawiera imiennie `DAY58 MUTANT ... expected 1 to be 2`. Po usunięciu mutanta ta sama komenda → `CLEAN_EXIT=1`, ponieważ pakiet ma zastane `4 failed | 693 passed`. Mutant zwiększył liczbę nieudanych przypadków z 4 do 5, ale nie można wykazać wymaganej zieleni komendy workflow. `MUTANT_REMOVED`; `STATUS_NO_MUTANT`.

### Warstwa 2 — logika pr-gate

```text
PRE_INITIATIVES_FAILURE_EXIT=0
POST_INITIATIVES_FAILURE_EXIT=1
POST_ALL_SUCCESS_EXIT=0
```

To jest dowód mutacyjny luki `initiatives-tests` i jej zamknięcia. Dodatkowo `acceptance-tests` jest wymagany przez ten sam `req_ok`.

### Warstwa 3 — statyczny start jobów

Macierz PRZED: `150 / 32` zielone bez testów. Macierz PO: `156 / 5` globalnie i zero dla `pull_request`, `push/Londyn`, `push/demo`. W tych kontekstach wiersze zmienionych jobów przechodzą z `★ ZIELONY BEZ TESTOW` na `TESTY LECA`; nowy acceptance przechodzi z `BRAK JOBA` na `TESTY LECA`.

„Dowód końcowy jest trójwarstwowy i **nie obejmuje realnego uruchomienia GitHub Actions** (`Z8`). Warstwa 3 dowodzi, że job wystartuje; warstwy 1 i 2 dowodzą, że gdy wystartuje, czerwony test daje czerwoną bramkę. Ogniwo, którego NIE zweryfikowałem, to zachowanie realnego runnera GitHuba."

Korekta do obowiązkowego zdania: warstwa 1 dowodzi detekcji mutanta, lecz nie dowodzi przejścia czerwony→zielony całej komendy, ponieważ bazowy pakiet initiatives jest czerwony. Dlatego §F ma werdykt `CZĘŚCIOWO`.

Niezweryfikowane dla §F: realny runner GitHuba; zielony baseline całej komendy `npm run test:initiatives`; zielony baseline acceptance.

## 7. Rozłączność — wynik kontroli

`git diff --name-only b3179d0a52603f62b5cd3673caa754c8fc3b0055..HEAD` zwrócił 15 plików. Workflow i raport mają licencję jawną. Pozostałe 13 to wyłącznie pliki z inwentarza błędów TSC oznaczone `NAPRAWIAM`: Audit (2), Execution (2), Initiatives (2), Interview (1), MyWork (2), ResultsVNext (2), Sidebar test (1), route test (1). Zero plików settings, middleware/Gateway/auth, Meeting/Calendar, admin, superadmin i `vitest*.config`. Kontrola `staged.txt` przed każdym commitem zwracała `rozlacznosc OK`.

## 8. Wszystkie pozycje REKOMENDUJĘ

- Dyżur 53: `AdminSettingsModule.tsx:500` — zawęzić screen do unii `AdminCommandCenterPanel`; decyzja fallbacku wymagana.
- Dyżur 55: naprawić deterministycznie czerwony `settings-mfa-lifecycle`; nie zmieniać retry globalnie jako substytutu.
- Dyżur 56: brak błędów TSC w jego terenie; brak diffu.
- Dyżur 57: usunięcie bramki nazwą bazy dla dwóch plików Meeting wykonać w osobnym szeregowanym dyżurze.
- Superadmin: wspólny unwrap envelope + reset kolejek mocków zgodnie z §E; bez osłabiania asercji.
- Przekrojowy `src/services/api.ts`: wymagane zawężenie `body.start` przed klientem V8; gotowy diff w §B.1.

## 10. STOP-y

Brak STOP-u całego dyżuru. Ograniczenia merytoryczne zapisano jako `CZĘŚCIOWO`: §B.1 (3 pliki bez licencji), §D (niewykonalny pełny harness), §E (zajęty teren superadmin), §F (czerwony baseline dokładnej komendy workflow). Każde ma rekomendację zamiast nieautoryzowanej zmiany.

## 13. Lista kontrolna nadzorcy

- [x] marker i baza zweryfikowane; tip równy markerowi
- [x] własne mianowniki ESLint, TSC, DB gates, acceptance, §E i CI matrix
- [x] zero push na origin; każdy commit wypchnięty na `github-backup/codex/ci-day58-20260828`
- [x] zero Railway/demo/staging/production i realnych Actions
- [x] zero `--fix`, `prettier --write`, wyciszeń, `continue-on-error`, usuniętych jobów
- [x] YAML parsuje się; 26 jobów, każdy ma `runs-on`
- [x] mutant usunięty; brak `day58-mutant` w statusie
- [x] porty i kontener zgodne z dyżurem 58
- [x] kontener `cx-day58-pg` usunięty przez `docker rm -fv`; `MUTANT_ABSENT`
- [x] rozłączność sprawdzona przed każdym commitem
- [ ] pełne DoD §D/§E/§F — jawnie CZĘŚCIOWO z dowodem

## 14. Brief wynikowy dla nadzorcy

Pierwsza teza została rozstrzygnięta: ESLint ma 48 506 błędów i zatrzymuje workflow przed type-checkiem. Naprawiłem 21 z 24 błędów TSC w wolnych plikach; trzy pozostają w terenach przekrojowym/admin/superadmin. Warunki testowych jobów obejmują teraz PR, Londyn i demo. `pr-gate` ma `always()` i sprawdza initiatives oraz nowy acceptance. Statyczna liczba zielonych pustych kombinacji spadła z 32 do 5 globalnie i do zera w trzech wymaganych kontekstach. Acceptance jest uczciwie czerwony: 380 FAIL i nie został wyciszony. Dwa testy z twardą nazwą bazy realnie przeszły na PostgreSQL bez SKIPPED. Playwright nie dostał globalnego `retries:0`, bo pełny harness nie był stabilnie wykonalny. W §E rozdzieliłem 13 błędów produktu od sześciu błędów izolacji testów. Nie dotknąłem zajętych plików superadmin. Mutant initiatives został wykryty, ale cały pakiet initiatives jest zastanie czerwony także po jego usunięciu. Największe ryzyko scalania to świadome włączenie dwóch czerwonych bramek: acceptance i istniejącego initiatives. Właściciel musi wybrać W1/W2 dla ESLint oraz kolejność naprawy czerwonych pakietów. Realnego zachowania runnera GitHuba nie zweryfikowano z powodu Z8. Gałąź wynikowa to `github-backup/codex/ci-day58-20260828`.

## 9. DECISION_REQUIRED

- ESLint: W1 albo W2, zgodnie z §B.0.
- Acceptance: scalić od razu jako czerwoną bramkę czy najpierw wykonać osobny program naprawczy 380 przypadków.
- Playwright retries: czekać na stabilny harness czy zmienić globalnie bez pełnego pomiaru.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

- Czy historyczne realne przebiegi GitHub Actions na tej gałęzi były zielone.
- Zachowanie realnego runnera GitHuba przy `needs` i `if` bez `always()`.
- Czy błędy TSC są zastane na `origin/Londyn`, czy wniesione przez bazę dyżuru.
- Ostateczny warunek `readiness-smoke`.
- Zachowanie realnego runnera GitHuba po przyszłych zmianach — uruchomienie jest zabronione przez Z8.

## 12. Deklaracja

**NIE przepisałem liczb nadzorcy ani autora instrukcji — zmierzyłem sam.**
