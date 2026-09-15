import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_14: readonly ServerPayloadMessage[] = [
  {
    "en": "Missing required decision fields: proposal_id, organization_id, decision, or decided_by_user_id",
    "pl": "Brak wymaganych pól decyzyjnych: proposal_id, organization_id, decyzja lub decided_by_user_id"
  },
  {
    "en": "update_status requires taskId and status",
    "pl": "update_status wymaga identyfikatora zadania i statusu"
  },
  {
    "en": "assign_user requires taskId and assigneeId",
    "pl": "assign_user wymaga identyfikatora zadania i identyfikatora cesjonariusza"
  },
  {
    "en": "set_field requires taskId and field",
    "pl": "set_field wymaga identyfikatora zadania i pola"
  },
  {
    "en": "key and title are required",
    "pl": "klucz i tytuł są wymagane"
  },
  {
    "en": "Template ${id} not found",
    "pl": "Nie znaleziono szablonu ${id}"
  },
  {
    "en": "Template is already published",
    "pl": "Szablon został już opublikowany"
  },
  {
    "en": "Invalid status: ${status}",
    "pl": "Nieprawidłowy status: ${status}"
  },
  {
    "en": "Invalid export data format",
    "pl": "Nieprawidłowy format danych eksportu"
  },
  {
    "en": "Template ${templateId} not found",
    "pl": "Nie znaleziono szablonu ${templateId}"
  },
  {
    "en": "Can only restore versions of DRAFT templates",
    "pl": "Można przywracać tylko wersje szablonów DRAFT"
  },
  {
    "en": "Version ${version} not found",
    "pl": "Nie znaleziono wersji ${version}"
  },
  {
    "en": "Invalid context",
    "pl": "Nieprawidłowy kontekst"
  },
  {
    "en": "Invalid recommendation",
    "pl": "Nieprawidłowa rekomendacja"
  },
  {
    "en": "Missing fields",
    "pl": "Brakujące pola"
  },
  {
    "en": "Invalid recommendations",
    "pl": "Nieprawidłowe rekomendacje"
  },
  {
    "en": "Feature unavailable: SimulationEngine.${feature} is not implemented",
    "pl": "Funkcja niedostępna: SimulationEngine.${feature} nie jest zaimplementowany"
  },
  {
    "en": "Feature unavailable: SimulationService.simulateImpacts is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.simulateImpacts nie jest zaimplementowany"
  },
  {
    "en": "Invalid scenario",
    "pl": "Nieprawidłowy scenariusz"
  },
  {
    "en": "Feature unavailable: SimulationService does not expose a runnable method",
    "pl": "Funkcja niedostępna: SimulationService nie udostępnia metody, którą można uruchomić"
  },
  {
    "en": "Simulation engine unavailable",
    "pl": "Silnik symulacji niedostępny"
  },
  {
    "en": "Feature unavailable: SimulationService.generateWhatIfScenarios is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.generateWhatIfScenarios nie jest zaimplementowany"
  },
  {
    "en": "Feature unavailable: SimulationService.generateVariableCombinations is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.generateVariableCombinations nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.calculateOutcomeProbabilities is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.calculateOutcomeProbabilities nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.calculateRiskProbabilities is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.calculateRiskProbabilities nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.runMonteCarloSimulation is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.runMonteCarloSimulation nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.performSensitivityAnalysis is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.performSensitivityAnalytics nie została zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.identifyKeyDrivers is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.identifyKeyDrivers nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.identifyMostInfluentialVariables is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.identifyMostInfluentialVariables nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.compareScenarios is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.compareScenarios nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.analyzeTradeoffs is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.analyzeTradeoffs nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.storeSimulationResults is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.storeSimulationResults nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.retrieveStoredSimulations is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.retrieveStoredSimulations nie jest zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.getSimulationResults is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.getSimulationResults nie jest zaimplementowany"
  },
  {
    "en": "Feature unavailable: SimulationService.simulateRecommendation is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.simulateRecommendation nie została zaimplementowana"
  },
  {
    "en": "Feature unavailable: SimulationService.generateDistributionSamples is not implemented",
    "pl": "Funkcja niedostępna: SimulationService.generateDistributionSamples nie jest zaimplementowana"
  },
  {
    "en": "${operation} affected ${result.rowCount ?? 0} rows",
    "pl": "${operation} dotyczy ${result.rowCount ?? 0} wierszy"
  },
  {
    "en": "Canonical migrations directory not found for readiness evaluation",
    "pl": "Nie znaleziono kanonicznego katalogu migracji do oceny gotowości"
  },
  {
    "en": "Stale chunk reload throttled",
    "pl": "Przeładowanie nieaktualnych fragmentów zostało ograniczone"
  },
  {
    "en": "Unknown resource: ${uri}",
    "pl": "Nieznany zasób: ${uri}"
  },
  {
    "en": "Unknown prompt: ${promptName}",
    "pl": "Nieznany monit: ${promptName}"
  },
  {
    "en": "method-core: event insert settled to no row (idempotency invariant violated)",
    "pl": "rdzeń metody: wstawka zdarzenia ustawiona na brak wiersza (naruszono niezmiennik idempotencji)"
  },
  {
    "en": "method-core: ensureDrdPackRegistered failed to produce a method_packs row for org ${organizationId}",
    "pl": "rdzeń metody: SureDrdPackRegistered nie utworzył wiersza method_packs dla organizacji ${organizationId}"
  },
  {
    "en": "method-core: session not found: ${request.sessionId}",
    "pl": "rdzeń metody: nie znaleziono sesji: ${request.sessionId}"
  },
  {
    "en": "method-core: session vanished mid-freeze: ${sessionId}",
    "pl": "rdzeń metody: sesja zniknęła w połowie zamrożenia: ${sessionId}"
  },
  {
    "en": "method-core: output not found: ${outputId}",
    "pl": "rdzeń metody: nie znaleziono danych wyjściowych: ${outputId}"
  },
  {
    "en": "No canonical map row for idea ${ideaId} in org ${organizationId}",
    "pl": "Brak wiersza mapy kanonicznej dla pomysłu ${ideaId} w organizacji ${organizationId}"
  },
  {
    "en": "AUDIT_WRITE_FAILED: ${legacyErr?.message || message}",
    "pl": "AUDIT_WRITE_FAILED: ${legacyErr?.message || message}"
  },
  {
    "en": "Cannot delete assignment that has been started",
    "pl": "Nie można usunąć rozpoczętego zadania"
  },
  {
    "en": "Cannot remove primary assignee. Reassign the assignment first.",
    "pl": "Nie można usunąć głównego cesjonariusza. Najpierw ponownie przypisz zadanie."
  },
  {
    "en": "Assignment not found",
    "pl": "Nie znaleziono zadania"
  },
  {
    "en": "Interview insight generation attempt is required",
    "pl": "Wymagana jest próba wygenerowania spostrzeżeń związanych z wywiadem"
  },
  {
    "en": "No scoped session data available for analysis",
    "pl": "Brak dostępnych danych sesji o określonym zakresie do analizy"
  },
  {
    "en": "Invoice not found",
    "pl": "Nie znaleziono faktury"
  },
  {
    "en": "MFA challenge was already consumed",
    "pl": "Wyzwanie MFA zostało już wykorzystane"
  },
  {
    "en": "Failed to get documents",
    "pl": "Nie udało się uzyskać dokumentów"
  },
  {
    "en": "Failed to get document",
    "pl": "Nie udało się pobrać dokumentu"
  },
  {
    "en": "Failed to create document",
    "pl": "Nie udało się utworzyć dokumentu"
  },
  {
    "en": "Failed to update document",
    "pl": "Nie udało się zaktualizować dokumentu"
  }
];
