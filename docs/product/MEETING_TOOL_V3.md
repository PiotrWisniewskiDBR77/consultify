# Meeting Tool v3 — SSOT

> **Status:** Draft (v3)  
> **Cel:** Zdefiniować narzędzie “Meeting”, które spina pracę projektową: kalendarz/event, agenda, pre‑read, decyzje, taski, follow‑ups.  
> **Powiązane SSOT:**  
> - `docs/product/OPERATING_MODEL_V3.md` (flow: Interview/Tools/Execution)  
> - `docs/product/PRESENTATIONS_AND_REPORTS_V3.md` (pre‑read, deck, raport)  
> - `docs/ui-standards/03-modules/view-modes-standard.md` (calendar/timeline jako view modes)  
> - `docs/ui-standards/02-components/workspace-3-tools-strip.md` (narzędzia + context + AI suggestions)  

---

## 1) Cel produktu

Meeting to **informacyjno‑decyzyjny event**, który:

- ma czas i uczestników (online/offline)
- ma agendę i materiały (pre‑read)
- generuje decyzje i zadania
- zostawia ślad w platformie (kontekst + follow‑ups)

To ma działać zarówno dla:

- kick‑offów
- statusów operacyjnych
- spotkań decyzyjnych (governance)
- synchronizacji z klientem

---

## 2) Surface type (v3)

W v3 Meeting jest narzędziem typu:

- **Workspace / document-like** (agenda + notes + decisions + tasks)  
  + opcjonalny widok **Calendar** jako kolekcja eventów

---

## 3) Artefakty (v3)

Nazwy robocze:

- `Meeting` (event)
- `AgendaItem` (punkty)
- `MeetingNote` (notatka/summary)

Powiązania:

- `Meeting` ↔ `Tasks` (follow‑ups)
- `Meeting` ↔ `Decisions` (ustalenia)
- `Meeting` ↔ `Initiatives` (kontekst projektowy)
- `Meeting` ↔ `Reports/Decks` (pre‑read, podsumowania)

---

## 4) Minimalny kontrakt UX (MUST)

- **Before**: przygotowanie agendy + pre‑read (linki do raportów/decków/notatek)
- **During**: szybkie notowanie + rejestr decyzji + generowanie tasków
- **After**: automatyczne “follow‑ups” (task list) + summary (dla uczestników)

Kanon AI:

- AI działa jako *propose → accept* (np. propose agenda, propose summary)
- AI w kontekście = przycisk w Module Topbar (nie globalny)

---

## 5) Out of scope (v3)

- pełna synchronizacja z zewnętrznymi kalendarzami (Google/Microsoft) — jeśli nie jest gotowa, traktujemy jako v4+

