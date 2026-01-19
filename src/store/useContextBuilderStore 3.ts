import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Api } from '@/services/api';

import { DynamicListItem } from '../views/ContextBuilder/shared/DynamicList';

// Define the types for each module's data
interface CompanyProfileState {
  companyName: string;
  industry: string;
  subIndustry: string;
  ownership: string;
  growthStage: string;
  employees: string;
  revenue: string;
  currentMaturityLevel: string;
  targetMaturityLevel: string;
  operationalFootprint: string; // 'Single Site' | 'Multi-Site'
  locations: string;
  targetMarkets: string[]; // e.g., 'Domestic Only'
  certifications: string[];

  // Operating Model
  productionSystem: string; // 'mto', 'mts', etc.
  shiftPattern: string;
  automationLevel: number; // 0-100

  // Org & Roles
  decisionMaking: string;
  workforceDynamics: {
    demographics: string;
    turnover: string;
    digitalReadiness: string;
    changeAppetite: string;
  };

  // Lists
  processes: DynamicListItem[];
  stakeholders: DynamicListItem[];
  initiatives: DynamicListItem[]; // History

  // Constraints
  activeConstraints: string[]; // IDs of checked constraints
  constraintDetails: Record<string, string>; // ID -> Description
}

interface GoalsState {
  primaryObjective: string;
  strategicGoals: DynamicListItem[]; // For Synthesis Summary
  successMetrics: DynamicListItem[]; // For Synthesis Summary
  secondaryObjectives: string;
  topPriorities: string[];

  kpis: DynamicListItem[];
  inScope: DynamicListItem[];
  outScope: DynamicListItem[];
  noGo: DynamicListItem[];

  // Expectations
  transformationArchetype: string;
  aiRole: string;
  steeringCadence: string;
}

interface ChallengesState {
  declaredChallenges: DynamicListItem[];
  rootCauseAnswers: Record<number, string>; // Question Index -> Answer
  evidence: DynamicListItem[];

  // Blockers (using a specific structure or dynamic list)
  activeBlockers: Array<{
    id: string;
    type: string;
    title: string;
    desc: string;
    status: 'detected' | 'confirmed' | 'manual';
    confidence?: string;
  }>;
}

interface TrendState {
  selectedIndustry: string;
  // We might not need to store full megatrend objects here if they come from another store,
  // but we should store WHICH ones are selected/prioritized if that's a feature.
  // For now, let's assume the Megatrend module manages its own selection or we use the existing useMegatrendStore.
  // We'll add fields if we need to cross-reference them in Synthesis.
}

interface SynthesisState {
  risks: DynamicListItem[];
  strengths: DynamicListItem[];
  selectedScenarioId: string;
  // We could store the generated scenario options here too if we want them to persist
  scenarios?: Array<unknown>;
}

interface ContextBuilderState {
  companyProfile: CompanyProfileState;
  goals: GoalsState;
  challenges: ChallengesState;
  synthesis: SynthesisState;

  // Actions
  setCompanyProfile: (data: Partial<CompanyProfileState>) => void;
  setGoals: (data: Partial<GoalsState>) => void;
  setChallenges: (data: Partial<ChallengesState>) => void;
  setSynthesis: (data: Partial<SynthesisState>) => void;

  // Specific List Actions (helpers to avoid massive boilerplate in components)
  updateCompanyList: (
    listName: 'processes' | 'stakeholders' | 'initiatives',
    items: DynamicListItem[]
  ) => void;
  updateGoalsList: (
    listName: 'kpis' | 'inScope' | 'outScope' | 'noGo',
    items: DynamicListItem[]
  ) => void;
  updateChallengesList: (
    listName: 'declaredChallenges' | 'evidence',
    items: DynamicListItem[]
  ) => void;
  updateSynthesisList: (listName: 'risks' | 'strengths', items: DynamicListItem[]) => void;

  // Async Actions
  isGenerating: boolean;
  generateAnalysis: () => Promise<void>;

  reset: () => void;
}

const initialCompanyProfile: CompanyProfileState = {
  companyName: '',
  industry: 'Manufacturing',
  subIndustry: 'Automotive',
  ownership: '',
  growthStage: '',
  employees: '',
  revenue: '',
  currentMaturityLevel: '',
  targetMaturityLevel: '',
  operationalFootprint: '',
  locations: '',
  targetMarkets: [],
  certifications: [],
  productionSystem: '',
  shiftPattern: '',
  automationLevel: 50,
  decisionMaking: '',
  workforceDynamics: {
    demographics: '',
    turnover: '',
    digitalReadiness: '',
    changeAppetite: '',
  },
  processes: [],
  stakeholders: [],
  initiatives: [],
  activeConstraints: [],
  constraintDetails: {},
};

const initialGoals: GoalsState = {
  primaryObjective: '',
  strategicGoals: [],
  successMetrics: [],
  secondaryObjectives: '',
  topPriorities: [],
  kpis: [],
  inScope: [],
  outScope: [],
  noGo: [],
  transformationArchetype: '',
  aiRole: '',
  steeringCadence: '',
};

const initialChallenges: ChallengesState = {
  declaredChallenges: [],
  rootCauseAnswers: {},
  evidence: [],
  activeBlockers: [],
};

const initialSynthesis: SynthesisState = {
  risks: [],
  strengths: [],
  selectedScenarioId: 'balanced',
  scenarios: [],
};

export const useContextBuilderStore = create<ContextBuilderState>()(
  persist(
    (set, get) => ({
      companyProfile: initialCompanyProfile,
      goals: initialGoals,
      challenges: initialChallenges,
      synthesis: initialSynthesis,
      isGenerating: false,

      setCompanyProfile: (data) =>
        set((state) => ({
          companyProfile: { ...state.companyProfile, ...data },
        })),

      setGoals: (data) =>
        set((state) => ({
          goals: { ...state.goals, ...data },
        })),

      setChallenges: (data) =>
        set((state) => ({
          challenges: { ...state.challenges, ...data },
        })),

      setSynthesis: (data) =>
        set((state) => ({
          synthesis: { ...state.synthesis, ...data },
        })),

      // List Helpers
      updateCompanyList: (listName, items) =>
        set((state) => ({
          companyProfile: { ...state.companyProfile, [listName]: items },
        })),

      updateGoalsList: (listName, items) =>
        set((state) => ({
          goals: { ...state.goals, [listName]: items },
        })),

      updateChallengesList: (listName, items) =>
        set((state) => ({
          challenges: { ...state.challenges, [listName]: items },
        })),

      updateSynthesisList: (listName, items) =>
        set((state) => ({
          synthesis: { ...state.synthesis, [listName]: items },
        })),

      generateAnalysis: async () => {
        set({ isGenerating: true });

        const state = get();
        const { challenges, companyProfile, goals } = state;

        // Try to get AI-generated suggestions
        let aiSuggestions: { risks?: any[]; strengths?: any[] } = {};
        try {
          const contextSummary = `
                        Industry: ${companyProfile.industry} / ${companyProfile.subIndustry}
                        Growth Stage: ${companyProfile.growthStage}
                        Employees: ${companyProfile.employees}
                        Revenue: ${companyProfile.revenue}
                        Constraints: ${companyProfile.activeConstraints.join(', ')}
                        Change Appetite: ${companyProfile.workforceDynamics.changeAppetite}
                        Top Priorities: ${goals.topPriorities.join(', ')}
                        Challenges: ${challenges.declaredChallenges.map((c: any) => c.challenge).join(', ')}
                    `;

          const response = await Api.chatWithAI(
            `Based on this company context, suggest 1-2 key risks and 1-2 strategic opportunities. Output as JSON: {"risks":[{"risk":"","why":"","severity":"High/Medium/Low","mitigation":""}], "strengths":[{"enabler":"","seen":"","leverage":""}]}. Context: ${contextSummary}`,
            [],
            'You are a strategic consultant. Output only valid JSON.'
          );

          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiSuggestions = JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.warn('AI suggestions failed, using rule-based analysis:', error);
        }

        // 1. Generate Risks based on Challenges & Constraints
        const newRisks: DynamicListItem[] = [];

        if (challenges.declaredChallenges.length > 0) {
          newRisks.push({
            id: 'r1',
            risk: `Unresolved Operational Issues`,
            why: `High volume of declared challenges (${challenges.declaredChallenges.length}) may derail focus.`,
            severity: 'High',
            mitigation: 'Prioritize "Quick Wins" track.',
          });
        }

        if (
          companyProfile.activeConstraints.includes('culture') ||
          companyProfile.workforceDynamics.changeAppetite === 'Resistant / Fatigued'
        ) {
          newRisks.push({
            id: 'r2',
            risk: 'Culture Clash',
            why: 'Workforce identified as resistant to change.',
            severity: 'Critical',
            mitigation: 'Heavy investment in Change Mgmt.',
          });
        }
        if (companyProfile.activeConstraints.includes('it')) {
          newRisks.push({
            id: 'r3',
            risk: 'Technical Debt Swamp',
            why: 'Legacy IT systems identified as hard constraint.',
            severity: 'Medium',
            mitigation: 'Parallel IT modernization stream.',
          });
        }

        if (newRisks.length === 0) {
          newRisks.push({
            id: 'r_def',
            risk: 'General Execution Risk',
            why: 'Standard transformation complexity.',
            severity: 'Medium',
            mitigation: 'Robust Governance.',
          });
        }

        // AI Suggested Risks (from real AI if available)
        if (aiSuggestions.risks && aiSuggestions.risks.length > 0) {
          aiSuggestions.risks.forEach((r: any, idx: number) => {
            newRisks.push({
              id: `r_ai_${idx + 1}`,
              risk: r.risk || 'AI Identified Risk',
              why: r.why || 'Identified by AI analysis',
              severity: r.severity || 'Medium',
              mitigation: r.mitigation || 'Review and address.',
              isAiSuggested: true,
            });
          });
        } else {
          // Fallback static suggestion if AI fails
          newRisks.push({
            id: 'r_ai_1',
            risk: 'Compliance Data Gap',
            why: 'Audit 2023 showed missing logs in legacy systems.',
            severity: 'High',
            mitigation: 'Implement immediate logging wrapper.',
            isAiSuggested: true,
          });
        }

        // 2. Generate Strengths & Opportunities based on Profile & Goals
        const newStrengths: DynamicListItem[] = [];

        if (goals.topPriorities.includes('inv')) {
          newStrengths.push({
            id: 's1',
            enabler: 'Innovation Mandate',
            seen: 'Explicit top-priority set by leadership',
            leverage: 'Create "Innovation Lab" pilot.',
          });
        }
        if (companyProfile.growthStage === 'Startup / Scaling') {
          newStrengths.push({
            id: 's2',
            enabler: 'Agility Advantage',
            seen: 'Startup growth stage',
            leverage: 'Iterate fast, fail fast.',
          });
        }
        if (newStrengths.length === 0) {
          newStrengths.push({
            id: 's_def',
            enabler: 'Executive Sponsorship',
            seen: 'Initiative launched by CEO',
            leverage: 'Maintain steerco visibility.',
          });
        }

        // AI Suggested Opportunities (from real AI if available)
        if (aiSuggestions.strengths && aiSuggestions.strengths.length > 0) {
          aiSuggestions.strengths.forEach((s: any, idx: number) => {
            newStrengths.push({
              id: `s_ai_${idx + 1}`,
              enabler: s.enabler || 'AI Identified Opportunity',
              seen: s.seen || 'Identified by AI analysis',
              leverage: s.leverage || 'Explore and leverage.',
              isAiSuggested: true,
            });
          });
        } else {
          // Fallback static suggestion if AI fails
          newStrengths.push({
            id: 's_ai_1',
            enabler: 'Market Gap: AI in ' + companyProfile.subIndustry,
            seen: 'Competitor Analysis',
            leverage: 'First-mover advantage recommended.',
            isAiSuggested: true,
          });
        }

        set((state) => ({
          synthesis: {
            ...state.synthesis,
            risks: newRisks,
            strengths: newStrengths,
          },
          isGenerating: false,
        }));
      },

      reset: () =>
        set({
          companyProfile: initialCompanyProfile,
          goals: initialGoals,
          challenges: initialChallenges,
          synthesis: initialSynthesis,
        }),
    }),
    {
      name: 'consultinity-context-builder',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
