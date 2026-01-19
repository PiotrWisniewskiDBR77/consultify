/**
 * useToolStore - Zustand store for Strategic Tool sessions
 *
 * Manages state for all strategic analysis tools including:
 * - Session lifecycle (create, load, save)
 * - Step navigation and progress
 * - Tool-specific data (SWOT items, Porter forces, etc.)
 * - AI suggestions and generated initiatives
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==================== TYPES ====================

export type ToolType =
  | 'dynamic-swot'
  | 'market-forces'
  | 'growth-paths'
  | 'value-chain'
  | 'portfolio-priority'
  | 'ambition-decomposer'
  | 'focus-tradeoff'
  | 'risk-uncertainty'
  | 'capability-mapper'
  | 'narrative-engine';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface StepDefinition {
  id: string;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  required: boolean;
  aiAssisted: boolean;
}

export interface ToolStep {
  stepId: string;
  status: StepStatus;
  data: Record<string, unknown>;
  aiSuggestions?: string[];
  completedAt?: string;
}

// SWOT-specific types
export interface SWOTItem {
  id: string;
  text: string;
  impact: 'high' | 'medium' | 'low';
  quadrant: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  source?: 'user' | 'ai';
}

export interface SWOTCorrelation {
  id: string;
  items: string[]; // IDs of related SWOT items
  type: 'SO' | 'WO' | 'ST' | 'WT'; // Strength-Opportunity, etc.
  insight: string;
  initiativeProposal?: string;
}

export interface SWOTData {
  context: {
    goal: string;
    scope: string;
    timeframe: 'short' | 'medium' | 'long';
  };
  items: SWOTItem[];
  correlations: SWOTCorrelation[];
  summary?: {
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Porter's Forces types
export interface ForceData {
  id: string;
  name: string;
  score: number; // 1-5
  trend: 'increasing' | 'stable' | 'decreasing';
  drivers: string[];
  aiAnalysis?: string;
}

export interface PorterData {
  context: {
    industry: string;
    geographicScope: string;
    position: 'leader' | 'challenger' | 'follower' | 'niche';
  };
  forces: {
    rivalry: ForceData;
    newEntrants: ForceData;
    substitutes: ForceData;
    buyerPower: ForceData;
    supplierPower: ForceData;
  };
  overallAttractiveness?: number;
  summary?: {
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Initiative draft from tool analysis
export interface InitiativeDraft {
  id: string;
  title: string;
  description: string;
  type: 'strategic' | 'operational' | 'defensive' | 'growth';
  source: ToolType;
  linkedItems: string[]; // IDs of source items (SWOT items, correlations, etc.)
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  rationale: string;
}

// Chat message for tool context
export interface ToolChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  stepId?: string;
}

// Tool session
export interface ToolSession {
  id: string;
  toolType: ToolType;
  name: string;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  steps: ToolStep[];
  inputData: SWOTData | PorterData | Record<string, unknown>;
  chatHistory: ToolChatMessage[];
  generatedInitiatives: InitiativeDraft[];
  status: 'draft' | 'in_progress' | 'completed';
}

// ==================== STEP DEFINITIONS ====================

export const SWOT_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Strategic Context',
    namePl: 'Kontekst Strategiczny',
    description: 'Define the strategic goal, scope, and time horizon',
    descriptionPl: 'Zdefiniuj cel strategiczny, zakres i horyzont czasowy',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'strengths',
    name: 'Strengths',
    namePl: 'Mocne Strony',
    description: 'Identify internal strengths and competitive advantages',
    descriptionPl: 'Zidentyfikuj wewnętrzne mocne strony i przewagi konkurencyjne',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'weaknesses',
    name: 'Weaknesses',
    namePl: 'Słabe Strony',
    description: 'Identify internal weaknesses and areas for improvement',
    descriptionPl: 'Zidentyfikuj wewnętrzne słabości i obszary do poprawy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'opportunities',
    name: 'Opportunities',
    namePl: 'Szanse',
    description: 'Identify external opportunities in the market',
    descriptionPl: 'Zidentyfikuj zewnętrzne szanse rynkowe',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'threats',
    name: 'Threats',
    namePl: 'Zagrożenia',
    description: 'Identify external threats and risks',
    descriptionPl: 'Zidentyfikuj zewnętrzne zagrożenia i ryzyka',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'correlations',
    name: 'Strategic Correlations',
    namePl: 'Korelacje Strategiczne',
    description: 'AI analyzes connections between SWOT elements',
    descriptionPl: 'AI analizuje powiązania między elementami SWOT',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Review analysis and generate strategic initiatives',
    descriptionPl: 'Przegląd analizy i generowanie inicjatyw strategicznych',
    required: true,
    aiAssisted: true,
  },
];

export const PORTER_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Industry Context',
    namePl: 'Kontekst Branżowy',
    description: 'Define the industry, market, and competitive position',
    descriptionPl: 'Zdefiniuj branżę, rynek i pozycję konkurencyjną',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'rivalry',
    name: 'Competitive Rivalry',
    namePl: 'Rywalizacja Konkurencyjna',
    description: 'Assess intensity of competition among existing players',
    descriptionPl: 'Oceń intensywność konkurencji między istniejącymi graczami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'newEntrants',
    name: 'Threat of New Entrants',
    namePl: 'Zagrożenie Nowych Graczy',
    description: 'Evaluate barriers to entry and threat of new competitors',
    descriptionPl: 'Oceń bariery wejścia i zagrożenie ze strony nowych konkurentów',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'substitutes',
    name: 'Threat of Substitutes',
    namePl: 'Zagrożenie Substytutów',
    description: 'Identify substitute products and their impact',
    descriptionPl: 'Zidentyfikuj produkty zastępcze i ich wpływ',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'buyerPower',
    name: 'Buyer Power',
    namePl: 'Siła Nabywców',
    description: 'Assess bargaining power of customers',
    descriptionPl: 'Oceń siłę przetargową klientów',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'supplierPower',
    name: 'Supplier Power',
    namePl: 'Siła Dostawców',
    description: 'Assess bargaining power of suppliers',
    descriptionPl: 'Oceń siłę przetargową dostawców',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Review analysis and generate competitive initiatives',
    descriptionPl: 'Przegląd analizy i generowanie inicjatyw konkurencyjnych',
    required: true,
    aiAssisted: true,
  },
];

// ==================== STORE STATE ====================

interface ToolStoreState {
  // Current session
  currentSession: ToolSession | null;
  currentStep: number;

  // Saved sessions
  savedSessions: ToolSession[];

  // Actions
  createSession: (toolType: ToolType) => void;
  loadSession: (sessionId: string) => void;
  saveSession: () => void;
  deleteSession: (sessionId: string) => void;

  // Navigation
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canAdvanceStep: () => boolean;

  // Data updates
  updateInputData: (data: Partial<SWOTData | PorterData>) => void;
  addSWOTItem: (item: Omit<SWOTItem, 'id'>) => void;
  removeSWOTItem: (itemId: string) => void;
  updateSWOTItem: (itemId: string, updates: Partial<SWOTItem>) => void;

  // AI suggestions
  addAISuggestion: (stepId: string, suggestion: string) => void;
  addCorrelation: (correlation: Omit<SWOTCorrelation, 'id'>) => void;
  addInitiative: (initiative: Omit<InitiativeDraft, 'id'>) => void;

  // Chat
  addChatMessage: (message: Omit<ToolChatMessage, 'id' | 'timestamp'>) => void;

  // Utilities
  getStepDefinitions: () => StepDefinition[];
  calculateProgress: () => number;
}

// ==================== INITIAL DATA ====================

const createInitialSWOTData = (): SWOTData => ({
  context: {
    goal: '',
    scope: '',
    timeframe: 'medium',
  },
  items: [],
  correlations: [],
});

const createInitialPorterData = (): PorterData => ({
  context: {
    industry: '',
    geographicScope: '',
    position: 'challenger',
  },
  forces: {
    rivalry: { id: 'rivalry', name: 'Competitive Rivalry', score: 3, trend: 'stable', drivers: [] },
    newEntrants: {
      id: 'newEntrants',
      name: 'New Entrants',
      score: 3,
      trend: 'stable',
      drivers: [],
    },
    substitutes: { id: 'substitutes', name: 'Substitutes', score: 3, trend: 'stable', drivers: [] },
    buyerPower: { id: 'buyerPower', name: 'Buyer Power', score: 3, trend: 'stable', drivers: [] },
    supplierPower: {
      id: 'supplierPower',
      name: 'Supplier Power',
      score: 3,
      trend: 'stable',
      drivers: [],
    },
  },
});

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ==================== STORE ====================

export const useToolStore = create<ToolStoreState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      currentStep: 1,
      savedSessions: [],

      createSession: (toolType: ToolType) => {
        const steps = toolType === 'dynamic-swot' ? SWOT_STEPS : PORTER_STEPS;
        const initialData =
          toolType === 'dynamic-swot' ? createInitialSWOTData() : createInitialPorterData();

        const session: ToolSession = {
          id: generateId(),
          toolType,
          name: `${toolType} - ${new Date().toLocaleDateString()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentStep: 1,
          steps: steps.map((step) => ({
            stepId: step.id,
            status: 'pending' as StepStatus,
            data: {},
          })),
          inputData: initialData,
          chatHistory: [],
          generatedInitiatives: [],
          status: 'draft',
        };

        set({ currentSession: session, currentStep: 1 });
      },

      loadSession: (sessionId: string) => {
        const { savedSessions } = get();
        const session = savedSessions.find((s) => s.id === sessionId);
        if (session) {
          set({ currentSession: session, currentStep: session.currentStep });
        }
      },

      saveSession: () => {
        const { currentSession, savedSessions } = get();
        if (!currentSession) return;

        const updatedSession = {
          ...currentSession,
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = savedSessions.findIndex((s) => s.id === currentSession.id);
        const newSessions =
          existingIndex >= 0
            ? savedSessions.map((s, i) => (i === existingIndex ? updatedSession : s))
            : [...savedSessions, updatedSession];

        set({ currentSession: updatedSession, savedSessions: newSessions });
      },

      deleteSession: (sessionId: string) => {
        const { savedSessions, currentSession } = get();
        set({
          savedSessions: savedSessions.filter((s) => s.id !== sessionId),
          currentSession: currentSession?.id === sessionId ? null : currentSession,
        });
      },

      setCurrentStep: (step: number) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const steps = currentSession.toolType === 'dynamic-swot' ? SWOT_STEPS : PORTER_STEPS;
        if (step >= 1 && step <= steps.length) {
          set({
            currentStep: step,
            currentSession: { ...currentSession, currentStep: step },
          });
        }
      },

      nextStep: () => {
        const { currentStep, currentSession } = get();
        if (!currentSession) return;

        const steps = currentSession.toolType === 'dynamic-swot' ? SWOT_STEPS : PORTER_STEPS;
        if (currentStep < steps.length) {
          // Mark current step as completed
          const updatedSteps = currentSession.steps.map((s, i) =>
            i === currentStep - 1
              ? { ...s, status: 'completed' as StepStatus, completedAt: new Date().toISOString() }
              : s
          );

          set({
            currentStep: currentStep + 1,
            currentSession: {
              ...currentSession,
              currentStep: currentStep + 1,
              steps: updatedSteps,
            },
          });
        }
      },

      prevStep: () => {
        const { currentStep, currentSession } = get();
        if (currentStep > 1 && currentSession) {
          set({
            currentStep: currentStep - 1,
            currentSession: { ...currentSession, currentStep: currentStep - 1 },
          });
        }
      },

      canAdvanceStep: () => {
        const { currentSession, currentStep } = get();
        if (!currentSession) return false;

        const steps = currentSession.toolType === 'dynamic-swot' ? SWOT_STEPS : PORTER_STEPS;
        const stepDef = steps[currentStep - 1];

        // Context step: check if required fields are filled
        if (stepDef.id === 'context') {
          const data = currentSession.inputData as SWOTData | PorterData;
          if ('goal' in data.context) {
            return data.context.goal.length > 0 && data.context.scope.length > 0;
          }
          if ('industry' in data.context) {
            return data.context.industry.length > 0;
          }
        }

        // SWOT quadrant steps: check if at least one item exists
        if (['strengths', 'weaknesses', 'opportunities', 'threats'].includes(stepDef.id)) {
          const swotData = currentSession.inputData as SWOTData;
          return swotData.items.some((item) => item.quadrant === stepDef.id);
        }

        return true;
      },

      updateInputData: (data) => {
        const { currentSession } = get();
        if (!currentSession) return;

        set({
          currentSession: {
            ...currentSession,
            inputData: { ...currentSession.inputData, ...data },
          },
        });
      },

      addSWOTItem: (item) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = currentSession.inputData as SWOTData;
        const newItem: SWOTItem = { ...item, id: generateId() };

        set({
          currentSession: {
            ...currentSession,
            inputData: {
              ...swotData,
              items: [...swotData.items, newItem],
            },
          },
        });
      },

      removeSWOTItem: (itemId: string) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = currentSession.inputData as SWOTData;
        set({
          currentSession: {
            ...currentSession,
            inputData: {
              ...swotData,
              items: swotData.items.filter((item) => item.id !== itemId),
            },
          },
        });
      },

      updateSWOTItem: (itemId: string, updates: Partial<SWOTItem>) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = currentSession.inputData as SWOTData;
        set({
          currentSession: {
            ...currentSession,
            inputData: {
              ...swotData,
              items: swotData.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
            },
          },
        });
      },

      addAISuggestion: (stepId: string, suggestion: string) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const updatedSteps = currentSession.steps.map((step) =>
          step.stepId === stepId
            ? { ...step, aiSuggestions: [...(step.aiSuggestions || []), suggestion] }
            : step
        );

        set({
          currentSession: { ...currentSession, steps: updatedSteps },
        });
      },

      addCorrelation: (correlation) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = currentSession.inputData as SWOTData;
        const newCorrelation: SWOTCorrelation = { ...correlation, id: generateId() };

        set({
          currentSession: {
            ...currentSession,
            inputData: {
              ...swotData,
              correlations: [...swotData.correlations, newCorrelation],
            },
          },
        });
      },

      addInitiative: (initiative) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const newInitiative: InitiativeDraft = { ...initiative, id: generateId() };
        set({
          currentSession: {
            ...currentSession,
            generatedInitiatives: [...currentSession.generatedInitiatives, newInitiative],
          },
        });
      },

      addChatMessage: (message) => {
        const { currentSession, currentStep } = get();
        if (!currentSession) return;

        const newMessage: ToolChatMessage = {
          ...message,
          id: generateId(),
          timestamp: new Date().toISOString(),
          stepId: currentSession.steps[currentStep - 1]?.stepId,
        };

        set({
          currentSession: {
            ...currentSession,
            chatHistory: [...currentSession.chatHistory, newMessage],
          },
        });
      },

      getStepDefinitions: () => {
        const { currentSession } = get();
        if (!currentSession) return [];
        return currentSession.toolType === 'dynamic-swot' ? SWOT_STEPS : PORTER_STEPS;
      },

      calculateProgress: () => {
        const { currentSession } = get();
        if (!currentSession) return 0;

        const completedSteps = currentSession.steps.filter((s) => s.status === 'completed').length;
        return Math.round((completedSteps / currentSession.steps.length) * 100);
      },
    }),
    {
      name: 'tool-store',
      partialize: (state) => ({ savedSessions: state.savedSessions }),
    }
  )
);

export default useToolStore;
