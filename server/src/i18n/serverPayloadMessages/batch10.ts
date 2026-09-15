import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_10: readonly ServerPayloadMessage[] = [
  {
    "en": "Task not found or not in your organization",
    "pl": "Nie znaleziono zadania lub nie znajduje się ono w Twojej organizacji"
  },
  {
    "en": "Task reassigned to ${candidate.display_name || candidate.id}.",
    "pl": "Zadanie przypisane ponownie do ${candidate.display_name || candidate.id}."
  },
  {
    "en": "Task replanned to ${nextDueDate}.",
    "pl": "Zadanie przeplanowane na ${nextDueDate}."
  },
  {
    "en": "Task schedule smoothed to ${nextDueDate}.",
    "pl": "Harmonogram zadania wygładzony do ${nextDueDate}."
  },
  {
    "en": "Teams token expired — reauth required",
    "pl": "Token Teams wygasł — wymagane ponowne uwierzytelnienie"
  },
  {
    "en": "Template graph is not valid JSON",
    "pl": "Graf szablonu nie jest poprawnym JSON-em"
  },
  {
    "en": "Template is missing graph data",
    "pl": "Brakuje danych grafu w szablonie"
  },
  {
    "en": "Template name is required.",
    "pl": "Nazwa szablonu jest wymagana."
  },
  {
    "en": "Template title snapshot is present",
    "pl": "Obecny jest migawkowy tytuł szablonu"
  },
  {
    "en": "Template/layout inventory leaked into slide content on ${leakCards.length} slide(s). Template names must never appear as findings/messages.",
    "pl": "Inwentarz szablonów/układów wyciekł do treści slajdów na ${leakCards.length} slajdzie(ach). Nazwy szablonów nigdy nie powinny pojawiać się jako wyniki/ wiadomości."
  },
  {
    "en": "Templates do not require execution approval before review",
    "pl": "Szablony nie wymagają zatwierdzenia wykonania przed przeglądem"
  },
  {
    "en": "Templates validate via contract payload (no source grounding required)",
    "pl": "Szablony są weryfikowane na podstawie danych kontraktu (odniesienie do źródeł nie jest wymagane)"
  },
  {
    "en": "Test event from Consultify Table Platform",
    "pl": "Zdarzenie testowe z platformy Consultify Table"
  },
  {
    "en": "Text-to-SQL query failed: ${err?.message}",
    "pl": "Zapytanie Text-to-SQL nie powiodło się: ${err?.message}"
  },
  {
    "en": "The Advisor is pre-approval by definition; business version is ${bv.status}. Reopen creates a new version where the Advisor starts fresh.",
    "pl": "Doradca jest wstępnie zatwierdzony według definicji; wersja biznesowa to ${bv.status}. Ponowne otwarcie tworzy nową wersję, gdzie doradca zaczyna od zera."
  },
  {
    "en": "The Consultify database health check failed: ${error.message}",
    "pl": "Sprawdzenie zdrowia bazy danych Consultify nie powiodło się: ${error.message}"
  },
  {
    "en": "The Consultify database is responding again.",
    "pl": "Baza danych Consultify ponownie odpowiada."
  },
  {
    "en": "The Context popover must carry at least one field — otherwise the metadata OWN-FIN-011 moved out of the header rows has nowhere to live.",
    "pl": "Wyskakujące okienko Kontekstu musi zawierać przynajmniej jedno pole — w przeciwnym razie metadane OWN-FIN-011 przeniesione poza wiersze nagłówków nie mają miejsca do życia."
  },
  {
    "en": "The Workspace Bar must carry the document identity (name/version/status). A declaration that gives it ",
    "pl": "Pasek roboczy musi zawierać tożsamość dokumentu (nazwa/wersja/status). Deklaracja, która mu ją daje"
  },
  {
    "en": "The gate decision required for this transition was superseded by a newer decision while it was being processed. Re-check the gate and retry.",
    "pl": "Decyzja bramy wymagana dla tego przejścia została zastąpiona nowszą decyzją podczas jej przetwarzania. Sprawdź ponownie bramę i spróbuj ponownie."
  },
  {
    "en": "The idempotency key was already committed with a different import payload",
    "pl": "Klucz idempotentności został już zatwierdzony z innym ładunkiem importu"
  },
  {
    "en": "The requested API endpoint does not exist.",
    "pl": "Żądany punkt końcowy API nie istnieje."
  },
  {
    "en": "The requested API method is not allowed for this endpoint.",
    "pl": "Żądana metoda API nie jest dozwolona dla tego punktu końcowego."
  },
  {
    "en": "The two variants belong to different organizations",
    "pl": "Dwie wersje należą do różnych organizacji"
  },
  {
    "en": "This Idea is marked restricted and cannot be sent to an AI model.",
    "pl": "To pomysł jest oznaczony jako ograniczony i nie może zostać wysłany do modelu AI."
  },
  {
    "en": "This action requires the initiative to be ${expected}, but it is ${currentStage ?? currentStatus}",
    "pl": "Ta akcja wymaga, aby inicjatywa była ${expected}, ale jest ${currentStage ?? currentStatus}"
  },
  {
    "en": "This action requires your approval before execution.",
    "pl": "Ta akcja wymaga Twojego zatwierdzenia przed wykonaniem."
  },
  {
    "en": "This code is not valid for the selected plan",
    "pl": "Ten kod nie jest ważny dla wybranego planu"
  },
  {
    "en": "This form is not published",
    "pl": "Ten formularz nie jest opublikowany"
  },
  {
    "en": "This legacy Finance writer has been cut over to the canonical V8 runtime.",
    "pl": "Ten starszy zapisywacz finansowy został przeniesiony do kanonicznego środowiska uruchomieniowego V8."
  },
  {
    "en": "This legacy writer has been cut over to its canonical successor.",
    "pl": "Ten starszy zapisywacz został przeniesiony do swojego kanonicznego następcy."
  },
  {
    "en": "This legacy writer is retired for migrated records, but this record has no canonical identity yet. Run the canonical backfill before retrying.",
    "pl": "Ten starszy zapisywacz został wycofany dla migracyjnych rekordów, ale ten rekord nie ma jeszcze tożsamości kanonicznej. Uruchom wypełnienie kanoniczne przed ponowną próbą."
  },
  {
    "en": "This lineage edge already exists",
    "pl": "To krawędź linii pochodzenia już istnieje"
  },
  {
    "en": "This valuation is already bound to a different source. finance_lineage_edges is append-only (no UPDATE, no DELETE) — create a new valuation version instead of rewriting its provenance.",
    "pl": "Ta wycena jest już powiązana z innym źródłem. finance_lineage_edges to tylko dołączanie (brak UPDATE, brak DELETE) — utwórz nową wersję wyceny zamiast przepisywać jej pochodzenie."
  },
  {
    "en": "Title and justification are required",
    "pl": "Tytuł i uzasadnienie są wymagane"
  },
  {
    "en": "Too many SMS requests. Please try again later.",
    "pl": "Zbyt dużo żądań SMS. Spróbuj ponownie później."
  },
  {
    "en": "Too many attempts. Please request a new code.",
    "pl": "Zbyt wiele prób. Poproś o nowy kod."
  },
  {
    "en": "Too many edited sections (max ${INSIGHT_SECTION_OVERRIDE_MAX_SECTIONS})",
    "pl": "Zbyt dużo edytowanych sekcji (maksymalnie ${INSIGHT_SECTION_OVERRIDE_MAX_SECTIONS})"
  },
  {
    "en": "Too many hedging phrases: ${hedgingCount} found, max ${profile.hedgingRules.maxHedgingPhrases} allowed",
    "pl": "Zbyt dużo fraz ochronnych: znaleziono ${hedgingCount}, maksymalnie dozwolonych ${profile.hedgingRules.maxHedgingPhrases}"
  },
  {
    "en": "Too many login attempts, please try again later.",
    "pl": "Zbyt wiele prób logowania, spróbuj ponownie później."
  },
  {
    "en": "Too many requests. Please retry later.",
    "pl": "Zbyt dużo żądań. Spróbuj ponownie później."
  },
  {
    "en": "Tool did not answer in time",
    "pl": "Narzędzie nie odpowiedziało a czasie"
  },
  {
    "en": "Total Assets = 0 but Liabilities = ${effectiveLiab} — likely extraction failure (assets section not captured)",
    "pl": "Wszystkie aktywa = 0, ale zobowiązania = ${effectiveLiab} — prawdopodobnie błąd ekstrakcji (sekcja aktywów nie została przechwycona)"
  },
  {
    "en": "Total Assets derived from Total L&E (${totalLE}), but NO asset-side lines found (Current Assets, Fixed Assets, Cash all missing). Assets section likely not extracted from PDF.",
    "pl": "Całkowite aktywa pochodzące od całkowitych L&E (${totalLE}), ale nie znaleziono linii strony aktywów (Bieżące aktywa, Aktywa trwałe, Gotówka wszystkie brakujące). Sekcja aktywów prawdopodobnie nie została wyodrębniona z PDF."
  },
  {
    "en": "Total Assets derived from Total L&E: ${totalLE}",
    "pl": "Całkowite aktywa pochodzące od całkowitych zobowiązań i kapitału: ${totalLE}"
  },
  {
    "en": "Total Assets is negative: ${effectiveAssets}",
    "pl": "Całkowite aktywa są ujemne: ${effectiveAssets}"
  },
  {
    "en": "Total Liabilities derived from T(L&E): ${derived.toFixed(2)}",
    "pl": "Całkowite zobowiązania pochodzące od całkowitych zobowiązań i kapitału: ${derived.toFixed(2)}"
  },
  {
    "en": "Total Liabilities derived from components: ${derived.toFixed(2)}",
    "pl": "Całkowite zobowiązania pochodzące od składników: ${derived.toFixed(2)}"
  },
  {
    "en": "Total Liabilities derived: ${derived.toFixed(2)}",
    "pl": "Całkowite zobowiązania pochodzące: ${derived.toFixed(2)}"
  },
  {
    "en": "Trigger signal is required",
    "pl": "Wymagany sygnał wyzwalający"
  },
  {
    "en": "Unauthorized - no organization",
    "pl": "Nieautoryzowany — brak organizacji"
  },
  {
    "en": "Unknown action type: ${action.actionType}",
    "pl": "Nieznany typ działania: ${action.actionType}"
  },
  {
    "en": "Unknown compliance standard: ${standard}",
    "pl": "Nieznany standard zgodności: ${standard}"
  },
  {
    "en": "Unknown downstream error",
    "pl": "Nieznany błąd wewnętrzny"
  },
  {
    "en": "Unknown error",
    "pl": "Nieznany błąd"
  },
  {
    "en": "Unknown operation type: ${(op as any).type}",
    "pl": "Nieznany typ operacji: ${(op as any).type}"
  },
  {
    "en": "Unknown operation type: ${opType}",
    "pl": "Nieznany typ operacji: ${opType}"
  },
  {
    "en": "Unknown or unsupported action type: ${actionType} ",
    "pl": "Nieznany lub nieobsługiwany typ działania: ${actionType} "
  },
  {
    "en": "Unknown report type",
    "pl": "Nieznany typ raportu"
  },
  {
    "en": "Unknown source state: ${String(from)}",
    "pl": "Nieznany stan źródła: ${String(from)}"
  }
];
