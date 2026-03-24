/**
 * Assessment Chat Coach Contract
 *
 * Provides AI coach stages for guided assessment sessions.
 * The coach walks users through each dimension: asking questions,
 * collecting evidence, proposing scores, checking consistency,
 * and generating a summary with initiative recommendations.
 */

export type CoachStage =
  | 'kickoff'
  | 'area_questions'
  | 'area_evidence'
  | 'area_score_propose'
  | 'consistency_check'
  | 'summary'
  | 'initiatives'
  | 'export';

export interface CoachState {
  frameworkId: string;
  stage: CoachStage;
  currentDimensionId: string | null;
  completedDimensions: string[];
  proposedScores: Record<string, { current: number; target: number }>;
  evidenceCollected: Record<string, string>;
  consistencyIssues: string[];
}

export interface CoachMessage {
  stage: CoachStage;
  dimensionId: string | null;
  messageType: 'question' | 'propose' | 'warn' | 'summary' | 'action';
  content: { en: string; pl: string };
  actions?: CoachAction[];
}

export interface CoachAction {
  id: string;
  label: { en: string; pl: string };
  type: 'accept' | 'reject' | 'modify' | 'skip' | 'next';
}

// ============================================
// FRAMEWORK DIMENSION REGISTRIES
// ============================================

const SIRI_DIMENSION_IDS = [
  'operations',
  'supply_chain',
  'product_lifecycle',
  'automation',
  'connectivity',
  'intelligence',
  'talent_readiness',
  'structure_management',
];

const ADMA_DIMENSION_IDS = [
  'digital_strategy',
  'digital_investments',
  'digital_culture',
  'product_features',
  'product_data',
  'production_tech',
  'production_it',
  'supply_integration',
  'supply_visibility',
  'data_collection',
  'data_analytics',
  'data_services',
];

const DRD_DIMENSION_IDS = [
  'processes',
  'digitalProducts',
  'businessModels',
  'dataManagement',
  'culture',
  'cybersecurity',
  'aiMaturity',
];

const DIMENSION_LABELS: Record<string, { en: string; pl: string }> = {
  // SIRI
  operations: { en: 'Operations', pl: 'Operacje' },
  supply_chain: { en: 'Supply Chain', pl: 'Łańcuch Dostaw' },
  product_lifecycle: { en: 'Product Lifecycle', pl: 'Cykl Życia Produktu' },
  automation: { en: 'Automation', pl: 'Automatyzacja' },
  connectivity: { en: 'Connectivity', pl: 'Łączność' },
  intelligence: { en: 'Intelligence', pl: 'Inteligencja' },
  talent_readiness: { en: 'Talent Readiness', pl: 'Gotowość Talentów' },
  structure_management: { en: 'Structure & Management', pl: 'Struktura i Zarządzanie' },
  // ADMA
  digital_strategy: { en: 'Digital Strategy', pl: 'Strategia Cyfrowa' },
  digital_investments: { en: 'Digital Investments', pl: 'Inwestycje Cyfrowe' },
  digital_culture: { en: 'Digital Culture', pl: 'Kultura Cyfrowa' },
  product_features: { en: 'Smart Product Features', pl: 'Funkcje Inteligentnych Produktów' },
  product_data: { en: 'Product Data Usage', pl: 'Wykorzystanie Danych Produktu' },
  production_tech: { en: 'Production Technologies', pl: 'Technologie Produkcyjne' },
  production_it: { en: 'Production IT', pl: 'IT Produkcyjne' },
  supply_integration: { en: 'Supply Chain Integration', pl: 'Integracja Łańcucha Dostaw' },
  supply_visibility: { en: 'Supply Chain Visibility', pl: 'Widoczność Łańcucha Dostaw' },
  data_collection: { en: 'Data Collection', pl: 'Zbieranie Danych' },
  data_analytics: { en: 'Data Analytics', pl: 'Analityka Danych' },
  data_services: { en: 'Data-Based Services', pl: 'Usługi Oparte na Danych' },
  // DRD
  processes: { en: 'Digital Processes', pl: 'Procesy Cyfrowe' },
  digitalProducts: { en: 'Digital Products', pl: 'Produkty Cyfrowe' },
  businessModels: { en: 'Digital Business Models', pl: 'Cyfrowe Modele Biznesowe' },
  dataManagement: { en: 'Data Management', pl: 'Zarządzanie Danymi' },
  culture: { en: 'Culture of Transformation', pl: 'Kultura Transformacji' },
  cybersecurity: { en: 'Cybersecurity', pl: 'Cyberbezpieczeństwo' },
  aiMaturity: { en: 'AI Maturity', pl: 'Dojrzałość AI' },
};

/**
 * Related dimension pairs used for consistency checking.
 * If one dimension is scored high, the related one shouldn't be very low.
 */
const RELATED_DIMENSIONS: Record<string, Array<[string, string]>> = {
  SIRI: [
    ['intelligence', 'connectivity'],
    ['automation', 'connectivity'],
    ['intelligence', 'talent_readiness'],
    ['operations', 'automation'],
    ['structure_management', 'talent_readiness'],
  ],
  ADMA: [
    ['data_analytics', 'data_collection'],
    ['data_services', 'data_analytics'],
    ['digital_strategy', 'digital_investments'],
    ['production_tech', 'production_it'],
    ['product_features', 'product_data'],
    ['supply_integration', 'supply_visibility'],
  ],
  DRD: [
    ['aiMaturity', 'dataManagement'],
    ['digitalProducts', 'businessModels'],
    ['processes', 'dataManagement'],
    ['culture', 'cybersecurity'],
  ],
};

// ============================================
// FRAMEWORK SCALE LIMITS
// ============================================

const FRAMEWORK_SCALES: Record<string, { min: number; max: number }> = {
  SIRI: { min: 0, max: 5 },
  ADMA: { min: 1, max: 5 },
  DRD: { min: 1, max: 7 },
};

// ============================================
// CORE FUNCTIONS
// ============================================

function getDimensionIds(frameworkId: string): string[] {
  switch (frameworkId.toUpperCase()) {
    case 'SIRI':
      return SIRI_DIMENSION_IDS;
    case 'ADMA':
      return ADMA_DIMENSION_IDS;
    case 'DRD':
      return DRD_DIMENSION_IDS;
    default:
      return [];
  }
}

function getDimensionLabel(dimId: string): { en: string; pl: string } {
  return DIMENSION_LABELS[dimId] ?? { en: dimId, pl: dimId };
}

export function createInitialCoachState(frameworkId: string): CoachState {
  return {
    frameworkId,
    stage: 'kickoff',
    currentDimensionId: null,
    completedDimensions: [],
    proposedScores: {},
    evidenceCollected: {},
    consistencyIssues: [],
  };
}

export function getNextCoachMessage(state: CoachState): CoachMessage {
  const { frameworkId, stage, currentDimensionId } = state;
  const fwUpper = frameworkId.toUpperCase();
  const dimIds = getDimensionIds(frameworkId);

  switch (stage) {
    case 'kickoff': {
      const totalDims = dimIds.length;
      return {
        stage: 'kickoff',
        dimensionId: null,
        messageType: 'question',
        content: {
          en: `Welcome to the ${fwUpper} assessment session. We'll walk through ${totalDims} dimensions together. I'll ask questions about each area, help you collect evidence, and propose maturity scores. Ready to begin?`,
          pl: `Witaj w sesji oceny ${fwUpper}. Przejdziemy razem przez ${totalDims} wymiarów. Zadam pytania dotyczące każdego obszaru, pomogę zebrać dowody i zaproponuję oceny dojrzałości. Gotowy, aby zacząć?`,
        },
        actions: [
          { id: 'start', label: { en: 'Start assessment', pl: 'Rozpocznij ocenę' }, type: 'next' },
          {
            id: 'skip_to_review',
            label: { en: 'Skip to review', pl: 'Przejdź do przeglądu' },
            type: 'skip',
          },
        ],
      };
    }

    case 'area_questions': {
      if (!currentDimensionId) {
        return buildNoDimensionMessage(stage);
      }
      const label = getDimensionLabel(currentDimensionId);
      return {
        stage: 'area_questions',
        dimensionId: currentDimensionId,
        messageType: 'question',
        content: {
          en: `Let's assess **${label.en}**. Tell me about your current capabilities in this area. What systems, processes, or tools are in place? What level of maturity would you say you're at?`,
          pl: `Ocenimy teraz **${label.pl}**. Opowiedz mi o obecnych możliwościach w tym obszarze. Jakie systemy, procesy lub narzędzia są wdrożone? Na jakim poziomie dojrzałości się znajdujecie?`,
        },
        actions: [
          {
            id: 'answer',
            label: { en: 'Provide details', pl: 'Podaj szczegóły' },
            type: 'next',
          },
          {
            id: 'skip_dim',
            label: { en: 'Skip this dimension', pl: 'Pomiń ten wymiar' },
            type: 'skip',
          },
        ],
      };
    }

    case 'area_evidence': {
      if (!currentDimensionId) {
        return buildNoDimensionMessage(stage);
      }
      const label = getDimensionLabel(currentDimensionId);
      return {
        stage: 'area_evidence',
        dimensionId: currentDimensionId,
        messageType: 'question',
        content: {
          en: `What evidence can you provide for **${label.en}**? This could be documents, screenshots, reports, or descriptions of systems in use. Evidence strengthens the assessment and is required for consolidation.`,
          pl: `Jakie dowody możesz dostarczyć dla **${label.pl}**? Mogą to być dokumenty, zrzuty ekranu, raporty lub opisy używanych systemów. Dowody wzmacniają ocenę i są wymagane do konsolidacji.`,
        },
        actions: [
          {
            id: 'provide_evidence',
            label: { en: 'Add evidence', pl: 'Dodaj dowody' },
            type: 'next',
          },
          {
            id: 'no_evidence',
            label: { en: 'No evidence available', pl: 'Brak dostępnych dowodów' },
            type: 'skip',
          },
        ],
      };
    }

    case 'area_score_propose': {
      if (!currentDimensionId) {
        return buildNoDimensionMessage(stage);
      }
      const label = getDimensionLabel(currentDimensionId);
      const proposed = state.proposedScores[currentDimensionId];
      const scale = FRAMEWORK_SCALES[fwUpper] ?? { min: 0, max: 5 };

      if (proposed) {
        return {
          stage: 'area_score_propose',
          dimensionId: currentDimensionId,
          messageType: 'propose',
          content: {
            en: `Based on our discussion, I propose a current score of **${proposed.current}** and a target of **${proposed.target}** for **${label.en}** (scale ${scale.min}-${scale.max}). Do you agree?`,
            pl: `Na podstawie naszej rozmowy proponuję obecny wynik **${proposed.current}** i cel **${proposed.target}** dla **${label.pl}** (skala ${scale.min}-${scale.max}). Zgadzasz się?`,
          },
          actions: [
            { id: 'accept', label: { en: 'Accept', pl: 'Akceptuj' }, type: 'accept' },
            { id: 'modify', label: { en: 'Modify scores', pl: 'Zmień oceny' }, type: 'modify' },
            { id: 'reject', label: { en: 'Reject', pl: 'Odrzuć' }, type: 'reject' },
          ],
        };
      }

      return {
        stage: 'area_score_propose',
        dimensionId: currentDimensionId,
        messageType: 'question',
        content: {
          en: `What current and target scores would you assign to **${label.en}** (scale ${scale.min}-${scale.max})?`,
          pl: `Jakie obecne i docelowe oceny przypisałbyś do **${label.pl}** (skala ${scale.min}-${scale.max})?`,
        },
        actions: [
          {
            id: 'set_scores',
            label: { en: 'Set scores', pl: 'Ustaw oceny' },
            type: 'next',
          },
        ],
      };
    }

    case 'consistency_check': {
      const issues = state.consistencyIssues;
      if (issues.length === 0) {
        return {
          stage: 'consistency_check',
          dimensionId: null,
          messageType: 'summary',
          content: {
            en: 'All scores passed the consistency check. No contradictions or unrealistic gaps detected. Ready to proceed to the summary.',
            pl: 'Wszystkie oceny przeszły kontrolę spójności. Nie wykryto sprzeczności ani nierealistycznych luk. Gotowe do przejścia do podsumowania.',
          },
          actions: [
            {
              id: 'to_summary',
              label: { en: 'View summary', pl: 'Zobacz podsumowanie' },
              type: 'next',
            },
          ],
        };
      }

      const issueList = issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
      return {
        stage: 'consistency_check',
        dimensionId: null,
        messageType: 'warn',
        content: {
          en: `Consistency check found ${issues.length} issue(s):\n${issueList}\n\nWould you like to review and adjust the affected scores?`,
          pl: `Kontrola spójności wykryła ${issues.length} problem(ów):\n${issueList}\n\nCzy chcesz przejrzeć i skorygować dotknięte oceny?`,
        },
        actions: [
          {
            id: 'review_issues',
            label: { en: 'Review & fix', pl: 'Przejrzyj i napraw' },
            type: 'modify',
          },
          {
            id: 'accept_issues',
            label: { en: 'Accept as-is', pl: 'Zaakceptuj bez zmian' },
            type: 'accept',
          },
        ],
      };
    }

    case 'summary': {
      const scored = Object.keys(state.proposedScores).length;
      const total = dimIds.length;
      const evidenced = Object.keys(state.evidenceCollected).length;
      const avgCurrent =
        scored > 0
          ? (
              Object.values(state.proposedScores).reduce((s, v) => s + v.current, 0) / scored
            ).toFixed(1)
          : '0';
      const avgTarget =
        scored > 0
          ? (
              Object.values(state.proposedScores).reduce((s, v) => s + v.target, 0) / scored
            ).toFixed(1)
          : '0';

      return {
        stage: 'summary',
        dimensionId: null,
        messageType: 'summary',
        content: {
          en: `Assessment summary for ${fwUpper}:\n• Dimensions scored: ${scored}/${total}\n• Evidence collected: ${evidenced}/${scored}\n• Average current score: ${avgCurrent}\n• Average target score: ${avgTarget}\n• Consistency issues: ${state.consistencyIssues.length}`,
          pl: `Podsumowanie oceny ${fwUpper}:\n• Ocenione wymiary: ${scored}/${total}\n• Zebrane dowody: ${evidenced}/${scored}\n• Średni obecny wynik: ${avgCurrent}\n• Średni docelowy wynik: ${avgTarget}\n• Problemy spójności: ${state.consistencyIssues.length}`,
        },
        actions: [
          {
            id: 'to_initiatives',
            label: { en: 'Generate initiatives', pl: 'Generuj inicjatywy' },
            type: 'next',
          },
          {
            id: 'to_export',
            label: { en: 'Export results', pl: 'Eksportuj wyniki' },
            type: 'next',
          },
        ],
      };
    }

    case 'initiatives': {
      return {
        stage: 'initiatives',
        dimensionId: null,
        messageType: 'action',
        content: {
          en: 'Based on the gaps identified, I can generate transformation initiatives targeting the dimensions with the largest improvement potential. Shall I proceed?',
          pl: 'Na podstawie zidentyfikowanych luk mogę wygenerować inicjatywy transformacyjne ukierunkowane na wymiary z największym potencjałem poprawy. Czy kontynuować?',
        },
        actions: [
          {
            id: 'generate',
            label: { en: 'Generate initiatives', pl: 'Generuj inicjatywy' },
            type: 'accept',
          },
          {
            id: 'skip_initiatives',
            label: { en: 'Skip', pl: 'Pomiń' },
            type: 'skip',
          },
        ],
      };
    }

    case 'export': {
      return {
        stage: 'export',
        dimensionId: null,
        messageType: 'action',
        content: {
          en: 'The assessment is complete. You can export the results as a PDF report, save to the project, or share with stakeholders.',
          pl: 'Ocena jest zakończona. Możesz wyeksportować wyniki jako raport PDF, zapisać w projekcie lub udostępnić interesariuszom.',
        },
        actions: [
          {
            id: 'export_pdf',
            label: { en: 'Export PDF', pl: 'Eksportuj PDF' },
            type: 'accept',
          },
          {
            id: 'save_project',
            label: { en: 'Save to project', pl: 'Zapisz w projekcie' },
            type: 'accept',
          },
        ],
      };
    }

    default:
      return buildNoDimensionMessage(stage);
  }
}

function buildNoDimensionMessage(stage: CoachStage): CoachMessage {
  return {
    stage,
    dimensionId: null,
    messageType: 'warn',
    content: {
      en: 'No dimension is currently selected. Please select a dimension to continue.',
      pl: 'Żaden wymiar nie jest obecnie wybrany. Wybierz wymiar, aby kontynuować.',
    },
    actions: [
      { id: 'select_dim', label: { en: 'Select dimension', pl: 'Wybierz wymiar' }, type: 'next' },
    ],
  };
}

export function advanceCoachState(
  state: CoachState,
  action: string,
  payload?: { current?: number; target?: number; evidence?: string }
): CoachState {
  const dimIds = getDimensionIds(state.frameworkId);
  const next = { ...state };

  switch (state.stage) {
    case 'kickoff': {
      if (action === 'start' || action === 'next') {
        const firstDim = dimIds[0] ?? null;
        next.stage = 'area_questions';
        next.currentDimensionId = firstDim;
      } else if (action === 'skip_to_review' || action === 'skip') {
        next.stage = 'consistency_check';
        next.consistencyIssues = runConsistencyCheck({
          frameworkId: state.frameworkId,
          scores: state.proposedScores,
        });
      }
      break;
    }

    case 'area_questions': {
      if (action === 'skip_dim' || action === 'skip') {
        moveToNextDimension(next, dimIds);
      } else {
        next.stage = 'area_evidence';
      }
      break;
    }

    case 'area_evidence': {
      if (state.currentDimensionId && payload?.evidence) {
        next.evidenceCollected = {
          ...state.evidenceCollected,
          [state.currentDimensionId]: payload.evidence,
        };
      }
      next.stage = 'area_score_propose';
      break;
    }

    case 'area_score_propose': {
      if (action === 'accept' && state.currentDimensionId) {
        if (!next.completedDimensions.includes(state.currentDimensionId)) {
          next.completedDimensions = [...state.completedDimensions, state.currentDimensionId];
        }
        moveToNextDimension(next, dimIds);
      } else if (action === 'modify' && state.currentDimensionId && payload) {
        const current =
          payload.current ?? state.proposedScores[state.currentDimensionId]?.current ?? 0;
        const target =
          payload.target ?? state.proposedScores[state.currentDimensionId]?.target ?? 0;
        next.proposedScores = {
          ...state.proposedScores,
          [state.currentDimensionId]: { current, target },
        };
      } else if (action === 'reject') {
        next.stage = 'area_questions';
      } else if (action === 'set_scores' && state.currentDimensionId && payload) {
        next.proposedScores = {
          ...state.proposedScores,
          [state.currentDimensionId]: {
            current: payload.current ?? 0,
            target: payload.target ?? 0,
          },
        };
      }
      break;
    }

    case 'consistency_check': {
      if (action === 'review_issues' || action === 'modify') {
        const firstIssued = findFirstIssuedDimension(state);
        if (firstIssued) {
          next.stage = 'area_questions';
          next.currentDimensionId = firstIssued;
        } else {
          next.stage = 'summary';
        }
      } else {
        next.stage = 'summary';
      }
      break;
    }

    case 'summary': {
      if (action === 'to_initiatives' || action === 'next') {
        next.stage = 'initiatives';
      } else if (action === 'to_export') {
        next.stage = 'export';
      }
      break;
    }

    case 'initiatives': {
      next.stage = 'export';
      break;
    }

    case 'export': {
      break;
    }
  }

  return next;
}

function moveToNextDimension(state: CoachState, dimIds: string[]): void {
  if (!state.currentDimensionId) {
    state.stage = 'consistency_check';
    state.consistencyIssues = runConsistencyCheck({
      frameworkId: state.frameworkId,
      scores: state.proposedScores,
    });
    return;
  }

  const currentIdx = dimIds.indexOf(state.currentDimensionId);
  const nextIdx = currentIdx + 1;

  if (nextIdx < dimIds.length) {
    state.stage = 'area_questions';
    state.currentDimensionId = dimIds[nextIdx];
  } else {
    state.stage = 'consistency_check';
    state.currentDimensionId = null;
    state.consistencyIssues = runConsistencyCheck({
      frameworkId: state.frameworkId,
      scores: state.proposedScores,
    });
  }
}

function findFirstIssuedDimension(state: CoachState): string | null {
  const dimIds = getDimensionIds(state.frameworkId);
  const relatedPairs = RELATED_DIMENSIONS[state.frameworkId.toUpperCase()] ?? [];
  const issuedDims = new Set<string>();

  for (const [a, b] of relatedPairs) {
    const scoreA = state.proposedScores[a];
    const scoreB = state.proposedScores[b];
    if (scoreA && scoreB && Math.abs(scoreA.current - scoreB.current) > 2) {
      issuedDims.add(a);
      issuedDims.add(b);
    }
  }

  for (const dimId of dimIds) {
    if (issuedDims.has(dimId)) return dimId;
  }
  return null;
}

// ============================================
// CONSISTENCY CHECK
// ============================================

export function runConsistencyCheck(params: {
  frameworkId: string;
  scores: Record<string, { current: number; target: number }>;
}): string[] {
  const { frameworkId, scores } = params;
  const fwUpper = frameworkId.toUpperCase();
  const issues: string[] = [];
  const scale = FRAMEWORK_SCALES[fwUpper] ?? { min: 0, max: 5 };
  const maxGap = scale.max - scale.min;
  const unrealisticThreshold = maxGap > 5 ? 4 : 3;

  const entries = Object.entries(scores);
  if (entries.length === 0) return issues;

  // 1. Unrealistically high target gaps
  for (const [dimId, { current, target }] of entries) {
    const gap = target - current;
    if (gap > unrealisticThreshold) {
      const label = getDimensionLabel(dimId);
      issues.push(
        `Unrealistic gap in ${label.en}: current=${current}, target=${target} (gap=${gap} exceeds ${unrealisticThreshold})`
      );
    }
  }

  // 2. Contradictions between related dimensions
  const relatedPairs = RELATED_DIMENSIONS[fwUpper] ?? [];
  for (const [dimA, dimB] of relatedPairs) {
    const scoreA = scores[dimA];
    const scoreB = scores[dimB];
    if (scoreA && scoreB) {
      const diff = Math.abs(scoreA.current - scoreB.current);
      if (diff > 2) {
        const labelA = getDimensionLabel(dimA);
        const labelB = getDimensionLabel(dimB);
        issues.push(
          `Contradiction: ${labelA.en} (${scoreA.current}) vs ${labelB.en} (${scoreB.current}) — related dimensions differ by ${diff}`
        );
      }
    }
  }

  // 3. Missing targets for scored dimensions
  for (const [dimId, { current, target }] of entries) {
    if (current > 0 && target === 0) {
      const label = getDimensionLabel(dimId);
      issues.push(`Missing target for ${label.en}: scored at ${current} but target is 0`);
    }
  }

  // 4. All dimensions at the same score (likely not a real assessment)
  if (entries.length >= 3) {
    const currentScores = entries.map(([, v]) => v.current);
    const allSame = currentScores.every((s) => s === currentScores[0]);
    if (allSame && currentScores[0] > 0) {
      issues.push(
        `All ${entries.length} dimensions scored identically at ${currentScores[0]} — this may indicate a superficial assessment`
      );
    }
  }

  // 5. Target lower than current
  for (const [dimId, { current, target }] of entries) {
    if (target > 0 && target < current) {
      const label = getDimensionLabel(dimId);
      issues.push(`Target below current for ${label.en}: current=${current}, target=${target}`);
    }
  }

  return issues;
}
