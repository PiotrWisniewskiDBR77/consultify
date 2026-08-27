# Initiatives — Day 49B report (2026-08-28)

## Status

`IN_PROGRESS` — A.3 zakończone; B.1 zakończone pomiarem i werdyktem. Dalsze pozycje są raportowane dopiero po ich rzeczywistym wykonaniu.

## Tożsamość i bezpieczniki

- instrukcja: `github-backup/codex/day49-instrukcja-20260828`, przeczytana w całości (1842/1842 linie);
- worktree: `/private/tmp/consultify-initiatives-day49b`;
- gałąź: `codex/initiatives-day49b-20260828`;
- marker: `b6c4bcb2eb32eeb17076a9c29460a696bd182796` (`MARKER OK`);
- checkout właściciela nie był modyfikowany; jedyny kontakt to dozwolony symlink `node_modules`;
- Railway, deploy, zdalne bazy i produkcyjne zmienne: nieużywane;
- harness: wyłącznie port `3357`.

## Stan odziedziczony z markera

Marker zawiera A.1, A.2 i A.4 oraz późniejsze naprawy: doradca nie wymyśla liczby okresów, tylko zwraca niewiedzę; test JWT jest odtwarzalny; A.4 dowodzi przez realny `ApiGateway` ścieżki propose → select → `nextGovernedInput` wymaganej przez Realizację. Nie przypisuję tych zmian commitowi Day 49B.

## A.3 — podłączenie doradcy do powierzchni Mocy

Wykorzystano jawną licencję nadzorcy na jeden ekran harnessu i jeden wpis rejestru. `CapacityScenarioSurface` renderuje się z `demoMode={false}`; ekran przechwytuje transport `fetch` dla realnych odczytów scenariuszy i `/api/initiatives/runtime-v1/capacity-options*`. Nie zmieniono zachowania `demoMode` komponentu.

- flaga `VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR` jest ściśle `default OFF`;
- akcja jest widoczna tylko dla opublikowanego scenariusza Mocy spiętego z dokładną, opublikowaną wersją Planu;
- sukces wykonuje pełne `load()`, a nie lokalne doklejenie opcji;
- `NO_CAPACITY_PRESSURE_TO_RESOLVE` jest neutralnym wynikiem, odrębnym od konfliktu wersji;
- nowe napisy mają parytet PL/EN przez `t()`;
- test komponentowy: `7/7 PASS`, `retry=0` (w tym klik → propose → pełny reload → trzy opcje, neutralny brak przeciążenia, konflikt wersji i ukrycie akcji);
- `scripts/check-list-canon.sh`: baseline `394`, wynik po zmianie `394`; staged scan: `0` nowych naruszeń;
- esbuild komponentu i ekranu harnessu: PASS;
- commit: `347364be6d33e84c4d9ee0c82632e2479c0115ee`.

Zrzuty z harnessu `3357` zapisano poza repo w `/private/tmp/consultify-initiatives-day49b-screenshots/`:

1. `a3-before-light.jpg`
2. `a3-before-dark.jpg`
3. `a3-before-empty.jpg`
4. `a3-after-light.jpg`
5. `a3-after-dark.jpg`
6. `a3-after-empty.jpg`

Wariant „po” pokazuje kanoniczne `RESEQUENCE`, `SCOPE_SPLIT`, `ADD_CAPACITY` po ponownym odczycie; wariant pusty pokazuje uczciwy pusty stan. Flaga `VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR` pozostaje domyślnie wyłączona; przełączenie po akcepcie właściciela wykonuje nadzorca.

Uwaga warsztatowa: uruchomienie Prettiera na plikach locale wywołało masowy, mechaniczny rewrite JSON. Został on w całości cofnięty do wersji HEAD, po czym dodano ponownie wyłącznie pięć licencjonowanych kluczy w każdym locale. Nie pozostawiono ubocznego formatowania.

## B.1 — funkcje klienta bez wołających

### Pomiar

Na HEAD po A.3 zmierzono `130` eksportowanych funkcji w `runtimeApi.ts` i `25` funkcji bez wołającego w `src/` poza tym plikiem. Lista 25 nazw jest zgodna z orientacyjną listą autora; nowy `proposeCapacityOptions` ma wołającego, natomiast `writePortfolioScenario` nadal go nie ma. Pomiar powtórzono komendą, która najpierw zbiera trafienia w `src/`, a dopiero potem jawnie odfiltrowuje dokładną ścieżkę `^src/services/initiatives-execution/runtimeApi\.ts$`; wcześniejszy glob `rg -g` nie wykluczał pliku i jego wynik `0` został odrzucony jako wadliwy, nie jako dowód. Wszystkie wymienione niżej trasy są częścią routera zamontowanego jako `/runtime-v1` w `server/src/routes/pmo/initiatives.routes.ts:155`.

| funkcja | plik:linia | metoda + ścieżka HTTP | trasa istnieje? plik:linia | zamontowana? | kandydat na konsumenta w `src/` | werdykt | uzasadnienie (1 zdanie) | czego mi zabrakło |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `closeEffectiveInitiative` | `runtimeApi.ts:1594` | POST `/effectiveness/:id/close` | TAK, `initiativesExecutionRuntime.routes.ts:5785` | TAK | `MyWork/EffectivenessClosureQueue.tsx:93` | `PODŁĄCZ` | Istniejąca kolejka domknięcia jest jawnym miejscem wykonania tej komendy. | — |
| `configureInitiativeCardSelection` | `runtimeApi.ts:1141` | POST `/initiatives/:id/card-selection` | TAK, `...routes.ts:2058` | TAK | `Initiatives/CanonicalInitiativeCardWorkspace.tsx:371` | `PODŁĄCZ` | Kanoniczny workspace kart jest istniejącą powierzchnią konfiguracji zestawu kart. | — |
| `createCapacityOptions` | `runtimeApi.ts:1674` | POST `/capacity-options/:id` | TAK, `...routes.ts:6247` | TAK | nie znalazłem ekranu przyjmującego ręczną kanoniczną trójkę | `PODŁĄCZ_PO_NAPRAWIE` | Surowa komenda nie jest duplikatem doradcy, ale nie ma bezpiecznego konsumenta; A.3 używa odrębnego `/propose`, a §B.2 wprost zabrania usunięcia funkcji związanej z A.2/A.3. | — |
| `decideSourceProposal` | `runtimeApi.ts:934` | POST `/source-proposals/:id/decisions` | TAK, `...routes.ts:1790` | TAK | nie znalazłem | `PODŁĄCZ_PO_NAPRAWIE` | Żywy workflow źródłowy nie ma w `src/` powierzchni listy/szczegółu/decyzji. | — |
| `getFinanceReconciliation` | `runtimeApi.ts:1576` | GET `/finance-reconciliations/:id` | TAK, `...routes.ts:5662` | TAK | `MyWork/EffectivenessClosureQueue.tsx:221` | `PODŁĄCZ` | Kolejka wymaga dokładnego uzgodnienia Finance, ale dziś bazuje na danych zbiorczych. | — |
| `getResultsKpiObservation` | `runtimeApi.ts:1582` | GET `/results-observations/:id` | TAK, `...routes.ts:5703` | TAK | `MyWork/EffectivenessClosureQueue.tsx:365` | `PODŁĄCZ` | Istniejący selektor obserwacji jest naturalnym konsumentem dokładnego readbacku. | — |
| `listAIAnalysisProposals` | `runtimeApi.ts:1650` | GET `/ai-analysis-proposals` | TAK, `...routes.ts:6223` | TAK | `MyWork/AIAnalysisProposalReviewQueue.tsx:49` | `PODŁĄCZ` | Kolejka recenzji używa wariantu `listMy*`, a lista ogólna pasuje do widoku zarządczego tej samej powierzchni. | — |
| `listDeliveryAcceptances` | `runtimeApi.ts:1558` | GET `/delivery-acceptances` | TAK, `...routes.ts:5530` | TAK | `MyWork/DeliveryResultsAcceptanceQueue.tsx:83` | `PODŁĄCZ` | Istnieje dokładna kolejka delivery/results acceptance. | — |
| `listGateQuorums` | `runtimeApi.ts:1712` | GET `/gate-quorums` | TAK, `...routes.ts:6395` | TAK | `MyWork/GateSignoffQueue.tsx:38` | `PODŁĄCZ_PO_NAPRAWIE` | Kolejka ma quorum osadzone w projekcji `listMy*`; osobna lista wymaga decyzji o kształcie scalania, nie prostego podpięcia. | — |
| `listMaterialChanges` | `runtimeApi.ts:1634` | GET `/material-changes` | TAK, `...routes.ts:6122` | TAK | `MyWork/MaterialChangeQueue.tsx:61` | `PODŁĄCZ` | Kolejka używa wariantu `listMy*`, a lista ogólna odpowiada zarządczemu wariantowi tej samej powierzchni. | — |
| `listPortfolioScenarioRegister` | `runtimeApi.ts:824` | GET `/portfolio-scenarios` | TAK, `...routes.ts:3441` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Cała rodzina wymaga brakującej powierzchni, a nie odblokowania istniejącego ekranu. | — |
| `listResultsAcceptances` | `runtimeApi.ts:1561` | GET `/results-acceptances` | TAK, `...routes.ts:5549` | TAK | `MyWork/DeliveryResultsAcceptanceQueue.tsx:83` | `PODŁĄCZ` | Istnieje dokładna kolejka delivery/results acceptance. | — |
| `listSourceProposals` | `runtimeApi.ts:908` | GET `/source-proposals` | TAK, `...routes.ts:1542` | TAK | nie znalazłem | `PODŁĄCZ_PO_NAPRAWIE` | Żywa lista backendowa nie ma odpowiedniej powierzchni w `src/`. | — |
| `readCapacityScenarioHistory` | `runtimeApi.ts:856` | GET `/capacity-scenarios/:id/history` | TAK, `...routes.ts:3567` | TAK | `Initiatives/CapacityScenarioSurface.tsx:181` | `PODŁĄCZ` | Powierzchnia Mocy pokazuje opublikowaną historię jako koncept, lecz nie pobiera kanonicznej historii. | — |
| `readInitiativeCardSelection` | `runtimeApi.ts:1120` | GET `/initiatives/:id/card-selection` | TAK, `...routes.ts:2034` | TAK | `Initiatives/CanonicalInitiativeCardWorkspace.tsx:371` | `PODŁĄCZ` | Kanoniczny workspace kart powinien najpierw odczytać utrwalony zestaw kart. | — |
| `readPortfolioDecision` | `runtimeApi.ts:731` | GET `/initiatives/:id/gates/portfolio/decision` | TAK, `...routes.ts:3062` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Należy do odłączonej rodziny bez ekranu. | — |
| `readPortfolioScenario` | `runtimeApi.ts:661` | GET `/portfolio-scenarios/:id` | TAK, `...routes.ts:2920` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Należy do odłączonej rodziny bez ekranu. | — |
| `readPortfolioScenarioDiff` | `runtimeApi.ts:679` | GET `/portfolio-scenarios/:id/diff` | TAK, `...routes.ts:2971` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Należy do odłączonej rodziny bez ekranu. | — |
| `readPortfolioScenarioHistory` | `runtimeApi.ts:670` | GET `/portfolio-scenarios/:id/history` | TAK, `...routes.ts:2943` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Należy do odłączonej rodziny bez ekranu. | — |
| `readSourceProposal` | `runtimeApi.ts:921` | GET `/source-proposals/:id` | TAK, `...routes.ts:1636` | TAK | nie znalazłem | `PODŁĄCZ_PO_NAPRAWIE` | Żywy detal backendowy nie ma odpowiedniej powierzchni w `src/`. | — |
| `requestDeliveryAcceptance` | `runtimeApi.ts:1530` | POST `/delivery-acceptances/:id/request` | TAK, `...routes.ts:5404` | TAK | `MyWork/DeliveryResultsAcceptanceQueue.tsx:83` | `PODŁĄCZ` | Istniejąca kolejka jest bezpośrednim konsumentem żądania akceptacji delivery. | — |
| `requestHandoffAcceptance` | `runtimeApi.ts:138` | POST `/initiatives/:id/handoff/requests` | TAK, `...routes.ts:3851` | TAK | nie znalazłem kontrolki żądania handoff | `PODŁĄCZ_PO_NAPRAWIE` | Backend żyje, ale obecne powierzchnie pokazują jedynie dane handoff bez komendy żądania. | — |
| `requestPortfolioDecision` | `runtimeApi.ts:693` | POST `/initiatives/:id/gates/portfolio/requests` | TAK, `...routes.ts:3009` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Należy do odłączonej rodziny bez ekranu. | — |
| `requestResultsAcceptance` | `runtimeApi.ts:1544` | POST `/results-acceptances/:id/request` | TAK, `...routes.ts:5467` | TAK | `MyWork/DeliveryResultsAcceptanceQueue.tsx:83` | `PODŁĄCZ` | Istniejąca kolejka jest bezpośrednim konsumentem żądania akceptacji wyników. | — |
| `writePortfolioScenario` | `runtimeApi.ts:647` | POST `/portfolio-scenarios/:id` | TAK, `...routes.ts:2865` | TAK | nie znalazłem powierzchni scenariuszy portfela | `PODŁĄCZ_PO_NAPRAWIE` | Należy do odłączonej rodziny bez ekranu. | — |

### Werdykt grupowy: portfolio scenario

Wszystkie siedem funkcji rodziny otrzymuje wspólny werdykt `PODŁĄCZ_PO_NAPRAWIE`. To **inna choroba niż C.1**: C.1 ma kompletny, zachowany `PortfolioHealthView` odłączony jednym `Set`-em, natomiast dla scenariuszy portfela nie znaleziono istniejącej powierzchni listy/szczegółu/historii/diff/decyzji, którą można ponownie zamontować.

`DO DECYZJI WŁAŚCICIELA`: `0/25`; limit jednej trzeciej nie został przekroczony. W B.2 nie wolno podłączać wskazanych ekranów My Work/Execution, ponieważ są poza zakresem i poza licencją plikową tego dyżuru; werdykt `PODŁĄCZ` pozostaje kontraktowym wpisem dla właściwego dyżuru frontowego.
