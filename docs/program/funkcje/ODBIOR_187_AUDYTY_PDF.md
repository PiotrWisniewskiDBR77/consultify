---
doc_id: funkcje-odbior-187
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 187 — Audyty: eksport PDF · SCALONO (backend) · D-3 DOMKNIĘTE (FIX-187 wykonany)

Trasa `.pdf` = strukturalny bliźniak `.docx` (ten sam aktor, walidacja, kontekst,
schemat, sanityzacja; różnica tylko renderer+Content-Type), ta sama ochrona, zero
nowej flagi. Odbiór: własny kontener 6101, migracje idempotentne, 2/2 + regresja
DOCX 10/10, mutacja Content-Type czerwona→zielona. Oceny: trasa 9/10 · reużycie
10/10 · plik 5/10 · dowody 9/10.

## Zastrzeżenia
1. **D-3 nie jest zamknięte klientowo** — brak przycisku w UI (nikt nie pobierze
   PDF poza testem HTTP). → **FIX-187** (wewnętrzny): przycisk obok DOCX
   (`AuditReportDocumentView.tsx:561`, `AuditReportsTab.tsx:123-141` — licencja
   dyżuru już to dopuszczała).
2. ★ **ODZIEDZICZONY defekt renderera PDF, ujawniony przez odbiór:** 6 z 9 stron
   pliku to śmieci paginacji (naprzemiennie „restricted" i „N/3") — podejrzenie:
   `documentPdfRenderer.ts:1141-1150` stempluje stopkę po `bufferedPageRange()`
   i dokłada strony. **Dotyczy WSZYSTKICH PDF-ów (też Materiałów).** → dyżur 191.

★ FIX-187 wykonany (`53ebbf2088`): przycisk „Pobierz PDF" w pełnym widoku raportu
(zastąpił wyszarzone „Planowane") i w kebabie podglądu listy (slot extraActions
StandardPreview), wzorem DOCX, ta sama bramka, 23/23 testy. **D-3 zamknięte
klientowo** — użytkownik realnie pobierze PDF. Zostaje dyżur 191 (paginacja renderera).
