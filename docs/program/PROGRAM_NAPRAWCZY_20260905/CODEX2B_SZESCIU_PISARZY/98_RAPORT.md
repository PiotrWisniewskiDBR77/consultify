# CODEX2B — raport wykonania

Stan: PARTIAL — checkpoint trzech rodzin. Budget-items, milestones i resources mają kod i dowody lokalne; niezależny odbiór poprawki review w toku. Gate-roles i staffing-plans będą kontynuowane. Move pozostaje decyzją o rodowodzie projektu, nie ukończoną funkcją.

## 0. Metryka

Marker `a176d3f906`, gałąź `codex/szesciu-pisarzy-legacy-20260911`.
Kontener `cx-codex2b-pg`, PostgreSQL18/pgvector, port6454.
Bazy `cx_codex2b`, `codex2b_kopia_1009`. Harness5594 nieuruchomiony. Backendtsc exit0: `three-writers-server-tsc-fixed.log`; gitdiff--check exit0.
Pełne migracje czystej bazy:914; zakończone; drugi przebieg: `Applying migrations: 0`.
Korekta pg16→pg18: lokalny szablon pochodzi zPG18; żadna baza zdalna nieużyta.

## 1. K-PUNKTY przed/po

Pomiar kodu: K5 0/6 wycofanych;6rodzin ma wołaczy;19tras zapisu.
K7 przed:3metody RAID. K8 przed:4wzorce.
K9 kopia lokalna po pełnym restore:

```
initiative_milestones|17
initiative_resources|0
initiative_budget_items|0
initiative_gate_roles|0
staffing_plans|0
staffing_plan_roles|0
initiative|31
decision|20
plan_scenario_version|15
portfolio_scenario_version|14
execution_task|12
raid_item|10
execution_case|10
gate_quorum|9
gate_signoff|9
source_proposal|7
handoff_package|6
execution_milestone|6
execution_decision|4
capacity_scenario_version|4
ai_analysis_proposal|4
plan_analysis_proposal|3
portfolio_scenario|3
plan_scenario|3
report_run|2
capacity_scenario|2
management_signal|2
capacity_options|2
task|2
results_kpi_observation|2
archive_manifest|1
benefits_handoff_pack|1
delivery_acceptance|1
effectiveness_snapshot|1
results_acceptance|1
operational_allocation|1
closure_snapshot|1
material_change|1
effectiveness_case|1
resource_commitment|1
closure_case|1
```

## 2. Stan wejściowy

Pełne komendy i wyniki: `codex2b-artefakty/e2-0-static.txt`.
32trafienia callerów nie oznaczają32wywołań zapisu: zawierają także komentarze i GET.

## 3. SZEŚĆ ŚCIEŻEK — tabela rdzeniowa

| Rodzina | Trasy zapisu | Trafienia src | Kanoniczny zapis do tabeli UI | Stan |
|---|---:|---:|---|---|
| budget-items |3|5|writeInitiativeBudgetItem|P:10testów,3mutacje|
| milestones |3|6|writeInitiativeMilestone|P:6testów,3mutacje|
| resources |4|6|writeInitiativeResource|P:6testów,3mutacje; ai-apply-log osobno|
| gate-roles |1|4|brak na markerze|NIEZROBIONE|
| staffing-plans |7|10|brak na markerze|NIEZROBIONE|
| move |1|1|brak na markerze|NIEZROBIONE|

## 4. Kroki E2.0…E2.6, E9

E2.0: pomiar kodu, migracje ×2 i pełny restore lokalnego szablonu wykonane.
E2.0 commit1af9920ce5. E2.2 pierwszy budget commit828c68cf88 został wstrzymany
przez niezależny review (opis niżej); ten checkpoint zawiera poprawkę.
E2.3: trzy rodziny mają kanoniczne create/update/delete, adaptery istniejącej flagi
oraz testy po treści. Nie wycofano żadnej trasy. OFF legalneCRUD pozostaje.
Milestones zachowuje rebaseline gate i zapisuje log z rzeczywistym requested_by.
Resources zachowuje rowversionCAS i przelicza capacity w tej samej transakcji.

Review znalazł dwa P1: session-stable X-Correlation-ID nie jest idempotency key;
stały hashPUT(A) nie rozróżniał późniejszego A→B→A. Naprawa używa wyłącznie
Idempotency-Key jako jawnej intencji. FallbackPUT uwzględnia wersję i rozpoznaje
replay ostatniego receipt. KeylessPOST po usunięciu tworzy nową deterministyczną
inkarnację. Identyczne keylessPOST na żywym rekordzie nadal są deduplikowane:
różne intencje o identycznej treści wymagają różnych Idempotency-Key.
Nowe testy odkryły DELETE bezbody500 — optionalchain usuwa ten błąd.
Błędne expectedCanonicalVersion zwraca400; archiwum kanoniczne409.

Pułapki§0.2e(a)-(f): każdy plik wymuszaDBpostgres/RUN_DB_TESTS1/MOCK_DBfalse,
V8true, betavisibilityenforce, authbypass!=true; assertRealPostgresbezargumentów.
ApiGateway+JWT+SQL jest realny; WRITEON/OFF jawnie perprzypadek, READfalse/true
przy odczycie po treści. Tests nie montują samego routera i nie uruchamiają index.ts.

## 5. Dowody mutacyjne (Z32)

### budget

projection red: 3PASS/7FAIL; 10pełnych nazw. `budget-mutation-projection-red.json`.

projection green: 10PASS/0FAIL; 10pełnych nazw. `budget-mutation-projection-green.json`.

tenant red: 9PASS/1FAIL; 10pełnych nazw. `budget-mutation-tenant-red.json`.

tenant green: 10PASS/0FAIL; 10pełnych nazw. `budget-mutation-tenant-green.json`.

flag red: 5PASS/5FAIL; 10pełnych nazw. `budget-mutation-flag-red.json`.

flag green: 10PASS/0FAIL; 10pełnych nazw. `budget-mutation-flag-green.json`.

Komendy exact w plikach `budget-mutation-*-*.command.txt`, kod mutacji w `codex2b-scratch/run-budget-mutations.py`. Przywrócenie przezcp; porównanie bajtowe identyczne; mutacyjnydiffpusty.

### milestones

projection red: 3PASS/3FAIL; 6pełnych nazw. `milestones-mutation-projection-red.json`.

projection green: 6PASS/0FAIL; 6pełnych nazw. `milestones-mutation-projection-green.json`.

tenant red: 5PASS/1FAIL; 6pełnych nazw. `milestones-mutation-tenant-red.json`.

tenant green: 6PASS/0FAIL; 6pełnych nazw. `milestones-mutation-tenant-green.json`.

flag red: 4PASS/2FAIL; 6pełnych nazw. `milestones-mutation-flag-red.json`.

flag green: 6PASS/0FAIL; 6pełnych nazw. `milestones-mutation-flag-green.json`.

Komendy exact w plikach `milestones-mutation-*-*.command.txt`, kod mutacji w `codex2b-scratch/run-milestones-mutations.py`. Przywrócenie przezcp; porównanie bajtowe identyczne; mutacyjnydiffpusty.

### resources

projection red: 3PASS/3FAIL; 6pełnych nazw. `resources-mutation-projection-red.json`.

projection green: 6PASS/0FAIL; 6pełnych nazw. `resources-mutation-projection-green.json`.

tenant red: 5PASS/1FAIL; 6pełnych nazw. `resources-mutation-tenant-red.json`.

tenant green: 6PASS/0FAIL; 6pełnych nazw. `resources-mutation-tenant-green.json`.

flag red: 4PASS/2FAIL; 6pełnych nazw. `resources-mutation-flag-red.json`.

flag green: 6PASS/0FAIL; 6pełnych nazw. `resources-mutation-flag-green.json`.

Komendy exact w plikach `resources-mutation-*-*.command.txt`, kod mutacji w `codex2b-scratch/run-resources-mutations.py`. Przywrócenie przezcp; porównanie bajtowe identyczne; mutacyjnydiffpusty.

## 6. Zasięg testów (§0.4a)

Przed:15nazw. Po:22nazwy. ZNIKNIĘTE:0. DODANE:7:

- CODEX2B budget items canonical writer a session correlation ID does not merge different operations; keyless edits can return A-B-A
- CODEX2B budget items canonical writer invalid canonical versions return 400 and archived writes return 409
- CODEX2B budget items canonical writer keyless create after delete creates a live new incarnation and retries it
- CODEX2B budget items canonical writer legacy ON supports update/delete and surfaces stale canonical version
- CODEX2B budget items canonical writer native runtime CRUD, explicit CAS and foreign tenant use the same projection
- CODEX2B milestones canonical writer native CRUD keeps schedule decision gate, audit actor and canonical CAS
- CODEX2B resources canonical writer native CRUD preserves resource version CAS and atomic capacity readback

LegalnyOFF CRUD ma te same trzy pełne nazwy przed i po zmianie, wszystkiePASS.
SecuritybudgetOFF celowo naprawia cross-org201→404, autoryzacja integratora zapisana.
Czerwone kontrakty pozostałych writerów są osobnym plikiem, nie wchodzą do22PASS.

## 7. Deklaracja Z30

SMTP env:0nazw; settings SMTP0;ie_outbox_delivery_receipts0 przed pierwszym zapisem.
ApiGateway montowany bez index.ts, żaden drenaż nieuruchomiony.
Zero realnych wysyłek. Zdarzenia leżą w `ie_outbox_events` (0 sztuk po sprzątnięciu fixture), `ie_outbox_delivery_receipts` = 0, żaden drenaż nie działał w procesie testowym. Po każdym pełnym pliku fixture są usuwane poorganizationId; zera po sprzątnięciu nie negują zdarzeń w transakcji.

## 8. Migracje i manifesty

Brak nowych migracji. Pełny dump lokalnego szablonu leży poza repo.

## 9. Korekty wobec instrukcji

Z30 sprawdzony bez drukowania wartości zmiennych środowiska.
Vitest wymaga --root server i absolutnego --config; względny po zmianie root
wskazuje błędnie server/server/vitest.config.ts. Pierwszy startup nie był pomiarem.
Nowe importy przesunęły zastany // @ts-nocheck kontrolera i aktywowały stary plik wtsc; istniejący komentarz przywrócono do pierwszej linii, bez nowego wyciszenia. Powtórny backendtsc0.
Pierwsze uruchomienie migratora trafiło na rozruch PG; po pg_isready pełny przebieg
powtórzono z powodzeniem. Drugie wykonanie jest idempotentne.

## 10. STOP-y

Brak STOP całego bloku. Lokalna ochrona tenantów budget została autoryzowana przez
integratora jako poprawka bezpieczeństwa w trzech handlerach, bez zmian istniejących
bramek E3 lub globalnego middleware.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

Nie zmierzono staging/demo/produkcji ani przeglądarki/i18nrender. Nie zmierzono równoczesnego retry dwóch procesów ani pełnego korpusu testowego. Gate-roles/staffing/move nie mają jeszcze gotowej implementacji w tym checkpoincie. Dowody22PASS dotyczą lokalnego ApiGateway/JWT/Postgres, nie gotowości uruchomienia produktu.

## 12. DO DECYZJI WŁAŚCICIELA

- move: czy zmiana project_id ma zostać osobną komendą kanoniczną; brakuje decyzji
  kontraktu tożsamości i skutków dla istniejących relacji. Lokalny pomiar:10execution_case,4z własnymprojectId,6dziedziczy;12execution_task przezexecutionCaseId. Reader bierze najpierw własnyprojectId,potemcase,poteminitiative. Sam UPDATE dwóchmagazynów przeniesie tylko część uprawnieńzadań; trzeba rozstrzygnąć relacjęmoveTasks zkanonicznymcase i zaakceptowanymplanem/proposal.
- Autoryzacja: budget legacy ma shadow capability; kanoniczny runtime ogranicza
  dostęp przez authorizeProjects. Nie zmieniono modelu uprawnień.
- expectedVersion: starszy klient nie podaje wersji kanonicznej. Adapter zachowuje
  ostatni zapis wygrywa; nowy endpoint wymaga jawnej wersji. Pełna ochrona klienta
  wymaga osobnej zmiany frontu poza tym blokiem.

## 13. ZNALEZISKA POBOCZNE

SECURITY: budżetowy POST zJWT drugiej organizacji potwierdzony201 na markerze
przy OFF iON. Tworzy wiersz z cudzym initiative_id. Dowód budget-before.json.
Update/delete również wymagają lokalnej walidacji rodzica; nie zmieniamy shadow capability.

## 14. Artefakty

Katalog absolutny: `/Users/piotrwisniewski/Developer/codex-wt/codex2b-artefakty`.
Manifest SHA256 zostanie uzupełniony na zamknięciu bloku.
