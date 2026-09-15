import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_18: readonly ServerPayloadMessage[] = [
  {
    "en": "intake_${fieldCode}_too_many_items",
    "pl": "Pole intake_${fieldCode} zawiera zbyt wiele elementów"
  },
  {
    "en": "intake_${fieldCode}_item_too_long",
    "pl": "Element pola intake_${fieldCode} jest zbyt długi"
  },
  {
    "en": "plan_status_transition_not_allowed:${row.status}->IN_REVIEW",
    "pl": "plan_status_transition_not_allowed:${row.status}->IN_REVIEW"
  },
  {
    "en": "plan_status_transition_not_allowed:${row.status}->DRAFT",
    "pl": "Niedozwolona zmiana statusu planu: ${row.status} → DRAFT"
  },
  {
    "en": "plan_status_transition_not_allowed:${row.status}->PUBLISHED",
    "pl": "Niedozwolona zmiana statusu planu: ${row.status} → PUBLISHED"
  },
  {
    "en": "plan_status_transition_not_allowed:${row.status}->WITHDRAWN",
    "pl": "Niedozwolona zmiana statusu planu: ${row.status} → WITHDRAWN"
  },
  {
    "en": "node_run_status_transition_not_allowed:${from}->${to}",
    "pl": "node_run_status_transition_not_allowed:${from}->${to}"
  },
  {
    "en": "node_run_status_transition_not_allowed:${row.status}->${input.outcome}",
    "pl": "node_run_status_transition_not_allowed:${row.status}->${input.outcome}"
  },
  {
    "en": "process_definition_share_not_a_widening:${row.visibility}->${targetVisibility}",
    "pl": "process_definition_share_not_a_widening:${row.visibility}->${targetVisibility}"
  },
  {
    "en": "process_version_status_transition_not_allowed:${row.status}->IN_REVIEW",
    "pl": "process_version_status_transition_not_allowed:${row.status}->IN_REVIEW"
  },
  {
    "en": "process_version_status_transition_not_allowed:${row.status}->PUBLISHED",
    "pl": "Niedozwolona zmiana statusu wersji procesu: ${row.status} → PUBLISHED"
  },
  {
    "en": "process_version_status_transition_not_allowed:${row.status}->DEPRECATED",
    "pl": "Niedozwolona zmiana statusu wersji procesu: ${row.status} → DEPRECATED"
  },
  {
    "en": "process_version_status_transition_not_allowed:${row.status}->ARCHIVED",
    "pl": "Niedozwolona zmiana statusu wersji procesu: ${row.status} → ARCHIVED"
  },
  {
    "en": "proposal_status_transition_not_allowed:${row.status}->PENDING_REVIEW",
    "pl": "proposal_status_transition_not_allowed:${row.status}->PENDING_REVIEW"
  },
  {
    "en": "proposal_status_transition_not_allowed:${row.status}->decision",
    "pl": "proposal_status_transition_not_allowed:${row.status}->decyzja"
  },
  {
    "en": "proposal_status_transition_not_allowed:${row.status}->${nextStatus}",
    "pl": "proposal_status_transition_not_allowed:${row.status}->${nextStatus}"
  },
  {
    "en": "proposal_status_transition_not_allowed:${row.status}->EXECUTING",
    "pl": "Niedozwolona zmiana statusu propozycji: ${row.status} → EXECUTING"
  },
  {
    "en": "proposal_status_transition_not_allowed:${row.status}->APPROVED",
    "pl": "Niedozwolona zmiana statusu propozycji: ${row.status} → APPROVED"
  },
  {
    "en": "run_lifecycle_status_transition_not_allowed:${from}->${to}",
    "pl": "run_lifecycle_status_transition_not_allowed:${from}->${to}"
  },
  {
    "en": "run_lifecycle_status_transition_not_allowed:${row.status}->${path[0]}",
    "pl": "run_lifecycle_status_transition_not_allowed:${row.status}->${path[0]}"
  },
  {
    "en": "run_lifecycle_status_transition_not_allowed:${row.status}->RUNNING",
    "pl": "Niedozwolona zmiana statusu cyklu wykonania: ${row.status} → RUNNING"
  },
  {
    "en": "run_lifecycle_status_transition_not_allowed:${row.status}->RETRY_NODE",
    "pl": "run_lifecycle_status_transition_not_allowed:${row.status}->RETRY_NODE"
  },
  {
    "en": "run_lifecycle_status_transition_not_allowed:${row.status}->COMPENSATION_OUTCOME",
    "pl": "run_lifecycle_status_transition_not_allowed:${row.status}->COMPENSATION_OUTCOME"
  },
  {
    "en": "wait_status_transition_not_allowed:${wait.status}->SATISFIED",
    "pl": "Niedozwolona zmiana statusu oczekiwania: ${wait.status} → SATISFIED"
  },
  {
    "en": "wait_wrong_type_for_event_resolution:${wait.waitType}",
    "pl": "wait_wrong_type_for_event_resolution:${wait.waitType}"
  },
  {
    "en": "wait_status_transition_not_allowed:${row.status}->SATISFIED",
    "pl": "Niedozwolona zmiana statusu oczekiwania: ${row.status} → SATISFIED"
  },
  {
    "en": "wait_status_transition_not_allowed:${row.status}->${nextStatus}",
    "pl": "wait_status_transition_not_allowed:${row.status}->${nextStatus}"
  },
  {
    "en": "${LOG_PREFIX} materialized DONE receipt was not persisted",
    "pl": "${LOG_PREFIX} zmaterializowało się potwierdzenie DONE nie zostało utrwalone"
  },
  {
    "en": "${LOG_PREFIX} attemptDeliveryInternal: no receipt found for id ${receiptId}",
    "pl": "${LOG_PREFIX} próbaDeliveryInternal: nie znaleziono potwierdzenia dla identyfikatora ${receiptId}"
  },
  {
    "en": "handoffFromClosure completed without throwing, but produced zero initiative_benefits ",
    "pl": "handoffFromClosure ukończono bez rzucania, ale uzyskano zero initiative_benefits"
  },
  {
    "en": "forced closure ROI receipt JSON update failure",
    "pl": "wymuszone zamknięcie Potwierdzenie ROI Błąd aktualizacji JSON"
  },
  {
    "en": "${LOG_PREFIX} retryDeliveryForOrg: no receipt ${receiptId} in organization ${organizationId}",
    "pl": "${LOG_PREFIX} spróbuj ponownieDeliveryForOrg: brak potwierdzenia ${receiptId} w organizacji ${organizationId}"
  },
  {
    "en": "${LOG_PREFIX} redrive: receipt not found",
    "pl": "${LOG_PREFIX} przeprowadzka: nie znaleziono paragonu"
  },
  {
    "en": "${providerLabel} access token not configured",
    "pl": "${providerLabel} token dostępu nie skonfigurowany"
  },
  {
    "en": "Failed to create cloud source",
    "pl": "Nie udało się utworzyć źródła chmury"
  },
  {
    "en": "Cloud source not found",
    "pl": "Nie znaleziono źródła chmury"
  },
  {
    "en": "Download not supported for provider ${source.provider}",
    "pl": "Pobieranie nie jest obsługiwane w przypadku dostawcy ${source.provider}"
  },
  {
    "en": "Unsupported Google Workspace file type for export: ${mimeType}",
    "pl": "Nieobsługiwany typ pliku Google Workspace do eksportu: ${mimeType}"
  },
  {
    "en": "Google Drive download error: ${contentRes.status}",
    "pl": "Błąd pobierania Dysku Google: ${contentRes.status}"
  },
  {
    "en": "Upload not supported for provider ${source.provider}",
    "pl": "Przesyłanie nie jest obsługiwane w przypadku dostawcy ${source.provider}"
  },
  {
    "en": "Google Drive upload error: ${response.status}",
    "pl": "Błąd przesyłania na Dysk Google: ${response.status}"
  },
  {
    "en": "OneDrive upload error: ${response.status}",
    "pl": "Błąd przesyłania OneDrive: ${response.status}"
  },
  {
    "en": "OneDrive token expired — reauth required",
    "pl": "Token OneDrive wygasł — wymagane jest ponowne uwierzytelnienie"
  },
  {
    "en": "OneDrive download error: ${contentResp.status}",
    "pl": "Błąd pobierania OneDrive: ${contentResp.status}"
  },
  {
    "en": "Dropbox token expired — reauth required",
    "pl": "Token Dropbox wygasł — wymagane ponowne uwierzytelnienie"
  },
  {
    "en": "Dropbox download error: ${response.status}",
    "pl": "Błąd pobierania Dropbox: ${response.status}"
  },
  {
    "en": "Dropbox upload error ${response.status}: ${errText.slice(0, 200)}",
    "pl": "Błąd przesyłania do Dropbox ${response.status}: ${errText.slice(0, 200)}"
  },
  {
    "en": "Import job not found",
    "pl": "Nie znaleziono zadania importu"
  },
  {
    "en": "At least one conclusion is required to create a readout",
    "pl": "Do utworzenia odczytu wymagany jest co najmniej jeden wniosek"
  },
  {
    "en": "Failed to create readout",
    "pl": "Nie udało się utworzyć odczytu"
  },
  {
    "en": "Readout not found",
    "pl": "Nie znaleziono odczytu"
  },
  {
    "en": "Unknown connector: ${connectorKey}",
    "pl": "Nieznane złącze: ${connectorKey}"
  },
  {
    "en": "Category not found",
    "pl": "Nie znaleziono kategorii"
  },
  {
    "en": "Failed to retrieve updated category",
    "pl": "Nie udało się pobrać zaktualizowanej kategorii"
  },
  {
    "en": "contentId, contentType, userId, and commentText are required",
    "pl": "contentId, contentType, userId i komentarzText są wymagane"
  },
  {
    "en": "Comment ${id} not found",
    "pl": "Nie znaleziono komentarza ${id}"
  },
  {
    "en": "Can only edit your own comments",
    "pl": "Można edytować tylko własne komentarze"
  },
  {
    "en": "Failed to retrieve updated comment",
    "pl": "Nie udało się pobrać zaktualizowanego komentarza"
  },
  {
    "en": "Failed to retrieve resolved comment",
    "pl": "Nie udało się pobrać rozwiązanego komentarza"
  },
  {
    "en": "contentId, contentType, requestedBy, and reviewerId are required",
    "pl": "contentId, contentType, requestBy i reviewerId są wymagane"
  }
];
