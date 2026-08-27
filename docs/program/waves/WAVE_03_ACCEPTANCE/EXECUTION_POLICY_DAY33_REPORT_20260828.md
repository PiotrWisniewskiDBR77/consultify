# Realizacja — nośniki decyzji E-O3/E-O4/E-O5 — raport dyżuru 33, 2026-08-28

Gałąź: `codex/policy-carriers-day33-20260828`  
Marker bazowy: `87e7cecf3a` (`MARKER OK`)  
Kontener: `cx-day33-pg`, port `5597`

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie zmieniłem `/Users/piotrwisniewski/Developer/Consultify`; jedyny kontakt to dozwolony symlink `node_modules` używany tylko do odczytu.

## P.1 — dwa magazyny polityk

Parametry E-O3/E-O4/E-O5 mieszkają w `execution_control_kpi_policies.parameters`.

| Nośnik                           | Kształt                                                                                                                                              | Kto pisze                                                                                                            | Kto czyta                                                                                   | Wersjonowanie                                 | Zakres                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `execution_control_kpi_policies` | `policy_id`, `organization_id`, `name`, `parameters JSONB`, `row_version` (`server/migrations/20261077_day17_execution_control_kpi_policy.sql:3-16`) | kanoniczna komenda polityki (`server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:468-493`) | `ControlKpiReadModel` (`server/src/services/executionControl/controlKpiReadModel.ts:35-44`) | CAS przez `row_version`; wiersz aktualizowany | organizacja + `policy_id`                    |
| `ie_governance_policies`         | zakres, wersja, `baseline`, `strictness`, `config_json`, stan (`server/migrations/932_initiatives_execution_material_commands.sql:43-60`)            | komendy materialne                                                                                                   | resolver runtime-v1                                                                         | append-only wersje, `ACTIVE`/`SUPERSEDED`     | organizacja / produkt / projekt / inicjatywa |

Ryzyko: jeżeli progi będą kiedyś potrzebne per projekt lub inicjatywę, obecny nośnik nie ma takiego zakresu; nie przenoszę jednak danych ani nie tworzę trzeciego magazynu bez osobnej decyzji architektonicznej.

## Stan wejściowy i errata

- `git fetch --all --prune`: `icloud-source` jest martwym lokalnym remote; `origin` i `github-backup` pobrane.
- Pełne migracje: `855` zastosowanych; pierwszy przebieg wymagał `NODE_ENV=test`, ponieważ aktualny resolver odrzuca localhost poza testem.
- Bramka B.7: `server/src/routes/pmo/__tests__/day35.kpi-policy-authoring.pg.test.ts` — `6/6 PASS` z jawnymi `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `ENABLE_V8_GLOBAL=true`.
- Pomiar zastany pełnego zakresu: `128` plików, `106 PASS`, `21 FAIL`, `1 SKIP`; `1022 PASS`, `175 FAIL`, `26 SKIP`. To czerwienie zastane przed pierwszym commitem.
- Wbrew oczekiwaniu instrukcji migracja `20261240_execution_day35_kpi_policy_tenant_scoped_pk.sql` istnieje; przedział dnia 33 `20261220–20261229` pozostaje wolny.
- Wbrew wstępnemu werdyktowi `user_availability` istnieje na świeżym PG; `user_out_of_office` nie istnieje.

## Decyzja właściciela i kontrakt modułu

Wiążące są: wartości liczbowe są danymi wpisywanymi per klient, perspektywa jest deklaracją człowieka, a brak źródła dostępności oznacza „nie wiem”. `DEC-169` doprecyzowuje, ale nie zmienia kontraktu `EXE-OWN-006/007`: oba już wymagają jawnych perspektyw, osobnej warstwy jakości danych, zakresu wysycenia i konfigurowalnych progów.

## Pozycje — tabela zbiorcza

| Pozycja | Status          | Commit         | Dowód                                          |
| ------- | --------------- | -------------- | ---------------------------------------------- |
| P.1     | ZROBIONE_WG_DoD | `cb79d43796`   | tabela dwóch nośników                          |
| P.2     | ZROBIONE_WG_DoD | `d82c5cc05b`   | schemat; pakiet celowany `18/18 PASS`          |
| P.3     | ZROBIONE_WG_DoD | `aaa32f4e79`   | realny HTTP i niezależny readback; `7/7 PASS`  |
| P.4     | ZROBIONE_WG_DoD | `edc04bea29`   | migracja `20261220`; `7/7 PASS`                |
| P.5     | NIE_ZACZĘTE     | —              | brak kanonicznej komendy przypisania           |
| P.6     | NIE_ZACZĘTE     | —              | brak read-modelu piątej warstwy                |
| P.7     | NIE_ZACZĘTE     | —              | zależy od P.5                                  |
| P.8     | NIE_ZACZĘTE     | —              | brak migracji izolacji i klasy wkładu          |
| P.9     | STOP            | —              | brak udowodnionego seam odczytu Results        |
| P.10    | CZĘŚCIOWO       | `d82c5cc05b`   | pasma/bufor walidowane; brak koperty `UNKNOWN` |
| P.11    | CZĘŚCIOWO       | raport końcowy | inwentarz PG, bez osobnego commita             |
| P.12    | NIE_ZACZĘTE     | —              | brak pełnego kontraktu frontowego              |
| R.1     | NIE_ZACZĘTE     | —              | `MODULE_ACCEPTANCE.md` nietknięty              |
| R.2     | CZĘŚCIOWO       | raport końcowy | uczciwy zakres i STOP-y                        |

## Dowody P.3/P.4

Wartości `7 / 5 dni roboczych / 80–95 % / bufor 15 %` zostały wprowadzone przez realny router HTTP i odczytane niezależnym połączeniem z PostgreSQL w `day35.kpi-policy-authoring.pg.test.ts`; przebieg `7/7 PASS`. W kodzie produkcyjnym nie są defaultami ani fallbackami.

`goals.perspective` jest nullowalnym `TEXT` bez wartości domyślnej. Baza przyjmuje dokładnie `financial`, `customer`, `process`, `learning`, `governance_data_quality` oraz `NULL`; szóstą wartość odrzuca kodem `23514`. Migracja nie wykonuje backfillu ani heurystyki.

## P.11 — inwentarz dostępności

Na świeżym PG nie ma `user_out_of_office`. `users.out_of_office` i `vacation_end` są tylko bieżącym przełącznikiem bez historii i daty początku. `user_availability` istnieje z `working_hours_json`, `dnd_hours_json` i `settings`, lecz bez kalendarza nieobecności i zakresu organizacji. Werdykty: nieobecności `ZBUDUJ_OD_ZERA`; godziny pracy `PODŁĄCZ_PO_NAPRAWIE`; stałe obowiązki `ZBUDUJ_OD_ZERA`; zaakceptowane rezerwacje `ZBUDUJ_OD_ZERA`; bufor `PODŁĄCZ`. Otwarte pytanie właścicielskie: kto wprowadza dane nieobecności i czy źródłem jest HR, kalendarz, czy konsultant.

## STOP-y i otwarte pozycje

### STOP — P.9

Powód: wystawienie zatwierdzonego wkładu liczbowego bez dotykania chronionego modułu Results wymaga jawnego tenantowego seam odczytu, którego nie udowodniono.
Stan: NIE ZACOMMITOWANO.

P.5–P.8 i P.10–P.12 nie są gotowe. Następny wykonawca powinien kontynuować od `edc04bea29`, zachowując kolejność P.5→P.7, P.6, P.8c→P.8d i P.10.

## Bezpieczniki i brief

`src/**`, `inferPerspective`, `server/src/services/results/**` i chronione middleware są nietknięte. Nie użyto `git stash`, `docker volume prune`, Railway ani push do `origin`.

E-O3 ma nośnik perspektywy, ale nie ma jeszcze komendy ani klasy raportu. E-O4 ma wprowadzalną politykę, ale klasa nie jest zapisywana przy linku. E-O5 ma wprowadzalne pasma i bufor, ale nie ma jeszcze koperty `UNKNOWN`. Źródła nieobecności wystarczającego do obliczeń nie ma. Do scalenia nadają się P.1–P.4 jako fundament; całego dyżuru 33 nie wolno oznaczać jako ukończonego.

## P.11 — zweryfikowany inwentarz realnej dostępności

Dosłowny odczyt świeżego PG:

```text
\dt user_out_of_office
Did not find any relation named "user_out_of_office".

\d user_availability
id text NOT NULL; user_id text NOT NULL; status_message text;
working_hours_json text DEFAULT '{}'; dnd_hours_json text DEFAULT '{}';
created_at timestamp DEFAULT CURRENT_TIMESTAMP; updated_at timestamp DEFAULT CURRENT_TIMESTAMP;
settings text; UNIQUE(user_id); FK user_id -> users(id) ON DELETE CASCADE.

\d users | grep -iE "vacation|out_of_office"
out_of_office integer DEFAULT 0
vacation_end timestamp without time zone
out_of_office_message text
```

| Składnik dostępności     | Kandydat                                                     | Werdykt               | Brakujący kształt / pytanie właścicielskie                                                                                               |
| ------------------------ | ------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Nieobecności             | bieżący przełącznik `users.out_of_office` + jedna data końca | `ZBUDUJ_OD_ZERA`      | Potrzebne okresy start/koniec, wymiar godzinowy, historia i zakres organizacji. Kto wprowadza: HR, integracja kalendarza czy konsultant? |
| Stałe obowiązki          | `user_availability.working_hours_json` / `dnd_hours_json`    | `PODŁĄCZ_PO_NAPRAWIE` | To dostępność nominalna/DND, nie rejestr stałych obowiązków. Czy właścicielem danych jest pracownik czy przełożony?                      |
| Zaakceptowane rezerwacje | brak trafień w schemacie i `server/src`                      | `ZBUDUJ_OD_ZERA`      | Potrzebny tenantowy rejestr osoby, okresu, godzin/FTE, źródła i akceptacji. Kto zatwierdza rezerwację?                                   |
| Bufor operacyjny         | `execution_control_kpi_policies.parameters.capacityBuffer`   | `PODŁĄCZ`             | Konsultant wpisuje wartość per organizacja; brak defaultu i seeda.                                                                       |

Odpowiedź nadzorcy: w schemacie istnieje jedynie niepełny bieżący sygnał nieobecności, ale **nie istnieje źródło wystarczające do policzenia realnej dostępności**. Kalendarz `user_out_of_office` z migracji `129_user_availability.sql` nie jest zastosowany; runner jawnie pomija fragmenty z numerem `<500` (`server/scripts/migrate.postgres.ts:265-268`). Budowa źródła wymaga osobnej decyzji o źródle, administratorze danych i wrażliwości danych osobowych.

## P.12 — kontrakt dla przyszłego frontu

Front NIE jest w zakresie tego dyżuru; żadne pole nie zostało pokazane na żadnym ekranie; ekran polityki i ekran przypisania perspektyw zbuduje osobny dyżur frontowy — za flagą OFF, z własnymi zrzutami i wewnętrznym polish-passem — i dopiero potem Piotr zobaczy je do akceptu, pojedynczo (`CLAUDE.md` reguły 7 i 9).

1. **Parametry polityki.** `impactWeights`: obiekt dokładnie `CRITICAL`, `IMPORTANT`, `SUPPORTING`, każda liczba skończona `>0`; `atRiskThresholdDays`: dodatnia liczba całkowita, dni kalendarzowe; `decisionSlaDays`: `{value: dodatnia liczba całkowita, unit: BUSINESS_DAYS|CALENDAR_DAYS}`; `capacitySaturationThreshold`: `{normalUpper, saturatedUpper}`, ułamki `(0,1]`, ściśle rosnące; `capacityBuffer`: ułamek `[0,1)`. Brak odblokowuje odpowiednio `initiative-risk`, `decision-latency` albo `capacity` dopiero po wpisaniu.
2. **Podpowiedzi startowe, nie defaulty.** UI może pokazać propozycję: 7 dni, 5 dni roboczych, 80%/95%, bufor 15% oraz klasy Krytyczna/Ważna/Wspierająca. Każde pole startuje puste; propozycja wymaga jawnego zapisu konsultanta. Dopóki jej nie wpisano, API zwraca `DECISION_REQUIRED`.
3. **Koperta zapisu polityki.** `POST /api/initiatives/runtime-v1/execution-control-kpi-policies/:policyId`: `{expectedVersion, clientRequestId, name, parameters}`. Sukces `201 APPLIED`, replay `200 REPLAYED`; konflikt CAS/idempotencji `409 VERSION_OR_IDEMPOTENCY_CONFLICT` z `expectedVersion/currentVersion`; strukturalnie błędny parametr `400 COMMAND_VALIDATION_FAILED`. Odczyt: `GET /api/initiatives/runtime-v1/control-kpis?weekStart=YYYY-MM-DD&policyId=...`, pola `policy.policyId/resolved/missingParameters/invalidParameters`.
4. **Polityka niekompletna.** Ekran pokazuje każdą pozycję `missingParameters` i mapę: `impactWeights` + `atRiskThresholdDays` → `initiative-risk`; `capacitySaturationThreshold` + `capacityBuffer` → `capacity`; `decisionSlaDays` → `decision-latency`. Nie ukrywa `INVALID_PARAMETERS` ani dwujęzycznego `message.en/message.pl`.
5. **Słownik perspektyw.** `financial` — Finanse; `customer` — Klient/Rynek; `process` — Procesy wewnętrzne; `learning` — Ludzie/Kompetencje; `governance_data_quality` — Ład i jakość danych.
6. **Przypisanie i czyszczenie.** `POST /api/initiatives/runtime-v1/goals/:goalId/perspective`: `{expectedVersion, clientRequestId, perspective}`; `perspective` przyjmuje pięć wartości albo `null`. `null` jest świadomym stanem „nieprzypisana”, a odczyt pokazuje `UNASSIGNED`.
7. **Brak automatycznej podpowiedzi.** Backend nie wystawia sugestii perspektywy. Przypisanie jest w całości ręczne; UI nie wywołuje i nie replikuje `inferPerspective`.
8. **Klasa raportu.** `reportClassification.reportClass` ma `OPERATIONAL|STRATEGIC`; `reason` pokazuje `commitmentCount`, `mappedCommitmentCount`, `mappedToDeclaredPerspectiveCount`, `goalCount`, `assignedGoalCount`. UI wyświetla np. „raport operacyjny, bo 3 z 5 zobowiązań prowadzą do celu z deklarowaną perspektywą”. `STRATEGIC` wyłącznie przy pokryciu wszystkich zobowiązań; pusta organizacja jest `OPERATIONAL`.
9. **Skala wkładu.** `POST /api/initiatives-v4/goals/:goalId/initiatives` przyjmuje addytywnie `contributionClass`, `policyId`, opcjonalnie legacy `contributionWeight`. Klasę zatwierdza właściciel celu. Bez `impactWeights` klasa zapisuje się z `valueReason: DECISION_REQUIRED`, a istniejąca waga nie zmienia się. Z polityką odpowiedź zawiera `contributionWeight` oraz `contributionPolicy:{policyId,rowVersion}`; waga jest zamrożona. UI nie edytuje jej ręcznie, gdy podano klasę. Konflikt klasa–liczba zwraca `400`.
10. **Wysycenie mocy.** `capacitySaturation` zawsze potrafi pokazać `knowledgeState`, `valueReason`, `missingAvailabilityComponents`, `saturationRange` i `configuredPolicy`. Obecnie kompletna polityka zwraca `UNKNOWN`, `AVAILABILITY_SOURCE_UNAVAILABLE`, listę `ABSENCE/FIXED_DUTIES/ACCEPTED_RESERVATIONS` oraz `saturationRange:null`. Bufor pomniejsza dostępność przed obliczeniem. Jeżeli projekt ekranu nie ma miejsca na „nie wiem”, to jest zły projekt ekranu.
11. **Piąta warstwa.** `governanceDataQuality` pokazuje licznik, mianownik i pełne `ids` dla braku właściciela i terminu; dowód jest osobno dla zadań, a dla decyzji pozostaje `UNKNOWN` z `DECISION_EVIDENCE_CARRIER_UNAVAILABLE`. `UNKNOWN` nie może być renderowane jako `0%` ani `100%`.

## Znaleziska (NIE naprawiane przeze mnie)

- Dwa równoległe magazyny polityk i brak zakresu projekt/inicjatywa w `execution_control_kpi_policies`.
- `capacityPolicy.ts` nadal ma konkurencyjne stałe `40 h` i `1.05`.
- Runner i historyczne migracje dają inny stan `user_availability`, niż przewidywała instrukcja.
- `controlKpiReadModel.ts` miesza `BRAK_ŹRÓDŁA` i `DECISION_REQUIRED`.
