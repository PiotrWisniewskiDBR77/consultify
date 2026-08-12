# ID_BRIDGE (Gate E) — most identyfikatorów legacy → kanoniczny

**Worktree**: `/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco`
**Gałąź**: `codex/fv3p-id-bridge`
**Bazowy SHA**: `66d6ef42bf` (kandydat po Gate J PASS, merge `codex/fv3p-ap-mount`)
**Końcowy SHA**: `83e0d03ee7`

```
git diff --stat 66d6ef42bf HEAD
 45 files changed, 1834 insertions(+), 109 deletions(-)
```

Commity (4, każdy zielony niezależnie, każdy z przynajmniej jedną kontrolą negatywną):

| SHA | Zakres |
|---|---|
| `165df13fe6` | Serwer: `legacyIdBridgeService.ts`, `GET /artifacts/resolve-legacy/:legacyTable/:legacyId`, 5 testów pg |
| `2e61d2eeff` | Klient: `FinanceLegacyBridgeGate`/`useFinanceLegacyBridge`, wpięcie w `FinanceHub.tsx`, naprawa Prediction, naprawa surowych stringów Baseline+Valuation |
| `384ba23dd3` | Testy jednostkowe `FinanceLegacyBridgeGate` (5), pełny sweep `src/components/Finance` + `Economics` (476/476) |
| `83e0d03ee7` | dev-render + 17 zrzutów Playwright |

---

## 1. Ustalenia z badania (NAJPIERW zbadano, nie założono)

### 1.1 Jakich identyfikatorów używa stara lista

`FinanceHub.tsx` (lista) czyta cztery legacy tabele przez `/api/v8/finance/*`
(`server/src/routes/v8/finance.routes.ts`, zmierzone czytaniem SQL, nie
zgadywane):

| Zakładka FinanceHub | Legacy tabela | Kolumna id |
|---|---|---|
| Models / Prediction (podtyp `model`) | `financial_models` | `id` |
| Analysis / Investment | `financial_analyses` | `id` |
| Statements | `financial_statement_packs` | `id` |
| Enterprise valuation | `valuations` | `id` |

`activeDocument.id` w `FinanceHub.tsx` to zawsze surowy string z jednej z
tych tabel.

### 1.2 Jakich identyfikatorów oczekują nowe workspace'y

Cztery workspace'y v3 (`BaselineWorkspace`, `PredictionWorkspace`,
`AnalysisWorkspace`, `ValuationWorkspace`) operują na
`finance_artifacts.artifact_id` / `finance_business_versions.business_version_id`
— schemat z `server/migrations/20260809_finance_v3_b01_core_artifacts.sql`.
To CAŁKOWICIE inna przestrzeń id (UUID-owe stringi z osobnej tabeli), zero
wspólnych wartości z `financial_models.id` itd.

### 1.3 Czy powiązanie już istniało

**TAK — istniało, ale nikt go nie czytał.** `finance_artifacts_aliases`
(ta sama migracja `20260809_finance_v3_b01_core_artifacts.sql`, §5, "legacy ->
canonical bridge") ma dokładnie ten kształt: `legacy_table`, `legacy_id`,
`legacy_version`, `artifact_id`, `organization_id`, `business_version_id`,
`mapping_confidence` (`AUTO_MIGRATE`/`MIGRATE_WITH_WARNING`/`QUARANTINE`/
`EXCLUDE_WITH_REASON`), `mapping_reason`.

Dowód, że tabela istniała, ale była martwa (grep w całym repo przed
rozpoczęciem pracy):

- Jedyny inny plik produkcyjny odwołujący się do niej to
  `server/src/routes/v8/finance-v2/models.routes.ts`, w KOMENTARZU: *"there
  is no legacy-id bridge in this work package (`finance_artifact_aliases`,
  WP-C03, not yet populated)"*.
- Realny writer istnieje: `server/scripts/finance-v3-backfill-dry-run.ts`
  (WP-C03, walidowany na efemerycznym klastrze, NIGDY nie uruchamiany na
  współdzielonej bazie z premedytacji — patrz nagłówek tego skryptu) pisze
  do `finance_artifact_aliases` dla dokładnie tych czterech `legacy_table`
  wartości: `financial_statement_packs`, `financial_analyses`,
  `financial_models`, `valuations` — 1:1 zgodne z §1.1.
  `finance-v3-backfill-determinism-check.ts` niezależnie potwierdza
  deterministyczność tego algorytmu.
- ZERO kodu serwerowego czytało tę tabelę przed tą sesją (grep
  `finance_artifact_aliases` poza migracją/skryptami/dokami/tym komentarzem
  = pusty wynik).
- Na świeżo zmigrowanej bazie (`idbridge`, ten worktree) tabela istnieje,
  jest pusta (`SELECT count(*) FROM finance_artifact_aliases` = 0) — bo
  backfill nikt jeszcze nie uruchomił na tej instancji. To jest oczekiwane
  i osobne od "czy most istnieje" — most (mechanizm CZYTANIA) teraz istnieje
  i jest przetestowany z realnie wstawionymi wierszami aliasów (testy §4.1).

**Wniosek zgodny z hipotezą z brief'u**: to jest dokładnie przypadek
"powiązanie ISTNIEJE, ale nikt go nie czyta" — tańsza droga niż nowa
migracja, i taką drogę wybrano. Żadna nowa migracja SQL nie była potrzebna
ani napisana.

### 1.4 Czy dane na demo/prod są rzeczywiście przeniesione

**Nie wiadomo i to NIE jest w zakresie tego zadania.** Uruchomienie
pełnego backfillu WP-C03 na realnej (demo/prod) bazie to osobna, większa
decyzja programowa (migracja historyczna, klasyfikacja
AUTO_MIGRATE/QUARANTINE per wiersz, operator musi to nadzorować) — świadomie
POZA zakresem tego zadania (i poza regułą "WYŁĄCZNIE 127.0.0.1"). Ten
pakiet buduje MECHANIZM odczytu i uczciwe stany UI dla WSZYSTKICH trzech
możliwych wyników zapytania o most, łącznie z "nic tam jeszcze nie ma"
(`NOT_MIGRATED`) — który dziś, przed uruchomieniem backfillu na
demo/prod, byłby prawdziwym wynikiem dla KAŻDEGO wiersza. To jest jawnie
opisane jako pozostałość, nie ukryte.

---

## 2. Most identyfikatorów — opis mechanizmu

### 2.1 Serwer

- `server/src/services/finance/canonical/legacyIdBridgeService.ts` —
  `resolveLegacyFinanceArtifact(organizationId, legacyTable, legacyId)`.
  Czyta `finance_artifact_aliases` (org-scoped), potem `finance_artifacts`
  dla realnego `artifact_type`. Zwraca DOKŁADNIE jeden z trzech stanów:
  `RESOLVED` / `QUARANTINED` (z powodem, gdy backfill go zapisał) /
  `NOT_MIGRATED`.
- `GET /api/v8/finance-v2/artifacts/resolve-legacy/:legacyTable/:legacyId`
  (`artifacts.routes.ts`) — zawsze HTTP 200 dla wszystkich trzech domenowych
  wyników (to nie jest błąd transportowy), `400 INVALID_LEGACY_TABLE` dla
  nieznanej tabeli. Nie koliduje z istniejącym `GET /artifacts/:artifactId`
  (inna liczba segmentów ścieżki).

### 2.2 Klient

- `src/services/api/financeV2.api.ts` — `resolveLegacyFinanceArtifact()`
  (typowany klient, `v8Get`).
- `src/components/Finance/shared/useFinanceLegacyBridge.ts` — hook, cztery
  stany (`loading`/`resolved`/`unresolved`/`error`), `retry()`.
- `src/components/Finance/shared/FinanceLegacyBridgeGate.tsx` — komponent
  renderujący jeden z czterech stanów; `children(resolved)` render-prop
  dostaje REALNE `{artifactId, businessVersionId, artifactType}`.

### 2.3 Wpięcie w `FinanceHub.tsx`

Cztery gałęzie montowania v3 (`openV3Baseline`/`openV3Prediction`/
`openV3Analysis`/`openV3Valuation`) — każda owinięta teraz w
`<FinanceLegacyBridgeGate legacyTable="..." legacyId={activeDocument.id}>`.
Realne canoniczne id z `resolved.artifactId`/`resolved.businessVersionId`
idą do workspace'u — NIE `activeDocument.id` (legacy), jak było przed tą
zmianą (patrz komentarz "AP_MOUNT §B" usunięty z kodu, bo przestał być
prawdą).

`resolveFinanceDetailBranches()` (czysta funkcja wyboru gałęzi) NIE była
zmieniana — bramka most/gate żyje wyłącznie WEWNĄTRZ już-wybranej gałęzi, po
tym jak flaga (per typ) i tak zdecydowała, czy w ogóle wchodzimy w v3.

---

## 3. Uczciwe stany puste i błędu (Zadanie 2)

### 3.1 Prediction — anty-cicha-pustka (NAJWIĘKSZY PRIORYTET)

**Przed**: `PredictionWorkspace` przyjmował `artifactId`, tworzył pusty
`ScenarioDraft` i renderował go NATYCHMIAST, bez żadnego zapytania
sieciowego, bez żadnego sygnału że coś jest nie tak. Wiarygodnie wyglądający
formularz założeń, zero danych za nim.

**Po**: nowy prop `businessVersionId` (ustawiany przez bramkę
`FinanceLegacyBridgeGate` w `FinanceHub.tsx`). Na mouncie komponent
weryfikuje go realnym `GET .../versions/:id` (`getFinanceBusinessVersion`)
ZANIM cokolwiek wyrenderuje:

| Stan | Trigger | Co widzi użytkownik |
|---|---|---|
| `no-id` | `businessVersionId` = `null` (most nie rozwiązał) | Jawny komunikat "brak połączenia z realnym rekordem", ZERO wywołań sieciowych |
| `checking` | żądanie w locie | Spinner (`LoadingState`), formularz nie renderuje się |
| `not-found` | 404 z serwera | "Nie znaleziono tej wersji scenariusza w nowym systemie" |
| `error` | sieć/500 | "Nie udało się sprawdzić tego scenariusza" + Spróbuj ponownie (realnie ponawia) |
| `confirmed` | 200 | Formularz montuje się, ALE stały baner: "Ten ekran pokazuje nowy szkic założeń — odczyt zapisanej treści scenariusza nie jest dziś dostępny (brak endpointu GET)" |

Ostatni wiersz jest świadomie NIE w pełni naprawiony — nie istnieje dziś
żaden endpoint GET zwracający zapisaną treść scenariusza (CRUD zapisu
scenariusza to osobna, większa luka, udokumentowana w nagłówku pliku od
Pakietu G, poza zakresem tego zadania). Naprawą TEGO zadania jest, że ekran
to teraz PRZYZNAJE zamiast to ukrywać — różnica między "nie mamy dziś
mechanizmu odczytu" (uczciwie powiedziane) a "milczący pusty formularz"
(dawny stan).

### 3.2 Ujednolicenie komunikatów Baseline + Valuation

Zmierzone (nie zgadywane) miejsca z surowym `err.message`/`String(e)`
zamiast `describeFinanceV2Error(err).detail`:

- `useBaselineAssumptionsEditor.ts` — `reload()`, `save()`.
- `useBaselineOutputs.ts` — `reload()`.
- `ValuationWorkspace.tsx` — `variantError` (ładowanie na mouncie — DOKŁADNIE
  ta ścieżka, którą trafia legacy id rozwiązany przez most).
- `AdvisorStep.tsx`, `AssumptionsStep.tsx`, `MethodsWeightsStep.tsx`,
  `SensitivityStep.tsx` — błędy zapisu/odczytu per krok.

Wszystkie zamienione na `describeFinanceV2Error(err).detail` — ta sama
funkcja, ten sam Polski słownik, który Analysis już poprawnie używał (stąd
"Analysis pokazuje czysty komunikat" w ustaleniu wejściowym — reszta modułów
teraz z nim spójna).

`useBaselineCompute.ts` sprawdzony — już poprawnie używał
`describeFinanceV2Error`, bez zmian.

### 3.3 Trzy sytuacje z Zadania 2.3 — gdzie żyją

| Sytuacja | Poziom mostu (`FinanceLegacyBridgeGate`) | Poziom workspace'u (już istniejący, ważny za flagą) |
|---|---|---|
| artefakt nie istnieje | `unresolved` (`NOT_MIGRATED`/`QUARANTINED`) | `describeFinanceV2Error` `NOT_FOUND`/`BUSINESS_VERSION_NOT_FOUND` |
| artefakt istnieje, brak danych | most przechodzi do `resolved` → workspace montuje się; PRESENT_ZERO/pusta-ale-poprawna treść to odpowiedzialność KAŻDEGO workspace'u własnymi kanonicznymi stanami `FinanceValueStatus` (niezmienione tym pakietem, już istniały) | jw. |
| błąd pobierania | `error` (sieć/500 przy `resolve-legacy`) | `error` przy `getFinanceBusinessVersion`/`getValuationVariant` itd. |

### 3.4 Kanon pięciu wartości

`FinanceValueStatus` (`PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/
`NOT_APPLICABLE`) — niezmieniony tym pakietem, już istniał i już był
poprawnie egzekwowany (`rawEnumLeakScanner.test.ts` zielony przed i po).
Ten pakiet dokłada ANALOGICZNĄ, ale odrębną trójstanową dyscyplinę na
poziomie mostu (`RESOLVED`/`QUARANTINED`/`NOT_MIGRATED`) — to inny wymiar
(istnienie rekordu w nowym systemie), nie substytut kanonu wartości.

---

## 4. Dowody

### 4.1 Testy end-to-end (lista → artefakt → dane)

Skala `FinanceHub.tsx` (3400+ linii, provider-heavy) sprawia, że pełny mount
przez React Testing Library nie jest praktyką stosowaną w tym repo dla tego
pliku (grep potwierdza: zero istniejących testów mountujących `FinanceHub`
w całości — istniejące testy testują wyekstrahowaną logikę, np.
`resolveFinanceDetailBranches.test.ts`, `useFinanceData.test.tsx`). Ten
pakiet trzyma się tej samej konwencji: dowód end-to-end żyje na granicy
`FinanceLegacyBridgeGate` (mały, izolowany, prawdziwy komponent), + osobno
na granicy każdego workspace'u (już istniejące testy tych czterech
komponentów, teraz zaktualizowane).

| Kind | Legacy tabela | Dowód resolved→real-ids | Status |
|---|---|---|---|
| Baseline (models) | `financial_models` | `FinanceLegacyBridgeGate.test.tsx` "renders children with the REAL canonical..." + `finance-id-bridge.tsx&kind=baseline&state=resolved` (zrzut) | PASS |
| Prediction | `financial_models` | jw. + `finance-prediction-workspace.tsx&bridge=ok` (realny mount `PredictionWorkspace` z potwierdzonym `businessVersionId`) | PASS |
| Analysis | `financial_analyses` | `finance-id-bridge.tsx&kind=analysis&state=resolved` (zrzut) — logika resolve identyczna dla każdego `legacyTable`, pokryta serwerowym testem #1 (§4.2) z `financial_models`/`valuations` jako reprezentanty | PASS (logika), zrzut jako dodatkowy dowód wizualny |
| Valuation | `valuations` | jw. + `finance-id-bridge.tsx&kind=valuation&state=resolved` (zrzut) + serwerowy test #1 wprost na `financial_models`, #3 wprost na `valuations` | PASS |

Serwerowy test #4 (cross-tenant) dodatkowo dowodzi, że most nigdy nie
przecieka między organizacjami.

### 4.2 Testy na trzy stany (osobno, z asercją treści)

Serwer (`server/src/routes/v8/finance-v2/__tests__/legacy-id-bridge.routes.pg.test.ts`,
real Postgres, 5/5 PASS):
1. `RESOLVED` — AUTO_MIGRATE + realny artefakt → dokładne pola.
2. `NOT_MIGRATED` — brak aliasu.
3. `QUARANTINED` — z zapisanym `mapping_reason`, treściowo różne od #2.
4. Cross-tenant — alias innej organizacji niewidoczny (`NOT_MIGRATED`, nie
   przeciek).
5. `400 INVALID_LEGACY_TABLE` dla nieznanej tabeli.

Klient (`FinanceLegacyBridgeGate.test.tsx`, 5/5 PASS): `resolved` (realne
id, nie legacy), `loading` (dzieci nigdy nie renderują się przed
rozstrzygnięciem), `NOT_MIGRATED` (uczciwy komunikat, dzieci nigdy
wywołane), `QUARANTINED` (inny komunikat + powód, dzieci nigdy wywołane),
`error` (odróżnialny od unresolved, Retry realnie ponawia).

Klient — Prediction (`PredictionWorkspace.test.tsx`, sekcja
"ANTY-CICHA-PUSTKA", 6 testów w tej sekcji + 5 w sekcji smoke = 11):
`no-id`, `checking`, `not-found`, `error`+Retry, "confirmed pokazuje baner
uczciwości".

### 4.3 ★ Test anty-cichej-pustki dla Prediction — najważniejszy test pakietu

`PredictionWorkspace.test.tsx`, test *"★ podsunięty identyfikator, którego
nie da się rozwiązać (businessVersionId=null...) -> JAWNY komunikat, ZERO
wywołań sieciowych, formularz NIGDY nie renderuje się"*:
- asercja obecności jawnego komunikatu PL,
- asercja `queryByTestId('prediction-assumptions-view')` = `null` (formularz
  nigdy się nie montuje — dokładnie ten "wiarygodnie wyglądający pusty
  ekran", który właściciel opisał jako najgroźniejszy),
- asercja `getFinanceBusinessVersion` NIGDY nie wywołane (nie tylko UI jest
  uczciwe, ale system nawet nie próbuje niepotrzebnego zapytania).

Kontrola negatywna: te SAME assercje uruchomione przeciw
`PredictionWorkspace.tsx` sprzed poprawki (`git show 66d6ef42bf:...`) — 8 z
11 testów w pliku poszło na czerwono (w tym dokładnie ten test), włącznie z
testami smoke, które musiały zostać przeprojektowane pod nowy (poprawny)
kontrakt. Przywrócono, `git diff` czysty, ponownie 90/90 zielone.

### 4.4 Kontrole negatywne (wszystkie, z metodą przywracania)

| # | Plik | Mutant | Wynik | Przywrócenie |
|---|---|---|---|---|
| 1 | `legacyIdBridgeService.ts` (nowy plik) | wymuszony zawsze `NOT_MIGRATED` | 2/5 testów serwera czerwone | `cp` z lokalnej kopii zapasowej (plik nie istniał w `66d6ef42bf`, więc `git show` niedostępne — kopia zapasowa = ten sam efekt: brak historii do skażenia) |
| 2 | `PredictionWorkspace.tsx` (istniejący plik) | pełny powrót do stanu sprzed poprawki | 8/11 testów czerwone | `git show 66d6ef42bf:<plik> > <plik>` |
| 3 | `useBaselineAssumptionsEditor.ts`, `useBaselineOutputs.ts`, `ValuationWorkspace.tsx` (istniejące) | pełny powrót do stanu sprzed poprawki (jednocześnie) | 5 nowych asercji (3+2) czerwone | `git show 66d6ef42bf:<plik> > <plik>` × 3 |
| 4 | `useFinanceLegacyBridge.ts` (nowy plik) | `QUARANTINED` zlane w `NOT_MIGRATED` | 1/5 testów gate'u czerwony | kopia zapasowa (nowy plik) |

Po każdym mutancie: przywrócenie + `git diff` pusty potwierdzony (dla plików
z historią) lub bitowa identyczność z kopią zapasową sprzed mutacji (dla
nowych plików) + ponowne zielone uruchomienie testów.

### 4.5 Potwierdzenie: ścieżka OFF bajtowo identyczna

`resolveFinanceDetailBranches.test.ts` (15 testów, w tym exhaustive
flags-all-false + negative control) — **NIEZMIENIONY plik, NIEZMIENIONA
funkcja**, 15/15 PASS zarówno przed jak i po tej sesji. Bramka mostu żyje
wyłącznie WEWNĄTRZ czterech gałęzi `openV3*`, które i tak wymagają
odpowiedniej flagi (`financeBaselineWorkspaceV1` itd., wszystkie default
OFF) — przy fladze OFF te gałęzie nigdy się nie wykonują, więc most nigdy
nie jest odpytywany. Brak nowej osobnej flagi dla samego mostu — istniejące
cztery flagi per-typ SĄ tą bramką (nic nowego do dodania/testowania w tym
wymiarze).

### 4.6 Pełny sweep frontendu

```
npx vitest run src/components/Finance src/components/Economics --maxWorkers=2
Test Files  52 passed (52)
     Tests  476 passed (476)
```
Uruchomione DWUKROTNIE w trakcie sesji (po commicie #2 i po commicie #3) —
oba razy 476/476, zero regresji od wpięcia mostu / naprawy Prediction /
naprawy surowych stringów.

`rawEnumLeakScanner.test.ts` (4/4 PASS) — nowe polskie komunikaty tego
pakietu nie wprowadzają żadnego surowego SCREAMING_SNAKE_CASE do DOM.

### 4.7 Zrzuty

`docs/validation/finance-v3/generated/gate-e/visual/id-bridge/` (17 plików,
876 KB, wszystkie przez `scripts/dev/idbridge-screenshots.mjs`, Playwright,
świeży `browser.newContext()` per zrzut — localStorage nigdy nie przecieka
między zrzutami):

**Prediction — anty-cicha-pustka (priorytet #1), light+dark**:
`prediction-bridge-ok-{light,dark}.png` (realny mount + baner uczciwości),
`prediction-bridge-missing-{light,dark}.png` (brak id),
`prediction-bridge-notfound-{light,dark}.png` (404),
`prediction-bridge-error-{light,dark}.png` (błąd serwera + Spróbuj
ponownie).

**FinanceLegacyBridgeGate — most na poziomie FinanceHub**:
`gate-baseline-resolved-{light,dark}.png`, `gate-baseline-missing-{light,dark}.png`,
`gate-baseline-quarantined-light.png` (z powodem `approved_without_snapshot`),
`gate-baseline-error-light.png`, plus po jednym `resolved` dla
`gate-prediction-resolved-light.png` / `gate-analysis-resolved-light.png` /
`gate-valuation-resolved-light.png` (dowód, że wszystkie cztery `kind`
przechodzą przez identyczny, przetestowany mechanizm).

W trakcie zbierania zrzutów wykryto i naprawiono błąd w samym mocku
harnessu (nie w kodzie produkcyjnym): koperta błędu musi być `{error, code}`
na najwyższym poziomie, nie zawinięta w `{data: ...}` jak odpowiedź sukcesu
— inaczej `describeFinanceV2Error` nie widział `code` i scena "notfound"
pokazywała ten sam generyczny tekst co "error". Naprawione w
`finance-prediction-workspace.tsx` i `finance-id-bridge.tsx`, zrzuty
przechwycone ponownie po naprawie.

**Ograniczenie zrzutów (uczciwie zgłoszone)**: pełna macierz 5 workspace'ów
× 3 stany × light/dark (30 zrzutów) NIE została zebrana w całości —
Statements/`FinancialStatementPackWorkspace` (piąty workspace z brief'u) nie
przechodzi w ogóle przez `FinanceLegacyBridgeGate` (jego branch,
`openStatement`, nie jest jednym z czterech `openV3*` — statements nie ma
dziś v3-workspace'u ani osobnej flagi, patrz `resolveFinanceDetailBranches`),
więc most go nie dotyczy — potwierdzone czytaniem kodu, nie pominięciem.
Dla pozostałych czterech: Baseline/Analysis/Valuation mają PEŁNE
"resolved+dane" zrzuty z WCZEŚNIEJSZYCH pakietów (Pakiety F/E/H,
`?screen=finance-{baseline,analysis,valuation}-workspace`, patrz istniejące
`docs/validation/finance-v3/generated/gate-e/visual/pkg-f/` itd.) —
NIEPOWTÓRZONE tu (nie zmieniły się, wciąż aktualne), tylko most (nowa
warstwa) ma świeże zrzuty. Trzy stany błędu/pustki mostu (missing/
quarantined/error) mają PEŁNĄ macierz light+dark tylko dla Baseline
(reprezentant); Prediction ma pełną macierz light+dark dla WSZYSTKICH
czterech swoich własnych stanów (bo to on jest priorytetem #1 z brief'u).
Analysis/Valuation mają tylko `resolved` (light) — logika `unresolved`/
`error` jest identyczna kodowo dla wszystkich czterech `kind` (ten sam
`FinanceLegacyBridgeGate`, potwierdzone testem jednostkowym niezależnym od
`kind`), więc dodatkowe zrzuty dla nich byłyby powtórzeniem tego samego
komponentu z innym `legacyTable`, nie nowym dowodem — STATUS: **PARTIAL**,
z podanym powodem, nie ukryte jako pełne pokrycie.

---

## 5. Co NIE zostało dostarczone i dlaczego

| Element | Status | Powód |
|---|---|---|
| Backfill WP-C03 uruchomiony na demo/prod | BLOCKED_EXTERNAL | Osobna decyzja programowa (migracja historyczna na żywej bazie), poza zakresem tego zadania i poza regułą "wyłącznie 127.0.0.1" |
| Pełna macierz 30 zrzutów (5×3×2) | PARTIAL | Statements nie przechodzi przez most (nie ma v3-workspace'u); trzy stany błędu/pustki mostu w pełnym light+dark tylko dla Baseline+Prediction, Analysis/Valuation mają `resolved` — powód w §4.7 |
| CRUD zapisu scenariusza Prediction (GET treści scenariusza) | EVIDENCE_MISSING (luka przed-istniejąca, nie w zakresie) | Brak endpointu po stronie serwera — `prediction.routes.ts` ma tylko `preflight`/`calculate`, nie GET treści. Ekran teraz PRZYZNAJE tę lukę wprost (baner), zamiast ją ukrywać — to jest naprawa TEGO zadania (uczciwość), nie naprawa samej luki (osobny, większy pakiet) |
| Naprawa `methods-step-loading` (permanentny "Wczytywanie metod…" bez odróżnienia od trwałego błędu) w `MethodsWeightsStep.tsx` | EVIDENCE_MISSING (zauważone, nie naprawione) | Poza literalnym zakresem "surowy string" — osobna, mniejsza luka uczciwości UI, zgłaszana tu zamiast cicho pomijana |
| Crimson `text-primary-500` na CTA "Wróć do listy" w `EmptyStateInline` (widoczne na zrzutach) | PARTIAL (pre-existing, nie regresja) | Ten sam komponent/wzorzec już był używany identycznie w `FinanceHub.tsx`'s istniejącym fallbacku "unsupported document type" (linia niezmieniona tym pakietem) — dług przed-istniejący w współdzielonym komponencie, nie nowe naruszenie (hooki `check-triada`/`check-list-canon` potwierdziły zero NOWYCH naruszeń na każdym commicie tej sesji) |

---

## 6. Jak zweryfikować niezależnie

```bash
# Serwer (real Postgres, ephemeral):
DATABASE_URL=$(/Users/piotrwisniewski/fv3-pg/newdb.sh idbridge-verify)
cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="$DATABASE_URL" \
  npx vitest run src/routes/v8/finance-v2/__tests__/legacy-id-bridge.routes.pg.test.ts --maxWorkers=2
# oczekiwane: 5 passed
/opt/homebrew/opt/postgresql@15/bin/dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski idbridge-verify

# Frontend (z korzenia repo):
npx vitest run src/components/Finance src/components/Economics --maxWorkers=2
# oczekiwane: 52 files / 476 tests passed

# Zrzuty (opcjonalnie, wymaga portu 58040 wolnego):
npx vite --config dev-render/vite.config.ts --port 58040 --strictPort &
node scripts/dev/idbridge-screenshots.mjs
```
