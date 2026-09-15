import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_23: readonly ServerPayloadMessage[] = [
  {
    "en": "organizationId is required to duplicate an initiative",
    "pl": "Identyfikator organizacji jest wymagany do zduplikowania inicjatywy"
  },
  {
    "en": "organizationId is required to create an initiative",
    "pl": "do utworzenia inicjatywy wymagany jest identyfikator organizacji"
  },
  {
    "en": "Execution Bank evidence requires a valid controlled asOf",
    "pl": "Dowód banku wykonania wymaga ważnego kontrolowanego stanu na dzień"
  },
  {
    "en": "organizationId is required to create a candidate",
    "pl": "do utworzenia kandydata wymagany jest identyfikator organizacji"
  },
  {
    "en": "sourceType and sourceId are required to create a candidate",
    "pl": "Do utworzenia kandydata wymagane są sourceType i sourceId"
  },
  {
    "en": "title is required to create a candidate",
    "pl": "Aby stworzyć kandydata, wymagany jest tytuł"
  },
  {
    "en": "Candidate insert did not return a row",
    "pl": "Wkładka kandydata nie zwróciła wiersza"
  },
  {
    "en": "Closure evidence fault injection is test-only",
    "pl": "Wstrzykiwanie błędów potwierdzających zamknięcie ma charakter wyłącznie testowy"
  },
  {
    "en": "${LOG_PREFIX} organizationId required",
    "pl": "Wymagany identyfikator organizacji ${LOG_PREFIX}"
  },
  {
    "en": "${LOG_PREFIX} ${TABLE} table missing — run the gate-ai migration first.",
    "pl": "Brakuje tabeli ${LOG_PREFIX} ${TABLE} — najpierw przeprowadź migrację Gate-Ai."
  },
  {
    "en": "KPI not found",
    "pl": "Nie znaleziono KPI"
  },
  {
    "en": "KPI name is required",
    "pl": "Nazwa KPI jest wymagana"
  },
  {
    "en": "Failed to create section type",
    "pl": "Nie udało się utworzyć typu sekcji"
  },
  {
    "en": "Section type not found",
    "pl": "Nie znaleziono typu sekcji"
  },
  {
    "en": "Cannot modify system section types",
    "pl": "Nie można modyfikować typów sekcji systemu"
  },
  {
    "en": "Failed to update section type",
    "pl": "Nie udało się zaktualizować typu sekcji"
  },
  {
    "en": "Cannot delete system section types",
    "pl": "Nie można usunąć typów sekcji systemowych"
  },
  {
    "en": "Source section type not found",
    "pl": "Nie znaleziono typu sekcji źródłowej"
  },
  {
    "en": "Template not found",
    "pl": "Nie znaleziono szablonu"
  },
  {
    "en": "Failed to create source basket",
    "pl": "Nie udało się utworzyć koszyka źródłowego"
  },
  {
    "en": "Unknown connector: ${connectorId}",
    "pl": "Nieznane złącze: ${connectorId}"
  },
  {
    "en": "Missing required field: ${field}",
    "pl": "Brak wymaganego pola: ${field}"
  },
  {
    "en": "Integration not found",
    "pl": "Nie znaleziono integracji"
  },
  {
    "en": "Slack webhook failed (HTTP ${response.status})",
    "pl": "Błąd webhooka Slack (HTTP ${response.status})"
  },
  {
    "en": "Teams webhook failed (HTTP ${response.status})",
    "pl": "Element webhook aplikacji Teams nie powiódł się (HTTP ${response.status})"
  },
  {
    "en": "Jira create issue failed (HTTP ${res.status})",
    "pl": "Problem z utworzeniem Jira nie powiódł się (HTTP ${res.status})"
  },
  {
    "en": "Jira create issue returned invalid response",
    "pl": "Problem z utworzeniem Jira zwrócił nieprawidłową odpowiedź"
  },
  {
    "en": "Jira update issue requires issueIdOrKey",
    "pl": "Problem z aktualizacją Jira wymaga IssueIdOrKey"
  },
  {
    "en": "Jira update issue failed (HTTP ${res.status})",
    "pl": "Problem z aktualizacją Jira nie powiódł się (HTTP ${res.status})"
  },
  {
    "en": "No session IDs provided for inference",
    "pl": "Nie podano identyfikatorów sesji na potrzeby wnioskowania"
  },
  {
    "en": "${label} must be a non-empty string",
    "pl": "${label} musi być niepustym ciągiem znaków"
  },
  {
    "en": "${label} must be a string or null",
    "pl": "${label} musi być ciągiem znaków lub mieć wartość null"
  },
  {
    "en": "${label} must be a valid timestamp",
    "pl": "${label} musi być prawidłowym znacznikiem czasu"
  },
  {
    "en": "${label} must be an ISO timestamp with an explicit timezone",
    "pl": "${label} musi być znacznikiem czasu ISO z wyraźną strefą czasową"
  },
  {
    "en": "${path} must contain only finite JSON numbers",
    "pl": "${path} może zawierać tylko skończone liczby JSON"
  },
  {
    "en": "${path} must contain only JSON-safe values",
    "pl": "${path} może zawierać tylko wartości bezpieczne w formacie JSON"
  },
  {
    "en": "${path} must contain only plain JSON objects",
    "pl": "${path} może zawierać tylko zwykłe obiekty JSON"
  },
  {
    "en": "generationContextJson must be a string",
    "pl": "GenerationContextJson musi być ciągiem"
  },
  {
    "en": "${label} must be persisted JSON text",
    "pl": "${label} musi być utrwalonym tekstem JSON"
  },
  {
    "en": "${label} must contain valid JSON",
    "pl": "${label} musi zawierać prawidłowy kod JSON"
  },
  {
    "en": "pointer identity must match its Finding",
    "pl": "tożsamość wskaźnika musi odpowiadać jego wynikowi"
  },
  {
    "en": "duplicate pointer id: ${pointer.id}",
    "pl": "zduplikowany identyfikator wskaźnika: ${pointer.id}"
  },
  {
    "en": "duplicate pointer source_ref/source_fingerprint identity",
    "pl": "zduplikowany wskaźnik source_ref/source_fingerprint tożsamość"
  },
  {
    "en": "finding.source_section_index must be an integer or null",
    "pl": "wynik.source_section_index musi być liczbą całkowitą lub wartością null"
  },
  {
    "en": "pointer.duplicate_observed_count must be a non-negative integer",
    "pl": "wskaźnik.duplicate_observed_count musi być nieujemną liczbą całkowitą"
  },
  {
    "en": "generation context must contain valid JSON",
    "pl": "kontekst generacji musi zawierać prawidłowy kod JSON"
  },
  {
    "en": "generation context must contain a completed v1 run",
    "pl": "kontekst generacji musi zawierać ukończony przebieg w wersji 1"
  },
  {
    "en": "generation run timestamps are inconsistent",
    "pl": "znaczniki czasu przebiegu generacji są niespójne"
  },
  {
    "en": "receipt identity must match its Finding",
    "pl": "tożsamość paragonu musi odpowiadać jego ustaleniom"
  },
  {
    "en": "receipt run identity must match the persisted generation context",
    "pl": "Tożsamość przebiegu paragonu musi odpowiadać kontekstowi utrwalonego generowania"
  },
  {
    "en": "Finding cannot predate generation completion",
    "pl": "Wynik nie może być wcześniejszy niż zakończenie generowania"
  },
  {
    "en": "Missing required invitation capability",
    "pl": "Brakuje wymaganej funkcji zapraszania"
  },
  {
    "en": "Invalid email format",
    "pl": "Nieprawidłowy format wiadomości e-mail"
  },
  {
    "en": "A pending invitation already exists for this email",
    "pl": "Dla tego e-maila istnieje już oczekujące zaproszenie"
  },
  {
    "en": "No available seats. Please purchase additional seats or contact your administrator.",
    "pl": "Brak dostępnych miejsc. Kup dodatkowe stanowiska lub skontaktuj się z administratorem."
  },
  {
    "en": "Project not found in this organization",
    "pl": "Nie znaleziono projektu w tej organizacji"
  },
  {
    "en": "Job title and work location are required to complete your first login.",
    "pl": "Aby ukończyć pierwsze logowanie, wymagane jest stanowisko i lokalizacja pracy."
  },
  {
    "en": "Email address does not match invitation. Please use the email address the invitation was sent to.",
    "pl": "Adres e-mail nie pasuje do zaproszenia. Użyj adresu e-mail, na który wysłano zaproszenie."
  },
  {
    "en": "You are already a member of this organization",
    "pl": "Jesteś już członkiem tej organizacji"
  },
  {
    "en": "User with this email already exists. Multi-organization support is not yet available.",
    "pl": "Użytkownik o tym adresie e-mail już istnieje. Obsługa wielu organizacji nie jest jeszcze dostępna."
  }
];
