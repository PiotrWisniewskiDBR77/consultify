# Realizacja — nośniki decyzji E-O3/E-O4/E-O5 — raport dyżuru 33, 2026-08-28

Gałąź: `codex/policy-carriers-day33-20260828`
Marker: `87e7cecf3a` (`MARKER OK`)
Worktree: `/private/tmp/consultify-carriers`
Realny PostgreSQL: `cx-day33-pg`, port `5597`, baza `cx_day33`

## Werdykt

P.1–P.8, P.10–P.12 i R.1 wykonano commit-per-krok. P.9 pozostaje świadomym `STOP` zgodnie z poleceniem właściciela. Dyżur dowodzi, że wartości E-O4/E-O5 są wpisywalnymi i odczytywalnymi danymi polityki, perspektywa celu jest deklaracją człowieka, a brak wiarygodnego źródła dostępności daje `UNKNOWN`, nigdy wyliczony procent.

Nie zmieniono `src/**`, `inferPerspective` ani `server/src/services/results/**`. Nie wykonano push, stash, seeda, Railway ani `docker volume prune`.

## Pozycje i commity

| Pozycja | Status | Commit | Dowód |
| --- | --- | --- | --- |
| P.1 | ZROBIONE_WG_DoD | `cb79d43796` | nośnik: `execution_control_kpi_policies.parameters` |
| P.2 | ZROBIONE_WG_DoD | `d82c5cc05b` | walidacja pięciu grup parametrów; bez defaultów |
| P.3 | ZROBIONE_WG_DoD | `aaa32f4e79` | dwie firmy zapisują i odczytują własne liczby |
| P.4 | ZROBIONE_WG_DoD | `edc04bea29` | migracja `20261220`; nullowalna perspektywa |
| P.5 | ZROBIONE_WG_DoD | `947ed37580` | komenda przypisania/wyczyszczenia, CAS, replay, audyt |
| P.6 | ZROBIONE_WG_DoD | `a557bf3cbf` | read-model „Ład i jakość danych” |
| P.7 | ZROBIONE_WG_DoD | `8ff0c2db1c` | klasa raportu z realnego pokrycia |
| P.8c | ZROBIONE_WG_DoD | `fffba8a8bd` | najpierw izolacja `goal_initiative_links` |
| P.8d | ZROBIONE_WG_DoD | `2597fed3ce` | potem klasa wkładu i waga z polityki |
| P.9 | STOP | — | nie wracano bez nowego polecenia |
| P.10 | ZROBIONE_WG_DoD | `5660d1397f` | pasma/bufor; brak źródła daje `UNKNOWN` |
| P.11 | ZROBIONE_WG_DoD | `e6494c8527` | inwentarz dostępności |
| P.12 | ZROBIONE_WG_DoD | `474b0db653` | kontrakt frontu |
| R.1 | ZROBIONE_WG_DoD | `a67444d5ae` | `MODULE_ACCEPTANCE.md` |
| R.2 | ZROBIONE_WG_DoD | commit raportu | pełny stan i dowody |

## E-O3 — pięć perspektyw

`goals.perspective` przyjmuje `financial`, `customer`, `process`, `learning`, `governance_data_quality` albo `NULL`; nie ma defaultu ani backfillu. `POST /api/initiatives/runtime-v1/goals/:goalId/perspective` zapisuje deklarację człowieka z CAS, idempotencją i audytem. `null` świadomie czyści przypisanie. Nie użyto ani nie rozszerzono `inferPerspective`.

`governanceDataQuality` zwraca osobno liczniki, mianowniki i identyfikatory brakujących właścicieli oraz terminów. Dowód zadań jest liczony z realnego nośnika; dowód decyzji pozostaje `UNKNOWN / DECISION_EVIDENCE_CARRIER_UNAVAILABLE`.

Raport jest `STRATEGIC` wyłącznie, gdy każde zobowiązanie w zakresie prowadzi przez cel do jawnie zadeklarowanej perspektywy. Inaczej, także dla pustego zakresu, jest `OPERATIONAL`; odpowiedź podaje liczniki uzasadniające klasyfikację.

## E-O4 — trzy klasy i opcjonalna liczba

Link cel–inicjatywa jest tenantowy przez `organization_id`; backfill migracji `20261221` dotyka tylko wierszy z `NULL`, a odczyty dodatkowo sprawdzają organizację inicjatywy. Dopiero po tej naprawie dodano `contribution_class`.

Klasy `CRITICAL`, `IMPORTANT`, `SUPPORTING` zatwierdza właściciel celu. Jeśli polityka zawiera `impactWeights`, liczba zostaje skopiowana i zamrożona z `policyId` i `rowVersion`. Bez rozstrzygniętej polityki klasa zapisuje się z `DECISION_REQUIRED`, a istniejąca liczba nie jest nadpisywana. Legacy liczba pozostaje opcjonalna; konflikt klasy i liczby jest odrzucany.

Progi ryzyka i SLA są wyłącznie danymi polityki. Liczby w testach są fixture'ami, nie defaultami, seedem ani fallbackiem.

## E-O5 — pasma, bufor i „nie wiem”

Pasma i bufor są wyłącznie danymi polityki per organizacja; test dwóch organizacji dowodzi niezależnych wartości. Dopóki nie istnieją źródła nieobecności, stałych obowiązków i zaakceptowanych rezerwacji, read-model zwraca `knowledgeState: UNKNOWN`, `valueReason: AVAILABILITY_SOURCE_UNAVAILABLE`, `saturationRange: null` oraz brakujące `ABSENCE`, `FIXED_DUTIES`, `ACCEPTED_RESERVATIONS`. Nie generuje procentu z dostępności nominalnej ani z samego bufora.

## P.11 — inwentarz dostępności

| Składnik | Stan na świeżym PG | Werdykt |
| --- | --- | --- |
| Nieobecności | tylko bieżące `users.out_of_office`, `vacation_end`; bez okresów, historii i tenantu | `ZBUDUJ_OD_ZERA` |
| Stałe obowiązki | `working_hours_json` / `dnd_hours_json` nie jest rejestrem obowiązków | `PODŁĄCZ_PO_NAPRAWIE` |
| Zaakceptowane rezerwacje | brak właściwego nośnika | `ZBUDUJ_OD_ZERA` |
| Bufor | `execution_control_kpi_policies.parameters.capacityBuffer` | `PODŁĄCZ` |

`user_out_of_office` nie istnieje na świeżej bazie. Otwarte decyzje: źródło nieobecności, administrator i zakres danych osobowych, właściciel stałych obowiązków oraz zatwierdzający rezerwacje.

## P.12 — kontrakt dla frontu

Front nie był w zakresie i niczego nie pokazano użytkownikowi. Przyszły ekran:

1. zaczyna liczby puste; sugestia tekstowa nie jest wartością, dopóki konsultant jej nie zapisze;
2. zapisuje politykę z `expectedVersion`, `clientRequestId`, `name`, `parameters`;
3. pokazuje `resolved`, `missingParameters`, `invalidParameters` i `DECISION_REQUIRED`;
4. udostępnia pięć ręcznie wybieranych perspektyw oraz `null`, bez heurystyki;
5. pokazuje liczniki uzasadniające klasę raportu;
6. pozwala właścicielowi celu wybrać klasę wkładu; wagi pochodnej z polityki nie edytuje;
7. renderuje `UNKNOWN` jako „nie wiem”, nigdy jako `0%`/`100%`;
8. pokazuje piątą warstwę wraz z identyfikatorami braków i osobnymi stanami dowodu zadań/decyzji.

### ZMIANA KONTRAKTU (breaking) — obcy cel nie potwierdza już swojego istnienia

`GET /api/initiatives-v4/goals/:goalId/initiatives`: `200 {initiatives: []}` → `404 {error: 'Goal not found'}`,
gdy `goalId` nie należy do organizacji wołającego. Zmiana pochodzi z commita `fffba8a8bd` (P.8c),
gdzie `getGoalInitiatives` zaczęło zwracać `null` zamiast `[]`
(`server/src/services/initiativeGovernanceService.ts:224`), a trasa mapuje `null` na 404
(`server/src/routes/initiative-governance.routes.ts:179-182`).

To jest PODNIESIENIE kontraktu do mocniejszego, nie osłabienie: pusta tablica z kodem 200 była
potwierdzeniem istnienia obcego celu (enumeracja identyfikatorów przez różnicę 200/404).
Dwa testy bezpieczeństwa zapisywały stary, słabszy kontrakt i zostały podniesione do `toBeNull()`
(`server/src/routes/__tests__/cross-org-idor.test.ts:1205`,
`tests/unit/backend/services/initiativeGovernanceService.crossorg.test.ts:118`).

Skutek dla frontu: `Api.goalsGetInitiatives` (`src/services/api.ts:21204`) musi obsłużyć 404 jako
„nie ma takiego celu w mojej organizacji", a nie jako pustą listę. Na dziś ta metoda nie ma ANI
JEDNEGO wołacza w `src/**` (jedyne dwa wystąpienia to definicja oraz komentarz w
`src/contracts/tableSurface/surfaceRegister.ts:703`), więc zmiana nie psuje żadnego istniejącego ekranu.

Walidacja: `impactWeights` zawiera dokładnie trzy dodatnie liczby; progi dni są dodatnimi liczbami całkowitymi; SLA używa `BUSINESS_DAYS|CALENDAR_DAYS`; granice wysycenia są w `(0,1]` i rosną; bufor jest w `[0,1)`.

## Dowody testowe

Testy DB miały jawne `DATABASE_URL` własnego PG, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `ENABLE_V8_GLOBAL=true`, `NODE_ENV=test`.

- Celowany pakiet Day 33: `10 files PASS`, `65 tests PASS`.
- Importery izolacji uruchomiono osobno; test integracyjny serwisu, test tras i test Day 33 przechodzą.
- Pełny zakres końcowy: `113 files PASS`, `21 FAIL`, `1 SKIP`; `1070 tests PASS`, `176 FAIL`, `26 SKIP`.
- Baseline: `106 files PASS`, `21 FAIL`, `1 SKIP`; `1022 tests PASS`, `175 FAIL`, `26 SKIP`.

Nie ogłaszam pełnego pakietu jako PASS. Liczba czerwonych plików nie wzrosła, ale liczba czerwonych testów jest o jeden wyższa od baseline. Celowane testy zmienionych kontraktów przechodzą; różnicy w szerokim, współdzielącym stan pakiecie nie przypisano do Day 33. Znany `cross-org-idor.test.ts` pozostaje czerwony przez zastany mock bez `validateOrgMembership` i odpowiedzi `ORG_MEMBERSHIP_REVOKED`; nie osłabiano testu ani middleware.

Po testach baza zawierała `0` organizacji, `0` polityk i `0` linków z prefiksami fixture'ów Day 33/35.

## STOP-y i granice

- P.9: `STOP`; nie wracano do pozycji i nie ma commita.
- Nie zbudowano źródeł realnej dostępności; wymagają osobnej decyzji właściciela.
- Dwa istniejące magazyny polityk pozostają ryzykiem; nie utworzono trzeciego ani nie migrowano danych bez decyzji.
- Wynik techniczny nie jest akceptacją właściciela, dowodem UI ani zgodą na release.
- `git diff --name-only 87e7cecf3a..HEAD -- src` jest puste; diff `server/src/services/results/**` i `inferPerspective` jest pusty.
- Kontener Day 33 jest usuwany przez `docker rm -fv cx-day33-pg`; bez globalnego czyszczenia wolumenów.
