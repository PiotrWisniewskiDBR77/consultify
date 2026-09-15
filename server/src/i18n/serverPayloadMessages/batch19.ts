import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_19: readonly ServerPayloadMessage[] = [
  {
    "en": "Failed to retrieve created review",
    "pl": "Nie udało się pobrać utworzonej recenzji"
  },
  {
    "en": "Review not found",
    "pl": "Nie znaleziono recenzji"
  },
  {
    "en": "Tag not found",
    "pl": "Nie znaleziono tagu"
  },
  {
    "en": "Failed to retrieve updated tag",
    "pl": "Nie udało się pobrać zaktualizowanego tagu"
  },
  {
    "en": "Document not yet extracted",
    "pl": "Dokument jeszcze nie wyodrębniony"
  },
  {
    "en": "Dashboard name is required",
    "pl": "Nazwa panelu jest wymagana"
  },
  {
    "en": "No connector registered for type: ${type}",
    "pl": "Brak zarejestrowanego złącza dla typu: ${type}"
  },
  {
    "en": "Connector not found: ${connectorId}",
    "pl": "Nie znaleziono złącza: ${connectorId}"
  },
  {
    "en": "Connector ${connectorId} has no target table",
    "pl": "Złącze ${connectorId} nie ma tabeli docelowej"
  },
  {
    "en": "No field mapping configured for connector",
    "pl": "Nie skonfigurowano mapowania pól dla łącznika"
  },
  {
    "en": "config.baseId is required",
    "pl": "wymagany jest plik config.baseId"
  },
  {
    "en": "config.apiToken is required",
    "pl": "Wymagany jest plik config.apiToken"
  },
  {
    "en": "Airtable API rate limit exceeded (30 req/sec). Try again later.",
    "pl": "Przekroczono limit szybkości API Airtable (30 żądań/s). Spróbuj ponownie później."
  },
  {
    "en": "Airtable authentication failed (${resp.status}): ${text}",
    "pl": "Uwierzytelnienie Airtable nie powiodło się (${resp.status}): ${text}"
  },
  {
    "en": "No tables found in Airtable base",
    "pl": "W bazie Airtable nie znaleziono żadnych tabel"
  },
  {
    "en": "config.filePath is required",
    "pl": "config.filePath jest wymagany"
  },
  {
    "en": "config.spreadsheetId is required",
    "pl": "wymagany jest plik config.spreadsheetId"
  },
  {
    "en": "Failed to obtain access token: ${resp.status} ${text}",
    "pl": "Nie udało się uzyskać tokena dostępu: ${resp.status} ${text}"
  },
  {
    "en": "Either apiKey or serviceAccountJson must be provided",
    "pl": "Należy podać klucz apiKey lub serviceAccountJson"
  },
  {
    "en": "Google Sheets API rate limit exceeded. Try again later.",
    "pl": "Przekroczono limit szybkości interfejsu API Arkuszy Google. Spróbuj ponownie później."
  },
  {
    "en": "Authentication failed (${resp.status}): ${text}",
    "pl": "Uwierzytelnienie nie powiodło się (${resp.status}): ${text}"
  },
  {
    "en": "config.email is required",
    "pl": "wymagany jest plik config.email"
  },
  {
    "en": "Jira authentication failed (${resp.status}): ${text}",
    "pl": "Uwierzytelnienie Jira nie powiodło się (${resp.status}): ${text}"
  },
  {
    "en": "Jira API rate limit exceeded. Try again later.",
    "pl": "Przekroczono limit szybkości interfejsu Jira API. Spróbuj ponownie później."
  },
  {
    "en": "config.host is required",
    "pl": "wymagany jest plik config.host"
  },
  {
    "en": "config.database is required",
    "pl": "wymagana jest baza danych konfiguracji"
  },
  {
    "en": "config.user is required",
    "pl": "wymagany jest plik config.user"
  },
  {
    "en": "config.password is required",
    "pl": "wymagane jest hasło konfiguracyjne"
  },
  {
    "en": "config.table is required (or provide config.query)",
    "pl": "wymagany jest plik config.table (lub podaj plik config.query)"
  },
  {
    "en": "intervalMinutes must be positive",
    "pl": "InterwałMinuty muszą być dodatnie"
  },
  {
    "en": "dataType and retentionDays are required",
    "pl": "dataType i retencjiDays są wymagane"
  },
  {
    "en": "Decision not found",
    "pl": "Nie znaleziono decyzji"
  },
  {
    "en": "Only the current decider can fully delegate a decision",
    "pl": "Tylko obecny decydent może w pełni przekazać decyzję"
  },
  {
    "en": "Delegation not found",
    "pl": "Nie znaleziono delegacji"
  },
  {
    "en": "You are not the recipient of this delegation",
    "pl": "Nie jesteś odbiorcą tej delegacji"
  },
  {
    "en": "Cannot accept delegation in status: ${delegation.status}",
    "pl": "Nie można zaakceptować delegacji w statusie: ${delegation.status}"
  },
  {
    "en": "Cannot reject delegation in status: ${delegation.status}",
    "pl": "Nie można odrzucić delegacji w statusie: ${delegation.status}"
  },
  {
    "en": "This delegation does not accept input",
    "pl": "Ta delegacja nie akceptuje danych wejściowych"
  },
  {
    "en": "Cannot make decision in status: ${decision.status}",
    "pl": "Nie można podjąć decyzji w statusie: ${decision.status}"
  },
  {
    "en": "Cannot escalate decision in status: ${decision.status}",
    "pl": "Nie można eskalować decyzji w statusie: ${decision.status}"
  },
  {
    "en": "Cannot cancel a decision in status: ${decision.status}",
    "pl": "Nie można anulować decyzji o statusie: ${decision.status}"
  },
  {
    "en": "Insert deck template returned no row",
    "pl": "Wstaw szablon talii nie zwrócił żadnego wiersza"
  },
  {
    "en": "Insert table template returned no row",
    "pl": "Wstaw szablon tabeli nie zwrócił żadnego wiersza"
  },
  {
    "en": "template provenance status update affected ${updated.rowCount} rows for ${registry}:${templateId}",
    "pl": "Aktualizacja statusu pochodzenia szablonu dotyczy ${updated.rowCount} wierszy dla ${registry}:${templateId}"
  },
  {
    "en": "global fetch unavailable (Node 18+ required)",
    "pl": "globalne pobieranie niedostępne (wymagany węzeł 18 lub nowszy)"
  },
  {
    "en": "${LOG_PREFIX} missing required param",
    "pl": "${LOG_PREFIX} brak wymaganego parametru"
  },
  {
    "en": "${LOG_PREFIX} draft not found: ${draftId}",
    "pl": "${LOG_PREFIX} nie znaleziono wersji roboczej: ${draftId}"
  },
  {
    "en": "[atelier-finance-seed] refusing to acknowledge a NEEDS_OPERATOR hold without a note: state what was found and why it is ",
    "pl": "[atelier-finance-seed] odmawia uznania blokady NEEDS_OPERATOR bez notatki: podaj, co zostało znalezione i dlaczego tak jest"
  },
  {
    "en": "the connection answered without current_database(); it is not PostgreSQL",
    "pl": "połączenie zostało odebrane bez current_database(); to nie jest PostgreSQL"
  },
  {
    "en": "the decisive read session has been closed",
    "pl": "decydująca sesja odczytu została zamknięta"
  },
  {
    "en": "refusing to lock a non-identifier table name: ${name}",
    "pl": "odmowa zablokowania nazwy tabeli niebędącej identyfikatorem: ${name}"
  },
  {
    "en": "[atelier-finance-seed] missing canonical line ${code}",
    "pl": "[atelier-finance-seed] brak linii kanonicznej ${code}"
  },
  {
    "en": "no promotion-owned column is readable on ${table}",
    "pl": "żadna kolumna należąca do promocji nie jest czytelna na ${table}"
  },
  {
    "en": "[atelierPresentationDeckSeed] materialization dropped cards for ${deckId}: ",
    "pl": "[atelierPresentationDeckSeed] upuszczone karty materializacji dla ${deckId}:"
  },
  {
    "en": "refusing to emit a non-finite number in rollback SQL: ${value}",
    "pl": "odmowa emisji nieskończonej liczby w wycofaniu SQL: ${value}"
  },
  {
    "en": "refusing to emit a NUL byte in rollback SQL",
    "pl": "odmawiając wyemitowania bajtu NUL w wycofaniu SQL"
  },
  {
    "en": "[atelierPresentationDeckSeed] refusing to build rollback SQL from an incomplete backup: ",
    "pl": "[atelierPresentationDeckSeed] odmawia zbudowania wycofania SQL z niekompletnej kopii zapasowej:"
  },
  {
    "en": "Invalid demo anchor date: ${String(anchorDate)}",
    "pl": "Nieprawidłowa data zakotwiczenia wersji demonstracyjnej: ${String(anchorDate)}"
  },
  {
    "en": "Unsupported relative date spec: ${spec}",
    "pl": "Nieobsługiwana specyfikacja daty względnej: ${spec}"
  },
  {
    "en": "membership row missing after insert",
    "pl": "Brak wiersza członkostwa po wstawieniu"
  }
];
