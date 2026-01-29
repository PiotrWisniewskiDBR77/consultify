# 🧩 Standardy encji (kanoniczne)

## Cel

Ujednolicić „kręgosłup systemu”: encje, które przewijają się przez wiele modułów i muszą działać spójnie end-to-end.

## Encje kanoniczne (minimum)

- **Task**: podstawowa jednostka pracy w Execution/My Work, powiązana z Initiative, Decision i Reporting.
  - Kanon: `wdrozenia/standards/entities/01-TASK.md`
- **Decision**: formalny punkt odpowiedzialności odblokowujący działania; most między analizą a działaniem.
  - Kanon: `wdrozenia/standards/entities/02-DECISION.md`
- **Notification**: system presji i odpowiedzialności (nie feed); utrzymuje napięcie decyzyjne i zapobiega bezruchowi.
  - Kanon: `wdrozenia/standards/entities/06-NOTIFICATION.md`
- **Report**: generator raportów, historia, schedule, eksporty, sekcje (w tym Decisions Required).
- **Tool Report**: artefakt z modułu Tools (snapshot + approval + eksport), baza do generowania initiatives i dowód w raportowaniu.
- **Assessment Report**: artefakt z modułu Assessment (wyniki + gaps + evidence + approval), wymagany przed approval assessment i generowaniem initiatives.

## Zasady wspólne (dla każdej encji)

- **Statusy**: jawne, spójne, walidowane w backendzie.
- **Audit trail**: każda zmiana workflow jest logowana (kto/kiedy/co/dlaczego).
- **RBAC**: każda akcja ma permission.
- **UI**: list + detail/drawer + stany loading/error/empty.
- **API**: CRUD + endpointy workflow + spójne kształty odpowiedzi.
