# Realizacja — nośniki decyzji E-O3/E-O4/E-O5 — raport dyżuru 33, 2026-08-28

Gałąź dyżuru: `codex/policy-carriers-day33-20260828`
Gałąź naprawcza (ten raport): `day33-fixes-20260828`, odbita od `6838cd1402`
Marker bazowy dyżuru: `87e7cecf3a` (`MARKER OK`)
Worktree dyżuru: `/private/tmp/consultify-carriers` · worktree naprawczy: `/private/tmp/fix-day33`
Realny PostgreSQL dyżuru: `cx-day33-pg`, port `5597`, baza `cx_day33`
Realny PostgreSQL rundy naprawczej: `cx-fix33-pg`, port `5802`, bazy `cx_fix33` (gałąź) i `cx_fix33_base` (baseline)

> **Status dokumentu.** Raport końcowy dyżuru został po odbiorze adwersaryjnym
> uzupełniony o sekcje, które raport częściowy (`e8b0e99e49`) już zawierał, a raport
> końcowy (`6838cd1402`) skasował, oraz o osiem pozycji naprawczych `FIX-1…FIX-8`.
> Sekcje pochodzące z rundy naprawczej są oznaczone.

---

## Werdykt

P.1–P.12 oraz R.1/R.2 wykonano. **P.9 nie jest już `STOP`** — odbiór wykazał, że
zatrzymanie było niezasadne, a pozycja została wznowiona i dowieziona (patrz `FIX-6`).

Dyżur dowodzi, że wartości E-O4/E-O5 są wpisywalnymi i odczytywalnymi danymi polityki,
perspektywa celu jest deklaracją człowieka, a brak wiarygodnego źródła dostępności daje
`UNKNOWN`, nigdy wyliczony procent.

Nie zmieniono `src/**`, `inferPerspective` ani `server/src/services/results/**`.
Nie wykonano push, stash, seeda, Railway ani `docker volume prune`.

---

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie zmieniono `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani przez `git`.
Jedyny kontakt z tym katalogiem to **symlink `node_modules` używany wyłącznie do odczytu**,
dopuszczony przez `DEC-86`. Runda naprawcza pracowała w `/private/tmp/fix-day33`, z
`node_modules` dowiązanym do `/private/tmp/consultify-carriers` (worktree tego samego dyżuru).

## Dowód celu połączenia (Z25/Z26)

Kontener rundy naprawczej:

```
docker run -d --name cx-fix33-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=cx_fix33 -p 127.0.0.1:5802:5432 pgvector/pgvector:pg17
```

```
$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "SELECT current_database(), inet_server_port();"
 current_database | inet_server_port
------------------+------------------
 cx_fix33         |
(1 row)
```

`inet_server_port()` jest pusty, bo połączenie `psql` wewnątrz kontenera idzie przez gniazdo
uniksowe, nie TCP. Port publikowany na hoście to `127.0.0.1:5802` (widoczny w `docker run -p`
powyżej i w `docker ps`). Testy z hosta łączą się przez `postgresql://postgres:postgres@127.0.0.1:5802/…`.

**Każdy przebieg DB miał w tej samej linii komendy `DATABASE_URL`, `RUN_DB_TESTS=1`
i `MOCK_DB=false`** (dla tras dodatkowo `NODE_ENV=test` i `ENABLE_V8_GLOBAL=true`).
`NODE_ENV=test` jest konieczne, bo `server/src/config/databaseTargetResolver.ts:138-142`
odrzuca host lokalny poza testem.

## ★★ Bramka wejściowa — dyżur 31 pozycja B.7

```
$ grep -rn "execution_control_kpi_policies" server/src | head -8
server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:468:      `INSERT INTO execution_control_kpi_policies
server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:483:      `UPDATE execution_control_kpi_policies
server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts:103:      'execution_control_kpi_policies',
server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts:170:         (SELECT COUNT(*)::int FROM execution_control_kpi_policies
server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts:172:         (SELECT row_version FROM execution_control_kpi_policies
server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts:211:           FROM execution_control_kpi_policies p
server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts:240:          (SELECT COUNT(*)::int FROM execution_control_kpi_policies WHERE policy_id=$1) policies`,
server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts:268:        `SELECT COUNT(*)::int count FROM execution_control_kpi_policies
```

**Werdykt: B.7 SCALONY.** Kanoniczna komenda zapisu polityki (CAS na `row_version`,
idempotencja, audyt w transakcji) żyje w `postgresMaterialCommandUnitOfWork.ts:468-493`
i jest dostępna z zamontowanego routera. Dyżur 33 nie buduje jej drugi raz.

**Bramka behawioralna, przebieg w rundzie naprawczej na własnym PG (`cx_fix33`):**
`server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts` — **8/8 PASS**.
Cztery odpowiedzi bramki potwierdzone zachowaniem tych testów:

| Odpowiedź bramki | Test | Wynik |
| --- | --- | --- |
| polityka niekompletna → rodziny zależne `DECISION_REQUIRED` | `persists an incomplete policy and keeps dependent families decision-required` | PASS |
| CAS + audyt + wiersz polityki w jednej transakcji | `keeps CAS, audit and the policy row in one transaction` | PASS |
| powtórzone żądanie → idempotentny replay, nowe żądanie → obie wersje w górę | `replays idempotently and advances both versions on a new request` | PASS |
| walidacja strukturalna → rollback bez śladu polityki i audytu | `rolls structural validation back without policy or audit residue` | PASS |

*Uczciwe zastrzeżenie:* to są przebiegi z **rundy naprawczej**, wykonane teraz. Ciał
odpowiedzi HTTP z oryginalnego przebiegu dyżuru nie da się już odtworzyć — nie zostały
zapisane. Nie przepisuję ich z pamięci ani nie zmyślam.

## ★ Inwentarz konsumentów w `src/`

| Koperta / metoda | Konsument w `src/**` | Werdykt |
| --- | --- | --- |
| `GET /api/initiatives/runtime-v1/control-kpis` (P.2, P.6, P.7, P.9, P.10) | **BRAK** — grep nie pokazuje żadnego wołacza w `src/` | ostatnim ogniwem jest koperta HTTP |
| `Api.goalsGetRollup` → `GET /initiatives-v4/goals/:id/rollup` | `src/components/Results/ResultsScorecardsTable.tsx:76` (czyta `rollupProgress`, `linkedInitiatives`) | REALNY konsument |
| `Api.goalsGetInitiatives` → `GET /initiatives-v4/goals/:goalId/initiatives` | **BRAK** — dwa wystąpienia to definicja (`src/services/api.ts:21204`) i komentarz (`src/contracts/tableSurface/surfaceRegister.ts:703`) | brak konsumenta |
| `Api.goalsLinkInitiative` → `POST /initiatives-v4/goals/:goalId/initiatives` | **BRAK** — jak wyżej | brak konsumenta |
| `POST /api/initiatives/runtime-v1/goals/:goalId/perspective` (P.5) | **BRAK** — ekran przypisania perspektyw nie istnieje | ekran zbuduje dyżur frontowy |

**Konsekwencja, zapisana wprost:** dla większości pozycji tego dyżuru ostatnim ogniwem
dowodu osiągalności jest **koperta HTTP**, nie ekran. Nie dopisano konsumenta frontowego,
żeby ogniwo „domknąć" (`Z19`), i nie przemilczano jego braku.

---

## Pozycje i commity

| Pozycja | Status | Commit | Dowód |
| --- | --- | --- | --- |
| P.1 | ZROBIONE_WG_DoD | `cb79d43796` | nośnik: `execution_control_kpi_policies.parameters` |
| P.2 | ZROBIONE_WG_DoD | `d82c5cc05b` | walidacja pięciu grup parametrów; bez defaultów |
| P.3 | ZROBIONE_WG_DoD | `aaa32f4e79` | dwie firmy zapisują i odczytują własne liczby |
| P.4 | ZROBIONE_WG_DoD | `edc04bea29` | migracja `20261220`; nullowalna perspektywa |
| P.5 | ZROBIONE_WG_DoD | `947ed37580` | komenda przypisania/wyczyszczenia, CAS, replay, audyt |
| P.6 | ZROBIONE_WG_DoD | `a557bf3cbf` + tabela niżej (`FIX-8`) | read-model „Ład i jakość danych" |
| P.7 | ZROBIONE_WG_DoD | `8ff0c2db1c` | klasa raportu z realnego pokrycia |
| P.8c | ZROBIONE_WG_DoD | `fffba8a8bd`, `3e936d7f8f` (`FIX-1`) | najpierw izolacja `goal_initiative_links` |
| P.8d | ZROBIONE_WG_DoD | `2597fed3ce`, `dc3389dd4e` (`FIX-2`,`FIX-3`) | klasa wkładu i waga z polityki |
| **P.9** | **ZROBIONE_WG_DoD** (było `STOP`) | `4d66fda460` (`FIX-6`) | wkład liczbowy wariantu C w kopercie, addytywnie |
| P.10 | ZROBIONE_WG_DoD | `5660d1397f`, `c45ea710af` (`FIX-7`) | pasma/bufor; brak źródła daje `UNKNOWN` |
| P.11 | ZROBIONE_WG_DoD | `e6494c8527` + dowody niżej (`FIX-8`) | inwentarz dostępności |
| P.12 | ZROBIONE_WG_DoD | `474b0db653` + uzupełnienie (`FIX-8`) | kontrakt frontu, 11 punktów |
| R.1 | ZROBIONE_WG_DoD | `a67444d5ae` | `MODULE_ACCEPTANCE.md` |
| R.2 | ZROBIONE_WG_DoD | commit tego raportu | pełny stan i dowody |

### Commity rundy naprawczej (gałąź `day33-fixes-20260828`)

| SHA | Zakres |
| --- | --- |
| `3e936d7f8f` | FIX-1 — dwa testy izolacji cross-org podniesione do kontraktu `null`/404 |
| `7e9ffcccef` | FIX-5 — bramka Z25/Z26 fail-closed w plikach PG |
| `dc3389dd4e` | FIX-2 + FIX-3 — waga wkładu i stempel polityki |
| `8fad6fe21a` | FIX-4 — obcy cel bez nagłówka organizacji → 404 |
| `c45ea710af` | FIX-7 — usunięty martwy klasyfikator pasm; koniec trzeciego słownika |
| `4d66fda460` | FIX-6 — P.9 wznowione; wkład liczbowy wariantu C |
| `5c2619549f` | FIX-5 (uzupełnienie) — trzeci zamek Z25 bez dotykania `tests/setup.ts` (Z20) |

---

## E-O3 — pięć perspektyw

`goals.perspective` przyjmuje `financial`, `customer`, `process`, `learning`,
`governance_data_quality` albo `NULL`; nie ma defaultu ani backfillu.
`POST /api/initiatives/runtime-v1/goals/:goalId/perspective` zapisuje deklarację człowieka
z CAS, idempotencją i audytem. `null` świadomie czyści przypisanie. Nie użyto ani nie
rozszerzono `inferPerspective`.

`governanceDataQuality` zwraca osobno liczniki, mianowniki i identyfikatory brakujących
właścicieli oraz terminów. Dowód zadań jest liczony z realnego nośnika; dowód decyzji
pozostaje `UNKNOWN / DECISION_EVIDENCE_CARRIER_UNAVAILABLE`.

Raport jest `STRATEGIC` wyłącznie, gdy każde zobowiązanie w zakresie prowadzi przez cel do
jawnie zadeklarowanej perspektywy. Inaczej, także dla pustego zakresu, jest `OPERATIONAL`;
odpowiedź podaje liczniki uzasadniające klasyfikację.

## E-O4 — trzy klasy i opcjonalna liczba

Link cel–inicjatywa jest tenantowy przez `organization_id`; backfill migracji `20261221`
dotyka tylko wierszy z `NULL`, a odczyty dodatkowo sprawdzają organizację inicjatywy.
Dopiero po tej naprawie dodano `contribution_class`.

Klasy `CRITICAL`, `IMPORTANT`, `SUPPORTING` zatwierdza właściciel celu. Jeśli polityka
zawiera `impactWeights`, liczba zostaje skopiowana i zamrożona z `policyId` i `rowVersion`.
Bez rozstrzygniętej polityki klasa zapisuje się z `DECISION_REQUIRED`, **a kolumna
`contribution_weight` NIE JEST ZAPISYWANA W OGÓLE** (`FIX-2`).

Progi ryzyka i SLA są wyłącznie danymi polityki. Liczby w testach są fixture'ami, nie
defaultami, seedem ani fallbackiem.

## E-O5 — pasma, bufor i „nie wiem"

Pasma i bufor są wyłącznie danymi polityki per organizacja; test dwóch organizacji dowodzi
niezależnych wartości. Dopóki nie istnieją źródła nieobecności, stałych obowiązków
i zaakceptowanych rezerwacji, read-model zwraca `knowledgeState: UNKNOWN`,
`valueReason: AVAILABILITY_SOURCE_UNAVAILABLE`, `saturationRange: null` oraz brakujące
`ABSENCE`, `FIXED_DUTIES`, `ACCEPTED_RESERVATIONS`. Nie generuje procentu z dostępności
nominalnej ani z samego bufora.

---

## Tabele werdyktów

### P.6 — piąta warstwa: co jest „zobowiązaniem" i skąd (uzupełnienie `FIX-8`)

| Rodzaj zobowiązania | Tabela | Kolumna właściciela | Kolumna terminu | Nośnik dowodu | Licznik/mianownik | `UNKNOWN`? |
| --- | --- | --- | --- | --- | --- | --- |
| Zadanie wykonawcze | `ie_aggregate_state` (`aggregate_type='execution_task'`) — `\d ie_aggregate_state`: PK `(organization_id, aggregate_type, aggregate_id)`, `payload_json jsonb NOT NULL` | `payload_json->>'ownerId'` (`governanceDataQualityReadModel.ts:36`) | `payload_json->>'dueAt'` (`:43`) | `payload_json->'evidenceRefs'` (`:49-50`) | brak właściciela / wszystkie · brak terminu / wszystkie · brak dowodu / **zadania** (`:58-61`) | NIE — wymiar `KNOWN` |
| Decyzja wykonawcza | `ie_aggregate_state` (`aggregate_type='execution_decision'`) | `payload_json->>'authorityId'` (`:37`) | `payload_json->>'dueAt'` (`:43`) | **BRAK NOŚNIKA** | licznik `null`, mianownik `null`, `ids: null` (`:62-68`) | **TAK** — `UNKNOWN`, powód `DECISION_EVIDENCE_CARRIER_UNAVAILABLE` |

**Dlaczego `payload_json.evidenceRefs`, a nie wskazany w instrukcji
`execution_delivery_evidence` — uzasadnienie wyboru (`FIX-8`).**
`execution_delivery_evidence` **istnieje** na świeżym PG, ale nie jest nośnikiem dowodu
dla *zobowiązania*. Jej klucz obcy to `execution_link_id → execution_case_links(link_id)`
(`server/migrations/20260908_execution_bvp_spine.sql:26-31`), a `execution_case_links` jest
unikalne per `(organization_id, initiative_id)` i per `(organization_id, case_id)`
(tamże `:21-23`). Dowód wisi więc na **parze inicjatywa↔sprawa**, nie na zadaniu ani na
decyzji. Nie ma w tej tabeli żadnej kolumny, po której dałoby się zapytać „czy TO zadanie
ma dowód" — brak `task_id`/`decision_id`/`aggregate_id`. `\d execution_delivery_evidence`
z bazy `cx_fix33` potwierdza komplet kolumn: `evidence_id`, `organization_id`,
`execution_link_id`, `artifact_link_id`, `artifact_revision`, `content_digest`,
`approval_status`, `submitted_by`, `approved_by`, `approved_at`, `idempotency_key`,
`version`, `created_at`, `updated_at` — i ani jednego odsyłacza do zobowiązania.
Wybór `payload_json.evidenceRefs` jest więc **poprawny i pozostaje**, ale musiał być
nazwany, a nie milcząco podmieniony. **Otwarta rekomendacja:** jeżeli dowód dostarczenia
ma kiedyś odpowiadać per zobowiązanie, `execution_delivery_evidence` potrzebuje kolumny
odsyłającej do agregatu — to jest decyzja architektoniczna, nie zadanie tego dyżuru.

### P.8c — izolacja `goal_initiative_links`

| Element | Stan |
| --- | --- |
| `\d` PO migracji `20261221` | `organization_id TEXT`, `contribution_class TEXT` (CHECK: `CRITICAL`/`IMPORTANT`/`SUPPORTING` lub NULL), `contribution_policy_id TEXT`, `contribution_policy_row_version INTEGER`, indeks `idx_goal_initiative_links_org_goal (organization_id, goal_id)` |
| Backfill | `UPDATE … SET organization_id = i.organization_id FROM initiatives i WHERE i.id = gil.initiative_id AND gil.organization_id IS NULL` — dotyka wyłącznie `NULL` |
| Strażnik `initiative-governance-goal-rollup-tenant.routes.test.ts` | **6/6 PASS** na gałęzi naprawczej |
| Dowód 404 dla obcego | `day33.goal-links-tenant.pg.test.ts` — `returns 404 and no links…`, `returns 404 and no numbers…` (obie PASS) |
| **Otwarte** | `organization_id` pozostaje **nullowalne** — `NOT NULL` wymaga osobnej decyzji i przebiegu na danych zastanych |

### P.8d — klasa wkładu (po `FIX-2` / `FIX-3`)

| Klasa | Waga wyliczona z | Zamrożona? | Bez polityki → co | Sprzeczność z liczbą legacy |
| --- | --- | --- | --- | --- |
| `CRITICAL` / `IMPORTANT` / `SUPPORTING` | `policy.parameters.impactWeights[klasa]` | TAK — razem z `contribution_policy_id` i `contribution_policy_row_version`; zmiana polityki nie odmraża istniejącego wiersza | `contributionWeight: null`, `valueReason: DECISION_REQUIRED`, `missingParameters: ['impactWeights']`, **kolumna `contribution_weight` w ogóle niezapisana** | `400 CONTRIBUTION_CLASS_WEIGHT_CONFLICT` — w obie strony: klasa+liczba w jednym żądaniu ORAZ liczba legacy na wierszu, który już niesie klasę |

### P.9 — wariant C `E-O4` (pozycja wznowiona, `FIX-6`)

| Mechanika (plik:linia) | Udostępniona addytywnie? | Czego brakuje | Współistnienie z klasą |
| --- | --- | --- | --- |
| `rvn_kpi_initiative_impacts` — `expected_contribution_value` + `expected_contribution_direction` (`20260813_rvn_kpi_initiative_impacts.sql:26-27`); zamrożona baza `baseline_value_at_commitment` / `baseline_measurement_id` / `baseline_period_end` (`:33-35`) chroniona triggerem `trg_rvn_kpi_initiative_impacts_protect_baseline` (`:64-86`); rozliczenie `reviewed_attribution_value` + `review_rationale` (`:40-42`); cykl `status` (`:23-24`); `row_version` (`:49`) | **TAK.** Nowy czytnik `server/src/services/executionControl/numericContributionReadModel.ts` — czysty `SELECT` po `(organization_id, initiative_id)` i `status='committed'`, **bez JOIN-a do treści inicjatywy**. Pole `goalInitiativeContributions` w kopercie `/control-kpis`. **Zero znaków w `server/src/services/results/**`** | Nic nie brakuje. Seam jest dedykowany: `CREATE INDEX idx_rvn_kpi_initiative_impacts_initiative ON (organization_id, initiative_id)` (`:57-58`), a projekt tabeli ten odczyt **antycypuje** — komentarz `:9-14` | **Wkład liczbowy ma pierwszeństwo w PREZENTACJI, klasa zostaje jako deklaracja, oba są widoczne.** Rekomendacja nadzorcy przyjęta bez zmian |

**`\d rvn_kpi_initiative_impacts` z bazy `cx_fix33` — istotne kolumny i indeksy:**

```
 impact_id                           | uuid       | not null | gen_random_uuid()
 organization_id                     | text       | not null |
 kpi_id                              | uuid       | not null |
 initiative_id                       | text       | not null |
 status                              | text       | not null | 'proposed'::text
 expected_contribution_value         | numeric    |          |
 expected_contribution_direction     | text       |          |
 baseline_value_at_commitment        | numeric    |          |
 reviewed_attribution_value          | numeric    |          |
 row_version                         | integer    | not null | 1
Indexes:
    "idx_rvn_kpi_initiative_impacts_initiative" btree (organization_id, initiative_id)
    "idx_rvn_kpi_initiative_impacts_kpi" btree (kpi_id, status)
    "ux_rvn_kpi_initiative_impacts_one_active" UNIQUE, btree (kpi_id, initiative_id)
        WHERE status = ANY (ARRAY['proposed','committed'])
Check constraints:
    status IN ('proposed','committed','superseded','realized_reviewed','cancelled')
    expected_contribution_direction IN ('increase','decrease')
```

**Rozstrzygnięcie P.9 pkt 4 — co, gdy dla jednej pary cel↔inicjatywa istnieje
JEDNOCZEŚNIE klasa 3-stopniowa i zatwierdzony wkład liczbowy.**
Rekomendację nadzorcy **przyjmuję**. Uzasadnienie, dlaczego nie da się zrobić inaczej
uczciwie: to są **dwa różne akty człowieka**, nie dwie wersje tej samej liczby. Klasa jest
deklaracją ważności zatwierdzoną przez **właściciela celu** i mówi „ta inicjatywa jest dla
tego celu krytyczna". Wkład liczbowy jest obietnicą **w jednostce miary KPI**, z zamrożoną
bazą i osobnym rozliczeniem, zatwierdzoną w cyklu `proposed → committed`. Ciche nadpisanie
jednego przez drugie skasowałoby akt, którego system nie ma prawa cofnąć w cudzym imieniu.
Realizacja w kopercie: pole `presentationPrecedence` przyjmuje `NUMERIC_CONTRIBUTION`
(gdy istnieje zatwierdzony wkład), `CONTRIBUTION_CLASS` (gdy jest sama klasa) albo `NONE`;
`contributionClass` i `numericContributions` są **zawsze oba w odpowiedzi**.
Uwaga na wielokrotność: unikalny indeks częściowy jest na `(kpi_id, initiative_id)`, więc
jedna inicjatywa może mieć **kilka** zatwierdzonych wkładów — po jednym na KPI. Dlatego
pole jest listą, nie pojedynczym obiektem.

### P.10 — moc ludzi

| Składnik dostępności | Znany systemowi? | Co zwraca rodzina `capacity` | Dowód, że NIE procent |
| --- | --- | --- | --- |
| Nieobecności | NIE | `knowledgeState: UNKNOWN`, `valueReason: AVAILABILITY_SOURCE_UNAVAILABLE`, `saturationRange: null` | `capacitySaturationReadModel.ts` nie zawiera ani jednego działania arytmetycznego na dostępności |
| Stałe obowiązki | NIE (tylko `working_hours_json`, `dnd_hours_json` — nie rejestr) | j.w., `missingAvailabilityComponents` zawiera `FIXED_DUTIES` | j.w. |
| Zaakceptowane rezerwacje | NIE | j.w., `missingAvailabilityComponents` zawiera `ACCEPTED_RESERVATIONS` | j.w. |
| Bufor | TAK — `execution_control_kpi_policies.parameters.capacityBuffer` | `configuredPolicy.capacityBuffer` przenoszony bez zmiany, `bufferApplication: SUBTRACT_FROM_AVAILABILITY_BEFORE_SATURATION` | bufor sam z siebie **nie** generuje wysycenia |

**`FIX-7`:** `classifyCapacityBand` **usunięto** — miała zero wołaczy produkcyjnych, a trzy
z sześciu testów P.10 badały kod nieosiągalny. `KnowledgeState` i `CapacityRange` są teraz
**importowane** z `server/src/domain/initiatives-execution/capacityScenario.ts:10-22`,
a nie przepisywane (§P.10.b pkt 4 — zakaz trzeciego słownika).

### P.11 — inwentarz dostępności (dosłowne wyniki, `FIX-8`)

```
$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "\dt user_out_of_office"
Did not find any relation named "user_out_of_office".

$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "\dt user_availability"
               List of relations
 Schema |       Name        | Type  |  Owner
--------+-------------------+-------+----------
 public | user_availability | table | postgres
(1 row)

$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "\d user_availability"
       Column       |            Type             | Nullable |      Default
--------------------+-----------------------------+----------+-------------------
 id                 | text                        | not null |
 user_id            | text                        | not null |
 status_message     | text                        |          |
 working_hours_json | text                        |          | '{}'::text
 dnd_hours_json     | text                        |          | '{}'::text
 created_at         | timestamp without time zone |          | CURRENT_TIMESTAMP
 updated_at         | timestamp without time zone |          | CURRENT_TIMESTAMP
 settings           | text                        |          |

$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "\d users" | grep -E "out_of_office|vacation"
 out_of_office                    | integer                     |          | 0
 vacation_end                     | timestamp without time zone |          |
 out_of_office_message            | text                        |          |

$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "\dt *reservation*"
                     List of relations
 Schema |              Name              | Type  |  Owner
--------+--------------------------------+-------+----------
 public | v8_agent_resource_reservations | table | postgres
(1 row)

$ docker exec cx-fix33-pg psql -U postgres -d cx_fix33 -c "\dt *absence*"
Did not find any relation named "*absence*".
```

| Składnik (`MODULE_ACCEPTANCE.md:244`) | Kandydat w schemacie | Istnieje na PG? | Werdykt | Pytanie do właściciela |
| --- | --- | --- | --- | --- |
| Nieobecności | `users.out_of_office`, `users.vacation_end`, `users.out_of_office_message` | TAK, ale to **przełącznik**, nie kalendarz: brak daty początku, brak historii, brak godzin, brak `organization_id`, jeden okres na użytkownika | `ZBUDUJ_OD_ZERA` | Kształt: `(organization_id, user_id, start_date, end_date, all_day, reason)`. **Kto wprowadza — HR, konsultant, czy integracja z kalendarzem? I czy `reason` jest danymi wrażliwymi w rozumieniu RODO?** |
| Stałe obowiązki | `user_availability.working_hours_json`, `dnd_hours_json` | TAK, ale to godziny pracy i DND, **nie rejestr obowiązków**; brak `organization_id`; `settings` obok `working_hours_json` = dwa kształty tej samej tabeli | `PODŁĄCZ_PO_NAPRAWIE` | Kto jest właścicielem definicji stałych obowiązków — konsultant per projekt czy administrator per organizacja? |
| Zaakceptowane rezerwacje | `v8_agent_resource_reservations` — rezerwacje **narzędzi dla agentów AI** (`run_id`, `agent_id`, `tool_name`, `policy_id`), nie czasu ludzi | Tabela istnieje, ale **nie jest tym nośnikiem** | `ZBUDUJ_OD_ZERA` | Kształt: `(organization_id, user_id, from, to, initiative_id, status)`. **Kto zatwierdza rezerwację czasu człowieka?** |
| Bufor | `execution_control_kpi_policies.parameters.capacityBuffer` | TAK | `PODŁĄCZ` | — (podłączone) |

**Odpowiedź na pytanie nadzorcy — jedno zdanie:** w schemacie **nie ma żadnego źródła
nieobecności** nadającego się do liczenia dostępności; jedyne, co istnieje, to osobisty
przełącznik „jestem nieobecny do dnia X" na `users`, bez daty początku, bez historii i bez
powiązania z organizacją.

**Znalezisko obowiązkowe (§P.11 pkt 5) — migracje o numerze `< 500` są cicho pomijane
na Postgresie.** Dowód, `server/scripts/migrate.postgres.ts:264-269`:

```ts
  // Canonical flow for Postgres uses the core baseline + modern incremental migrations.
  // Older pre-baseline fragments (<500) are often SQLite-first and conflict with baseline.
  if (Number.isFinite(versionNum) && versionNum > 0 && versionNum < 500) {
    if (!f.startsWith('000_z_core_baseline')) return true;
  }
```

Skutek praktyczny: `server/migrations/129_user_availability.sql:25-38` tworzy
`user_out_of_office` (`start_date`, `end_date`, `reason`, `is_all_day`) — czyli **dokładnie
ten kalendarz nieobecności, którego brakuje** — ale numer `129 < 500`, więc runner ten plik
pomija **bez ostrzeżenia** i tabela na PG nie istnieje (potwierdzone `\dt` wyżej). Do tego
plik jest SQLite-owy (`DATETIME`, `BOOLEAN DEFAULT 1`, inline `FOREIGN KEY`), więc jego
uruchomienie i tak wymagałoby przepisania. Znalezisko jest **szersze niż ta pozycja i nie
zostało naprawione** — część historycznego schematu, którą `DatabaseInitializer` uważa za
krytyczną, na PG po prostu nie istnieje.

---

## ★ Kontrakt dla frontu (P.12) — jedenaście punktów

Front nie był w zakresie i niczego nie pokazano użytkownikowi.

### A. Ekran polityki progów (dla konsultanta)

**1. Pełna lista parametrów.** Źródło prawdy:
`server/src/services/executionControl/controlKpiPolicySchema.ts:3-9` i `:31-103`.

| Nazwa techniczna | Nazwa po polsku | Typ | Walidacja strukturalna (kod reguły) | Jednostka | Co się psuje, gdy brakuje |
| --- | --- | --- | --- | --- | --- |
| `impactWeights` | Wagi klas wkładu | obiekt `{CRITICAL, IMPORTANT, SUPPORTING}` | `EXACT_CONTRIBUTION_CLASSES` (dokładnie te trzy klucze), `POSITIVE_FINITE_WEIGHTS` (każda liczba skończona i `> 0`) | mnożnik, bezwymiarowy | rodzina `initiative-risk` → `DECISION_REQUIRED`; klasa wkładu zapisuje się **bez wagi**, z `valueReason: DECISION_REQUIRED` |
| `atRiskThresholdDays` | Próg „zagrożone" | liczba całkowita | `POSITIVE_INTEGER` (całkowita, `> 0`) | dni | rodzina `initiative-risk` → `DECISION_REQUIRED` |
| `decisionSlaDays` | SLA decyzji | obiekt `{value, unit}` | `POSITIVE_INTEGER_VALUE`, `EXPLICIT_DAY_UNIT` (`BUSINESS_DAYS` \| `CALENDAR_DAYS`) | dni robocze albo kalendarzowe — **jawnie** | rodzina `decision-latency` → `DECISION_REQUIRED` |
| `capacitySaturationThreshold` | Progi pasm wysycenia | obiekt `{normalUpper, saturatedUpper}` | `FINITE_BAND_LIMITS`, `STRICTLY_INCREASING_FRACTIONS` (`normalUpper > 0`, `saturatedUpper ≤ 1`, `normalUpper < saturatedUpper`) | ułamek `(0,1]` | rodzina `capacity` → `DECISION_REQUIRED`, `saturationRange: null` |
| `capacityBuffer` | Bufor mocy | liczba | `FRACTION_ZERO_INCLUSIVE_ONE_EXCLUSIVE` (`0 ≤ x < 1`) | ułamek `[0,1)` | rodzina `capacity` → `DECISION_REQUIRED` |

**2. Wartości początkowe z `DEC-169` — TREŚĆ PODPOWIEDZI, nie default systemu.**
Ekran ma zaproponować: `atRiskThresholdDays` = **7 dni**; `decisionSlaDays` =
**5 dni roboczych** (`{value: 5, unit: 'BUSINESS_DAYS'}`); `capacitySaturationThreshold` =
**80 % / 95 %** (`{normalUpper: 0.8, saturatedUpper: 0.95}`); `capacityBuffer` =
**15 %** (`0.15`); `impactWeights` = trzy klasy `CRITICAL` / `IMPORTANT` / `SUPPORTING`.
**To NIE są wartości domyślne systemu. Pole startuje puste. Dopóki konsultant nie wpisze,
raport mówi `DECISION_REQUIRED`.** W kodzie produkcyjnym i w migracjach nie ma żadnej
z tych liczb — migracja polityki mówi wprost „No default policy is seeded".

**3. Kształt koperty zapisu i odczytu.**
Zapis: `POST` z `expectedVersion`, `clientRequestId`, `name`, `parameters`.
Odpowiedzi: `201` (nowa wersja), `200` (idempotentny replay tego samego `clientRequestId`),
`409 VERSION_OR_IDEMPOTENCY_CONFLICT` z `expectedVersion` i `currentVersion` — ekran wtedy
**przeładowuje aktualną wersję i pokazuje różnicę**, nigdy nie ponawia po cichu;
`400 COMMAND_VALIDATION_FAILED` przy błędzie strukturalnym.
Odczyt (`GET /api/initiatives/runtime-v1/control-kpis?weekStart=…`): pole `policy` z
`policyId`, `resolved`, `missingParameters`, `invalidParameters`.
`invalidParameters[]` niesie `{parameter, rule, message: {en, pl}}` — ekran pokazuje
`message.pl` przy konkretnym polu, nie zbiorczy komunikat.

**4. Polityka niekompletna — mapa zależności rodzin.**
Źródło: `server/src/services/executionControl/controlKpiReadModel.ts:23-27`.

| Rodzina | Wymaga parametrów | Bez nich |
| --- | --- | --- |
| `initiative-risk` | `impactWeights`, `atRiskThresholdDays` | `value: null`, `valueReason: DECISION_REQUIRED`, `valueClass: UNKNOWN`, `scopeCompleteness: NOT_CALCULABLE` |
| `capacity` | `capacitySaturationThreshold`, `capacityBuffer` | j.w. + `saturationRange: null` |
| `decision-latency` | `decisionSlaDays` | j.w. |
| `plan-delivery`, `blocked-work`, `milestone`, `dependency`, `intervention-effectiveness` | — | liczą się bez polityki; przy pustej populacji `valueReason: BRAK_ŹRÓDŁA` |

Ekran ma pokazać listę `missingParameters` **i obok niej nazwy rodzin, które przez to nie
liczą się w ogóle** — inaczej konsultant nie wie, co kupuje za wpisanie liczby.

### B. Ekran przypisania cel → perspektywa

**5. Pięć wartości — nazwa techniczna + nazwa po polsku.**

| Techniczna | Polska |
| --- | --- |
| `financial` | Finansowa |
| `customer` | Klient |
| `process` | Procesy wewnętrzne |
| `learning` | Uczenie się i rozwój |
| `governance_data_quality` | Ład i jakość danych |

Cztery pierwsze to kanoniczne perspektywy BSC (`server/src/services/results/balancedScorecardService.ts`);
piąta jest równorzędna i pochodzi z `DEC-169`.

**6. `NULL` jest stanem, nie błędem.** Cel bez przypisania czyta się jako
`perspective: 'UNASSIGNED'`, `sourceClass: null`. Ekran musi umieć pokazać „nieprzypisana"
**i musi umieć wyczyścić** przypisanie — `perspective: null` w żądaniu jest świadomym
czyszczeniem, nie brakiem pola.

**7. Podpowiedzi NIE MA.** Nie zbudowano żadnej heurystyki podpowiadającej perspektywę;
`inferPerspective` nie został ani użyty, ani rozszerzony. **Przypisanie jest w całości
ręczne.** Gdyby kiedyś powstała podpowiedź, musi być oznaczona jako `INFERENCE` i wymagać
potwierdzenia człowieka — ekran nie ma prawa zapisać jej automatycznie.

**8. Klasa raportu.** Pole `reportClassification` z `reportClass` (`STRATEGIC` /
`OPERATIONAL`) i `reason` zawierającym `criterion:
'EVERY_COMMITMENT_MAPS_TO_A_HUMAN_DECLARED_PERSPECTIVE'`, `commitmentCount`,
`mappedCommitmentCount`, `mappedToDeclaredPerspectiveCount`, `goalCount`,
`assignedGoalCount`. Ekran wyświetla powód liczbami: „raport operacyjny, bo `X` z `Y`
zobowiązań prowadzi do celu z zadeklarowaną perspektywą".

**9. Skala wkładu.** Trzy klasy; zatwierdza **właściciel celu** (`403
GOAL_OWNER_APPROVAL_REQUIRED` dla kogokolwiek innego). Bez rozstrzygniętej polityki:
`valueReason: DECISION_REQUIRED`, `missingParameters: ['impactWeights']`,
`contributionWeight: null`. `contribution_weight` jest **wyliczany i zamrażany** razem
z `contributionPolicy: {policyId, rowVersion}`, więc ekran **nie pozwala go edytować
ręcznie, gdy podana jest klasa** — żądanie z klasą i liczbą naraz dostaje
`400 CONTRIBUTION_CLASS_WEIGHT_CONFLICT`, i ten sam kod dostaje próba wpisania samej liczby
na link, który już niesie klasę (`FIX-3`).

**10. Wysycenie mocy.** Ekran **musi umieć pokazać `UNKNOWN` z powodem** —
`knowledgeState: 'UNKNOWN'`, `valueReason: 'AVAILABILITY_SOURCE_UNAVAILABLE'`,
`missingAvailabilityComponents: ['ABSENCE','FIXED_DUTIES','ACCEPTED_RESERVATIONS']`,
`saturationRange: null`. **Jeżeli projekt ekranu nie ma miejsca na „nie wiem", to jest zły
projekt ekranu.**

**11. Zdanie zamykające (dosłownie).**

> „front NIE jest w zakresie tego dyżuru; żadne pole nie zostało pokazane na żadnym ekranie;
> ekran polityki i ekran przypisania perspektyw zbuduje osobny dyżur frontowy — za flagą OFF,
> z własnymi zrzutami i wewnętrznym polish-passem — i dopiero potem Piotr zobaczy je do
> akceptu, pojedynczo (`CLAUDE.md` reguły 7 i 9)."

### ZMIANA KONTRAKTU (breaking) — obcy cel nie potwierdza już swojego istnienia

`GET /api/initiatives-v4/goals/:goalId/initiatives`: `200 {initiatives: []}` →
`404 {error: 'Goal not found'}`, gdy `goalId` nie należy do organizacji wołającego.
Zmiana pochodzi z commita `fffba8a8bd` (P.8c), gdzie `getGoalInitiatives` zaczęło zwracać
`null` zamiast `[]` (`server/src/services/initiativeGovernanceService.ts:224`), a trasa
mapuje `null` na 404 (`server/src/routes/initiative-governance.routes.ts:179-182`).

To jest **PODNIESIENIE** kontraktu do mocniejszego, nie osłabienie: pusta tablica z kodem
200 była potwierdzeniem istnienia obcego celu (enumeracja identyfikatorów przez różnicę
200/404). Dwa testy bezpieczeństwa zapisywały stary, słabszy kontrakt i zostały podniesione
do `toBeNull()` (`server/src/routes/__tests__/cross-org-idor.test.ts:1205`,
`tests/unit/backend/services/initiativeGovernanceService.crossorg.test.ts:118`).

Skutek dla frontu: `Api.goalsGetInitiatives` (`src/services/api.ts:21204`) musi obsłużyć
404 jako „nie ma takiego celu w mojej organizacji", a nie jako pustą listę. Na dziś ta
metoda **nie ma ani jednego wołacza w `src/**`**, więc zmiana nie psuje żadnego ekranu.

### ZMIANA KONTRAKTU (additive) — nowe pola koperty `/control-kpis`

| Pole | Znaczenie |
| --- | --- |
| `goalInitiativeContributions[]` | wkład liczbowy wariantu C per para cel↔inicjatywa: `{goalId, initiativeId, contributionClass, numericContributions[], numericContributionState, presentationPrecedence}` (`FIX-6`) |

### ZMIANA KONTRAKTU (additive) — nowe pola `GET /goals/:goalId/rollup`

| Pole | Znaczenie |
| --- | --- |
| `unsetContributionWeights` | ile linków w tym rollupie nie ma ustalonej wagi wkładu |
| `contributionWeightValueReason` | `'DECISION_REQUIRED'` gdy powyższe `> 0`, inaczej `null` |

Arytmetyka `rollupProgress` **nie zmieniła się** — jedyny realny konsument
(`src/components/Results/ResultsScorecardsTable.tsx:76`) czyta ją bez zmian.

---

## Decyzje właścicielskie — co przyjąłem, czego NIE zmieniłem

`DEC-2026-08-28-169` przyjmuję jako wiążącą; nie podważam jej ani w kodzie, ani w raporcie.

Pozostaje `DECISION_REQUIRED` / `UNKNOWN` i dlaczego:

- wszystkie pięć parametrów polityki, dopóki konsultant ich nie wpisze — bo wartości
  zależne od decyzji właściciela są danymi w tabeli, nie stałymi;
- waga wkładu przy klasie bez rozstrzygniętej polityki — bo `impactWeights` jeszcze nie ma;
- dowód decyzji w piątej warstwie (`DECISION_EVIDENCE_CARRIER_UNAVAILABLE`) — bo nośnika
  po prostu nie ma;
- wysycenie mocy (`AVAILABILITY_SOURCE_UNAVAILABLE`) — bo nie ma żadnego z trzech źródeł
  dostępności;
- źródło nieobecności, administrator i zakres danych osobowych, właściciel stałych
  obowiązków, zatwierdzający rezerwacje — pytania do właściciela z `P.11`.

**Dowód braku zaszytych wartości.** `git diff 6838cd1402..HEAD -- server/src server/migrations`
przefiltrowany po `0.8|0.95|0.15|?? 7|?? 5|CRITICAL: 3|IMPORTANT: 2|SUPPORTING: 1` daje
**zero trafień**. Liczby `12.5` i `4.0` w `day33.numeric-contribution.pg.test.ts` są
fixture'ami testowymi wkładu liczbowego, nie parametrami polityki.

## Migracje

```
$ ls server/migrations | grep '^202612'
20261220_execution_day33_goal_perspective.sql
20261221_execution_day33_goal_initiative_links_tenant.sql
20261222_execution_day33_contribution_weight_no_default.sql   ← FIX-2 (runda naprawcza)
20261240_execution_day35_kpi_policy_tenant_scoped_pk.sql      ← cudza, dyżur 35
```

Trzecia migracja (`20261222`) powstała w rundzie naprawczej i robi dokładnie jedno:
`ALTER TABLE goal_initiative_links ALTER COLUMN contribution_weight DROP DEFAULT`.
Nie zmienia żadnego istniejącego wiersza, nie usuwa kolumny, nie dodaje `NOT NULL`.
Bez niej pominięcie kolumny w `INSERT` — jedyny sposób, żeby nie wpisać ani `1.0`,
ani `null`-a — i tak stemplowało wiersz wartością `1.0` z `DEFAULT`-u schematu
(`server/migrations/20260719_baseline_gap.sql:4649`).

`\d goal_initiative_links` PO wszystkich trzech migracjach, z bazy `cx_fix33`:
`contribution_weight | real | | |` — **kolumna Default jest pusta**.

`MIGRATION_PREPARED` — migracje uruchomiono wyłącznie na własnym, efemerycznym PG.
`REMOTE_EXECUTION_NOT_AUTHORIZED` — żadnej migracji nie puszczono na demo, staging ani produkcję.

---

## ★ Pomiar testów (Z24) — uczciwy mianownik

**Nie przepisałem żadnej liczby z cudzego raportu — zmierzyłem sam**, na własnym PG,
porównując gałąź naprawczą z baselinem na markerze `6838cd1402` uruchomionym na **osobnej
bazie** `cx_fix33_base` w tym samym kontenerze.

### Zakres A — `tests/integration/initiatives-execution/` (44 pliki)

Odbiór ustalił, że **39 plików tego katalogu wykonawca w ogóle nie uruchomił**. Uruchomiłem.

| Przebieg | Pliki | Testy |
| --- | --- | --- |
| Baseline `6838cd1402` (baza `cx_fix33_base`) | 5 FAIL / 12 PASS / 27 SKIP (44) | 31 FAIL / 33 PASS / 43 SKIP (107) |
| Gałąź `day33-fixes-20260828` (baza `cx_fix33`) | 5 FAIL / 12 PASS / 27 SKIP (44) | 31 FAIL / 33 PASS / 43 SKIP (107) |
| **Różnica** | **0** | **0** |

27 pominiętych plików to `describe.skipIf` — suity wymagające zasobów, których ten
kontener nie ma. **`SKIPPED` to nie `PASS`** i nie wliczam ich do zdanych.

### Zakres B — pakiet celowany dyżuru 33 (16 plików)

`day33.goal-links-tenant.pg.test.ts`, cały `server/src/routes/pmo/__tests__/`, cały
`server/src/services/executionControl/__tests__/`, strażnik
`initiative-governance-goal-rollup-tenant.routes.test.ts`,
`res10-ownership-separation.routes.test.ts`, `initiativeGovernanceService.crossorg.test.ts`:

**15 plików PASS / 1 FAIL — 112 testów PASS / 4 FAIL.**

Jedyny czerwony plik to `res10-ownership-separation.routes.test.ts` (4 FAIL) —
**czerwień ZASTANA**, identyczna na baselinie (`4 failed | 1 passed` w obu przebiegach).

### Zakres C — testy bezpieczeństwa i `tests/unit/results/**` (27 plików)

| Przebieg | Testy |
| --- | --- |
| Baseline `6838cd1402` | **96 FAIL** / 410 PASS (506) |
| Gałąź naprawcza | **95 FAIL** / 411 PASS (506) |
| **Różnica** | **−1 czerwony, +1 zielony** — dokładnie test naprawiony przez `FIX-1` |

Czerwone per plik (oba przebiegi):

- `server/src/routes/__tests__/cross-org-idor.test.ts` — 92 FAIL / 114 (baseline 93/114);
- `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` — 3 FAIL / 4.

**`tests/unit/results/**` poza tym jednym zastanym plikiem jest w pełni zielone** —
heurystyka BSC pozostała nietknięta.

### Strażnik izolacji `goal_initiative_links`

`server/src/routes/__tests__/initiative-governance-goal-rollup-tenant.routes.test.ts` —
**6/6 PASS** na gałęzi naprawczej (wymagany dowód wąskiej licencji międzymodułowej P.8).

### Bramka wejściowa B.7

`server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts` — **8/8 PASS**.

### Testy dodane / usunięte w rundzie naprawczej

| Plik | Przed | Po | Co się zmieniło |
| --- | --- | --- | --- |
| `day33.goal-links-tenant.pg.test.ts` | 9 | 11 | +3 nowe (nowy link z klasą bez polityki; legacy na rządzonym linku odrzucone; legacy na czystym linku), −1 zastąpiony (stary „keeps the legacy contributionWeight-only request compatible" testował stan, który jest teraz nielegalny) |
| `day33.goal-perspective.pg.test.ts` | 7 | 8 | +1 (obcy cel **bez** nagłówka `X-Organization-Id` → 404) |
| `day33.numeric-contribution.pg.test.ts` | — | 4 | NOWY plik (P.9, z negatywem tenanta) |
| `capacitySaturationReadModel.test.ts` | 6 | 4 | −3 martwe (`classifyCapacityBand`), +1 realny (progi przenoszone bez wymyślania pasma) |
| `cross-org-idor.test.ts` | — | — | 1 asercja podniesiona `toEqual([])` → `toBeNull()` |
| `initiativeGovernanceService.crossorg.test.ts` | — | — | 1 asercja podniesiona, jw. |

**Żadnej asercji nie osłabiono.** Jedyne dwie zmiany asercji to podniesienie kontraktu do
mocniejszego, opisane wyżej z osobna. Nie usunięto ani nie wykomentowano żadnego bloku
`describe`.

### Deklaracja zasięgu

**ZASIĘG CZĘŚCIOWY.** Zmierzone: 87 plików testowych w trzech zakresach powyżej.
Odbiór ustalił, że realnie ruszonych modułów dotyka **96 plików testowych**. Nie
uruchomiłem pozostałych ~9 (rozproszone poza trzema zakresami: `tests/components/**`
i `tests/e2e/**` dotykające ekranu Wyników). Nie zgłaszam ich jako zielonych.
Pełnego pakietu repo (`npm run test:all`) **nie ogłaszam jako PASS**.

---

## ★ Runda naprawcza — pozycje FIX

### FIX-1 — dwie regresje w strażnikach izolacji cross-org

`getGoalInitiatives` zwraca `null` zamiast `[]` od `fffba8a8bd`. Zmiana merytorycznie
**słuszna** (DoD wymagało 404, jedyny wołacz to `initiative-governance.routes.ts:175`,
zero konsumentów w `src/`), więc naprawiono **testy do mocniejszego kontraktu**, nie kod.
Podniesiono `toEqual([])` → `toBeNull()` w `cross-org-idor.test.ts:1205`
i `initiativeGovernanceService.crossorg.test.ts:118`; zmiana kontraktu API opisana wyżej
w P.12 z osobna, nie ukryta.

**Dowód mutacyjny (obowiązkowy):** cofnięcie `null` → `[]` w
`initiativeGovernanceService.ts:224` na kopii zapala **oba** testy w drugą stronę —
`AssertionError: expected [] to be null` w obu plikach. Po przywróceniu: 13/13 i 22/114 PASS
(cross-org-idor pozostaje zastale czerwony z innego powodu, patrz Znaleziska).

### FIX-2 — zapis wartości wprost zakazanej przez §P.8.d pkt 3

Ścieżka INSERT zapisywała `contribution_weight = derivedWeight ?? null` (czyli NULL),
a `getGoalRollup` robił `contribution_weight || 1` — waga, której nikt nie ustawił,
udawała pełny wkład. Ścieżka była **nieprzetestowana** (wszystkie testy szły przez
`ON CONFLICT` na wierszu z `beforeAll`).

Naprawa ma trzy części, bo żadna sama nie wystarcza:
1. kolumna **pominięta** w liście `INSERT`, gdy nie ma wagi z polityki
   (`initiativeGovernanceService.ts:175-215`);
2. migracja `20261222` zdejmuje `DEFAULT 1.0` — bez tego pominięcie i tak stemplowało `1.0`;
3. `getGoalRollup` przestaje być cichy: `unsetContributionWeights` +
   `contributionWeightValueReason: 'DECISION_REQUIRED'`. Arytmetyki nie zmieniono
   (czyta ją ekran Wyników), ale fallback jest **nazwany**
   (`DECLARED_UNSET_CONTRIBUTION_WEIGHT`) i raportowany.

Przy okazji `|| 1` → `?? …`: poprzednia forma zamieniała jawnie zapisane `0`
(„ta inicjatywa nie wnosi wkładu") na pełny wkład `1`.

**Dowody mutacyjne (obowiązkowe) — trzy, i jeden z nich jest niewygodny:**

| Mutacja | Wynik | Wniosek |
| --- | --- | --- |
| M0: przywrócenie zapisu `derivedWeight ?? null` (jawny NULL zamiast pominięcia kolumny) | test **PASS** | **Uczciwie: sama zmiana „pomiń kolumnę" jest nieodróżnialna od zapisu NULL**, gdy `DEFAULT` już zdjęty. Nośna jest migracja, nie sama lista kolumn |
| M1: przywrócenie `DEFAULT 1.0` na kolumnie | `AssertionError: expected 1 to be null` | migracja `20261222` jest load-bearing |
| M2: powrót rollupu do `contribution_weight \|\| 1` | `unsetContributionWeights: 1 → 0`, `contributionWeightValueReason: 'DECISION_REQUIRED' → null` | jawność rollupu jest load-bearing |

Nowy test: `day33.goal-links-tenant.pg.test.ts` — „creates a NEW class link without writing
any contribution weight at all" (tworzy **nowy** link z klasą i bez polityki, sprawdza
`contribution_weight IS NULL` w bazie **i** jawność w rollupie).

### FIX-3 — stempel polityki, który kłamie

Ścieżka legacy (`contributionWeight` bez klasy) robiła
`contribution_weight = EXCLUDED.contribution_weight`, czyli **odmrażała** wagę zamrożoną
z polityki, zostawiając `contribution_class`, `contribution_policy_id`
i `contribution_policy_row_version` nietknięte.

**Rozstrzygnięcie: ścieżka legacy ODMAWIA (`400 CONTRIBUTION_CLASS_WEIGHT_CONFLICT`)**
dotknięcia wiersza, który niesie klasę wkładu — niezależnie od tego, czy klasa ma już
stempel polityki, czy czeka na decyzję. **Dlaczego odrzucenie, a nie ciche czyszczenie
klasy i stempla:** skasowanie rządzenia jest decyzją właściciela celu, a nie efektem
ubocznym zapisu liczby przez kogokolwiek. Jawna ścieżka wyjścia już istnieje —
`DELETE /goals/:goalId/initiatives/:initiativeId`, po którym link można założyć od nowa
jako legacy. Odrzucenie jest też spójne: to **ten sam kod błędu**, którego ścieżka klasowa
używa już dla żądania z klasą i liczbą naraz.

**Dowód mutacyjny:** wyłączenie strażnika daje `expected 201 to be 400`, a wiersz zostaje
z odmrożoną wagą 7 i nietkniętym stemplem.

**`contribution_policy_id` — kolumna ma teraz DWÓCH realnych czytelników**, więc zostaje
(nie usunięto): (1) strażnik FIX-3 czyta ją, żeby podjąć decyzję o odrzuceniu zapisu
(`initiativeGovernanceService.ts`, `SELECT contribution_class, contribution_policy_id,
contribution_policy_row_version FROM goal_initiative_links`), i (2) błąd `400` niesie ją
w polu `contributionPolicyId`, więc wołający dowiaduje się, **z której polityki** pochodzi
zamrożona waga, której nie wolno mu nadpisać. To nie jest już „zapis bez czytelnika".

### FIX-4 — obcy cel bez nagłówka organizacji: 400 → 404

`GOAL_NOT_FOUND` z `postgresMaterialCommandUnitOfWork.ts:516` wpadało w ogólne
`400 COMMAND_VALIDATION_FAILED` w mapperze błędów trasy runtime
(`initiativesExecutionRuntime.routes.ts`, blok `router.use((error, …))`). DoD wymaga 404.
Istniejący test `fails closed for a foreign goal and claimed organization` wysyła nagłówek
`X-Organization-Id`, więc trafia w **inną** bramkę i nigdy nie dociera do
`UPDATE goals … WHERE organization_id=…`.

Zmapowano na `404 {error: {code: 'GOAL_NOT_FOUND'}}`; dopisano test **bez** nagłówka,
sprawdzający dodatkowo brak mutacji perspektywy i zero zdarzeń audytu.
**Dowód mutacyjny:** wyłączenie mapowania daje `expected 400 to be 404`.

### FIX-5 — bramka Z25/Z26 w plikach PG (ustalenia ostrzejsze niż odbiór)

Odtworzenie incydentu na tej gałęzi potwierdziło **dwie rzeczy, których odbiór nie znał**:

1. **vitest 4.1.8 URUCHAMIA `beforeAll`/`afterAll` suity oznaczonej
   `describe.skipIf(true)`.** Sam warunek przy `describe` nie chroni ani połączenia, ani
   sprzątania. Dowód: przy pustym `DATABASE_URL` suita raportowała „9 tests | 9 skipped",
   a jednocześnie `beforeAll` **zestawił połączenie** z cudzą bazą (błąd `42703`
   „column »email« of relation »users« does not exist" — czyli połączenie było realne)
   i `afterAll` próbował tam `DELETE FROM goal_initiative_links`.
2. **`tests/setup.ts:386-388` PODMIENIA** jawnie podane, puste `DATABASE_URL` na
   `postgresql://iris:iris_test@localhost:5432/iris_test`. Warunek
   `DATABASE_URL.startsWith('postgres')` — wzorzec wskazany w odbiorze jako poprawny,
   z `goalPerspectiveMigration.pg.test.ts:12` — jest więc **zawsze prawdziwy i sam z siebie
   nic nie chroni**.

Stąd trzy zamki per plik, wszystkie w mojej licencji:

- `REAL_PG` wymaga dodatkowo `DATABASE_URL.startsWith('postgres')`;
- `REAL_PG` odrzuca wprost wstrzykniętą wartość wartowniczą
  (`DATABASE_URL !== 'postgresql://iris:iris_test@localhost:5432/iris_test'`);
- każdy `beforeAll` i `afterAll` ma własne `if (!REAL_PG) return;`.

Objęto **sześć** plików: cztery wskazane w odbiorze, plik P.9 dodany w `FIX-6`,
oraz `goalPerspectiveMigration.pg.test.ts` — wskazany w odbiorze jako **wzór poprawny**,
a mający ten sam brak w hookach.

**Dowód:** z `RUN_DB_TESTS=1 MOCK_DB=false`, bez `DATABASE_URL`, przy `tests/setup.ts`
w stanie markera — obie suity dają „2 skipped / 18 skipped", zero połączeń, zero `DELETE`.

**★ Uwaga o `Z20`, zapisana wprost.** Pierwszym odruchem był cherry-pick `b151977e4b`
(guard w `tests/setup.ts`, już scalony na `codex/m03-admin-20260824`). **Wycofałem go**,
bo `Z20` tej instrukcji brzmi: „ABSOLUTNY zakaz modyfikowania globalnej infrastruktury
testowej. Nie dotykasz `tests/setup.ts`. Naruszenie = automatyczne odrzucenie CAŁEGO
dyżuru." Gałąź naprawcza **nie zawiera żadnej zmiany** w `tests/setup.ts`, `tests/helpers`,
`tests/__mocks__` ani w plikach konfiguracji vitest. **Rekomendacja dla nadzorcy:** ten
guard chroni WSZYSTKIE pozostałe pliki realdb w repo, czego zamek per plik nie potrafi —
i przyjdzie przy scaleniu z `m03`. Nie odtwarzam go tutaj wyłącznie z powodu `Z20`.

### FIX-6 — P.9 wznowione, STOP był niezasadny

Opisane wyżej w tabeli werdyktów P.9 wraz z rozstrzygnięciem pkt 4.

### FIX-7 — martwy kod zielony od własnego testu

Opisane wyżej w tabeli werdyktów P.10.

### FIX-8 — uzupełnienie braków definicji ukończenia

Ten dokument: tabela P.6 z uzasadnieniem wyboru nośnika dowodu, dosłowne `\dt`/`\d` dla P.11
wraz ze znaleziskiem pkt 5, jedenaście punktów P.12 z pełną listą parametrów i zdaniem
zamykającym dosłownie, oraz odtworzone sekcje R.2: oświadczenie o chronionym checkoutcie,
dowód celu połączenia, bramka wejściowa, inwentarz konsumentów w `src/`, tabele werdyktów,
Znaleziska i format STOP.

---

## STOP-y i granice

- **P.9 nie jest już `STOP`.** Pozycja wznowiona i dowieziona (`FIX-6`).
- Nie zbudowano źródeł realnej dostępności; wymagają osobnej decyzji właściciela.
- Dwa istniejące magazyny polityk pozostają ryzykiem; nie utworzono trzeciego ani nie
  migrowano danych bez decyzji.
- Wynik techniczny nie jest akceptacją właściciela, dowodem UI ani zgodą na release.
- `git diff --name-only 6838cd1402..HEAD -- src` → **puste**.
- `git diff --name-only 6838cd1402..HEAD -- server/src/services/results` → **puste**.
- `git diff --name-only 6838cd1402..HEAD -- tests/setup.ts tests/helpers tests/__mocks__ 'vitest*.config.ts' server/vitest.config.ts` → **puste** (`Z20`).
- `git stash list` → **puste** (`Z27`). Kopie robocze porównawcze (`*.przed`) trzymano
  poza repozytorium w `/private/tmp` i skasowano przed commitami; żadna nie została
  zacommitowana.
- Kontener rundy naprawczej usuwany przez `docker rm -fv cx-fix33-pg`; bez globalnego
  czyszczenia wolumenów.
- Zero interakcji z Railway, demo, stagingiem i produkcją.

## Znaleziska (NIE naprawiane w tej rundzie)

1. **`cross-org-idor.test.ts` jest zastale czerwony w 92 ze 114 testów** — nie z powodu
   dyżuru 33. Przyczyna: plik mockuje `validateOrgMembership` na `rbac.middleware.js`
   (linia 91), ale trasy importują ten sam symbol z `auth.middleware.js`
   (`server/src/middleware/auth.middleware.ts:1672`), którego mock w tym pliku (linie 42-73)
   go nie eksportuje. Vitest rzuca „No »validateOrgMembership« export is defined", a każdy
   dotknięty test dostaje `403` zamiast `200`/`404`.
   **Sprawdziłem naprawę i jej NIE wprowadzam:** dopisanie no-opowego
   `validateOrgMembership` do mocka `auth.middleware` daje **93 FAIL zamiast 92** — jeden
   test regresuje, bo przepuszcza cross-orgowe żądanie, które ma zostać odrzucone.
   Poprawny mock musi **egzekwować** przynależność do organizacji, a to zmienia wynik wielu
   testów naraz i wymaga osobnego dyżuru. Zapisuję jako dług, nie łatam po wierzchu.
2. **`tests/setup.ts:386-388` fabrykuje `DATABASE_URL` wskazujący `localhost:5432`** przy
   braku jawnej wartości — to źródło incydentu z `FIX-5`. Naprawione upstream
   (`b151977e4b` na `codex/m03-admin-20260824`), nietknięte tutaj z powodu `Z20`.
3. **`migrate.postgres.ts:264-269` cicho pomija migracje o numerze `< 500`** — patrz P.11.
   Konsekwencja: `user_out_of_office` z `129_user_availability.sql` na PG nie istnieje,
   choć `DatabaseInitializer` traktuje część tego schematu jako krytyczną.
4. **`server/src/services/capacityPolicy.ts:1-3` trzyma konkurencyjne, zaszyte stałe**
   (`weeklyHoursPerFte: 40`, `overloadRatio: 1.05`, `Object.freeze`), niezależne od
   polityki E-O5. Rozjazd do rozstrzygnięcia przez właściciela; nie dotykałem (imienna
   licencja: „CZYTASZ jako ZNALEZISKO; ZMIANA = STOP").
5. **`execution_delivery_evidence` nie ma odsyłacza do zobowiązania** — dowód wisi na parze
   inicjatywa↔sprawa. Dopóki tak jest, dowód decyzji pozostaje `UNKNOWN`.
6. **`controlKpiReadModel.ts` miesza `BRAK_ŹRÓDŁA` i `DECISION_REQUIRED`** w jednym polu
   `valueReason` — czytelne dla kodu, mylące dla ekranu; do rozstrzygnięcia w dyżurze frontowym.
7. **`goal_initiative_links.organization_id` pozostaje nullowalne.** `NOT NULL` wymaga
   przebiegu na danych zastanych i osobnej decyzji.

## ★ TWIERDZENIA NIEZWERYFIKOWANE

Sekcja obowiązkowa. Wymieniam wszystko, czego **nie** udowodniłem własnym pomiarem.

1. **Ciała czterech odpowiedzi HTTP bramki wejściowej z ORYGINALNEGO przebiegu dyżuru.**
   Nie zostały zapisane i nie da się ich odtworzyć. Podałem zamiast nich własny przebieg
   bramki behawioralnej (8/8 PASS) z mapowaniem odpowiedź→test. To jest słabszy dowód niż
   dosłowne ciała odpowiedzi i nie udaję, że nim nie jest.
2. **Statusy i commity pozycji P.1–P.7, P.10, P.11, R.1** przepisałem z raportu końcowego
   dyżuru. **Nie wykonałem ich odbioru merytorycznego.** Weryfikowałem wyłącznie to, czego
   dotykały FIX-y. Dowody `plik:linia` przy P.6, P.9, P.10 i P.11 sprawdziłem sam.
3. **Liczby „128 plików / 1070 testów" z pierwotnego raportu** — nie odtwarzałem tego
   pomiaru. Mój pomiar obejmuje 87 plików w trzech zakresach i jest opisany wyżej jako
   `ZASIĘG CZĘŚCIOWY`.
4. **~9 plików testowych z ustalonych przez odbiór 96** — nie uruchomione. To pliki
   `tests/components/**` i `tests/e2e/**` dotykające ekranu Wyników; ich uruchomienie
   wymaga środowiska przeglądarkowego, którego ta runda nie stawiała.
5. **Zachowanie migracji `20261222` na danych zastanych.** Sprawdzona wyłącznie na świeżej
   bazie. Na bazie z istniejącymi wierszami `goal_initiative_links` migracja jest
   nieszkodliwa **z definicji** (`DROP DEFAULT` nie dotyka wierszy), ale przebiegu na
   realnych danych nie wykonałem.
6. **Czy `presentationPrecedence` jest właściwym kształtem dla frontu.** To rozstrzygnięcie
   nadzorcy przyjęte przeze mnie i zaimplementowane; **nie było walidowane z właścicielem**
   ani na prototypie ekranu.
7. **Kompletność listy „zero konsumentów w `src/`".** Oparta na grepie po nazwach metod
   `Api.*`. Wywołanie przez dynamicznie budowany URL albo przez alias byłoby niewidoczne
   dla tego grepa.
8. **Czy `res10-ownership-separation.routes.test.ts` (4 FAIL) i
   `resultsFinanceReconciliationService.postmortem.test.ts` (3 FAIL) mają wspólną
   przyczynę z czymkolwiek w tym dyżurze.** Potwierdziłem tylko, że są identycznie czerwone
   na baselinie — **nie diagnozowałem ich**.
