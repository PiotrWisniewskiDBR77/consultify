# Testy manualne F2 — stageHandoffService (Stage Handoffs)

**Moduł:** Inicjatywy / Lifecycle  
**Feature:** F2 — stageHandoffService (rejestrowanie handoffów przy każdej zmianie statusu inicjatywy)  
**Data:** 2026-06-25  
**Autor:** Claude (CTO)  
**Status bazowy kodu:** feat/deliverables-w1

---

## Kluczowe elementy F2

- `stageHandoffService.ts` — `evaluateHandoff()`, `recordHandoff()`, `handoffBoundary()`, `getStatusesForModule()`
- Handoffy zapisywane są w tabeli `audit_events` z `action = 'initiative.handoff'`
- Każda zmiana statusu przez `PATCH /api/initiatives/:id/status` wywołuje `recordStageHandoff()` (fire-and-forget)
- `DecisionController` rejestruje handoffy przy auto-blokowaniu i auto-odblokowaniu
- Liniatura inicjatywy: `GET /api/initiatives/:id/lineage`
- Przepływ statusów: DRAFT → PENDING_REVIEW → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING → ARCHIVED

---

## F2-01 — Rejestracja handoffu DRAFT → PENDING_REVIEW

**Cel:** Weryfikacja, że zmiana statusu z DRAFT na PENDING_REVIEW zapisuje handoff w audit_events.

**Preconditions:**
- Zalogowany użytkownik z rolą manager lub admin
- Inicjatywa istniejąca w statusie DRAFT (np. `initiativeId = X`)

**Kroki:**
1. Otwórz inicjatywę w statusie DRAFT.
2. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "PENDING_REVIEW" }`.
3. Zweryfikuj odpowiedź HTTP.
4. Wyślij `GET /api/initiatives/X/status-history` lub sprawdź audit_events przez `GET /api/initiatives/X/lineage`.

**Oczekiwany wynik:**
- HTTP 200 ze zaktualizowanym statusem `PENDING_REVIEW`.
- W `audit_events` pojawia się rekord z `action = 'initiative.handoff'`, `metadata_json.fromStatus = 'DRAFT'`, `metadata_json.toStatus = 'PENDING_REVIEW'`, `metadata_json.boundary = 'within_module'`.
- Pole `review_requested_at` oraz `review_requested_by` wypełnione w rekordzie inicjatywy.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-02 — Rejestracja handoffu APPROVED → SCHEDULED

**Cel:** Weryfikacja handoffu przy przejściu APPROVED → SCHEDULED (granica `initiative_to_execution`).

**Preconditions:**
- Inicjatywa w statusie APPROVED.
- Inicjatywa posiada: `planned_start_date`, `planned_end_date`, minimum 1 milestone, zatwierdzoną decyzję `SCHEDULE_MILESTONES`.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "SCHEDULED" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events` dla tego `resource_id`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'APPROVED'`, `toStatus = 'SCHEDULED'`, `boundary = 'initiative_to_execution'` (APPROVED = moduł `initiatives`, SCHEDULED = moduł `execution`).
- Utworzony snapshot `initiative_schedule_baselines`.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-03 — Rejestracja handoffu SCHEDULED → EXECUTING

**Cel:** Weryfikacja handoffu przy starcie egzekucji.

**Preconditions:**
- Inicjatywa w statusie SCHEDULED.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "EXECUTING" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'SCHEDULED'`, `toStatus = 'EXECUTING'`, `boundary = 'within_module'` (oba statusy należą do modułu `execution`).
- Pole `execution_started_at` wypełnione w inicjatywie.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-04 — Rejestracja handoffu EXECUTING → DONE

**Cel:** Weryfikacja handoffu przy zamknięciu egzekucji.

**Preconditions:**
- Inicjatywa w statusie EXECUTING.
- Brak otwartych decyzji blokujących egzekucję.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "DONE" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'EXECUTING'`, `toStatus = 'DONE'`, `boundary = 'execution_to_results'` (EXECUTING = `execution`, DONE jest granicą do `benefits`).
- Pola `done_at`, `done_by`, `completed_at` wypełnione.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-05 — Rejestracja handoffu DONE → TRACKING

**Cel:** Weryfikacja handoffu przy przejściu do śledzenia korzyści.

**Preconditions:**
- Inicjatywa w statusie DONE.
- Inicjatywa posiada `owner_business_id` oraz co najmniej 1 KPI z target i unit.
- Wymagana zatwierdzona decyzja bramkowa (jeśli skonfigurowane `gateApproved`).

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "TRACKING" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'DONE'`, `toStatus = 'TRACKING'`, `boundary = 'execution_to_results'` lub `results_to_finance` (zależy od klasyfikacji modułu `benefits`).
- Pola `tracking_started_at`, `tracking_started_by`, `tracking_start_date`, `tracking_end_date` wypełnione.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-06 — Rejestracja handoffu dowolny → BLOCKED

**Cel:** Weryfikacja, że przejście do BLOCKED rejestruje handoff z poprawnym boundary.

**Preconditions:**
- Inicjatywa w statusie EXECUTING.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "BLOCKED", "reason": "Brak zasobów" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'EXECUTING'`, `toStatus = 'BLOCKED'`, `boundary = 'within_module'`.
- Pola `blocked_at`, `blocked_reason` wypełnione w inicjatywie.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-07 — Rejestracja handoffu BLOCKED → EXECUTING (odblokowanie)

**Cel:** Weryfikacja handoffu przy ręcznym odblokowaniu inicjatywy.

**Preconditions:**
- Inicjatywa w statusie BLOCKED (zablokowana ręcznie, nie przez decyzję).

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "EXECUTING" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'BLOCKED'`, `toStatus = 'EXECUTING'`, `boundary = 'within_module'`.
- Pole `unblocked_at` wypełnione, `blocked_at` i `blocked_reason` wyczyszczone (NULL).

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-08 — Rejestracja handoffu dowolny → CANCELLED

**Cel:** Weryfikacja handoffu przy anulowaniu inicjatywy z różnych statusów.

**Preconditions:**
- Inicjatywa w statusie EXECUTING (lub innym, nie ARCHIVED).

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "CANCELLED", "reason": "Zmiana strategii" }`.
2. Sprawdź odpowiedź HTTP.
3. Sprawdź `audit_events`.

**Oczekiwany wynik:**
- HTTP 200.
- Rekord handoffu: `fromStatus = 'EXECUTING'`, `toStatus = 'CANCELLED'`.
- Pola `cancelled_at`, `cancelled_reason` wypełnione.
- `boundary = 'within_module'` (EXECUTING i CANCELLED są w obrębie execution → terminal, może być `unknown` — zweryfikować faktyczne działanie).

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-09 — evaluateHandoff: DRAFT → CANCELLED — przejście dozwolone

**Cel:** Weryfikacja, że evaluateHandoff zwraca `allowed: true` dla DRAFT → CANCELLED.

**Preconditions:**
- Inicjatywa w statusie DRAFT.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "CANCELLED" }`.
2. Sprawdź odpowiedź HTTP.

**Oczekiwany wynik:**
- HTTP 200 — przejście dozwolone wg VALID_TRANSITIONS (`DRAFT → [PENDING_REVIEW, CANCELLED]`).
- Brak błędu walidacji readiness (CANCELLED nie wymaga hasDates / hasMilestone).
- Handoff zapisany w `audit_events`.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-10 — evaluateHandoff: APPROVED → EXECUTING (pominięcie SCHEDULED) — niedozwolone

**Cel:** Weryfikacja, że próba ominięcia kroku SCHEDULED jest blokowana.

**Preconditions:**
- Inicjatywa w statusie APPROVED.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "EXECUTING" }`.
2. Sprawdź odpowiedź HTTP i treść błędu.

**Oczekiwany wynik:**
- HTTP 400 z kodem błędu `INVALID_TRANSITION`.
- Odpowiedź zawiera pole `validNext` z listą dopuszczalnych przejść: `["SCHEDULED", "CANCELLED"]`.
- Żaden handoff NIE jest zapisany w `audit_events` dla tej próby.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-11 — evaluateHandoff: DONE → DRAFT (wstecz) — niedozwolone

**Cel:** Weryfikacja blokady cofania statusu.

**Preconditions:**
- Inicjatywa w statusie DONE.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "DRAFT" }`.
2. Sprawdź odpowiedź HTTP i treść błędu.

**Oczekiwany wynik:**
- HTTP 400 z kodem `INVALID_TRANSITION`.
- `validNext` zawiera jedynie `["TRACKING"]`.
- Brak handoffu w `audit_events`.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-12 — evaluateHandoff: EXECUTING → DONE z hasDates=true — dozwolone

**Cel:** Weryfikacja, że presence wymaganych pól (daty, milestone, kpi, owner) pozwala na przejście EXECUTING → DONE.

**Preconditions:**
- Inicjatywa w statusie EXECUTING z: `planned_start_date`, `planned_end_date`, co najmniej 1 milestone, co najmniej 1 KPI z target i unit, `owner_business_id` ustawiony.
- Brak otwartych decyzji blokujących egzekucję.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "DONE" }`.
2. Sprawdź odpowiedź HTTP.

**Oczekiwany wynik:**
- HTTP 200 — brak błędu readiness.
- Handoff zapisany: `fromStatus = 'EXECUTING'`, `toStatus = 'DONE'`.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-13 — evaluateHandoff: EXECUTING → DONE bez dat — reasons wypełnione

**Cel:** Weryfikacja, że brak wymaganych pól (daty) blokuje przejście EXECUTING → DONE i zwraca powody.

**Preconditions:**
- Inicjatywa w statusie EXECUTING bez `planned_start_date`, bez milestones, bez KPI z target, bez `owner_business_id`.

**Kroki:**
1. Wyślij `PATCH /api/initiatives/X/status` z body `{ "status": "DONE" }`.
2. Sprawdź odpowiedź HTTP i treść błędu.

**Oczekiwany wynik:**
- HTTP 400 z kodem `GATE_BLOCKED`.
- Odpowiedź zawiera pole `missing[]` z co najmniej jedną pozycją wyjaśniającą brak wymaganego pola (daty / milestone / KPI / owner).
- Brak handoffu w `audit_events`.

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-14 — getStatusesForModule: moduł execution — filtrowanie inicjatyw

**Cel:** Weryfikacja, że endpoint inicjatyw z filtrem `module=execution` zwraca tylko statusy SCHEDULED/EXECUTING/BLOCKED/DONE.

**Preconditions:**
- W systemie istnieją inicjatywy w różnych statusach (DRAFT, APPROVED, SCHEDULED, EXECUTING, BLOCKED, DONE, TRACKING).

**Kroki:**
1. Wyślij `GET /api/initiatives?module=execution`.
2. Sprawdź listę zwróconych inicjatyw i ich statusy.

**Oczekiwany wynik:**
- Zwrócone inicjatywy mają wyłącznie statusy z zestawu `{SCHEDULED, EXECUTING, BLOCKED, DONE}`.
- Inicjatywy DRAFT / APPROVED / TRACKING / ARCHIVED NIE pojawiają się na liście.

**API endpoint:** `GET /api/initiatives?module=execution`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-15 — getStatusesForModule: moduł results — filtrowanie inicjatyw

**Cel:** Weryfikacja, że filtr `module=results` (benefits) zwraca tylko statusy DONE/TRACKING.

**Preconditions:**
- W systemie istnieją inicjatywy w statusach DONE i TRACKING.

**Kroki:**
1. Wyślij `GET /api/initiatives?module=results`.
2. Sprawdź statusy zwróconych inicjatyw.

**Oczekiwany wynik:**
- Tylko inicjatywy o statusach `DONE` i `TRACKING` na liście.
- Inicjatywy EXECUTING / BLOCKED / ARCHIVED NIE pojawiają się.

**API endpoint:** `GET /api/initiatives?module=results`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-16 — getStatusesForModule: moduł finance — filtrowanie inicjatyw

**Cel:** Weryfikacja filtrowania dla modułu finance (TRACKING/ARCHIVED).

**Preconditions:**
- W systemie istnieją inicjatywy w statusach TRACKING i ARCHIVED.

**Kroki:**
1. Wyślij `GET /api/initiatives?module=finance`.
2. Sprawdź statusy zwróconych inicjatyw.

**Oczekiwany wynik:**
- Tylko inicjatywy o statusach `TRACKING` i `ARCHIVED` na liście.
- Inicjatywy EXECUTING / DONE / DRAFT NIE pojawiają się.

**API endpoint:** `GET /api/initiatives?module=finance`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-17 — DecisionController: auto-blokowanie inicjatywy przez decyzję

**Cel:** Weryfikacja, że utworzenie blokującej decyzji powiązanej z inicjatywą zmienia status inicjatywy na BLOCKED i rejestruje handoff.

**Preconditions:**
- Inicjatywa X w statusie EXECUTING.
- Użytkownik z uprawnieniami do tworzenia decyzji.

**Kroki:**
1. Wyślij `POST /api/decisions` z body zawierającym `{ "isBlocker": true, "initiativeImpacts": [{ "initiativeId": "X" }], ... }` (dokładna struktura wg API decisions).
2. Sprawdź odpowiedź HTTP.
3. Pobierz inicjatywę: `GET /api/initiatives/X`.
4. Sprawdź `audit_events` dla inicjatywy X.

**Oczekiwany wynik:**
- HTTP 201 dla decyzji.
- Inicjatywa X ma status `BLOCKED`, pole `blocked_at` wypełnione, `blocked_reason` zawiera tag decyzji.
- W `audit_events` dla inicjatywy X: rekord `action = 'initiative.handoff'` z `fromStatus = 'EXECUTING'`, `toStatus = 'BLOCKED'`.

**API endpoint:** `POST /api/decisions`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-18 — DecisionController: auto-odblokowanie przez rozwiązanie decyzji

**Cel:** Weryfikacja, że rozwiązanie blokującej decyzji automatycznie odblokuje inicjatywę i zarejestruje handoff BLOCKED → EXECUTING.

**Preconditions:**
- Inicjatywa X w statusie BLOCKED wskutek blokującej decyzji D.
- Brak innych blokujących decyzji dla inicjatywy X.

**Kroki:**
1. Wyślij `PATCH /api/decisions/D` z body rozwiązującym decyzję (np. `{ "status": "resolved" }` lub właściwy endpoint resolve — zweryfikować API decisions).
2. Sprawdź odpowiedź HTTP.
3. Pobierz inicjatywę: `GET /api/initiatives/X`.
4. Sprawdź `audit_events` dla inicjatywy X.

**Oczekiwany wynik:**
- HTTP 200 dla aktualizacji decyzji.
- Inicjatywa X ma status `EXECUTING`, pole `unblocked_at` wypełnione, `blocked_reason = NULL`, `blocked_at = NULL`.
- W `audit_events`: nowy rekord handoffu `fromStatus = 'BLOCKED'`, `toStatus = 'EXECUTING'`.

**API endpoint:** `PATCH /api/decisions/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-19 — DecisionController: wiele blokad — ostatnia nierozwiązana → inicjatywa zostaje BLOCKED

**Cel:** Weryfikacja, że inicjatywa pozostaje BLOCKED, gdy rozwiązano tylko część blokujących decyzji.

**Preconditions:**
- Inicjatywa X w statusie BLOCKED wskutek 2 blokujących decyzji: D1 i D2.

**Kroki:**
1. Rozwiąż decyzję D1: `PATCH /api/decisions/D1` ze statusem `resolved`.
2. Pobierz inicjatywę: `GET /api/initiatives/X`.
3. Sprawdź `audit_events` dla inicjatywy X.

**Oczekiwany wynik:**
- HTTP 200 dla D1.
- Inicjatywa X nadal ma status `BLOCKED` (D2 wciąż aktywna).
- W `audit_events` NIE pojawia się nowy handoff BLOCKED → EXECUTING.
- `blocked_reason` nadal zawiera odniesienie do D2.

**API endpoint:** `PATCH /api/decisions/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-20 — Lineage: endpoint zwraca tablicę handoffów

**Cel:** Weryfikacja, że `GET /api/initiatives/:id/lineage` zwraca strukturę zawierającą informacje o handoffach.

**Preconditions:**
- Inicjatywa X z co najmniej jedną zmianą statusu (np. DRAFT → PENDING_REVIEW).

**Kroki:**
1. Wyślij `GET /api/initiatives/X/lineage`.
2. Sprawdź strukturę odpowiedzi.

**Oczekiwany wynik:**
- HTTP 200.
- Odpowiedź zawiera pola: `source`, `initiative`, `downstream`.
- Pole `initiative` zawiera co najmniej `{ id, title, status }`.
- Jeśli implementacja zwraca handoffy (mogą być w `downstream` lub osobnym polu) — powinny być widoczne co najmniej metadane przejść.

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-21 — Lineage: handoffy posortowane chronologicznie

**Cel:** Weryfikacja kolejności chronologicznej handoffów w historii.

**Preconditions:**
- Inicjatywa X przeszła przez co najmniej 3 zmiany statusu w różnym czasie (np. DRAFT → PENDING_REVIEW → REVIEW → PROMOTED).

**Kroki:**
1. Wyślij `GET /api/initiatives/X/status-history` lub `GET /api/initiatives/X/lineage`.
2. Przejrzyj listę zdarzeń/handoffów.

**Oczekiwany wynik:**
- Zdarzenia posortowane rosnąco wg `ts` / `created_at`.
- Kolejność: najpierw najstarszy handoff, na końcu najnowszy.
- Brak duplikatów tego samego przejścia.

**API endpoint:** `GET /api/initiatives/:id/status-history` lub `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-22 — Lineage: struktura rekordu handoffu (pola wymagane)

**Cel:** Weryfikacja, że rekord handoffu w audit_events zawiera wymagane pola.

**Preconditions:**
- Inicjatywa X po co najmniej jednej zmianie statusu.
- Dostęp do rekordów `audit_events` (przez endpoint lub bezpośrednio przez DB w środowisku testowym).

**Kroki:**
1. Wykonaj `SELECT * FROM audit_events WHERE resource_id = 'X' AND action = 'initiative.handoff' LIMIT 1`.
2. Sprawdź strukturę rekordu.

**Oczekiwany wynik:**
- Rekord zawiera pola: `action = 'initiative.handoff'`, `resource_type = 'initiative'`, `resource_id`.
- `metadata_json` zawiera: `fromStatus`, `toStatus`, `boundary`, `fromModule`, `toModule`.
- `ts` (timestamp) jest wypełnione.
- Rekord nie powoduje wyjątku — błędy są pochłaniane przez `logger.warn` (handoff jest fire-and-forget).

**API endpoint:** bezpośredni dostęp DB (lub endpoint audytu jeśli dostępny)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-23 — Lineage: source_type wskazuje źródło inicjatywy

**Cel:** Weryfikacja, że lineage poprawnie identyfikuje typ źródła inicjatywy (assessment/tool/report).

**Preconditions:**
- Inicjatywa X utworzona z oceny (assessment), z innego narzędzia lub ręcznie.

**Kroki:**
1. Wyślij `GET /api/initiatives/X/lineage`.
2. Sprawdź pole `source`.

**Oczekiwany wynik:**
- Pole `source` jest obiektem `{ type: string, id: string }` lub `null` jeśli inicjatywa ręczna.
- `type` odpowiada faktycznemu źródłu (np. `'assessment'`, `'tool'`, `'report'`).
- Inicjatywy ręczne (bez źródła) mają `source: null`.

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-24 — F2.5 Results→Finance: modele finansowe powiązane z inicjatywą

**Cel:** Weryfikacja, że modele finansowe można pobrać po `initiativeId`.

**Preconditions:**
- Inicjatywa X w statusie TRACKING lub DONE.
- Istnieje model finansowy powiązany z inicjatywą X (`initiative_id = X`).

**Kroki:**
1. Wyślij `GET /api/financial-modeling/models?initiativeId=X` (lub analogiczny parametr filtrujący — zweryfikować wsparcie filtra w endpoincie `GET /api/financial-modeling/models`).
2. Sprawdź zwróconą listę.

**Oczekiwany wynik:**
- HTTP 200.
- Lista zawiera co najmniej 1 model z `initiative_id = X`.
- Modele przypisane do innej inicjatywy lub bez initiative_id NIE pojawiają się na liście.

**API endpoint:** `GET /api/financial-modeling/models` (z filtrem `initiativeId`)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-25 — F2.5 Results→Finance: tworzenie modelu finansowego z initiative_id

**Cel:** Weryfikacja poprawnego powiązania nowo tworzonego modelu finansowego z inicjatywą.

**Preconditions:**
- Inicjatywa X w statusie TRACKING.
- Użytkownik z uprawnieniami do modeli finansowych.

**Kroki:**
1. Wyślij `POST /api/financial-modeling/models` z body `{ "initiative_id": "X", "name": "Model testowy", ... }`.
2. Sprawdź odpowiedź HTTP.
3. Pobierz model: `GET /api/financial-modeling/models/:modelId`.

**Oczekiwany wynik:**
- HTTP 201 z nowo utworzonym modelem.
- Model zawiera `initiative_id = X`.
- Pobieranie modelu przez GET zwraca ten sam `initiative_id`.

**API endpoint:** `POST /api/financial-modeling/models`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-26 — F2.6 Hub inicjatyw: widok filtruje statusy poprawnie

**Cel:** Weryfikacja, że hub inicjatyw (lista główna) wyświetla inicjatywy ze wszystkich statusów lub wg domyślnego filtra modułu.

**Preconditions:**
- Inicjatywy w statusach: DRAFT, APPROVED, SCHEDULED, EXECUTING, DONE, TRACKING.

**Kroki:**
1. Otwórz widok `/initiatives` w przeglądarce.
2. Sprawdź, które inicjatywy są widoczne bez dodatkowych filtrów.
3. Przełącz widok na poszczególne moduły (jeśli takie przełączniki istnieją w UI) i weryfikuj filtry.

**Oczekiwany wynik:**
- Widok domyślny pokazuje inicjatywy z wszystkich aktywnych statusów (lub właściwy podzbiór zgodny z logiką `getStatusesForModule`).
- Każdy widok modułowy (Execution Hub, Results Hub itp.) pokazuje tylko swój zestaw statusów.
- Brak inicjatyw z nieprawidłowych statusów w danym widoku.

**API endpoint:** `GET /api/initiatives` (różne filtry modułu) + UI `/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-27 — F2.6 Execution Hub: filtr statusów SCHEDULED/EXECUTING/BLOCKED/DONE

**Cel:** Weryfikacja, że Execution Hub w UI pokazuje tylko statusy egzekucji.

**Preconditions:**
- Inicjatywy w statusach DRAFT, APPROVED, SCHEDULED, EXECUTING, BLOCKED, DONE, TRACKING.

**Kroki:**
1. Otwórz widok Execution Hub (`/implementation` lub `/execution`).
2. Sprawdź listę widocznych inicjatyw.
3. Sprawdź żądania API w DevTools — filtr statusów przesyłany w query.

**Oczekiwany wynik:**
- UI pokazuje tylko inicjatywy o statusach `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE`.
- W żądaniu API widać filtr zgodny z `getStatusesForModule('execution')`.
- Inicjatywy DRAFT / APPROVED / TRACKING nie pojawiają się.

**API endpoint:** `GET /api/initiatives?module=execution` (lub wewnętrzna logika filtrowania)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-28 — Kompletność: pełny cykl DRAFT → TRACKING rejestruje 4+ handoffy

**Cel:** Weryfikacja end-to-end, że pełny lifecycle inicjatywy generuje kompletną sekwencję handoffów.

**Preconditions:**
- Świeża inicjatywa X w statusie DRAFT.
- Spełnione wszystkie wymagania dla każdego przejścia (decyzje bramkowe, daty, milestone, KPI, owner).

**Kroki:**
1. `PATCH /api/initiatives/X/status` → `PENDING_REVIEW`.
2. `PATCH /api/initiatives/X/status` → `REVIEW`.
3. `PATCH /api/initiatives/X/status` → `PROMOTED`.
4. `PATCH /api/initiatives/X/status` → `PLANNING`.
5. `PATCH /api/initiatives/X/status` → `APPROVED`.
6. `PATCH /api/initiatives/X/status` → `SCHEDULED`.
7. `PATCH /api/initiatives/X/status` → `EXECUTING`.
8. `PATCH /api/initiatives/X/status` → `DONE`.
9. `PATCH /api/initiatives/X/status` → `TRACKING`.
10. Sprawdź `audit_events` dla inicjatywy X z filtrem `action = 'initiative.handoff'`.

**Oczekiwany wynik:**
- W `audit_events` widocznych co najmniej 9 rekordów handoffów odpowiadających kolejnym przejściom.
- Każdy handoff ma poprawne `fromStatus` i `toStatus`.
- `boundary` zmienia się prawidłowo (`within_module` → `initiative_to_execution` przy APPROVED→SCHEDULED → `execution_to_results` przy EXECUTING→DONE → dalej).

**API endpoint:** `PATCH /api/initiatives/:id/status` (9×) + weryfikacja audit_events

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-29 — Lineage: zablokowanie przez decyzję widoczne w historii

**Cel:** Weryfikacja, że auto-blokowanie przez DecisionController pojawia się w historii handoffów.

**Preconditions:**
- Inicjatywa X w statusie EXECUTING.

**Kroki:**
1. Utwórz blokującą decyzję powiązaną z inicjatywą X: `POST /api/decisions` z `isBlocker: true`.
2. Sprawdź `audit_events` dla X.
3. Opcjonalnie: wywołaj `GET /api/initiatives/X/lineage`.

**Oczekiwany wynik:**
- W `audit_events` pojawia się handoff `fromStatus = 'EXECUTING'`, `toStatus = 'BLOCKED'` z timestamp po utworzeniu decyzji.
- Rekord handoffu ma `metadata_json.boundary` (wartość do weryfikacji — prawdopodobnie `within_module`).
- Handoff jest tworzony przez `DecisionController`, nie przez użytkownika bezpośrednio (brak wywołania `PATCH /api/initiatives/:id/status`).

**API endpoint:** `POST /api/decisions` → weryfikacja audit_events

**Bramka:** ✅ PASS / ❌ FAIL

---

## F2-30 — Lineage: endpoint zwraca source + chain handoffów

**Cel:** Weryfikacja, że `GET /api/initiatives/:id/lineage` zwraca pełny obraz: źródło + downstream + kontekst lifecycle.

**Preconditions:**
- Inicjatywa X utworzona z assessment (lub innego źródła).
- Inicjatywa X przeszła co najmniej przez APPROVED → SCHEDULED → EXECUTING.
- Inicjatywa X posiada dane downstream: status egzekucji i/lub KPI w benefits_register.

**Kroki:**
1. Wyślij `GET /api/initiatives/X/lineage`.
2. Przeanalizuj pełną strukturę odpowiedzi JSON.

**Oczekiwany wynik:**
- HTTP 200.
- `source` — zawiera `{ type, id }` wskazujące na assessment/tool/raport źródłowy.
- `initiative` — zawiera `{ id, title, status }` inicjatywy.
- `downstream` — zawiera:
  - `executionStatus` jeśli inicjatywa jest w execution (np. `'executing'` lub `'blocked'`).
  - `benefits` — tablica KPI z benefits_register (jeśli tabela istnieje i dane są dostępne).
- Brak błędu 500 nawet gdy benefits_register nie istnieje (serwis obsługuje brak tabeli gracefully).

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## Podsumowanie pokrycia

| Obszar | Testy |
|---|---|
| Rejestracja handoffów (status transitions) | F2-01 – F2-08 |
| evaluateHandoff — walidacja przejść | F2-09 – F2-13 |
| getStatusesForModule — filtry hubów | F2-14 – F2-16, F2-26 – F2-27 |
| DecisionController — auto-block/unblock | F2-17 – F2-19 |
| Lineage — struktura i pola | F2-20 – F2-23, F2-30 |
| Results→Finance — modele finansowe | F2-24 – F2-25 |
| Pełny cykl lifecycle | F2-28 |
| Block przez decyzję w lineage | F2-29 |

**Łącznie: 30 scenariuszy**
