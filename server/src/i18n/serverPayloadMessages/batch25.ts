import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_25: readonly ServerPayloadMessage[] = [
  {
    "en": "Participant ledger cold readback failed",
    "pl": "Zimny ​​odczyt księgi uczestników nie powiódł się"
  },
  {
    "en": "Partner organization not found: ${partnerOrgId}",
    "pl": "Nie znaleziono organizacji partnerskiej: ${partnerOrgId}"
  },
  {
    "en": "Failed to persist referral identity for partner organization: ${partnerOrgId}",
    "pl": "Nie udało się zachować tożsamości polecającej dla organizacji partnerskiej: ${partnerOrgId}"
  },
  {
    "en": "Attribution already exists for this organization",
    "pl": "Dla tej organizacji istnieje już atrybucja"
  },
  {
    "en": "PayAsYouGoService dependencies not initialized",
    "pl": "Nie zainicjowano zależności PayAsYouGoService"
  },
  {
    "en": "Invalid usage type: ${usageType}",
    "pl": "Nieprawidłowy typ użycia: ${usageType}"
  },
  {
    "en": "Unknown usage type: ${usageType}",
    "pl": "Nieznany typ użycia: ${usageType}"
  },
  {
    "en": "Failed to extract PDF text: ${(err as Error)?.message || String(err)}",
    "pl": "Nie udało się wyodrębnić tekstu PDF: ${(err as Error)?.message || String(err)}"
  },
  {
    "en": "Failed to extract text from PDF: ${fileName}",
    "pl": "Nie udało się wyodrębnić tekstu z pliku PDF: ${fileName}"
  },
  {
    "en": "Permission not found: ${permissionKey}",
    "pl": "Nie znaleziono pozwolenia: ${permissionKey}"
  },
  {
    "en": "contentId, contentType, userId, and permissionKey are required",
    "pl": "wymagane są contentId, contentType, userId i pozwolenieKey"
  },
  {
    "en": "title is required",
    "pl": "tytuł jest wymagany"
  },
  {
    "en": "createPersonalTask: row ${id} not found immediately after insert",
    "pl": "createPersonalTask: wiersz ${id} nie został znaleziony natychmiast po wstawieniu"
  },
  {
    "en": "Invalid slide index",
    "pl": "Nieprawidłowy indeks slajdów"
  },
  {
    "en": "Invalid project role: ${projectRole}",
    "pl": "Nieprawidłowa rola w projekcie: ${projectRole}"
  },
  {
    "en": "User is already a member of this project",
    "pl": "Użytkownik jest już członkiem tego projektu"
  },
  {
    "en": "Member not found in project",
    "pl": "Nie znaleziono elementu w projekcie"
  },
  {
    "en": "Invalid project role: ${String(value)}",
    "pl": "Nieprawidłowa rola w projekcie: ${String(value)}"
  },
  {
    "en": "Code, type, and validFrom are required",
    "pl": "Kod, typ i validFrom są wymagane"
  },
  {
    "en": "Invalid promo type: ${type}",
    "pl": "Nieprawidłowy typ promocji: ${type}"
  },
  {
    "en": "Invalid discount type: ${discountType}",
    "pl": "Nieprawidłowy typ rabatu: ${discountType}"
  },
  {
    "en": "Assessment already completed",
    "pl": "Ocena już zakończona"
  },
  {
    "en": "Ingestion pipeline does not support process()",
    "pl": "Potok pozyskiwania nie obsługuje procesu()"
  },
  {
    "en": "Statement must be statement-ready before ratio computation",
    "pl": "Instrukcja musi być gotowa do użycia przed obliczeniem współczynnika"
  },
  {
    "en": "RELEASE_TARGET_DB_HOST_FINGERPRINT is required. Set it to a distinctive substring of the ",
    "pl": "Wymagany jest RELEASE_TARGET_DB_HOST_FINGERPRINT. Ustaw go na charakterystyczny podciąg"
  },
  {
    "en": "Target mismatch: resolved database host does not contain the expected fingerprint ",
    "pl": "Niezgodność celu: rozwiązany host bazy danych nie zawiera oczekiwanego odcisku palca"
  },
  {
    "en": "accepted DRD report requires a DRD MethodSession",
    "pl": "zaakceptowany raport DRD wymaga sesji metody DRD"
  },
  {
    "en": "accepted DRD report requires ${DRD_STRUCTURE.length} axes",
    "pl": "zaakceptowany raport DRD wymaga osi ${DRD_STRUCTURE.length}"
  },
  {
    "en": "missing report content for DRD axis ${axis.id}",
    "pl": "brak treści raportu dla osi DRD ${axis.id}"
  },
  {
    "en": "report metadata save refused: session not found in organization",
    "pl": "Odmowa zapisania metadanych raportu: w organizacji nie znaleziono sesji"
  },
  {
    "en": "report_definition not found: ${defId}",
    "pl": "report_definition nie znaleziono: ${defId}"
  },
  {
    "en": "Failed to create comment",
    "pl": "Nie udało się utworzyć komentarza"
  },
  {
    "en": "Assessment is not approved",
    "pl": "Ocena nie została zatwierdzona"
  },
  {
    "en": "Financial model not found",
    "pl": "Nie znaleziono modelu finansowego"
  },
  {
    "en": "Financial analysis not found",
    "pl": "Nie znaleziono analizy finansowej"
  },
  {
    "en": "Template source type mismatch",
    "pl": "Niezgodność typu źródła szablonu"
  },
  {
    "en": "Template report type mismatch",
    "pl": "Niezgodny typ raportu szablonu"
  },
  {
    "en": "No template found for this source type",
    "pl": "Nie znaleziono szablonu dla tego typu źródła"
  },
  {
    "en": "Missing sourceId for template generation (assessmentId/projectId required)",
    "pl": "Brak identyfikatora źródła do wygenerowania szablonu (wymagany identyfikator oceny/projektu)"
  },
  {
    "en": "Block type not found",
    "pl": "Nie znaleziono typu bloku"
  },
  {
    "en": "System block types cannot be modified",
    "pl": "Typów bloków systemowych nie można modyfikować"
  },
  {
    "en": "System block types cannot be deactivated",
    "pl": "Typów bloków systemowych nie można dezaktywować"
  },
  {
    "en": "Cannot remove required section",
    "pl": "Nie można usunąć wymaganej sekcji"
  },
  {
    "en": "Report ${reportId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono raportu ${reportId} w organizacji ${organizationId}"
  },
  {
    "en": "Section not found",
    "pl": "Nie znaleziono sekcji"
  },
  {
    "en": "Source data not found",
    "pl": "Nie znaleziono danych źródłowych"
  },
  {
    "en": "Source file not found",
    "pl": "Nie znaleziono pliku źródłowego"
  },
  {
    "en": "Import has not been processed yet. Call /detect first.",
    "pl": "Import nie został jeszcze przetworzony. Najpierw zadzwoń/wykryj."
  },
  {
    "en": "Assessment already created: ${importRecord.targetId}",
    "pl": "Ocena już utworzona: ${importRecord.targetId}"
  },
  {
    "en": "No initiatives found in the imported report.",
    "pl": "W zaimportowanym raporcie nie znaleziono żadnych inicjatyw."
  },
  {
    "en": "Import is not ready for confirmation. Status: ${importRecord.status}",
    "pl": "Import nie jest gotowy do potwierdzenia. Stan: ${importRecord.status}"
  },
  {
    "en": "No extracted data available",
    "pl": "Brak dostępnych wyodrębnionych danych"
  },
  {
    "en": "Import not found",
    "pl": "Nie znaleziono importu"
  },
  {
    "en": "Research session requires organizationId and userId",
    "pl": "Sesja badawcza wymaga identyfikatora organizacji i identyfikatora użytkownika"
  },
  {
    "en": "Research session was created but could not be read back",
    "pl": "Sesja badawcza została utworzona, ale nie można jej ponownie odczytać"
  },
  {
    "en": "Research session not found",
    "pl": "Nie znaleziono sesji badawczej"
  },
  {
    "en": "Research session is ${session.status}, not approved/runnable",
    "pl": "Sesja badawcza to ${session.status}, niezatwierdzona/niemożliwa do uruchomienia"
  },
  {
    "en": "Research session is already running",
    "pl": "Sesja badawcza już trwa"
  },
  {
    "en": "createDefinition: organizationId is required",
    "pl": "createDefinition: identyfikator organizacji jest wymagany"
  },
  {
    "en": "createDefinition: name is required",
    "pl": "createDefinition: nazwa jest wymagana"
  }
];
