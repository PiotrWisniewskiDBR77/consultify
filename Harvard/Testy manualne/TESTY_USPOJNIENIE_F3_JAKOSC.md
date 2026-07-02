# F3 — Quality Gates (Uspójnienie) — Testy manualne E2E

**Moduł:** F3 §B3 validators · MECE check · Reviewer §B4 · CARD_CONTENT_FORMULA §A3 · material_quality guard  
**SSOT kodu:** `src/services/initiative/initiativeCardValidators.ts`, `createInitiativeService.ts`, `portfolioMeceService.ts`, `initiativeGenerationService.ts`, `assessmentInitiativeService.ts`  
**Data przygotowania:** 2026-06-25  
**Środowisko:** staging (caboose) | Autoryzacja: Bearer token użytkownika z rolą `user` w orgId  

---

## §B3 VALIDATORS — walidatory strukturalne karty

---

## F3-01 — kpi_baseline_target: inicjatywa bez KPI → walidator FAIL

**Cel:** Potwierdzić, że brak pola `kpis` w ciele POST powoduje fail reguły `kpi_baseline_target` i pojawia się ostrzeżenie w `qualityWarnings`.

**Preconditions:**
- Zalogowany użytkownik z rolą `user` w organizacji testowej (orgId znany)
- `enforceQuality: true` musi być wysyłane (albo endpoint ustawia je domyślnie — patrz implementacja F3.2)

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-01 bez KPI",
     "summary": "Inicjatywa bez żadnych KPI.",
     "enforceQuality": true
   }
   ```
2. Zanotuj status HTTP i ciało odpowiedzi.
3. Sprawdź, czy odpowiedź zawiera pole `qualityWarnings`.
4. Sprawdź, czy przynajmniej jeden wpis zaczyna się od `kpi_baseline_target:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201 (inicjatywa tworzona mimo ostrzeżeń — ADVISORY)
- `qualityWarnings` zawiera string zaczynający się od `kpi_baseline_target:`
- Tekst ostrzeżenia zawiera frazy: „Brak KPI" lub „baseline" lub „target"

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-02 — kpi_baseline_target: inicjatywa z kompletnym KPI → walidator PASS

**Cel:** Potwierdzić, że obecność co najmniej jednego KPI z polami `baseline`, `target`, `unit` powoduje pass reguły `kpi_baseline_target`.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-02 z KPI",
     "summary": "Inicjatywa z kompletnym KPI.",
     "kpis": [{ "baseline": 40, "target": 70, "unit": "%" }],
     "enforceQuality": true
   }
   ```
2. Zanotuj status HTTP i ciało odpowiedzi.
3. Sprawdź, czy `qualityWarnings` nie zawiera wpisów z `kpi_baseline_target`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` jest puste lub nie zawiera `kpi_baseline_target:`

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-03 — raid_mix: brak wpisów RAID → walidator FAIL

**Cel:** Potwierdzić, że inicjatywa bez pola `key_risks` / `raid` generuje fail reguły `raid_mix`.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-03 bez RAID",
     "summary": "Inicjatywa bez wpisów RAID.",
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis zaczynający się od `raid_mix:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `raid_mix:` z opisem wymagającym ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-04 — raid_mix: pełny mix RAID → walidator PASS

**Cel:** Potwierdzić, że obecność min. 2 RISK, 1 ASSUMPTION i 1 DEPENDENCY powoduje pass reguły `raid_mix`.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-04 pełny RAID",
     "enforceQuality": true,
     "keyRisks": [
       { "type": "RISK", "title": "Ryzyko 1" },
       { "type": "RISK", "title": "Ryzyko 2" },
       { "type": "ASSUMPTION", "title": "Założenie 1" },
       { "type": "DEPENDENCY", "title": "Zależność 1" }
     ]
   }
   ```
2. Sprawdź, czy `qualityWarnings` nie zawiera `raid_mix:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- Brak `raid_mix:` w `qualityWarnings`

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-05 — scope_out_mece: brak scope_out → walidator FAIL

**Cel:** Potwierdzić, że inicjatywa bez pola `scopeOut` generuje fail reguły `scope_out_mece` (wymagane ≥3 elementy).

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-05 bez scope_out",
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis `scope_out_mece:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `scope_out_mece:` z informacją o liczbie „0" i wymaganiu ≥3

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-06 — scope_in_count: mniej niż 3 elementy w scope_in → walidator FAIL

**Cel:** Potwierdzić, że pole `scopeIn` z mniej niż 3 elementami generuje fail reguły `scope_in_count`.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-06 niepełny scope_in",
     "scopeIn": ["Obszar A", "Obszar B"],
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis `scope_in_count:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `scope_in_count:` z informacją o 2 elementach i wymaganiu ≥3

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-07 — deliverables_count: 0 produktów → walidator FAIL

**Cel:** Potwierdzić, że brak `deliverables` powoduje fail reguły `deliverables_count` (wymagane ≥4).

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-07 bez deliverables",
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis `deliverables_count:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `deliverables_count:` z informacją o wymaganiu ≥4

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-08 — success_count: 0 kryteriów sukcesu → walidator FAIL

**Cel:** Potwierdzić, że brak `successCriteria` powoduje fail reguły `success_count` (wymagane ≥4).

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-08 bez success_criteria",
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis `success_count:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `success_count:` z informacją o wymaganiu ≥4

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-09 — roi_sizing: brak pól ROI/CAPEX/OPEX → walidator FAIL

**Cel:** Potwierdzić, że brak co najmniej jednego z: `cost_capex`, `cost_opex`, `expected_roi` generuje fail reguły `roi_sizing`.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-09 bez ROI",
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis `roi_sizing:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `roi_sizing:` z informacją o braku oszacowania

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-10 — owner_assigned: brak właściciela → walidator FAIL

**Cel:** Potwierdzić, że brak `ownerBusinessId` (i aliasów `ownerId`, `owner_id`) powoduje fail reguły `owner_assigned`.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z body:
   ```json
   {
     "title": "Test-F3-10 bez właściciela",
     "enforceQuality": true
   }
   ```
2. Sprawdź, czy `qualityWarnings` zawiera wpis `owner_assigned:`.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` zawiera `owner_assigned:` z informacją o braku właściciela

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-11 — pełna karta: wszystkie 10 walidatorów PASS → qualityWarnings=[]

**Cel:** Potwierdzić, że bogata karta spełniająca wszystkie §B3 reguły zwraca pustą listę ostrzeżeń.

**Preconditions:**
- Użytkownik testowy istnieje w orgId i ma znane `id` do użycia jako `ownerBusinessId`

**Kroki:**
1. Wyślij `POST /api/initiatives` z body zawierającym wszystkie wymagane pola:
   ```json
   {
     "title": "Test-F3-11 pełna karta",
     "enforceQuality": true,
     "kpis": [{ "baseline": 40, "target": 80, "unit": "%" }],
     "keyRisks": [
       { "type": "RISK", "title": "R1" }, { "type": "RISK", "title": "R2" },
       { "type": "ASSUMPTION", "title": "A1" }, { "type": "DEPENDENCY", "title": "D1" }
     ],
     "scopeIn": ["Obszar A", "Obszar B", "Obszar C"],
     "scopeOut": ["Obszar X", "Obszar Y", "Obszar Z"],
     "deliverables": ["P1", "P2", "P3", "P4"],
     "successCriteria": ["K1", "K2", "K3", "K4"],
     "killCriteria": ["Stop1", "Stop2"],
     "milestones": ["M1", "M2", "M3"],
     "costCapex": 100000,
     "ownerBusinessId": "<id_użytkownika>"
   }
   ```
2. Zanotuj status HTTP i zawartość `qualityWarnings` w odpowiedzi.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` jest nieobecne lub jest pustą tablicą `[]`

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## QUALITY WARNINGS W ODPOWIEDZI TWORZENIA

---

## F3-12 — POST z pustą kartą → qualityWarnings ma ≥1 wpis

**Cel:** Potwierdzić end-to-end, że tworzenie inicjatywy z minimalnym ciałem (tylko tytuł) zwraca `qualityWarnings` z co najmniej jednym ostrzeżeniem.

**Preconditions:**
- Backend staging uruchomiony, token autoryzacyjny gotowy
- `enforceQuality` ustawiane przez endpoint (sprawdzić `createInitiativeService` — opcja `enforceQuality` musi być przekazana przez router)

**Kroki:**
1. Wyślij `POST /api/initiatives`:
   ```json
   { "title": "Test-F3-12 minimalna karta", "enforceQuality": true }
   ```
2. Odczytaj pole `qualityWarnings` z odpowiedzi.
3. Policz liczbę wpisów.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` jest tablicą z ≥1 wpisem (spodziewane: 10 ostrzeżeń — wszystkie reguły FAIL)

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-13 — POST z pełną kartą → qualityWarnings puste lub nieobecne

**Cel:** Potwierdzić, że bogata karta (spełniająca wszystkie §B3) nie generuje ostrzeżeń.

**Preconditions:**
- Jak w F3-11 (pełna karta z ownerBusinessId)

**Kroki:**
1. Wyślij `POST /api/initiatives` z body z F3-11.
2. Sprawdź wartość `qualityWarnings` w odpowiedzi.

**Oczekiwany wynik:**
- HTTP 200 lub 201
- `qualityWarnings` nie istnieje lub jest pustą tablicą

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-14 — qualityWarnings są ADVISORY — POST zwraca 200 nawet z ostrzeżeniami

**Cel:** Potwierdzić, że obecność ostrzeżeń §B3 nigdy nie blokuje zapisu inicjatywy — jest wyłącznie informacyjna.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z pustą kartą (tylko tytuł + enforceQuality).
2. Zanotuj status HTTP.
3. Zweryfikuj, czy inicjatywa faktycznie powstała: `GET /api/initiatives/<id>` zwraca 200.

**Oczekiwany wynik:**
- HTTP 200 lub 201 na POST (NIE 400, NIE 422)
- GET inicjatywy po `id` z odpowiedzi zwraca istniejący rekord
- `qualityWarnings` obecne w odpowiedzi POST, ale inicjatywa zapisana

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-15 — qualityWarnings zawierają identyfikatory reguł (np. "kpi_baseline_target: …")

**Cel:** Potwierdzić, że każde ostrzeżenie ma format `<ruleId>: <opis>`, umożliwiający identyfikację reguły przez klienta.

**Preconditions:**
- Jak w F3-01

**Kroki:**
1. Wyślij `POST /api/initiatives` z minimalnym body (tylko tytuł, `enforceQuality: true`).
2. Odczytaj tablicę `qualityWarnings`.
3. Sprawdź, czy każdy string pasuje do wzorca `^[a-z_]+: .+` (id_reguły: opis).
4. Potwierdź obecność co najmniej takich identyfikatorów jak: `kpi_baseline_target`, `raid_mix`, `owner_assigned`.

**Oczekiwany wynik:**
- Każdy wpis `qualityWarnings` ma format `<identyfikator_reguły>: <treść>`
- Identyfikatory reguł odpowiadają enumowi `CardStructRule` z kodu

**API endpoint:** `POST /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## MECE CHECK — sprawdzanie kompletności portfela

---

## F3-16 — POST /api/initiatives/validate-portfolio-mece zwraca overlaps + coveragePct

**Cel:** Potwierdzić, że endpoint MECE istnieje i zwraca spodziewaną strukturę odpowiedzi.

**Preconditions:**
- Org testowa z ≥1 aktywną inicjatywą

**Kroki:**
1. Wyślij `POST /api/initiatives/validate-portfolio-mece` z tokenem autoryzacyjnym:
   ```json
   {
     "candidates": [
       { "title": "Nowa inicjatywa X", "description": "Opis nowej inicjatywy." }
     ]
   }
   ```
2. Zanotuj status HTTP i ciało odpowiedzi.
3. Sprawdź obecność pól: `overlaps`, `gaps`, `coveragePct`.

**Oczekiwany wynik:**
- HTTP 200
- Odpowiedź zawiera `overlaps` (tablica), `gaps` (tablica), `coveragePct` (liczba 0–100)

**API endpoint:** `POST /api/initiatives/validate-portfolio-mece`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-17 — Org bez nakładających się inicjatyw → coveragePct=100, overlaps=[]

**Cel:** Potwierdzić, że kandydaci wyraźnie odmienni od istniejących inicjatyw nie generują overlaps.

**Preconditions:**
- Org testowa z ≥1 inicjatywą o unikalnym tytule (np. „Wdrożenie ERP w dziale logistyki")

**Kroki:**
1. Wyślij `POST /api/initiatives/validate-portfolio-mece`:
   ```json
   {
     "candidates": [
       { "title": "Automatyzacja procesu rekrutacji HR", "description": "Całkowicie nowy obszar — HR." }
     ]
   }
   ```
2. Sprawdź wartości `overlaps` i `coveragePct`.

**Oczekiwany wynik:**
- `overlaps` = `[]` (brak nakłąć)
- `coveragePct` = 100 (jeśli brak goalKey w istniejących) lub inna wartość odzwierciedlająca brak luk

**API endpoint:** `POST /api/initiatives/validate-portfolio-mece`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-18 — Kandydat zbliżony do istniejącej inicjatywy → overlap wykryty, coveragePct<100

**Cel:** Potwierdzić, że kandydat o zbliżonym tytule do istniejącej inicjatywy jest oznaczony jako overlap.

**Preconditions:**
- Org testowa zawiera inicjatywę o tytule „Wdrożenie nowego systemu ERP" (status aktywny, nie CANCELLED/ARCHIVED)

**Kroki:**
1. Wyślij `POST /api/initiatives/validate-portfolio-mece`:
   ```json
   {
     "candidates": [
       { "title": "Implementacja systemu ERP w firmie", "description": "Wdrożenie ERP." }
     ]
   }
   ```
2. Sprawdź, czy `overlaps` zawiera przynajmniej jeden wpis z `candidateTitle` = „Implementacja systemu ERP w firmie".

**Oczekiwany wynik:**
- `overlaps` zawiera ≥1 wpis z `reason` opisującym podobieństwo tytułów

**API endpoint:** `POST /api/initiatives/validate-portfolio-mece`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-19 — Endpoint MECE wymaga autoryzacji → 401 bez tokenu

**Cel:** Potwierdzić, że endpoint MECE jest chroniony autoryzacją.

**Preconditions:**
- Brak tokenu autoryzacyjnego

**Kroki:**
1. Wyślij `POST /api/initiatives/validate-portfolio-mece` **bez nagłówka Authorization**:
   ```json
   { "candidates": [{ "title": "Test bez autoryzacji" }] }
   ```
2. Zanotuj status HTTP.

**Oczekiwany wynik:**
- HTTP 401
- Ciało zawiera kod błędu lub komunikat „Unauthorized"

**API endpoint:** `POST /api/initiatives/validate-portfolio-mece`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-20 — Endpoint MECE jest org-scoped → inicjatywy innej org nie wchodzą w skład porównania

**Cel:** Potwierdzić izolację tenancji: inicjatywy z org B nie są widoczne przy sprawdzaniu MECE dla org A.

**Preconditions:**
- Dwa konta testowe: user-A (orgA) i user-B (orgB)
- OrgB ma inicjatywę o tytule „Wdrożenie IoT" — user-A **nie** powinien jej widzieć

**Kroki:**
1. Zaloguj się jako user-A (orgA).
2. Wyślij `POST /api/initiatives/validate-portfolio-mece` z tokenem orgA:
   ```json
   { "candidates": [{ "title": "Wdrożenie IoT w produkcji" }] }
   ```
3. Sprawdź, czy w `overlaps` nie pojawia się referencja do inicjatywy z orgB.

**Oczekiwany wynik:**
- `overlaps` nie zawiera inicjatywy należącej do orgB
- Odpowiedź widzi wyłącznie inicjatywy orgA

**API endpoint:** `POST /api/initiatives/validate-portfolio-mece`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## AI GENERATION — reviewer §B4

---

## F3-21 — generate-section bez withReview → reviewer uruchamia się domyślnie

**Cel:** Potwierdzić, że brak parametru `withReview` w body powoduje uruchomienie reviewera (domyślne `withReview:true`).

**Preconditions:**
- Klucz AI skonfigurowany na stagingu (caboose)
- Inicjatywa testowa istniejąca (znany `initiativeId`)

**Kroki:**
1. Wyślij `POST /api/initiatives/generate-section`:
   ```json
   {
     "sectionKey": "problem_statement",
     "initiativeId": "<id_inicjatywy>",
     "initiativeName": "Test-F3-21",
     "language": "pl"
   }
   ```
   (brak `withReview` w body)
2. Sprawdź, czy odpowiedź zawiera pole `review` lub `reviewVerdict`.

**Oczekiwany wynik:**
- HTTP 200
- Odpowiedź zawiera wynik reviewera (np. `review.score`, `review.verdict`)

**API endpoint:** `POST /api/initiatives/generate-section`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-22 — generate-section z withReview=false → reviewer pominięty

**Cel:** Potwierdzić, że jawne `withReview: false` pomija krok adversarialnego reviewera.

**Preconditions:**
- Jak w F3-21

**Kroki:**
1. Wyślij `POST /api/initiatives/generate-section`:
   ```json
   {
     "sectionKey": "problem_statement",
     "initiativeId": "<id_inicjatywy>",
     "initiativeName": "Test-F3-22",
     "language": "pl",
     "withReview": false
   }
   ```
2. Sprawdź, czy pole `review` / `reviewVerdict` jest nieobecne w odpowiedzi.

**Oczekiwany wynik:**
- HTTP 200
- Odpowiedź **nie zawiera** pola `review` lub `reviewVerdict`

**API endpoint:** `POST /api/initiatives/generate-section`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-23 — generate-section zwraca ulepszoną treść (reviewer mógł ją ocenić)

**Cel:** Potwierdzić jakościowo, że wygenerowana treść sekcji nie jest pusta i zawiera merytoryczny opis (reviewer nie blokuje, ale sygnalizuje werdykt).

**Preconditions:**
- Jak w F3-21

**Kroki:**
1. Wyślij `POST /api/initiatives/generate-section` (bez `withReview`):
   ```json
   {
     "sectionKey": "problem_statement",
     "initiativeName": "Optymalizacja procesu przyjmowania zamówień w magazynie",
     "summary": "Obecny proces trwa 48h, co powoduje opóźnienia dostaw.",
     "language": "pl"
   }
   ```
2. Sprawdź pole `content` lub `generated` w odpowiedzi.
3. Zweryfikuj, że treść ma >50 słów i jest po polsku.
4. Sprawdź pole `review.score` — powinno być ≥0 i ≤100.

**Oczekiwany wynik:**
- HTTP 200
- `content` (lub analogiczne pole) zawiera merytoryczny opis problemu
- `review.score` to liczba 0–100

**API endpoint:** `POST /api/initiatives/generate-section`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## CARD_CONTENT_FORMULA §A3 W PROMPTACH AI

---

## F3-24 — Assessment-generated initiative → tytuł jest konkretny (nie mglisty)

**Cel:** Potwierdzić, że inicjatywy generowane przez assessment mają tytuły zgodne z §A3 (konkretne, bez ogólników typu „Poprawa X").

**Preconditions:**
- Assessment z wynikami dostępny w orgId (znane `assessmentId`)
- Inicjatywy wygenerowane przez assessment (np. przez `assessmentInitiativeService`)

**Kroki:**
1. Pobierz listę inicjatyw wygenerowanych przez assessment: `GET /api/initiatives?sourceType=assessment`.
2. Dla każdej inicjatywy sprawdź pole `title`.
3. Zweryfikuj, że tytuły nie brzmią ogólnikowo (np. nie zaczynają się od: „Poprawa", „Zwiększenie efektywności", „Lepsze zarządzanie" bez doprecyzowania obszaru).

**Oczekiwany wynik:**
- Każdy tytuł zawiera konkretny obszar, wartość lub cel (np. „Skrócenie czasu cyklu zamówień z 48h do 8h przez automatyzację ERP")
- Brak tytułów-wypełniaczy jak „Inicjatywa 1" lub „Nowa inicjatywa"

**API endpoint:** `GET /api/initiatives`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-25 — Assessment-generated initiative → pole hypothesis jest ustawione

**Cel:** Potwierdzić, że §A3 wymusza wypełnienie pola `hypothesis` w formacie „Jeśli … to … bo/ponieważ …".

**Preconditions:**
- Jak w F3-24

**Kroki:**
1. Pobierz szczegóły inicjatywy wygenerowanej przez assessment: `GET /api/initiatives/<id>`.
2. Sprawdź pole `hypothesis` (lub `description`).
3. Zweryfikuj, że nie jest null ani pusty string.
4. Opcjonalnie: sprawdź, czy zawiera wzorzec „Jeśli … to … bo …".

**Oczekiwany wynik:**
- `hypothesis` jest niepusty
- Preferowany format: „Jeśli [działanie] to [efekt] bo/ponieważ [uzasadnienie]"

**API endpoint:** `GET /api/initiatives/:id`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-26 — Tool-generated initiative → prompt zawierał instrukcję §A3

**Cel:** Potwierdzić pośrednio (przez jakość output), że generowanie przez `generate-section` z `sectionKey=problem_statement` daje wynik spełniający §A3 (opis problemu 120–250 słów, bez fillerów).

**Preconditions:**
- Jak w F3-21

**Kroki:**
1. Wyślij `POST /api/initiatives/generate-section`:
   ```json
   {
     "sectionKey": "problem_statement",
     "initiativeName": "Optymalizacja procesu fakturowania",
     "summary": "Ręczna weryfikacja 300 faktur dziennie zajmuje 3 pracowników przez 6h.",
     "language": "pl"
   }
   ```
2. Policz słowa w polu `content` odpowiedzi.
3. Sprawdź, czy brak placeolderów (TODO, TBD, lorem ipsum).

**Oczekiwany wynik:**
- `content` zawiera 120–250 słów
- Brak placeholderów
- Treść dotyczy opisanego problemu (nie jest generyczna)

**API endpoint:** `POST /api/initiatives/generate-section`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## AIPIPELINE — model premium

---

## F3-27 — Assessment AI call używa modelu premium (nie gpt-4o-mini)

**Cel:** Potwierdzić, że wywołania `assessmentInitiativeService` trafiają na model premium (zgodnie z `model: 'premium'` w kodzie, linia ~466).

**Preconditions:**
- Dostęp do logów serwera backendowego (Railway Log Stream lub lokalne logi `tsx`)
- Assessment z danymi przygotowany

**Kroki:**
1. Uruchom generowanie inicjatyw przez assessment (przez UI lub API).
2. Przeszukaj logi serwera pod kątem wywołania modelu AI.
3. Zweryfikuj, że logi pokazują model premium (np. `claude-sonnet-4-5`, nie `gpt-4o-mini`).
4. Sprawdź, że **nie** pojawia się `gpt-4o-mini` w logach tego wywołania.

**Oczekiwany wynik:**
- Logi potwierdzają wywołanie modelu z `id: 'premium'` lub pełną nazwą modelu premium
- Brak `gpt-4o-mini` w logu tego konkretnego wywołania

**API endpoint:** wewnętrzne (brak bezpośredniego endpointu — weryfikacja przez logi)  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-28 — Fallback do niższego modelu gdy premium niedostępny

**Cel:** Potwierdzić, że przy błędzie modelu premium (np. rate limit) system nie crashuje, lecz albo zwraca zrozumiały błąd albo degraduje do fallback modelu.

**Preconditions:**
- Możliwość symulacji błędu (chwilowe wyłączenie klucza API lub użycie wyczerpanego klucza)
- Lub: obserwacja zachowania przy przekroczeniu rate limit na stagingu

**Kroki:**
1. Skonfiguruj środowisko z nieprawidłowym kluczem API dla modelu premium (lub użyj wyczerpanego).
2. Uruchom `POST /api/initiatives/generate-section` lub wywołanie assessment.
3. Zanotuj odpowiedź (status i ciało).

**Oczekiwany wynik:**
- HTTP ≠ 200 z czytelnym błędem (np. 503 `FEATURE_UNAVAILABLE`) LUB
- Jeżeli skonfigurowany fallback: odpowiedź 200 z informacją o degradacji modelu
- System **nie** zwraca 500 ze stacktracem

**API endpoint:** `POST /api/initiatives/generate-section`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## MATERIAL_QUALITY GUARD — bezpieczna obsługa niekompletnego JSON

---

## F3-29 — GET /api/interview/insights/:id z częściowym material_quality_json → brak 500

**Cel:** Potwierdzić, że Insight z niekompletnym `material_quality_json` (brak pola `score` lub `posture`) nie powoduje błędu 500 ani crashu InsightViewer.

**Preconditions:**
- W bazie danych staging istnieje rekord `interview_insights` z `material_quality_json` zawierającym niekompletny obiekt (np. `{"coverage": 0.4}` — brak `score` i `posture`)
- Można to przygotować przez bezpośrednią edycję DB na stagingu: `UPDATE interview_insights SET material_quality_json = '{"coverage": 0.4}' WHERE id = '<id>'`

**Kroki:**
1. Wyślij `GET /api/interview/insights/<id>` z tokenem autoryzacyjnym dla właściciela insightu.
2. Zanotuj status HTTP.
3. Sprawdź, że odpowiedź zawiera dane insightu (nawet jeśli `material_quality` jest zdegradowane/puste).

**Oczekiwany wynik:**
- HTTP 200 (NIE 500)
- Odpowiedź zawiera dane insightu
- Pole `material_quality` (jeśli zwracane) jest bezpieczną strukturą lub pustym obiektem, nie powoduje błędu

**API endpoint:** `GET /api/interview/insights/:id`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## F3-30 — GET /api/interview/insights/:id z prawidłowym material_quality_json → score i dimensions wypełnione

**Cel:** Potwierdzić, że poprawny `material_quality_json` jest prawidłowo odczytywany i zwracany przez API.

**Preconditions:**
- W bazie danych staging istnieje rekord `interview_insights` z kompletnym `material_quality_json`, np.:
  ```json
  {
    "score": 78,
    "posture": "moderate",
    "coverage": 0.8,
    "depth": "medium",
    "consistency": "high"
  }
  ```

**Kroki:**
1. Wyślij `GET /api/interview/insights/<id>` z tokenem autoryzacyjnym.
2. Zanotuj pole `material_quality` (lub `materialQuality`) w odpowiedzi.
3. Sprawdź, że `score` = 78, `posture` = "moderate" (zgodnie z zapisanymi danymi).

**Oczekiwany wynik:**
- HTTP 200
- `material_quality.score` = 78
- `material_quality.posture` = "moderate"
- `material_quality.coverage` = 0.8

**API endpoint:** `GET /api/interview/insights/:id`  
**Bramka:** ✅ PASS / ❌ FAIL

---

## Podsumowanie scenariuszy

| ID | Obszar | Reguła / Feature | Bramka |
|----|--------|-----------------|--------|
| F3-01 | §B3 validators | kpi_baseline_target FAIL | — |
| F3-02 | §B3 validators | kpi_baseline_target PASS | — |
| F3-03 | §B3 validators | raid_mix FAIL | — |
| F3-04 | §B3 validators | raid_mix PASS | — |
| F3-05 | §B3 validators | scope_out_mece FAIL | — |
| F3-06 | §B3 validators | scope_in_count FAIL | — |
| F3-07 | §B3 validators | deliverables_count FAIL | — |
| F3-08 | §B3 validators | success_count FAIL | — |
| F3-09 | §B3 validators | roi_sizing FAIL | — |
| F3-10 | §B3 validators | owner_assigned FAIL | — |
| F3-11 | §B3 validators | Wszystkie PASS | — |
| F3-12 | Quality Warnings | POST pusta karta → ≥1 warning | — |
| F3-13 | Quality Warnings | POST pełna karta → 0 warnings | — |
| F3-14 | Quality Warnings | ADVISORY — POST 200 mimo warnings | — |
| F3-15 | Quality Warnings | Format ruleId: opis | — |
| F3-16 | MECE | Struktura odpowiedzi | — |
| F3-17 | MECE | Brak overlaps → coveragePct=100 | — |
| F3-18 | MECE | Overlap wykryty | — |
| F3-19 | MECE | Auth guard → 401 | — |
| F3-20 | MECE | Izolacja org-scope | — |
| F3-21 | Reviewer §B4 | Default ON (bez withReview) | — |
| F3-22 | Reviewer §B4 | withReview=false → reviewer pominięty | — |
| F3-23 | Reviewer §B4 | Treść wygenerowana + review.score | — |
| F3-24 | §A3 Prompt | Tytuły inicjatyw konkretne | — |
| F3-25 | §A3 Prompt | hypothesis ustawione | — |
| F3-26 | §A3 Prompt | problem_statement 120–250 słów | — |
| F3-27 | Model premium | Brak gpt-4o-mini w logach | — |
| F3-28 | Model premium | Fallback przy błędzie premium | — |
| F3-29 | material_quality | Partial JSON → brak 500 | — |
| F3-30 | material_quality | Valid JSON → score+dimensions | — |

**Łącznie: 30 scenariuszy**
