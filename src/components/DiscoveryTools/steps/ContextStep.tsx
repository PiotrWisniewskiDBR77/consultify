/**
 * ContextStep - First step for all tools
 *
 * Collects strategic goal, scope, and timeframe.
 * Adapts labels based on tool type.
 */

import type { TFunction } from 'i18next';
import { Calendar, Check, Loader2, MapPin, Sparkles, Target, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  GrowthPathsData,
  OperationalToolData,
  PorterData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SessionGenerationStatus,
  SWOTData,
  ToolSession,
  ToolType,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../InlineAssist';

// ==================== TYPES ====================

interface ContextStepProps {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
  onGenerateFullSession?: () => void;
  onContinue?: () => void;
  sessionGenerationStatus?: SessionGenerationStatus;
  missionSuggestion?: Partial<SWOTData['context']> | null;
  onApplyMissionSuggestion?: () => void;
  onDismissMissionSuggestion?: () => void;
}

// ==================== LABELS ====================

interface ToolLabels {
  title: { en: string; pl: string };
  goalLabel: { en: string; pl: string };
  goalPlaceholder: { en: string; pl: string };
  scopeLabel: { en: string; pl: string };
  scopePlaceholder: { en: string; pl: string };
  successLabel?: { en: string; pl: string };
  successPlaceholder?: { en: string; pl: string };
  timeframeLabel?: { en: string; pl: string };
  positionLabel?: { en: string; pl: string };
}

const LABELS: Record<string, ToolLabels> = {
  'dynamic-swot': {
    title: { en: 'Mission & Context', pl: 'Mission & Context' },
    goalLabel: { en: 'Strategic Question', pl: 'Pytanie strategiczne' },
    goalPlaceholder: {
      en: 'e.g., How do we grow in the premium segment without hurting margin?',
      pl: 'np. Jak rosnąć w segmencie premium bez pogorszenia marży?',
    },
    scopeLabel: { en: 'Scope / Business Area', pl: 'Zakres / Obszar Biznesowy' },
    scopePlaceholder: {
      en: 'e.g., Sales and Marketing department - B2B segment',
      pl: 'np. Dział Sprzedaży i Marketingu - segment B2B',
    },
    successLabel: { en: 'Success Signal', pl: 'Sygnał sukcesu' },
    successPlaceholder: {
      en: 'e.g., 15% faster onboarding, higher win-rate, improved retention',
      pl: 'np. 15% szybszy onboarding, wyższy win-rate, lepsza retencja',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'market-forces': {
    title: { en: 'Industry Context', pl: 'Kontekst Branżowy' },
    goalLabel: { en: 'Industry / Market', pl: 'Branża / Rynek' },
    goalPlaceholder: {
      en: 'e.g., Enterprise SaaS - Project Management Software',
      pl: 'np. Enterprise SaaS - Oprogramowanie do zarządzania projektami',
    },
    scopeLabel: { en: 'Geographic Scope', pl: 'Zakres Geograficzny' },
    scopePlaceholder: {
      en: 'e.g., European Union market',
      pl: 'np. Rynek Unii Europejskiej',
    },
    positionLabel: { en: 'Market Position', pl: 'Pozycja Rynkowa' },
  },
  'growth-paths': {
    title: { en: 'Growth Context', pl: 'Kontekst Wzrostu' },
    goalLabel: { en: 'Growth Goal', pl: 'Cel Wzrostu' },
    goalPlaceholder: {
      en: 'e.g., Increase revenue in core segment by 20%',
      pl: 'np. Zwiększenie przychodów w segmencie core o 20%',
    },
    scopeLabel: { en: 'Scope / Business Area', pl: 'Zakres / Obszar Biznesowy' },
    scopePlaceholder: {
      en: 'e.g., Existing products for SMB customers',
      pl: 'np. Obecne produkty dla klientów SMB',
    },
    successLabel: { en: 'Success Signal', pl: 'Sygnał sukcesu' },
    successPlaceholder: {
      en: 'e.g., +20% revenue with stable margin and repeatable acquisition',
      pl: 'np. +20% przychodu przy stabilnej marży i powtarzalnym pozyskaniu',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'portfolio-priority': {
    title: { en: 'Portfolio Context', pl: 'Kontekst Portfolio' },
    goalLabel: { en: 'Portfolio Goal', pl: 'Cel Portfolio' },
    goalPlaceholder: {
      en: 'e.g., Balance growth and cash generation',
      pl: 'np. Balans wzrostu i generowania gotówki',
    },
    scopeLabel: { en: 'Portfolio Scope', pl: 'Zakres Portfolio' },
    scopePlaceholder: {
      en: 'e.g., Strategic initiatives for 2026',
      pl: 'np. Inicjatywy strategiczne na 2026',
    },
    successLabel: { en: 'Success Signal', pl: 'Sygnał sukcesu' },
    successPlaceholder: {
      en: 'e.g., clear invest/maintain/test/harvest/stop decisions',
      pl: 'np. jasne decyzje invest/maintain/test/harvest/stop',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'risk-uncertainty': {
    title: { en: 'Risk Context', pl: 'Kontekst Ryzyka' },
    goalLabel: { en: 'Risk Scope', pl: 'Zakres Ryzyk' },
    goalPlaceholder: {
      en: 'e.g., Transformation program risks',
      pl: 'np. Ryzyka programu transformacji',
    },
    scopeLabel: { en: 'Business Scope', pl: 'Zakres Biznesowy' },
    scopePlaceholder: {
      en: 'e.g., Enterprise transformation',
      pl: 'np. Transformacja całej organizacji',
    },
    successLabel: { en: 'Success Signal', pl: 'Sygnał sukcesu' },
    successPlaceholder: {
      en: 'e.g., clear validation, mitigation, monitoring and escalation moves',
      pl: 'np. jasne ruchy walidacji, mitygacji, monitoringu i eskalacji',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'sop-builder': {
    title: { en: 'SOP Context', pl: 'Kontekst SOP' },
    goalLabel: { en: 'Operational Goal', pl: 'Cel Operacyjny' },
    goalPlaceholder: {
      en: 'e.g., Standardize order picking process',
      pl: 'np. Standaryzacja procesu kompletacji zamówień',
    },
    scopeLabel: { en: 'Scope / Process', pl: 'Zakres / Proces' },
    scopePlaceholder: {
      en: 'e.g., Warehouse operations',
      pl: 'np. Operacje magazynowe',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'a3-problem-solving': {
    title: { en: 'Problem Context', pl: 'Kontekst Problemu' },
    goalLabel: { en: 'Problem Statement', pl: 'Opis Problemu' },
    goalPlaceholder: {
      en: 'e.g., Late deliveries exceed SLA by 12%',
      pl: 'np. Opóźnienia dostaw przekraczają SLA o 12%',
    },
    scopeLabel: { en: 'Scope / Area', pl: 'Zakres / Obszar' },
    scopePlaceholder: {
      en: 'e.g., Fulfillment operations',
      pl: 'np. Operacje realizacji zamówień',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'smed-planner': {
    title: { en: 'Changeover Context', pl: 'Kontekst Przezbrojeń' },
    goalLabel: { en: 'Changeover Goal', pl: 'Cel Przezbrojeń' },
    goalPlaceholder: {
      en: 'e.g., Reduce changeover time by 30%',
      pl: 'np. Redukcja czasu przezbrojeń o 30%',
    },
    scopeLabel: { en: 'Scope / Line', pl: 'Zakres / Linia' },
    scopePlaceholder: {
      en: 'e.g., Packaging line 2',
      pl: 'np. Linia pakowania 2',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'dms-builder': {
    title: { en: 'DMS Context', pl: 'Kontekst DMS' },
    goalLabel: { en: 'DMS Goal', pl: 'Cel DMS' },
    goalPlaceholder: {
      en: 'e.g., Improve daily KPI tracking',
      pl: 'np. Usprawnienie codziennego monitoringu KPI',
    },
    scopeLabel: { en: 'Scope / Teams', pl: 'Zakres / Zespoły' },
    scopePlaceholder: {
      en: 'e.g., Production + Maintenance',
      pl: 'np. Produkcja + Utrzymanie ruchu',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'inventory-autopilot': {
    title: { en: 'Inventory Context', pl: 'Kontekst Zapasów' },
    goalLabel: { en: 'Inventory Goal', pl: 'Cel Zapasów' },
    goalPlaceholder: {
      en: 'e.g., Reduce stockouts below 2%',
      pl: 'np. Redukcja braków poniżej 2%',
    },
    scopeLabel: { en: 'Scope / SKUs', pl: 'Zakres / SKU' },
    scopePlaceholder: {
      en: 'e.g., Top 500 SKUs',
      pl: 'np. Top 500 SKU',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
};

function buildDynamicSwotSeedProposal(t: TFunction): SWOTData['context'] {
  return {
    understanding: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.understanding'),
    directionChoice: 'company-direction',
    directionChoices: ['company-direction'],
    goal: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.goal'),
    scopeChoice: 'whole-company',
    scopeChoices: ['whole-company'],
    scope: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.scope'),
    successChoice: 'direction-and-priorities',
    successChoices: ['direction-and-priorities'],
    successSignal: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.successSignal'),
    timeframe: 'medium' as const,
    kpiTarget: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.kpiTarget'),
    constraints: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.constraints'),
    assumptions: t('discoveryToolsSteps.contextStep.dynamicSwot.seed.assumptions'),
    understandingComment: '',
    directionComment: '',
    scopeComment: '',
    horizonComment: '',
    successComment: '',
    question4Choices: [],
    question5Choices: [],
    question1Confirmed: false,
    question2Confirmed: false,
    question3Confirmed: false,
    question4Confirmed: false,
    question5Confirmed: false,
    constraintsComment: '',
  };
}

// ==================== COMPONENT ====================

export const ContextStep: React.FC<ContextStepProps> = ({
  toolType,
  session,
  isPolish,
  onGenerateFullSession,
  onContinue,
  sessionGenerationStatus,
  missionSuggestion,
  onApplyMissionSuggestion,
  onDismissMissionSuggestion,
}) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [activeMissionFeedback, setActiveMissionFeedback] = React.useState<{
    blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints';
    mode: 'comment' | 'think-deeper';
  } | null>(null);
  const [missionFeedbackInput, setMissionFeedbackInput] = React.useState('');
  const [selectedDeepDive, setSelectedDeepDive] = React.useState('');

  const labels = LABELS[toolType as keyof typeof LABELS] || LABELS['dynamic-swot'];
  const lang = isPolish ? 'pl' : 'en';

  // Get current context data
  const rawContextData = (
    session.inputData as
      | SWOTData
      | PorterData
      | GrowthPathsData
      | PortfolioPriorityData
      | RiskUncertaintyData
      | OperationalToolData
      | undefined
  )?.context;
  const [activeMissionQuestion, setActiveMissionQuestion] = React.useState(() => {
    const context = (rawContextData || {}) as Partial<SWOTData['context']>;
    if (context.question5Confirmed) return 6;
    if (context.question4Confirmed) return 5;
    if (context.question3Confirmed) return 4;
    if (context.question2Confirmed) return 3;
    if (context.question1Confirmed) return 2;
    return 1;
  });

  React.useEffect(() => {
    const context = (rawContextData || {}) as Partial<SWOTData['context']>;
    setActiveMissionQuestion(
      context.question5Confirmed
        ? 6
        : context.question4Confirmed
          ? 5
          : context.question3Confirmed
            ? 4
            : context.question2Confirmed
              ? 3
              : context.question1Confirmed
                ? 2
                : 1
    );
    setActiveMissionFeedback(null);
    setMissionFeedbackInput('');
  }, [session.id]);

  const contextData = React.useMemo(() => {
    if (rawContextData && typeof rawContextData === 'object') {
      return rawContextData;
    }

    if (toolType === 'market-forces') {
      return {
        industry: '',
        geographicScope: '',
        position: 'challenger' as const,
      };
    }

    return {
      goal: '',
      scope: '',
      timeframe: 'medium' as const,
      ...(toolType === 'dynamic-swot'
        ? { successSignal: '', assumptions: '', constraints: '', kpiTarget: '' }
        : {}),
    };
  }, [rawContextData, toolType]);

  // Handle input changes
  const handleChange = (field: string, value: string) => {
    updateInputData({
      context: {
        ...contextData,
        [field]: value,
      },
    } as Partial<SWOTData | PorterData>);
  };

  // Handle timeframe change (SWOT)
  const handleTimeframeChange = (value: 'short' | 'medium' | 'long') => {
    updateInputData({
      context: {
        ...contextData,
        timeframe: value,
      },
    } as Partial<
      SWOTData | GrowthPathsData | PortfolioPriorityData | RiskUncertaintyData | OperationalToolData
    >);
  };

  // Handle position change (Porter)
  const handlePositionChange = (value: 'leader' | 'challenger' | 'follower' | 'niche') => {
    updateInputData({
      context: {
        ...contextData,
        position: value,
      },
    } as Partial<PorterData>);
  };

  const dynamicSwotMissionContext = contextData as SWOTData['context'];
  const dynamicSwotSeedProposal = buildDynamicSwotSeedProposal(t);

  if (toolType === 'dynamic-swot') {
    const missionContext = dynamicSwotMissionContext;
    const isGenerating = sessionGenerationStatus === 'generating';
    const updateMissionContext = (patch: Partial<SWOTData['context']>) => {
      updateInputData({
        context: {
          ...missionContext,
          ...patch,
        },
      } as Partial<SWOTData>);
    };

    const seededProposal = dynamicSwotSeedProposal;

    const sanitizeMissionBlockText = (value: string) =>
      value
        .replace(/\s*Ten blok jest teraz pogłębiony w kierunku:[^.]+\./gi, '')
        .replace(/\s*W tej wersji mocniej uwzględniamy komentarz:[^.]+\./gi, '')
        .replace(/\s*This block is now deepened in the direction of:[^.]+\./gi, '')
        .replace(/\s*This version more strongly incorporates the comment:[^.]+\./gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const appendMissionRefinement = (baseText: string, refinement: string) => {
      const normalizedBase = sanitizeMissionBlockText(baseText).replace(/\s*[.!?]\s*$/, '');
      return normalizedBase ? `${normalizedBase}. ${refinement}` : refinement;
    };

    const buildMissionBlockRevision = (
      blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints',
      baseText: string,
      instruction: string,
      mode: 'comment' | 'think-deeper'
    ) => {
      const detail = instruction.trim().replace(/\s*[.!?]\s*$/, '');
      const cleanBase = sanitizeMissionBlockText(baseText);

      if (!detail) {
        return cleanBase;
      }

      const modeKey = mode === 'comment' ? 'comment' : 'thinkDeeper';
      const refinement = t(
        `discoveryToolsSteps.contextStep.dynamicSwot.refinement.${blockId}.${modeKey}`,
        { detail, detailLower: detail.toLowerCase() }
      );
      return appendMissionRefinement(cleanBase, refinement);
    };

    const displayedContext = {
      goal: sanitizeMissionBlockText(missionContext.goal || seededProposal.goal),
      scope: sanitizeMissionBlockText(missionContext.scope || seededProposal.scope),
      successSignal: sanitizeMissionBlockText(
        missionContext.successSignal || seededProposal.successSignal || ''
      ),
      timeframe: missionContext.timeframe || seededProposal.timeframe,
      kpiTarget: missionContext.kpiTarget || seededProposal.kpiTarget,
      constraints: sanitizeMissionBlockText(
        missionContext.constraints || seededProposal.constraints || ''
      ),
      assumptions: missionContext.assumptions || seededProposal.assumptions,
      understanding: sanitizeMissionBlockText(
        missionContext.understanding || seededProposal.understanding || ''
      ),
      directionChoice: missionContext.directionChoice || seededProposal.directionChoice,
      scopeChoice: missionContext.scopeChoice || seededProposal.scopeChoice,
      successChoice: missionContext.successChoice || seededProposal.successChoice,
      directionChoices: missionContext.directionChoices || seededProposal.directionChoices,
      scopeChoices: missionContext.scopeChoices || seededProposal.scopeChoices,
      successChoices: missionContext.successChoices || seededProposal.successChoices,
      question4Choices: missionContext.question4Choices || seededProposal.question4Choices,
      question5Choices: missionContext.question5Choices || seededProposal.question5Choices,
      question1Confirmed: missionContext.question1Confirmed || seededProposal.question1Confirmed,
      question2Confirmed: missionContext.question2Confirmed || seededProposal.question2Confirmed,
      question3Confirmed: missionContext.question3Confirmed || seededProposal.question3Confirmed,
      question4Confirmed: missionContext.question4Confirmed || seededProposal.question4Confirmed,
      question5Confirmed: missionContext.question5Confirmed || seededProposal.question5Confirmed,
      understandingComment:
        missionContext.understandingComment || seededProposal.understandingComment,
      directionComment: missionContext.directionComment || seededProposal.directionComment,
      scopeComment: missionContext.scopeComment || seededProposal.scopeComment,
      horizonComment: missionContext.horizonComment || seededProposal.horizonComment,
      successComment: missionContext.successComment || seededProposal.successComment,
      constraintsComment: missionContext.constraintsComment || '',
    };

    const directionOptions = [
      {
        id: 'company-direction',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.companyDirection.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.direction.companyDirection.description'
        ),
        patch: {
          directionChoice: 'company-direction',
          goal: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.companyDirection.goal'),
        },
      },
      {
        id: 'growth-engine',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.growthEngine.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.direction.growthEngine.description'
        ),
        patch: {
          directionChoice: 'growth-engine',
          goal: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.growthEngine.goal'),
        },
      },
      {
        id: 'market-position',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.marketPosition.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.direction.marketPosition.description'
        ),
        patch: {
          directionChoice: 'market-position',
          goal: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.marketPosition.goal'),
        },
      },
      {
        id: 'capability-shift',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.capabilityShift.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.direction.capabilityShift.description'
        ),
        patch: {
          directionChoice: 'capability-shift',
          goal: t('discoveryToolsSteps.contextStep.dynamicSwot.direction.capabilityShift.goal'),
        },
      },
    ];

    const scopeOptions = [
      {
        id: 'whole-company',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.wholeCompany.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.scope.wholeCompany.description'
        ),
        patch: {
          scopeChoice: 'whole-company',
          scope: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.wholeCompany.scope'),
        },
      },
      {
        id: 'go-to-market',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.goToMarket.label'),
        description: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.goToMarket.description'),
        patch: {
          scopeChoice: 'go-to-market',
          scope: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.goToMarket.scope'),
        },
      },
      {
        id: 'portfolio-focus',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.portfolioFocus.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.scope.portfolioFocus.description'
        ),
        patch: {
          scopeChoice: 'portfolio-focus',
          scope: t('discoveryToolsSteps.contextStep.dynamicSwot.scope.portfolioFocus.scope'),
        },
      },
      {
        id: 'capabilities-and-constraints',
        label: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.scope.capabilitiesAndConstraints.label'
        ),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.scope.capabilitiesAndConstraints.description'
        ),
        patch: {
          scopeChoice: 'capabilities-and-constraints',
          scope: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.scope.capabilitiesAndConstraints.scope'
          ),
        },
      },
    ];

    const successOptions = [
      {
        id: 'direction-and-priorities',
        label: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.success.directionAndPriorities.label'
        ),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.success.directionAndPriorities.description'
        ),
        patch: {
          successChoice: 'direction-and-priorities',
          successSignal: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.success.directionAndPriorities.successSignal'
          ),
        },
      },
      {
        id: 'board-decision',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.success.boardDecision.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.success.boardDecision.description'
        ),
        patch: {
          successChoice: 'board-decision',
          successSignal: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.success.boardDecision.successSignal'
          ),
        },
      },
      {
        id: 'execution-bridge',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.success.executionBridge.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.success.executionBridge.description'
        ),
        patch: {
          successChoice: 'execution-bridge',
          successSignal: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.success.executionBridge.successSignal'
          ),
        },
      },
      {
        id: 'strategic-clarity',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.success.strategicClarity.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.success.strategicClarity.description'
        ),
        patch: {
          successChoice: 'strategic-clarity',
          successSignal: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.success.strategicClarity.successSignal'
          ),
        },
      },
    ];

    const timeframeOptions = [
      {
        id: 'short' as const,
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.timeframe.short.label'),
        description: t('discoveryToolsSteps.contextStep.dynamicSwot.timeframe.short.description'),
      },
      {
        id: 'medium' as const,
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.timeframe.medium.label'),
        description: t('discoveryToolsSteps.contextStep.dynamicSwot.timeframe.medium.description'),
      },
      {
        id: 'long' as const,
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.timeframe.long.label'),
        description: t('discoveryToolsSteps.contextStep.dynamicSwot.timeframe.long.description'),
      },
    ];

    const labelsUi = {
      comment: t('discoveryToolsSteps.contextStep.dynamicSwot.ui.comment'),
      thinkDeeper: isPolish ? 'Dodaj więcej' : 'Add more',
      implement: isPolish ? 'Zastosuj' : 'Apply',
      close: t('discoveryToolsSteps.contextStep.dynamicSwot.ui.close'),
      next: t('discoveryToolsSteps.contextStep.dynamicSwot.ui.next'),
      previous: t('discoveryToolsSteps.contextStep.dynamicSwot.ui.previous'),
      confirm: t('discoveryToolsSteps.contextStep.dynamicSwot.ui.confirm'),
      selectedMany: t('discoveryToolsSteps.contextStep.dynamicSwot.ui.selectedMany'),
    };

    const navButtonClass =
      'inline-flex rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200 dark:hover:bg-navy-700';
    const primaryNavButtonClass =
      'inline-flex rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-200 dark:hover:bg-primary-950/30';

    const toggleChoice = (
      field:
        | 'directionChoices'
        | 'scopeChoices'
        | 'successChoices'
        | 'question4Choices'
        | 'question5Choices',
      value: string
    ) => {
      const currentValues = Array.isArray(displayedContext[field]) ? displayedContext[field] : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      updateMissionContext({
        [field]: nextValues,
        ...(field === 'directionChoices' ? { question1Confirmed: false } : {}),
        ...(field === 'scopeChoices' ? { question2Confirmed: false } : {}),
        ...(field === 'successChoices' ? { question3Confirmed: false } : {}),
        ...(field === 'question4Choices' ? { question4Confirmed: false } : {}),
        ...(field === 'question5Choices' ? { question5Confirmed: false } : {}),
      } as Partial<SWOTData['context']>);
    };

    const composeList = (values: string[]) => values.join(isPolish ? ', ' : ', ');

    const question4Options = (() => {
      const basedOnDirection = displayedContext.directionChoices || [];
      const basedOnScope = displayedContext.scopeChoices || [];

      const options: Array<{ id: string; label: string; description: string }> = [];

      options.push({
        id: 'leadership-choice',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.question4.leadershipChoice.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.question4.leadershipChoice.description'
        ),
      });

      if (
        basedOnDirection.includes('company-direction') ||
        basedOnScope.includes('whole-company')
      ) {
        options.push({
          id: 'whole-company-priority',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question4.wholeCompanyPriority.label'
          ),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question4.wholeCompanyPriority.description'
          ),
        });
      }

      if (basedOnDirection.includes('growth-engine') || basedOnScope.includes('go-to-market')) {
        options.push({
          id: 'growth-source',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.question4.growthSource.label'),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question4.growthSource.description'
          ),
        });
      }

      if (basedOnDirection.includes('market-position')) {
        options.push({
          id: 'positioning-choice',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.question4.positioningChoice.label'),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question4.positioningChoice.description'
          ),
        });
      }

      options.push({
        id: 'trade-off',
        label: t('discoveryToolsSteps.contextStep.dynamicSwot.question4.tradeOff.label'),
        description: t(
          'discoveryToolsSteps.contextStep.dynamicSwot.question4.tradeOff.description'
        ),
      });

      return options.slice(0, 5);
    })();

    const question5Options = (() => {
      const options: Array<{ id: string; label: string; description: string }> = [
        {
          id: 'resource-reality',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.question5.resourceReality.label'),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question5.resourceReality.description'
          ),
        },
        {
          id: 'risk-boundary',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.question5.riskBoundary.label'),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question5.riskBoundary.description'
          ),
        },
        {
          id: 'decision-speed',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.question5.decisionSpeed.label'),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question5.decisionSpeed.description'
          ),
        },
        {
          id: 'board-clarity',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.question5.boardClarity.label'),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question5.boardClarity.description'
          ),
        },
        {
          id: 'execution-readiness',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question5.executionReadiness.label'
          ),
          description: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.question5.executionReadiness.description'
          ),
        },
      ];

      return options;
    })();

    const confirmQuestion = (questionId: 1 | 2 | 3 | 4 | 5) => {
      if (questionId === 1) {
        const labelsSelected = directionOptions
          .filter((option) => (displayedContext.directionChoices || []).includes(option.id))
          .map((option) => option.label);
        updateMissionContext({
          question1Confirmed: true,
          goal:
            labelsSelected.length > 0
              ? t('discoveryToolsSteps.contextStep.dynamicSwot.confirm.direction', {
                  list: composeList(labelsSelected),
                })
              : displayedContext.goal,
        });
      }

      if (questionId === 2) {
        const labelsSelected = scopeOptions
          .filter((option) => (displayedContext.scopeChoices || []).includes(option.id))
          .map((option) => option.label);
        updateMissionContext({
          question2Confirmed: true,
          scope:
            labelsSelected.length > 0
              ? t('discoveryToolsSteps.contextStep.dynamicSwot.confirm.scope', {
                  list: composeList(labelsSelected),
                })
              : displayedContext.scope,
        });
      }

      if (questionId === 3) {
        const labelsSelected = successOptions
          .filter((option) => (displayedContext.successChoices || []).includes(option.id))
          .map((option) => option.label);
        updateMissionContext({
          question3Confirmed: true,
          successSignal:
            labelsSelected.length > 0
              ? t('discoveryToolsSteps.contextStep.dynamicSwot.confirm.success', {
                  list: composeList(labelsSelected),
                })
              : displayedContext.successSignal,
        });
      }

      if (questionId === 4) {
        const labelsSelected = question4Options
          .filter((option) => (displayedContext.question4Choices || []).includes(option.id))
          .map((option) => option.label);
        updateMissionContext({
          question4Confirmed: true,
          assumptions:
            labelsSelected.length > 0
              ? t('discoveryToolsSteps.contextStep.dynamicSwot.confirm.question4', {
                  list: composeList(labelsSelected),
                })
              : displayedContext.assumptions,
        });
      }

      if (questionId === 5) {
        const labelsSelected = question5Options
          .filter((option) => (displayedContext.question5Choices || []).includes(option.id))
          .map((option) => option.label);
        updateMissionContext({
          question5Confirmed: true,
          constraints:
            labelsSelected.length > 0
              ? t('discoveryToolsSteps.contextStep.dynamicSwot.confirm.question5', {
                  list: composeList(labelsSelected),
                })
              : displayedContext.constraints,
        });
      }

      setActiveMissionQuestion(Math.min(6, questionId + 1));
    };

    const selectedDirectionLabels = directionOptions
      .filter((option) => (displayedContext.directionChoices || []).includes(option.id))
      .map((option) => option.label);
    const selectedScopeLabels = scopeOptions
      .filter((option) => (displayedContext.scopeChoices || []).includes(option.id))
      .map((option) => option.label);
    const selectedSuccessLabels = successOptions
      .filter((option) => (displayedContext.successChoices || []).includes(option.id))
      .map((option) => option.label);
    const selectedQuestion4Labels = question4Options
      .filter((option) => (displayedContext.question4Choices || []).includes(option.id))
      .map((option) => option.label);
    const selectedQuestion5Labels = question5Options
      .filter((option) => (displayedContext.question5Choices || []).includes(option.id))
      .map((option) => option.label);

    const summaryCards = [
      {
        label: isPolish ? 'Kierunek strategiczny' : 'Strategic direction',
        value: composeList(
          selectedDirectionLabels.length ? selectedDirectionLabels : [displayedContext.goal]
        ),
      },
      {
        label: isPolish ? 'Zakres decyzji' : 'Decision scope',
        value: composeList(
          selectedScopeLabels.length ? selectedScopeLabels : [displayedContext.scope]
        ),
      },
      {
        label: isPolish ? 'Sygnał sukcesu' : 'Success signal',
        value: composeList(
          selectedSuccessLabels.length ? selectedSuccessLabels : [displayedContext.successSignal]
        ),
      },
      {
        label: isPolish ? 'Założenia i dowody' : 'Assumptions and evidence',
        value: composeList(
          selectedQuestion4Labels.length
            ? selectedQuestion4Labels
            : [displayedContext.assumptions].filter((value): value is string => Boolean(value))
        ),
      },
      {
        label: isPolish ? 'Ograniczenia i kompromisy' : 'Constraints and trade-offs',
        value: composeList(
          selectedQuestion5Labels.length ? selectedQuestion5Labels : [displayedContext.constraints]
        ),
      },
      {
        label: isPolish ? 'Następny etap' : 'Next phase',
        value: isPolish
          ? 'Wejście i eksploracja — zebranie i ocena sygnałów przed budową macierzy.'
          : 'Input & Exploration — collect and assess signals before building the matrix.',
      },
    ];

    const deepDiveOptions: Record<
      'understanding' | 'direction' | 'scope' | 'success' | 'constraints',
      Array<{ id: string; label: string }>
    > = {
      understanding: [
        {
          id: 'broader-strategy',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.deepDive.understanding.broaderStrategy'
          ),
        },
        {
          id: 'leadership-angle',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.deepDive.understanding.leadershipAngle'
          ),
        },
        {
          id: 'real-choice',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.understanding.realChoice'),
        },
      ],
      direction: [
        {
          id: 'competition',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.direction.competition'),
        },
        {
          id: 'capabilities',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.direction.capabilities'),
        },
        {
          id: 'trade-offs',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.direction.tradeOffs'),
        },
      ],
      scope: [
        {
          id: 'narrower-scope',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.scope.narrowerScope'),
        },
        {
          id: 'organization-wide',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.scope.organizationWide'),
        },
        {
          id: 'market-vs-internal',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.scope.marketVsInternal'),
        },
      ],
      success: [
        {
          id: 'decision-readiness',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.deepDive.success.decisionReadiness'
          ),
        },
        {
          id: 'execution-bridge',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.success.executionBridge'),
        },
        {
          id: 'board-material',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.success.boardMaterial'),
        },
      ],
      constraints: [
        {
          id: 'resource-limits',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.deepDive.constraints.resourceLimits'
          ),
        },
        {
          id: 'governance',
          label: t('discoveryToolsSteps.contextStep.dynamicSwot.deepDive.constraints.governance'),
        },
        {
          id: 'risk-tolerance',
          label: t(
            'discoveryToolsSteps.contextStep.dynamicSwot.deepDive.constraints.riskTolerance'
          ),
        },
      ],
    };

    const feedbackTargetField: Record<
      'understanding' | 'direction' | 'scope' | 'success' | 'constraints',
      keyof SWOTData['context']
    > = {
      understanding: 'understanding',
      direction: 'goal',
      scope: 'scope',
      success: 'successSignal',
      constraints: 'constraints',
    };

    const feedbackCommentField: Record<
      'understanding' | 'direction' | 'scope' | 'success' | 'constraints',
      keyof SWOTData['context']
    > = {
      understanding: 'understandingComment',
      direction: 'directionComment',
      scope: 'scopeComment',
      success: 'successComment',
      constraints: 'constraintsComment',
    };

    const handleMissionFeedbackAction = (
      blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints',
      mode: 'comment' | 'think-deeper'
    ) => {
      setActiveMissionFeedback({ blockId, mode });
      setMissionFeedbackInput('');
      setSelectedDeepDive('');
    };

    const handleImplementMissionFeedback = (
      blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints'
    ) => {
      const targetField = feedbackTargetField[blockId];
      const commentField = feedbackCommentField[blockId];
      const currentValue = String(displayedContext[targetField] || '').trim();
      const instruction =
        activeMissionFeedback?.mode === 'think-deeper'
          ? selectedDeepDive
          : missionFeedbackInput.trim();
      const nextValue =
        activeMissionFeedback?.mode && instruction
          ? buildMissionBlockRevision(
              blockId,
              currentValue,
              instruction,
              activeMissionFeedback.mode
            )
          : currentValue;

      if (nextValue === currentValue) {
        return;
      }

      updateMissionContext({
        [targetField]: nextValue,
        [commentField]:
          activeMissionFeedback?.mode === 'think-deeper'
            ? selectedDeepDive
            : missionFeedbackInput.trim(),
      } as Partial<SWOTData['context']>);

      setActiveMissionFeedback(null);
      setMissionFeedbackInput('');
      setSelectedDeepDive('');
    };

    const getMissionBlockPreviewValue = (
      blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints'
    ) => {
      const targetField = feedbackTargetField[blockId];
      const baseText = String(displayedContext[targetField] || '').trim();

      if (activeMissionFeedback?.blockId !== blockId) {
        return baseText;
      }

      const instruction =
        activeMissionFeedback.mode === 'think-deeper'
          ? selectedDeepDive
          : missionFeedbackInput.trim();

      if (!instruction) {
        return baseText;
      }

      return buildMissionBlockRevision(blockId, baseText, instruction, activeMissionFeedback.mode);
    };

    const renderMissionActionBar = (
      blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints'
    ) => {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleMissionFeedbackAction(blockId, 'comment')}
            className="inline-flex rounded-full border border-amber-300/50 bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-800 shadow-sm transition-colors hover:bg-amber-50 dark:border-amber-900/40 dark:bg-white/[0.04] dark:text-amber-200"
          >
            {labelsUi.comment}
          </button>
          <button
            type="button"
            onClick={() => handleMissionFeedbackAction(blockId, 'think-deeper')}
            className="inline-flex rounded-full border border-primary-300/50 bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 shadow-sm transition-colors hover:bg-primary-50 dark:border-primary-900/40 dark:bg-white/[0.04] dark:text-primary-200"
          >
            {labelsUi.thinkDeeper}
          </button>
        </div>
      );
    };

    const renderMissionActionPanel = (
      blockId: 'understanding' | 'direction' | 'scope' | 'success' | 'constraints'
    ) => {
      const isOpen = activeMissionFeedback?.blockId === blockId;
      const mode = activeMissionFeedback?.mode;

      return (
        <div className="mt-4 space-y-3">
          {isOpen && (
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              {mode === 'comment' && (
                <>
                  <textarea
                    value={missionFeedbackInput}
                    onChange={(e) => setMissionFeedbackInput(e.target.value)}
                    rows={3}
                    placeholder={t(
                      'discoveryToolsSteps.contextStep.dynamicSwot.placeholder.feedbackComment'
                    )}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/20 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleImplementMissionFeedback(blockId)}
                      disabled={!missionFeedbackInput.trim()}
                      className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
                    >
                      {labelsUi.implement}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMissionFeedback(null)}
                      className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
                    >
                      {labelsUi.close}
                    </button>
                  </div>
                </>
              )}

              {mode === 'think-deeper' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {deepDiveOptions[blockId].map((option) => {
                      const active = selectedDeepDive === option.label;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedDeepDive(option.label)}
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                            active
                              ? 'border-slate-300 bg-slate-900/[0.07] text-slate-900 dark:border-white/25 dark:bg-white/10 dark:text-slate-100'
                              : 'border-primary-300/50 bg-white/80 text-primary-800 dark:border-primary-900/40 dark:bg-white/[0.04] dark:text-primary-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleImplementMissionFeedback(blockId)}
                      disabled={!selectedDeepDive}
                      className="inline-flex rounded-2xl bg-navy-900 dark:bg-[#F4F7FB] px-4 py-2 text-sm font-medium text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {labelsUi.implement}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMissionFeedback(null)}
                      className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
                    >
                      {labelsUi.close}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(165,28,48,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(165,28,48,0.18),transparent_24%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
          <div className="border-b border-slate-200/70 px-6 py-5 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-primary-400/20 bg-primary-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">
                  {isPolish ? 'Misja i kontekst' : 'Mission & Context'}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.consultantProposal')}
                </span>
              </div>
              <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                {isGenerating
                  ? t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.aiWorking')
                  : 'Draft'}
              </span>
            </div>
            <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-white">
              {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.alignIntent')}
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            {activeMissionQuestion === 1 && (
              <div
                data-testid="mission-question"
                className="rounded-[26px] border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question1Heading')}
                  </div>
                  <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    1/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question1Description')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {labelsUi.selectedMany}
                </div>
                <div className="mt-4 space-y-2">
                  {directionOptions.map((option) => {
                    const active = (displayedContext.directionChoices || []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleChoice('directionChoices', option.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-slate-500 bg-slate-100 shadow-sm dark:border-slate-400 dark:bg-white/[0.08]'
                            : 'border-slate-200 bg-white/80 hover:border-slate-300 dark:border-navy-700 dark:bg-navy-900/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                              active
                                ? 'border-slate-700 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                                : 'border-slate-300 text-slate-600 dark:border-slate-600'
                            }`}
                          >
                            {active ? '●' : ''}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => confirmQuestion(1)}
                      disabled={(displayedContext.directionChoices || []).length === 0}
                      className={primaryNavButtonClass}
                    >
                      {labelsUi.next}
                    </button>
                  </div>
                  {renderMissionActionBar('direction')}
                </div>
                {renderMissionActionPanel('direction')}
              </div>
            )}

            {activeMissionQuestion === 2 && (
              <div
                data-testid="mission-question"
                className="rounded-[26px] border border-sky-200/70 bg-sky-500/5 p-5 shadow-sm dark:border-sky-900/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question2Heading')}
                  </div>
                  <span className="inline-flex rounded-full border border-sky-300/40 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200">
                    2/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question2Description')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {labelsUi.selectedMany}
                </div>
                <div className="mt-4 space-y-2">
                  {scopeOptions.map((option) => {
                    const active = (displayedContext.scopeChoices || []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleChoice('scopeChoices', option.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-sky-950/20'
                            : 'border-sky-200/50 bg-white/80 hover:border-sky-300 dark:border-sky-900/30 dark:bg-navy-900/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                              active
                                ? 'border-sky-500 bg-sky-500 text-white'
                                : 'border-slate-300 text-slate-600 dark:border-slate-600'
                            }`}
                          >
                            {active ? '●' : ''}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMissionQuestion(1)}
                      data-testid="mission-prev"
                      className={navButtonClass}
                    >
                      {labelsUi.previous}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmQuestion(2)}
                      disabled={(displayedContext.scopeChoices || []).length === 0}
                      className={primaryNavButtonClass}
                    >
                      {labelsUi.next}
                    </button>
                  </div>
                  {renderMissionActionBar('scope')}
                </div>
                {renderMissionActionPanel('scope')}
              </div>
            )}

            {activeMissionQuestion === 3 && (
              <div
                data-testid="mission-question"
                className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-5 shadow-sm dark:border-emerald-900/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question3Heading')}
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
                    3/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question3Description')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {labelsUi.selectedMany}
                </div>
                <div className="mt-4 space-y-2">
                  {successOptions.map((option) => {
                    const active = (displayedContext.successChoices || []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleChoice('successChoices', option.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/20'
                            : 'border-emerald-200/50 bg-white/80 hover:border-emerald-300 dark:border-emerald-900/30 dark:bg-navy-900/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                              active
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 text-slate-600 dark:border-slate-600'
                            }`}
                          >
                            {active ? '●' : ''}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {timeframeOptions.map((option) => {
                    const active = displayedContext.timeframe === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleTimeframeChange(option.id)}
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                          active
                            ? 'border-emerald-400 bg-emerald-500 text-white'
                            : 'border-emerald-200/70 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
                        }`}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={displayedContext.horizonComment || ''}
                  onChange={(e) => updateMissionContext({ horizonComment: e.target.value })}
                  rows={2}
                  placeholder={t(
                    'discoveryToolsSteps.contextStep.dynamicSwot.placeholder.horizonComment'
                  )}
                  className="mt-4 w-full resize-none rounded-2xl border border-emerald-200/70 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-900/40 dark:bg-navy-800 dark:text-white"
                />
                <div className="mt-3 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
                  {displayedContext.kpiTarget}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMissionQuestion(2)}
                      data-testid="mission-prev"
                      className={navButtonClass}
                    >
                      {labelsUi.previous}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmQuestion(3)}
                      disabled={(displayedContext.successChoices || []).length === 0}
                      className={primaryNavButtonClass}
                    >
                      {labelsUi.next}
                    </button>
                  </div>
                  {renderMissionActionBar('success')}
                </div>
                {renderMissionActionPanel('success')}
              </div>
            )}

            {activeMissionQuestion === 4 && (
              <div
                data-testid="mission-question"
                className="rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-slate-700 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question4Heading')}
                  </div>
                  <span className="inline-flex rounded-full border border-primary-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200">
                    4/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question4Description')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {labelsUi.selectedMany}
                </div>
                <div className="mt-4 space-y-2">
                  {question4Options.map((option) => {
                    const active = (displayedContext.question4Choices || []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleChoice('question4Choices', option.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/20'
                            : 'border-primary-200/50 bg-white/80 hover:border-primary-300 dark:border-primary-900/30 dark:bg-navy-900/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                              active
                                ? 'border-primary-500 bg-primary-500 text-white'
                                : 'border-slate-300 text-slate-600 dark:border-slate-600'
                            }`}
                          >
                            {active ? '●' : ''}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveMissionQuestion(3)}
                    data-testid="mission-prev"
                    className={navButtonClass}
                  >
                    {labelsUi.previous}
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmQuestion(4)}
                    disabled={(displayedContext.question4Choices || []).length === 0}
                    className={primaryNavButtonClass}
                  >
                    {labelsUi.next}
                  </button>
                </div>
              </div>
            )}

            {activeMissionQuestion === 5 && (
              <div
                data-testid="mission-question"
                className="rounded-[26px] border border-amber-200/70 bg-amber-500/5 p-5 shadow-sm dark:border-amber-900/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question5Heading')}
                  </div>
                  <span className="inline-flex rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
                    5/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.question5Description')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {labelsUi.selectedMany}
                </div>
                <div className="mt-4 space-y-2">
                  {question5Options.map((option) => {
                    const active = (displayedContext.question5Choices || []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleChoice('question5Choices', option.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-amber-300 bg-amber-50 shadow-sm dark:border-amber-700 dark:bg-amber-950/20'
                            : 'border-amber-200/50 bg-white/80 hover:border-amber-300 dark:border-amber-900/30 dark:bg-navy-900/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                              active
                                ? 'border-amber-500 bg-amber-500 text-white'
                                : 'border-slate-300 text-slate-600 dark:border-slate-600'
                            }`}
                          >
                            {active ? '●' : ''}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMissionQuestion(4)}
                      data-testid="mission-prev"
                      className={navButtonClass}
                    >
                      {labelsUi.previous}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmQuestion(5)}
                      disabled={(displayedContext.question5Choices || []).length === 0}
                      className={primaryNavButtonClass}
                    >
                      {labelsUi.confirm}
                    </button>
                  </div>
                  {renderMissionActionBar('constraints')}
                </div>
                {renderMissionActionPanel('constraints')}
              </div>
            )}

            {activeMissionQuestion === 6 && (
              <div
                data-testid="mission-summary"
                className="rounded-[26px] border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.executiveSummaryHeading')}
                  </div>
                  <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    {isPolish ? 'Podsumowanie' : 'Summary'}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {summaryCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-2xl border border-c-border bg-c-surface-raised p-4"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                        {card.label}
                      </div>
                      <div className="mt-2 text-sm leading-relaxed text-c-text">
                        {card.value || (isPolish ? 'Do uzupełnienia' : 'To be completed')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveMissionQuestion(5)}
                    data-testid="mission-prev"
                    className={navButtonClass}
                  >
                    {labelsUi.previous}
                  </button>
                  {onContinue ? (
                    <button type="button" onClick={onContinue} className={primaryNavButtonClass}>
                      {isPolish
                        ? 'Przejdź do wejścia i eksploracji'
                        : 'Continue to Input & Exploration'}
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {missionSuggestion && (
              <div className="rounded-[26px] border border-sky-200/70 bg-sky-500/5 p-5 shadow-sm dark:border-sky-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.aiMissionBriefHeading')}
                  </div>
                  <span className="inline-flex rounded-full border border-sky-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200">
                    AI
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {missionSuggestion.goal ? (
                    <div>
                      <span className="font-semibold">
                        {t(
                          'discoveryToolsSteps.contextStep.dynamicSwot.jsx.strategicQuestionLabel'
                        )}
                      </span>{' '}
                      {missionSuggestion.goal}
                    </div>
                  ) : null}
                  {missionSuggestion.scope ? (
                    <div>
                      <span className="font-semibold">
                        {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.scopeLabel')}
                      </span>{' '}
                      {missionSuggestion.scope}
                    </div>
                  ) : null}
                  {missionSuggestion.successSignal ? (
                    <div>
                      <span className="font-semibold">
                        {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.successSignalLabel')}
                      </span>{' '}
                      {missionSuggestion.successSignal}
                    </div>
                  ) : null}
                  {missionSuggestion.constraints ? (
                    <div>
                      <span className="font-semibold">
                        {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.constraintsLabel')}
                      </span>{' '}
                      {missionSuggestion.constraints}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onApplyMissionSuggestion}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <Check className="h-4 w-4" />
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.applyToMissionBrief')}
                  </button>
                  <button
                    type="button"
                    onClick={onDismissMissionSuggestion}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-navy-800"
                  >
                    <X className="h-4 w-4" />
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.discardSuggestion')}
                  </button>
                </div>
              </div>
            )}

            {displayedContext.question5Confirmed && onGenerateFullSession && (
              <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-5 shadow-sm dark:border-emerald-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                    {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.moveToNextPhases')}
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
                    {isPolish ? 'Sesja' : 'Session'}
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.moveToNextPhasesDescription')}
                </div>
                <button
                  type="button"
                  onClick={onGenerateFullSession}
                  disabled={isGenerating}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-navy-900 dark:bg-[#F4F7FB] px-5 py-3 text-sm font-semibold text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
                  {isGenerating
                    ? t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.generatingFullSession')
                    : t('discoveryToolsSteps.contextStep.dynamicSwot.jsx.generateFullSession')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
          <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {labels.title[lang]}
        </h2>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
        {t('discoveryToolsSteps.contextStep.generic.lightStartHint')}
      </div>

      {/* Goal / Industry */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {labels.goalLabel[lang]} *
        </label>
        <textarea
          value={(contextData as any).goal || (contextData as any).industry || ''}
          onChange={(e) =>
            handleChange(toolType === 'market-forces' ? 'industry' : 'goal', e.target.value)
          }
          placeholder={labels.goalPlaceholder[lang]}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <InlineAssist hint={t('discoveryToolsSteps.contextStep.generic.goalHint')} />
      </div>

      {/* Scope / Geographic */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {labels.scopeLabel[lang]} *
        </label>
        <textarea
          value={(contextData as any).scope || (contextData as any).geographicScope || ''}
          onChange={(e) =>
            handleChange(toolType === 'market-forces' ? 'geographicScope' : 'scope', e.target.value)
          }
          placeholder={labels.scopePlaceholder[lang]}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <InlineAssist hint={t('discoveryToolsSteps.contextStep.generic.scopeHint')} />
      </div>

      {/* Timeframe (SWOT) or Position (Porter) */}
      {toolType !== 'market-forces' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{labels.timeframeLabel?.[lang] || 'Time Horizon'}</span>
            </div>
          </label>
          <div className="flex gap-3">
            {(['short', 'medium', 'long'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`
                  flex-1 px-4 py-3 rounded-lg border-2 transition-colors
                  ${
                    (contextData as SWOTData['context']).timeframe === tf
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 text-slate-600 dark:text-slate-400'
                  }
                `}
              >
                <div className="text-sm font-medium">
                  {t(`discoveryToolsSteps.contextStep.generic.timeframe.${tf}`)}
                </div>
                <div className="text-xs mt-1 opacity-70">
                  {tf === 'short' ? '< 1 rok' : tf === 'medium' ? '1-3 lata' : '3+ lata'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toolType === 'market-forces' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{labels.positionLabel?.[lang] || 'Market Position'}</span>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['leader', 'challenger', 'follower', 'niche'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => handlePositionChange(pos)}
                className={`
                  px-4 py-3 rounded-lg border-2 transition-colors text-left
                  ${
                    (contextData as PorterData['context']).position === pos
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 text-slate-600 dark:text-slate-400'
                  }
                `}
              >
                <div className="text-sm font-medium">
                  {t(`discoveryToolsSteps.contextStep.generic.position.${pos}`)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {t('discoveryToolsSteps.contextStep.generic.helpText')}
        </p>
      </div>
    </div>
  );
};

export default ContextStep;
