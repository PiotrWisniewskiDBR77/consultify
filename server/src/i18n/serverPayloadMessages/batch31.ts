import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_31: readonly ServerPayloadMessage[] = [
  {
    "en": "${LOG_PREFIX} Item ${itemId} not found",
    "pl": "${LOG_PREFIX} Nie znaleziono elementu ${itemId}"
  },
  {
    "en": "${LOG_PREFIX} Failed to update item ${itemId} after etag check",
    "pl": "${LOG_PREFIX} Nie udało się zaktualizować elementu ${itemId} po sprawdzeniu etagu"
  },
  {
    "en": "${LOG_PREFIX} serverUrl is required for CalDAV connections",
    "pl": "Do połączeń CalDAV wymagany jest adres URL serwera ${LOG_PREFIX}"
  },
  {
    "en": "${LOG_PREFIX} tsdav dependency is required for CalDAV connections",
    "pl": "Do połączeń CalDAV wymagana jest zależność ${LOG_PREFIX} tsdav"
  },
  {
    "en": "${LOG_PREFIX} node-ical dependency is required to parse CalDAV events",
    "pl": "Do analizowania zdarzeń CalDAV wymagana jest zależność ${LOG_PREFIX} od węzła"
  },
  {
    "en": "${LOG_PREFIX} Failed to list CalDAV calendars: ${err instanceof Error ? err.message : String(err)}",
    "pl": "${LOG_PREFIX} Nie udało się wyświetlić kalendarzy CalDAV: ${err instanceof Error ? err.message : String(err)}"
  },
  {
    "en": "${LOG_PREFIX} Failed to fetch CalDAV events: ${err instanceof Error ? err.message : String(err)}",
    "pl": "${LOG_PREFIX} Nie udało się pobrać zdarzeń CalDAV: ${err instanceof Error ? err.message : String(err)}"
  },
  {
    "en": "${LOG_PREFIX} googleapis dependency is required for Google Calendar",
    "pl": "W przypadku Kalendarza Google wymagana jest zależność ${LOG_PREFIX} od Googleapis"
  },
  {
    "en": "${LOG_PREFIX} @microsoft/microsoft-graph-client dependency is required for Microsoft Graph",
    "pl": "${LOG_PREFIX} W przypadku programu Microsoft Graph wymagana jest zależność @microsoft/microsoft-graph-client"
  },
  {
    "en": "${LOG_PREFIX} updateEvent requires providerEventId on the item",
    "pl": "${LOG_PREFIX} updateEvent wymaga dostawcyEventId dla elementu"
  },
  {
    "en": "Adapter required for full resync",
    "pl": "Do pełnej ponownej synchronizacji wymagany jest adapter"
  },
  {
    "en": "ContextSnapshot ${validated.contextSnapshotId} not found in organization ${validated.organizationId}",
    "pl": "Nie znaleziono migawki kontekstowej ${validated.contextSnapshotId} w organizacji ${validated.organizationId}"
  },
  {
    "en": "Room ${roomId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono pokoju ${roomId} w organizacji ${organizationId}"
  },
  {
    "en": "Invalid room state transition: ${fromState} → ${toState}. ",
    "pl": "Nieprawidłowa zmiana stanu pomieszczenia: ${fromState} → ${toState}."
  },
  {
    "en": "Presence not found for user ${userId} client ${clientId} in room ${roomId}",
    "pl": "Nie znaleziono obecności użytkownika ${userId} klienta ${clientId} w pokoju ${roomId}"
  },
  {
    "en": "Room ${roomId} is not in error state (current: ${room.roomState})",
    "pl": "Pokój ${roomId} nie jest w stanie błędu (obecnie: ${room.roomState})"
  },
  {
    "en": "Conflict ${conflictId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono konfliktu ${conflictId} w organizacji ${organizationId}"
  },
  {
    "en": "Conflict ${conflictId} is already resolved (${existing.resolutionStatus})",
    "pl": "Konflikt ${conflictId} został już rozwiązany (${existing.resolutionStatus})"
  },
  {
    "en": "Lock ${lockId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono blokady ${lockId} w organizacji ${organizationId}"
  },
  {
    "en": "Lock ${lockId} is already released (${row.release_reason})",
    "pl": "Blokada ${lockId} jest już zwolniona (${row.release_reason})"
  },
  {
    "en": "Notification ${notificationId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono powiadomienia ${notificationId} w organizacji ${organizationId}"
  },
  {
    "en": "Run ${runId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono uruchomienia ${runId} w organizacji ${organizationId}"
  },
  {
    "en": "Invalid state transition: ${fromState} → ${toState}. ",
    "pl": "Nieprawidłowa zmiana stanu: ${fromState} → ${toState}."
  },
  {
    "en": "Proposal ${proposalId} not found",
    "pl": "Nie znaleziono propozycji ${proposalId}"
  },
  {
    "en": "Cannot resolve proposal ${proposalId}: current status is ${current.status}, ",
    "pl": "Nie można rozpatrzyć propozycji ${proposalId}: bieżący stan to ${current.status},"
  },
  {
    "en": "${LOG_PREFIX} v8_feature_flags table does not exist. Run V8 migrations first.",
    "pl": "${LOG_PREFIX} v8_feature_flags tabela nie istnieje. Najpierw uruchom migrację V8."
  },
  {
    "en": "Ingestion ${validated.ingestionId} not found",
    "pl": "Nie znaleziono przetwarzania ${validated.ingestionId}"
  },
  {
    "en": "Invalid ingestion state transition: ${currentState} → ${validated.newState}",
    "pl": "Nieprawidłowa zmiana stanu przetwarzania: ${currentState} → ${validated.newState}"
  },
  {
    "en": "Ingestion ${ingestionId} not found",
    "pl": "Nie znaleziono przetwarzania ${ingestionId}"
  },
  {
    "en": "Ingestion ${ingestionId} is not in a retryable state (got ${state})",
    "pl": "Przetwarzanie ${ingestionId} nie jest w stanie umożliwiającym ponowienie próby (otrzymałem ${state})"
  },
  {
    "en": "resolution is required",
    "pl": "wymagana jest uchwała"
  },
  {
    "en": "resolvedBy is required",
    "pl": "rozwiązany przez jest wymagany"
  },
  {
    "en": "Generation receipt identity does not match the semantic mutation target",
    "pl": "Tożsamość odbioru generacji nie jest zgodna z celem mutacji semantycznej"
  },
  {
    "en": "Generation invalidation marker identity does not match the mutation target",
    "pl": "Tożsamość znacznika unieważnienia generacji nie jest zgodna z celem mutacji"
  },
  {
    "en": "Generation receipt source readback is incomplete",
    "pl": "Odczyt źródła potwierdzenia generacji jest niekompletny"
  },
  {
    "en": "Finding changed before source-key update",
    "pl": "Wynik zmieniony przed aktualizacją klucza źródłowego"
  },
  {
    "en": "Finding changed before semantic update",
    "pl": "Znalezienie zostało zmienione przed aktualizacją semantyczną"
  },
  {
    "en": "Finding changed before pointer addition",
    "pl": "Znalezienie zostało zmienione przed dodaniem wskaźnika"
  },
  {
    "en": "Pointer changed before removal",
    "pl": "Wskaźnik zmieniony przed usunięciem"
  },
  {
    "en": "Finding changed before pointer removal",
    "pl": "Znalezienie zostało zmienione przed usunięciem wskaźnika"
  },
  {
    "en": "Memory promotion request ${requestId} not found",
    "pl": "Nie znaleziono żądania podniesienia pamięci ${requestId}"
  },
  {
    "en": "Memory promotion request ${requestId} already resolved (status=${row.promotion_status})",
    "pl": "Żądanie podniesienia pamięci ${requestId} zostało już rozwiązane (status=${row.promotion_status})"
  },
  {
    "en": "Manager mutation expected exactly one changed row, got ${result.rowCount}",
    "pl": "Mutacja menedżera oczekiwała dokładnie jednego zmienionego wiersza, otrzymała ${result.rowCount}"
  },
  {
    "en": "Manager mutation expected exactly one changed row, got ${result.changes ?? 0}",
    "pl": "Mutacja menedżera oczekiwała dokładnie jednego zmienionego wiersza, otrzymała ${result.changes ?? 0}"
  },
  {
    "en": "Manager initiative transition requires a pinned transaction",
    "pl": "Przeniesienie inicjatywy menedżera wymaga przypiętej transakcji"
  },
  {
    "en": "No alternative assignee available",
    "pl": "Brak alternatywnego cesjonariusza"
  },
  {
    "en": "No owner candidate available",
    "pl": "Brak kandydata na właściciela"
  },
  {
    "en": "No sponsor candidate available",
    "pl": "Brak kandydata na sponsora"
  },
  {
    "en": "No decision maker candidate available",
    "pl": "Brak dostępnego kandydata na decydenta"
  },
  {
    "en": "No mitigation owner candidate available",
    "pl": "Brak dostępnego kandydata na właściciela mitygacji"
  },
  {
    "en": "No rebalance candidate available",
    "pl": "Brak dostępnych kandydatów do przywrócenia równowagi"
  },
  {
    "en": "No ownership redistribution candidate available",
    "pl": "Brak dostępnych kandydatów do redystrybucji własności"
  },
  {
    "en": "Problem ${args.problemId} not found in lane ${args.laneId}",
    "pl": "Nie znaleziono problemu ${args.problemId} na pasie ${args.laneId}"
  },
  {
    "en": "Problem ${problemId} not found in lane ${laneId}",
    "pl": "Nie znaleziono problemu ${problemId} na pasie ${laneId}"
  },
  {
    "en": "AI returned empty response",
    "pl": "AI zwróciła pustą odpowiedź"
  },
  {
    "en": "add_child requires parent_id",
    "pl": "add_child wymaga parent_id"
  },
  {
    "en": "add_sibling requires target_id",
    "pl": "add_sibling wymaga target_id"
  },
  {
    "en": "add_sibling target not found",
    "pl": "Nie znaleziono celu add_sibling"
  },
  {
    "en": "rename requires target_id",
    "pl": "zmiana nazwy wymaga target_id"
  },
  {
    "en": "rename requires label",
    "pl": "zmiana nazwy wymaga etykiety"
  }
];
