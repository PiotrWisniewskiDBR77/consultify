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

| Pozycja | Status          | Commit          | Dowód                         | Poziom       |
| ------- | --------------- | --------------- | ----------------------------- | ------------ |
| P.1     | ZROBIONE_WG_DoD | do uzupełnienia | tabela dwóch nośników powyżej | dokumentacja |

## Znaleziska (NIE naprawiane przeze mnie)

- Dwa równoległe magazyny polityk i brak zakresu projekt/inicjatywa w `execution_control_kpi_policies`.
- `capacityPolicy.ts` nadal ma konkurencyjne stałe `40 h` i `1.05`.
- Runner i historyczne migracje dają inny stan `user_availability`, niż przewidywała instrukcja.
- `controlKpiReadModel.ts` miesza `BRAK_ŹRÓDŁA` i `DECISION_REQUIRED`.
