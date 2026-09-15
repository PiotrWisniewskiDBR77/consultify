import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_22: readonly ServerPayloadMessage[] = [
  {
    "en": "describeCommandUnavailability: unhandled reason ${JSON.stringify(exhaustive)}",
    "pl": "opiszPolecenieNiedostępność: nieobsługiwany powód ${JSON.stringify(exhaustive)}"
  },
  {
    "en": "focusTargetForOperation: operation has no targets (violates the AP-00 Operation contract).",
    "pl": "focusTargetForOperation: operacja nie ma celów (narusza kontrakt Operacji AP-00)."
  },
  {
    "en": "KeyboardCommandRegistry: combo collision(s) detected: ${detail}",
    "pl": "KeyboardCommandRegistry: wykryto kolizje kombi: ${detail}"
  },
  {
    "en": "KeyboardCommandRegistry: destructive-command guard violation(s): ${detail}",
    "pl": "KeyboardCommandRegistry: naruszenie zasad dowodzenia niszczącego: ${detail}"
  },
  {
    "en": "Only statement-ready statements can seed a financial analysis",
    "pl": "Tylko wyciągi gotowe do wyciągów mogą zapoczątkować analizę finansową"
  },
  {
    "en": "Analysis not found",
    "pl": "Nie znaleziono analizy"
  },
  {
    "en": "No financial model found",
    "pl": "Nie znaleziono modelu finansowego"
  },
  {
    "en": "Model has no computed outputs",
    "pl": "Model nie ma obliczonych wyników"
  },
  {
    "en": "Source statement not found",
    "pl": "Nie znaleziono oświadczenia źródłowego"
  },
  {
    "en": "Statement must be statement-ready before it can seed a model",
    "pl": "Instrukcja musi być gotowa do użycia, zanim będzie mogła zapełnić model"
  },
  {
    "en": "Source statement pack not found",
    "pl": "Nie znaleziono pakietu instrukcji źródłowych"
  },
  {
    "en": "Source project not found",
    "pl": "Nie znaleziono projektu źródłowego"
  },
  {
    "en": "Source initiative not found",
    "pl": "Nie znaleziono inicjatywy źródłowej"
  },
  {
    "en": "Investment Case not found",
    "pl": "Nie znaleziono przypadku inwestycyjnego"
  },
  {
    "en": "Cannot refresh an approved model. Create a new version instead.",
    "pl": "Nie można odświeżyć zatwierdzonego modelu. Zamiast tego utwórz nową wersję."
  },
  {
    "en": "Model has no source statement to refresh from",
    "pl": "Model nie ma instrukcji źródłowej, z której można by odświeżyć"
  },
  {
    "en": "Statement pack not found",
    "pl": "Nie znaleziono pakietu instrukcji"
  },
  {
    "en": "Statement not found",
    "pl": "Nie znaleziono oświadczenia"
  },
  {
    "en": "Statement pack must be ready before it can seed downstream work",
    "pl": "Pakiet instrukcji musi być gotowy, zanim będzie mógł rozpocząć dalsze prace"
  },
  {
    "en": "Statement pack must contain P&L, Balance Sheet, and Cash Flow",
    "pl": "Zestaw wyciągów musi zawierać rachunek zysków i strat, bilans i przepływy pieniężne"
  },
  {
    "en": "[FinancialStatementService] Idempotency reservation conflict for ${organizationId}/${idempotencyKey} but no row found on",
    "pl": "[FinancialStatementService] Konflikt rezerwacji idempotencji dla ${organizationId}/${idempotencyKey}, ale nie znaleziono wiersza w"
  },
  {
    "en": "Unsupported financial statement mapping status: ${requestedMappingStatus}",
    "pl": "Nieobsługiwany stan mapowania sprawozdania finansowego: ${requestedMappingStatus}"
  },
  {
    "en": "[GDPR] Cannot build INSERT for ${tableName}: no matching columns",
    "pl": "[GDPR] Nie można zbudować INSERT dla ${tableName}: brak pasujących kolumn"
  },
  {
    "en": "[GDPR] Cannot build SELECT for ${tableName}",
    "pl": "[GDPR] Nie można zbudować SELECT dla ${tableName}"
  },
  {
    "en": "[GDPR] data_export_requests table missing (run migrations)",
    "pl": "[GDPR] Brak tabeli data_export_requests (uruchom migracje)"
  },
  {
    "en": "[GDPR] organizationId is required for org-scoped export requests",
    "pl": "[GDPR] organizationId jest wymagany dla żądań eksportu w zakresie organizacji"
  },
  {
    "en": "[GDPR] account_deletion_requests table missing (run migrations)",
    "pl": "[GDPR] Brak tabeli account_deletion_requests (uruchom migracje)"
  },
  {
    "en": "Report not found",
    "pl": "Nie znaleziono raportu"
  },
  {
    "en": "Missing required audit parameters: actorId, orgId, action, resourceType",
    "pl": "Brak wymaganych parametrów audytu: aktorId, orgId, akcja, ResourceType"
  },
  {
    "en": "Invalid action: ${action}",
    "pl": "Nieprawidłowa akcja: ${action}"
  },
  {
    "en": "KPI not readable after create",
    "pl": "KPI nieczytelny po utworzeniu"
  },
  {
    "en": "KPI read leaked across organization boundary",
    "pl": "Odczyt KPI wyciekł poza granice organizacji"
  },
  {
    "en": "ROI entry not readable after write",
    "pl": "Wpis ROI nieczytelny po zapisie"
  },
  {
    "en": "ROI realized value mismatch on read",
    "pl": "ROI zrealizował niezgodność wartości podczas odczytu"
  },
  {
    "en": "Model-grounding contract rejected a valid sourceStatementId payload",
    "pl": "Umowa uziemiająca model odrzuciła prawidłowy ładunek sourceStatementId"
  },
  {
    "en": "add-member role validation contract broke",
    "pl": "Umowa dotycząca sprawdzania roli dodanego członka została zerwana"
  },
  {
    "en": "add-member role validation is too permissive",
    "pl": "Sprawdzanie poprawności roli członka dodatkowego jest zbyt liberalne"
  },
  {
    "en": "Audit entry not readable after emission",
    "pl": "Wpis audytu nieczytelny po emisji"
  },
  {
    "en": "Ready artifact missing from list",
    "pl": "Gotowego artefaktu brakuje na liście"
  },
  {
    "en": "Default view (filters:{}) leaked a draft artifact",
    "pl": "Widok domyślny (filtry:{}) spowodował wyciek artefaktu wersji roboczej"
  },
  {
    "en": "Benefit did not surface for DONE initiative",
    "pl": "Korzyści nie pojawiły się w przypadku inicjatywy DONE"
  },
  {
    "en": "assessment-reports route module failed to import (DRD endpoint dead)",
    "pl": "Nie udało się zaimportować modułu trasy raportów z oceny (nie działa punkt końcowy DRD)"
  },
  {
    "en": "Outputs register read did not return an array",
    "pl": "Odczyt rejestru wyjściowego nie zwrócił tablicy"
  },
  {
    "en": "Initiative not readable after tool handoff create",
    "pl": "Inicjatywa nieczytelna po utworzeniu przekazania narzędzia"
  },
  {
    "en": "Tool back-reference lost: source_id does not match the tool session id",
    "pl": "Utracono odwołanie wsteczne narzędzia: source_id nie pasuje do identyfikatora sesji narzędzia"
  },
  {
    "en": "Initiative not readable after convert create",
    "pl": "Inicjatywa nieczytelna po utworzeniu konwersji"
  },
  {
    "en": "Convert back-reference lost: source_id does not match the session id",
    "pl": "Konwertuj utracone odwołanie wsteczne: source_id nie pasuje do identyfikatora sesji"
  },
  {
    "en": "Task not readable back through initiative_id linkage",
    "pl": "Zadania nie można odczytać ponownie poprzez połączenie initiative_id"
  },
  {
    "en": "Closure handoff did not create the benefit (created=${first?.created}, considered=${first?.considered})",
    "pl": "Przekazanie zamknięcia nie przyniosło korzyści (utworzono=${first?.created}, rozważono=${first?.considered})"
  },
  {
    "en": "Benefit row not readable after closure handoff",
    "pl": "Wiersz dotyczący świadczeń nieczytelny po przekazaniu zamknięcia"
  },
  {
    "en": "Closure handoff re-run is not idempotent (created=${second?.created}, skipped=${second?.skipped})",
    "pl": "Ponowne uruchomienie przekazania zamknięcia nie jest idempotentne (utworzono=${second?.created}, pominięto=${second?.skipped})"
  },
  {
    "en": "Reconciliation did not reconcile the KPI (count=${result?.reconciledCount})",
    "pl": "Uzgodnienie nie doprowadziło do uzgodnienia KPI (liczba=${result?.reconciledCount})"
  },
  {
    "en": "Unit conversion broken: realized=${item.realizedValue} projected=${item.projectedValue} (expected 72000 / 90000)",
    "pl": "Uszkodzona konwersja jednostek: zrealizowana = ${item.realizedValue} przewidywana = ${item.projectedValue} (oczekiwana 72000 / 90000)"
  },
  {
    "en": "Deviation not on finance basis: ${item.deviationAbsolute} (expected -18000)",
    "pl": "Odchylenie nie na tle finansowym: ${item.deviationAbsolute} (oczekiwane -18000)"
  },
  {
    "en": "Reconciliation row not readable after reconcile",
    "pl": "Wiersz uzgodnienia nieczytelny po uzgodnieniu"
  },
  {
    "en": "Persisted reconciliation drifted: unit_multiplier=${row.unit_multiplier} deviation=${row.deviation_absolute}",
    "pl": "Dryf trwałego uzgodnienia: unit_multiplier=${row.unit_multiplier} odchylenie=${row.deviation_absolute}"
  },
  {
    "en": "Unknown generatorType: ${generatorType}",
    "pl": "Nieznany generatorTyp: ${generatorType}"
  },
  {
    "en": "AI response invalid",
    "pl": "Odpowiedź AI nieprawidłowa"
  },
  {
    "en": "Failed to create initiative",
    "pl": "Nie udało się utworzyć inicjatywy"
  },
  {
    "en": "auditId is required",
    "pl": "identyfikator audytu jest wymagany"
  }
];
