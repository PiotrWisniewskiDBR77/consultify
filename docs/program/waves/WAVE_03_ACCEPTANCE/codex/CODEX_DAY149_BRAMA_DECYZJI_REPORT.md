# CODEX DAY 149 — brama Decyzji

## Stan wejściowy

Dokument instrukcji miał stan `WYDANY`. Zastosowano `§0.1-BIS`: bez fetchu, bez
tworzenia worktree i bez pushu.

```text
$ git merge-base --is-ancestor 793fdd073f HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day149-brama-decyzji-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 11:15 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    29Gi    30%    459k  302M    0% /
```

Porty `6035`, `4964` i `4965` były wolne. Kontener `cx-day149-pg` nie istniał.
Pierwszy przebieg pełnych migracji zastosował `866` migracji i zakończył się
`✅ Postgres migrations complete`; drugi zastosował `0` i zakończył się tym samym
komunikatem.

Obowiązkowe komendy stanu wejściowego:

```text
$ grep -nE "import|require" server/src/routes/pmo/decisions.routes.ts | grep -iE "gate|guard|runtime" | wc -l
0
$ grep -nE "import|router\.use" server/src/routes/tasks.routes.ts | grep -iE "gate|guard" | head -5
[brak wyjścia]
$ grep -cE "router\.(post|put|patch|delete)" server/src/routes/pmo/decisions.routes.ts
21
$ ls server/src/domain/initiatives-execution/*.ts | grep -viE "test|index" | head -15
server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts
server/src/domain/initiatives-execution/aiEvidenceGovernance.ts
server/src/domain/initiatives-execution/amendInitiativeMetadata.ts
server/src/domain/initiatives-execution/analysisDecision.ts
server/src/domain/initiatives-execution/analysisReadiness.ts
server/src/domain/initiatives-execution/assignGoalPerspective.ts
server/src/domain/initiatives-execution/cancelInitiative.ts
server/src/domain/initiatives-execution/capacityOptions.ts
server/src/domain/initiatives-execution/capacityOptionsAdvisor.ts
server/src/domain/initiatives-execution/capacityScenario.ts
server/src/domain/initiatives-execution/closureDecision.ts
server/src/domain/initiatives-execution/configureInitiativeCards.ts
server/src/domain/initiatives-execution/createDefinitionRemediationWork.ts
server/src/domain/initiatives-execution/decideSourceProposal.ts
server/src/domain/initiatives-execution/definitionDecision.ts
```

## Korekty wobec instrukcji

1. `§0.1/T2` wskazuje `server/src/routes/tasks.routes.ts` i oczekuje importu oraz
   globalnego montażu bramy. Ten plik jest 10-liniowym stubem i nie importuje bramy.
   Rzeczywisty router zamontowany przez `Gateway.ts:246,903` to
   `server/src/routes/pmo/tasks.routes.ts`; import jest w linii 16, a globalny
   `router.use(requireCanonicalExecutionWriter)` w linii 67. T2 jest prawdziwe
   wyłącznie po korekcie ścieżki o segment `pmo/`.
2. Znany mianownik „23 z 23” nie odpowiada markerowi: samodzielny pomiar
   `rg -n "router\.(post|put|patch|delete)" server/src/routes/pmo/tasks.routes.ts | wc -l`
   daje `23`. Liczba jest potwierdzona dla właściwej ścieżki, nie dla ścieżki z T2.
3. W instrukcji występuje zdanie `DEC-2026-08-30-01: wskaźnik jest bytem
   niezależnym`, niezwiązane z zakresem dyżuru. Nie użyto go do interpretacji
   produktu ani kodu.
4. `Z24` odsyła do nieistniejącego `§0.4a`; zgodnie z `§0.1-BIS` odwołanie
   pominięto. `Z34a` nie zastosowano: zgodnie z `§0.1-BIS` nie pushuję.

## R1 — kompletny inwentarz 21 mutacji HTTP

W kolumnie „bez bramy” `TAK` oznacza brak
`requireCanonicalExecutionWriter` na routerze Decyzji. Nie oznacza to braku
pozostałych kontroli: router ma `verifyToken`, `requireOrgAccess`, capability
shadow i/lub `verifyAdmin` zależnie od trasy.

| # | Metoda i ścieżka | Plik:linia | Faktyczny skutek | Bez bramy |
|---:|---|---|---|---|
| 1 | `POST /playbooks` | `decisions.routes.ts:47` | `INSERT decision_playbooks`; przy default także `UPDATE decision_playbooks` | TAK |
| 2 | `PUT /playbooks/:playbookId` | `decisions.routes.ts:54` | `UPDATE decision_playbooks`; przy default także zerowanie poprzedniego defaultu | TAK |
| 3 | `DELETE /playbooks/:playbookId` | `decisions.routes.ts:60` | `DELETE decision_playbooks` w organizacji | TAK |
| 4 | `POST /` | `decisions.routes.ts:94` | `INSERT decisions`, `decision_history`, opcjonalnie `decision_impacts`; możliwe aktualizacje zadań | TAK |
| 5 | `PUT /:id` | `decisions.routes.ts:105` | `UPDATE decisions` i `INSERT decision_history` | TAK |
| 6 | `DELETE /:id` | `decisions.routes.ts:117` | miękki delete: `UPDATE decisions.status='cancelled'` i wpis historii | TAK |
| 7 | `PATCH /:id/decide` | `decisions.routes.ts:127` | atomowa zmiana decyzji i wpis historii; możliwe skutki w zadaniach | TAK |
| 8 | `PUT /:id/decide` | `decisions.routes.ts:138` | alias tego samego handlera i tych samych zapisów co #7 | TAK |
| 9 | `POST /:id/escalate` | `decisions.routes.ts:149` | `UPDATE decisions` (status/poziom/owner) i `INSERT decision_history` | TAK |
| 10 | `POST /:id/remind` | `decisions.routes.ts:160` | tworzy przypomnienie i próbuje `INSERT decision_history` z akcją `reminded` | TAK |
| 11 | `PATCH /:id/workflow` | `decisions.routes.ts:174` | `UPDATE decisions.workflow_status`, a przy publikacji może tworzyć `tasks` i `link_graph_edges` | TAK |
| 12 | `POST /:id/generate-section` | `decisions.routes.ts:183` | brak zapisu wg kontraktu trasy: generuje nieutrwalony draft | TAK |
| 13 | `POST /:id/comments` | `decisions.routes.ts:207` | `INSERT decision_comments` oraz historia współpracy | TAK |
| 14 | `PUT /:id/comments/:commentId` | `decisions.routes.ts:215` | `UPDATE decision_comments.body` oraz historia współpracy | TAK |
| 15 | `DELETE /:id/comments/:commentId` | `decisions.routes.ts:223` | miękki delete: `UPDATE decision_comments.deleted_at` oraz historia | TAK |
| 16 | `POST /:id/alternatives` | `decisions.routes.ts:234` | `INSERT decision_alternatives` oraz historia współpracy | TAK |
| 17 | `PUT /:id/alternatives/:alternativeId` | `decisions.routes.ts:241` | `UPDATE decision_alternatives` oraz historia współpracy | TAK |
| 18 | `DELETE /:id/alternatives/:alternativeId` | `decisions.routes.ts:248` | `DELETE decision_alternatives` oraz historia współpracy | TAK |
| 19 | `POST /:id/risks` | `decisions.routes.ts:258` | `INSERT decision_risks` oraz historia współpracy | TAK |
| 20 | `PUT /:id/risks/:riskId` | `decisions.routes.ts:265` | `UPDATE decision_risks` oraz historia współpracy | TAK |
| 21 | `DELETE /:id/risks/:riskId` | `decisions.routes.ts:272` | `DELETE decision_risks` oraz historia współpracy | TAK |

Mianownik R1: `21/21` sklasyfikowanych, bez pustych komórek.

## R2 — droga dla każdej mutacji

Istniejące polecenia `execution.decision.create`, `execution.decision.request` i
`execution.decision.decide` operują na agregacie `execution_decision` w
`initiatives-execution/executionWork.ts:293-503`. Router Decyzji zapisuje legacy
tabele `decisions`, `decision_*`, `tasks` i `link_graph_edges`. Zbieżność słowa
„decision” nie jest dowodem zgodności kontraktu ani istnienia polecenia dla tych
handlerów.

| R1 | Droga | Uzasadnienie |
|---|---|---|
| 1–3 | (c) | Playbook jest administracyjną konfiguracją domeny Decyzji, nie zapisem execution-work; ma `verifyAdmin`. Objęcie bramą Runtime-v1 byłoby błędem granicy domenowej. |
| 4 | (a) | Brak polecenia odwzorowującego pełny legacy create wraz z historią, impactami i skutkami w zadaniach. |
| 5 | (a) | Brak polecenia dla delegowania/reschedule/reprioritize legacy `decisions`. |
| 6 | (a) | Brak polecenia dla odwracalnego anulowania legacy Decyzji i jej historii. |
| 7–8 | (a) | `execution.decision.decide` dotyczy osobnego agregatu; brak adaptera zachowującego kontrakt `DecisionController.decide` i jego skutki uboczne. |
| 9 | (a) | Brak polecenia dla eskalacji legacy Decyzji. |
| 10 | (a) | Brak polecenia dla przypomnienia, limitu 24 h, historii i powiadomienia. |
| 11 | (a) | Brak polecenia dla workflow oraz atomowych/pochodnych zapisów publikacji do zadań i grafu. |
| 12 | (c) | Endpoint jest niemutującym proposerem i świadomie nie utrwala draftu; brama zapisu nie ma tu przedmiotu kontroli. |
| 13–15 | (a) | Brak poleceń create/update/delete komentarza z regułą author/admin i historią współpracy. |
| 16–18 | (a) | Brak poleceń create/update/delete alternatywy z regułą preparer/owner/admin i historią. |
| 19–21 | (a) | Brak poleceń create/update/delete ryzyka z regułą preparer/owner/admin i historią. |

Wynik: droga (a) `17/21`, droga (b) `0/21`, droga (c) `4/21`.

## R3 — wynik

R3 ma licencję wyłącznie dla drogi (b). Ponieważ wynik R2 to `0` pozycji (b),
nie zmieniono `server/src/routes/pmo/decisions.routes.ts`. Globalne zamontowanie
obecnej bramy zwróciłoby `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED` dla wszystkich
mutacji poza jedynym wyjątkiem DELETE budżetu zdefiniowanym w middleware, czyli
odcięłoby 17 działających powierzchni oraz 3 administracyjne playbooki. To jest
dokładnie zakazane przez Z40.

`W-A`, B3 i B4 nie mają zastosowania: nie ma pozycji naprawczej licencjonowanej
przez R3. Nie wpisuję `FIXED`, `VERIFIED` ani `ZROBIONE_WG_DoD`.

## R4 — inne routery zapisujące tabele execution-work

Pomiar statyczny objął wszystkie pliki tras (bez `__tests__`) zawierające
dosłowne `INSERT`/`UPDATE`/`DELETE` tabel `tasks`, `decisions` lub `initiatives`,
a następnie sprawdzenie bramy zarówno w pliku, jak i w miejscu montażu Gateway.
To inwentarz kandydatów, nie automatyczny werdykt o luce: sam zapis do tabeli
o tej nazwie nie dowodzi, że operacja należy do kanonu Runtime-v1.

| Router | Zapisy wykryte statycznie | Stan tej konkretnej bramy |
|---|---|---|
| `pmo/tasks.routes.ts` | `UPDATE tasks` (handler ma też kontrolery zapisujące) | globalnie w pliku, linia 67 |
| `pmo/initiatives.routes.ts` | `INSERT decisions/tasks`, `UPDATE decisions/initiatives` | selektywnie w pliku, linia 160 |
| `executionControl.routes.ts` | `INSERT tasks`, `UPDATE initiatives` | globalnie przy montażu w `Gateway.ts:1384-1390` |
| `v8/execution-control.routes.ts` | `UPDATE initiatives/tasks` | globalnie przez `v8/index.ts:107` |
| `assessment-workflow-v2.routes.ts` | `INSERT/UPDATE initiatives` | brak tej bramy |
| `economics.routes.ts` | `INSERT initiatives` | brak tej bramy |
| `feedback.routes.ts` | `INSERT/UPDATE tasks` | brak tej bramy |
| `integrations/automation.routes.ts` | `INSERT tasks` | brak tej bramy |
| `integrations/webhooks.routes.ts` | `UPDATE tasks` | brak tej bramy |
| `my-work.routes.ts` | `INSERT/UPDATE/DELETE tasks`, `INSERT/UPDATE decisions`, `INSERT/UPDATE initiatives` | brak tej bramy |
| `my-work/calendar.routes.ts` | `INSERT/UPDATE tasks`, `UPDATE decisions` | brak tej bramy |
| `pmo/workstreams.routes.ts` | `UPDATE initiatives` | brak tej bramy |
| `portfolioOptimization.routes.ts` | `UPDATE initiatives` | brak tej bramy |
| `report-builder.routes.ts` | `INSERT/UPDATE initiatives` | brak tej bramy |
| `v8/interview-insights.routes.ts` | `UPDATE decisions/initiatives/tasks` | brak tej bramy |
| `v8/my-work.routes.ts` | `INSERT/UPDATE tasks`, `UPDATE decisions/initiatives` | brak tej bramy |
| `v8/results.routes.ts` | `INSERT tasks` | brak tej bramy |

Wynik R4: 17 innych plików tras z bezpośrednim zapisem do trzech tabel; 4 są
objęte badaną bramą w pliku albo na montażu, 13 nie jest nią objętych. Dla tych
13 potrzebne jest osobne rozstrzygnięcie „legalny producent czy legacy writer”
na podstawie kontraktu domenowego. Zgodnie z licencją R4 nie zmieniono żadnego
z nich.

Ograniczenie pomiaru: SQL składany w usługach/kontrolerach lub przez buildery
może nie wystąpić dosłownie w pliku trasy. Dlatego `13` jest liczbą kandydatów
znalezionych tym pomiarem, nie mianownikiem wszystkich writerów repozytorium.

## Testy, pomiar różnicowy i pułapki środowiska

Nie uruchamiano pakietu Vitest jako dowodu R3, ponieważ R2 nie znalazło żadnej
pozycji (b), a więc nie było licencjonowanej zmiany produktu. `W-A` i `W-C` są
`NIE DOTYCZY`: nie istnieje para „przed/po” dla nieistniejącej naprawy. Nie
wykorzystano zielonego testu jako substytutu dowodu runtime.

Pułapki (a)–(e):

- (a) i (b) — nie dotyczyły statycznego inwentarza; nie uruchamiano ścieżek V8
  ani beta-visibility;
- (c) — nie użyto chronionego `server/vitest.config.ts`; nie uruchamiano
  Vitest. Realny silnik potwierdziły dwa przebiegi migratora z pełnym env na
  `postgresql://...@127.0.0.1:6035/cx149`;
- (d) — nie twierdzono, że wykonano HTTP/JWT; `ENABLE_TEST_AUTH_BYPASS` nie
  służyło do budowania dowodu;
- (e) — rozstrzygnięta przez enumerację kanonicznych `commandType`: brak
  polecenia odpowiadającego któremukolwiek legacy handlerowi R1. Dlatego żadna
  mutacja nie została objęta bramą.

## Protokół Z30

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ docker exec cx-day149-pg psql -U postgres -d cx149 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[brak trafień]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Granica zmian (W-D)

Stan oczekiwany po końcowym commicie:

```text
$ git diff --name-only 793fdd073f..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY149_BRAMA_DECYZJI_REPORT.md
```

Jest to jedyny plik zmieniony w repo i znajduje się w tabeli licencji. Zero
zmian w bramie, innych routerach, migracjach, froncie, flagach i konfiguracji
testowej. Nie utworzono artefaktów binarnych ani logów poza raportem, więc nie
ma plików artefaktów do zahashowania.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowano realnym HTTP, że każda z 21 tras działa dziś na markerze.
   R1 dowodzi rejestracji i implementowanego skutku zapisu, nie pełnej
   osiągalności `ApiGateway → JWT → handler → DB → readback → frontend`.
2. Nie zweryfikowano, czy 13 kandydatów R4 bez tej bramy to luki authority,
   czy świadomie niezależni producenci. Do rozstrzygnięcia potrzebny jest
   osobny kontrakt domenowy i runtime dla każdej powierzchni.
3. Nie zweryfikowano kompatybilności przyszłych poleceń drogi (a) z pełnymi
   skutkami ubocznymi `DecisionController` (historia, impacty, zadania, graf,
   powiadomienia i reguły współpracy).
4. Teza T4 o komentarzu Zadania nie była przedmiotem osobnego runtime testu;
   potwierdzono jedynie, że obecna globalna brama odrzuca każdą mutację bez
   jawnego wyjątku, a jej lista wyjątków nie zawiera komentarza.

## Werdykt

`R1 ZROBIONE`, `R2 ZROBIONE`, `R3 NIE DOTYCZY (0 pozycji b)`, `R4 ZROBIONE
STATYCZNIE / PARTIAL semantycznie`. Bramy B1, B2, B5, B6, B7 i B8 spełnione.
B3/B4 nie mają zastosowania bez pozycji (b). Produktu nie zmieniono, ponieważ
jedyna licencjonowana zmiana R3 nie miała żadnego bezpiecznego celu.
