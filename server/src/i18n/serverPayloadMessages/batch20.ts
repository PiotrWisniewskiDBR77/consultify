import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_20: readonly ServerPayloadMessage[] = [
  {
    "en": "token generation failed",
    "pl": "wygenerowanie tokenu nie powiodło się"
  },
  {
    "en": "projectDocumentForAudience: schema is required",
    "pl": "ProjectDocumentForAudience: schemat jest wymagany"
  },
  {
    "en": "projectDocumentForAudience: profile is required",
    "pl": "ProjectDocumentForAudience: profil jest wymagany"
  },
  {
    "en": "napi createCanvas unavailable",
    "pl": "napi createCanvas niedostępne"
  },
  {
    "en": "organizationId is required",
    "pl": "identyfikator organizacji jest wymagany"
  },
  {
    "en": "artifactId is required",
    "pl": "identyfikator artefaktu jest wymagany"
  },
  {
    "en": "userId is required",
    "pl": "identyfikator użytkownika jest wymagany"
  },
  {
    "en": "unsupported share-link accessScope: ${params.accessScope}",
    "pl": "nieobsługiwany dostęp do łącza udostępnianiaZakres: ${params.accessScope}"
  },
  {
    "en": "expiresAt must be a valid ISO-8601 timestamp",
    "pl": "wygasaAt musi być prawidłowym znacznikiem czasu ISO-8601"
  },
  {
    "en": "expiresAt must be in the future",
    "pl": "wygasa At musi nastąpić w przyszłości"
  },
  {
    "en": "shareLinkId is required",
    "pl": "shareLinkId jest wymagany"
  },
  {
    "en": "source pack name is required",
    "pl": "wymagana jest nazwa pakietu źródłowego"
  },
  {
    "en": "source pack language must be pl or en",
    "pl": "Językiem pakietu źródłowego musi być pl lub en"
  },
  {
    "en": "source pack item title is required",
    "pl": "tytuł elementu pakietu źródłowego jest wymagany"
  },
  {
    "en": "unsupported source pack item type: ${params.item.itemType}",
    "pl": "nieobsługiwany typ elementu pakietu źródłowego: ${params.item.itemType}"
  },
  {
    "en": "source pack item must declare a sourceRef with sourceId",
    "pl": "element pakietu źródłowego musi zadeklarować sourceRef z identyfikatorem źródła"
  },
  {
    "en": "Document intake requires a description string.",
    "pl": "Przyjmowanie dokumentów wymaga ciągu opisu."
  },
  {
    "en": "Document intake description must not be empty.",
    "pl": "Opis przyjęcia dokumentu nie może być pusty."
  },
  {
    "en": "Failed to persist document artifact (wave5_artifacts write did not succeed)",
    "pl": "Nie udało się utrwalić artefaktu dokumentu (zapis wave5_artifacts nie powiódł się)"
  },
  {
    "en": "Failed to persist document evidence envelope",
    "pl": "Nie udało się zachować koperty na dowód dokumentu"
  },
  {
    "en": "Document artifact not found",
    "pl": "Nie znaleziono artefaktu dokumentu"
  },
  {
    "en": "Document schema not found on artifact",
    "pl": "Nie znaleziono schematu dokumentu w artefakcie"
  },
  {
    "en": "instruction is required",
    "pl": "wymagana jest instrukcja"
  },
  {
    "en": "template purpose is required",
    "pl": "wymagany jest cel szablonu"
  },
  {
    "en": "template purpose must not be empty",
    "pl": "Cel szablonu nie może być pusty"
  },
  {
    "en": "source document schema is required",
    "pl": "wymagany jest schemat dokumentu źródłowego"
  },
  {
    "en": "schema is required",
    "pl": "schemat jest wymagany"
  },
  {
    "en": "Unknown driver op: ${String(_never)}",
    "pl": "Nieznany sterownik: ${String(_never)}"
  },
  {
    "en": "No Stripe customer linked",
    "pl": "Żaden klient Stripe nie jest powiązany"
  },
  {
    "en": "No open invoices to retry",
    "pl": "Brak otwartych faktur, które można ponowić"
  },
  {
    "en": "ENCRYPTION_SALT environment variable required in production",
    "pl": "ENCRYPTION_SALT zmienna środowiskowa wymagana w środowisku produkcyjnym"
  },
  {
    "en": "No encryption key available",
    "pl": "Brak dostępnego klucza szyfrowania"
  },
  {
    "en": "Encryption failed",
    "pl": "Szyfrowanie nie powiodło się"
  },
  {
    "en": "Invalid encrypted format",
    "pl": "Nieprawidłowy zaszyfrowany format"
  },
  {
    "en": "Encryption key version ${version} not found",
    "pl": "Nie znaleziono wersji klucza szyfrowania ${version}"
  },
  {
    "en": "Decryption failed: ${error.message}",
    "pl": "Odszyfrowanie nie powiodło się: ${error.message}"
  },
  {
    "en": "Deterministic encryption failed",
    "pl": "Szyfrowanie deterministyczne nie powiodło się"
  },
  {
    "en": "Data residency region is locked and cannot be changed",
    "pl": "Region przechowywania danych jest zablokowany i nie można go zmienić"
  },
  {
    "en": "Execution work analysis ${id} was not persisted",
    "pl": "Analiza pracy wykonawczej ${id} nie została utrwalona"
  },
  {
    "en": "execution_legacy_writer_retired:${canonical.rows[0].link_id}",
    "pl": "execution_legacy_writer_retired:${canonical.rows[0].link_id}"
  },
  {
    "en": "[Execution:Realization] Insert for ${id} succeeded but could not be read back",
    "pl": "[Wykonanie:Realizacja] Wstawienie ${id} powiodło się, ale nie można było go ponownie odczytać"
  },
  {
    "en": "User already voted",
    "pl": "Użytkownik już głosował"
  },
  {
    "en": "finance_analysis_definitions insert returned no row",
    "pl": "Wkładka finance_analysis_definitions nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_artifacts insert returned no row",
    "pl": "Wkładka finance_artifacts nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_business_versions insert returned no row",
    "pl": "Wkładka finance_business_versions nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_working_revisions insert returned no row",
    "pl": "Wkładka finance_working_revisions nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_compute_snapshots insert returned no row",
    "pl": "Wkładka finance_compute_snapshots nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_business_versions insert (reopen) returned no row",
    "pl": "finance_business_versions wstaw (otwórz ponownie) nie zwrócił żadnego wiersza"
  },
  {
    "en": "finance_working_revisions insert (reopen) returned no row",
    "pl": "finance_working_revisions wstaw (otwórz ponownie) nie zwrócił żadnego wiersza"
  },
  {
    "en": "baselineComputeService: missing assumption ${scheduleType}::${driverCode}",
    "pl": "baselineComputeService: brak założenia ${scheduleType}::${driverCode}"
  },
  {
    "en": "baselineComputeService: period ${periodId} not found or not a MONTH period",
    "pl": "baselineComputeService: nie znaleziono okresu ${periodId} albo okres nie ma typu MONTH"
  },
  {
    "en": "baselineComputeService: no PRIOR_YEAR_SAME_PERIOD REVENUE actual for ${priorYearKey} (period ${periodId})",
    "pl": "baselineComputeService: brak wartości rzeczywistej REVENUE dla PRIOR_YEAR_SAME_PERIOD ${priorYearKey} (okres ${periodId})"
  },
  {
    "en": "baselineComputeService: engine bug — BS does not balance for ${periodId}: assets=${totalAssets} liab+equity=${totalLiabi",
    "pl": "baselineComputeService: błąd silnika — BS nie bilansuje dla ${periodId}: aktywa=${totalAssets} liab+equity=${totalLiabi"
  },
  {
    "en": "baselineComputeService: canonical line ${code} not found in financial_statement_lines",
    "pl": "baselineComputeService: nie znaleziono linii kanonicznej ${code} w financial_statement_lines"
  },
  {
    "en": "finance_baseline_assumptions upsert returned no row",
    "pl": "Upsert finance_baseline_assumptions nie zwrócił żadnego wiersza"
  },
  {
    "en": "computeCapexDepreciation: usefulLifeMonths must be > 0",
    "pl": "computeCapexDepreciation: użyteczneMiesiące życia muszą być > 0"
  },
  {
    "en": "lookupScheduledAmortization: periodIndex must be >= 0",
    "pl": "lookupScheduledAmortization: periodIndex musi wynosić >= 0"
  },
  {
    "en": "finance_comments insert returned no row",
    "pl": "Wkładka finance_comments nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_comments resolve update returned no row",
    "pl": "finance_comments rozwiązanie aktualizacji nie zwróciło żadnego wiersza"
  },
  {
    "en": "finance_comments reopen update returned no row",
    "pl": "finance_comments ponowne otwarcie aktualizacji nie zwróciło żadnego wiersza"
  }
];
