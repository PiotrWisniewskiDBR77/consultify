# TESTY MANUALNE — F5: OBSERWOWALNOŚĆ (Lineage + Funnel Stats + Dedup kolumn)

**Moduł:** F5 — Obserwowalność  
**Data:** 2026-06-25  
**Wersja:** 1.0  
**Środowisko:** staging / lokalny dev  
**Łączna liczba scenariuszy:** 30

---

## Kontekst F5

F5 dotyczy obserwowalności danych inicjatyw:
- `GET /api/initiatives/:id/lineage` — zwraca `{ initiative, source, handoffs[], results[], financeModels[] }`
- `GET /api/initiatives/funnel/stats` — zwraca `{ byStatus, bySource, conversions[], totalActive }`
- `docs/initiatives/INITIATIVE_DATA_MODEL_SOT.md` — kanoniczna dokumentacja kolumn
- `20260624_initiative_column_dedup.sql` — backfill: `axis←drd_axis`, `area←drd_area`, `expected_roi←estimated_roi`

---

## F5-01 — GET /api/initiatives/:id/lineage → 200 + data.initiative obecne

**Cel:** Weryfikacja, że endpoint lineage zwraca status 200 i zawiera obiekt `initiative` z danymi.

**Preconditions:**
- Istnieje inicjatywa z konkretnym ID (np. `abc-123`)
- Użytkownik zalogowany (token Bearer w headerze)

**Kroki:**
1. Otwórz DevTools → Network lub użyj klienta HTTP (curl/Postman)
2. Wyślij request: `GET /api/initiatives/abc-123/lineage` z headerem `Authorization: Bearer <token>`
3. Sprawdź kod statusu i treść odpowiedzi

**Oczekiwany wynik:**
- Status HTTP: `200 OK`
- Odpowiedź JSON zawiera pole `initiative` z danymi (id, title, status)
- Pole `initiative.id` = `abc-123`
- Czas odpowiedzi < 3 s

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-02 — Lineage: source.type ustawiony (assessment/tool/report/manual)

**Cel:** Weryfikacja, że pole `source.type` w odpowiedzi lineage zawiera poprawną wartość odpowiadającą sposobowi utworzenia inicjatywy.

**Preconditions:**
- Przynajmniej 2 inicjatywy: jedna utworzona ręcznie (`manual`), jedna wygenerowana z assessmentu (`assessment`)

**Kroki:**
1. Wyślij `GET /api/initiatives/<id-manual>/lineage`
2. Sprawdź `data.source.type`
3. Wyślij `GET /api/initiatives/<id-assessment>/lineage`
4. Sprawdź `data.source.type`

**Oczekiwany wynik:**
- Inicjatywa ręczna: `source.type = "manual"`
- Inicjatywa z assessmentu: `source.type = "assessment"`
- Wartość `source.type` należy do zbioru: `assessment | tool | report | manual`
- Pole `source` nie jest `null` dla żadnej inicjatywy

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-03 — Lineage: handoffs[] posortowane rosnąco po created_at

**Cel:** Weryfikacja, że lista handoffów w odpowiedzi lineage jest posortowana chronologicznie (najstarszy pierwszy).

**Preconditions:**
- Inicjatywa z co najmniej 2 przejściami statusu (handoffami) w różnych momentach czasu

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage`
2. Wyodrębnij tablicę `data.handoffs`
3. Sprawdź kolejność elementów według pola `at` (lub `created_at`)

**Oczekiwany wynik:**
- `handoffs[0].at` ≤ `handoffs[1].at` ≤ ... (rosnący porządek chronologiczny)
- Brak elementów z `at = null` jeśli handoff wystąpił
- Tablica posortowana po stronie serwera (nie wymaga sortowania po stronie klienta)

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-04 — Lineage: handoffs zawierają pola from/to/at

**Cel:** Weryfikacja, że każdy element tablicy `handoffs` zawiera wymagane pola: `from`, `to`, `at`.

**Preconditions:**
- Inicjatywa z co najmniej jednym handoffem (zmianą statusu)

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage`
2. Wybierz pierwszy element `data.handoffs[0]`
3. Sprawdź obecność pól `from`, `to`, `at`

**Oczekiwany wynik:**
- `handoffs[0].from` — poprzedni status (np. `"DRAFT"`)
- `handoffs[0].to` — nowy status (np. `"APPROVED"`)
- `handoffs[0].at` — timestamp (ISO 8601, np. `"2026-06-24T10:00:00Z"`)
- Żadne z wymaganych pól nie jest `null` ani `undefined`

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-05 — Lineage: po przejściu DRAFT→APPROVED → handoffs ma 1 wpis

**Cel:** Weryfikacja, że pojedyncza zmiana statusu powoduje pojawienie się dokładnie 1 wpisu w tablicy `handoffs`.

**Preconditions:**
- Inicjatywa w statusie DRAFT BEZ wcześniejszych handoffów (nowa inicjatywa)

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage` → zanotuj `handoffs.length` (oczekiwany: 0)
2. Zmień status inicjatywy z DRAFT na APPROVED (przez UI lub API)
3. Ponownie wyślij `GET /api/initiatives/<id>/lineage`
4. Sprawdź `data.handoffs.length`

**Oczekiwany wynik:**
- Po zmianie statusu: `handoffs.length = 1`
- `handoffs[0].from = "DRAFT"`, `handoffs[0].to = "APPROVED"`
- Pole `at` zawiera timestamp z momentu zmiany statusu

**API endpoint:** `PATCH /api/initiatives/:id/status`, `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-06 — Lineage: pełny cykl życia 5 przejść statusów → handoffs ma 5 wpisów

**Cel:** Weryfikacja, że każda zmiana statusu generuje dokładnie jeden wpis w `handoffs`, bez pominięć i duplikatów.

**Preconditions:**
- Inicjatywa w statusie DRAFT bez wcześniejszych handoffów

**Kroki:**
1. Wykonaj sekwencję zmian statusu:
   - DRAFT → APPROVED
   - APPROVED → SCHEDULED
   - SCHEDULED → EXECUTING
   - EXECUTING → COMPLETED
   - COMPLETED → ARCHIVED
2. Po każdej zmianie opcjonalnie sprawdź `handoffs.length`
3. Po ostatniej zmianie wyślij `GET /api/initiatives/<id>/lineage`
4. Sprawdź `data.handoffs.length`

**Oczekiwany wynik:**
- `handoffs.length = 5`
- Każdy wpis zawiera poprawną parę `from/to` odpowiadającą kolejnym przejściom
- Wpisy posortowane chronologicznie

**API endpoint:** `PATCH /api/initiatives/:id/status` (×5), `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-07 — Lineage: results[] obecne dla inicjatywy z wynikami

**Cel:** Weryfikacja, że pole `results` w odpowiedzi lineage zawiera dane gdy inicjatywa ma przypisane rezultaty.

**Preconditions:**
- Inicjatywa z co najmniej jednym przypisanym wynikiem/rezultatem (moduł M15 Rezultaty)

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage`
2. Sprawdź pole `data.results`

**Oczekiwany wynik:**
- `data.results` jest tablicą (Array)
- `data.results.length >= 1`
- Każdy element zawiera podstawowe dane rezultatu (np. id, title, value)
- Pole `results` nie jest `null` ani `undefined`

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-08 — Lineage: financeModels[] obecne dla inicjatywy z modelem finansowym

**Cel:** Weryfikacja, że pole `financeModels` zawiera dane gdy inicjatywa ma przypisany model finansowy (M16 Finanse).

**Preconditions:**
- Inicjatywa z co najmniej jednym przypisanym modelem finansowym

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage`
2. Sprawdź pole `data.financeModels`

**Oczekiwany wynik:**
- `data.financeModels` jest tablicą
- `data.financeModels.length >= 1`
- Każdy element zawiera identyfikator modelu finansowego
- Pole nie jest `null` ani `undefined`

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-09 — Lineage: 404 dla nieistniejącego ID inicjatywy

**Cel:** Weryfikacja poprawnej obsługi błędu gdy zapytanie dotyczy nieistniejącej inicjatywy.

**Preconditions:**
- Użytkownik zalogowany
- ID `NIEISTNIEJACE-99999` na pewno nie istnieje w bazie

**Kroki:**
1. Wyślij `GET /api/initiatives/NIEISTNIEJACE-99999/lineage` z headerem `Authorization: Bearer <token>`
2. Sprawdź kod statusu i treść odpowiedzi

**Oczekiwany wynik:**
- Status HTTP: `404 Not Found`
- Odpowiedź JSON zawiera pole `error` lub `message` z opisem błędu
- Brak stack trace w odpowiedzi (środowisko produkcyjne)
- Serwer nie crashuje

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-10 — Lineage: 403 dla inicjatywy z innej organizacji

**Cel:** Weryfikacja, że endpoint lineage nie ujawnia danych inicjatyw należących do innych organizacji.

**Preconditions:**
- Dwie organizacje (org A i org B) z różnymi inicjatywami
- Użytkownik zalogowany do org A z tokenem org A
- Znane ID inicjatywy należącej do org B

**Kroki:**
1. Zaloguj się jako użytkownik org A
2. Wyślij `GET /api/initiatives/<id-org-B>/lineage` z tokenem org A
3. Sprawdź kod statusu

**Oczekiwany wynik:**
- Status HTTP: `403 Forbidden` (lub `404 Not Found` jako bezpieczna alternatywa)
- Brak danych inicjatywy org B w odpowiedzi
- Użytkownik org A nie może odczytać danych org B

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-11 — GET /api/initiatives/funnel/stats → 200 + data.byStatus obecne

**Cel:** Weryfikacja, że endpoint funnel stats zwraca status 200 i zawiera pole `byStatus`.

**Preconditions:**
- Użytkownik zalogowany z inicjatywami w organizacji

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats` z headerem `Authorization: Bearer <token>`
2. Sprawdź kod statusu i strukturę odpowiedzi

**Oczekiwany wynik:**
- Status HTTP: `200 OK`
- Odpowiedź JSON zawiera pole `byStatus` (obiekt lub tablica)
- `byStatus` zawiera klucze odpowiadające statusom (np. DRAFT, APPROVED, SCHEDULED)
- Czas odpowiedzi < 3 s

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-12 — Funnel stats: byStatus zawiera licznik dla DRAFT

**Cel:** Weryfikacja, że `byStatus` zawiera klucz `DRAFT` z poprawnym licznikiem.

**Preconditions:**
- Organizacja z co najmniej jedną inicjatywą w statusie DRAFT

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats`
2. Sprawdź `data.byStatus.DRAFT` (lub odpowiedni klucz/element)
3. Porównaj z rzeczywistą liczbą inicjatyw DRAFT (weryfikacja przez UI lub bezpośrednie zapytanie do API)

**Oczekiwany wynik:**
- `byStatus.DRAFT` jest liczbą całkowitą ≥ 1
- Wartość zgadza się z faktyczną liczbą inicjatyw DRAFT w organizacji
- Klucz `DRAFT` istnieje nawet gdy `count = 0`

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-13 — Funnel stats: bySource rozbicie (manual/assessment/tool)

**Cel:** Weryfikacja, że `bySource` zawiera podział inicjatyw według źródła ich pochodzenia.

**Preconditions:**
- Organizacja z inicjatywami z różnych źródeł (manual i assessment)

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats`
2. Sprawdź pole `data.bySource`

**Oczekiwany wynik:**
- `bySource` zawiera klucze `manual`, `assessment`, `tool` (lub ich odpowiedniki)
- Suma wartości `bySource` = łączna liczba inicjatyw w organizacji
- Każda wartość jest nieujemną liczbą całkowitą
- Inicjatywy nieprzypisane do źródła nie powodują błędu (np. liczone jako `manual` lub osobna kategoria)

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-14 — Funnel stats: conversions[] zawiera wskaźnik DRAFT→APPROVED

**Cel:** Weryfikacja, że tablica `conversions` zawiera element z informacją o wskaźniku konwersji ze statusu DRAFT do APPROVED.

**Preconditions:**
- Organizacja z inicjatywami które przeszły z DRAFT do APPROVED

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats`
2. Znajdź element w `data.conversions[]` dotyczący przejścia DRAFT → APPROVED
3. Sprawdź strukturę elementu i wartość współczynnika

**Oczekiwany wynik:**
- `conversions` jest tablicą z co najmniej 1 elementem
- Element DRAFT→APPROVED zawiera pola: `from`, `to`, `rate` (lub `conversionRate`)
- `rate` jest liczbą z zakresu [0, 1] lub procentem [0, 100]
- Wartość `rate` jest spójna z faktyczną liczbą inicjatyw (`approvedCount / draftCount`)

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-15 — Funnel stats: totalActive = suma aktywnych statusów

**Cel:** Weryfikacja, że pole `totalActive` jest poprawną sumą inicjatyw w statusach aktywnych (np. APPROVED + SCHEDULED + EXECUTING).

**Preconditions:**
- Organizacja z inicjatywami w różnych aktywnych statusach
- Znana definicja „aktywny status" (np. nie DRAFT, nie ARCHIVED, nie COMPLETED)

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats`
2. Zsumuj ręcznie wartości z `byStatus` dla statusów uznawanych za „aktywne"
3. Porównaj z `data.totalActive`

**Oczekiwany wynik:**
- `totalActive` = suma inicjatyw w statusach APPROVED + SCHEDULED + EXECUTING (lub zgodnie z definicją)
- Wartość jest liczbą całkowitą ≥ 0
- Inicjatywy DRAFT i ARCHIVED/COMPLETED nie wliczają się do `totalActive`

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-16 — Funnel stats: dane ograniczone do bieżącej organizacji

**Cel:** Weryfikacja, że statystyki lejka dotyczą wyłącznie organizacji zalogowanego użytkownika.

**Preconditions:**
- Dwie organizacje (org A i org B) z różną liczbą inicjatyw
- Znana liczba inicjatyw DRAFT w org A i org B osobno

**Kroki:**
1. Zaloguj się jako użytkownik org A
2. Wyślij `GET /api/initiatives/funnel/stats`
3. Sprawdź `byStatus.DRAFT`
4. Zaloguj się jako użytkownik org B
5. Wyślij `GET /api/initiatives/funnel/stats`
6. Sprawdź `byStatus.DRAFT`

**Oczekiwany wynik:**
- Liczniki dla org A i org B są różne (odpowiadają każdej org z osobna)
- Org A nie widzi inicjatyw org B w statystykach
- `totalActive` jest spójny z danymi danej org

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-17 — Funnel stats: pusta organizacja → wszystkie liczniki = 0

**Cel:** Weryfikacja poprawnej obsługi przypadku gdy organizacja nie ma żadnych inicjatyw.

**Preconditions:**
- Konto w organizacji bez żadnych inicjatyw (lub możliwość usunięcia wszystkich inicjatyw)

**Kroki:**
1. Zaloguj się jako użytkownik organizacji bez inicjatyw
2. Wyślij `GET /api/initiatives/funnel/stats`

**Oczekiwany wynik:**
- Status HTTP: `200 OK`
- `byStatus` zawiera klucze ze statusami, ale wartości = 0
- `totalActive = 0`
- `bySource` zawiera klucze ze źródłami, ale wartości = 0
- `conversions[]` — pusta tablica lub wskaźniki = 0%
- Brak błędu serwera (500)

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-18 — Funnel stats: wskaźnik konwersji = 0% gdy żadna inicjatywa DRAFT nie przeszła do APPROVED

**Cel:** Weryfikacja, że współczynnik konwersji DRAFT→APPROVED wynosi 0% gdy wszystkie inicjatywy pozostają w DRAFT.

**Preconditions:**
- Organizacja z inicjatywami WYŁĄCZNIE w statusie DRAFT (żadna nie osiągnęła APPROVED)

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats`
2. Znajdź element konwersji DRAFT→APPROVED w `data.conversions`
3. Sprawdź wartość `rate`

**Oczekiwany wynik:**
- `rate = 0` (lub `0%`)
- Brak błędu NaN lub null w polu `rate`
- `byStatus.APPROVED = 0`
- Odpowiedź nadal ma status 200

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-19 — Dedup kolumn: GET /api/initiatives/:id → pole axis wypełnione (nie null gdy drd_axis ustawiony)

**Cel:** Weryfikacja, że migracja `20260624_initiative_column_dedup.sql` poprawnie skopiowała wartości z `drd_axis` do `axis`.

**Preconditions:**
- Inicjatywa która PRZED migracją miała wypełnione pole `drd_axis` (wartość np. `"Technologia"`)
- Migracja `20260624_initiative_column_dedup.sql` wykonana

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>`
2. Sprawdź pole `axis` w odpowiedzi

**Oczekiwany wynik:**
- `axis = "Technologia"` (wartość z `drd_axis`)
- `axis` nie jest `null` ani `undefined`
- Pole `drd_axis` może nadal istnieć ale `axis` jest kanonicznym źródłem prawdy

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-20 — Dedup kolumn: pole area wypełnione gdy drd_area miało wartość

**Cel:** Weryfikacja, że migracja skopiowała wartości z `drd_area` do `area`.

**Preconditions:**
- Inicjatywa z wartością w `drd_area` (np. `"Finanse"`) przed migracją
- Migracja wykonana

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>`
2. Sprawdź pole `area`

**Oczekiwany wynik:**
- `area = "Finanse"` (wartość z `drd_area`)
- `area` nie jest `null`
- Wartość jest ciągiem znaków (string), nie obiektem

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-21 — Dedup kolumn: expected_roi wypełnione gdy estimated_roi miało wartość

**Cel:** Weryfikacja, że migracja skopiowała wartości z `estimated_roi` do `expected_roi`.

**Preconditions:**
- Inicjatywa z wartością w `estimated_roi` (np. `150000`) przed migracją
- Migracja wykonana

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>`
2. Sprawdź pole `expected_roi`

**Oczekiwany wynik:**
- `expected_roi = 150000` (wartość z `estimated_roi`)
- `expected_roi` nie jest `null`
- Wartość jest liczbą (number), nie stringiem

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-22 — Dedup kolumn idempotentny: dwukrotne uruchomienie migracji → ten sam wynik

**Cel:** Weryfikacja, że migracja `20260624_initiative_column_dedup.sql` jest idempotentna — wielokrotne uruchomienie nie zmienia danych ani nie powoduje błędów.

**Preconditions:**
- Dostęp do bazy danych staging lub lokalnej
- Migracja już raz wykonana

**Kroki:**
1. Uruchom migrację po raz drugi: `psql -f 20260624_initiative_column_dedup.sql`
2. Wyślij `GET /api/initiatives/<id>` dla inicjatywy testowej
3. Porównaj pola `axis`, `area`, `expected_roi` z wartościami sprzed ponownego uruchomienia

**Oczekiwany wynik:**
- Brak błędu SQL podczas ponownego uruchomienia
- Wartości `axis`, `area`, `expected_roi` niezmienione
- Liczba wierszy w tabelach niezmieniona (brak duplikatów)
- Migracja kończy się sukcesem (exit code 0)

**API endpoint:** n/d (weryfikacja migracji SQL)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-23 — Walidacja statusu CHECK constraint: POST z status='step3' → błąd lub normalizacja do DRAFT

**Cel:** Weryfikacja, że nieprawidłowa wartość statusu jest odrzucana lub normalizowana przez API.

**Preconditions:**
- Użytkownik zalogowany z uprawnieniami do tworzenia inicjatyw

**Kroki:**
1. Wyślij `POST /api/initiatives` z body: `{ "title": "Test", "status": "step3" }`
2. Sprawdź kod statusu i odpowiedź

**Oczekiwany wynik:**
- ALBO: Status HTTP `400 Bad Request` lub `422 Unprocessable Entity` z opisem błędu walidacji
- ALBO: Status HTTP `201 Created` z `status = "DRAFT"` (normalizacja do domyślnej wartości)
- Pole `status = "step3"` NIGDY nie pojawia się w odpowiedzi ani bazie danych
- Brak statusu `500 Internal Server Error`

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-24 — Backfill statusu: brak statusu 'step3' w GET /api/initiatives

**Cel:** Weryfikacja, że lista inicjatyw nie zawiera żadnej inicjatywy z wartością statusu `step3` (legacy format).

**Preconditions:**
- Migracja deduplikacji i normalizacji statusów wykonana
- Dostęp do pełnej listy inicjatyw

**Kroki:**
1. Wyślij `GET /api/initiatives` (pobierz wszystkie inicjatywy lub użyj paginacji)
2. Przeszukaj odpowiedź pod kątem `"status": "step3"` (lub podobnych wartości legacy)

**Oczekiwany wynik:**
- Żadna inicjatywa nie ma `status = "step3"`, `"step2"`, `"step1"` ani innych wartości legacy
- Wszystkie statusy należą do zdefiniowanego zbioru: DRAFT, APPROVED, SCHEDULED, EXECUTING, COMPLETED, BLOCKED, ARCHIVED
- Brak `null` w polu `status`

**API endpoint:** `GET /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-25 — Lineage: source_id ustawione gdy inicjatywa powstała z assessmentu

**Cel:** Weryfikacja, że inicjatywa wygenerowana z assessmentu ma wypełnione pole `source_id` wskazujące na konkretny assessment.

**Preconditions:**
- Inicjatywa utworzona z konkretnego assessmentu (znane ID assessmentu)

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage`
2. Sprawdź `data.source.id` (lub `source_id`)

**Oczekiwany wynik:**
- `source.id` = ID assessmentu z którego pochodzi inicjatywa
- `source.type = "assessment"`
- Pole `source.id` nie jest `null`
- Istnieje możliwość weryfikacji krzyżowej (GET assessment o tym ID zwraca dane)

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-26 — Lineage: source_type='manual' dla inicjatyw tworzonych bezpośrednio

**Cel:** Weryfikacja, że inicjatywa utworzona bezpośrednio przez użytkownika (formularz, czat bez assessmentu) ma `source_type = 'manual'`.

**Preconditions:**
- Inicjatywa utworzona bezpośrednio przez formularz „Nowa inicjatywa" lub przez czat bez kontekstu assessmentu

**Kroki:**
1. Utwórz nową inicjatywę przez formularz (nie z assessmentu, nie z narzędzia)
2. Wyślij `GET /api/initiatives/<new-id>/lineage`
3. Sprawdź `data.source.type`

**Oczekiwany wynik:**
- `source.type = "manual"`
- `source.id` może być `null` lub wskazywać na użytkownika
- Brak wartości `null` w polu `source.type`

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-27 — Funnel stats: po utworzeniu nowej inicjatywy → licznik DRAFT wzrasta o 1

**Cel:** Weryfikacja, że dane funnel stats są aktualne i odzwierciedlają nowo dodane inicjatywy.

**Preconditions:**
- Znana aktualna wartość `byStatus.DRAFT` (np. 5)

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats` → zanotuj `byStatus.DRAFT = N`
2. Utwórz nową inicjatywę (domyślny status = DRAFT)
3. Wyślij ponownie `GET /api/initiatives/funnel/stats`
4. Sprawdź `byStatus.DRAFT`

**Oczekiwany wynik:**
- `byStatus.DRAFT = N + 1`
- Zmiana widoczna bez przeładowania serwera
- Pozostałe liczniki (`APPROVED`, `SCHEDULED` itp.) niezmienione

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-28 — Funnel stats: po przejściu DRAFT→APPROVED → APPROVED wzrasta, konwersja aktualizuje się

**Cel:** Weryfikacja, że zmiana statusu inicjatywy natychmiast odzwierciedla się w statystykach funnel.

**Preconditions:**
- Znane wartości: `byStatus.DRAFT = D`, `byStatus.APPROVED = A`
- Znana bieżąca wartość `conversions[DRAFT→APPROVED].rate`

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats` → zanotuj `DRAFT = D`, `APPROVED = A`, `rate = R`
2. Zmień status inicjatywy z DRAFT na APPROVED
3. Wyślij ponownie `GET /api/initiatives/funnel/stats`

**Oczekiwany wynik:**
- `byStatus.DRAFT = D - 1`
- `byStatus.APPROVED = A + 1`
- `conversions[DRAFT→APPROVED].rate` zaktualizowany (jeśli D > 0 przed zmianą)
- `totalActive` wzrósł o 1 (jeśli APPROVED należy do aktywnych)

**API endpoint:** `PATCH /api/initiatives/:id/status`, `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-29 — Endpoint lineage wymaga autentykacji → 401 bez tokena

**Cel:** Weryfikacja, że endpoint `/api/initiatives/:id/lineage` jest chroniony i wymaga ważnego tokena Bearer.

**Preconditions:**
- Znane ID istniejącej inicjatywy

**Kroki:**
1. Wyślij `GET /api/initiatives/<id>/lineage` BEZ headera `Authorization`
2. Sprawdź kod statusu odpowiedzi

**Oczekiwany wynik:**
- Status HTTP: `401 Unauthorized`
- Odpowiedź JSON zawiera komunikat o braku autentykacji (np. `"Unauthorized"` lub `"Token required"`)
- Brak danych inicjatywy w odpowiedzi
- Brak błędu 500 (brak autentykacji nie jest błędem serwera)

**API endpoint:** `GET /api/initiatives/:id/lineage`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F5-30 — Endpoint funnel stats wymaga autentykacji → 401 bez tokena

**Cel:** Weryfikacja, że endpoint `/api/initiatives/funnel/stats` jest chroniony i wymaga ważnego tokena Bearer.

**Preconditions:**
- Brak tokena (niezalogowana sesja)

**Kroki:**
1. Wyślij `GET /api/initiatives/funnel/stats` BEZ headera `Authorization`
2. Sprawdź kod statusu odpowiedzi

**Oczekiwany wynik:**
- Status HTTP: `401 Unauthorized`
- Odpowiedź JSON zawiera komunikat o braku autentykacji
- Brak danych statystycznych w odpowiedzi (pole `byStatus`, `totalActive` etc. nie są obecne)
- Serwer zwraca 401 natychmiastowo (brak obliczeń statystyk dla niezalogowanego)

**API endpoint:** `GET /api/initiatives/funnel/stats`

**Bramka:** ✅ PASS / ❌ FAIL

---

*Koniec pliku TESTY_USPOJNIENIE_F5_OBSERWOWALNOS.md*
