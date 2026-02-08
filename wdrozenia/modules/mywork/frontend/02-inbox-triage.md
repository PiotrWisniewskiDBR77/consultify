# My Work – Inbox Triage

## Cel

Inbox do triażu: co wymaga uwagi teraz, co można odroczyć/delegować.

Inbox jest **kolejką akcji** (Action Queue), nie feedem informacji.
Ma sterować zachowaniem organizacji: wymuszać decyzję lub ruch w taskach.

## Blokery

- Backend `/api/my-work` stub (501)
- Zakaz mock fallbacków – UI musi mieć loading/error/empty + retry

---

## Zasady UX (kanon)1. Każda pozycja Inbox odpowiada na 4 pytania:
   - **Co się dzieje**
   - **Dlaczego to ważne**
   - **Co jest blokowane**
   - **Jakiej akcji oczekujemy** (Primary CTA)

2. Inbox pokazuje tylko rzeczy wymagające reakcji:
   - Decisions wymagające aktu (pending/overdue/critical)
   - Taski w blokadzie (szczególnie “blocked by decision”)
   - No-response / aging (brak ruchu) jako presja do update’u lub eskalacji

3. Wszystko inne idzie do Notification Center (archiwum).

---

## Layout (lekki, ale kompletny)

### Górny pasek (sticky)

- Search
- Filtry: `All | Mine | Critical | Blocked | Due today | Overdue`
- Scope: projekt/program/initiative (opcjonalnie)
- Sort: domyślnie “Criticality score”

### Lista pozycji (cards lub table rows)Każda pozycja:

- Ikona typu (Task / Decision / Alert)
- Tytuł (decision statement / task title)
- 4-liniowy opis (co/dlaczego/blokuje/akcja)
- Badges: priority (Critical/High/Medium/Low), aging, due/critical point
- Primary CTA + Secondary (Delegate/Escalate/Snooze/Open)

### Primary CTA (kanon)

- Decision:
  - `Decide` (Approve/Reject/Conditional)
  - `Delegate`
  - `Escalate` (gdy brak reakcji/overdue)
- Task:
  - `Unblock` (Open Decision / Create Decision)
  - `Reassign`
  - `Update plan`---

## Workflow (jak to działa)1. Zdarzenie w systemie (blocked task / overdue decision / no response) tworzy **Inbox item**

2. Użytkownik wykonuje Primary CTA
3. Po akcji:
   - presja się zamyka (cisza) albo eskaluje (jeśli brak reakcji)
   - w audycie zostaje ślad (kto/kiedy/co)---

## Definicja “działa”

Inbox działa, jeśli:

- użytkownik zawsze wie “co mam zrobić teraz”
- każde kliknięcie prowadzi do realnej akcji w Task/Decision
- brak reakcji powoduje eskalację (wg `06-NOTIFICATION.md`)
