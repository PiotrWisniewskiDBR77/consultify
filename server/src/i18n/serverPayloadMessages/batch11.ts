import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_11: readonly ServerPayloadMessage[] = [
  {
    "en": "Unknown target state: ${String(to)}",
    "pl": "Nieznany stan docelowy: ${String(to)}"
  },
  {
    "en": "Unknown tool: ${toolName}",
    "pl": "Nieznane narzędzie: ${toolName}"
  },
  {
    "en": "Unresolved blocking comment(s) present",
    "pl": "Obecne są nierozwiązane komentarze blokujące"
  },
  {
    "en": "Upsert limited to ${MAX_BATCH_SIZE} records; received ${records.length}",
    "pl": "Operacja upsert ograniczona do ${MAX_BATCH_SIZE} rekordów; otrzymano ${records.length}"
  },
  {
    "en": "User ID required",
    "pl": "Wymagany identyfikator użytkownika"
  },
  {
    "en": "User does not belong to organization",
    "pl": "Użytkownik nie należy do organizacji"
  },
  {
    "en": "User not found",
    "pl": "Nie znaleziono użytkownika"
  },
  {
    "en": "User rejected step",
    "pl": "Użytkownik odrzucił krok"
  },
  {
    "en": "V8 artifact materialization failed",
    "pl": "Materializacja artefaktu V8 nie powiodła się"
  },
  {
    "en": "Valuation variant not found in this organization",
    "pl": "Wariant oceny nie znaleziony w tej organizacji"
  },
  {
    "en": "Valuation version is ${valuationStatus}; a retired version cannot take a new source binding",
    "pl": "Wersja oceny to ${valuationStatus}; wycofana wersja nie może przyjąć nowego powiązania źródłowego"
  },
  {
    "en": "Variant ${businessVersionId} does not belong to organization ${organizationId}",
    "pl": "Wariant ${businessVersionId} nie należy do organizacji ${organizationId}"
  },
  {
    "en": "Variant ${params.businessVersionId} not found for organization ${params.organizationId}",
    "pl": "Wariant ${params.businessVersionId} nie znaleziony dla organizacji ${params.organizationId}"
  },
  {
    "en": "Variant ${params.variantId} does not belong to organization ${params.organizationId}",
    "pl": "Wariant ${params.variantId} nie należy do organizacji ${params.organizationId}"
  },
  {
    "en": "Verification failed",
    "pl": "Weryfikacja nie powiodła się"
  },
  {
    "en": "Version ${toVersion} not found",
    "pl": "Wersja ${toVersion} nie znaleziona"
  },
  {
    "en": "Version conflict",
    "pl": "Konflikt wersji"
  },
  {
    "en": "Version conflict during approval commit",
    "pl": "Konflikt wersji podczas zatwierdzenia commitu"
  },
  {
    "en": "Version conflict: ${params.businessVersionId} is no longer at version ${params.expectedVersion}/${current.status}",
    "pl": "Konflikt wersji: ${params.businessVersionId} nie znajduje się już na wersji ${params.expectedVersion}/${current.status}"
  },
  {
    "en": "Version conflict: model was modified concurrently. Refresh and retry.",
    "pl": "Konflikt wersji: model został zmodyfikowany współbieżnie. Odśwież i spróbuj ponownie."
  },
  {
    "en": "Version conflict: model was modified since you last read it.",
    "pl": "Konflikt wersji: model został zmodyfikowany od momentu ostatniego odczytu."
  },
  {
    "en": "View not found",
    "pl": "Widok nie znaleziony"
  },
  {
    "en": "WAIVED above INFO severity requires an expiry",
    "pl": "Odrzucona powyżej ważności INFO wymaga wygaśnięcia"
  },
  {
    "en": "Warning: 20%+ of requests are slow (>1s)",
    "pl": "Ostrzeżenie: 20%+ żądań jest wolnych (>1s)"
  },
  {
    "en": "Warning: API Error rate is elevated (${summary.errorRate}%)",
    "pl": "Ostrzeżenie: Wysoki procent błędów API (${summary.errorRate}%)"
  },
  {
    "en": "Warning: Average response time is high (${summary.avgResponseTime}ms)",
    "pl": "Ostrzeżenie: Średni czas odpowiedzi jest wysoki (${summary.avgResponseTime}ms)"
  },
  {
    "en": "Warning: High memory usage (${memory.heapUsed}MB)",
    "pl": "Ostrzeżenie: Wysokie użycie pamięci (${memory.heapUsed}MB)"
  },
  {
    "en": "Web research unavailable",
    "pl": "Badanie internetowe niedostępne"
  },
  {
    "en": "Web search unavailable: ${err.message}",
    "pl": "Wyszukiwanie internetowe niedostępne: ${err.message}"
  },
  {
    "en": "Web search unavailable: missing organization context",
    "pl": "Wyszukiwanie internetowe niedostępne: brak kontekstu organizacji"
  },
  {
    "en": "Webhook processed",
    "pl": "Webhook przetworzony"
  },
  {
    "en": "Working revision moved from ${effectiveWorkingRevisionId} to ${currentWr.working_revision_id}",
    "pl": "Wersja robocza przeniesiona z ${effectiveWorkingRevisionId} do ${currentWr.working_revision_id}"
  },
  {
    "en": "Working revision moved from ${params.expectedWorkingRevisionId} to ${current.working_revision_id} since this client last synced",
    "pl": "Wersja robocza przeniesiona z ${params.expectedWorkingRevisionId} do ${current.working_revision_id} od czasu ostatniego synchronizowania tego klienta"
  },
  {
    "en": "Worksheet ${key} is partial and should be reviewed before publish.",
    "pl": "Arkusz roboczy ${key} jest częściowy i powinien zostać przejrzany przed publikacją."
  },
  {
    "en": "Workspace Bar allows at most ${WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS} direct controls on the right, ",
    "pl": "Pasek przestrzeni roboczej pozwala na maksymalnie ${WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS} bezpośrednich kontrolek po prawej stronie, "
  },
  {
    "en": "Write proposal is unavailable; no change was made.",
    "pl": "Zapisywanie propozycji niedostępne; nie wprowadzono zmian."
  },
  {
    "en": "You have ${context.inboxCount} items in your inbox. Consider batch triaging.",
    "pl": "Masz ${context.inboxCount} elementów w skrzynce odbiorczej. Rozważ wsadowe przetworzenie."
  },
  {
    "en": "You have been invited to join an organization on Consultify",
    "pl": "Zostałeś zaproszony do przyłączenia się do organizacji na Consultify"
  },
  {
    "en": "Your Consultify invitation (resent)",
    "pl": "Twoje zaproszenie do Consultify (ponownie wysłane)"
  },
  {
    "en": "Your Consultify subscription has been canceled",
    "pl": "Twoja subskrypcja Consultify została anulowana"
  },
  {
    "en": "Your organization has been suspended. Contact support to restore access.",
    "pl": "Twoja organizacja została zawieszona. Skontaktuj się z obsługą, aby przywrócić dostęp."
  },
  {
    "en": "Your organization is temporarily locked by the platform operator.",
    "pl": "Twoja organizacja jest tymczasowo zablokowana przez operatora platformy."
  },
  {
    "en": "Your trial has expired. Please upgrade to continue using AI features.",
    "pl": "Twoja wersja próbna wygasła. Uaktualnij, aby kontynuować korzystanie z funkcji AI."
  },
  {
    "en": "[Action Required] Interview Overdue: ${data.templateName}",
    "pl": "[Wymagana akcja] Przesunięty interwencjonistyczny: ${data.templateName}"
  },
  {
    "en": "__schema_version_at_creation:${schemaVersionAtCreation}",
    "pl": "__schema_version_at_creation:${schemaVersionAtCreation}",
    "runtime": false
  },
  {
    "en": "a non-assumption proposal requires a non-empty sourceRefs array",
    "pl": "propozycja bez założenia wymaga niepustej tablicy sourceRefs"
  },
  {
    "en": "ai_classification field has no configured classes",
    "pl": "pole ai_classification nie ma skonfigurowanych klas"
  },
  {
    "en": "ai_classification value must be a string",
    "pl": "wartość ai_classification musi być ciągiem znaków"
  },
  {
    "en": "ai_generated_summary value exceeds max_chars=${max}",
    "pl": "wartość ai_generated_summary przekracza max_chars=${max}"
  },
  {
    "en": "ai_generated_summary value must be a string",
    "pl": "wartość ai_generated_summary musi być ciągiem znaków"
  },
  {
    "en": "anchor is not a valid CellRef: ${parsed.error.message}",
    "pl": "zakotwiczenie nie jest poprawnym CellRef: ${parsed.error.message}"
  },
  {
    "en": "artifactType=${artifactRef.artifactType} has no comparable value table (REPORT_EXPORT is a frozen output, not a live grid)",
    "pl": "artifactType=${artifactRef.artifactType} nie ma porównywalnej tabeli wartości (REPORT_EXPORT to zamrożony wynik, nie żywa siatka)"
  },
  {
    "en": "baseId required",
    "pl": "wymagany baseId"
  },
  {
    "en": "baseWaccPct/baseGPct must be exact members of the corresponding axis so the base cell is unambiguous",
    "pl": "baseWaccPct/baseGPct muszą być dokładnymi członkami odpowiadającej osi, aby komórka podstawowa była jednoznaczna"
  },
  {
    "en": "baselineComputeService: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}",
    "pl": "baselineComputeService: completeJobSuccess zgłosił NOT_RUNNING dla zadania ${runningJob.id}: ${completed.message}"
  },
  {
    "en": "batchDelete: max ${MAX_BATCH_SIZE} records allowed",
    "pl": "batchDelete: maksymalnie ${MAX_BATCH_SIZE} rekordów dozwolonych"
  },
  {
    "en": "batchUpdate: max ${MAX_BATCH_SIZE} records allowed",
    "pl": "batchUpdate: maksymalnie ${MAX_BATCH_SIZE} rekordów dozwolonych"
  },
  {
    "en": "blockingCategory is only valid for SECURITY severity",
    "pl": "blockingCategory jest ważny tylko dla poziomu bezpieczeństwa SECURITY"
  },
  {
    "en": "both axes must have exactly 5 values",
    "pl": "obie osie muszą mieć dokładnie 5 wartości"
  },
  {
    "en": "businessVersionIdA and/or businessVersionIdB not found in organization ${params.organizationId}",
    "pl": "businessVersionIdA i/lub businessVersionIdB nie znaleziono w organizacji ${params.organizationId}"
  }
];
