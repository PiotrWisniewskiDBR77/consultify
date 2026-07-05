# TESTY MANUALNE — F1 LEJEK TWORZENIA INICJATYWY

> Moduł: Inicjatywy / Lejek tworzenia (`createInitiativeService`)
> Data przygotowania: 2026-06-25
> Liczba scenariuszy: 30
> Gałąź: `feat/deliverables-w1`
> Flaga: `INITIATIVE_FUNNEL_ENABLED=true`

---

## F1-01 — Bezpośrednie tworzenie inicjatywy → status=DRAFT

**Cel:** Weryfikacja, że nowa inicjatywa tworzona przez POST /api/initiatives otrzymuje domyślnie status DRAFT.

**Preconditions:**
- Użytkownik zalogowany z uprawnieniami do tworzenia inicjatyw
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Test inicjatywa F1-01" }` i nagłówkiem `Authorization: Bearer <token>`
2. Sprawdź odpowiedź HTTP i zawartość pola `status`

**Oczekiwany wynik:** HTTP 201, odpowiedź zawiera `"status": "DRAFT"` (nie `null`, nie `step3`, nie `PENDING_REVIEW`)

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-02 — Bezpośrednie tworzenie → name === title

**Cel:** Weryfikacja, że obie kolumny `name` i `title` są zapisywane identycznie w bazie danych.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Inicjatywa duplikacja nazwy" }`
2. Pobierz id z odpowiedzi
3. Wykonaj `GET /api/initiatives/<id>` i sprawdź pola `name` i `title`

**Oczekiwany wynik:** `name === title === "Inicjatywa duplikacja nazwy"` — żadne z pól nie jest `null` ani różne

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-03 — Bezpośrednie tworzenie → organization_id ustawione

**Cel:** Weryfikacja, że każda nowa inicjatywa ma ustawiony `organization_id` (nigdy null).

**Preconditions:**
- Użytkownik zalogowany z przynależnością do organizacji
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Test org_id" }`
2. Sprawdź odpowiedź oraz wykonaj `GET /api/initiatives/<id>`

**Oczekiwany wynik:** Pole `organization_id` jest ustawione i odpowiada organizacji zalogowanego użytkownika — nie jest `null` ani pustym stringiem

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-04 — Bezpośrednie tworzenie bez sourceType → source_type='manual'

**Cel:** Weryfikacja, że brak pola `sourceType` w żądaniu powoduje automatyczne ustawienie `source_type='manual'`.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body zawierającym wyłącznie `{ "title": "Test bez sourceType" }` (bez pola `sourceType`)
2. Wykonaj `GET /api/initiatives/<id>` i sprawdź pole `source_type`

**Oczekiwany wynik:** `source_type === "manual"` w bazie i w odpowiedzi API

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-05 — Analiza finansowa → inicjatywa przez lejek (source_type='financial_analysis')

**Cel:** Weryfikacja, że konwersja analizy finansowej na inicjatywę przechodzi przez `createInitiativeService` i ustawia `source_type='financial_analysis'`.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje wykonana analiza finansowa (financial analysis) z konkretnym `analysisId`
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Otwórz wybraną analizę finansową w module Ekonomika
2. Kliknij „Utwórz inicjatywę" (lub wykonaj `POST /api/economics/analyses/<analysisId>/create-initiative`)
3. Sprawdź odpowiedź i pole `source_type` w zwróconej inicjatywie

**Oczekiwany wynik:** HTTP 201, `source_type === "financial_analysis"`, `source_id === <analysisId>`, `status === "DRAFT"`

**API endpoint:** `POST /api/economics/analyses/:id/create-initiative`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-06 — Analiza digitalizacji → inicjatywa przez lejek

**Cel:** Weryfikacja, że drugi flow w economics.routes (analiza digitalizacji) tworzy inicjatywę przez lejek.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje wykonana analiza digitalizacji z konkretnym `analysisId`
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Otwórz wybraną analizę digitalizacji w module Ekonomika
2. Uruchom konwersję na inicjatywę (lub wykonaj odpowiedni `POST /api/economics/digitization-analyses/<analysisId>/create-initiative`)
3. Sprawdź odpowiedź

**Oczekiwany wynik:** HTTP 201, `source_type` zawiera wartość niemanualną (np. `financial_analysis` lub dedykowany typ), `status === "DRAFT"`, `organization_id` ustawiony

**API endpoint:** `POST /api/economics/digitization-analyses/:id/create-initiative` (weryfikuj aktualną ścieżkę)

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-07 — V8 Finance insights → inicjatywa przez lejek

**Cel:** Weryfikacja, że inicjatywa tworzona z panelu V8 Finance (insights) przechodzi przez `createInitiativeService`.

**Preconditions:**
- Użytkownik zalogowany z dostępem do V8
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Przejdź do `/finance` → zakładka Insights
2. Znajdź insight z opcją „Utwórz inicjatywę" lub wykonaj `POST /api/v8/finance/insights/<insightId>/create-initiative`
3. Sprawdź odpowiedź

**Oczekiwany wynik:** HTTP 201, `status === "DRAFT"`, `organization_id` ustawiony, `source_type` niemanualny

**API endpoint:** `POST /api/v8/finance/insights/:id/create-initiative`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-08 — My Work Ideas → inicjatywa przez lejek (source_type='tool')

**Cel:** Weryfikacja, że inicjatywa tworzona z narzędzia MyWork (Ideas) przechodzi przez lejek ze `source_type='tool'`.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje sesja narzędziowa (tool session) w MyWork
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Przejdź do My Work → Ideas
2. Kliknij „Konwertuj na inicjatywę" dla wybranego elementu (lub wykonaj `POST /api/my-work/ideas/<ideaId>/create-initiative`)
3. Sprawdź odpowiedź i pole `source_type`

**Oczekiwany wynik:** `source_type === "tool"`, `source_id` ustawiony (id sesji narzędziowej), `status === "DRAFT"`

**API endpoint:** `POST /api/my-work/ideas/:id/create-initiative` (lub equivalent)

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-09 — Raport → inicjatywa przez lejek (source_type='report')

**Cel:** Weryfikacja, że inicjatywa tworzona z raportu przechodzi przez lejek ze `source_type='report'`.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje raport (report) z id `reportId`
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Przejdź do wybranego raportu w module Report Builder
2. Uruchom akcję „Utwórz inicjatywę z raportu" (lub wykonaj `POST /api/reports/<reportId>/initiatives`)
3. Sprawdź odpowiedź

**Oczekiwany wynik:** HTTP 201, `source_type === "report"`, `source_id === <reportId>`, `status === "DRAFT"`

**API endpoint:** `POST /api/reports/:id/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-10 — Assessment Workflow → inicjatywa przez lejek (source_type='assessment')

**Cel:** Weryfikacja, że inicjatywa generowana przez workflow oceny (assessment) przechodzi przez lejek.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje zakończona sesja assessment
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Przejdź do zakończonej sesji assessment
2. Kliknij „Generuj inicjatywy" lub wykonaj `POST /api/assessment-workflow/initiatives`
3. Sprawdź odpowiedź dla pierwszej wygenerowanej inicjatywy

**Oczekiwany wynik:** Inicjatywa ma `source_type === "assessment"` lub `"assessment_report"`, `status === "DRAFT"`, `organization_id` ustawiony

**API endpoint:** `POST /api/assessment-workflow/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-11 — Sesja narzędzia (Tool session) → inicjatywa przez lejek (source_type='tool')

**Cel:** Weryfikacja, że konwersja z sesji narzędziowej (ToolController) przechodzi przez lejek.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje aktywna sesja narzędzia (tool session) z `toolSessionId`
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj akcję konwersji sesji narzędziowej na inicjatywę (przez UI lub API ToolController)
2. Sprawdź odpowiedź

**Oczekiwany wynik:** `source_type === "tool"`, `source_id === <toolSessionId>`, `status === "DRAFT"`, `name === title`

**API endpoint:** (sprawdź routing ToolController — prawdopodobnie `POST /api/tools/:sessionId/create-initiative`)

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-12 — CQRS CreateInitiative command → przez lejek

**Cel:** Weryfikacja, że komenda CQRS `CreateInitiativeCommand` deleguje do `createInitiativeService` gdy flaga jest włączona.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`
- Istnieje projekt (projectId) w organizacji

**Kroki:**
1. Wywołaj endpoint, który wewnętrznie korzysta z `CreateInitiativeHandler` (np. tworzenie inicjatywy przez interfejs planowania projektu)
2. Sprawdź odpowiedź i zweryfikuj `GET /api/initiatives/<id>`

**Oczekiwany wynik:** `status === "DRAFT"`, `source_type === "manual"`, `name === title`, `organization_id` ustawiony

**API endpoint:** (endpoint opakowujący CQRS — np. `POST /api/pmo/projects/:id/initiatives`)

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-13 — Konwersja artefaktu → inicjatywa przez lejek (source_type='artifact')

**Cel:** Weryfikacja, że konwersja artefaktu (conclusion) na inicjatywę przechodzi przez lejek ze `source_type='artifact'`.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje artefakt (conclusion) z `artifactId`
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Przejdź do widoku artefaktów (Artifacts)
2. Kliknij „Konwertuj na inicjatywę" dla artefaktu typu conclusion
3. Sprawdź odpowiedź

**Oczekiwany wynik:** `source_type === "artifact"`, `source_id === <artifactId>`, `status === "DRAFT"`, `name === title`

**API endpoint:** `POST /api/artifacts/:id/convert` z `targetArtifactType: "initiative"`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-14 — Konwersja notatnika → inicjatywa przez lejek (source_type='tool')

**Cel:** Weryfikacja, że konwersja strony notatnika (notebook page) na inicjatywę przechodzi przez lejek.

**Preconditions:**
- Użytkownik zalogowany
- Istnieje strona notatnika z treścią
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Przejdź do notatnika (Notes)
2. Kliknij „Konwertuj na inicjatywę" dla wybranej strony
3. Sprawdź odpowiedź

**Oczekiwany wynik:** `source_type === "tool"`, `source_id` ustawiony (id sesji narzędzia), `status === "DRAFT"`, `name === title`

**API endpoint:** `POST /api/notebooks/:id/convert` z `target: "initiative"`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-15 — InitiativeDefinitionService → przez lejek

**Cel:** Weryfikacja, że `InitiativeDefinitionService` tworzy inicjatywy przez lejek.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`
- Dostępny przepływ tworzenia inicjatywy przez Definition Service (np. kreator Charter)

**Kroki:**
1. Uruchom kreator inicjatywy (Charter wizard) do końca i zatwierdź
2. Sprawdź odpowiedź i GET dla nowej inicjatywy

**Oczekiwany wynik:** `status === "DRAFT"`, `organization_id` ustawiony, `name === title`, `source_type` ustawiony (zależnie od kontekstu wywołania)

**API endpoint:** (endpoint powiązany z InitiativeDefinitionService — weryfikuj routing)

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-16 — Backfill statusów → GET /api/initiatives nie zwraca 'step3'

**Cel:** Weryfikacja, że lista inicjatyw nie zawiera przestarzałych statusów z legacy ścieżki (`step3`).

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `GET /api/initiatives` (lub `GET /api/initiatives?limit=100`)
2. Przeszukaj odpowiedź pod kątem pola `status` we wszystkich elementach

**Oczekiwany wynik:** Żaden element w liście nie ma `status === "step3"` — wszystkie inicjatywy mają poprawny status (DRAFT, ACTIVE, BLOCKED, DONE itp.)

**API endpoint:** `GET /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-17 — Backfill statusów → brak 'PENDING_REVIEW' z legacy ścieżki

**Cel:** Weryfikacja, że inicjatywy tworzone przez lejek nie mają statusu `PENDING_REVIEW` jako statusu startowego.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Utwórz nową inicjatywę przez `POST /api/initiatives` z body `{ "title": "Test status backfill" }`
2. Wykonaj `GET /api/initiatives/<id>` i sprawdź status
3. Opcjonalnie sprawdź historyczne inicjatywy przez `GET /api/initiatives`

**Oczekiwany wynik:** Nowo tworzone inicjatywy przez lejek mają `status === "DRAFT"`, nigdy `PENDING_REVIEW` jako wartość startową z lejka

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-18 — name === title po stronie GET /api/initiatives/:id

**Cel:** Weryfikacja spójności zapisu — pole `name` i `title` są identyczne w odpowiedzi GET.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Utwórz inicjatywę `POST /api/initiatives` z body `{ "name": "Test przez name" }` (używając pola `name` zamiast `title`)
2. Pobierz `GET /api/initiatives/<id>` i porównaj `name` z `title`

**Oczekiwany wynik:** `name === title === "Test przez name"` — lejek normalizuje alias `name` do `title`, obydwa pola zapisane

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-19 — organization_id zawsze ustawiony → GET /api/initiatives

**Cel:** Weryfikacja, że żadna inicjatywa na liście nie ma `organization_id === null`.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`
- Co najmniej kilka inicjatyw w systemie

**Kroki:**
1. Wykonaj `GET /api/initiatives?limit=50`
2. Sprawdź pole `organization_id` dla każdego elementu listy

**Oczekiwany wynik:** Wszystkie elementy mają `organization_id` ustawiony — żaden nie jest `null` ani pustym stringiem

**API endpoint:** `GET /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-20 — Lineage: sourceType='assessment' wymaga sourceId

**Cel:** Weryfikacja, że guard lineage blokuje tworzenie inicjatywy z niemanualnym `sourceType` bez `sourceId`.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Test guard", "sourceType": "assessment" }` (bez `sourceId`)
2. Sprawdź status odpowiedzi

**Oczekiwany wynik:** HTTP 400 Bad Request — treść błędu informuje, że `sourceId` jest wymagany gdy `sourceType !== 'manual'`

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-21 — Lineage: sourceType='manual' — sourceId może być null

**Cel:** Weryfikacja, że dla `sourceType='manual'` brak `sourceId` jest poprawny i inicjatywa zostaje utworzona.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Test manual bez sourceId", "sourceType": "manual" }` (bez `sourceId`)
2. Sprawdź status odpowiedzi i pola inicjatywy

**Oczekiwany wynik:** HTTP 201, `source_type === "manual"`, `source_id === null`, `status === "DRAFT"`

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-22 — Lineage: sourceType='tool' wymaga sourceId

**Cel:** Weryfikacja, że guard lineage blokuje tworzenie inicjatywy z `sourceType='tool'` bez `sourceId`.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Test tool bez id", "sourceType": "tool" }` (bez `sourceId`)
2. Sprawdź status odpowiedzi

**Oczekiwany wynik:** HTTP 400 Bad Request — `sourceId` wymagany dla `sourceType='tool'`

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-23 — Quality warnings: pusta karta → qualityWarnings obecne

**Cel:** Weryfikacja, że inicjatywa z pustą kartą (brak KPI, RAID, deliverables itp.) zwraca ostrzeżenia jakościowe gdy `enforceQuality=true`.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`
- API lub wewnętrzny endpoint wspierający `enforceQuality: true`

**Kroki:**
1. Utwórz inicjatywę przez `POST /api/initiatives` z minimalnym body `{ "title": "Pusta karta" }` i flagi `enforceQuality: true` (jeśli eksponowane)
2. Alternatywnie: sprawdź odpowiedź przy tworzeniu przez ścieżkę z włączoną walidacją jakości
3. Sprawdź pole `qualityWarnings` w odpowiedzi

**Oczekiwany wynik:** Pole `qualityWarnings` zawiera niepustą tablicę ostrzeżeń (np. brak KPI, brak RAID, za mało deliverables) — inicjatywa MIMO TO zostaje utworzona (HTTP 201)

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-24 — Quality warnings: pełna karta → qualityWarnings puste

**Cel:** Weryfikacja, że inicjatywa z kompletną kartą (KPI, RAID, deliverables, success criteria, scope) zwraca pustą tablicę ostrzeżeń.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Utwórz inicjatywę przez `POST /api/initiatives` z pełnym body zawierającym:
   - `title`, `summary`, `hypothesis` (format: "Jeśli X to Y ponieważ Z")
   - `deliverables` (≥4 elementy)
   - `successCriteria` (≥4 elementy)
   - `scopeIn` (≥3 elementy), `scopeOut` (≥3 elementy)
   - `keyRisks` (≥2 ryzyka + assumption + dependency)
   - `costCapex` lub `expectedRoi` (ustawione)
   - `ownerBusinessId` (ustawiony)
2. Sprawdź pole `qualityWarnings` w odpowiedzi

**Oczekiwany wynik:** `qualityWarnings` jest pustą tablicą `[]` lub nieobecne w odpowiedzi — pełna karta przechodzi walidację bez ostrzeżeń

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-25 — Flaga OFF → lejek wyłączony, legacy INSERT

**Cel:** Weryfikacja, że gdy `INITIATIVE_FUNNEL_ENABLED=false` (lub nieustalone), tworzenie inicjatywy używa starszej ścieżki INSERT.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=false` lub zmienna środowiskowa nieustanowiona
- Dostęp do logów serwera lub możliwość porównania zachowania

**Kroki:**
1. Tymczasowo ustaw `INITIATIVE_FUNNEL_ENABLED=false` na środowisku testowym
2. Wykonaj `POST /api/initiatives` z body `{ "title": "Test legacy INSERT" }`
3. Sprawdź odpowiedź — czy inicjatywa została utworzona
4. Sprawdź logi serwera — nie powinno być logu `"[createInitiativeService]"`

**Oczekiwany wynik:** HTTP 201, inicjatywa utworzona, brak śladu `createInitiativeService` w logach — stara ścieżka INSERT jest użyta

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-26 — Flaga ON → lejek aktywny

**Cel:** Weryfikacja, że gdy `INITIATIVE_FUNNEL_ENABLED=true`, tworzenie inicjatywy używa `createInitiativeService`.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`
- Dostęp do logów serwera

**Kroki:**
1. Upewnij się, że `INITIATIVE_FUNNEL_ENABLED=true`
2. Wykonaj `POST /api/initiatives` z body `{ "title": "Test lejek aktywny" }`
3. Sprawdź logi serwera pod kątem logu z `"[createInitiativeService]"` lub audyt event `initiative.created`
4. Sprawdź odpowiedź — pola `name`, `title`, `status`, `sourceType`

**Oczekiwany wynik:** HTTP 201, logi pokazują użycie `createInitiativeService`, odpowiedź zawiera `{ id, name, title, status: "DRAFT", sourceType: "manual" }`

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-27 — Równoległe tworzenie → 2× POST → unikalne ID

**Cel:** Weryfikacja, że dwa równoczesne wywołania tworzące inicjatywy generują unikalne identyfikatory (brak kolizji).

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wyślij jednocześnie (np. przez 2 zakładki lub 2 żądania curl w tle) dwa requesty:
   - `POST /api/initiatives` z body `{ "title": "Równoległa inicjatywa A" }`
   - `POST /api/initiatives` z body `{ "title": "Równoległa inicjatywa B" }`
2. Porównaj pola `id` w obu odpowiedziach

**Oczekiwany wynik:** Obie odpowiedzi to HTTP 201, oba `id` są różne — brak kolizji, brak błędu 500

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-28 — POST /api/initiatives → odpowiedź zawiera { id, name, title, status, sourceType }

**Cel:** Weryfikacja kształtu odpowiedzi API po utworzeniu inicjatywy przez lejek.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z body `{ "title": "Test kształtu odpowiedzi", "sourceType": "manual" }`
2. Sprawdź strukturę odpowiedzi JSON

**Oczekiwany wynik:** Odpowiedź HTTP 201 zawiera wszystkie pola: `id` (niepusty string), `name` (=title), `title` (=name), `status` (`"DRAFT"`), `sourceType` (`"manual"`) — żadne z tych pól nie jest `undefined` ani `null`

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-29 — Invalid input: brak title → HTTP 400

**Cel:** Weryfikacja, że żądanie bez pola `title` (ani `name`) zostaje odrzucone z błędem walidacji.

**Preconditions:**
- Użytkownik zalogowany
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Wykonaj `POST /api/initiatives` z pustym body `{}` lub body bez pola `title`/`name`
2. Sprawdź status i treść odpowiedzi

**Oczekiwany wynik:** HTTP 400 Bad Request — treść błędu informuje o brakującym `title` lub podobnym komunikacie walidacji

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP

---

## F1-30 — Izolacja organizacyjna → inicjatywa orgA niewidoczna dla orgB

**Cel:** Weryfikacja, że inicjatywa utworzona w organizacji A nie jest widoczna dla użytkownika z organizacji B.

**Preconditions:**
- Dwa konta użytkowników w dwóch różnych organizacjach (orgA i orgB)
- `INITIATIVE_FUNNEL_ENABLED=true`

**Kroki:**
1. Zaloguj się jako użytkownik orgA
2. Utwórz inicjatywę `POST /api/initiatives` z body `{ "title": "Inicjatywa orgA" }`
3. Zanotuj zwrócone `id`
4. Wyloguj się i zaloguj jako użytkownik orgB
5. Wykonaj `GET /api/initiatives` — sprawdź, czy inicjatywa orgA jest widoczna
6. Wykonaj `GET /api/initiatives/<id>` dla id inicjatywy orgA

**Oczekiwany wynik:** `GET /api/initiatives` dla orgB NIE zawiera inicjatywy orgA; `GET /api/initiatives/<id>` zwraca HTTP 403 lub 404 — brak wycieku danych między organizacjami

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives`, `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL / 🔄 SKIP
