# CODEX2B — raport wykonania

Stan: PARTIAL — pięć rodzin zaimplementowanych lokalnie, move STOP/PENDING decyzji o rodowodzie i dostępie. Pierwsze trzy rodziny odebrane niezależnie na 8322686a15. Końcowy niezależny review delivery_audit: ACCEPT na kodzie 2f70a7387939c1b0c6ababc4f4332a52a9e05b93 w uzgodnionym zakresie pięciu rodzin i lokalnych poprawek security. Flagi nadal domyślnie OFF; brak deploy/push.

## 0. Metryka

Marker `a176d3f906`, gałąź `codex/szesciu-pisarzy-legacy-20260911`.
Kontener `cx-codex2b-pg`, PostgreSQL18/pgvector, port6454.
Bazy `cx_codex2b`, `codex2b_kopia_1009`. Harness5594 nieuruchomiony. Backend tsc exit0: `staffing-parent-replay-server-tsc.log`; gitdiff--check exit0.
Pełne migracje czystej bazy:914; zakończone; drugi przebieg: `Applying migrations: 0`.
Korekta pg16→pg18: lokalny szablon pochodzi zPG18; żadna baza zdalna nieużyta.

## 1. K-PUNKTY przed/po

Pomiar kodu: K5 0/6 wycofanych;6rodzin ma wołaczy;19tras zapisu.
K7 przed:3 metody RAID; po:8 metod (dodano 5 projekcyjnych metod rodzin). K8 przed:4 wzorce; istniejących metod/UoW i globalnych wzorców nie przerabiano. K5 po:0/6 fizycznie wycofanych; 5/6 rodzin delegowanych pod istniejącą flagą. 17 tras materialnego zapisu ma następcę; resources/ai-apply-log jest tylko audytem, move STOP.
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
| gate-roles |1|4|replaceInitiativeGateRoles|P: 6 testów, 3 mutacje|
| staffing-plans |7|10|writeStaffingProjection|P: 16 testów, 3 mutacje|
| move |1|1|brak|N: kontrakt runtime RED 404; STOP decyzji|

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

Gate roles zastępuje cały jawny profil atomowo, zachowuje walidację użytkowników organizacji i zapis historii przed/po. Domyślny OFF oraz pochodne role GET pozostają. Własny agregat to initiative_gate_role_profile.

Staffing obejmuje 7 istniejących zapisów: plan CRUD, role CRUD, sync capacity. Agregaty staffing_plan (metadane bez pochodnych sum), staffing_plan_role oraz initiative_capacity_snapshot. Role przeliczają sumy planu w tej samej transakcji. Sync zachowuje istniejącą formułę: alokacja z resources / 100, wymagane FTE z ról; suma0 nie kasuje starego required_capacity_fte. Fallback sync zawiera sumy źródłowe, więc zmiana źródła daje nowy zapis; rzeczywisty test pokazuje wzrost wersji i równość SQL SUM.

SECURITY staffing: baseline 1 PASS / 9 FAIL potwierdził foreign POST201 planu, foreign POST201/PUT200/DELETE200 ról i GET200 gaps z nazwą. Root autoryzował lokalne bramki WRITE; osobny wyjątek GET wydzielono w commit720fd678f1. Legalny OFF zachowany. ON addRole zwraca fteAllocated0 zgodne z SQL zamiast starej fałszywej deklaracji fteRequired; root autoryzował tę korektę odpowiedzi, test obejmuje assigned i unassigned. Nie przydzielamy automatycznie FTE.

Plan delete zachowuje istniejącą kaskadę SQL ról; tombstone planu blokuje przyszłe zapisy ról przez scoped parent lookup. Payloady kanonicznych ról pozostają historyczne, bez dopisywania osobnych receipts dzieci. Bezpośredni historyczny odczyt tych agregatów nie dowodzi aktywnej roli po usunięciu planu; to jawny punkt review.

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


### Gate roles i staffing — końcowe mutacje

gateRoles projection red: 4 PASS / 2 FAIL; 6 fullName. `gateRoles-mutation-projection-red.json`.

gateRoles projection green: 6 PASS / 0 FAIL; 6 fullName. `gateRoles-mutation-projection-green.json`.

gateRoles tenant red: 5 PASS / 1 FAIL; 6 fullName. `gateRoles-mutation-tenant-red.json`.

gateRoles tenant green: 6 PASS / 0 FAIL; 6 fullName. `gateRoles-mutation-tenant-green.json`.

gateRoles flag red: 4 PASS / 2 FAIL; 6 fullName. `gateRoles-mutation-flag-red.json`.

gateRoles flag green: 6 PASS / 0 FAIL; 6 fullName. `gateRoles-mutation-flag-green.json`.

staffing projection red: 9 PASS / 7 FAIL; 16 fullName. `staffing-mutation-projection-red.json`.

staffing projection green: 16 PASS / 0 FAIL; 16 fullName. `staffing-mutation-projection-green.json`.

staffing tenant red: 15 PASS / 1 FAIL; 16 fullName. `staffing-mutation-tenant-red.json`.

staffing tenant green: 16 PASS / 0 FAIL; 16 fullName. `staffing-mutation-tenant-green.json`.

staffing flag red: 10 PASS / 6 FAIL; 16 fullName. `staffing-mutation-flag-red.json`.

staffing flag green: 16 PASS / 0 FAIL; 16 fullName. `staffing-mutation-flag-green.json`.

Przywrócenie cp + porównanie bajtowe; skrypty run-gateRoles-mutations.py i run-staffing-mutations.py. Pierwsza próba gate flag była no-op z powodu odstępu w matcherze; skorygowana run-gateRoles-flag.py wykonała rzeczywistą mutację RED, następnie GREEN. Nie liczymy no-op jako dowodu.

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
Początkowe trzy czerwone kontrakty pozostałych writerów są osobnym plikiem. Gate i staffing mają teraz implementację; move pozostaje celowo RED. Finalny mianownik opisano poniżej.

Końcowy mianownik pięciu rodzin: 10 + 6 + 6 + 6 + 16 = 44 wykonań PASS. Dodatkowy osobny test SECURITY-C2B-GAPS: 1 PASS (ta sama nazwa zachowania co w staffing, celowa samodzielna regresja osobnego commitu); razem 45 wykonań / 44 unikalne fullName. Pary mutacyjne porównane osobno per plik: 15 par RED→GREEN, żadne fullName nie znika w parze. Baseline staffing 10 nazw → final16, zniknięte0; gate6→6. Kontrakty pozostałych trzech: baseline 0 PASS / 3 FAIL → final 2 PASS / 1 FAIL (`remaining-contracts-final.json`), te same trzy fullName. Jedyny RED to move404. Czerwony kontrakt move liczymy osobno, nigdy jako PASS produktu.

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

Move STOP/PENDING: wymagana decyzja zakresu przenoszenia i dziedziczenia autoryzacji. Pozostałe pięć rodzin kontynuowane. Lokalna ochrona tenantów budget została autoryzowana przez
integratora jako poprawka bezpieczeństwa w trzech handlerach, bez zmian istniejących
bramek E3 lub globalnego middleware.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

Nie zmierzono staging/demo/produkcji ani przeglądarki/i18nrender. Nie zmierzono równoczesnego retry dwóch procesów ani pełnego korpusu testowego. Move nie ma implementacji; gate/staffing odebrane niezależnie na 2f70a73879. Dowody dotyczą lokalnego ApiGateway/JWT/Postgres, nie gotowości uruchomienia produktu.

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
Manifest SHA256: `SHA256SUMS.txt` (bez dumpa w repo). Trwały handoff: `HANDOFF-ACTIVE.md`.


### SECURITY-C2B-GAPS — osobny wyjątek integratora, 2026-09-12

Root po real RED rozszerzył licencję wyłącznie na GET staffing-plans/:planId/gaps: potwierdzenie planu w organizacji przed odczytem luk; legalny GET bez zmian. Nie zmieniono innych GET ani E3. Bazowy ApiGateway/JWT/PG zwracał foreign 200 z chronioną nazwą roli, missing 200. Osobny staffingGapsSecurity.pg.test.ts: RED 1 FAIL → GREEN 1 PASS, ten sam fullName; legalny GET nadal 200 z nazwą. Artefakty staffing-gaps-security-{red,green}.json/.log w codex2b-artefakty. Bramka używa istniejącego getPlan(planId, orgId); foreign i missing mają identyczne 404. To usunięcie potwierdzonego wycieku, jawny wyjątek od zakazu GET, nie decyzja produktu.


### SECURITY staffing OFF foreign assignee — osobny follow-up

Checkpoint pięciu rodzin: 5ba24436d7. Spotcheck integratora wskazał, że istniejący OFF nadal dopuszcza przypisanie użytkownika z obcej organizacji. Real JWT/PG: POST201 i PUT200, oba zapisują foreign assigned_user_id (`staffing-assignee-red.json`). Lokalna walidacja users.id + organization_id działa teraz przed flagą; nie zmienia globalnego modelu uprawnień. Końcowy test16 zawiera dwa scenariusze OFF oraz kasowanie planu z istniejącą rolą: SQL kaskada, UI getPlan404, brak planu w liście, canonical plan tombstone i historyczny payload roli. Integrator potwierdził, że ten reader UI jest granicą akceptacji; modelu historii nie zmieniono.

Pierwsza próba testu historii miała błędną nazwę kolumny payload zamiast payload_json; naprawiono test, nie jest to błąd produktu. Pierwszy końcowy flag GREEN zakończył się 0 wykonanych / 16 pending po przerwaniu pracy; kod był odtworzony bajtowo. Powtórzono wyłącznie brakujący GREEN, bez ponawiania zakończonych par projection/tenant. Wszystkie 3 końcowe pary staffing mają identyczne 16 fullName.


### Review follow-up — parent scope przed replay roli/capacity

Review 5ba24436d7 wskazał, że sam historyczny payload roli i tombstone planu nie zapobiegają odtworzeniu receipt roli po usunięciu planu. Dwa osobne rzeczywiste testy: native po canonical DELETE oraz legacy ON replay po DELETE z flagą OFF, oba RED200 przy SQL0 → GREEN404 przy SQL0. Pliki `staffing-parent-replay-{red,green}.json`, po 2 identyczne fullName.

Nowa metoda lockStaffingParentScope czyta plan i inicjatywę w organizacji z FOR UPDATE. Dla role/capacity writeStaffing wykonuje tę walidację przed executeMaterialCommand, współdzieląc tę samą transakcję przez adapter UnitOfWork. Blokada trwa przez odczyt receipt i ewentualny zapis, nie jest rozdzielonym preflight. Istniejący writer ponownie chroni projekcję; model historii i istniejący materialCommand niezmienione. Po zmianie pełny staffing16 ponownie GREEN (`staffing-final-after-replay.json`) oraz backend tsc0. Wcześniejsze 3 mutationpary staffing dotyczą checkpointu ef0898f43d; dodatkową granicę pokrywa real RED2→GREEN2, nie deklarujemy ponownego wykonania starych mutacji po tej zmianie.

Łączny dodatni dowód pięciu rodzin i dwóch osobnych regresji: 47 wykonań PASS / 46 unikalnych fullName (jedno powtórzenie to samodzielny test GET gaps). Move pozostaje oddzielnym celowym RED; nie ma nowej decyzji o przenoszeniu dostępu. K7: nadal 5 nowych metod projekcyjnych + dodatkowy read/lock helper, nie szósty writer.


### Niezależny odbiór końcowy

Delivery_audit odczytał dokładny kod 2f70a7387939c1b0c6ababc4f4332a52a9e05b93 i wydał ACCEPT dla pięciu rodzin oraz lokalnego security. Potwierdził, że adapter współdzieli scopeTx bez drugiego BEGIN/COMMIT, waliduje parent organization przed receipt i zachowuje guard OFF przed flagą. Sprawdził 16 identycznych fullName mutacji staffing i uczciwy zakres wcześniejszych par, a także RED2→GREEN2 replay. Historia dzieci zaakceptowana zgodnie z decyzją integratora i testem rzeczywistego UI. Brak nowego blockera. Osobnego równoczesnego DELETE/replay runtime proof nie wykonano — blokada transakcyjna jest zweryfikowana źródłowo, nie próbą dwóch równoległych klientów. Ten końcowy commit zmienia wyłącznie raport; kod pozostaje dokładnie odebrany.
