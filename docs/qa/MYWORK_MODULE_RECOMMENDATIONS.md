# MyWork Module — Rekomendacje strategiczne

> **Data:** 2026-02-24  
> **Autor:** Analiza architektoniczna modułu MyWork  
> **Zakres:** 3 osie: Synergia narzędzi, Integracja Czatu, Wykorzystanie AI

---

## Stan obecny — podsumowanie

MyWork składa się z 8 tabów: **Executive, Inbox, Focus, Tasks, Decisions, Notifications, Notebook, Ideas**. Każdy tab działa w dużej mierze **autonomicznie** — ma własne API, własny stan, własne widoki. Komunikacja między tabami ogranicza się do:

- Nawigacja (klik → otwarcie detail view)
- Inbox → Focus (triage: "accept_today/week/later")
- Notebook → Tasks/Decisions (konwersja notatki)
- Ideas → Initiatives/Tasks/Decisions (konwersja pomysłu)
- Executive → nawigacja do innych tabów

Czat AI widzi kontekst bieżącego ekranu (typ widoku, entityId), ale nie wykorzystuje go głęboko — stosuje ogólny prompt konsultanta.

---

## I. SYNERGIA NARZĘDZI — jak taby mogą lepiej współpracować

### R1. Unified Activity Stream (cross-tab timeline)

**Problem:** Każdy tab ma osobne dane. Użytkownik nie widzi pełnego kontekstu "co się dzieje z tym tematem" — musi skakać między tabami.

**Rekomendacja:** Wprowadzić **Activity Stream** w detail view każdego artefaktu, który agreguje zdarzenia ze wszystkich powiązanych encji:

- Task "Wdrożenie API" → pokazuje: powiązane decyzje, notatki z notebooka, pomysły, notyfikacje, komentarze — w jednej osi czasu
- Korzysta z istniejącego `ActivityLogCanvas` (NModeSections)

**Impact:** Eliminuje "context switching tax" — użytkownik widzi pełny obraz bez przełączania tabów.

---

### R2. Bidirectional Linking (backlinks)

**Problem:** Notebook może wstawiać referencje do tasków/decyzji (Knowledge Pulse), ale nie ma odwrotnego linku — task nie wie, że jest wspomniany w notatce.

**Rekomendacja:** Wprowadzić system **backlinks**:

- Task detail view: sekcja "Mentioned in" — lista notatek/pomysłów/decyzji, które referencjonują ten task
- Decision detail view: sekcja "Related notes" — notatki z Notebooka
- Idea detail view: sekcja "Linked notes" — powiązane notatki

**Implementacja:** Lekki indeks referencji w DB (`entity_references` table: sourceType, sourceId, targetType, targetId). Aktualizowany przy zapisie notatki/pomysłu.

---

### R3. Focus → Inbox feedback loop

**Problem:** Inbox triaguje do Focus, ale Focus nie raportuje z powrotem. Inbox nie wie, czy item dodany do "Today" został zrealizowany.

**Rekomendacja:**
- Inbox powinien pokazywać status triagowanych itemów: "Sent to Focus: Today — Completed ✓" / "Still pending"
- Focus ukończenie itemu → automatyczne oznaczenie inbox itemu jako "Done"
- Executive Dashboard → "Inbox → Focus conversion rate" jako metryka efektywności

---

### R4. Ideas → Notebook integration (ideation pipeline)

**Problem:** Ideas i Notebook działają osobno. Pomysł (Idea) nie ma łatwego sposobu na "rozwinięcie w notatce" przed konwersją na task/inicjatywę.

**Rekomendacja:** Dodać flow:
1. Idea → "Develop in Notebook" → Tworzy stronę Notebook z treścią pomysłu jako starting point
2. Notebook page → "Create Idea" → Ekstrahuje insight z notatki do Ideas
3. Maturity system Notebooka synchronizowany z Idea stages (Seed → Growing → Mature → Actionable = ready to convert)

---

### R5. Decision → Task cascade

**Problem:** Podjęcie decyzji (Approve/Reject) nie generuje automatycznie follow-up tasków.

**Rekomendacja:**
- Po zatwierdzeniu decyzji → modal "Create follow-up tasks" z AI-sugestią tasków implementacyjnych
- Po odrzuceniu decyzji → opcja "Create revision task" dla wnioskodawcy
- Executive Dashboard → metryka "Decisions without follow-up tasks" jako alert

---

### R6. Notebook Slash Commands → Cross-module actions

**Problem:** Notebook ma slash commands (`/ask`, `/expand`, `/challenge`), ale brak komend tworzących artefakty.

**Rekomendacja:** Dodać slash commands:
- `/task [tytuł]` — tworzy task inline z kontekstem notatki
- `/decision [tytuł]` — tworzy decyzję
- `/idea [tytuł]` — tworzy pomysł
- `/focus` — dodaje bieżącą notatkę do Focus Today
- `/link [entity]` — wyszukuje i linkuje istniejący artefakt

---

## II. INTEGRACJA CZATU — jak lepiej wykorzystać panel czatu

### R7. Context-aware system prompts per tab

**Problem:** Czat używa ogólnego promptu "Digital Transformation Consultant" niezależnie od tego, czy użytkownik jest na Executive, Focus, czy Notebook.

**Rekomendacja:** Dedykowane system prompts:

| Tab | System Prompt Persona |
|---|---|
| Executive | C-level strategist: portfolio insights, risk analysis, KPI interpretation |
| Inbox | Triage assistant: prioritization, "should I handle this now?", delegation advice |
| Focus | Productivity coach: time management, task decomposition, blocker resolution |
| Tasks | Task analyst: estimation, dependency analysis, risk flags |
| Decisions | Decision advisor: option analysis, stakeholder impact, precedent search |
| Notebook | Research partner: expand ideas, challenge assumptions, find connections |
| Ideas | Innovation catalyst: idea development, feasibility analysis, market context |

**Implementacja:** `SplitLayout` już przjemuje `chatSystemPrompt` i `chatRoleName` — wystarczy, żeby `MyWorkHub` przekazywał odpowiedni prompt na podstawie `activeTab`.

---

### R8. Chat → Action bridge

**Problem:** Czat może proponować akcje (`create_task`, `create_decision`), ale flow jest słabo zintegrowany z MyWork. Użytkownik musi sam nawigować po czacie.

**Rekomendacja:**
- Chat response z akcją → toast/banner w MyWork: "AI suggested: Create task 'Przygotuj raport' — [Apply] [Dismiss]"
- Zrealizowana akcja z czatu → automatycznie otwiera nowy artefakt w MyWork jako tab
- Chat widzi "I just created task X for you" → użytkownik klika → task otwiera się w detail view

---

### R9. Chat context enrichment

**Problem:** `workspaceContext` przekazuje `entityId` i `type`, ale AI nie otrzymuje pełnych danych encji (tytuł, status, priorytet, historia).

**Rekomendacja:**
- Przy otwarciu detail view → automatycznie ładuj kluczowe pola encji do `entityData` w `workspaceContext`
- Chat widzi: "User is viewing Task 'Wdrożenie API v2' — status: In Progress, priority: High, 3 days overdue, blocked by Decision #15"
- Pozwala AI odpowiadać kontekstowo: "This task is blocked. Shall I escalate Decision #15?"

---

### R10. Chat history per context

**Problem:** Historia czatu jest globalna. Rozmowa o tasku X miesza się z rozmową o decyzji Y.

**Rekomendacja:**
- Auto-tagowanie wiadomości czatu z kontekstem (tab, entityId)
- Filtr historii: "Show only messages about this task"
- Przy otwarciu detail view → opcja "Resume conversation about this item"
- Notebook integration: "Save this chat thread as a note"

---

### R11. Quick Chat Commands

**Problem:** Użytkownik musi opisać słownie co chce. Brak szybkich skrótów.

**Rekomendacja:** Chat commands (wpisywane w pole czatu):
- `/prioritize` — AI analizuje Today items i sugeruje kolejność
- `/summarize-inbox` — AI podsumowuje nowe itemy w Inbox
- `/blocked` — AI identyfikuje zablokowane taski i sugeruje rozwiązania
- `/decide [id]` — AI analizuje opcje decyzji i daje rekomendację
- `/weekly-review` — AI generuje podsumowanie tygodnia (completed, pending, risks)

---

## III. WYKORZYSTANIE AI — jak zwiększyć efektywność człowieka

### R12. Intelligent Auto-Triage (Inbox)

**Problem:** Inbox pokazuje AI suggestions, ale użytkownik musi ręcznie triagować każdy item.

**Rekomendacja:** AI Auto-Triage z poziomami pewności:
- **High confidence (>90%):** Auto-apply (z opcją undo) — np. "system notification → dismiss"
- **Medium confidence (70-90%):** Suggest + highlight — np. "decision request from your manager → Focus Today"
- **Low confidence (<70%):** Show reasoning only — "Not sure about this one — here's why..."
- Uczenie się z wzorców użytkownika (jakie typy triaguje do Today vs. Later vs. Dismiss)

---

### R13. Predictive Focus Board

**Problem:** "Plan My Day" sugeruje co dodać do Today, ale nie uwzględnia kontekstu kalendarza, energii, ani wzorców pracy.

**Rekomendacja:**
- AI analizuje wzorce: "Usually you do deep work 9-12, meetings 13-15, admin 15-17"
- Sugestie z blokami czasowymi: "Morning: Task X (deep work, 2h) → Lunch → Decision Y (quick, 15min) → Task Z (admin, 1h)"
- "Energy-aware scheduling": ciężkie zadania rano, rutynowe popołudniu
- Integracja z kalendarzem: uwzględnia spotkania przy planowaniu dnia
- Weekly planning: "Your week has 3 deadlines. Suggested distribution across days..."

---

### R14. Decision Intelligence

**Problem:** Decyzje wymagają manualnej analizy. AI nie pomaga w samym procesie decyzyjnym.

**Rekomendacja:**
- **Pre-decision analysis**: AI automatycznie generuje:
  - Impact assessment (kto/co jest dotknięte)
  - Risk analysis (co może pójść nie tak)
  - Precedent search (czy była podobna decyzja w przeszłości)
  - Stakeholder mapping (kto powinien być zaangażowany)
- **Decision readiness score**: AI ocenia czy decyzja jest "ready" (czy są wszystkie dane, czy stakeholderzy się wypowiedzieli)
- **Post-decision tracking**: AI monitoruje follow-up po decyzji i alertuje jeśli implementacja się opóźnia

---

### R15. Smart Notebook (Knowledge Work Assistant)

**Problem:** Notebook jest edytorem tekstu z AI inline. Nie wykorzystuje pełni potencjału jako "thinking tool".

**Rekomendacja:**
- **Auto-linking**: AI automatycznie wykrywa wzminki o taskach/decyzjach/inicjatywach w tekście i tworzy linki
- **Insight extraction**: Po zapisie notatki → AI ekstrahuje: key insights, action items, decisions needed, risks identified
- **Smart templates**: AI sugeruje template na podstawie kontekstu ("You're writing about a risk — use Risk Analysis template?")
- **Knowledge graph**: Widok grafu powiązań między notatkami, pomysłami, taskami — "map your thinking"
- **Auto-tagging**: AI sugeruje tagi na podstawie treści (bez czekania na manualne tagowanie)
- **Weekly digest**: AI generuje "Knowledge Pulse" — co nowego napisałeś, jakie insighty, co wymaga follow-up

---

### R16. Proactive AI Signals (Executive)

**Problem:** AI Signals to pasywna lista alertów. AI nie proponuje akcji.

**Rekomendacja:**
- Każdy signal → zestaw rekomendowanych akcji:
  - "3 tasks overdue in Initiative X" → [View tasks] [Reassign] [Extend deadline] [Escalate]
  - "Decision #15 waiting 14 days" → [Remind stakeholders] [Escalate to sponsor] [Decide now]
  - "Team member Y at 120% capacity" → [Redistribute tasks] [Postpone low-priority] [Hire support]
- **Predictive signals**: AI przewiduje problemy zanim wystąpią:
  - "At current velocity, Initiative X will miss deadline by 2 weeks"
  - "Decision #20 has no approver assigned — will become blocker in 3 days"
  - "You have 5 meetings tomorrow — only 2h focus time available"

---

### R17. AI-Powered Weekly Review

**Problem:** Brak mechanizmu refleksji i ciągłego doskonalenia.

**Rekomendacja:** Automatyczny "Friday Review" (lub dowolny dzień):
- **Podsumowanie tygodnia:** Completed tasks, decisions made, notes written, ideas captured
- **Efektywność:** Focus time vs. meetings, tasks completed vs. planned, decision velocity
- **Carry-forward:** Co nie zostało ukończone → auto-priorytetyzacja na przyszły tydzień
- **Insights:** "This week you spent 60% time on Initiative X but it's only 20% of portfolio — rebalance?"
- **Recommendations:** "Based on patterns, consider: delegating admin tasks, blocking 2h morning focus time, scheduling decision reviews on Tuesdays"
- Wynik → strona w Notebook (auto-generowana, edytowalna)

---

### R18. Contextual AI Suggestions (inline, nie-inwazyjne)

**Problem:** AI insights wymagają otwarcia czatu lub kliknięcia w dedykowane panele.

**Rekomendacja:** Subtelne, inline AI hints:
- Na liście tasków: mały icon 💡 przy tasku z sugestią ("This task has no due date — suggest: Friday based on similar tasks")
- Na decyzji: "2 similar decisions were approved last month — view precedents"
- Na notebooku: "This note mentions 'risk' 3 times — consider creating a Risk Analysis"
- W Focus: "You marked this as Today 3 days in a row — snooze or break down?"
- Format: tooltip on hover, nie banner/modal — "quiet suggestions"

---

## Priorytetyzacja

| # | Rekomendacja | Impact | Effort | Priorytet |
|---|---|---|---|---|
| R7 | Context-aware chat prompts | High | Low | 🔴 P1 |
| R9 | Chat context enrichment | High | Medium | 🔴 P1 |
| R12 | Intelligent Auto-Triage | High | Medium | 🔴 P1 |
| R3 | Focus → Inbox feedback loop | Medium | Low | 🟠 P2 |
| R5 | Decision → Task cascade | Medium | Low | 🟠 P2 |
| R8 | Chat → Action bridge | High | Medium | 🟠 P2 |
| R16 | Proactive AI Signals | High | Medium | 🟠 P2 |
| R18 | Contextual inline suggestions | High | Medium | 🟠 P2 |
| R2 | Bidirectional Linking | Medium | Medium | 🟡 P3 |
| R6 | Notebook slash commands | Medium | Low | 🟡 P3 |
| R11 | Quick Chat Commands | Medium | Low | 🟡 P3 |
| R13 | Predictive Focus Board | High | High | 🟡 P3 |
| R14 | Decision Intelligence | High | High | 🟡 P3 |
| R17 | AI Weekly Review | Medium | Medium | 🟡 P3 |
| R1 | Unified Activity Stream | Medium | High | ⚪ P4 |
| R4 | Ideas → Notebook pipeline | Low | Medium | ⚪ P4 |
| R10 | Chat history per context | Low | Medium | ⚪ P4 |
| R15 | Smart Notebook | Medium | High | ⚪ P4 |

---

## Quick Wins (implementacja < 1 dzień)

1. **R7** — Zmiana `chatSystemPrompt` w `MyWorkHub` na podstawie `activeTab` (~2h)
2. **R5** — Po `handleApprove()`/`handleReject()` → modal "Create follow-up task?" (~4h)
3. **R3** — Inbox item status update po Focus completion (~4h)
4. **R6** — Slash commands `/task`, `/decision`, `/idea` w Notebook (~4h)
5. **R11** — Chat commands `/prioritize`, `/blocked` (~4h)
