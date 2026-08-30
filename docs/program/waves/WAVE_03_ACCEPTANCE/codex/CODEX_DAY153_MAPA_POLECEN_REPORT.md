# CODEX DAY 153 — mapa pokrycia poleceń kanonicznej ścieżki zapisu

## Stan wejściowy

Dyżur pomiarowy i projektowy. Zero zmian produktu. Marker jest przodkiem bieżącego HEAD, nie wymagam równości SHA.

```text
$ git merge-base --is-ancestor e4ff8e21ae HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short

$ git branch --show-current
codex/day153-mapa-polecen-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 11:50 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
/dev/disk3s1s1 1.8Ti 12Gi 31Gi 28% 459k 322M 0% /
```

Porty `6039`, `4972`, `4973` sprawdzono przez `lsof -nP -iTCP:<port> -sTCP:LISTEN`; wszystkie trzy wyniki były puste. `docker ps -a --filter name='^/cx-day153-pg$'` także był pusty.

### Migracje

Kontener: `pgvector/pgvector:pg16`, `cx-day153-pg`, wyłącznie `127.0.0.1:6039`, baza `cx153`. Oba przebiegi miały w tej samej linii `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6039/cx153`.

- pierwszy przebieg: `✅ Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`.

Surowe logi: `/private/tmp/cx-day153-mapa-polecen-artefakty/migrate-1.log` i `migrate-2.log`.

### T1 — routery PMO

```text
$ ls server/src/routes/pmo/*.routes.ts | wc -l
      21
```

Nazwy uzyskane przez `ls server/src/routes/pmo/*.routes.ts | xargs -n1 basename`: `capacity.routes.ts`, `decisions.routes.ts`, `execution.routes.ts`, `governance.routes.ts`, `initiativeClosure.routes.ts`, `initiatives.routes.ts`, `initiativesCapacityAdvisor.routes.ts`, `initiativesExecutionRuntime.routes.ts`, `pmo-analysis.routes.ts`, `pmo-context.routes.ts`, `pmo-standards.routes.ts`, `pmo.routes.ts`, `pmoDomains.routes.ts`, `pmoRoles.routes.ts`, `project-members.routes.ts`, `projects.routes.ts`, `roadmap.routes.ts`, `stage-gates.routes.ts`, `stakeholders.routes.ts`, `tasks.routes.ts`, `workstreams.routes.ts`.

### T2 — brama i wszystkie jej nazwy montażowe

Komenda definicyjna z instrukcji zwróciła kod w `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:3`. Świeże wyszukanie po nazwach funkcji:

```text
$ rg -n "requireCanonical(Execution|InitiativeExecution)Writer" server/src/routes server/src/Gateway.ts server/src/middleware --glob '*.ts' --glob '!**/__tests__/**'
server/src/Gateway.ts:9:import { requireCanonicalExecutionWriter } ...
server/src/Gateway.ts:1389:        requireCanonicalExecutionWriter,
server/src/Gateway.ts:1454:        requireCanonicalExecutionWriter,
server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:22:export function requireCanonicalExecutionWriter(
server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:59:export function requireCanonicalInitiativeExecutionWriter(
server/src/routes/pmo/tasks.routes.ts:16:import { requireCanonicalExecutionWriter } ...
server/src/routes/pmo/tasks.routes.ts:67:router.use(requireCanonicalExecutionWriter);
server/src/routes/pmo/initiatives.routes.ts:18:import { requireCanonicalInitiativeExecutionWriter } ...
server/src/routes/pmo/initiatives.routes.ts:160:router.use(requireCanonicalInitiativeExecutionWriter);
server/src/routes/v8/index.ts:4:import { requireCanonicalExecutionWriter } ...
server/src/routes/v8/index.ts:107:v8Router.use('/execution-control', requireCanonicalExecutionWriter, executionControlRoutes);
```

Nazwy montażowe są dwie: `requireCanonicalExecutionWriter` i `requireCanonicalInitiativeExecutionWriter`. Miejsc użycia w routerach są trzy; nie mylę ich z dwoma dodatkowymi przekazaniami middleware w `Gateway.ts`.

### T3/T4 — polecenia i trasy

```text
$ grep -c "commandType" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
80
$ rg -n "commandType: '[a-z0-9.-]+'" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts | wc -l
79
```

`80` nie jest liczbą typów poleceń: komenda T4 liczy każde wystąpienie tekstu. Dokładna liczba wystawionych literałów poleceń to `79`, uzyskana drugą komendą. Pełne wyniki T1–T4: `/private/tmp/cx-day153-mapa-polecen-artefakty/input-measurements.log`; pełna lista 79 literałów: `runtime-command-literals.log`; mapy polecenie→trasa i polecenie→handler: `command-route-map.txt`, `command-handler-map.txt`, `handler-declarations.txt`.

## Korekty wobec instrukcji

1. §1 mówi o „74 literałach `commandType`”. Świeża komenda `rg -n "commandType: '[a-z0-9.-]+'" ... | wc -l` daje `79`. To wynik pomiaru, nie STOP.
2. T4 sugeruje, że różnica między `grep -c "commandType"` a T3 oznacza trasy/polecenia bez pary. To nie jest poprawny mianownik: T3 łapie tylko walidacje zapisane jako `commandType !==`, a część handlerów waliduje inaczej lub deleguje do wspólnego wykonawcy. Sprawdzenie wywoływanej funkcji i jej deklaracji wykazało handler domenowy dla wszystkich 79 literałów.
3. §1 podaje trzy importy bramy, a dalej przytacza spór „dwa kontra jeden”. Własny pomiar znalazł trzy użycia routerowe, ale pod dwiema nazwami; `Gateway.ts` zawiera ponadto dwa przekazania tej samej funkcji. Liczba bez definicji mianownika jest nieprzenośna.
4. Tabela odbioru ma dwa wiersze oznaczone `B8`. Traktuję oba jako obowiązkowe.
5. W §1 pojawia się urwany wiersz „DEC-2026-08-30-01: wskaźnik jest bytem niezależnym”, bez związku z dalszą treścią. Nie użyłem go jako granicy obiektu.

## R1 — macierz pokrycia Runtime-v1

Legenda każdej komórki operacji: `D` = handler domenowy, `R` = wystawiona trasa z literałem, `L` = stan starej ścieżki. `L=N/D` oznacza, że dla tej rodziny nie ustalono osobnej starej ścieżki; nie twierdzę na tej podstawie, że runtime „działa”. Wszystkie `R` odnoszą się do `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`.

| Obiekt / operacje | D — handler domenowy | R — literały/trasy | L — stara ścieżka |
|---|---|---|---|
| source proposal: submit, revise, decide | `submitSourceProposal.ts:83`; `reviseSourceProposal.ts:9`; `decideSourceProposal.ts:77` | `:1535`, `:1648`, `:1859` | inicjatywy za bramą: `initiatives.routes.ts:160` |
| initiative: register, adopt, metadata amend, cancel, source refresh, archive | `registerInitiative.ts:80`; `adoptAcceptedClassicInitiative.ts:16`; `amendInitiativeMetadata.ts:25`; `cancelInitiative.ts:21`; `refreshInitiativeSource.ts:28`; `materialCommand.ts:347` | `:1738`, `:1795`, `:1958`, `:1997`, `:2381`, `:6095` | za bramą: `initiatives.routes.ts:160` |
| initiative cards: configure, publish, review | `configureInitiativeCards.ts:29`; `publishInitiativeCard.ts:38`; `reviewInitiativeCard.ts:28` | `:2119`, `:2433`, `:2493` | za bramą: `initiatives.routes.ts:160` |
| definition remediation: create, resolve | `createDefinitionRemediationWork.ts:38`; `resolveDefinitionRemediationWork.ts:40` | `:2174`, `:2701` | `N/D`; negatywny inwentarz legacy w `legacy-mutation-routes.log` |
| definition decision: request, decide | `definitionDecision.ts:112`, `:195` | `:2545`, `:2596` | `N/D` |
| analysis decision: start, request, decide | `analysisDecision.ts:55`, `:88`, `:168` | `:2776`, `:2822`, `:2873` | `N/D` |
| portfolio scenario: mutate | `portfolioScenario.ts:79` | `:2933` | `N/D` |
| portfolio decision: request, decide | `portfolioDecision.ts:43`, `:136` | `:3087`, `:3166` | `N/D` |
| plan scenario: mutate | `planScenario.ts:111` | `:3261` | `N/D` |
| plan analysis proposal: create, review | `planAnalysisProposal.ts:29`, `:115` | `:3439`, `:3473` | `N/D` |
| capacity scenario: mutate | `capacityScenario.ts:103` | `:3540` | `N/D` |
| resource commitment: request, accept, decide | `resourceCommitment.ts:33`, `:103`, `:132` | `:3645`, `:3683`, `:3712` | `N/D` |
| schedule decision: request, decide | `scheduleDecision.ts:182`, `:262` | `:3758`, `:3803` | `N/D` |
| handoff acceptance: request, decide | `handoffAcceptance.ts:64`, `:155` | `:3929`, `:3974` | `N/D` |
| execution milestone: create | `executionMilestone.ts:52` | `:4112` | zadania za bramą: `tasks.routes.ts:67` |
| execution task: create, update, complete, transition | `executionWork.ts:124`, `:186`, `:244`; `executionWorkHardening.ts:69` | `:4189`, `:4220`, `:4250`, `:4395` | zadania za bramą: `tasks.routes.ts:67` |
| execution decision: create, request, decide, transition | `executionWork.ts:293`, `:357`, `:394`; `executionWorkHardening.ts:158` | `:4280`, `:4310`, `:4340`, `:4426` | osobny legacy router decyzji poza bramą; patrz R1-L |
| operational allocation: propose, transition | `operationalAllocation.ts:169`, `:303` | `:4472`, `:4577` | `N/D` |
| execution-control KPI policy: author | `executionControlKpiPolicyAuthoring.ts:35` | `:4691` | `/v8/execution-control` za bramą: `v8/index.ts:107` |
| goal perspective: assign | `assignGoalPerspective.ts:28` | `:4727` | `N/D` |
| execution budget entry: create, void | `executionControlWrites.ts:27`, `:55` | `:4800`, `:4760` | `/v8/execution-control` za bramą: `v8/index.ts:107` |
| execution realization: record | `executionControlWrites.ts:104` | `:4834` | `/v8/execution-control` za bramą: `v8/index.ts:107` |
| RAID item: create, delete | `raidItem.ts:25`, `:59` | `:4889`, `:4926` | `N/D` |
| RAID mitigation: record | `executionControlWrites.ts:145` | `:4960` | `/v8/execution-control` za bramą: `v8/index.ts:107` |
| manager action: execute | `executionControlWrites.ts:187` | `:5011` | `/v8/execution-control` za bramą: `v8/index.ts:107` |
| manager suggestion: review | `executionControlWrites.ts:226` | `:5066` | `/v8/execution-control` za bramą: `v8/index.ts:107` |
| management signal: ingest | `managementIntervention.ts:158` | `:5155` | `N/D` |
| intervention: draft, transition | `managementIntervention.ts:251`, `:383` | `:5186`, `:5218` | `N/D` |
| report definition: create, transition | `reportDefinition.ts:102`, `:150` | `:5286`, `:5326` | `N/D` |
| report run: create, transition | `reportRun.ts:92`, `:183` | `:5375`, `:5417` | `N/D` |
| delivery acceptance: request, decide | `deliveryAcceptance.ts:119`, `:157` | `:5542`, `:5574` | `N/D` |
| results acceptance: request, decide | `deliveryAcceptance.ts:299`, `:348` | `:5605`, `:5637` | `N/D` |
| finance reconciliation: create | `resultsMeasurement.ts:71` | `:5736` | `N/D` |
| results observation: create | `resultsMeasurement.ts:113` | `:5768` | `N/D` |
| effectiveness: create, transition, close | `effectivenessClosure.ts:76`, `:197`, `:347` | `:5860`, `:5892`, `:5923` | `N/D` |
| closure: request, decide | `closureDecision.ts:76`, `:174` | `:5970`, `:6023` | `N/D` |
| material change: create, transition | `materialChange.ts:155`, `:221` | `:6197`, `:6229` | `N/D` |
| AI analysis proposal: create, review | `aiEvidenceGovernance.ts:73`, `:110` | `:6298`, `:6330` | `N/D`; handler nie woła LLM w tym pomiarze |
| capacity options: create, select | `capacityOptions.ts:74`, `:141` | `:6385`, `:6417` | `N/D` |
| gate signoff: submit | `gateSignoff.ts:50` | `:6473` | `N/D` |

Powyższe 39 wierszy obejmuje wszystkie 79 rekordów z `command-handler-map.txt`; kontrola liczności: `wc -l command-handler-map.txt` = `79`. Nie ma luki kategorii (c): każda wystawiona trasa wywołuje deklarowany handler domenowy.

## R1-L — operacje legacy bez pełnej trójki

Dowód negatywny dla poleceń komentarzy Zadania i czasowników legacy Decyzji:

```text
$ rg -n "task_comments|decision\.comment|delegate|resched|repriorit|remind|workflow" server/src/domain/initiatives-execution server/src/routes/pmo/initiativesExecutionRuntime.routes.ts --glob '*.ts' --glob '!**/__tests__/**'
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1130: delegatedFrom: z.string().min(1),
[pozostałe trafienia dotyczą delegacji governance; brak task_comments i poleceń legacy DecisionController]
```

| Obiekt | Operacje i dowody starej trasy | Polecenie/trasa Runtime-v1 | Brama | R2 |
|---|---|---|---|---|
| task | delete `tasks.routes.ts:1166` | nie istnieje; negatywny grep wyżej | TAK `:67` | (a) |
| task comment | create `tasks.routes.ts:1187`; delete `:1198` | nie istnieją; zapis SQL `TaskController.ts:2332`, `:2397` | TAK `tasks.routes.ts:67` | (a), (a) |
| task assignment | assign `:1208`; reassign `:1220`; unassign `:1232` | nie istnieją | TAK `:67` | (a) ×3 |
| task escalation | escalate `:1243`; resolve `:1254` | nie istnieją | TAK `:67` | (a) ×2 |
| task blocking | block `:1303`; unblock `:1315` | nie istnieją | TAK `:67` | (a) ×2 |
| task location/dependency | move `:1326`; add dependency `:1348`; remove dependency `:1354` | nie istnieją | TAK `:67` | (a) ×3 |
| task milestone | set milestone `:1360` | brak równoważnego polecenia tej operacji; `execution.milestone.create` jest osobnym agregatem | TAK `:67` | (a) |
| task custom field | create `:166`; update `:218`; delete `:291` | nie istnieją | TAK `:67` | (a) ×3 |
| task baseline/time/allocation | baseline snapshot `:323`; time entry `:959`; allocation `:1065` | nie istnieją | TAK `:67` | (a) ×3 |
| task draft generation | generate section `:122` | nie utrwala; jest generowaniem draftu | TAK `:67` | (d) |
| decision | create `decisions.routes.ts:94`; update/delegate/reschedule/reprioritize `:105`; delete `:117`; decide `:127`/alias `:138`; escalate `:149`; workflow `:174` | brak poleceń dla agregatu kontrolera legacy; `execution.decision.*` to inny agregat/ścieżki `execution-cases` | NIE; brak importu bramy w pliku | (b) ×6 |
| decision comment | create `:207`; update `:215`; delete `:223` | nie istnieją | NIE | (b) ×3 |
| decision alternative | create `:234`; update `:241`; delete `:248` | nie istnieją | NIE | (b) ×3 |
| decision risk | create `:258`; update `:265`; delete `:272` | nie istnieją | NIE | (b) ×3 |
| decision playbook | create `:47`; update `:54`; delete `:60` | nie istnieją | NIE | (b) ×3 |
| decision reminder | `:160` | efekt powiadomieniowy, nie zapis kanonicznego agregatu; nie uruchomiono | NIE | (d) |
| decision draft generation | `:183`; komentarz mówi „does not persist” | świadomie poza kanonem zapisu | NIE | (d) |

Macierz nie zostawia pustej komórki: pełne pary D/R są w R1, a wszystkie operacje legacy mają jawne „nie istnieje” oraz stan bramy w R1-L. Alias PUT/PATCH `decide` liczę jako jedną operację, nie dwie luki.

## R2 — klasyfikacja luk

- (a): `20` operacji — komenda brak, router `tasks.routes.ts` jest globalnie za bramą od `:67`, więc użytkownik nie ma starego kanału zapisu.
- (b): `18` operacji — komenda brak, router `decisions.routes.ts` nie importuje żadnej z dwóch nazw bramy, więc zapis pozostaje poza kontrolą Runtime-v1.
- (c): `0` — wszystkie 79 literałów tras mają deklarowany handler domenowy.
- (d): `3` — dwa drafty nieutrwalane i reminder jako efekt powiadomieniowy, którego nie wykonywano.

Komendy liczbowe:

```text
$ awk -F'|' 'END{print NR}' /private/tmp/cx-day153-mapa-polecen-artefakty/command-handler-map.txt
79
$ rg -n "requireCanonical(Execution|InitiativeExecution)Writer" server/src/routes/pmo/decisions.routes.ts
[pusty wynik]
$ rg -n "router.use\(requireCanonicalExecutionWriter\)" server/src/routes/pmo/tasks.routes.ts
67:router.use(requireCanonicalExecutionWriter);
```

## R3 — koszt uzupełnienia

Własne pomiary wzorców:

```text
$ wc -l server/src/domain/initiatives-execution/raidItem.ts server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts
81  server/src/domain/initiatives-execution/raidItem.ts
92  server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts
```

- prosty CRUD RAID: 81 linii domeny / 2 polecenia = 40,5 linii domeny na polecenie; handlery tras: create `4858–4895` = 38 linii, delete `4896–4931` = 36 linii, średnio 37 linii trasy; razem wzorzec ≈77,5 linii/polecenie;
- przejście z logiką: `adoptAcceptedClassicInitiative.ts` = 92 linie domeny; trasa `1750–1807` = 58 linii; razem 150 linii/polecenie.

Mnożnik wymagany przez instrukcję: `(a)+(c) = 20+0 = 20`. Rozstaw implementacyjny bez testów i odbioru: `20×77,5 = 1 550` linii dla prostego CRUD do `20×150 = 3 000` linii dla operacji przejściowych. To skala wielu dni do ponad tygodnia pracy implementacyjnej; nie zamieniam liczby linii na fałszywie precyzyjne roboczogodziny. Luki (b) wymagają osobnej decyzji o migracji/odcięciu legacy i nie są uczciwie wycenialne samym wzorcem RAID.

## R4 — materiał do decyzji właściciela, nie decyzja

Kolejność uwzględnia widoczność, ryzyko cichego braku kontroli i koszt wzorcowy:

1. Decision create/update/delete/decide — typowa praca użytkownika, kategoria (b) jest cicha i najwyższego ryzyka, a CRUD ma dolny koszt wzorca.
2. Decision comments — częsta współpraca, cichy zapis (b), trzy proste polecenia o koszcie zbliżonym do RAID.
3. Decision alternatives i risks — widoczne elementy procesu decyzyjnego, cichy zapis (b), dwa pakiety po trzy CRUD.
4. Decision escalate/workflow — wysoka waga biznesowa i cichy zapis (b), ale logika przejścia sugeruje górny koszt wzorca.
5. Decision playbooks — mniejsza częstotliwość, nadal cichy zapis konfiguracyjny (b), trzy CRUD.
6. Task delete — widoczna operacja zablokowana (a), pojedynczy prosty koszt.
7. Task comments — częsta funkcja zablokowana (a), dwa proste polecenia.
8. Task assignment/reassignment/unassignment — typowa praca zablokowana (a), trzy operacje ze średnią logiką przejścia.
9. Task block/unblock i escalation/resolve — ważne sterowanie wykonaniem, jawnie zablokowane (a), cztery przejścia o górnym koszcie.
10. Task dependency/move/milestone — widoczne planowanie, jawnie zablokowane (a), cztery operacje o mieszanym koszcie.
11. Task custom fields — mniej powszechna konfiguracja, jawnie zablokowana (a), trzy CRUD.
12. Task baseline/time/allocation — specjalistyczne ścieżki, jawnie zablokowane (a), trzy różne agregaty wymagające osobnego projektu kontraktów.

Każda luka (a)/(b) jest objęta jednym z powyższych pakietów; grupowanie nie zmienia liczby operacji z R2.

## W-A, W-C i testy

`W-A` nie ma zastosowania: dyżur nie naprawia produktu i nie wykonuje mutacji kodu produkcyjnego. Nie tworzono testu pomocniczego — pełna mapa pochodzi ze statycznego, świeżego inwentarza. `W-C` także nie ma zastosowania do liczby porażek: poza raportem nie ma zmiany, która mogłaby zmienić pakiet testowy. Nie uruchamiam Vitest tylko po to, by wyprodukować pozorne PASS dla statycznej mapy.

Pułapki (a)–(d) dotyczą pakietów runtime/DB, lecz żaden taki pakiet nie był dowodem tego dyżuru. Pułapka (e) dotyczy bezpośrednio: wyłączono ją przez pełną listę plików, wyszukiwanie obu nazw middleware i osobne mianowniki 80 wystąpień/79 literałów.

## Z30 — dowód bezpieczeństwa

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ docker exec cx-day153-pg psql -U postgres -d cx153 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[pusty wynik]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## W-D — granica rozłączności

```text
$ git diff --name-only e4ff8e21ae..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY153_MAPA_POLECEN_REPORT.md
```

Jedyny zmieniony plik jest imiennie licencjonowany. Brak testów `day153.*` i zero zmian produktu.

## Artefakty

Artefakty pozostają poza repo w `/private/tmp/cx-day153-mapa-polecen-artefakty`. Komenda: `shasum -a 256 /private/tmp/cx-day153-mapa-polecen-artefakty/*`.

```text
4adc0b3bc413f18f00a4f9378e627d3cd729faf0d63841ee5edc9bfd9166bda2  command-handler-map.txt
aaff8a436c438b6b9b1872b38d36edc63f2ab00e93b00eb991862a251581077b  command-route-map.txt
a9adff60dfea112392fd65f5ace7cef1daace3366d8e14e5652e03a1d776f940  domain-command-evidence.log
ce63134a3bfecd9cda42dd745a7aae57b4a82453c1dd644121a2f07c5d6ca122  domain-coverage.txt
0f97b6198928d4ae3f68b93ffef4d0468569cb6c5da45aa3677b2a5e8c382c01  gate-identifiers.log
4890c1b7ac490b3a2c8902ddf7ef9f60c5211f02fad5fae3f5ad43373347dbb7  handler-declarations.txt
ff5578b183838e7f387b50cd4c80cef6e658b71496589bc7c3b2501d4e396e18  input-measurements.log
8df2c6cdd7d4898e3fa4662d9993d502ac139266062f618fbcded914025f785c  legacy-mutation-routes.log
1182b02dd363800d2e6687a138566c3989c94984e4e6dfb558133e0a7854979e  legacy-operations.log
99a1191ec44f38f21f83751eafc56c6219dcde26164a7d3069eb06591938d4c1  migrate-1.log
80a29a7c87e73fcf756fcd66d104e3b0f4854d5a8cf5cd99a19928d1a681fc35  migrate-2.log
5db1a7c000241e03f2060da247bfb6b82c5d6608fe52c92a2818cc4a7314709f  runtime-command-literals.log
fa320b41affda6bc71480137e07bad2ce58b6ffb29d11acbcab77912a22447fb  task-comments-evidence.log
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnych żądań HTTP; raport dowodzi pokrycia statycznego, nie działania tras.
- Nie udowodniono konsumentów frontendowych ani typowej częstości użycia; kryterium widoczności R4 jest oceną projektową na podstawie semantyki tras.
- `L=N/D` nie dowodzi nieistnienia jakiejkolwiek historycznej trasy w całym repo; oznacza brak odpowiednika w świeżym inwentarzu dwóch wskazanych routerów legacy.
- Nie rozstrzygnięto, czy każda operacja legacy DecisionController ma zostać odwzorowana 1:1, czy wycofana; tego zabrakło, by samodzielnie zdecydować zakres migracji.
- Nie przeliczono linii na osobodni bez danych zespołu o tempie implementacji, testowania i odbioru.
