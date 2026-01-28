# 🧩 Standardy encji (kanoniczne)

## Cel
Ujednolicić „kręgosłup systemu”: encje, które przewijają się przez wiele modułów i muszą działać spójnie end-to-end.

## Encje kanoniczne (minimum)
- **Task**: podstawowa jednostka pracy w Execution/My Work, powiązana z Initiative, Decision i Reporting. 
  - **Nowość**: Mechanizm zatwierdzania (acceptance workflow) - taski mogą wymagać zatwierdzenia przed oznaczeniem jako DONE.
  - Statusy: TODO → IN_PROGRESS → PENDING_APPROVAL → DONE (lub bezpośrednio DONE jeśli nie wymaga zatwierdzenia)
- **Decision**: przekrojowy gate + eskalacje + blokowanie workflow.
- **Report**: generator raportów, historia, schedule, eksporty, sekcje (w tym Decisions Required).
- **Tool Report**: artefakt z modułu Tools (snapshot + approval + eksport), baza do generowania initiatives i dowód w raportowaniu.
- **Assessment Report**: artefakt z modułu Assessment (wyniki + gaps + evidence + approval), wymagany przed approval assessment i generowaniem initiatives.

## Zasady wspólne (dla każdej encji)
- **Statusy**: jawne, spójne, walidowane w backendzie.
- **Audit trail**: każda zmiana workflow jest logowana (kto/kiedy/co/dlaczego).
- **RBAC**: każda akcja ma permission.
- **UI**: list + detail/drawer + stany loading/error/empty.
- **API**: CRUD + endpointy workflow + spójne kształty odpowiedzi.

