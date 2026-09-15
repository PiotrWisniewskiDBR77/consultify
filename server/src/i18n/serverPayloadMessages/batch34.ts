import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_34: readonly ServerPayloadMessage[] = [
  {
    "en": "Decision ${decisionId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono decyzji ${decisionId} w organizacji ${organizationId}"
  },
  {
    "en": "Decision ${decisionId} is closed — voting is not allowed",
    "pl": "Decyzja ${decisionId} jest zamknięta – głosowanie nie jest dozwolone"
  },
  {
    "en": "Option ${optionId} not found in decision ${decisionId}",
    "pl": "Opcja ${optionId} nie została znaleziona w decyzji ${decisionId}"
  },
  {
    "en": "Voter ${voterId} has already voted for option ${optionId}",
    "pl": "Głosujący ${voterId} głosował już na opcję ${optionId}"
  },
  {
    "en": "Decision ${decisionId} is already closed",
    "pl": "Decyzja ${decisionId} jest już zamknięta"
  },
  {
    "en": "Session ${sessionId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono sesji ${sessionId} w organizacji ${organizationId}"
  },
  {
    "en": "Invalid session state transition: ${session.state} → paused. ",
    "pl": "Nieprawidłowa zmiana stanu sesji: ${session.state} → wstrzymana."
  },
  {
    "en": "Invalid session state transition: ${session.state} → active. ",
    "pl": "Nieprawidłowa zmiana stanu sesji: ${session.state} → aktywna."
  },
  {
    "en": "Invalid session state transition: ${session.state} → completed. ",
    "pl": "Nieprawidłowa zmiana stanu sesji: ${session.state} → zakończona."
  },
  {
    "en": "Module link ${linkId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono łącza modułu ${linkId} w organizacji ${organizationId}"
  },
  {
    "en": "Permission ${permissionId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono uprawnienia ${permissionId} w organizacji ${organizationId}"
  },
  {
    "en": "Failed to revoke permission ${permissionId}",
    "pl": "Nie udało się cofnąć pozwolenia ${permissionId}"
  },
  {
    "en": "Permission ${permissionId} missing after revoke",
    "pl": "Brak pozwolenia ${permissionId} po unieważnieniu"
  },
  {
    "en": "Valuation not found",
    "pl": "Nie znaleziono wyceny"
  },
  {
    "en": "Valuation must be APPROVED to export",
    "pl": "Wycena musi mieć status APPROVED, aby można ją było wyeksportować"
  },
  {
    "en": "Missing sourceId",
    "pl": "Brak identyfikatora źródła"
  },
  {
    "en": "Source budget not found",
    "pl": "Nie znaleziono budżetu źródłowego"
  },
  {
    "en": "Budget must be approved before it can seed a valuation",
    "pl": "Budżet musi zostać zatwierdzony, zanim będzie mógł stanowić podstawę wyceny"
  },
  {
    "en": "Source financial model not found",
    "pl": "Nie znaleziono źródłowego modelu finansowego"
  },
  {
    "en": "Financial model must be approved before it can seed a valuation",
    "pl": "Zanim będzie można przystąpić do wyceny, model finansowy musi zostać zatwierdzony"
  },
  {
    "en": "Source financial analysis not found",
    "pl": "Nie znaleziono źródłowej analizy finansowej"
  },
  {
    "en": "Financial analysis must be approved before it can seed a valuation",
    "pl": "Analiza finansowa musi zostać zatwierdzona, zanim będzie mogła stanowić podstawę wyceny"
  },
  {
    "en": "Budget must be approved before valuation can use it",
    "pl": "Budżet musi zostać zatwierdzony, zanim będzie można go wykorzystać w wycenie"
  },
  {
    "en": "Budget projections not found. Generate projections first.",
    "pl": "Nie znaleziono prognoz budżetu. Najpierw wygeneruj projekcje."
  },
  {
    "en": "Financial model must be approved before valuation can use it",
    "pl": "Zanim będzie można zastosować wycenę, model finansowy musi zostać zatwierdzony"
  },
  {
    "en": "Financial model source statement pack not found",
    "pl": "Nie znaleziono pakietu wyciągów źródłowych modelu finansowego"
  },
  {
    "en": "Financial model outputs not found. Compute the model first.",
    "pl": "Nie znaleziono wyników modelu finansowego. Najpierw oblicz model."
  },
  {
    "en": "Financial model did not produce annual forecast years",
    "pl": "Model finansowy nie zapewniał prognozowanych rocznych lat"
  },
  {
    "en": "Financial analysis must be approved before valuation can use it",
    "pl": "Zanim wycena będzie mogła zostać wykorzystana, należy zatwierdzić analizę finansową"
  },
  {
    "en": "Financial analysis source statement pack not found",
    "pl": "Nie znaleziono pakietu wyciągów źródłowych analizy finansowej"
  },
  {
    "en": "Financial analysis periods not found",
    "pl": "Nie znaleziono okresów analizy finansowej"
  },
  {
    "en": "Manual forecast missing",
    "pl": "Brak ręcznej prognozy"
  },
  {
    "en": "Terminal growth must be lower than WACC (g < WACC)",
    "pl": "Wzrost końcowy musi być niższy niż WACC (g < WACC)"
  },
  {
    "en": "Compute valuation before approval",
    "pl": "Oblicz wycenę przed zatwierdzeniem"
  },
  {
    "en": "Validation failed: terminal growth must be lower than WACC (g < WACC)",
    "pl": "Walidacja nie powiodła się: wzrost końcowy musi być niższy niż WACC (g < WACC)"
  },
  {
    "en": "Valuation must be APPROVED to generate advisory",
    "pl": "Wycena musi mieć status APPROVED, aby wygenerować materiał doradczy"
  },
  {
    "en": "Valuation must be APPROVED to generate negotiation pack",
    "pl": "Wycena musi mieć status APPROVED, aby wygenerować pakiet negocjacyjny"
  },
  {
    "en": "Recommendation not found",
    "pl": "Nie znaleziono rekomendacji"
  },
  {
    "en": "Invalid gate: ${data.gate}",
    "pl": "Nieprawidłowa bramka: ${data.gate}"
  },
  {
    "en": "Failed to load created gate",
    "pl": "Nie udało się wczytać utworzonej bramy"
  },
  {
    "en": "Gate not found",
    "pl": "Nie znaleziono bramy"
  },
  {
    "en": "Failed to reload advanced gate",
    "pl": "Nie udało się przeładować bramy zaawansowanej"
  },
  {
    "en": "Unsupported artifact type: ${value}",
    "pl": "Nieobsługiwany typ artefaktu: ${value}"
  },
  {
    "en": "Artifact already has active mutation proposal: ${active.mutationId}",
    "pl": "Artefakt ma już aktywną propozycję mutacji: ${active.mutationId}"
  },
  {
    "en": "Mutation proposal not found",
    "pl": "Nie znaleziono propozycji mutacji"
  },
  {
    "en": "Mutation is ${mutation.status}, not proposed",
    "pl": "Mutacja to ${mutation.status}, nie zaproponowano"
  },
  {
    "en": "Mutation is ${mutation.status}, not approved",
    "pl": "Mutacja to ${mutation.status}, niezatwierdzona"
  },
  {
    "en": "Memory candidate not found",
    "pl": "Nie znaleziono kandydata na pamięć"
  },
  {
    "en": "Memory writes are disabled by privacy settings",
    "pl": "Zapisy w pamięci są wyłączone w ustawieniach prywatności"
  },
  {
    "en": "External connector not found for this organization",
    "pl": "Nie znaleziono zewnętrznego łącznika dla tej organizacji"
  },
  {
    "en": "Unknown Wave 8 agent: ${input.agentId}",
    "pl": "Nieznany agent fali 8: ${input.agentId}"
  },
  {
    "en": "invalid_schedule_transition:${from}:${input.action}",
    "pl": "invalid_schedule_transition:${from}:${input.action}"
  },
  {
    "en": "Wave 9 ${label} is required",
    "pl": "Wymagana jest fala 9 ${label}"
  },
  {
    "en": "Invalid Wave 9 ${label}: ${normalized}",
    "pl": "Nieprawidłowa fala 9 ${label}: ${normalized}"
  },
  {
    "en": "Wave 9 pass evidence requires verifier and verification method",
    "pl": "Dowód zaliczenia fali 9 wymaga weryfikatora i metody weryfikacji"
  },
  {
    "en": "Wave 9 source references require sourceType and sourceId",
    "pl": "Odniesienia do źródeł Wave 9 wymagają typu sourceType i sourceId"
  },
  {
    "en": "Wave 9 source reference is not verified: ${sourceRef.sourceType}:${sourceRef.sourceId}",
    "pl": "Odniesienie do źródła fali 9 nie zostało zweryfikowane: ${sourceRef.sourceType}:${sourceRef.sourceId}"
  },
  {
    "en": "Wave 9 task is not verified: ${taskId}",
    "pl": "Zadanie fali 9 nie zostało zweryfikowane: ${taskId}"
  },
  {
    "en": "Outcome not found",
    "pl": "Nie znaleziono wyniku"
  },
  {
    "en": "Canvas draft read-back failed",
    "pl": "Odczyt wersji roboczej kanwy nie powiódł się"
  }
];
