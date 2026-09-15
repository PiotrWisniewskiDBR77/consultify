import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_15: readonly ServerPayloadMessage[] = [
  {
    "en": "Failed to delete document",
    "pl": "Nie udało się usunąć dokumentu"
  },
  {
    "en": "Document not found",
    "pl": "Nie znaleziono dokumentu"
  },
  {
    "en": "Failed to create snapshot",
    "pl": "Nie udało się utworzyć migawki"
  },
  {
    "en": "Failed to get snapshots",
    "pl": "Nie udało się pobrać zrzutów ekranu"
  },
  {
    "en": "Failed to restore snapshot",
    "pl": "Nie udało się przywrócić migawki"
  },
  {
    "en": "Failed to retrieve created webhook",
    "pl": "Nie udało się pobrać utworzonego webhooka"
  },
  {
    "en": "Webhook not found",
    "pl": "Nie znaleziono webhooka"
  },
  {
    "en": "Failed to retrieve updated webhook",
    "pl": "Nie udało się pobrać zaktualizowanego webhooka"
  },
  {
    "en": "Delivery not found",
    "pl": "Nie znaleziono dostawy"
  },
  {
    "en": "Invalid counter type: ${counterType}",
    "pl": "Nieprawidłowy typ licznika: ${counterType}"
  },
  {
    "en": "Invalid code type: ${type}",
    "pl": "Nieprawidłowy typ kodu: ${type}"
  },
  {
    "en": "Failed to generate unique code. Please try again.",
    "pl": "Nie udało się wygenerować unikalnego kodu. Spróbuj ponownie."
  },
  {
    "en": "Invalid access code",
    "pl": "Nieprawidłowy kod dostępu"
  },
  {
    "en": "Code has expired",
    "pl": "Kod wygasł"
  },
  {
    "en": "Alert ${alertId} not found",
    "pl": "Nie znaleziono alertu ${alertId}"
  },
  {
    "en": "Invitation receipt read-back failed",
    "pl": "Odczyt potwierdzenia zaproszenia nie powiódł się"
  },
  {
    "en": "Invalid invitation token",
    "pl": "Nieprawidłowy token zaproszenia"
  },
  {
    "en": "Invitation is not a canonical admin IAM invitation",
    "pl": "Zaproszenie nie jest kanonicznym zaproszeniem administratora IAM"
  },
  {
    "en": "Email address does not match invitation",
    "pl": "Adres e-mail nie pasuje do zaproszenia"
  },
  {
    "en": "Invitation is ${invitation.status}",
    "pl": "Zaproszenie to ${invitation.status}"
  },
  {
    "en": "Invitation has expired",
    "pl": "Zaproszenie wygasło"
  },
  {
    "en": "User with this email belongs to another organization",
    "pl": "Użytkownik z tym adresem e-mail należy do innej organizacji"
  },
  {
    "en": "User is already a member of this organization",
    "pl": "Użytkownik jest już członkiem tej organizacji"
  },
  {
    "en": "Invitation accept lost concurrency race",
    "pl": "Zaproszenie akceptuje przegrany wyścig współbieżności"
  },
  {
    "en": "IAM job audit was not persisted",
    "pl": "Kontrola zadania IAM nie została utrwalona"
  },
  {
    "en": "IAM job could not be read back",
    "pl": "Nie można ponownie odczytać zadania IAM"
  },
  {
    "en": "IAM job lease is stale or outside tenant scope",
    "pl": "Wynajem stanowisk pracy IAM jest nieaktualny lub wykracza poza zakres najemcy"
  },
  {
    "en": "IAM job transition lost its lease",
    "pl": "Zmiana pracy IAM utraciła dzierżawę"
  },
  {
    "en": "BusinessCaseService: PLAN phase failed to produce a valid plan",
    "pl": "BusinessCaseService: Faza PLANU nie pozwoliła na utworzenie prawidłowego planu"
  },
  {
    "en": "businessCaseModel: plan has no drivers — cannot compute cashflows",
    "pl": "businessCaseModel: plan nie ma sterowników — nie można obliczyć przepływów pieniężnych"
  },
  {
    "en": "Capability is required",
    "pl": "Wymagana jest zdolność"
  },
  {
    "en": "Prompt is required",
    "pl": "Podpowiedź jest wymagana"
  },
  {
    "en": "User ID is required",
    "pl": "Identyfikator użytkownika jest wymagany"
  },
  {
    "en": "Unknown capability: ${request.capability}",
    "pl": "Nieznana zdolność: ${request.capability}"
  },
  {
    "en": "PROMPT_BLOCKED: Input contains disallowed content",
    "pl": "PROMPT_BLOCKED: Dane wejściowe zawierają niedozwoloną treść"
  },
  {
    "en": "No STT provider available. Set OPENAI_API_KEY (native OpenAI) or GROQ_API_KEY for Whisper transcription.",
    "pl": "Brak dostępnego dostawcy STT. Ustaw OPENAI_API_KEY (natywny OpenAI) lub GROQ_API_KEY dla transkrypcji Whisper."
  },
  {
    "en": "No STT provider available. Set GEMINI_API_KEY (Google — reused from Teresa voice), OPENAI_API_KEY, or GROQ_API_KEY.",
    "pl": "Brak dostępnego dostawcy STT. Ustaw GEMINI_API_KEY (Google — ponownie użyte z głosu Teresy), OPENAI_API_KEY lub GROQ_API_KEY."
  },
  {
    "en": "Experiment not found",
    "pl": "Nie znaleziono eksperymentu"
  },
  {
    "en": "Invalid regex pattern: ${input.pattern}",
    "pl": "Nieprawidłowy wzór wyrażenia regularnego: ${input.pattern}"
  },
  {
    "en": "deepThinkingReport is required",
    "pl": "Wymagany jest raport deepThinkingReport"
  },
  {
    "en": "Plan ${planId} not found",
    "pl": "Nie znaleziono planu ${planId}"
  },
  {
    "en": "Plan ${planId} disappeared during execution claim",
    "pl": "Plan ${planId} zniknął podczas roszczenia o wykonanie"
  },
  {
    "en": "Plan ${planId} disappeared after cancellation",
    "pl": "Plan ${planId} zniknął po anulowaniu"
  },
  {
    "en": "Step not found or not awaiting approval",
    "pl": "Nie znaleziono kroku lub nie oczekuje on na zatwierdzenie"
  },
  {
    "en": "Plan not found",
    "pl": "Nie znaleziono planu"
  },
  {
    "en": "Plan disappeared after schedule",
    "pl": "Plan zniknął po harmonogramie"
  },
  {
    "en": "Plan disappeared after step replace",
    "pl": "Plan zniknął po wymianie kroku"
  },
  {
    "en": "No LLM provider rows found to seed purpose assignments",
    "pl": "Nie znaleziono wierszy dostawcy LLM, w których można by zainicjować przypisania celu"
  },
  {
    "en": "OpenAI health check failed: ${res.status}",
    "pl": "Kontrola stanu OpenAI nie powiodła się: ${res.status}"
  },
  {
    "en": "OpenRouter health check failed: ${res.status}",
    "pl": "Kontrola stanu OpenRoutera nie powiodła się: ${res.status}"
  },
  {
    "en": "Gemini health check failed: ${res.status}",
    "pl": "Kontrola stanu Gemini nie powiodła się: ${res.status}"
  },
  {
    "en": "Anthropic health check failed: ${res.status}",
    "pl": "Kontrola stanu antropicznego nie powiodła się: ${res.status}"
  },
  {
    "en": "Conversation not found",
    "pl": "Nie znaleziono rozmowy"
  },
  {
    "en": "Only conversation owners can change roles",
    "pl": "Role mogą zmieniać tylko właściciele konwersacji"
  },
  {
    "en": "Only conversation owners can remove participants",
    "pl": "Tylko właściciele konwersacji mogą usuwać uczestników"
  },
  {
    "en": "Audit trail not found for session ${sessionId}",
    "pl": "Nie znaleziono ścieżki audytu dla sesji ${sessionId}"
  },
  {
    "en": "OpenAI face detection failed (${response.status})",
    "pl": "Wykrycie twarzy OpenAI nie powiodło się (${response.status})"
  },
  {
    "en": "Gemini face detection failed (${response.status})",
    "pl": "Wykrycie twarzy Gemini nie powiodło się (${response.status})"
  },
  {
    "en": "No supported vision face detector for provider=${provider}",
    "pl": "Brak obsługiwanego wizyjnego detektora twarzy dla dostawcy=${provider}"
  },
  {
    "en": "OpenAI image generation failed (${res.status}): ${text.slice(0, 300)}",
    "pl": "Wygenerowanie obrazu OpenAI nie powiodło się (${res.status}): ${text.slice(0, 300)}"
  }
];
