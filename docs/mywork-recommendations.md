# MyWork Module — Rekomendacje strategiczne

## Stan obecny — Mapa modułu

| Tab | Komponenty | Endpoints | AI |
|-----|-----------|-----------|-----|
| **Executive** | Dashboard, KPI, Signals, ActionStrip | `/stats`, `/team-workload`, `/signals` | Signals feed |
| **Inbox** | InboxContent (unified), Preview Pane | `/inbox`, `/inbox/triage`, `/inbox/bulk-triage` | Heurystyczne auto-triage |
| **Focus** | FocusView (Kanban 3-col) | `/focus/state`, `/focus/move`, `/focus/reorder` | — |
| **Tasks** | List, Kanban, Calendar, Detail | `/tasks`, `/personal-tasks` CRUD, `/calendar` | Chat, Risks, Alternatives |
| **Decisions** | List, Kanban, Queue, Detail, Review | `/decisions`, `/decisions/queue`, snooze | Chat, analysis |
| **Notebook** | TipTap editor, Slash commands, Templates | `/notebook/pages` CRUD, `/extract-actions` | Inline AI (/ask /expand /challenge /action) |
| **Ideas** | List, MindMap, Detail | `/my-ideas` CRUD, `/develop`, edges | AI Develop (streaming) |

**Bazy danych MyWork:** 9 tabel (`my_work_inbox_triage`, `my_work_focus_state`, `my_work_decision_snoozes`, `my_work_decision_prefs`, `my_work_signal_prefs/snoozes/dismissals`, `my_ideas`, `notebook_pages`)

---

## I. WSPÓŁPRACA MIĘDZY NARZĘDZIAMI (Cross-Tab Synergy)

### Diagnoza

Obecnie zakładki działają w dużej mierze jako **silosy**:
- Inbox triaguje elementy, ale po wysłaniu do Focus → brak informacji zwrotnej
- Focus Board nie wie o statusie zadań (czy task został ukończony, czy decyzja podjęta)
- Notebook generuje action items, ale konwersja do Task jest jednorazowa (brak sync)
- Ideas po konwersji do Task/Decision tracą powiązanie (brak bidirectional link)
- Executive Dashboard pokazuje metryki, ale nie linkuje do konkretnych zadań/decyzji

### Rekomendacje

#### I.1 — Activity Trail (Ścieżka życia elementu)

**Problem:** Element trafia z Inbox → Focus → Task → Done, ale nie ma wizualizacji tej ścieżki.

**Rozwiązanie:** Dodać `activityTrail` do każdego elementu:
```
Inbox (received) → Focus/Today (triaged) → Task (started) → Done (completed)
```

**Implementacja:**
- Nowe pole `trail: { step: string; at: string; by: 'user'|'ai'|'system' }[]` w `InboxItem` i `FocusItem`
- Trail widoczny w Preview Pane i Detail View jako timeline
- Backend: logowanie do `my_work_inbox_triage` już istnieje — wystarczy rozbudować query

**Impact:** Użytkownik widzi kontekst i historię każdego elementu.

---

#### I.2 — Focus ↔ Task Status Sync (Two-way sync)

**Problem:** Focus Board pokazuje kartki, ale nie aktualizuje się gdy task zostanie ukończony w innym widoku.

**Rozwiązanie:**
- Focus Board powinien real-time reagować na zmianę statusu powiązanego taska
- Gdy task → Completed, karta w Focus automatycznie dostaje badge ✅ i opcję "Remove from Focus"
- Gdy decyzja → Made, analogicznie

**Implementacja:**
- `GET /focus/state` powinien joinować z `tasks.status` i `decisions.status`
- Frontend: dodać `linkedStatus` do `FocusItem` i wizualizować

---

#### I.3 — Notebook → Multi-Entity Linking (Knowledge Hub)

**Problem:** Notatka konwertuje się do jednego taska/decyzji, ale w praktyce jedna notatka generuje wiele action items.

**Rozwiązanie:**
- `/extract-actions` już istnieje — rozbudować aby tworzyło **wiele** tasków z jednej notatki
- Notatka powinna mieć sekcję "Linked Items" z lista powiązanych tasków/decyzji/idei
- Po konwersji: bidirectional link (task ← notebook_page)

**Implementacja:**
- `notebook_pages.converted_to_json` już jest arrayem — wykorzystać do multi-link
- W `TaskDetailView` dodać "Source: Notebook page XYZ" z linkiem

---

#### I.4 — Ideas → Decision Pipeline

**Problem:** Idea konwertuje się do taska LUB decyzji, ale brak workflow: Idea → Decision (czy warto?) → Task (jak zrobić?).

**Rozwiązanie:**
- Dodać opcję "Convert to Decision first" — idea staje się decyzją "Czy realizujemy?"
- Po podjęciu decyzji → auto-prompt "Create implementation tasks?"
- Pipeline: `Idea → Decision (Go/No-Go) → Task breakdown`

---

#### I.5 — Unified Search Across Tabs

**Problem:** Szukanie działa per-tab. Jeśli pamiętam "coś o budżecie" — nie wiem czy to task, decyzja, notatka czy idea.

**Rozwiązanie:**
- `CommandPalette.tsx` już istnieje — rozbudować o wyszukiwanie cross-tab
- Endpoint: `GET /my-work/search?q=budżet` → szuka w tasks, decisions, notebook_pages, my_ideas, inbox
- Wyniki grupowane po typie z szybkim otwarciem

---

#### I.6 — Inbox → Context-Aware Routing

**Problem:** "Accept Today" wrzuca do Focus, ale nie dodaje kontekstu (dlaczego biorę, co muszę zrobić).

**Rozwiązanie:**
- Przy triage dodać opcjonalne micro-note: "Focus note: spotkanie z klientem o 14:00"
- Notatka widoczna w Focus Board jako tooltip/subtitle
- Keyboard: po T/W → focus na pole notatki (opcjonalne, Enter pomija)

---

## II. CHAT — KOMUNIKACJA I WSPÓŁPRACA

### Diagnoza

Chat (`ChatPanel`) jest **technologicznie gotowy** (streaming, voice, artifacts, citations), ale jest **słabo zintegrowany z MyWork**:
- Chat otwiera się jako boczny panel, ale nie ma kontekstu "z którego taba pytam"
- Task/Decision Detail Views mają `handleOpenChat()` ale bez pre-loadowanego kontekstu
- Brak asystenta kontekstowego per-tab
- Brak możliwości "rozmowy o moim dniu pracy"

### Rekomendacje

#### II.1 — MyWork Context Injection do Chat

**Problem:** Otwierając chat z MyWork, AI nie wie co robię, jakie mam zadania, decyzje.

**Rozwiązanie:**
- Przy otwarciu chata z MyWork → automatycznie inject kontekst:
  ```
  System: User is working in MyWork/{activeTab}.
  Open items: 3 tasks due today, 2 pending decisions, 5 unread inbox items.
  Current focus: [Focus Today items]
  ```
- AI może od razu doradzać bez pytania "co robisz?"

**Implementacja:**
- `MyWorkHub` → przy kliknięciu chat, buduje `contextPayload` z aktualnego stanu
- Przekazuje do `ChatPanel` jako initial system message
- Endpoint: `POST /ai/chat` z `context: { module: 'mywork', tab, items }`

---

#### II.2 — Quick Chat per Element (Inline Assistant)

**Problem:** Żeby porozmawiać o tasku, muszę go otworzyć, potem kliknąć chat — 3 kroki.

**Rozwiązanie:**
- Dodać "Ask AI" inline button w wierszu tabeli (obok innych inline actions)
- Kliknięcie → mini-chat w popoverze z kontekstem tego elementu
- Pytania typu: "Jak to zrobić?", "Jakie ryzyka?", "Kogo zapytać?"

**Implementacja:**
- Reuse `ChatPanel` w trybie compact/popover
- Auto-inject context danego taska/decyzji
- Pre-fill suggested questions na bazie typu elementu

---

#### II.3 — Chat → Action Bridge

**Problem:** Rozmowa z AI generuje pomysły/akcje, ale nic nie trafia automatycznie do MyWork.

**Rozwiązanie:**
- AI w chacie może proponować akcje jako "Apply to MyWork":
  - "Stworzyć task z tego?" → przycisk → tworzy task
  - "Dodać do Focus na dziś?" → przycisk → dodaje do Focus
  - "Zapisać jako notatka?" → przycisk → tworzy notebook page
  - "Stworzyć decyzję?" → przycisk → tworzy decyzję

**Implementacja:**
- Chat artifacts z typem `mywork_action`:
  ```json
  { "type": "create_task", "title": "...", "description": "...", "dueDate": "..." }
  ```
- Frontend renderuje artifact jako interaktywną kartę z przyciskiem "Apply"
- Klik → `POST /my-work/personal-tasks` lub odpowiedni endpoint

---

#### II.4 — Daily Standup Chat (Poranny Briefing)

**Problem:** Brak proaktywnego "poranka" — użytkownik musi sam sprawdzać co ważne.

**Rozwiązanie:**
- O poranku (lub przy pierwszym otwarciu MyWork) → auto-prompt w chacie:
  ```
  Good morning! Here's your briefing:
  📬 5 new inbox items (2 critical)
  🎯 Focus Today: 3 items, 1 overdue
  🔥 Decision deadline: "Q2 Budget" in 4h
  💡 Suggestion: Task "Review API docs" blocked 3 days — need help?
  ```
- Interaktywny: klikalne linki do elementów

**Implementacja:**
- Endpoint: `GET /my-work/briefing` → agreguje inbox summary, focus state, overdue items, signals
- Frontend: automatyczny message w ChatPanel przy otwarciu MyWork (raz dziennie)
- Personalizacja: "briefing time" w settings

---

#### II.5 — Chat jako Command Center

**Problem:** Chat to Q&A, ale mógłby być interfejsem do działań.

**Rozwiązanie:**
- Natural language commands w chacie:
  - "Stwórz task: Przygotować prezentację do piątku"
  - "Przenieś task API review na jutro"
  - "Pokaż moje overdue taski"
  - "Zaarchiwizuj wszystkie FYI z inbox"
  - "Jakie decyzje czekają na mnie?"

**Implementacja:**
- Intent detection w AI response
- Tool calls: `create_task`, `move_focus_item`, `list_overdue`, `bulk_triage`
- Reuse istniejących endpointów MyWork

---

## III. AI DLA EFEKTYWNOŚCI OSOBISTEJ

### Diagnoza

AI w MyWork jest **punktowy** (AI w notebooku, AI rozwój idei, heurystyczne sugestie triage). Brakuje:
- Ciągłego monitoringu i proaktywnych nudges
- Personalizacji na bazie wzorców pracy
- Predykcji i wczesnego ostrzegania
- Automatyzacji powtarzalnych wzorców

### Rekomendacje

#### III.1 — AI Work Coach (Proactive Nudges v2)

**Problem:** `proactiveNudges.ts` istnieje ale jest prostą heurystyką. Brak ciągłego monitoringu.

**Rozwiązanie:**
- AI Coach analizuje wzorce pracy i proaktywnie sugeruje:
  - "Masz 5 tasków na dziś, ale historycznie kończysz 3. Może przenieść 2 na jutro?"
  - "Decision 'Q2 Budget' ma deadline za 6h — brakuje jeszcze stakeholder review"
  - "Wzorzec: taski z projektu Alpha mają 40% delay rate. Chcesz porozmawiać o przyczynach?"
  - "Nie ruszałeś taska 'API Migration' od 5 dni. Zablokowany? Pomóc?"

**Implementacja:**
- `GET /my-work/coach-insights` → analizuje:
  - Velocity (completed/day historycznie)
  - Overdue patterns
  - Focus column utilization
  - Decision response times
- Wyświetlane jako karty w Executive Dashboard lub jako chat messages

---

#### III.2 — Smart Priority Scoring (AI-driven)

**Problem:** Priorytetyzacja jest ręczna. Urgency heatmap pomaga, ale nie rozumie kontekstu.

**Rozwiązanie:**
- AI analizuje każdy element i proponuje priority score:
  - Input: deadline, dependencies, stakeholder importance, project health, historical patterns
  - Output: score 0-100 + reasoning
  - "This decision blocks 3 tasks across 2 projects. Recommended: Critical priority."

**Implementacja:**
- Background job: co godzinę przelicza `priority_score` dla open items
- Inbox/Focus sortowanie uwzględnia AI score
- Preview Pane pokazuje "AI Priority: 87/100 — blocks project timeline"

---

#### III.3 — Auto-Triage Inbox (AI-powered)

**Problem:** Heurystyczne auto-triage jest ok, ale nie rozumie treści elementu.

**Rozwiązanie:**
- LLM analizuje tytuł + opis i sugeruje:
  - Routing: "This is FYI → Dismiss" vs "This requires your approval → Focus Today"
  - Categorization: auto-assign section
  - Action: "Similar to last 3 items you archived — auto-archive?"

**Implementacja:**
- Batch processing: co 15 min, LLM analizuje new inbox items
- `suggestedAction` + `suggestedReason` → rozbudowane o LLM reasoning
- User feedback loop: "Was this suggestion helpful?" → fine-tune

---

#### III.4 — Predictive Focus Planning

**Problem:** Użytkownik ręcznie planuje Focus Board na dziś. Nie wie ile realnie zdąży.

**Rozwiązanie:**
- AI sugeruje optymalny plan dnia:
  - "Based on your calendar (3 meetings, 2h free), I suggest 2 tasks for today"
  - "Task X typically takes you 45min, Task Y 2h. Your free time: 3h. Fits perfectly."
  - "Warning: you have back-to-back meetings 10-14. Consider moving deep work to morning."

**Implementacja:**
- Integracja z kalendarzem (jeśli dostępny) lub szacowanie na bazie historii
- `GET /my-work/focus/ai-suggest` → proponuje Today/Week/Later split
- UI: przycisk "AI Plan My Day" w Focus View

---

#### III.5 — Decision Helper (Structured Reasoning)

**Problem:** Decision Detail ma chat AI, ale brak strukturyzowanego wsparcia decyzyjnego.

**Rozwiązanie:**
- AI prowadzi przez structured decision-making framework:
  1. "What's the core question?"
  2. "What are the options?" (AI generates if empty)
  3. "What are the criteria?" (cost, time, risk, alignment)
  4. "Score each option against criteria"
  5. "Here's my recommendation with reasoning"
- Output: structured decision brief (exportable)

**Implementacja:**
- Nowy komponent `DecisionWizard` z krokami
- Każdy krok ma AI assistance
- Wynik zapisuje się w decision fields (alternatives, evidence, impact)

---

#### III.6 — Task Decomposition AI

**Problem:** Duże taski stoją bo są overwhelming. Brak auto-breakdown.

**Rozwiązanie:**
- Przycisk "Break down this task" w Task Detail:
  - AI analizuje tytuł + opis
  - Generuje 3-7 subtasków z szacowanym czasem
  - Użytkownik edytuje/akceptuje → tworzy się lista podzadań

**Implementacja:**
- `POST /ai/decompose-task` → LLM generuje subtasks
- Frontend: modal z edytowalną listą → batch create via `/personal-tasks`
- Subtask linkowanie: `parent_task_id` field

---

#### III.7 — Learning Loop (Adaptive AI)

**Problem:** AI sugestie są statyczne. Nie uczą się z zachowań użytkownika.

**Rozwiązanie:**
- Tracking: co użytkownik robi z sugestiami (accept/reject/modify)
- Patterns:
  - "User always archives billing_alert → auto-archive"
  - "User always moves escalations to Focus Today → pre-route"
  - "User spends avg 2min on FYI, 15min on decisions → adjust priority"

**Implementacja:**
- Tabela `my_work_ai_feedback`: `user_id, suggestion_type, suggestion_id, action (accepted/rejected/modified), context`
- Background job: co tydzień analyze patterns → update suggestion rules
- Personalized model per user (rules, not LLM fine-tuning)

---

#### III.8 — Weekly Reflection & Insights

**Problem:** Brak feedback loop — użytkownik nie wie czy jest bardziej/mniej produktywny.

**Rozwiązanie:**
- Co piątek/niedzielę: "Weekly Reflection" w MyWork:
  - "You completed 12 tasks (↑20% vs last week)"
  - "Average decision time: 2.3 days (↓ from 3.1)"
  - "Top blocker: waiting for stakeholder input (5 items)"
  - "Suggestion: consider delegating review tasks to free 4h/week"

**Implementacja:**
- `GET /my-work/weekly-reflection` → agreguje metryki z ostatnich 7 dni
- Porównanie z poprzednim tygodniem
- AI generuje 2-3 actionable insights
- Wyświetlane jako modal lub sekcja w Executive Dashboard

---

## Priorytetyzacja (Impact × Effort)

| # | Rekomendacja | Impact | Effort | Priorytet |
|---|---|---|---|---|
| **II.1** | MyWork Context Injection do Chat | 🔴 High | 🟢 Low | **P0** |
| **II.4** | Daily Standup / Poranny Briefing | 🔴 High | 🟡 Med | **P0** |
| **II.3** | Chat → Action Bridge | 🔴 High | 🟡 Med | **P1** |
| **III.1** | AI Work Coach (Proactive Nudges v2) | 🔴 High | 🟡 Med | **P1** |
| **I.2** | Focus ↔ Task Status Sync | 🔴 High | 🟢 Low | **P1** |
| **III.6** | Task Decomposition AI | 🟡 Med | 🟢 Low | **P1** |
| **I.5** | Unified Search Across Tabs | 🟡 Med | 🟡 Med | **P2** |
| **III.4** | Predictive Focus Planning | 🟡 Med | 🟡 Med | **P2** |
| **II.2** | Quick Chat per Element | 🟡 Med | 🟡 Med | **P2** |
| **I.1** | Activity Trail | 🟡 Med | 🟡 Med | **P2** |
| **III.3** | Auto-Triage Inbox (LLM) | 🟡 Med | 🔴 High | **P2** |
| **III.5** | Decision Helper Wizard | 🟡 Med | 🔴 High | **P3** |
| **III.7** | Learning Loop (Adaptive AI) | 🟡 Med | 🔴 High | **P3** |
| **I.3** | Notebook Multi-Entity Linking | 🟢 Low | 🟡 Med | **P3** |
| **I.4** | Ideas → Decision Pipeline | 🟢 Low | 🟡 Med | **P3** |
| **II.5** | Chat as Command Center | 🟢 Low | 🔴 High | **P4** |
| **I.6** | Inbox Context-Aware Routing | 🟢 Low | 🟢 Low | **P4** |
| **III.2** | Smart Priority Scoring | 🟡 Med | 🔴 High | **P4** |
| **III.8** | Weekly Reflection | 🟢 Low | 🟡 Med | **P4** |
