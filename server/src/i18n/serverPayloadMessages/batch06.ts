import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_06: readonly ServerPayloadMessage[] = [
  {
    "en": "Invalid section id: ${sectionId}",
    "pl": "Nieprawidłowe ID sekcji: ${sectionId}"
  },
  {
    "en": "Invalid stakeholder role. Valid: CTO, CFO, COO, CEO, BOARD",
    "pl": "Nieprawidłowa rola interesariusza. Prawidłowe: CTO, CFO, COO, CEO, BOARD"
  },
  {
    "en": "Invalid status transition: ${currentStatus} → ${nextStatus}",
    "pl": "Nieprawidłowa transakcja statusu: ${currentStatus} → ${nextStatus}"
  },
  {
    "en": "Invalid token",
    "pl": "Nieprawidłowy token"
  },
  {
    "en": "Invalid value for section ${sectionId} — expected string, { content } or null",
    "pl": "Nieprawidłowa wartość dla sekcji ${sectionId} — oczekiwano string, { content } lub null"
  },
  {
    "en": "Invalid verification code",
    "pl": "Nieprawidłowy kod weryfikacyjny"
  },
  {
    "en": "Invalid workbook mutation",
    "pl": "Nieprawidłowa mutacja zeszytu"
  },
  {
    "en": "Invoice ${invoice.invoice_number} from Consultify",
    "pl": "Faktura ${invoice.invoice_number} od Consultify"
  },
  {
    "en": "Job ${params.jobId} already has a committed output",
    "pl": "Zadanie ${params.jobId} już ma zatwierdzony wynik"
  },
  {
    "en": "Job ${params.jobId} has no authoritative input-to-output lineage binding",
    "pl": "Zadanie ${params.jobId} nie ma wiążącego powiązania wejścia do wyjścia"
  },
  {
    "en": "Job ${params.jobId} input artifact does not match the caller pin",
    "pl": "Artefakt wejściowy zadania ${params.jobId} nie pasuje do pinu wywołującego"
  },
  {
    "en": "Job ${params.jobId} is not running",
    "pl": "Zadanie ${params.jobId} nie jest uruchomione"
  },
  {
    "en": "Job ${params.jobId} lease is no longer held by worker ${params.workerId} (reaped, cancelled, completed, or never claimed by this worker)",
    "pl": "Wynajem zadania ${params.jobId} nie jest już trzymany przez worker ${params.workerId} (usunięte, anulowane, zakończone lub nigdy nieodebrane przez tego workera)"
  },
  {
    "en": "Job ${params.jobId} no longer owns the current pinned working revision",
    "pl": "Zadanie ${params.jobId} już nie posiada aktualnej zapisanej wersji roboczej"
  },
  {
    "en": "Job ${params.jobId} succeeded with a different authoritative output tuple",
    "pl": "Zadanie ${params.jobId} zakończyło się sukcesem z innym autorytatywnym krotką wynikową"
  },
  {
    "en": "Job queued for retry",
    "pl": "Zadanie w kolejce do ponownej próby"
  },
  {
    "en": "Justification should be at least 20 characters for meaningful assessment",
    "pl": "Uzaszczenie powinno mieć co najmniej 20 znaków dla znaczącego oszacowania"
  },
  {
    "en": "LLM prose generation partially failed; some sections retained deterministic placeholders.",
    "pl": "Generacja tekstu LLM częściowo się nie powiodła; niektóre sekcje zachowały deterministyczne symbole zastępcze."
  },
  {
    "en": "LLM prose response matched no document blocks; deterministic placeholders retained.",
    "pl": "Odpowiedź LLM nie pasowała do żadnych bloków dokumentu; zachowano deterministyczne symbole zastępcze."
  },
  {
    "en": "Label is required",
    "pl": "Etykieta jest wymagana"
  },
  {
    "en": "Latest version is sent (locked) — cannot rollback",
    "pl": "Najnowsza wersja została wysłana (zablokowana) — nie można cofnąć"
  },
  {
    "en": "Legacy execution signal adapter failed: ${\n              error instanceof Error ? error.message : String(error)\n            }",
    "pl": "Starszy adapter sygnału realizacji nie zadziałał: ${\n              error instanceof Error ? error.message : String(error)\n            }"
  },
  {
    "en": "Legacy writer intent could not be registered",
    "pl": "Nie można zarejestrować intencji starszego pisarza"
  },
  {
    "en": "Link has been revoked",
    "pl": "Link został unieważniony"
  },
  {
    "en": "Link has expired",
    "pl": "Link wygasł"
  },
  {
    "en": "Link not found or expired",
    "pl": "Link nie znaleziony lub wygasł"
  },
  {
    "en": "MIME type not allowed: ${file.mimetype}",
    "pl": "Typ MIME niedozwolony: ${file.mimetype}"
  },
  {
    "en": "Malformed presentation JSON",
    "pl": "Nieprawidłowy JSON prezentacji"
  },
  {
    "en": "Malformed report section content",
    "pl": "Nieprawidłowa zawartość sekcji raportu"
  },
  {
    "en": "Manual contract updated for ${org.name || input.organizationId}",
    "pl": "Kontrakt ręczny zaktualizowany dla ${org.name || input.organizationId}"
  },
  {
    "en": "Material is sent (locked) — no further transitions",
    "pl": "Materiał został wysłany (zablokowany) — brak dalszych przejść"
  },
  {
    "en": "Message not found",
    "pl": "Wiadomość nie znaleziona"
  },
  {
    "en": "Mindmap storage is not available",
    "pl": "Magazyn map myśli jest niedostępny"
  },
  {
    "en": "Missing assessment data (answers_json) for generation",
    "pl": "Brak danych oceny (answers_json) do generacji"
  },
  {
    "en": "Missing branch_rules",
    "pl": "Brak branch_rules"
  },
  {
    "en": "Missing taskId or field",
    "pl": "Brak taskId lub pola"
  },
  {
    "en": "Missing taskId or priority",
    "pl": "Brak taskId lub priorytetu"
  },
  {
    "en": "Missing taskId or status",
    "pl": "Brak taskId lub statusu"
  },
  {
    "en": "Missing taskId or userId",
    "pl": "Brak taskId lub userId"
  },
  {
    "en": "Missing webhookUrl",
    "pl": "Brak webhookUrl"
  },
  {
    "en": "Mitigation plan created and started.",
    "pl": "Plan zniżkowy utworzony i uruchomiony."
  },
  {
    "en": "Model has failing validations. Fix issues before approving.",
    "pl": "Model ma nieprzechodzące walidacje. Napraw problemy przed zatwierdzeniem."
  },
  {
    "en": "Model not found",
    "pl": "Model nie znaleziony"
  },
  {
    "en": "Most slides are missing exporter-safe header/footer metadata.",
    "pl": "Większość slajdów nie ma metadanych nagłówka/stopki bezpiecznych dla eksportera."
  },
  {
    "en": "Net change in cash derived: ${derived.toFixed(2)}",
    "pl": "Netto zmiana w gotówce wynikająca z: ${derived.toFixed(2)}"
  },
  {
    "en": "Net income magnitude looks disproportionate to revenue.",
    "pl": "Wielkość netto przychodu wygląda nieproporcjonalnie do przychodu."
  },
  {
    "en": "Net margin ${margin.toFixed(1)}% — implausible",
    "pl": "Netto marża ${margin.toFixed(1)}% — niemożliwa"
  },
  {
    "en": "Net margin: ${margin.toFixed(1)}%",
    "pl": "Marża netto: ${margin.toFixed(1)}%"
  },
  {
    "en": "New parent not found",
    "pl": "Nie znaleziono nowego rodzica"
  },
  {
    "en": "No AI providers configured (set at least one provider API key)",
    "pl": "Brak skonfigurowanych dostawców AI (ustaw co najmniej jeden klucz API dostawcy)"
  },
  {
    "en": "No Active LLM Providers found.",
    "pl": "Nie znaleziono aktywnych dostawców LLM."
  },
  {
    "en": "No Brand Kit configured. Set up your brand colors, logo, and fonts for professional consistency.",
    "pl": "Brak skonfigurowanego zestawu marki. Skonfiguruj kolory marki, logo i czcionki dla spójności profesjonalnej."
  },
  {
    "en": "No Google access token configured",
    "pl": "Nie skonfigurowano tokenu dostępu do Google"
  },
  {
    "en": "No MODEL_TO_SCENARIO lineage edge targets business_version_id ${params.businessVersionId}",
    "pl": "Brak docelowego elementu linii MODEL_TO_SCENARIO dla business_version_id ${params.businessVersionId}"
  },
  {
    "en": "No MODEL_TO_VALUATION/SCENARIO_TO_VALUATION lineage edge targets business_version_id ${valuationBusinessVersionId}",
    "pl": "Brak docelowego elementu linii MODEL_TO_VALUATION/SCENARIO_TO_VALUATION dla business_version_id ${valuationBusinessVersionId}"
  },
  {
    "en": "No STATEMENT_TO_ANALYSIS lineage edge targets business_version_id ${params.businessVersionId}",
    "pl": "Brak docelowego elementu linii STATEMENT_TO_ANALYSIS dla business_version_id ${params.businessVersionId}"
  },
  {
    "en": "No STATEMENT_TO_MODEL lineage edge targets business_version_id ${params.businessVersionId}",
    "pl": "Brak docelowego elementu linii STATEMENT_TO_MODEL dla business_version_id ${params.businessVersionId}"
  },
  {
    "en": "No Teams access token",
    "pl": "Brak tokenu dostępu do Teams"
  },
  {
    "en": "No Teams access token configured",
    "pl": "Nie skonfigurowano tokenu dostępu do Teams"
  },
  {
    "en": "No assessment data available.",
    "pl": "Brak dostępnych danych oceny."
  }
];
