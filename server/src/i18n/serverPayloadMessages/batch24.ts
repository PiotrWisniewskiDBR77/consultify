import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_24: readonly ServerPayloadMessage[] = [
  {
    "en": "Invitation has already been accepted or is no longer valid",
    "pl": "Zaproszenie zostało już przyjęte lub nie jest już ważne"
  },
  {
    "en": "Invitation not found",
    "pl": "Nie znaleziono zaproszenia"
  },
  {
    "en": "Cannot resend ${invitation.status} invitation",
    "pl": "Nie można ponownie wysłać zaproszenia ${invitation.status}"
  },
  {
    "en": "Maximum resend limit (${MAX_RESEND_COUNT}) reached. Please revoke and create a new invitation.",
    "pl": "Osiągnięto maksymalny limit ponownego wysyłania (${MAX_RESEND_COUNT}). Proszę odwołać i utworzyć nowe zaproszenie."
  },
  {
    "en": "Please wait ${waitMinutes} minute(s) before resending.",
    "pl": "Odczekaj ${waitMinutes} minut przed ponownym wysłaniem."
  },
  {
    "en": "Invitation is already ${invitation.status}",
    "pl": "Zaproszenie jest już ${invitation.status}"
  },
  {
    "en": "No file IDs provided",
    "pl": "Nie podano identyfikatorów plików"
  },
  {
    "en": "No files found for the provided IDs",
    "pl": "Nie znaleziono plików dla podanych identyfikatorów"
  },
  {
    "en": "lineage fault injection is test-only",
    "pl": "wstrzykiwanie błędów linii ma charakter wyłącznie testowy"
  },
  {
    "en": "injected operation-claim acquire fault",
    "pl": "wstrzyknięta operacja - zgłoś błąd nabycia"
  },
  {
    "en": "OpenAI did not return valid mapping JSON",
    "pl": "OpenAI nie zwróciło prawidłowego mapowania JSON"
  },
  {
    "en": "Anthropic (via OpenRouter) did not return valid mapping JSON",
    "pl": "Anthropic (przez OpenRouter) nie zwrócił prawidłowego mapowania JSON"
  },
  {
    "en": "Anthropic did not return valid mapping JSON",
    "pl": "Anthropic nie zwrócił prawidłowego JSON mapowania"
  },
  {
    "en": "Unsupported report type",
    "pl": "Nieobsługiwany typ raportu"
  },
  {
    "en": "projectId is required",
    "pl": "identyfikator projektu jest wymagany"
  },
  {
    "en": "Finalized reports cannot be edited",
    "pl": "Sfinalizowanych raportów nie można edytować"
  },
  {
    "en": "Version not found",
    "pl": "Nie znaleziono wersji"
  },
  {
    "en": "MAT_EXPORT_ENGINE_NOT_APPROVED:${providerKey}",
    "pl": "MAT_EXPORT_ENGINE_NOT_APPROVED:${providerKey}"
  },
  {
    "en": "Invalid provider config (baseUrl/mcpPath)",
    "pl": "Nieprawidłowa konfiguracja dostawcy (baseUrl/mcpPath)"
  },
  {
    "en": "Failed to create meeting",
    "pl": "Nie udało się utworzyć spotkania"
  },
  {
    "en": "Failed to read back meeting decision",
    "pl": "Nie udało się odczytać decyzji ze spotkania"
  },
  {
    "en": "Failed to read back meeting follow-up",
    "pl": "Nie udało się odczytać dalszych informacji o spotkaniu"
  },
  {
    "en": "Attachment filename is required",
    "pl": "Nazwa pliku załącznika jest wymagana"
  },
  {
    "en": "Attachment file is empty",
    "pl": "Plik załącznika jest pusty"
  },
  {
    "en": "Topic name required",
    "pl": "Wymagana nazwa tematu"
  },
  {
    "en": "Topic name produced empty slug",
    "pl": "Nazwa tematu spowodowała utworzenie pustego ślimaka"
  },
  {
    "en": "pageId and topicId required",
    "pl": "wymagane są pageId i topicId"
  },
  {
    "en": "pageId required",
    "pl": "wymagany identyfikator strony"
  },
  {
    "en": "Notifications table schema is incompatible (no insertable columns)",
    "pl": "Schemat tabeli powiadomień jest niezgodny (brak kolumn, które można wstawić)"
  },
  {
    "en": "Attachment insert returned no row",
    "pl": "Wkładka załącznika nie zwróciła żadnego wiersza"
  },
  {
    "en": "This step cannot be skipped",
    "pl": "Tego kroku nie można pominąć"
  },
  {
    "en": "Missing transformation context",
    "pl": "Brak kontekstu transformacji"
  },
  {
    "en": "LLM did not return valid JSON for full document analysis",
    "pl": "LLM nie zwrócił prawidłowego JSON do pełnej analizy dokumentu"
  },
  {
    "en": "LLM response did not contain valid document sections",
    "pl": "Odpowiedź LLM nie zawierała prawidłowych sekcji dokumentu"
  },
  {
    "en": "OpenAI did not return a valid extraction JSON payload",
    "pl": "OpenAI nie zwróciło prawidłowego ładunku JSON do wyodrębnienia"
  },
  {
    "en": "Anthropic did not return a valid extraction JSON payload",
    "pl": "Anthropic nie zwrócił prawidłowego ładunku JSON wyodrębniania"
  },
  {
    "en": "Operational alert reset is test-only",
    "pl": "Resetowanie alertu operacyjnego ma charakter wyłącznie testowy"
  },
  {
    "en": "IAM audit event was not persisted",
    "pl": "Zdarzenie audytu IAM nie zostało utrwalone"
  },
  {
    "en": "IAM role change was not persisted",
    "pl": "Zmiana roli IAM nie została utrwalona"
  },
  {
    "en": "IAM member removal was not persisted",
    "pl": "Nie kontynuowano usuwania członków IAM"
  },
  {
    "en": "IAM session revocation marker was not persisted",
    "pl": "Znacznik odwołania sesji IAM nie został utrwalony"
  },
  {
    "en": "[OrgContext] Failed to publish snapshot version for org ${organizationId} after ${MAX_ATTEMPTS} attempts (version conten",
    "pl": "[OrgContext] Nie udało się opublikować wersji migawki dla organizacji ${organizationId} po próbach ${MAX_ATTEMPTS} (zawartość wersji"
  },
  {
    "en": "Organization export table collides with reserved CSV manifest identity",
    "pl": "Tabela eksportu organizacji koliduje z zarezerwowaną tożsamością manifestu CSV"
  },
  {
    "en": "Invalid role",
    "pl": "Nieprawidłowa rola"
  },
  {
    "en": "Member not found",
    "pl": "Nie znaleziono członka"
  },
  {
    "en": "Failed to create sales certification",
    "pl": "Nie udało się utworzyć certyfikatu sprzedaży"
  },
  {
    "en": "Certification not found",
    "pl": "Nie znaleziono certyfikatu"
  },
  {
    "en": "status or progress required",
    "pl": "wymagany status lub postęp"
  },
  {
    "en": "Idempotency replay payload mismatch",
    "pl": "Niezgodność ładunku odtwarzania idempotencji"
  },
  {
    "en": "Idempotency request incomplete",
    "pl": "Żądanie idempotencji jest niekompletne"
  },
  {
    "en": "Module not found for certification",
    "pl": "Nie znaleziono modułu do certyfikacji"
  },
  {
    "en": "Certification blueprint not found",
    "pl": "Nie znaleziono planu certyfikacji"
  },
  {
    "en": "This certification uses operator review instead of an exam",
    "pl": "W tej certyfikacji zamiast egzaminu wykorzystuje się przegląd operatora"
  },
  {
    "en": "Complete the learning path before starting the exam",
    "pl": "Ukończ ścieżkę nauczania przed rozpoczęciem egzaminu"
  },
  {
    "en": "Certification already completed",
    "pl": "Certyfikacja już ukończona"
  },
  {
    "en": "Please wait ${Math.ceil(COOLDOWN_MINUTES - mins)} minutes before retrying",
    "pl": "Odczekaj ${Math.ceil(COOLDOWN_MINUTES - mins)} minut przed ponowną próbą"
  },
  {
    "en": "Question bank not configured",
    "pl": "Bank pytań nie jest skonfigurowany"
  },
  {
    "en": "Attempt not found",
    "pl": "Nie znaleziono próby"
  },
  {
    "en": "Attempt questions missing",
    "pl": "Brak pytań do próby"
  },
  {
    "en": "Rate must be between 0 and 100",
    "pl": "Szybkość musi mieścić się w przedziale od 0 do 100"
  }
];
