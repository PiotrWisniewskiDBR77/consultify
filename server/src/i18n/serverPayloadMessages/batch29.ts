import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_29: readonly ServerPayloadMessage[] = [
  {
    "en": "[closeRoiCase] PIR finalize update returned no row for ${pirRow.pir_id}",
    "pl": "[closeRoiCase] ​​Zakończenie aktualizacji PIR nie zwróciło żadnego wiersza dla ${pirRow.pir_id}"
  },
  {
    "en": "[closeRoiCase] case update returned no row for ${caseId}",
    "pl": "[closeRoiCase] ​​aktualizacja sprawy nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[addScenario] insert returned no row",
    "pl": "[addScenario] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateScenario] update returned no row for ${scenarioId}",
    "pl": "[updateScenario] aktualizacja nie zwróciła wiersza dla ${scenarioId}"
  },
  {
    "en": "[removeScenario] update returned no row for ${scenarioId}",
    "pl": "[removeScenario] aktualizacja nie zwróciła żadnego wiersza dla ${scenarioId}"
  },
  {
    "en": "[setScenarioOverride] upsert returned no row",
    "pl": "Funkcja upsert [setScenarioOverride] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[startRoiCaseTracking] update returned no row for ${caseId}",
    "pl": "Aktualizacja [startRoiCaseTracking] nie zwróciła wiersza dla ${caseId}"
  },
  {
    "en": "[recordVariance] insert returned no row",
    "pl": "[recordVariance] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateVarianceStatus] update returned no row for ${varianceId}",
    "pl": "Aktualizacja [updateVarianceStatus] nie zwróciła żadnego wiersza dla ${varianceId}"
  },
  {
    "en": "[addVarianceCause] insert returned no row",
    "pl": "Wstawka [addVarianceCause] nie zwróciła żadnego wiersza"
  },
  {
    "en": "createStage: organizationId is required",
    "pl": "createStage: wymagany jest identyfikator organizacji"
  },
  {
    "en": "createStage: name is required",
    "pl": "createStage: nazwa jest wymagana"
  },
  {
    "en": "Cannot purchase ${quantity} seats. Maximum seats limit is ${config.max_seats}",
    "pl": "Nie można kupić miejsc ${quantity}. Maksymalny limit miejsc to ${config.max_seats}"
  },
  {
    "en": "Duplicate or empty signal ruleId: ${rule.ruleId}",
    "pl": "Zduplikowany lub pusty identyfikator reguły sygnału: ${rule.ruleId}"
  },
  {
    "en": "Invalid domain for signal rule ${rule.ruleId}",
    "pl": "Nieprawidłowa domena dla reguły sygnału ${rule.ruleId}"
  },
  {
    "en": "Invalid version for signal rule ${rule.ruleId}",
    "pl": "Nieprawidłowa wersja reguły sygnału ${rule.ruleId}"
  },
  {
    "en": "Invalid maxPerRunPerOrg for signal rule ${rule.ruleId}",
    "pl": "Nieprawidłowy maxPerRunPerOrg dla reguły sygnału ${rule.ruleId}"
  },
  {
    "en": "Signal rule ${rule.ruleId} is missing ${required}",
    "pl": "Brakuje reguły sygnałowej ${rule.ruleId} ${required}"
  },
  {
    "en": "Complete interpreted signal provenance is required",
    "pl": "Wymagane jest pełne pochodzenie zinterpretowanego sygnału"
  },
  {
    "en": "Interpreted evidence must reference open deterministic signals in one tenant",
    "pl": "Interpretowane dowody muszą odnosić się do otwartych sygnałów deterministycznych w jednym najemcy"
  },
  {
    "en": "Interpreter model output is not valid JSON: ${err instanceof Error ? err.message : String(err)}",
    "pl": "Dane wyjściowe modelu interpretera są nieprawidłowe JSON: ${err instanceof Error ? err.message : String(err)}"
  },
  {
    "en": "Invalid code. ${remainingAttempts > 0 ? ",
    "pl": "Nieprawidłowy kod. ${remainingAttempts > 0 ? "
  },
  {
    "en": "Twilio client not available",
    "pl": "Klient Twilio jest niedostępny"
  },
  {
    "en": "OIDC token exchange failed (${resp.status}): ${text}",
    "pl": "Wymiana tokena OIDC nie powiodła się (${resp.status}): ${text}"
  },
  {
    "en": "OIDC userinfo failed (${resp.status})",
    "pl": "Informacje o użytkowniku OIDC nie powiodły się (${resp.status})"
  },
  {
    "en": "Invalid stabilization status: ${status}",
    "pl": "Nieprawidłowy status stabilizacji: ${status}"
  },
  {
    "en": "stage gate insert returned no success",
    "pl": "Wstawianie bramki scenicznej nie przyniosło sukcesu"
  },
  {
    "en": "project phase update did not affect exactly one row",
    "pl": "aktualizacja fazy projektu nie wpłynęła dokładnie na jeden wiersz"
  },
  {
    "en": "Pack not found",
    "pl": "Nie znaleziono pakietu"
  },
  {
    "en": "Invalid storage key (path traversal): ${key}",
    "pl": "Nieprawidłowy klucz magazynu (przejście ścieżki): ${key}"
  },
  {
    "en": "Object not found: ${key}",
    "pl": "Nie znaleziono obiektu: ${key}"
  },
  {
    "en": "[S3Adapter] Missing required env var ${name}. Set STORAGE_PROVIDER=s3 only with S3/R2 credentials configured.",
    "pl": "[S3Adapter] Brak wymaganej zmiennej env var ${name}. Ustaw STORAGE_PROVIDER=s3 tylko ze skonfigurowanymi poświadczeniami S3/R2."
  },
  {
    "en": "${name} must be a non-negative integer",
    "pl": "${name} musi być nieujemną liczbą całkowitą"
  },
  {
    "en": "workspaceId is required",
    "pl": "identyfikator obszaru roboczego jest wymagany"
  },
  {
    "en": "actorUserId is required",
    "pl": "aktorUserId jest wymagany"
  },
  {
    "en": "model is required",
    "pl": "wymagany jest model"
  },
  {
    "en": "Failed to store file: ${(err as Error).message}",
    "pl": "Nie udało się zapisać pliku: ${(err as Error).message}"
  },
  {
    "en": "Snapshot ${snapshotId} not found",
    "pl": "Nie znaleziono migawki ${snapshotId}"
  },
  {
    "en": "Snapshot data is empty",
    "pl": "Dane migawki są puste"
  },
  {
    "en": "Slack webhook failed: ${resp.status}",
    "pl": "Błąd webhooka Slack: ${resp.status}"
  },
  {
    "en": "Teams webhook failed: ${resp.status}",
    "pl": "Element webhook aplikacji Teams nie powiódł się: ${resp.status}"
  },
  {
    "en": "AI service unavailable",
    "pl": "Usługa AI niedostępna"
  },
  {
    "en": "Schema was modified since this proposal was created (proposal version: ${proposalSchemaVersion}, current: ${currentSV}).",
    "pl": "Schemat został zmodyfikowany od czasu powstania tej propozycji (wersja propozycji: ${proposalSchemaVersion}, aktualna: ${currentSV})."
  },
  {
    "en": "Schema was modified since this proposal was created. Please regenerate. ",
    "pl": "Schemat został zmodyfikowany od czasu utworzenia tej propozycji. Proszę o regenerację."
  },
  {
    "en": "Maximum refinements reached. Please approve, reject, or start a new proposal.",
    "pl": "Osiągnięto maksymalne udoskonalenia. Zatwierdź, odrzuć lub rozpocznij tworzenie nowej propozycji."
  },
  {
    "en": "recordId is required",
    "pl": "identyfikator rekordu jest wymagany"
  },
  {
    "en": "Google Sheet returned empty content",
    "pl": "Arkusz Google zwrócił pustą treść"
  },
  {
    "en": "Distribution not found",
    "pl": "Nie znaleziono dystrybucji"
  },
  {
    "en": "xlsx package is not available",
    "pl": "Pakiet xlsx nie jest dostępny"
  },
  {
    "en": "KPI ${kpiId} not found",
    "pl": "Nie znaleziono KPI ${kpiId}"
  },
  {
    "en": "Cannot convert ${value} to date",
    "pl": "Do tej pory nie można przekonwertować ${value}"
  },
  {
    "en": "Unsupported conversion from ${fromType} to ${toType}",
    "pl": "Nieobsługiwana konwersja z ${fromType} na ${toType}"
  },
  {
    "en": "Failed to create base",
    "pl": "Nie udało się utworzyć bazy"
  },
  {
    "en": "tableId, recordId, tenantId, and actorId are required",
    "pl": "tableId, recordId, najemcy i aktorId są wymagane"
  },
  {
    "en": "Field ${fromFieldId} is not a linkedRecord field",
    "pl": "Pole ${fromFieldId} nie jest polem połączonego rekordu"
  },
  {
    "en": "Cardinality violation: field ${fromFieldId} allows only one-to-one links (existing: ${cnt}, adding: ${toRecordIds.length",
    "pl": "Naruszenie kardynalności: pole ${fromFieldId} dopuszcza tylko linki jeden do jednego (istniejące: ${cnt}, dodanie: ${toRecordIds.length"
  },
  {
    "en": "Cardinality violation: target record ${toRecordId} is already linked from another record (one-to-many constraint on fiel",
    "pl": "Naruszenie kardynalności: rekord docelowy ${toRecordId} jest już powiązany z innym rekordem (ograniczenie jeden do wielu w polu"
  },
  {
    "en": "Invalid condition_operator: ${conditionOperator}",
    "pl": "Nieprawidłowy condition_operator: ${conditionOperator}"
  },
  {
    "en": "Invalid permission: ${permission}",
    "pl": "Nieprawidłowe pozwolenie: ${permission}"
  },
  {
    "en": "Invalid condition_operator: ${updates.condition_operator}",
    "pl": "Nieprawidłowy condition_operator: ${updates.condition_operator}"
  }
];
