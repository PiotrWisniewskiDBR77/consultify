# Consultify — plan bezpiecznego sprzątania i wznowienia trzech przebudów

**Data utworzenia:** 2026-08-08
**Właściciel decyzji i odbioru:** Codex / Piotr
**Stan programu:** `IMPLEMENTATION_FROZEN`
**Dozwolona praca:** audyt, zabezpieczenie, izolacja, inwentaryzacja i niezależna weryfikacja
**Niedozwolona praca:** dalsza implementacja produktu, merge do `demo`, deploy oraz zmiany bazy

## 1. Cel dokumentu

Ten dokument jest wspólną instrukcją dla wszystkich agentów pracujących nad:

1. Agent V8,
2. Documents,
3. Report B / UI45.

Celem sprzątania nie jest usuwanie pracy. Celem jest zachowanie każdej wartościowej zmiany, rozdzielenie odpowiedzialności, odtworzenie jednoznacznej genealogii Git oraz przygotowanie trzech czystych i możliwych do niezależnego odbioru torów.

Żaden agent nie może wznowić implementacji tylko dlatego, że widzi swoje pliki albo działający lokalny build. Wznowienie wymaga jawnego `CODE_GO` dla konkretnego toru.

## 2. Potwierdzony stan wejściowy

Stan poniżej jest snapshotem z 2026-08-08. Przed każdą operacją należy wykonać ponowny odczyt Git i Railway.

| Obszar | Potwierdzony stan |
|---|---|
| Kanoniczny GitHub baseline | `origin/demo` = `3b0c337ee472d07122033d5339cdf3bdb2f254ee` |
| Worktree | 19 |
| Worktree ze zmianami | 10 |
| Główny checkout | 98 zmienionych śledzonych plików i 2937 nieśledzonych plików |
| Agent V8 | 5 commitów nad `origin/demo`, 317 plików |
| Documents final | 196 commitów nad `origin/demo`, 591 plików |
| Relacja Documents → V8 | Documents zawiera cały 317-plikowy zakres V8 |
| UI45 candidate | 577 commitów za `origin/demo`, 115 zmienionych plików |
| Report B CB-01 / CB-03 / CB-05 | osobne worktree z niezatwierdzonymi zmianami na baseline `origin/demo` |
| GitHub PR do `demo` | brak otwartych PR |
| Demo Railway | HTTP 200, aktywny deploy bez identyfikowalnego SHA |
| Staging Railway | `INITIALIZING`, domena nie odpowiada |
| Najnowsze deploye Agent V8 | nieudane na dev, staging i production |
| Najnowsze deploye Documents | nieudane na demo |

Wniosek wejściowy: wszystkie trzy tory mają `NO_GO` dla implementacji, integracji i deploymentu. Mają `GO` wyłącznie dla kontrolowanego recovery.

## 3. Zasady bezwzględne

Do zakończenia programu sprzątania obowiązują następujące reguły:

1. Nie używać `git reset --hard`, `git clean`, `git stash`, blanket checkout ani masowego przywracania plików.
2. Nie wykonywać `git add -A`, masowego commita ani commita obejmującego więcej niż jeden tor.
3. Nie usuwać worktree ani gałęzi przed utworzeniem i zweryfikowaniem snapshotu.
4. Nie pracować implementacyjnie w głównym checkoutcie Consultify.
5. Nie uruchamiać dwóch agentów zapisujących do tego samego worktree.
6. Nie wykonywać merge, push do `demo`, migracji bazy, deployu ani restartu Railway bez osobnej zgody właściciela odbioru.
7. Nie uznawać builda, mocków, lokalnego UI ani samej obecności plików za dowód gotowości.
8. `UNKNOWN` pozostaje `UNKNOWN`; brak dowodu zapisujemy jako `EVIDENCE_MISSING`.
9. Każdy agent może zmieniać wyłącznie pliki zapisane w jego karcie ownership.
10. Każdy agent kończy pracę statusem `AWAITING_CODEX_REVIEW`, a nie samodzielnym `CODE_GO`.

## 4. Model docelowy

Po sprzątaniu mają istnieć cztery czyste obszary pracy:

| Obszar | Przeznaczenie | Zasada |
|---|---|---|
| Clean baseline | odczyt i punkt referencyjny `origin/demo` | bez implementacji |
| Agent V8 recovery | wyłącznie delta Agent V8 | osobny branch i worktree |
| Documents recovery | wyłącznie delta Documents | bez przypadkowego przejęcia całego V8 |
| Report B / UI recovery | UI45 oraz pakiety CB | aktualny baseline i jawni właściciele |

Integracja odbywa się dopiero w piątym, osobnym worktree integracyjnym. Żaden recovery worktree nie jest jednocześnie worktree integracyjnym.

## 5. Role

### Program owner / acceptance owner

- zatwierdza baseline;
- zatwierdza manifest snapshotów;
- rozstrzyga kolizje;
- nadaje `CODE_GO`, `FIX_REQUIRED` albo `NO_GO`;
- jako jedyny autoryzuje merge i deploy.

### Recovery custodian

- wykonuje snapshoty;
- zapisuje HEAD, branch, upstream i pełny status;
- nie poprawia produktu podczas zabezpieczania;
- przekazuje manifest z checksumami.

### Track owner

- pracuje tylko w jednym recovery worktree;
- prowadzi listę `IN_SCOPE`, `OUT_OF_SCOPE` i zależności;
- raportuje zmienione pliki, testy i ryzyka.

### Shared-file integrator

- jest jedynym właścicielem wspólnych plików;
- przenosi zaakceptowane fragmenty z torów do worktree integracyjnego;
- nie zmienia funkcjonalności torów bez decyzji program ownera.

### Independent verifier

- nie jest autorem ocenianego pakietu;
- sprawdza diff, lineage, czystość, testy, scope i evidence;
- nie akceptuje pakietu na podstawie opisu autora.

## 6. Rejestr plików współdzielonych

Poniższe pliki są obecnie objęte blokadą jednego integratora, ponieważ występują w więcej niż jednym torze:

- `server/src/routes/my-work.routes.ts`
- `server/src/services/v8/artifactRegistryService.ts`
- `server/src/types/artifactRegistry.ts`
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/shared/PreviewPane/PreviewActionButton.tsx`
- `src/services/api/artifactRuns.ts`
- `src/components/ReportsAndPresentations/useRapData.ts`
- `public/locales/en/translation.json`
- `public/locales/pl/translation.json`

Lista jest minimalnym znanym zbiorem. W fazie inwentaryzacji należy wygenerować pełną macierz przecięć. Jeżeli nowy plik pojawi się w co najmniej dwóch torach, automatycznie trafia pod ownership integratora.

## 7. Fazy wykonania

### Faza 0 — utrzymanie zamrożenia

**Cel:** zatrzymać przyrost ryzyka.

Kroki:

1. Potwierdzić, że sesje agentów nie zapisują nowych plików.
2. Przekazać wszystkim agentom ten dokument.
3. Oznaczyć ich zadania jako `PAUSED_FOR_RECOVERY`.
4. Zabronić pracy z głównego checkoutu.
5. Zarejestrować ownera każdego istniejącego worktree.

**Gate wyjścia:** przez czas inwentaryzacji nie pojawiają się niezidentyfikowane nowe zmiany.

### Faza 1 — manifest wszystkich drzew i procesów

**Cel:** ustalić, co istnieje, do kogo należy i czy jest aktywne.

Dla każdego worktree zapisać:

- absolutną ścieżkę;
- branch albo detached HEAD;
- HEAD SHA;
- upstream;
- ahead/behind względem upstream i `origin/demo`;
- liczbę zmienionych i nieśledzonych plików;
- właściciela i nazwę przebudowy;
- czas ostatniej zmiany;
- status: `ACTIVE`, `PAUSED`, `RECOVERY_ONLY`, `STALE_CANDIDATE` albo `UNKNOWN_OWNER`.

Minimalne polecenia dowodowe:

```bash
git fetch --all --prune
git worktree list --porcelain
git status --short --branch
git rev-parse HEAD
git rev-list --left-right --count origin/demo...HEAD
git ls-files --others --exclude-standard
```

`git fetch --prune` aktualizuje referencje zdalne, ale nie jest pozwoleniem na `git worktree prune` ani usuwanie katalogów.

**Artefakt:** `WORKTREE_AND_PROCESS_REGISTRY.tsv` oraz czytelne podsumowanie Markdown.

**Gate wyjścia:** każde worktree ma ownera lub jawny status `UNKNOWN_OWNER`; nic nie jest jeszcze usuwane.

### Faza 2 — snapshot i weryfikacja odzyskiwalności

**Cel:** zabezpieczyć pełny stan przed jakąkolwiek reorganizacją.

Dla każdego brudnego worktree należy zachować:

1. HEAD i branch.
2. `git status --porcelain=v1`.
3. diff zmian śledzonych.
4. pełny zestaw plików nieśledzonych.
5. manifest SHA-256 snapshotu.
6. mapę źródło → snapshot.

Snapshot musi być zapisany poza źródłowym worktree. Sam branch nie zabezpiecza plików nieśledzonych.

Weryfikator sprawdza:

- czy liczba plików źródłowych zgadza się z manifestem;
- czy checksumy przechodzą;
- czy snapshot można odczytać;
- czy zapisano dokładny HEAD i timestamp.

**Gate wyjścia:** `SNAPSHOT_VERIFIED` dla każdego brudnego worktree. Bez tego nie wolno usuwać, przenosić ani czyścić żadnego drzewa.

### Faza 3 — klasyfikacja zmian

**Cel:** przypisać każdy plik do jednego toru albo do integratora.

Każda zmiana otrzymuje jedną kategorię:

- `V8_OWNED`
- `DOCUMENTS_OWNED`
- `REPORT_B_UI_OWNED`
- `SHARED_INTEGRATOR_OWNED`
- `EVIDENCE_ONLY`
- `GOVERNANCE_ONLY`
- `UNRELATED_RECOVERY`
- `UNKNOWN_REQUIRES_DECISION`

Reguły:

- Documents nie przejmuje zmian V8 tylko dlatego, że jego branch zawiera commity V8.
- UI45 nie jest automatycznie rebazowany ani mergowany, ponieważ jest 577 commitów za baseline.
- artefakty wizualne i evidence nie są mieszane z commitem implementacyjnym;
- pliki `UNKNOWN_REQUIRES_DECISION` blokują zamknięcie pakietu, ale nie mogą być przypisane na podstawie domysłu.

**Artefakt:** macierz `plik → tor → owner → decyzja → zależność`.

**Gate wyjścia:** każdy plik ma dokładnie jednego ownera.

### Faza 4 — utworzenie czystych recovery worktree

**Cel:** odtworzyć trzy niezależne tory na zatwierdzonym baseline.

Planowane tory:

- `codex/recovery-agent-v8-20260808`
- `codex/recovery-documents-20260808`
- `codex/recovery-report-b-ui-20260808`

Każdy tor powstaje z aktualnie zatwierdzonego `origin/demo`, a nie z przypadkowego lokalnego HEAD. Nazwy i SHA muszą być ponownie zatwierdzone w chwili wykonania.

Zmiany przenosimy selektywnie według manifestu ownership. Nie wykonujemy szerokiego merge całej historycznej gałęzi Documents ani UI45.

Każdy recovery worktree musi mieć:

- czysty status przed rozpoczęciem;
- zapisany baseline SHA;
- osobną kartę zakresu;
- dozwolone ścieżki;
- wymagane testy;
- listę zależności;
- zakaz deployu.

**Gate wyjścia:** trzy tory mają czysty baseline, rozłączne zakresy i nie zawierają przypadkowych plików drugiej przebudowy.

### Faza 5 — naprawa release discipline

**Cel:** uniemożliwić wdrożenia bez genealogii i przypadkowe wdrożenia do wielu środowisk.

Wymagane zmiany:

1. Deploy tylko z wypchniętego, niezmiennego SHA.
2. Każdy runtime publikuje commit SHA i środowisko przez `/ping`, `/version` albo równoważny endpoint.
3. Jawna allowlista branch → Railway environment.
4. Brak automatycznego deployu recovery branch do production.
5. Production wyłącznie z jawnie zaakceptowanego release SHA.
6. TypeScript i migracje działają fail-hard; nie wolno kontynuować po błędach kompilacji.
7. Predeploy, migracje i healthcheck mają oddzielne, zachowane logi.
8. Demo i staging muszą wskazywać identyfikowalny SHA.

**Gate wyjścia:** staging odpowiada, jego SHA jest znane, a kontrolowany testowy deploy nie dotyka production.

### Faza 6 — niezależna kwalifikacja trzech torów

Minimalna kolejność odbioru każdego toru:

1. clean tree i lineage;
2. kontrola zakresu i brak obcych plików;
3. lint/typecheck/build fail-hard;
4. testy jednostkowe i kontraktowe właściwe dla toru;
5. negatywne kontrole;
6. realDB, jeżeli tor dotyka persistence;
7. integracja wspólnych plików przez integratora;
8. staging runtime;
9. browser smoke;
10. porównanie runtime SHA z zaakceptowanym SHA.

Możliwe decyzje:

- `CODE_GO` — tor może kontynuować implementację w zadanym zakresie;
- `FIX_REQUIRED` — wykryto naprawialne braki;
- `NO_GO` — lineage, scope albo bezpieczeństwo są niewiarygodne;
- `BLOCKED_RUNTIME` — kod przeszedł, ale brak dowodu środowiskowego;
- `BLOCKED_DATA` — brak bezpiecznego realDB evidence.

### Faza 7 — kontrolowane wznowienie agentów

Agent dostaje zgodę dopiero w pakiecie zawierającym:

- nazwę toru i worktree;
- baseline oraz aktualny HEAD;
- wyłącznego ownera;
- dozwolone pliki;
- pliki zabronione;
- zależności;
- testy i negatywne kontrole;
- kryteria zakończenia;
- format raportu;
- jawne `CODE_GO`.

W pierwszej fali uruchamiamy maksymalnie jednego autora na tor oraz jednego shared-file integratora. Weryfikatorzy mogą pracować równolegle, ale nie zapisują do worktree autora.

## 8. Kolejność wznowienia

Rekomendowana kolejność:

1. **Agent V8** — najmniejszy czysty delta-set i zależność Documents.
2. **Documents** — po odseparowaniu odziedziczonego V8 i naprawie build/release gate.
3. **Report B / UI** — po przeniesieniu UI45 na aktualny baseline i ustanowieniu ownership wspólnych primitives.
4. **Integracja systemowa** — dopiero po indywidualnym odbiorze wszystkich wymaganych zależności.

Ta kolejność nie oznacza, że discovery i klasyfikacja nie mogą być równoległe. Oznacza, że zmiany nie mogą być integrowane w odwrotnej kolejności.

## 9. Standard raportu agenta

Każdy agent kończy turę jednym z dwóch statusów:

```text
READY_FOR_CODEX_REVIEW
Track:
Worktree:
Branch:
Baseline SHA:
HEAD SHA:
Changed files:
Tests run and exact results:
Negative controls:
Dependencies:
Known risks:
Unrelated changes observed:
Deploy performed: NO
Database mutation performed: NO
```

albo:

```text
BLOCKED
Track:
Blocking condition:
Evidence:
What was attempted:
Files changed before block:
Decision or dependency needed:
Deploy performed: NO
Database mutation performed: NO
```

Brak kompletnego raportu oznacza brak odbioru.

## 10. Warunki końcowej gotowości

### `READY_FOR_IMPLEMENTATION`

- snapshoty są zweryfikowane;
- tor ma czysty recovery worktree;
- zakres i ownership są jednoznaczne;
- nie ma niezidentyfikowanych wspólnych plików;
- agent otrzymał jawne `CODE_GO`.

### `READY_FOR_INTEGRATION`

- tor przeszedł niezależny review;
- wymagane testy są PASS;
- shared-file integrator przygotował jawny diff;
- branch jest wypchnięty i ma znany SHA;
- nie ma zmian spoza zakresu.

### `READY_FOR_DEMO`

- staging działa na tym samym zaakceptowanym SHA;
- realDB i browser smoke są PASS;
- migracje są fail-hard i odwracalność jest opisana;
- demo deploy jest jawnie autoryzowany.

### `READY_FOR_PRODUCTION`

- demo evidence pochodzi z aktualnego SHA;
- wszystkie release gates są PASS;
- istnieje rollback SHA i procedura rollback;
- production deploy jest osobno autoryzowany przez Piotra.

## 11. Pierwszy pakiet wykonawczy

Najbliższy bezpieczny pakiet obejmuje wyłącznie fazy 0–3:

1. registry worktree i procesów;
2. snapshoty wszystkich brudnych worktree;
3. checksumy i niezależną weryfikację;
4. klasyfikację zmian;
5. macierz kolizji i ownership;
6. propozycję dokładnych recovery branch/worktree.

Ten pakiet nie obejmuje czyszczenia, usuwania, merge, push, deployu ani zmian bazy. Po jego odbiorze program owner wydaje osobną zgodę na fazę 4.

## 12. Aktualny gate

| Gate | Stan |
|---|---|
| Recovery i inwentaryzacja | `GO` |
| Tworzenie snapshotów | `GO` |
| Klasyfikacja i ownership | `GO` |
| Dalsza implementacja | `NO_GO` |
| Integracja | `NO_GO` |
| Demo deploy | `NO_GO` |
| Production deploy | `NO_GO` |

Obowiązujący następny gate: **`SNAPSHOT_VERIFIED_AND_OWNERSHIP_APPROVED`**.
