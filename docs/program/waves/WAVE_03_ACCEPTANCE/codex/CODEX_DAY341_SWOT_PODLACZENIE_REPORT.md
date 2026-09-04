# CODEX DAY 341 — SWOT PODLACZENIE

Stan: W TOKU. Baza: marker `74c07919cea7ab55dc9fde5fbd911f7f955ed425`, gałąź `codex/day341-swot-podlaczenie-20260904`.

## R1 — pomiar szwu i dwóch powierzchni

Werdykt: teza instrukcji została potwierdzona. Przed zmianą katalog `src/toolPacks/` ma 31 plików i wszystkie 31 są sklasyfikowane jako `test-only`; liczba wołaczy `toolPacks` poza własnym katalogiem wynosi 0. Totals osiągalności: `app=3044`, `harness-only=30`, `test-only=1017`, `unreachable=719`.

| Plik przewidziany do spięcia | Klasyfikacja przed | Przewidywana po | Żywy konsument |
| --- | --- | --- | --- |
| `src/toolPacks/packs/dynamicSwot.pack.ts` | test-only | app | tak, po podłączeniu przez store |
| `src/toolPacks/registry.ts` | test-only | bez potrzeby zmiany | nie jest wymagany dla minimalnego szwu |
| `src/toolPacks/contract.ts` | test-only | app, jako zależność deskryptora | tak, typy paczki |
| `src/toolPacks/runtimeReadiness.ts` | test-only | bez potrzeby zmiany | nie jest wymagany dla minimalnego szwu |
| `src/store/useToolStore.ts` | app | app | tak |
| `src/components/DiscoveryTools/ToolDocumentView.tsx` | app | app | tak |
| `src/components/DiscoveryTools/toolCompletion.ts` | app | app | tak |
| `dev-render/screens/tools-swot-session-workspace.tsx` | poza raportem skryptu | bez zmiany klasyfikacji | tak, harness; montuje realny `DiscoveryToolsHub` |

Łańcuch żywego produktu: `src/index.tsx` → `src/routes/AppRoutes.tsx:87-88` (lazy import) → `src/routes/AppRoutes.tsx:1306,2062` (trasa `/tools`) → `src/components/Discovery/DiscoveryToolsHub.tsx:3795` (`ToolDocumentView`) → `src/components/DiscoveryTools/ToolDocumentView.tsx:312` (`getStepDefinitions()`) → `src/store/useToolStore.ts:5075` → `src/store/useToolStore.ts:2742` (`TOOL_STEP_DEFINITIONS`) → `src/store/useToolStore.ts:1363` (`SWOT_STEPS`).

| Powierzchnia | Źródło przed | Miejsce | Skutek podłączenia tylko drugiej |
| --- | --- | --- | --- |
| Lewe drzewo sekcji i licznik kroku | `stepDefs` | `ToolDocumentView.tsx:1868`, licznik `:1832` | nadal 5 sekcji/kroków |
| Kafle faz SWOT | `computeDynamicSwotPhaseSummaries()` | `ToolDocumentView.tsx:527,1182-1183`; union w `toolCompletion.ts:14-15` | nadal 5 kafli w `xl:grid-cols-5` |

Kolizje i braki przewodu:

1. `review` jest już id sekcji statycznej (`ToolDocumentView.tsx:1908`).
2. `phaseGroupIndex()` (`ToolDocumentView.tsx:1683-1694`) nie zna `recommendations` ani `review`, więc domyślnie przypisuje grupę 0.
3. `getDynamicSwotPackForCurrentFlags()` używa `slice(0, outputsIndex)` (`dynamicSwot.pack.ts:343`), co po cichu gubi fazy po `outputs`.
4. Kafle mają osobny, twardy union pięciu id i osobną listę; sam szew store nie zmieni tej powierzchni.
5. Siatka kafli jest twardo pięciokolumnowa (`ToolDocumentView.tsx:1182`).
6. `renderPhaseCanvas()` nie ma jawnego, uczciwego stanu dla dwóch nowych faz.

Komendy pomiarowe: `node scripts/dev/reachability-from-root.mjs`, grepy z `§0.1` instrukcji. Surowy wynik: `/private/tmp/cx-day341-swot-podlaczenie-artefakty/reach-przed.json`.

## Korekty wobec instrukcji

- Na etapie R1 brak korekt liczbowych. Dodatkowym żywym konsumentem `getStepDefinitions()` jest `src/components/DiscoveryTools/ToolWorkspace.tsx:251`; nie zmienia to rozstrzygnięcia dwóch badanych powierzchni w `ToolDocumentView`.
- Kontrola rozłączności z instrukcji zawiera regex `(?!dynamicSwot)`, którego macOS `grep -E` nie obsługuje (`grep: repetition-operator operand invalid`). Kontrolę wykonuję również przez jawną inspekcję pełnej listy staged.

## R2 — rozstrzygnięcie szwu i kolizji `review`

Szew jest w `src/store/useToolStore.ts:5075`: `getStepDefinitions()` konsultuje istniejącą paczkę wyłącznie dla bieżącej sesji `dynamic-swot`; przy fladze OFF zwraca dokładnie istniejący obiekt `SWOT_STEPS` (ta sama referencja), przy ON mapuje siedem faz paczki do `StepDefinition`, a pozostałych 30 narzędzi nadal wraca bez zmian z `TOOL_STEP_DEFINITIONS`.

Wybrano wariant A zamiast inicjalizacji stałej modułowej: odczyt flagi następuje w momencie pobrania kroków, nie podczas importu modułu; ogranicza to ryzyko kolejności inicjalizacji i umożliwia deterministyczne testy ON/OFF.

Kolizja `review` zostanie rozwiązana przez zmianę id zastanej sekcji statycznej na `session-review` (wraz z mapami grupy i rozpiętości). Fazowe `review` pozostaje bez zmiany, ponieważ jest już częścią deskryptora, pytania `swot-review-decision` oraz wymaganej kolejności siedmiu faz. Etykieta i funkcja statycznej sekcji pozostają bez zmian; zmienia się wyłącznie lokalny identyfikator w liście sekcji.

## Twierdzenia niezweryfikowane

- Warstwy 3 i 4 po podłączeniu nie są jeszcze udowodnione; wymagają testu renderowanego, realnej bazy i zrzutów OFF/ON.
- Wznawialność siedmiu kroków po zimnym odczycie nie została jeszcze zmierzona.

## R3 — przewód obu powierzchni za flagą OFF

Zaimplementowano jeden szew w `getStepDefinitions()`, siedem kafli z tego samego deskryptora flagi, obsługę grup i uczciwy stan dla `recommendations`/`review`, elastyczną siatkę oraz uchwyty DOM `data-testid` + `data-phase-id` na kaflach i sekcjach. Statyczna sekcja Review ma lokalne id `session-review`; faza zachowuje id `review`. Flaga bez zmiennej nadal oznacza OFF.

Napisy nowych etapów pozostają w istniejącym deskryptorze paczki (`title.pl/en`, `goal.pl/en`) i są z niego konsumowane przez store oraz kafle. Nie dopisano równoległych kluczy `public/locales`; konsekwencją jest jeden SSOT paczki, ale ogólny audyt słownikowy nadal nie obejmuje tych napisów. Liście pozostały `pl=35198`, `en=33065`.

Mianownik przed: 432 testy, 430 PASS, 2 FAIL. Po R3: 438 testów, 436 PASS, 2 FAIL. Te same zastane czerwienie: `dynamic SWOT step locale contract keeps distinct, complete English and Polish labels for every live step` oraz `ToolCanvas — guard for unresolved steps never renders the raw "not implemented" string for an unknown step`. Diff pełnych nazw: 6 dodanych przypadków `Dynamic SWOT runtime wiring`, zero znikniętych. JSON: `/private/tmp/cx-day341-swot-podlaczenie-artefakty/przed.json`, `/private/tmp/cx-day341-swot-podlaczenie-artefakty/po-r3.json`.

Dowód mutacyjny 1:

- Mutacja: usunięcie `WAVE_2_PHASES[0]` z listy faz ON.
- RED: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/toolPacks/__tests__/dynamicSwotRuntimeWiring.test.ts --retry=0` → 2 FAIL / 4 PASS; asercja kolejności wskazała brak `recommendations`.
- Cofnięcie przez `cp`; GREEN: ta sama komenda → 6 PASS.
- SHA pliku i kopii scratch po cofnięciu: `ddacde145ab010069fa5c1a0cc338374bbaf38f17b7a78948000825071806b0c`.

Dowód mutacyjny 2:

- Mutacja: brak/empty env zmieniony na domyślne `true` w parserze istniejącej flagi.
- RED: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/toolPacks/__tests__/dynamicSwotRuntimeWiring.test.ts src/toolPacks/__tests__/dynamicSwotSevenStagesFlag.test.ts --retry=0` → 1 FAIL / 8 PASS; padł dokładnie zastany przypadek `brak zmiennej zachowuje dokładnie pięć dotychczasowych faz`.
- Cofnięcie przez `cp`; GREEN: ta sama komenda → 9 PASS.
- SHA pliku i kopii scratch po cofnięciu: `b0371e2f8f0246c3b647e4211648fb9aa3396b3da5e7d88d36ac7acfdefa647a`.

Osiągalność po R3: 32 pliki pod `src/toolPacks/` (nowy plik testu zwiększył mianownik), w tym `app=3`, `test-only=29`. Żywe są `contract.ts`, `packs/dynamicSwot.pack.ts` i `runtimeReadiness.ts`; totals repo: `app=3048`, `harness-only=30`, `test-only=1014`, `unreachable=719`. `--check-baseline` jest czerwony wyłącznie przez nowy test-only plik; baseline nie został zmieniony.

Pełny `tsc --noEmit` nie zakończył się w 180 sekund i został przerwany w należącej do dyżuru sesji; nie jest raportowany jako PASS.

## R4 — realny PostgreSQL i zimny odczyt

PostgreSQL: `cx-day341-pg`, `127.0.0.1:6377/cx341`, obraz `pgvector/pgvector:pg16`. Po pierwszym pełnym przebiegu baza miała 894 wpisy `schema_migrations`; jawny przebieg idempotencyjny podał `Applying migrations: 0` i `Postgres migrations complete`. Tabela `settings` miała 0 kluczy `smtp%`.

Dowód użył realnego `ApiGateway.getInstance().initializeRoutes(app)` w osobnym procesie ESM na wyłącznym porcie 5517, bez uruchamiania `server/src/index.ts`. To omija dreny outboxu i nie jest gołym routerem. `DB_IDENTITY` procesu: `127.0.0.1:6377/cx341`.

Komenda Playwright z pełnym env, `--retries=0 --workers=1` i filtrem `DAY341:` zakończyła się `2 passed (2.0s)`:

- `DAY341: stage seven survives a cold authenticated read from real PostgreSQL` — zapis `wizardState.currentStep=review`, kolejności 7 faz i answers, następnie odczyt osobnym klientem HTTP.
- `DAY341: an OFF-compatible read preserves stage-seven data` — odczyt zachował answers oraz metadane zapisane przy siedmiu fazach; payload nie jest odrzucany ani obcinany przy wycofaniu UI do OFF.

Pierwszy przebieg był błędem transformacji Playwright przy bezpośrednim imporcie Gateway (`declare status`); drugi ujawnił zastany defekt `/api/test-support/cleanup`: endpoint tworzy `admin_audit_logs` wskazujący użytkownika, po czym próbuje usunąć tego użytkownika i dostaje FK 500. Test dyżuru sprząta własne dane jawnie w swojej efemerycznej bazie. Dopiero trzeci przebieg jest wynikiem zielonym.

Pułapki (a)-(e): (a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false DB_TYPE=postgres` oraz `DB_IDENTITY`; (d) `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT z Gateway; (e) `RUN_DB_TESTS=1`, jawny `DATABASE_URL`, realny zapis i zimny GET. `--retries=0` wykluczył samoleczenie.

Deklaracja Z30: „Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”
