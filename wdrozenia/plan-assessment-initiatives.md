# Plan wdrozenia: Assessment -> Initiatives

## Instrukcja dla agenta (do rozliczenia)
### Cel
Wdrozyc pelny modul Assessment z 5 narzedziami, raportem i generowaniem inicjatyw.

### Zakres
- Lista assessmentow (CRUD) + dynamiczne submenu
- 5 narzedzi: DRD/ADMA/CMMI/SIRI + Lean 4.0 (Coming soon)
- Raport assessmentu i approval flow
- Generowanie inicjatyw (DRAFT) + drawer 50%
- Integracje: Initiatives, Decision Management, Reporting

### Deliverables (musi dostarczyc)
1) UI/UX dla listy, workspace, raportu, drawer
2) Formularze i walidacje per narzedzie
3) API i workflow statusow + gate decisions
4) Powiazania z initiatives + audit log
5) Testy (API/E2E) dla glownego flow

### Kryteria rozliczenia
- Flow DRAFT -> REVIEW -> APPROVED -> Generate działa
- Raport i approval wymagane przed generowaniem inicjatyw
- Inicjatywy widoczne w Initiatives po PLANNING
- Dynamiczne submenu pokazuje tylko aktywne assessmenty

## Cel i kontekst
Modul Assessment ma generowac inicjatywy na podstawie audytow oceny dojrzalosci. Logika procesu jest taka sama jak w Tools, ale kazde narzedzie assessment ma osobny format, pytania i zakres. Wymagana jest solidna nawigacja po assessmentach, obsluga CRUD i dynamiczne submenu pozwalajace przelaczac sie pomiedzy aktualnie otwartymi assessmentami.

Wymagania biznesowe:
- statusy assessmentu: DRAFT -> REVIEW -> APPROVED
- raport generowany i zatwierdzany w ramach procesu assessmentu
- generowanie inicjatyw po zatwierdzeniu assessmentu
- inicjatywy w osobnym panelu (prawy drawer) i lacza sie globalnie dopiero w Initiatives (etap 3 statusu inicjatywy)
- dynamiczne submenu pokazuje tylko aktywnie otwarte assessmenty
- 5 roznych narzedzi assessment, kazde z wlasnym formatem
- Lean 4.0: status "Coming soon"
- brak osobnego czatu w module, jedynie podpowiedzi i wsparcie w odpowiedziach

## Zasady domenowe
- Assessment ma osobny status niezalezny od statusu inicjatyw
- Generowanie inicjatyw jest blokowane do momentu APPROVED
- Inicjatywy generowane z assessmentu startuja jako DRAFT
- Panel inicjatyw w assessmentach jest niezalezny od globalnego Initiatives

## Decyzje (gates)
- Decision: Request Review (owner: Project Lead, due date)
- Decision: Approve Assessment (owner: PMO/Owner, due date)
- Decision: Approve Report (owner: PMO/Owner, due date)
- Decision: Generate Initiatives (owner: Consultant Lead, due date)
Brak decyzji blokuje APPROVED i generowanie inicjatyw.

## UX i UI (opis)
### Lista Assessmentow (My Assessments)
Widok listy z CRUD:
- lista z typem, nazwa, status, progres, updated
- akcje: Open / Edit / Duplicate / Delete
- filtr statusow + typow assessmentu
- przycisk "New Assessment"

### Dynamiczne submenu
Menu w lewym panelu:
- widzi tylko assessmenty otwarte w sesji
- kazdy wpis to skrót do konkretnego assessmentu
- przy zamknieciu assessmentu wpis znika

### Widok Assessment (Tool Workspace)
Uklad ClickUp-like:
- gorny pasek: nazwa assessmentu, status, progres, akcje
- lewa nawigacja: sekcje/podsekcje formularza
- glowny obszar: formularz graficzno-tekstowy
- prawy panel: podpowiedzi + "Initiatives drawer"

Elementy UI:
- wizualizacja wynikow w trakcie wypelniania (mini wykresy, heatmapy, score)
- inline assistance przy pytaniach
- completion checker (progres i braki)

### Raport (Report)
Po zakonczeniu assessmentu:
- widok raportu (tekst + wizualizacje)
- mozliwosc zatwierdzenia raportu
- status "Approved" wymaga zatwierdzonego raportu

### Panel inicjatyw (prawy drawer)
Behavior:
- panel wysuwa sie z prawej do ~50% szerokosci
- lista inicjatyw powiazanych z danym assessmentem
- klik inicjatywy otwiera details w tym samym panelu
- zmiana statusu inicjatywy w panelu
- przycisk "Go to Initiatives" (globalny modul) aktywny po zmianie na PLANNING

## Assessment tools (5 narzedzi)
Kazde narzedzie ma osobny format i zestaw pytan:
1) DRD (najwiekszy)
2) ADMA (sredni)
3) CMMI (sredni)
4) SIRI (sredni)
5) Lean 4.0 (Coming soon)

Wymagania:
- osobne schematy formularzy i walidacji
- rozne poziomy i sekcje
- mapping odpowiedzi -> wynik i wizualizacja

## Polaczenia z reszta aplikacji
### Zrodla kontekstu
- dane organizacji + historia ocen
- (opcjonalnie) kontekst czatu aplikacji jako wsparcie w generowaniu inicjatyw

### Docelowe destynacje
- Initiatives module: inicjatywy w statusie DRAFT
- Roadmap: brak (do APPROVED)

### Relacje danych
Assessment -> Initiative:
- assessment_id, assessment_type, assessment_session_id
- report_id, generation_batch_id
- source_context_id (org + chat)

## Uprawnienia (Admin)
Konfiguracja uprawnien do statusow:
- role_can_request_review
- role_can_approve_assessment
- role_can_generate_initiatives
Fallback: Admin/Owner

## DoD (Definition of Done)
### Lista Assessmentow
- CRUD dziala z walidacjami
- filtry i statusy dzialaja
- otwarcie assessmentu dodaje wpis do submenu

### Formularze
- kazde narzedzie ma osobny formularz
- walidacje i progres dzialaja
- wizualizacja wynikow na zywo

### Raport
- raport generuje sie po zakonczeniu
- raport ma tekst + grafiki
- zatwierdzenie raportu wymaga uprawnien

### Inicjatywy
- generowanie po APPROVED
- inicjatywy widoczne w prawym panelu
- inicjatywy sa DRAFT i powiazane z assessmentem
- przejscie do globalnego Initiatives po statusie PLANNING

## Zadania implementacyjne
### Frontend
- lista assessmentow z CRUD
- dynamiczne submenu (aktywnie otwarte)
- 5 formularzy assessment (osobne UI)
- wizualizacje wynikow w trakcie
- raport view + approve flow
- prawy panel inicjatyw (drawer 50%)

### Backend
- statusy assessmentu i workflow
- zapis raportu i audyt zatwierdzenia
- generowanie inicjatyw po APPROVED
- powiazania assessment <-> initiatives
- uprawnienia z admina

### AI / Generowanie inicjatyw
- pipeline: assessment answers + org context + chat context
- mapping do kategorii + priorytetu
- walidacja inicjatyw (opis, kategoria, ryzyko)

## Grafiki i diagramy (do dostarczenia)
1) Flow statusow assessmentu i inicjatyw
2) Layout assessment workspace (wireframe)
3) Drawer inicjatyw 50% (wireframe)
4) Struktura raportu (info architecture)

## Ryzyka i mitigacje
- Ryzyko: zbyt duze formularze (DRD) -> segmentacja na sekcje + autosave
- Ryzyko: niekompletne dane -> completion checker + blokada Approve
- Ryzyko: chaos w nawigacji -> tylko aktywne assessmenty w submenu

## Kryteria akceptacji
- uzytkownik tworzy assessment, wypelnia, generuje raport, zatwierdza
- po zatwierdzeniu generuje inicjatywy w DRAFT
- inicjatywy widoczne w prawym panelu
- globalny Initiatives widzi inicjatywy po przejsciu do PLANNING
- dynamiczne submenu pokazuje tylko aktywnie otwarte assessmenty

---

# Kompletny projekt wdrozeniowy

## 1. Zakres wdrozenia (in/out)
### In scope
- Pelny modul Assessment: lista, workspace, formularze, raport, inicjatywy
- 5 narzedzi assessment (DRD, ADMA, CMMI, SIRI, Lean 4.0 jako Coming soon)
- Integracje: Initiatives, Decision Management, Reporting
- UX: dynamiczne submenu, drawer inicjatyw 50%, brak osobnego czatu
- Uprawnienia (role-based gates)

### Out of scope (na ten etap)
- Globalny Roadmap routing dla inicjatyw przed PLANNING
- Nowe modele AI poza generowaniem inicjatyw
- Rozbudowane analizy benchmarkingowe miedzy firmami

## 2. Model procesu (end-to-end)
### Statusy assessmentu
1) DRAFT
2) REVIEW
3) APPROVED

### Mapowanie na aktualny workflow (backend)
Aktualny backend posiada statusy:
- DRAFT
- IN_REVIEW
- AWAITING_APPROVAL
- APPROVED
- REJECTED
- ARCHIVED

Mapowanie do wymaganych statusow:
- DRAFT = DRAFT
- REVIEW = IN_REVIEW + AWAITING_APPROVAL (faza review, zakonczona wszystkimi recenzjami)
- APPROVED = APPROVED

Gate decisions pozostaja zgodne z briefem:
- Request Review -> DRAFT -> REVIEW (IN_REVIEW)
- Approve Report -> wymagane przed AWAITING_APPROVAL
- Approve Assessment -> AWAITING_APPROVAL -> APPROVED
- Generate Initiatives -> tylko po APPROVED

### Gate decisions (blokady)
- Request Review -> DRAFT -> REVIEW
- Approve Assessment -> REVIEW -> APPROVED
- Approve Report -> wymagane przed APPROVED
- Generate Initiatives -> blokowane do APPROVED

### Przeplyw glowny
1) Utworzenie assessmentu (DRAFT)
2) Wypelnienie formularza (sekcje, progres, wizualizacja)
3) Generowanie raportu
4) Review i decyzje (Request Review, Approve Report, Approve Assessment)
5) Generowanie inicjatyw (DRAFT) i widok w drawer
6) Przejscie do Initiatives po PLANNING

## 3. Informacja i dane (model danych)
### Encje
- Assessment
  - id, type, name, status, progress, owner_id
  - created_at, updated_at, submitted_at, approved_at
  - current_section_id, score_summary
- AssessmentSection/Question
  - assessment_id, section_id, question_id, answer, score
- AssessmentReport
  - report_id, assessment_id, version, status, content, visuals
  - approved_by, approved_at
- AssessmentInitiativeLink
  - assessment_id, initiative_id, generation_batch_id
- AssessmentSession
  - session_id, assessment_id, opened_by, opened_at, closed_at

### Relacje
- Assessment 1..N Sections/Answers
- Assessment 1..N Reports (wersjonowanie)
- Assessment 1..N Initiatives (link)
- Assessment 1..N Sessions (dynamiczne submenu)

## 4. UX / IA / UI
### 4.1 Lista assessmentow (My Assessments)
- Tabela: typ, nazwa, status, progres, updated
- Akcje: Open / Edit / Duplicate / Delete
- Filtry: status, typ, owner
- CTA: New Assessment

### 4.2 Dynamiczne submenu
- Pokazuje tylko aktywnie otwarte assessmenty (AssessmentSession)
- Zamkniecie workspace usuwa wpis z submenu
- Maks. 6 aktywnych wpisow, reszta w "More"

#### Reguly sesji (submenu)
- Otwarcie assessmentu tworzy sesje (assessment_id + user_id + opened_at)
- Zamkniecie zakladki usuwa sesje (closed_at)
- Odzyskiwanie sesji po refresh: ostatnie 6 aktywnych wpisow

### 4.3 Workspace (Tool Workspace)
- Top bar: nazwa, status, progres, akcje (Request Review, Approve)
- Lewa nawigacja: sekcje/podsekcje
- Srodek: formularz (grafika + tekst)
- Prawy panel: podpowiedzi + drawer inicjatyw
- Inline assistance przy pytaniach, brak osobnego czatu

### 4.4 Raport
- Sekcje: Executive summary, Scores, Gaps, Recommendations
- Wizualizacje: wykresy radar/heatmapa
- Zatwierdzenie raportu (role-based)

### 4.5 Drawer inicjatyw (50%)
- Lista inicjatyw powiazanych z assessmentem
- Detale inicjatywy w tym samym panelu
- Zmiana statusu inicjatywy (DRAFT -> PLANNING)
- CTA: Go to Initiatives aktywne po PLANNING

#### UX drawer
- Szerokosc: 50% viewportu, overlay tylko na workspace
- Tryb listy + tryb detalu w jednym panelu
- Zachowanie stanu przy zmianie sekcji formularza

## 5. Formularze Assessment (5 narzedzi)
### Wspolne wymagania
- Osobny schemat (JSON schema) + walidacje
- Sekcje i podsekcje, zaleznie od narzedzia
- Live scoring + mapping odpowiedzi do wynikow
- Autosave i resume

### Narzedzia
1) DRD (najwiekszy)
2) ADMA (Coming soon, tylko podglad)
3) CMMI (Coming soon, tylko podglad)
4) SIRI (sredni)
5) Lean 4.0 (Coming soon, tylko podglad)

### DRD (Digital Readiness Diagnosis) - specyfikacja
Zrodlo: wewnetrzna dokumentacja `knowledge/extracted_content.txt` + struktura w kodzie `src/services/drdStructure.ts` oraz `src/drd_data.json`.
- Osi cyfrowej transformacji opisane w knowledge: procesy, produkty, modele biznesowe, dane, kultura, cyberbezpieczenstwo oraz AI readiness (os 7).
- Obecny kod zawiera os 7 (AI Maturity) z 5 poziomami dojrzałości i 5 obszarami (7A-7E) z opisami.
- Skala dojrzałości w `drd_data.json`: 5 poziomow (Initial -> Optimized).
- Formularz DRD powinien odwzorowac aktualny stan danych w kodzie, bez modyfikacji modelu.

Wymagane sekcje DRD (UI/UX):
- Dashboard osi z podsumowaniem wynikow i gaps
- Widok osi -> obszary -> poziomy (skala 1-5)
- Wizualizacje: radar + heatmapa postepu po osiach

### SIRI (Smart Industry Readiness Index) - specyfikacja
Zrodlo: struktura w kodzie `src/services/siriStructure.ts` + oficjalny opis SIRI (INCIT/EDB).
- 3 Building Blocks: Process, Technology, Organization
- 8 Dimensions: Operations, Supply Chain, Product Lifecycle, Automation, Connectivity, Intelligence, Talent Readiness, Structure & Management
- 16 Prioritisation Areas (mapowane w kodzie w SIRI_PRIORITISATION_AREAS)
- Skala dojrzałości 0-5 (0 = Not Started)

Wymagane sekcje SIRI (UI/UX):
- Widok blokow z mini radarami per block
- Widok wymiarow (dimension cards) z current/target
- Priorytetyzacja: heatmapa 16 obszarow

### ADMA / CMMI / Lean 4.0
- Oznaczone jako Coming soon
- Dostepne tylko jako podglad i landing, bez edycji formularzy

## 6. Integracje
### Initiatives module
- Tworzenie inicjatyw po APPROVED
- Inicjatywy startuja jako DRAFT
- Sync statusu do Initiatives po PLANNING

### Decision Management
- Gate decisions w workflow assessmentu
- Audyt kto i kiedy zatwierdzil

### Reporting
- Raport assessmentu jako osobny artefakt
- Eksport PDF w fazie 2 (opcjonalnie)

## 7. API i backend (high-level)
### Endpointy
- GET /assessments
- POST /assessments
- GET /assessments/:id
- PUT /assessments/:id
- DELETE /assessments/:id
- POST /assessments/:id/submit
- POST /assessments/:id/report
- POST /assessments/:id/report/approve
- POST /assessments/:id/decisions
- POST /assessments/:id/initiatives/generate
- GET /assessments/:id/initiatives

### Workflow i gate decisions (backend)
- `assessment-workflow`: statusy DRAFT -> IN_REVIEW -> AWAITING_APPROVAL -> APPROVED
- Review completion przechodzi do AWAITING_APPROVAL
- Approve assessment zmienia na APPROVED
- Generowanie inicjatyw mozliwe tylko dla APPROVED

### Luki do uzupelnienia w backendzie
- `assessment-reports` jest stubem (501) i wymaga pelnej implementacji raportu + approve
- Brak powiazania gate "Approve Report" w workflow (do dodania w logice)

### Workflows i reguly
- Approve Report wymagane przed Approve Assessment
- Generate Initiatives tylko po APPROVED
- Gate decisions wymagaja uprawnien

## 8. Uprawnienia i role
### Role-based flags
- role_can_request_review
- role_can_approve_assessment
- role_can_generate_initiatives

### Fallback
- Admin/Owner zawsze ma dostep

## 9. AI / Generowanie inicjatyw
### Pipeline
- Input: answers + org context + (opcjonalnie) chat context
- Output: inicjatywy z kategoriami i priorytetem

### Walidacje
- Minimalny opis, kategoria, ryzyko
- Dedup i merge w ramach batcha

## 10. Etapy realizacji (roadmap)
### Faza 0: Analiza i design (1-2 tygodnie)
- Audyt UX z Tools
- Specyfikacja formularzy
- Mapping scoringu i raportu
- Makiety: workspace, raport, drawer

### Faza 1: Core funkcje (2-3 tygodnie)
- Lista i CRUD assessmentow
- Dynamiczne submenu
- Formularze (DRD/SIRI)
- ADMA/CMMI/Lean 4.0 jako Coming soon (bez edycji)
- Statusy i gates

### Faza 2: Raport i inicjatywy (2 tygodnie)
- Generowanie raportu
- Approval flow
- Generowanie inicjatyw + drawer

### Faza 3: Integracje i stabilizacja (1-2 tygodnie)
- Integracje z Initiatives i Decision Management
- Monitoring, audit log
- Uporzadkowanie permissions

## 11. Ryzyka i mitigacje
- Zbyt duze formularze -> sekcje, autosave, progres
- Niekompletne dane -> completion checker + blokady
- Chaos w nawigacji -> tylko aktywne assessmenty w submenu
- Nadmierne inicjatywy -> walidacja i deduplikacja

## 12. Testy i QA
### Scenariusze krytyczne
- CRUD assessmentow i uprawnienia
- Workflow statusow i gates
- Generowanie raportu i approvals
- Generowanie inicjatyw po APPROVED
- Drawer inicjatyw + przejscie do Initiatives

### Testy automatyczne
- Unit: scoring, walidacje, mapping
- API: statusy, gate decisions
- E2E: DRAFT -> REVIEW -> APPROVED -> initiatives

### Testy mapowania statusow
- DRAFT -> IN_REVIEW (submit-for-review)
- IN_REVIEW -> AWAITING_APPROVAL (komplet recenzji)
- AWAITING_APPROVAL -> APPROVED (approve)

## 13. Operacje i monitoring
- Logi akcji: statusy, approvals, generation batches
- Metrics: czas wypelnienia, completion rate
- Alerts: blad generowania inicjatyw, brak raportu

## 14. Wdrozenie i rollout
### Plan wdrozenia
- Dev -> Staging -> Production
- Feature flag: assessment_module_v2
- Canaries: 5-10% organizacji

### Komunikacja
- Instrukcja dla PMO/Owner
- Checklist dla Project Lead

## 15. Definition of Done (rozszerzone)
- UI: lista, workspace, drawer, raport gotowe i zgodne UX
- Backend: statusy, gates, raport, inicjatywy
- Integracje: Initiatives, Decision Management, Reporting
- Monitoring i audit log aktywne
- Testy E2E przechodza

## 16. Artefakty do dostarczenia
- Makiety (workspace, drawer, raport)
- Schemat scoringu i mappingu
- Specyfikacja API
- Checklist wdrozeniowy
