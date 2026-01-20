# Plan wdrozenia: Tools -> Initiatives (Discovery)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Zaprojektuj i wdroz pelny workflow Tools -> Initiatives (DRAFT) zgodny z procesem konsultingowym.

### Zakres
- Tool Workspace (DRAFT) + Review + Approved
- Generowanie inicjatyw (DRAFT) z metodyka i limitem 7
- Integracje: Initiatives, Decision Management, Context (org + chat)
- UI/UX spójny z reszta aplikacji, bez osobnego czatu

### Deliverables (musi dostarczyc)
1) Widoki UI/UX (workspace, review, generate modal, drawer)
2) API endpoints + walidacje + permissions
3) Model danych i relacje (tool -> initiative)
4) Decyzje (gates) i audit log
5) Testy (unit/API/E2E) + scenariusze

### Kryteria rozliczenia
- Flow DRAFT -> REVIEW -> APPROVED -> Generate dziala end-to-end
- Inicjatywy widoczne w Initiatives jako DRAFT z powiazaniem do toola
- DoD i role blokują przejscia
- UI/UX zgodny ze standardem aplikacji

## Cel i kontekst
Modul Tools (Discovery) jest miejscem pracy na narzedziach analitycznych. UI/UX nawigacji i wyboru toola jest akceptowany, natomiast do dopracowania jest obszar pracy na narzedziu oraz mechanika tworzenia inicjatyw z toola. Nie budujemy osobnego czatu w toolu, wykorzystujemy czat aplikacji jako zrodlo kontekstu i dyskusji. System ma wspierac odpowiedzi podpowiedziami, prowadzic do kompletnosci, oferowac faze zatwierdzenia, a nastepnie generowac inicjatywy w statusie DRAFT.

Wymagania biznesowe:
- brak osobnego czatu w toolu, jedynie inline assist i polaczenie z czatem aplikacji
- etap Review/Approved na poziomie toola przed generowaniem inicjatyw
- liczba inicjatyw wybierana z predefiniowanych wartosci + mozliwosc zmiany, z gorna granica 7
- uprawnienia do przejsc faz musza byc definiowane w panelu admin
- inicjatywy wynikaja z toola, ale w kontekscie organizacji i rozmowy z czatem
- inicjatywy po wygenerowaniu sa w statusie DRAFT i widoczne w obszarze Initiatives

## Zasady domenowe
- Tool statusy: DRAFT -> REVIEW -> APPROVED
- Inicjatywy generowane z toola zawsze startuja w statusie DRAFT
- Tool nie generuje inicjatyw, jesli nie spelniono DoD dla narzedzia
- Mechanika generowania inicjatyw wymaga wybrania metodyki i liczby inicjatyw (max 7)
- Review i Approved maja role-permissions definiowane w admin

## Decyzje (gates)
W tym module decyzje sa formalnym punktem kontroli:
- Decision: Request Review (owner: Project Lead, due date)
- Decision: Approve Tool (owner: PMO/Owner, due date)
- Decision: Generate Initiatives (owner: Consultant Lead, due date)
Brak decyzji blokuje przejscie do kolejnej fazy.

## UX i UI (opis)
### Widok narzedzia (Tool Workspace)
Ukad w stylu ClickUp:
- lewy panel: nawigacja aplikacji
- gorny pasek: nazwa narzedzia, status, progres, akcje
- glowna kolumna: sekcje narzedzia z polami i pomocami
- prawy panel: kontekst organizacji + link do czatu aplikacji

Elementy UI:
- Completion checker (progres + lista kryteriow)
- Inline assistance przy polach (micro-suggestions)
- Wskaznik Confidence (1-5) dla wypelnionych sekcji
- Przycisk "Request review" (po spelnieniu DoD)

### Faza Review
Widok review zawiera:
- podsumowanie odpowiedzi z toola
- lista brakow (gaps)
- sekcja "Generate initiatives" z wyborem liczby i metodyki
- akcje: Approve, Send back to Draft (z komentarzem)

### Generowanie inicjatyw (Draft)
Po Approve:
- modal z wyborem liczby inicjatyw (3/4/5/6/7 + custom do 7)
- wybor metodyki (opis w sekcji Metodyki)
- opcja "Include AI chat context"
- przycisk Generate Drafts

Wynik:
- lista Draft Initiatives w panelu "Generated from this tool"
- link do Initiatives (sekcja globalna)

## Metodyki generowania inicjatyw (propozycja)
Wybor metodyki podczas generowania:
1) Impact x Feasibility (klasyczna)
2) Value x Effort (szybkie wins)
3) Risk/Compliance (bezpieczenstwo i regulacje)
4) Customer/Market (ukierunkowanie na rynek/klienta)
5) Operational Efficiency (redukcja kosztow i tarc)

Kazda metodyka:
- generuje priorytet (P1/P2/P3)
- przypisuje tagi i wstepna ocene ryzyka
- mapuje inicjatywy do kategorii Strategy/Operations/Digital/Process Auto

## Polaczenia z reszta aplikacji
### Zrodla kontekstu
- dane organizacji: profil, branze, wielkosc, cele
- kontekst z czatu aplikacji: ostatnie 30-50 wiadomosci lub wybrane fragmenty
- historyczne inicjatywy i statusy (jesli istnieja)

### Docelowe destynacje
- Initiatives module: nowe inicjatywy ze statusem DRAFT
- Roadmap: brak, dopiero po APPROVED
- My Work / Tasks: brak (dopiero po tworzeniu zadan w initiative)

### Relacje danych
Tool -> Initiative:
- tool_id, tool_type, tool_session_id
- source_context_id (chat + org)
- metodology_id
- generation_batch_id

## Zasady uprawnien (Admin)
Konfiguracja uprawnien do statusow:
- role_can_request_review
- role_can_approve_tool
- role_can_generate_initiatives

Fallback:
- jesli brak konfiguracji, default tylko Admin/Owner

## DoD (Definition of Done)
### Tool Workspace
- pola krytyczne maja walidacje
- completion checker pokazuje realny progres
- inline assistance dziala bez osobnego czatu
- statusy narzedzia zapisywane i widoczne w UI

### Review i Approve
- role permissions dzialaja (blokady UI + backend)
- review pokazuje summary i braki
- approve wymaga spelnienia DoD

### Generowanie inicjatyw
- wybieranie liczby inicjatyw (predef + custom do 7)
- wybieranie metodyki
- generowanie batcha z powiazaniem do toola
- inicjatywy widoczne w Initiatives jako DRAFT

### Integracje
- link z toola do Initiatives
- powiazanie w initiative (source: tool)
- kontekst czatu w pipeline generowania

## Zadania implementacyjne
### Frontend
- widok Tool Workspace z completion checker
- inline assistance przy polach
- flow Review i modal Approve/Generate
- panel "Generated from this tool"
- ograniczenia wyboru liczby inicjatyw (max 7)

### Backend
- statusy narzedzia: DRAFT/REVIEW/APPROVED
- uprawnienia statusow z admina
- endpoint generate initiatives
- zapis powiazan tool <-> initiatives
- audit log: kto zatwierdzil, kiedy, ile inicjatyw

### AI pipeline
- selector kontekstu: org + chat + tool answers
- generowanie w oparciu o metodyke
- dodanie tagow i priorytetow
- walidacja wynikow (min opis, kategoria, ryzyko)

## Grafiki i diagramy (do dostarczenia)
1) Diagram przeplywu statusow toola i inicjatyw
2) Layout Tool Workspace (wireframe)
3) Modal Generate Initiatives (wireframe)
4) Mapowanie: tool -> initiative (schema)

## UX szczegoly (mikro-interakcje)
- "Request review" aktywne tylko po spelnieniu DoD
- "Approve" wymaga roli + potwierdzenia
- generate inicjatywy pokazuje "preview list" przed zapisaniem
- tooltipy przy polach z micro-suggestions

## Ryzyka i mitigacje
- Ryzyko: zbyt duza liczba inicjatyw => limit 7 + rekomendacja 3-5
- Ryzyko: brak kontekstu z czatu => fallback do danych organizacji
- Ryzyko: approval bez kompletnego toola => wymagania DoD

## Kryteria akceptacji
- Uzytkownik moze przejsc caly flow: Draft -> Review -> Approved -> Draft Initiatives
- Inicjatywy widoczne globalnie i maja link do toola
- Uprawnienia z admina dzialaja w UI i backend
- UI/UX spójny z reszta aplikacji (ClickUp-like)

---

# Pelny plan wdrozenia (kompletny)

## 1) Zakres funkcjonalny (End-to-End)
### 1.1 Tool Workspace (DRAFT)
- edycja odpowiedzi w sekcjach narzedzia
- inline assistance per pole (micro-suggestions, podpowiedzi walidacyjne)
- completion checker z kryteriami DoD
- confidence 1-5 per sekcja + opis powodu
- podglad kontekstu: org + chat + historyczne inicjatywy
- akcja "Request review" tylko po spelnieniu DoD

### 1.2 Review
- read-only podsumowanie odpowiedzi z toola
- lista brakow i niezgodnosci (gaps)
- komentarze review (watek decision)
- akcja "Approve" lub "Send back to Draft"

### 1.3 Approved -> Generate Draft Initiatives
- modal generowania (liczba + metodyka + chat context)
- preview list (nazwa, kategoria, priorytet, ryzyko)
- zapis batcha inicjatyw (DRAFT) z powiazaniem do toola
- panel "Generated from this tool" + link do Initiatives

## 2) UX / UI - specyfikacja ekranow
### 2.1 Tool Workspace (ClickUp-like)
Layout:
- lewy panel: nawigacja globalna
- top bar: Tool name, status, progress, actions
- glowna kolumna: sekcje narzedzia
- prawy panel: context org + ostatnie insights + link do chatu

Komponenty:
- `ToolStatusBadge` (DRAFT/REVIEW/APPROVED)
- `CompletionChecker` (progress + lista kryteriow)
- `InlineAssist` (podpowiedzi, bledy, rekomendacje)
- `ConfidenceIndicator` (1-5, tooltip z uzasadnieniem)
- `ToolActionBar` (Request review / Save / Export)
- `ContextPanel` (org profile, chat snippets)

Interakcje:
- Zmiana pola aktualizuje progres i confidence
- Tooltipy micro-suggestions bez otwierania czatu
- Request review: modal z potwierdzeniem i checklist

### 2.2 Review
Układ:
- lewa kolumna: summary odpowiedzi per sekcja
- prawa kolumna: gaps + rekomendacje
- dolny pasek: Approve / Send back

Zachowanie:
- Approve tylko po DoD + rola
- Send back wymaga komentarza
- Decision wpis w logu decyzji

### 2.3 Generate Initiatives (modal)
Elementy:
- predefiniowane: 3/4/5/6/7 + custom <=7
- metodyka (radio + opis)
- opcja "Include AI chat context"
- preview list (5-7 placeholders + generated sample titles)

Walidacje:
- limit 7 bez wyjatkow
- metodyka wymagana

### 2.4 Drawer / Panel kontekstu (prawa kolumna)
- Sekcje: Org snapshot, Chat highlights, Related initiatives
- CTA: "Open chat context" (link do globalnego chatu)
- Odswiezanie danych po zapisie toola
- Widok kompaktowy (collapse)

### 2.5 Widok "Generated from this tool"
- tabela: title, category, priority, risk, created_at
- status stale DRAFT
- link do Initiative details + link back do Tool Workspace

### 2.6 Frontend - zachowania i stany
- stany: idle, saving, reviewing, approved, generating, error
- blokady przyciskow wg uprawnien i decyzji
- optimistic UI tylko dla zapisu draftu, nie dla approve/generate
- toasty: sukces/blad, komunikaty o brakach DoD
- routing: brak osobnych tras chatu, tylko link do globalnego chatu

## 3) Workflow i statusy
### 3.1 Tool
- DRAFT -> REVIEW -> APPROVED
- blokady:
  - DRAFT -> REVIEW: DoD + decision "Request Review"
  - REVIEW -> APPROVED: decision "Approve Tool"
  - APPROVED -> Generate: decision "Generate Initiatives"

### 3.2 Initiatives
- generowane jako DRAFT
- brak auto-publikacji do Roadmap

## 4) Decision Management (Gates)
Decyzje i odpowiedzialnosci:
- Request Review (owner: Project Lead)
- Approve Tool (owner: PMO/Owner)
- Generate Initiatives (owner: Consultant Lead)

Mechanika:
- decyzja musi byc stworzona i zaakceptowana
- bez decyzji: blokada przycisku + komunikat
- decyzja logowana (who, when, comment)

Reprezentacja decyzji:
- decision_id, decision_type, owner_id, due_date, status
- status: PENDING -> APPROVED -> REJECTED
- komentarze przechowywane jako decision_notes

## 5) Integracje i dane
### 5.1 Zrodla kontekstu
- Org: profil, branza, wielkosc, cele, KPI
- Chat: 30-50 ostatnich wiadomosci + pinowane fragmenty
- Initiatives history: ostatnie 10 inicjatyw (status + ryzyko)

### 5.2 Destynacje
- Initiatives module: nowe DRAFT
- Audit log: events (review, approve, generate)

### 5.3 Powiazania (schema)
Tool -> Initiative:
- tool_id, tool_type, tool_session_id
- source_context_id (org + chat snapshot)
- methodology_id
- generation_batch_id
- created_by, created_at

### 5.4 Model danych (proponowany)
ToolSession:
- id, tool_type, status, org_id, project_id, owner_id
- completion_percent, confidence_avg
ToolDecision:
- id, tool_session_id, decision_type, status, owner_id, due_date
ToolInitiativeBatch:
- id, tool_session_id, methodology_id, count, include_chat_context
Initiative:
- id, title, description, category, priority, risk, status=DRAFT, source=tool

## 6) API i backend
### 6.1 Endpoints
- `GET /api/tools/:toolId` (workspace data + status + DoD)
- `PUT /api/tools/:toolId` (save answers + confidence)
- `POST /api/tools/:toolId/request-review`
- `POST /api/tools/:toolId/approve`
- `POST /api/tools/:toolId/generate-initiatives`
- `GET /api/tools/:toolId/generated-initiatives`

### 6.2 Payload generate
- `methodology_id`
- `count` (<=7)
- `include_chat_context` (bool)
- `decision_id`

### 6.3 Walidacje backend
- DoD before request review
- permissions by role
- limit 7
- decision required

### 6.4 Audit Log
Events:
- tool_review_requested
- tool_approved
- initiatives_generated

### 6.5 Permissions (mapa)
- request_review: Project Lead, Admin, Owner
- approve_tool: PMO, Owner, Admin
- generate_initiatives: Consultant Lead, Admin
- fallback: Admin/Owner only

## 7) AI pipeline
### 7.1 Input selector
- context = org profile + tool answers + chat snippet
- fallback: org profile only

### 7.2 Generation rules
- map methodology -> prompt template
- enforce: min description, category, risk rating
- generate priority P1/P2/P3 + tags

### 7.3 Output validation
- required fields: title, description, category, risk
- if invalid: retry 1x, else fail with user-facing message

### 7.4 Prompt templates (high level)
- Impact x Feasibility: fokus na szybkie i wykonalne inicjatywy
- Value x Effort: szybkie wins i redukcja wysilku
- Risk/Compliance: inicjatywy zmniejszajace ryzyko lub regulacyjne
- Customer/Market: inicjatywy customer-centric, wzrost i retencja
- Operational Efficiency: automatyzacja, optymalizacja kosztow

### 7.5 Guardrails i jakoosc
- max 7 inicjatyw, brak duplikatow tytulow
- kazda inicjatywa ma kategorie i ryzyko w skali Low/Med/High
- blokada generowania przy braku min kontekstu

## 8) Uprawnienia (Admin)
### 8.1 Konfiguracja
- role_can_request_review
- role_can_approve_tool
- role_can_generate_initiatives

### 8.2 Fallback
- default Admin/Owner

## 9) Definition of Done (DoD) - szczegoly
### 9.1 Tool Workspace
- wymagane pola wypelnione
- completion checker pokazuje 100%
- confidence >=3 dla kluczowych sekcji

### 9.2 Review i Approve
- review summary + gaps
- approve blocked bez DoD i role

### 9.3 Generowanie inicjatyw
- count <=7
- metodologia wybrana
- batch zapisany + powiazania
- inicjatywy widoczne w Initiatives

## 10) Plan testow
### 10.1 Frontend (UI/UX)
- render Tool Workspace, completion checker, inline assist
- Request review gated by DoD
- Review summary + gaps
- Generate modal: validation count <=7

### 10.2 Backend (API)
- request-review z DoD vs bez DoD
- approve bez roli -> 403
- generate bez decision -> 409
- generate count >7 -> 400

### 10.3 Integracje
- initiatywy widoczne w Initiatives jako DRAFT
- tool_id powiazany z initiative

### 10.4 E2E
- flow DRAFT -> REVIEW -> APPROVED -> Generate
- fallback gdy brak chat context

### 10.5 Scenariusze (GWT - high level)
1) Given tool spelnia DoD, When Request review, Then status REVIEW + decision logged
2) Given REVIEW bez decyzji Approve, When Approve, Then 409 + UI blokada
3) Given APPROVED, When Generate z count=8, Then walidacja i brak zapisu
4) Given APPROVED + decyzja, When Generate, Then batch + Draft initiatives widoczne

### 10.6 Testy niefunkcjonalne
- performance: generowanie <= 10s dla 7 inicjatyw
- security: tylko role z uprawnieniami moga wykonac akcje
- reliability: retry dla AI 1x, brak duplikatow w batchu

## 11) Ryzyka i mitigacje (rozszerzone)
- zbyt duza liczba inicjatyw => limit 7 + UI hint 3-5
- brak kontekstu z chatu => fallback do org data
- approval bez DoD => backend blokuje
- konflikty ról => admin fallback + audit log
- AI halucynacje => walidacja output + retry

## 12) Harmonogram (wysoki poziom)
1) UX/UI prototyp + wireframes (2-3 dni)
2) Backend API + statusy + permissions (3-5 dni)
3) AI pipeline + prompts + validation (3-4 dni)
4) Frontend workspace + review + modal (5-7 dni)
5) QA + E2E + hardening (3-4 dni)

## 13) Checklista wdrozenia (Go-Live)
- DoD spelnione
- decyzje i role skonfigurowane w admin
- testy przechodza (UI + API + E2E)
- audit log dziala
- inicjatywy widoczne w Initiatives
- feature flag (jesli dostepny) ustawiony na ON
- monitoring bledow generowania i retry
