import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_32: readonly ServerPayloadMessage[] = [
  {
    "en": "move requires parent_id or an existing root",
    "pl": "move wymaga parent_id lub istniejącego katalogu głównego"
  },
  {
    "en": "move would create a cycle",
    "pl": "ruch utworzyłby cykl"
  },
  {
    "en": "delete requires target_id",
    "pl": "usuń wymaga target_id"
  },
  {
    "en": "collapse requires target_id",
    "pl": "zwinięcie wymaga target_id"
  },
  {
    "en": "expand requires target_id",
    "pl": "rozwiń wymaga target_id"
  },
  {
    "en": "Unsupported proposal operation: ${String(step.op)}",
    "pl": "Nieobsługiwana operacja propozycji: ${String(step.op)}"
  },
  {
    "en": "unknown_branch_dependency:${dependency}",
    "pl": "unknown_branch_dependency:${dependency}"
  },
  {
    "en": "branch_cost_budget_exceeded:${usage.costUsd}:${budget.maxCostUsd}",
    "pl": "branch_cost_budget_exceeded:${usage.costUsd}:${budget.maxCostUsd}"
  },
  {
    "en": "work_graph_resource_denied:${resourceReservation.reason}",
    "pl": "work_graph_resource_denied:${resourceReservation.reason}"
  },
  {
    "en": "work_graph_not_blocked:${graph.status}",
    "pl": "work_graph_not_blocked:${graph.status}"
  },
  {
    "en": "execution_run_not_planning:${run.state}",
    "pl": "execution_run_not_planning:${run.state}"
  },
  {
    "en": "Facilitation session ${sessionId} not found in organization ${organizationId}",
    "pl": "Sesja facylitacyjna ${sessionId} nie została znaleziona w organizacji ${organizationId}"
  },
  {
    "en": "Invalid facilitation state transition: ${session.sessionState} → paused_degraded. ",
    "pl": "Nieprawidłowe przejście stanu ułatwienia: ${session.sessionState} → paused_degraded."
  },
  {
    "en": "Invalid facilitation state transition: ${session.sessionState} → active. ",
    "pl": "Nieprawidłowe przejście stanu ułatwienia: ${session.sessionState} → aktywne."
  },
  {
    "en": "Invalid facilitation state transition: ${session.sessionState} → ended. ",
    "pl": "Nieprawidłowe przejście stanu ułatwienia: ${session.sessionState} → zakończone."
  },
  {
    "en": "Seam ${seamId} not found in organization ${organizationId}",
    "pl": "Szew ${seamId} nie został znaleziony w organizacji ${organizationId}"
  },
  {
    "en": "Seam ${seamId} is already ${row.current_state} — cannot migrate again",
    "pl": "Szew ${seamId} jest już ${row.current_state} — nie można ponownie przeprowadzić migracji"
  },
  {
    "en": "Package ${validated.packageId} not found",
    "pl": "Nie znaleziono pakietu ${validated.packageId}"
  },
  {
    "en": "Package ${validated.packageId} is retired and cannot be installed",
    "pl": "Pakiet ${validated.packageId} został wycofany i nie można go zainstalować"
  },
  {
    "en": "providerKey is required when pauseScope is provider_type",
    "pl": "ProviderKey jest wymagany, gdy pauzaScope wynosi provider_type"
  },
  {
    "en": "Emergency pause ${pauseId} not found",
    "pl": "Nie znaleziono pauzy awaryjnej ${pauseId}"
  },
  {
    "en": "Emergency pause ${pauseId} is already resumed",
    "pl": "Pauza awaryjna ${pauseId} została już wznowiona"
  },
  {
    "en": "Parent decomposition ${validated.parentId} not found in organization ${validated.organizationId}",
    "pl": "Nie znaleziono rozkładu nadrzędnego ${validated.parentId} w organizacji ${validated.organizationId}"
  },
  {
    "en": "Cross-initiative dependency requires different source and target initiatives",
    "pl": "Zależność między inicjatywami wymaga różnych inicjatyw źródłowych i docelowych"
  },
  {
    "en": "Cross-initiative dependency ${dependencyId} not found in organization ${orgId}",
    "pl": "Nie znaleziono zależności między inicjatywami ${dependencyId} w organizacji ${orgId}"
  },
  {
    "en": "No credential found for connector ${validated.connectorId} in org ${validated.organizationId}",
    "pl": "Nie znaleziono poświadczeń dla złącza ${validated.connectorId} w organizacji ${validated.organizationId}"
  },
  {
    "en": "Connector id is required",
    "pl": "Identyfikator złącza jest wymagany"
  },
  {
    "en": "Organization id is required",
    "pl": "Identyfikator organizacji jest wymagany"
  },
  {
    "en": "Escalation id is required",
    "pl": "Identyfikator eskalacji jest wymagany"
  },
  {
    "en": "Resolved by is required",
    "pl": "Wymagane jest rozwiązanie przez"
  },
  {
    "en": "Auth escalation ${trimmedEscalationId} not found",
    "pl": "Nie znaleziono eskalacji uwierzytelniania ${trimmedEscalationId}"
  },
  {
    "en": "Auth escalation ${trimmedEscalationId} is already resolved",
    "pl": "Eskalacja uwierzytelnienia ${trimmedEscalationId} została już rozwiązana"
  },
  {
    "en": "Governed external auth provider is not approved: ${connectorId}",
    "pl": "Regulowany zewnętrzny dostawca uwierzytelniania nie jest zatwierdzony: ${connectorId}"
  },
  {
    "en": "Governed Google external auth client id is unavailable",
    "pl": "Identyfikator zarządzanego klienta uwierzytelniania zewnętrznego Google jest niedostępny"
  },
  {
    "en": "Governed Google external auth client secret is unavailable",
    "pl": "Zarządzany klucz tajny klienta zewnętrznego uwierzytelniania Google jest niedostępny"
  },
  {
    "en": "Governed Asana external auth client id is unavailable",
    "pl": "Identyfikator klienta zewnętrznego uwierzytelniania zarządzanego Asana jest niedostępny"
  },
  {
    "en": "Governed Asana external auth client secret is unavailable",
    "pl": "Zarządzany klucz tajny klienta zewnętrznego uwierzytelniania Asana jest niedostępny"
  },
  {
    "en": "Governed Microsoft external auth client id is unavailable",
    "pl": "Identyfikator klienta zewnętrznego uwierzytelniania zarządzanego firmy Microsoft jest niedostępny"
  },
  {
    "en": "Governed Microsoft external auth client secret is unavailable",
    "pl": "Kontrolowany klucz tajny klienta uwierzytelniania zewnętrznego firmy Microsoft jest niedostępny"
  },
  {
    "en": "Governed Slack external auth client id is unavailable",
    "pl": "Identyfikator klienta zewnętrznego uwierzytelniania zarządzanego Slack jest niedostępny"
  },
  {
    "en": "Governed Slack external auth client secret is unavailable",
    "pl": "Zarządzany klucz tajny klienta uwierzytelniania zewnętrznego Slack jest niedostępny"
  },
  {
    "en": "Unsupported callback materialization connector: ${params.session.connectorId}",
    "pl": "Nieobsługiwany łącznik materializacji wywołania zwrotnego: ${params.session.connectorId}"
  },
  {
    "en": "Failed to resolve Google user info for governed external auth",
    "pl": "Nie udało się rozwiązać informacji o użytkowniku Google w przypadku regulowanego uwierzytelniania zewnętrznego"
  },
  {
    "en": "Failed to resolve Microsoft user info for governed external auth",
    "pl": "Nie udało się rozwiązać informacji o użytkowniku Microsoft w przypadku regulowanego uwierzytelniania zewnętrznego"
  },
  {
    "en": "Governed refresh secret storage is unavailable",
    "pl": "Zarządzany magazyn tajny odświeżania jest niedostępny"
  },
  {
    "en": "Invalid auth state transition: ${currentState} → ${validated.targetState}",
    "pl": "Nieprawidłowa zmiana stanu autoryzacji: ${currentState} → ${validated.targetState}"
  },
  {
    "en": "Conflict ${conflictId} not found",
    "pl": "Nie znaleziono konfliktu ${conflictId}"
  },
  {
    "en": "Conflict ${conflictId} is already resolved",
    "pl": "Konflikt ${conflictId} został już rozwiązany"
  },
  {
    "en": "Invalid provider state transition: ${currentState} → ${params.targetState}",
    "pl": "Nieprawidłowa zmiana stanu dostawcy: ${currentState} → ${params.targetState}"
  },
  {
    "en": "Bundle ${bundleId} not found",
    "pl": "Nie znaleziono pakietu ${bundleId}"
  },
  {
    "en": "Cannot activate rolled-back bundle ${bundleId}",
    "pl": "Nie można aktywować wycofanego pakietu ${bundleId}"
  },
  {
    "en": "Cannot activate bundle ${bundleId}: ${failedHardGates.length} hard gate(s) failed",
    "pl": "Nie można aktywować pakietu ${bundleId}: ${failedHardGates.length} twarde bramy nie powiodły się"
  },
  {
    "en": "Bundle ${bundleId} is already rolled back",
    "pl": "Pakiet ${bundleId} został już wycofany"
  },
  {
    "en": "Publish record ${validated.recordId} not found",
    "pl": "Nie znaleziono rekordu publikacji ${validated.recordId}"
  },
  {
    "en": "Invalid state transition: ${currentState} → ${validated.newState}. ",
    "pl": "Nieprawidłowa zmiana stanu: ${currentState} → ${validated.newState}."
  },
  {
    "en": "Finance lock ${lockId} not found",
    "pl": "Nie znaleziono blokady finansowej ${lockId}"
  },
  {
    "en": "Finance lock ${lockId} is already unlocked",
    "pl": "Blokada finansowa ${lockId} jest już odblokowana"
  },
  {
    "en": "Dead-letter record ${deadLetterId} not found",
    "pl": "Nie znaleziono rekordu niedostarczonej wiadomości ${deadLetterId}"
  },
  {
    "en": "Invalid resolution transition: ${row.resolution_state} → ${state}",
    "pl": "Nieprawidłowa zmiana rozdzielczości: ${row.resolution_state} → ${state}"
  },
  {
    "en": "Bulk replay requires safeguards (Decision W5-7: never blind fire-and-forget)",
    "pl": "Odtwarzanie zbiorcze wymaga zabezpieczeń (Decyzja W5-7: nigdy nie oślepiaj, odpal i zapomnij)"
  }
];
