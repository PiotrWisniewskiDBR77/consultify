# 🚪 Workflow: Decision Gates

## Cel

Opisać bramki decyzyjne między statusami (initiative/task/analysis/assessment/tool) oraz ich egzekucję.

## Standard

- Decision: `wdrozenia/standards/entities/02-DECISION.md`
- Statusy: `wdrozenia/standards/03-STATUS-WORKFLOW.md`

---

## Definicja

**Gate decision** to specjalny przypadek `Decision`, który:

- jest wymagany do przejścia workflow (np. zmiany statusu Initiative / zatwierdzenia Tool Report),
- ma jednego **decidera** (Decision Owner) + due date,
- ma konsekwencje braku decyzji (blokady, koszt opóźnienia),
- może eskalować,
- jest walidowany w backendzie (nie “na oko” w UI).

W skrócie: **gate = formalny punkt odpowiedzialności**.

---

## Zasady systemowe (KANON)

- **Backend enforcement**: bramka musi być sprawdzona po stronie serwera przed zmianą statusu / wygenerowaniem inicjatyw / zatwierdzeniem raportu.
- **UI pokazuje readiness**, ale nie jest źródłem prawdy.
- **Audit trail**: każda próba przejścia przez gate (także odrzucona) jest logowana (kto/kiedy/co/dlaczego).
- **Notifications**: brak decyzji / overdue → presja notyfikacyjna z Primary CTA (Decide/Delegate/Escalate).

---

## Gdzie gates występują (przekrojowo)

### Initiative (PMO lifecycle)

Dokument kanoniczny: `wdrozenia/standards/03-STATUS-WORKFLOW.md`

Przykłady:

- Go/No-Go: `REVIEW → PROMOTED`
- Resources Commit: `PROMOTED → PLANNING`
- Schedule Lock: `APPROVED → SCHEDULED` (+ wymagane daty planu)
- Unblock: `BLOCKED → EXECUTING`
- Start tracking: `DONE → TRACKING`

### Tool (Tool Report gates)

Dokument: `wdrozenia/standards/entities/04-TOOL-REPORT.md`

Przykłady:

- Request review
- Approve tool report
- Generate initiatives

### Assessment (Assessment Report gates)

Dokument: `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md`

Przykłady:

- Approve report
- Generate initiatives

### Task (execution gates – gdy dotyczy)

Task może być blokowany przez Decision i musi to być widoczne w Decision jako “blocks X”.

Dokument: `wdrozenia/standards/entities/01-TASK.md`

---

## Kto może wykonywać gate (role)

Kanon ról i macierzy gate’ów: `wdrozenia/standards/07-ROLES-PERMISSIONS.md`

Kluczowa zasada:

- **Consultant nie może wykonywać gate decisions biznesowych.**
- Wyjątek techniczny: w fazie źródłowej Initiative możliwe jest `SUBMIT_FOR_REVIEW` przez autora.
