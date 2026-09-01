# CODEX DAY 240 — Assessment: skąd pochodzi odpowiedź

Data: 2026-09-01. Gałąź `codex/day240-assessment-20260901`, marker `61fbb7b88f`. Pomiar bez naprawy, nowej kolumny, migracji lub zmiany flag.

## Wynik dla właściciela

Główna odpowiedź brzmi: **pojedyncza odpowiedź w `assessment_responses` nie zapisuje swojego pochodzenia**. Zapisuje score, evidence, feedback AI, autora i czas, ale nie rozróżnia wywiadu, dokumentu, AI, ręcznego wpisu ani benchmarku. Jednocześnie dwie mocne tezy instrukcji są nieaktualne: świeża kanoniczna baza ma `assessments.source_type/source_reference`, `assessment_evidence` oraz `assessment_ai_scoring_proposals`. Problem nie polega więc na nieistnieniu całej infrastruktury Assessment, lecz na braku mikro-proweniencji w tabeli pojedynczych odpowiedzi i na kilku niezgodnych taksonomiach.

## 0. Wejście i środowisko

Marker: `MARKER OK`; HEAD wejściowy `61fbb7b88f87c563395b8ce9bf8c67ddeffbab5d`; status pusty. Dysk: 11 GiB wolne. Porty 6189/5166/5167 wolne. Tip był nowszy; start dokładnie z markera. Pierwszy przebieg zastosował 880 migracji, drugi 0. Baza: lokalny PostgreSQL `cx240` na `127.0.0.1:6189`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1. Taksonomie i realny schemat

| Znaczenie | Wartości / kształt | DB enforced | Wniosek |
|---|---|---|---|
|Workbench `EvidencePointer.kind`|`survey_response, document, interview_note, external_url, artifact` (`AssessmentWorkbenchService.ts:30-32`)|nie, JSON/payload|dowód workbencha, nie źródło wiersza odpowiedzi|
|DRD method event `evidenceType`|`document, system_record, observation` (`DrdHttpMethodWorkspaceScreen.tsx:127,141,164`)|nie wspólnym typem|drop pliku zawsze zapisuje `document` (`:663`)|
|Axis evidence|`note, link, document, reference` (`drdEvidenceScoring.ts:24`)|tak, CHECK w `20260801_asm005_007_evidence_quality_output.sql:43-45`|wąski, spójny łańcuch DRD|
|`assessment_evidence`|status/tekst/attachments, bez `evidence_type` na świeżej bazie|nie dotyczy|instrukcja oczekiwała innego schematu z migrations-v2|
|AI scoring proposals|model, citations, reasoning, confidence, status|częściowo typami, bez jednej taksonomii źródła|ma proweniencję propozycji AI, nie zaakceptowanej odpowiedzi|
|Initiative suggestion `sourceType`|`interview_insight, assessment, audit, string` (`InitiativeSuggestionBadge.tsx:31`)|nie|pochodzenie kandydata inicjatywy, inne pytanie|
|runtime provenance badge|V8 vs fallback (`AssessmentSessionEditorView.tsx:2098-2115`)|nie|wersja API, nie źródło odpowiedzi|

### Wynik `\d` na świeżej bazie

- `assessments` **ma** `source_type` i `source_reference`. Żywym producentem jest `server/migrations/730_beta_schema_fixes.sql:36-37`, więc teza T3 została obalona.
- `assessment_responses` ma 12 kolumn: `id, assessment_id, dimension_id, subdimension_id, question_id, score, evidence, evidence_attachments, notes, ai_feedback, answered_by, answered_at`; nie ma pola source/provenance.
- `assessment_axis_evidence` istnieje i ma CHECK czterech wartości.
- `assessment_evidence` istnieje dzięki `server/migrations/20260719_baseline_gap.sql:1823`; ma kształt score/evidence status, ale nie `evidence_type` oczekiwane przez instrukcję.
- `assessment_ai_scoring_proposals` istnieje dzięki `server/migrations/20260719_baseline_gap.sql:1723`; teza T6 o tabelach wyłącznie w martwym `migrations-v2` została obalona.

README `server/migrations/README.md:1-6` nadal mówi, że nowe migracje są w `server/migrations-v2`, podczas gdy runner wybiera `server/migrations` (`migrate.postgres.ts:816`). To jest prawdziwa sprzeczność dokumentacji, ale nie dowód braku tabel.

## R2. Cztery warstwy

| Powierzchnia | Baza/API | Front czyta | Render | Miejsce zerwania |
|---|---|---|---|---|
|Główna sesja Assessment|`assessment_responses` nie ma źródła|typy i edytor czytają score/evidence/AI feedback|plakietka provenance pokazuje runtime|warstwa (a): źródło odpowiedzi nigdy nie jest zapisane|
|DRD HTTP workspace|method event ma `evidenceType`|frontend tworzy/odczytuje pole|workspace używa dowodów|wartość dropu jest hard-coded `document`, więc semantyka może być fałszywa już przy zapisie|
|Quality Review|DB CHECK → trasa V8 → `V8AssessmentEvidence[]` (`AssessmentQualityReviewPanel.tsx:31`)|czyta `item.evidenceType`|renderuje typ (`:328`)|łańcuch kompletny, lecz tylko dla axis evidence DRD|
|Insight z Assessment|Workbench promuje referencje/evidence do downstream insight (`AssessmentWorkbenchService.ts:396-413`)|InsightDetailView renderuje insight|widać pochodzenie artefaktu/insightu|nie zachowuje źródła pojedynczej odpowiedzi, bo upstream go nie ma|

Pełny grep śladu znajduje się w `/private/tmp/cx-day240-assessment-artefakty/four-layer-trace.txt`.

## R3. Liczby lokalnej bazy

Brak bezpiecznego, wymaganego fixture z realną populacją odpowiedzi; pomiar pustej świeżej bazy jest wyłącznie walidacją zapytań i schematu:

```text
assessment_responses: wiersze=0, z_evidence=0, z_ai_feedback=0
assessments WHERE source_type IS NOT NULL: 0 (zapytanie działa — obala oczekiwany błąd T3)
assessment_axis_evidence GROUP BY evidence_type: 0 wierszy
```

Nie wolno z tego wyciągać wniosku o procentach danych użytkowników. Mianownik realnych odpowiedzi pozostaje `UNKNOWN`.

## R4. Warianty decyzji

### A — „Nie udawaj, że wiesz”

Pokazać przy odpowiedziach `Źródło nieznane`. Koszt bardzo niski, ryzyko małe. Właściciel zobaczy uczciwy brak zamiast fałszywej sugestii dowodowości. Nie odzyskuje to historii.

### B — źródło i identyfikator przy każdej odpowiedzi

Zastosować sprawdzony wzorzec `source_type + source_id` z tasks/decisions (`20260311_origin_tracking.sql:5-44`) do `assessment_responses` oraz wszystkich writerów odpowiedzi. Koszt średni; największe ryzyko to niepełne pokrycie wielu ścieżek zapisu i nieuzgodniona wspólna taksonomia. Właściciel zobaczy jedną plakietkę obok każdej odpowiedzi.

### C — pełny cykl propozycja → akceptacja

Oddzielić propozycję AI od zaakceptowanej odpowiedzi, zachować model, cytowania, uzasadnienie, człowieka i czas decyzji. Koszt wysoki, osobny projekt. Właściciel zobaczy pełną historię i rozróżnienie danych wejściowych od interpretacji AI.

### Osobna decyzja migracyjna

Poprawić lub wycofać dwa README wskazujące `migrations-v2` i formalnie nazwać kanoniczny katalog. Nie rekomenduję kasowania katalogu bez osobnego audytu, ponieważ świeży schemat dowiódł, że część oczekiwanych tabel ma żywych producentów w `server/migrations`.

## R5. Powierzchnie i osiągalność

Zakres wzorca instrukcji obejmuje 87 plików `.tsx`: 33 nazwane jak ekran/hub/view/panel/editor/workspace/form/tab/report i 54 komponenty pomocnicze (klasyfikacja nazwowa, nie dowód routingu). Lista: `assessment-tsx.txt`. Realne trasy obejmują m.in. `AssessmentSessionEditorView` (`AppRoutes.tsx:2233`) i `PublicMiniAssessmentView` (`:1246`). `FreeAssessmentView.tsx` nie ma montażu w `AppRoutes.tsx`. `/assessment/audits` pozostaje stałą historyczną; komentarz `routeConfig.ts:387-390` potwierdza, że trasa nigdy nie była zarejestrowana. Flaga pięciu powierzchni jest domyślnie włączona, a Outputs ma rzeczywisty `EmptyState` (`AssessmentOutputsTab.tsx:306`).

## Testy

Przed dokumentacją: 19 plików, 119 pełnych nazw, 119 PASS, 0 FAIL, 0 SKIP, `--retry=0`. Pakiet zawiera testy PG i jednostkowe; jawny `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, strażniki V8/auth/results i JWT były w tej samej linii. Nie przedstawiam tego jako dowodu wszystkich tras HTTP. Pułapka (e) została wyłączona przez realne `\d`, które obaliło założenia o martwych tabelach.

## Korekty wobec instrukcji

1. T3 obalona: `assessments.source_type/source_reference` istnieją; producent `730_beta_schema_fixes.sql:36-37` jest żywy.
2. T6 obalona: obie tabele istnieją; producenci `20260719_baseline_gap.sql:1723,1823` są w kanonicznym katalogu.
3. `assessment_evidence` istnieje, ale nie ma `evidence_type`; instrukcja miesza schemat martwego eksperymentu z kształtem żywym.
4. R1 żąda HTTP do brakujących tabel warunkowo. Warunek nie zaszedł; nie wykonywano zbędnych mutacji ani połączeń do zewnętrznej bazy.
5. Odwołanie R7 do nieobecnego `§R.2` uzupełniono pełnym raportem z mianownikami i sekcją nieweryfikowalną.

## TWIERDZENIA NIEZWERYFIKOWANE

- Ile realnych odpowiedzi użytkowników ma evidence/AI feedback i jakie jest ich faktyczne pochodzenie: `UNKNOWN`; lokalna baza była pusta, zdalny dostęp zakazany.
- Dokładna liczba niezależnych writerów `assessment_responses` wymagających zmiany w wariancie B wymaga osobnego, pełnego audytu zapisów; nie podaję kosztu w dniach bez estymacji zespołu.
- Klasyfikacja 33/54 opiera się na nazwach plików; osiągalność każdego z 87 plików nie została udowodniona osobnym grafem importów.

## Artefakty i mianowniki

Artefakty poza repo: `/private/tmp/cx-day240-assessment-artefakty`. Mianowniki: 880/0 migracji; 12 kolumn `assessment_responses`; 87 plików TSX według jawnego globu; 33/54 klasyfikacja nazwowa; 119 testów według pełnych nazw; wszystkie liczby danych 0/0 dotyczą wyłącznie pustej lokalnej bazy.
