# Plan wdrożenia: Implementacja kanonicznego workflow (E2E)

## Cel
Przełożyć kanoniczne workflowy i założenia z `wdrozenia/` na **spójną implementację w aplikacji**:
- egzekucja statusów i bramek (Decisions/Gates),
- spójny RBAC (backend enforcement + UI visibility),
- spójne artefakty discovery (Interview/Tools/Assessment) z odbiorem jakości,
- E2E testy pokrywające pełny cykl: Discovery → Initiatives → Execution → Benefits → Reporting.

## Stan projektu (ważne)
Równolegle trwa praca innego agenta nad artefaktami (Tools/Initiatives itd.).  
Ten plan ma sekcje **BLOCKED / BACKLOG**, które wrócą do realizacji po zakończeniu tamtego strumienia.

## Źródła kanoniczne (must-read)
- Role/assumptions: `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`
- Work lifecycle: `wdrozenia/workflows/00-WORK-LIFECYCLE.md`
- Initiative statuses: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- Decisions: `wdrozenia/standards/entities/02-DECISION.md`
- Tool Report: `wdrozenia/standards/entities/04-TOOL-REPORT.md`
- Assessment Report: `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md`

---

## Etap 0 (P0): Ujednolicenie terminologii i mapowań ról (cross-cutting)
**Outcome**: jedna definicja ról w kodzie + mapowanie do „ról procesowych”.

### Zadania
- Wprowadzić centralne mapowanie „role procesowe → ProjectRole” (z delegacjami).
- Ustalić kanonicznie:
  - kto jest **Reviewer** w małych projektach (PM),
  - kto jest **Steering** (rola czy grupa),
  - jak reprezentujemy **Business Owner** w ProjectRole (czy dodajemy rolę).

### DoD
- Każdy gate w systemie ma jednoznacznego decydenta (z delegacją).

---

## Etap 1 (P0): Centralny silnik bramek (Decisions/Gates)
**Outcome**: jedna warstwa backend, która egzekwuje:
- kto może wykonać gate,
- czy spełnione są warunki (DoD, report approved itd.),
- audit i eskalacje.

### Zadania
- Zdefiniować „Gate Policy” per obiekt (initiative/task/assessment/tool/interview).
- Ujednolicić schemat audytu i historii decyzji.
- Wpiąć eskalacje (amber/red) + notyfikacje.

### DoD
- Backend blokuje nielegalne przejścia (niezależnie od UI).
- Każde przejście zapisuje audit log.

---

## Etap 2 (P0): Interview — odbiór jakości i rework
**Outcome**: realny mechanizm „nie wyczerpująco odpowiedziane → send-back”.

### Zadania
- UI/UX: assignee widzi checklistę braków; reviewer może wysłać `sent_back` z checklistą.
- Pytania: statusy `needs_follow_up` w UI + nawigacja do braków.
- My Work: inbox „do poprawy” i „do odbioru”.

### DoD
- E2E: assignment submit → send-back → resubmit → approve.

---

## Etap 3 (P0): Tools — Tool Report + approval + export
**Status**: **BLOCKED** (zależne od prac nad Tools artefaktami)

### Zadania (docelowe)
- Dodać widok/zakładkę Tool Report (snapshot).
- Ujednolicić flow: DRAFT → IN_REVIEW → SENT_BACK → APPROVED → GENERATED.
- Export PDF + linkowanie batch → initiatives.

### DoD
- E2E: request review → send-back → approve → generate initiatives.

---

## Etap 4 (P0): Assessment — Assessment Report + approval + generate initiatives
**Status**: **BLOCKED** (zależne od prac nad Assessment/Initiatives artefaktami)

### Zadania (docelowe)
- Report lifecycle (DRAFT/IN_REVIEW/SENT_BACK/APPROVED).
- Blokada: assessment nie może być `APPROVED` bez reportu `APPROVED`.
- Generate initiatives tylko z zatwierdzonego assessmentu i reportu.

### DoD
- E2E: report submit → send-back → approve → approve assessment → generate initiatives.

---

## Etap 5 (P0/P1): Initiatives — statusy, widoczność, gates
**Status**: **BLOCKED** (zależne od prac nad Initiatives artefaktami)

### Zadania (docelowe)
- Egzekwować gating: Go/No-Go, Start planning, Approve, Schedule, Start.
- Widoczność statusów per moduł (filtrowanie, brak „obcych” statusów).

### DoD
- E2E: initiative przechodzi przez statusy bez możliwości obejścia.

---

## Etap 6 (P1): Execution — Task acceptance + decyzje + eskalacje
**Outcome**: praca operacyjna + task acceptance (PENDING_APPROVAL).

### Zadania
- Zaimplementować acceptance workflow tasków tam gdzie wymagane.
- Eskalacje: overdue decisions/tasks wpływają na Portfolio Health.

### DoD
- E2E: task wymagający akceptacji nie może przejść do DONE bez approval.

---

## Etap 7 (P1): Benefits — KPI/ROI tracking + evidence + close tracking
**Outcome**: zamknięcie cyklu wartości.

### Zadania
- KPI model (baseline/target/actual) + evidence.
- Close tracking gate (Business Owner lub delegacja).

### DoD
- E2E: initiative DONE → TRACKING → close tracking.

---

## Etap 8 (P1/P2): Reporting + My Work + Notifications (warstwy przekrojowe)
**Outcome**: użytkownik widzi co ma zrobić, a raporty pokazują decyzje i eskalacje.

### Zadania
- My Work: decision inbox + task inbox + alerts.
- Reporting: Decisions Required + RAG.
- Notifications: minimalny zestaw zdarzeń z work lifecycle.

### DoD
- Użytkownik ma jedno miejsce „co teraz” + raport ma sekcję decyzji wymaganych.

---

## Backlog (na później, po stabilizacji)
- Role editor (custom roles)
- Advanced scheduling / roadmap dependencies
- Full PDF/PPTX export everywhere
- Multi-project portfolio governance

