import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_16: readonly ServerPayloadMessage[] = [
  {
    "en": "OpenAI image download failed (${imgRes.status})",
    "pl": "Pobieranie obrazu OpenAI nie powiodło się (${imgRes.status})"
  },
  {
    "en": "OpenAI image generation returned no image data",
    "pl": "Generowanie obrazu OpenAI nie zwróciło żadnych danych obrazu"
  },
  {
    "en": "Replicate create failed (${created.status}): ${text.slice(0, 300)}",
    "pl": "Tworzenie repliki nie powiodło się (${created.status}): ${text.slice(0, 300)}"
  },
  {
    "en": "Replicate returned no prediction id",
    "pl": "Replikacja nie zwróciła żadnego identyfikatora przewidywania"
  },
  {
    "en": "Replicate poll failed (${res.status}): ${text.slice(0, 300)}",
    "pl": "Replikacja ankiety nie powiodła się (${res.status}): ${text.slice(0, 300)}"
  },
  {
    "en": "Replicate prediction timed out",
    "pl": "Przekroczono limit czasu przewidywania replikacji"
  },
  {
    "en": "Replicate image download failed (${imgRes.status})",
    "pl": "Pobieranie repliki obrazu nie powiodło się (${imgRes.status})"
  },
  {
    "en": "Gemini API key missing (GEMINI_API_KEY)",
    "pl": "Brak klucza API Gemini (GEMINI_API_KEY)"
  },
  {
    "en": "Gemini image generation failed (${res.status}): ${text.slice(0, 300)}",
    "pl": "Wygenerowanie obrazu Gemini nie powiodło się (${res.status}): ${text.slice(0, 300)}"
  },
  {
    "en": "Embedding API error: ${response.status}",
    "pl": "Błąd API osadzania: ${response.status}"
  },
  {
    "en": "Dataset not found",
    "pl": "Nie znaleziono zbioru danych"
  },
  {
    "en": "Eval run ${runId1} not found",
    "pl": "Nie znaleziono przebiegu ewaluacyjnego ${runId1}"
  },
  {
    "en": "Eval run ${runId2} not found",
    "pl": "Nie znaleziono przebiegu ewaluacyjnego ${runId2}"
  },
  {
    "en": "baseline_eval_id and candidate_eval_id are required to evaluate a release bundle",
    "pl": "Do oceny pakietu wersji wymagane są baseline_eval_id i candidate_eval_id"
  },
  {
    "en": "Evaluation run not found",
    "pl": "Nie znaleziono przebiegu próbnego"
  },
  {
    "en": "Release bundle cannot be published before passing eval gates",
    "pl": "Pakietu wersji nie można opublikować przed przejściem bramek eval"
  },
  {
    "en": "Prompt reference not found for key ${promptKey}",
    "pl": "Nie znaleziono odniesienia do monitu dla klucza ${promptKey}"
  },
  {
    "en": "Prompt version ${promptVersion} not found for ${promptKey}",
    "pl": "Nie znaleziono wersji monitu ${promptVersion} dla ${promptKey}"
  },
  {
    "en": "Policy version ${policyVersion} not found",
    "pl": "Nie znaleziono wersji zasad ${policyVersion}"
  },
  {
    "en": "Primary model ${primaryModelId} is not available in llm_providers",
    "pl": "Podstawowy model ${primaryModelId} nie jest dostępny w llm_providers"
  },
  {
    "en": "Unknown expert role: ${role}",
    "pl": "Nieznana rola eksperta: ${role}"
  },
  {
    "en": "No LLM client available",
    "pl": "Brak dostępnego klienta LLM"
  },
  {
    "en": "Unsupported file type: ${extension}",
    "pl": "Nieobsługiwany typ pliku: ${extension}"
  },
  {
    "en": "Unsupported initiative fill section: ${sectionKeyRaw}",
    "pl": "Sekcja wypełniania nieobsługiwanej inicjatywy: ${sectionKeyRaw}"
  },
  {
    "en": "Unsupported file type: ${ext}",
    "pl": "Nieobsługiwany typ pliku: ${ext}"
  },
  {
    "en": "xlsx library not available",
    "pl": "Biblioteka xlsx nie jest dostępna"
  },
  {
    "en": "Invalid tier",
    "pl": "Nieprawidłowy poziom"
  },
  {
    "en": "Unknown schema: ${schema}",
    "pl": "Nieznany schemat: ${schema}"
  },
  {
    "en": "Schema required for structured output",
    "pl": "Schemat wymagany w przypadku uporządkowanych wyników"
  },
  {
    "en": "Structured(text) parse failed for ${providerId}: non-JSON response",
    "pl": "Analiza struktury (tekstu) nie powiodła się dla ${providerId}: odpowiedź inna niż JSON"
  },
  {
    "en": "Failed to fetch created model",
    "pl": "Nie udało się pobrać utworzonego modelu"
  },
  {
    "en": "Model not found: ${id}",
    "pl": "Nie znaleziono modelu: ${id}"
  },
  {
    "en": "Failed to fetch updated model",
    "pl": "Nie udało się pobrać zaktualizowanego modelu"
  },
  {
    "en": "Failed to fetch created assignment",
    "pl": "Nie udało się pobrać utworzonego zadania"
  },
  {
    "en": "Assignment not found: ${id}",
    "pl": "Nie znaleziono zadania: ${id}"
  },
  {
    "en": "Purpose is required for model resolution",
    "pl": "Do rozdzielczości modelu wymagany jest cel"
  },
  {
    "en": "No active assignments found for purpose: ${purposeStr}",
    "pl": "Nie znaleziono aktywnych przypisań dla celu: ${purposeStr}"
  },
  {
    "en": "LLM services unavailable",
    "pl": "Usługi LLM niedostępne"
  },
  {
    "en": "Prompt not found for key: ${promptKey}",
    "pl": "Nie znaleziono monitu dla klucza: ${promptKey}"
  },
  {
    "en": "OpenAI client not available",
    "pl": "Klient OpenAI jest niedostępny"
  },
  {
    "en": "name is required",
    "pl": "imię i nazwisko jest wymagane"
  },
  {
    "en": "Invalid type",
    "pl": "Nieprawidłowy typ"
  },
  {
    "en": "Failed to create rule",
    "pl": "Nie udało się utworzyć reguły"
  },
  {
    "en": "Rule not found",
    "pl": "Nie znaleziono reguły"
  },
  {
    "en": "Failed to update rule",
    "pl": "Nie udało się zaktualizować reguły"
  },
  {
    "en": "DuckDuckGo search failed: HTTP ${resp.status} ${resp.statusText}",
    "pl": "Wyszukiwanie DuckDuckGo nie powiodło się: HTTP ${resp.status} ${resp.statusText}"
  },
  {
    "en": "Tavily search failed: HTTP ${resp.status} ${resp.statusText}",
    "pl": "Wyszukiwanie Tavily nie powiodło się: HTTP ${resp.status} ${resp.statusText}"
  },
  {
    "en": "Query execution failed: ${err?.message}",
    "pl": "Wykonanie zapytania nie powiodło się: ${err?.message}"
  },
  {
    "en": "Query contains forbidden SQL operations. Only SELECT queries are allowed.",
    "pl": "Zapytanie zawiera zabronione operacje SQL. Dozwolone są tylko zapytania SELECT."
  },
  {
    "en": "Only SELECT queries are allowed.",
    "pl": "Dozwolone są tylko zapytania SELECT."
  },
  {
    "en": "CREATE_DRAFT_DECISION: shared My Work decision writer refused ",
    "pl": "CREATE_DRAFT_DECISION: autor decyzji dotyczącej udostępnienia Mojej pracy odmówił"
  },
  {
    "en": "Failed to log AI interaction: ${result.error}",
    "pl": "Nie udało się zarejestrować interakcji AI: ${result.error}"
  },
  {
    "en": "Failed to record project memory: ${result.error}",
    "pl": "Nie udało się zapisać pamięci projektu: ${result.error}"
  },
  {
    "en": "Invalid policy level: ${policyLevel}",
    "pl": "Nieprawidłowy poziom zasad: ${policyLevel}"
  },
  {
    "en": "Risk not found",
    "pl": "Nie znaleziono zagrożenia"
  },
  {
    "en": "API key not found or not active",
    "pl": "Klucz API nie został znaleziony lub jest nieaktywny"
  },
  {
    "en": "Assignment created but could not be re-read",
    "pl": "Zadanie zostało utworzone, ale nie można go ponownie przeczytać"
  },
  {
    "en": "Failed to load recorded conversion",
    "pl": "Nie udało się załadować zarejestrowanej konwersji"
  },
  {
    "en": "originRuntime is required",
    "pl": "OriginRuntime jest wymagany"
  },
  {
    "en": "upsertActiveAssessmentInitiativeBatch: insert conflicted but no active batch found for assessment ${assessmentId}",
    "pl": "upsertActiveAssessmentInitiativeBatch: wstaw konflikt, ale nie znaleziono aktywnej partii do oceny ${assessmentId}"
  }
];
