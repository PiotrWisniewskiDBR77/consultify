# F2-2 Realizacja E2 Praca — niezależny ponowny odbiór 2026-09-14

**Werdykt: HOLD — cztery poprzednie braki funkcjonalne zostały naprawione, lecz pełna delta testowa nie przechodzi, bieżący kandydat nie ma aktualnego freeze manifestu, prototyp łamie jawny nakaz tokenów z Wpisu 26, a konkurencyjna idempotencja zwraca nieprawdziwy receipt.**

## Tożsamość

- exact tip odbioru: `7140cb36ee6a9ee6ffd8a2c824c555ac6e27244b`
- implementacja autora: `edbd8c8eabc122788a28befa4bb406e1ab627560`
- baza i merge-base: `88f1a1994dffa8b1f3b706476078844cbb43441f`
- status wejściowy i po testach: czysty
- migracje: brak; użyto istniejącej `execution_report_snapshots`

## Blokery

### P1 — pełna delta testowa z Wpisu 30 jest czerwona

Od bazy do tipa zmieniono 13 plików testowych. Uruchomienie wszystkich trzynastu jednym `vitest run --retry=0` na lokalnym PostgreSQL dało **12 plików PASS / 92 testy PASS oraz 1 plik FAIL przed zebraniem testów**:

`src/components/Execution/__tests__/f2-2-entry-contract.red.test.ts` próbuje wczytać nieistniejący śledzony artefakt `evidence/f2-2-realizacja/audit/coverage-29-initial.json` i kończy się `ENOENT` w linii 7.

`AUTHOR_FIX_RECEIPT_20260914.md` wyłącza ten plik z bramki jako historyczny. Wpis 30 ustanawia jednak regułę przeciwną: `FOCUSED_TESTS.json` ma obejmować wszystkie pliki testowe z delty. Nazwa `.red.test` i deklaracja raportu nie mogą zastąpić działającego testu. Trzeba usunąć nieaktualny test z delty albo doprowadzić jego kontrakt oraz fixture do aktualnej, zielonej prawdy etapu.

### P1 — brak freeze manifestu dla naprawionego kandydata

`E2_FREEZE_MANIFEST.json` nadal wskazuje `candidateContentSha=86f484fd6b...`, ma 40 plików i opisuje stan sprzed implementacji poprawek. Aktualna delta ma 56 plików. W porównaniu z tipem manifest pomija 15 plików i 9 zapisanych hashy/rozmiarów nie odpowiada bieżącym blobom. Jest prawidłowym historycznym manifestem starego kandydata, lecz nie manifestem `7140cb36ee` ani `edbd8c8eab`.

### P1 — konkurencyjny replay może zwrócić fałszywy receipt

`generateExecutionWorkAnalysis` wykonuje osobno: odczyt braku rekordu, budowę payloadu, `INSERT ... ON CONFLICT DO NOTHING`, readback samego `id`, a następnie bezwarunkowo zwraca lokalne `{ created: true, asOf, payload }`. Gdy scheduler i żądanie on-demand trafią równolegle w ten sam organizacja×tydzień, oba mogą przejść pierwszy odczyt. Jeden zapisze rekord, drugi nic nie zapisze, ale oba zwrócą `created:true`; przegrany zwróci również własne `asOf` i payload, których nie ma w bazie. Sekwencyjny test 201→200 nie bada tego przypadku.

Po `ON CONFLICT DO NOTHING` wynik musi rozróżnić insert od konfliktu i przy konflikcie odczytać oraz zwrócić utrwalony payload z `created:false`. Test ma uruchomić dwa równoległe generowania i dowieść jednego wiersza, dokładnie jednego `created:true` oraz identycznego utrwalonego receipt po obu stronach.

### P2 — dwa nieistniejące tokeny nadal są w delcie mimo Wpisu 26

`dev-render/screens/execution-risk-signal-e0.tsx` nadal używa `bg-c-surface-muted` oraz `text-c-text-primary`. Żaden z nich nie istnieje w `src/index.css`; pierwszy został wskazany dosłownie we Wpisie 26 jako cichy no-op do zamiany na `c-surface-subtle`. Pełna delta ma zero `primary-*` i zero crimson, ale kontrola tokenów nie może ograniczać się do nowych linii E2.

## Funkcja odebrana pozytywnie

- Serwer generuje trzy okna: poprzedni tydzień, następny tydzień i następne 30 dni; zadania domknięte są przypisywane do poprzedniego tygodnia przez `completedAt`.
- Scheduler rejestruje dokładnie `0 5 * * 1` w UTC i jest domyślnie OFF przez ścisłe `ENABLE_EXECUTION_WORK_ANALYSIS === 'true'`.
- On-demand przyjmuje tylko `weekOf`, sam odczytuje kanoniczne dane i zapisuje do istniejącej `execution_report_snapshots`; klient nie może podać treści raportu.
- Sekwencyjna idempotencja jest prawdziwa: pierwszy request 201, ten sam tydzień 200, jeden rekord i ten sam deterministyczny identyfikator.
- Lista organizacji usuwa sentinel `system` przez walidację UUID. Próba RealPG przebiegła z sentinelowym rekordem obecnym w bazie bez błędu FK.
- `projectTitle` pochodzi z tenantowego `LEFT JOIN projects` po `organization_id` i jest zwracany przez realny Gateway.
- Tabela uwagi pokazuje rekordy oraz powody `BLOCKED`, `OVERDUE`, `UNASSIGNED`, `NO_DUE_DATE`.
- Akcje UI wołają istniejący `V8ExecutionControlApi.executeManagerProblemAction`; trasa deleguje do `executeManagerProblemAction`, a serwis wybiera problem w obrębie organizacji i zapisuje mutację z audytem transakcyjnie.
- Wyjątek canonical writera jest wąski: tylko `POST /lanes/:laneId/problem-actions/execute`; inne metody, dłuższa ścieżka i sąsiednie `suggestions/apply` pozostają 409. Zwykłe auth/V8/tenant middleware stoją przed routerem, `manage_workstreams` przed handlerem.
- RealPG potwierdził OWNER 200, zmianę `estimated_hours`, wpis `manager_action_audit_log`, MEMBER 403 i sąsiednią trasę 409.
- Brak martwego literału statusu inicjatywy w nowej bramce; nowy `DRAFT` dotyczy kanonicznego statusu istniejącej migawki raportu, a `BLOCKED/DONE/...` dotyczą statusów zadań i decyzji.
- `executionCaseVersion:null` pozostaje opisowe: `Linked · version not reported`, bez `v—`.
- Frontend `VITE_EXECUTION_WORK_ANALYSIS` i backend `ENABLE_EXECUTION_WORK_ANALYSIS` są domyślnie OFF; UI testuje opt-in/opt-out, Gateway przy backend OFF zwraca 404.
- EN/PL: 29/29 liści i identyczny zbiór kluczy. Produkcyjny ekran używa `StandardTable` i wspólnego `ExecutionHub`/`StandardModuleBar`.
- Light i dark zostały obejrzane: trzy rekordy z powodami, przyjazna nazwa projektu oraz trzy osiągalne akcje są widoczne i czytelne.

## Odtworzone dowody

- cała delta wg Wpisu 30: **13 plików; 12 PASS, 1 FAIL; 92 testy PASS**;
- Gateway/JWT/RealPG w tym przebiegu: **4/4 PASS** (`executionWorkAnalysis` 2/2 + dropdown 2/2);
- istniejący `managerActionExecutionService`: **12/12 PASS**;
- server TypeScript: `npx tsc -p server/tsconfig.json --noEmit` — exit 0;
- esbuild: produkcyjny komponent klienta oraz nowy serwis serwera — oba exit 0;
- `git diff --check 88f1a1994d..HEAD` — PASS;
- evidence bieżącej delty przed tym review: 14 plików / 453 836 B; po raporcie nadal poniżej 2 MiB;
- zrzuty: light SHA-256 `66f4cf2f...`, dark `8a49dedc...`, rozmiary 57 310 B i 56 306 B.

## Warunek zdjęcia HOLD

Zazielenić wszystkie 13 plików testowych delty, naprawić konkurencyjny receipt i dodać jego test, usunąć dwa nieistniejące tokeny, przygotować aktualny freeze manifest dla końcowego SHA oraz powtórzyć Gateway/JWT/RealPG, tsc, esbuild i light/dark. Po rebase na linię ogłoszoną przez CTO pełna delta testowa musi zostać policzona ponownie.
