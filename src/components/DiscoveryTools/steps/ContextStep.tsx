/**
 * ContextStep - First step for all tools
 *
 * Collects strategic goal, scope, and timeframe.
 * Adapts labels based on tool type.
 */

import { Calendar, Check, Loader2, MapPin, Sparkles, Target, X } from 'lucide-react';
import React from 'react';

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

function buildDynamicSwotSeedProposal(isPolish: boolean): SWOTData['context'] {
  return {
    understanding: isPolish
      ? 'Rozumiem tę sesję jako próbę uchwycenia kierunku strategicznego dla całej organizacji, a nie tylko poprawy jednego KPI. Dynamic SWOT ma pomóc nazwać, gdzie firma powinna iść, na czym zbudować przewagę i jakie wybory są dziś najważniejsze dla zarządu.'
      : 'I understand this session as an attempt to define the strategic direction for the whole organization, not just improve a single KPI. Dynamic SWOT should help name where the company should go, what advantage it can build on, and which choices matter most for leadership now.',
    directionChoice: 'company-direction',
    directionChoices: ['company-direction'],
    goal: isPolish
      ? 'Jak wyznaczyć kolejny kierunek strategiczny firmy, tak aby połączyć wzrost, pozycję rynkową i zdolność wykonawczą organizacji?'
      : 'How should the company define its next strategic direction so that growth, market position, and execution capability reinforce one another?',
    scopeChoice: 'whole-company',
    scopeChoices: ['whole-company'],
    scope: isPolish
      ? 'Analiza obejmuje całą firmę: ofertę, segmenty klientów, model wzrostu, kluczowe zdolności operacyjne, ograniczenia organizacyjne oraz czynniki rynkowe, które wpływają na wybór kierunku.'
      : 'The analysis covers the whole company: offer, customer segments, growth model, core operating capabilities, organizational constraints, and market factors that shape the strategic choice.',
    successChoice: 'direction-and-priorities',
    successChoices: ['direction-and-priorities'],
    successSignal: isPolish
      ? 'Po tej sesji zarząd ma mieć uzgodniony kierunek strategiczny, logikę wyboru, najważniejsze priorytety i listę ruchów, które można przełożyć na dalsze decyzje oraz execution.'
      : 'By the end of the session, leadership should have an agreed strategic direction, a clear logic of choice, the top priorities, and a set of moves that can be translated into decisions and execution.',
    timeframe: 'medium' as const,
    kpiTarget: isPolish
      ? '12-18 miesięcy na zmianę kierunku, 90 dni na pierwsze ruchy i decyzje wykonawcze'
      : '12-18 months for directional change, 90 days for the first moves and execution decisions',
    constraints: isPolish
      ? 'Kierunek musi być realistyczny wobec obecnych zasobów; nie zakładamy pełnej transformacji wszystkiego naraz; rekomendacja ma być zrozumiała dla zarządu i możliwa do przełożenia na kolejne decyzje.'
      : 'The direction must be realistic for current resources; we do not assume a full transformation of everything at once; the recommendation must be clear for leadership and translatable into next decisions.',
    assumptions: isPolish
      ? 'Firma ma kilka możliwych ścieżek wzrostu, ale nie ma jeszcze wspólnej odpowiedzi, która z nich naprawdę buduje przewagę; część napięć wynika z rynku, część z wnętrza organizacji; zarząd potrzebuje materiału, który porządkuje wybór, a nie tylko opisuje sytuację.'
      : 'The company has several possible growth paths, but no shared answer yet on which one truly builds advantage; some tensions come from the market, others from inside the organization; leadership needs material that structures the choice instead of merely describing the situation.',
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
  sessionGenerationStatus,
  missionSuggestion,
  onApplyMissionSuggestion,
  onDismissMissionSuggestion,
}) => {
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
  const dynamicSwotSeedProposal = buildDynamicSwotSeedProposal(isPolish);

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

      if (isPolish) {
        if (blockId === 'understanding') {
          return appendMissionRefinement(
            cleanBase,
            mode === 'comment'
              ? `Rdzeń tej sesji jeszcze mocniej ustawiamy wokół ${detail.toLowerCase()}`
              : `Szczególnie doprecyzowujemy tutaj ${detail.toLowerCase()}`
          );
        }
        if (blockId === 'direction') {
          return appendMissionRefinement(
            cleanBase,
            mode === 'comment'
              ? `To zawęża pytanie strategiczne do ${detail.toLowerCase()}`
              : `Mocniej definiujemy tutaj kierunek związany z ${detail.toLowerCase()}`
          );
        }
        if (blockId === 'scope') {
          return appendMissionRefinement(
            cleanBase,
            mode === 'comment'
              ? `Analizę dodatkowo ogniskujemy na ${detail.toLowerCase()}`
              : `Pogłębiamy zwłaszcza wymiar ${detail.toLowerCase()}`
          );
        }
        if (blockId === 'success') {
          return appendMissionRefinement(
            cleanBase,
            mode === 'comment'
              ? `Za mocny wynik uznajemy również ${detail.toLowerCase()}`
              : `Silniej doprecyzowujemy rezultat związany z ${detail.toLowerCase()}`
          );
        }
        return appendMissionRefinement(
          cleanBase,
          mode === 'comment'
            ? `W praktyce oznacza to konieczność uwzględnienia ${detail.toLowerCase()}`
            : `Szczególnie zaostrzamy ograniczenia związane z ${detail.toLowerCase()}`
        );
      }

      if (blockId === 'understanding') {
        return appendMissionRefinement(
          cleanBase,
          mode === 'comment'
            ? `We place even more emphasis on ${detail}`
            : `We sharpen this especially around ${detail}`
        );
      }
      if (blockId === 'direction') {
        return appendMissionRefinement(
          cleanBase,
          mode === 'comment'
            ? `This narrows the strategic question toward ${detail}`
            : `We define the direction more deeply around ${detail}`
        );
      }
      if (blockId === 'scope') {
        return appendMissionRefinement(
          cleanBase,
          mode === 'comment'
            ? `The analysis is further focused on ${detail}`
            : `We deepen the dimension of ${detail}`
        );
      }
      if (blockId === 'success') {
        return appendMissionRefinement(
          cleanBase,
          mode === 'comment'
            ? `A strong result should also include ${detail}`
            : `We sharpen the outcome especially around ${detail}`
        );
      }
      return appendMissionRefinement(
        cleanBase,
        mode === 'comment'
          ? `In practice this means accounting for ${detail}`
          : `We tighten the guardrails especially around ${detail}`
      );
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
        label: isPolish ? 'Kierunek strategiczny całej firmy' : 'Whole-company strategic direction',
        description: isPolish
          ? 'Szukanie odpowiedzi, dokąd firma ma zmierzać jako całość.'
          : 'Find the answer to where the company should go as a whole.',
        patch: {
          directionChoice: 'company-direction',
          goal: isPolish
            ? 'Jak wyznaczyć kolejny kierunek strategiczny firmy, tak aby połączyć wzrost, pozycję rynkową i zdolność wykonawczą organizacji?'
            : 'How should the company define its next strategic direction so that growth, market position, and execution capability reinforce one another?',
        },
      },
      {
        id: 'growth-engine',
        label: isPolish ? 'Nowy silnik wzrostu' : 'New growth engine',
        description: isPolish
          ? 'Wybór, skąd ma przyjść następna fala wzrostu.'
          : 'Choose where the next wave of growth should come from.',
        patch: {
          directionChoice: 'growth-engine',
          goal: isPolish
            ? 'Który kierunek wzrostu powinien stać się następnym silnikiem rozwoju firmy i jak go zbudować bez rozproszenia organizacji?'
            : 'Which growth direction should become the company’s next engine and how should it be built without fragmenting the organization?',
        },
      },
      {
        id: 'market-position',
        label: isPolish ? 'Repozycjonowanie rynkowe' : 'Market repositioning',
        description: isPolish
          ? 'Odpowiedź, jak firma ma zmienić pozycję na rynku.'
          : 'Answer how the company should reposition itself in the market.',
        patch: {
          directionChoice: 'market-position',
          goal: isPolish
            ? 'Jak firma powinna przedefiniować swoją pozycję rynkową, aby wygrać w ważniejszych segmentach i obronić wartość?'
            : 'How should the company redefine its market position to win in more important segments and defend value?',
        },
      },
      {
        id: 'capability-shift',
        label: isPolish ? 'Zmiana modelu działania' : 'Capability model shift',
        description: isPolish
          ? 'Skupienie na tym, jakie zdolności trzeba przestawić, by strategia była wykonalna.'
          : 'Focus on which capabilities must shift to make strategy executable.',
        patch: {
          directionChoice: 'capability-shift',
          goal: isPolish
            ? 'Jaką zmianę w modelu działania firma musi wykonać, aby jej strategia była realna, skalowalna i spójna?'
            : 'What operating-model shift must the company make so its strategy becomes real, scalable, and coherent?',
        },
      },
    ];

    const scopeOptions = [
      {
        id: 'whole-company',
        label: isPolish ? 'Cała organizacja' : 'Whole organization',
        description: isPolish
          ? 'Oferta, rynek, model wzrostu i wykonanie.'
          : 'Offer, market, growth model, and execution.',
        patch: {
          scopeChoice: 'whole-company',
          scope: isPolish
            ? 'Analiza obejmuje całą firmę: ofertę, segmenty klientów, model wzrostu, kluczowe zdolności operacyjne, ograniczenia organizacyjne oraz czynniki rynkowe, które wpływają na wybór kierunku.'
            : 'The analysis covers the whole company: offer, customer segments, growth model, core operating capabilities, organizational constraints, and market factors that shape the strategic choice.',
        },
      },
      {
        id: 'go-to-market',
        label: isPolish ? 'Go-to-market i oferta' : 'Go-to-market and offer',
        description: isPolish
          ? 'Sprzedaż, segmenty, propozycja wartości, pricing.'
          : 'Sales, segments, value proposition, pricing.',
        patch: {
          scopeChoice: 'go-to-market',
          scope: isPolish
            ? 'Analiza koncentruje się na tym, jak firma sprzedaje, do kogo kieruje ofertę, jak pozycjonuje wartość i które segmenty powinny być dziś priorytetem.'
            : 'The analysis focuses on how the company sells, who it targets, how it positions value, and which segments should be prioritized now.',
        },
      },
      {
        id: 'portfolio-focus',
        label: isPolish
          ? 'Portfolio i priorytety inwestycji'
          : 'Portfolio and investment priorities',
        description: isPolish
          ? 'Gdzie inwestować, a z czego schodzić.'
          : 'Where to invest and what to de-prioritize.',
        patch: {
          scopeChoice: 'portfolio-focus',
          scope: isPolish
            ? 'Analiza obejmuje portfolio działań i kierunków, aby wskazać, gdzie firma powinna inwestować uwagę, zasoby i kapitał, a gdzie ograniczyć zaangażowanie.'
            : 'The analysis covers the portfolio of initiatives and directions to identify where the company should invest attention, resources, and capital, and where it should pull back.',
        },
      },
      {
        id: 'capabilities-and-constraints',
        label: isPolish
          ? 'Zdolności i ograniczenia organizacji'
          : 'Capabilities and organizational constraints',
        description: isPolish
          ? 'Co organizacja potrafi, a co ją blokuje.'
          : 'What the organization can do and what holds it back.',
        patch: {
          scopeChoice: 'capabilities-and-constraints',
          scope: isPolish
            ? 'Analiza skupia się na wewnętrznych zdolnościach, ograniczeniach i napięciach wykonawczych, które przesądzają o tym, jaka strategia jest dziś rzeczywiście możliwa.'
            : 'The analysis focuses on internal capabilities, constraints, and execution tensions that determine which strategy is actually feasible today.',
        },
      },
    ];

    const successOptions = [
      {
        id: 'direction-and-priorities',
        label: isPolish
          ? 'Kierunek i priorytety strategiczne'
          : 'Direction and strategic priorities',
        description: isPolish
          ? 'Jasny wybór i lista priorytetów dla zarządu.'
          : 'A clear choice and list of priorities for leadership.',
        patch: {
          successChoice: 'direction-and-priorities',
          successSignal: isPolish
            ? 'Po tej sesji zarząd ma mieć uzgodniony kierunek strategiczny, logikę wyboru, najważniejsze priorytety i listę ruchów, które można przełożyć na dalsze decyzje oraz execution.'
            : 'By the end of the session, leadership should have an agreed strategic direction, a clear logic of choice, the top priorities, and a set of moves that can be translated into decisions and execution.',
        },
      },
      {
        id: 'board-decision',
        label: isPolish ? 'Materiał do decyzji zarządu' : 'Board decision material',
        description: isPolish
          ? 'Gotowy materiał, który porządkuje wybór.'
          : 'Ready material that structures the choice.',
        patch: {
          successChoice: 'board-decision',
          successSignal: isPolish
            ? 'Sukces oznacza materiał, który pozwala zarządowi porównać opcje, zobaczyć napięcia i podjąć decyzję bez dalszego chaosu interpretacyjnego.'
            : 'Success means material that allows leadership to compare options, see the tensions, and decide without further interpretive chaos.',
        },
      },
      {
        id: 'execution-bridge',
        label: isPolish ? 'Most do execution' : 'Bridge to execution',
        description: isPolish
          ? 'Ruchy, które można od razu przełożyć na działanie.'
          : 'Moves that can quickly be translated into action.',
        patch: {
          successChoice: 'execution-bridge',
          successSignal: isPolish
            ? 'Po sesji firma ma wiedzieć nie tylko jaki kierunek wybrać, ale także jakie pierwsze ruchy uruchomić w ciągu 90 dni i jak zabezpieczyć wykonanie.'
            : 'After the session, the company should know not only which direction to choose, but also which first moves to launch within 90 days and how to secure execution.',
        },
      },
      {
        id: 'strategic-clarity',
        label: isPolish ? 'Jasność strategiczna' : 'Strategic clarity',
        description: isPolish
          ? 'Uporządkowanie myślenia i języka strategii.'
          : 'Order the thinking and language of strategy.',
        patch: {
          successChoice: 'strategic-clarity',
          successSignal: isPolish
            ? 'Sukces tej sesji to wspólny język strategii: nazwanie przewag, ryzyk, priorytetów i granic wyboru, tak aby cała organizacja rozumiała, o co naprawdę gramy.'
            : 'Success in this session means a shared language of strategy: naming advantages, risks, priorities, and boundaries of choice so the whole organization understands what it is truly playing for.',
        },
      },
    ];

    const timeframeOptions = [
      {
        id: 'short' as const,
        label: isPolish ? 'Krótki horyzont' : 'Short horizon',
        description: isPolish ? 'Najbliższe 1-2 kwartały.' : 'The next 1-2 quarters.',
      },
      {
        id: 'medium' as const,
        label: isPolish ? 'Średni horyzont' : 'Medium horizon',
        description: isPolish ? 'Najbliższe 12-18 miesięcy.' : 'The next 12-18 months.',
      },
      {
        id: 'long' as const,
        label: isPolish ? 'Długi horyzont' : 'Long horizon',
        description: isPolish ? 'Transformacja na 2+ lata.' : 'Transformation over 2+ years.',
      },
    ];

    const labelsUi = {
      comment: isPolish ? 'Komentarz' : 'Comment',
      thinkDeeper: isPolish ? 'Pogłęb' : 'Think deeper',
      implement: isPolish ? 'Wprowadź' : 'Implement',
      close: isPolish ? 'Zamknij' : 'Close',
      next: isPolish ? 'Next' : 'Next',
      previous: isPolish ? 'Previous' : 'Previous',
      confirm: isPolish ? 'Potwierdź' : 'Confirm',
      selectedMany: isPolish
        ? 'Możesz zaznaczyć wiele odpowiedzi'
        : 'You can select multiple answers',
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
        label: isPolish
          ? 'Jaki wybór naprawdę stoi przed zarządem?'
          : 'What is the real leadership choice?',
        description: isPolish
          ? 'Nazwij decyzję, którą zarząd faktycznie ma podjąć.'
          : 'Name the decision leadership actually needs to make.',
      });

      if (
        basedOnDirection.includes('company-direction') ||
        basedOnScope.includes('whole-company')
      ) {
        options.push({
          id: 'whole-company-priority',
          label: isPolish
            ? 'Który priorytet ma spiąć całą firmę?'
            : 'Which priority should align the whole company?',
          description: isPolish
            ? 'Pytanie o wspólny kierunek dla całej organizacji.'
            : 'A question about one shared direction for the whole organization.',
        });
      }

      if (basedOnDirection.includes('growth-engine') || basedOnScope.includes('go-to-market')) {
        options.push({
          id: 'growth-source',
          label: isPolish
            ? 'Skąd ma przyjść następna fala wzrostu?'
            : 'Where should the next growth wave come from?',
          description: isPolish
            ? 'Pogłębienie źródła wzrostu i koncentracji handlowej.'
            : 'Go deeper on the source of growth and commercial concentration.',
        });
      }

      if (basedOnDirection.includes('market-position')) {
        options.push({
          id: 'positioning-choice',
          label: isPolish
            ? 'Jaką pozycję rynkową chcemy naprawdę zająć?'
            : 'What market position do we truly want to hold?',
          description: isPolish
            ? 'Doprecyzowanie aspiracji rynkowej i segmentów.'
            : 'Clarify market ambition and target segments.',
        });
      }

      options.push({
        id: 'trade-off',
        label: isPolish
          ? 'Jaki trade-off trzeba zaakceptować?'
          : 'Which trade-off must be accepted?',
        description: isPolish
          ? 'Nazwij kompromis, którego nie da się ominąć.'
          : 'Name the compromise that cannot be avoided.',
      });

      return options.slice(0, 5);
    })();

    const question5Options = (() => {
      const options: Array<{ id: string; label: string; description: string }> = [
        {
          id: 'resource-reality',
          label: isPolish
            ? 'Jakie ograniczenia zasobów są realne?'
            : 'Which resource constraints are real?',
          description: isPolish
            ? 'Ludzie, czas, budżet, zdolność wykonawcza.'
            : 'People, time, budget, execution capacity.',
        },
        {
          id: 'risk-boundary',
          label: isPolish
            ? 'Jakiego ryzyka nie chcemy przekroczyć?'
            : 'Which risk boundary should not be crossed?',
          description: isPolish
            ? 'Granice akceptowalnego ryzyka dla tej strategii.'
            : 'The acceptable risk boundary for this strategy.',
        },
        {
          id: 'decision-speed',
          label: isPolish
            ? 'Jak szybka musi być ta decyzja?'
            : 'How fast does this decision need to be?',
          description: isPolish
            ? 'Tempo działania i rytm kolejnych kroków.'
            : 'Pace of action and rhythm of next moves.',
        },
        {
          id: 'board-clarity',
          label: isPolish
            ? 'Co musi być jasne dla zarządu?'
            : 'What must be crystal-clear for leadership?',
          description: isPolish
            ? 'Jak opisać wybór, by był jednoznaczny.'
            : 'How to frame the choice so it is unmistakably clear.',
        },
        {
          id: 'execution-readiness',
          label: isPolish
            ? 'Co musi być gotowe do execution?'
            : 'What must be ready for execution?',
          description: isPolish
            ? 'Jakie pierwsze ruchy powinny wynikać z tej sesji.'
            : 'Which first moves should follow from this session.',
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
              ? isPolish
                ? `Strategiczny kierunek tej sesji koncentruje się na obszarach: ${composeList(labelsSelected)}.`
                : `The strategic direction of this session focuses on: ${composeList(labelsSelected)}.`
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
              ? isPolish
                ? `W centrum analizy stawiamy: ${composeList(labelsSelected)}.`
                : `At the center of the analysis we place: ${composeList(labelsSelected)}.`
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
              ? isPolish
                ? `Dobry wynik tej sesji powinien dostarczyć: ${composeList(labelsSelected)}.`
                : `A strong result from this session should deliver: ${composeList(labelsSelected)}.`
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
              ? isPolish
                ? `Kluczowe pytania kontekstowe, które trzeba rozstrzygnąć, to: ${composeList(labelsSelected)}.`
                : `The key contextual questions we need to resolve are: ${composeList(labelsSelected)}.`
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
              ? isPolish
                ? `Ta sesja musi respektować następujące granice: ${composeList(labelsSelected)}.`
                : `This session must respect the following boundaries: ${composeList(labelsSelected)}.`
              : displayedContext.constraints,
        });
      }
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

    const executiveSummaryIntro = isPolish
      ? 'Ten Dynamic SWOT ma zbudować materiał decyzyjny dla zarządu, a nie tylko porządną diagnozę. Jego rolą jest uchwycenie kierunku strategicznego, który organizacja powinna uznać za najbardziej sensowny, oraz pokazanie, dlaczego właśnie ten wybór powinien zostać dowieziony dalej w formie działań, priorytetów i kolejnych decyzji.'
      : 'This Dynamic SWOT is meant to build decision material for leadership, not just a neat diagnosis. Its role is to identify the strategic direction the organization should consider most sensible, and show why that choice deserves to be carried forward into actions, priorities, and subsequent decisions.';

    const executiveSummaryBody = isPolish
      ? `Na podstawie odpowiedzi przyjmujemy, że ta sesja koncentruje się na obszarach: ${composeList(
          selectedDirectionLabels.length ? selectedDirectionLabels : [displayedContext.goal]
        )}. W centrum analizy powinny znaleźć się: ${composeList(
          selectedScopeLabels.length ? selectedScopeLabels : [displayedContext.scope]
        )}. Oznacza to, że SWOT ma nie tylko opisać sytuację, ale uporządkować wybór strategiczny, pokazać napięcia, nazwać ograniczenia oraz wskazać, jaka logika decyzji jest dziś najbardziej uzasadniona.`
      : `Based on the answers so far, this session should focus on: ${composeList(
          selectedDirectionLabels.length ? selectedDirectionLabels : [displayedContext.goal]
        )}. At the center of the analysis should sit: ${composeList(
          selectedScopeLabels.length ? selectedScopeLabels : [displayedContext.scope]
        )}. That means the SWOT should not merely describe the situation, but structure the strategic choice, surface the tensions, name the constraints, and show which decision logic is most justified today.`;

    const executiveSummaryDelivery = isPolish
      ? `Założeniem dowiezienia tej pracy jest rezultat w postaci: ${composeList(
          selectedSuccessLabels.length ? selectedSuccessLabels : [displayedContext.successSignal]
        )}. Żeby ten rezultat był wiarygodny, sesja musi dodatkowo odpowiedzieć na pytania: ${composeList(
          selectedQuestion4Labels.length
            ? selectedQuestion4Labels
            : [displayedContext.assumptions].filter((value): value is string => Boolean(value))
        )}, przy jednoczesnym uszanowaniu granic: ${composeList(
          selectedQuestion5Labels.length ? selectedQuestion5Labels : [displayedContext.constraints]
        )}. To właśnie ten fragment powinien później wejść na pierwszy slajd prezentacji jako uzasadnienie celu SWOT-a, zakresu pracy i oczekiwanego sposobu dowiezienia rekomendacji.`
      : `The intended delivery of this work is an outcome shaped as: ${composeList(
          selectedSuccessLabels.length ? selectedSuccessLabels : [displayedContext.successSignal]
        )}. To make that outcome credible, the session must additionally answer: ${composeList(
          selectedQuestion4Labels.length
            ? selectedQuestion4Labels
            : [displayedContext.assumptions].filter((value): value is string => Boolean(value))
        )}, while respecting the boundaries: ${composeList(
          selectedQuestion5Labels.length ? selectedQuestion5Labels : [displayedContext.constraints]
        )}. This is the exact fragment that should later become the first slide of the presentation, explaining the purpose of the SWOT, the scope of work, and the intended logic of delivery.`;

    const deepDiveOptions: Record<
      'understanding' | 'direction' | 'scope' | 'success' | 'constraints',
      Array<{ id: string; label: string }>
    > = {
      understanding: [
        {
          id: 'broader-strategy',
          label: isPolish
            ? 'Pokaż szerzej, o jaką strategię chodzi'
            : 'Broaden the strategy framing',
        },
        {
          id: 'leadership-angle',
          label: isPolish ? 'Napisz to bardziej pod zarząd' : 'Make it more leadership-facing',
        },
        {
          id: 'real-choice',
          label: isPolish
            ? 'Mocniej pokaż, jaki wybór jest do podjęcia'
            : 'Make the underlying choice more explicit',
        },
      ],
      direction: [
        {
          id: 'competition',
          label: isPolish
            ? 'Mocniej uwzględnij konkurencję i rynek'
            : 'Go deeper on competition and market',
        },
        {
          id: 'capabilities',
          label: isPolish ? 'Pokaż mocniej zdolności organizacji' : 'Go deeper on capabilities',
        },
        {
          id: 'trade-offs',
          label: isPolish ? 'Nazwij ważniejsze trade-offy' : 'Surface the real trade-offs',
        },
      ],
      scope: [
        {
          id: 'narrower-scope',
          label: isPolish
            ? 'Zawęź zakres do konkretnego obszaru'
            : 'Narrow the scope to a sharper area',
        },
        {
          id: 'organization-wide',
          label: isPolish
            ? 'Pokaż skutki dla całej organizacji'
            : 'Show whole-organization implications',
        },
        {
          id: 'market-vs-internal',
          label: isPolish
            ? 'Rozdziel rynek i wnętrze organizacji'
            : 'Separate market and internal factors',
        },
      ],
      success: [
        {
          id: 'decision-readiness',
          label: isPolish ? 'Doprecyzuj gotowość do decyzji' : 'Clarify decision-readiness',
        },
        {
          id: 'execution-bridge',
          label: isPolish
            ? 'Mocniej pokaż most do execution'
            : 'Strengthen the bridge to execution',
        },
        {
          id: 'board-material',
          label: isPolish
            ? 'Zrób z tego bardziej materiał zarządczy'
            : 'Make it more board-material oriented',
        },
      ],
      constraints: [
        {
          id: 'resource-limits',
          label: isPolish ? 'Doprecyzuj ograniczenia zasobów' : 'Clarify resource limits',
        },
        {
          id: 'governance',
          label: isPolish ? 'Dodaj ograniczenia governance' : 'Add governance boundaries',
        },
        {
          id: 'risk-tolerance',
          label: isPolish ? 'Nazwij poziom akceptowanego ryzyka' : 'Name the acceptable risk level',
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
                    placeholder={
                      isPolish
                        ? 'Wpisz komentarz, który ma wpłynąć na nową wersję tego bloku.'
                        : 'Write the comment that should shape the next version of this block.'
                    }
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
                              ? 'border-c-text bg-c-text text-c-bg'
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
                      className="inline-flex rounded-2xl bg-c-text px-4 py-2 text-sm font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
                  Mission & Context
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {isPolish ? 'Propozycja konsultanta' : 'Consultant proposal'}
                </span>
              </div>
              <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                {isGenerating ? (isPolish ? 'AI pracuje' : 'AI working') : 'Draft'}
              </span>
            </div>
            <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-white">
              {isPolish
                ? 'Najpierw uzgadniamy, jak rozumiem intencję tej sesji i jaki typ kierunku strategicznego próbujemy zaprojektować.'
                : 'First we align on how I understand the intent of this session and what type of strategic direction we are trying to design.'}
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-[26px] border border-primary-200/70 bg-primary-500/5 p-5 shadow-sm dark:border-primary-900/40">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                  {isPolish ? 'AI understanding' : 'AI understanding'}
                </div>
                <span className="inline-flex rounded-full border border-primary-300/40 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200">
                  Understanding
                </span>
              </div>
              <div className="mt-3 text-base font-medium leading-relaxed text-slate-900 dark:text-white">
                {getMissionBlockPreviewValue('understanding')}
              </div>
              <div className="mt-4 flex justify-end">{renderMissionActionBar('understanding')}</div>
              {renderMissionActionPanel('understanding')}
            </div>

            <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {isPolish
                    ? '1. Jaki kierunek strategiczny projektujemy?'
                    : '1. What strategic direction are we designing?'}
                </div>
                <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  1/5
                </span>
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isPolish
                  ? 'Wybierz, jaki rodzaj kierunku strategicznego naprawdę próbujemy tutaj zbudować.'
                  : 'Choose what kind of strategic direction we are actually trying to build here.'}
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
                          ? 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/20'
                          : 'border-slate-200 bg-white/80 hover:border-slate-300 dark:border-navy-700 dark:bg-navy-900/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                            active
                              ? 'border-c-text bg-c-text text-c-bg'
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

            {displayedContext.question1Confirmed && (
              <div className="rounded-[26px] border border-sky-200/70 bg-sky-500/5 p-5 shadow-sm dark:border-sky-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                    {isPolish
                      ? '2. Co ma być w centrum tej analizy?'
                      : '2. What should sit at the center of this analysis?'}
                  </div>
                  <span className="inline-flex rounded-full border border-sky-300/40 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200">
                    2/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {isPolish
                    ? 'Tutaj zawężamy, co dokładnie ma być przedmiotem pracy w tej sesji.'
                    : 'Here we narrow down what exactly should become the object of work in this session.'}
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
                      onClick={() =>
                        updateMissionContext({
                          question1Confirmed: false,
                          question2Confirmed: false,
                        })
                      }
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

            {displayedContext.question2Confirmed && (
              <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-5 shadow-sm dark:border-emerald-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                    {isPolish
                      ? '3. Jak rozpoznajemy dobry wynik tej sesji?'
                      : '3. How do we recognize a strong outcome from this session?'}
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
                    3/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {isPolish
                    ? 'Wybierz, jaki rodzaj wyniku ma być naprawdę użyteczny po zakończeniu tej sesji.'
                    : 'Choose which type of outcome should be genuinely useful once this session is complete.'}
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
                  placeholder={
                    isPolish
                      ? 'Dopisz, jeśli rekomendacja ma obejmować inny rytm lub horyzont.'
                      : 'Add if the recommendation should follow a different time rhythm or horizon.'
                  }
                  className="mt-4 w-full resize-none rounded-2xl border border-emerald-200/70 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-900/40 dark:bg-navy-800 dark:text-white"
                />
                <div className="mt-3 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
                  {displayedContext.kpiTarget}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateMissionContext({
                          question2Confirmed: false,
                          question3Confirmed: false,
                        })
                      }
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

            {displayedContext.question3Confirmed && (
              <div className="rounded-[26px] border border-primary-200/70 bg-primary-500/5 p-5 shadow-sm dark:border-primary-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                    {isPolish
                      ? '4. Jakie pytanie kontekstowe musimy jeszcze doprecyzować?'
                      : '4. Which contextual question still needs sharpening?'}
                  </div>
                  <span className="inline-flex rounded-full border border-primary-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200">
                    4/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {isPolish
                    ? 'To pytanie jest już zależne od wcześniejszych odpowiedzi i pomaga doprecyzować właściwy kontekst strategiczny.'
                    : 'This question already depends on previous answers and helps sharpen the real strategic context.'}
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
                                ? 'border-c-text bg-c-text text-c-bg'
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
                    onClick={() =>
                      updateMissionContext({ question3Confirmed: false, question4Confirmed: false })
                    }
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

            {displayedContext.question4Confirmed && (
              <div className="rounded-[26px] border border-amber-200/70 bg-amber-500/5 p-5 shadow-sm dark:border-amber-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    {isPolish
                      ? '5. Jakie granice i realia ta strategia musi respektować?'
                      : '5. Which boundaries and realities must this strategy respect?'}
                  </div>
                  <span className="inline-flex rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
                    5/5
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {isPolish
                    ? 'Na końcu doprecyzowujemy ograniczenia, których ta strategia nie może ignorować.'
                    : 'At the end, we sharpen the constraints this strategy cannot ignore.'}
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
                      onClick={() =>
                        updateMissionContext({
                          question4Confirmed: false,
                          question5Confirmed: false,
                        })
                      }
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

            {displayedContext.question5Confirmed && (
              <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {isPolish ? 'Executive summary tej sesji' : 'Executive summary of this session'}
                  </div>
                  <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    Summary
                  </span>
                </div>
                <div className="mt-4 text-base font-semibold leading-relaxed text-slate-900 dark:text-white">
                  {executiveSummaryIntro}
                </div>
                <div className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {executiveSummaryBody}
                </div>
                <div className="mt-4 rounded-2xl border border-primary-200/70 bg-primary-500/5 px-4 py-4 text-sm leading-relaxed text-slate-700 dark:border-primary-900/40 dark:text-slate-200">
                  {executiveSummaryDelivery}
                </div>
              </div>
            )}

            {missionSuggestion && (
              <div className="rounded-[26px] border border-sky-200/70 bg-sky-500/5 p-5 shadow-sm dark:border-sky-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                    {isPolish ? 'Propozycja AI dla mission brief' : 'AI mission brief proposal'}
                  </div>
                  <span className="inline-flex rounded-full border border-sky-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200">
                    AI
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {missionSuggestion.goal ? (
                    <div>
                      <span className="font-semibold">
                        {isPolish ? 'Pytanie strategiczne:' : 'Strategic question:'}
                      </span>{' '}
                      {missionSuggestion.goal}
                    </div>
                  ) : null}
                  {missionSuggestion.scope ? (
                    <div>
                      <span className="font-semibold">{isPolish ? 'Zakres:' : 'Scope:'}</span>{' '}
                      {missionSuggestion.scope}
                    </div>
                  ) : null}
                  {missionSuggestion.successSignal ? (
                    <div>
                      <span className="font-semibold">
                        {isPolish ? 'Sygnał sukcesu:' : 'Success signal:'}
                      </span>{' '}
                      {missionSuggestion.successSignal}
                    </div>
                  ) : null}
                  {missionSuggestion.constraints ? (
                    <div>
                      <span className="font-semibold">
                        {isPolish ? 'Ograniczenia:' : 'Constraints:'}
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
                    {isPolish ? 'Zastosuj do mission brief' : 'Apply to mission brief'}
                  </button>
                  <button
                    type="button"
                    onClick={onDismissMissionSuggestion}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-navy-800"
                  >
                    <X className="h-4 w-4" />
                    {isPolish ? 'Odrzuć propozycję' : 'Discard suggestion'}
                  </button>
                </div>
              </div>
            )}

            {displayedContext.question5Confirmed && onGenerateFullSession && (
              <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-5 shadow-sm dark:border-emerald-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                    {isPolish ? 'Przejście do kolejnych faz' : 'Move to the next phases'}
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
                    Session
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {isPolish
                    ? 'Kiedy Mission & Context są już uzgodnione, AI może przygotować dalszą część sesji: input map, macierz SWOT, napięcia, ruchy i outputy.'
                    : 'Once Mission & Context are aligned, AI can prepare the rest of the session: input map, SWOT matrix, tensions, moves, and outputs.'}
                </div>
                <button
                  type="button"
                  onClick={onGenerateFullSession}
                  disabled={isGenerating}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-c-text px-5 py-3 text-sm font-semibold text-c-bg transition-colors hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
                  {isGenerating
                    ? isPolish
                      ? 'AI buduje pełną sesję...'
                      : 'AI is building the full session...'
                    : isPolish
                      ? 'Generuj dalszą część sesji'
                      : 'Generate the next parts of the session'}
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
        {isPolish
          ? 'To jest lekki start: opisz cel, zakres i efekt końcowy, a AI pomoże zbudować dalszą strukturę rozmowy i analizy.'
          : 'This is a light entry: define the goal, scope, and expected finish, and AI will help build the structure for the rest of the conversation and analysis.'}
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
        <InlineAssist
          hint={
            isPolish
              ? 'Dodaj konkretne KPI lub oczekiwany wynik.'
              : 'Add concrete KPIs or expected outcome.'
          }
        />
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
        <InlineAssist
          hint={
            isPolish
              ? 'Wskaz obszar biznesowy i interesariuszy.'
              : 'Specify business area and stakeholders.'
          }
        />
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
                  {tf === 'short'
                    ? isPolish
                      ? 'Krótki'
                      : 'Short'
                    : tf === 'medium'
                      ? isPolish
                        ? 'Średni'
                        : 'Medium'
                      : isPolish
                        ? 'Długi'
                        : 'Long'}
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
                  {pos === 'leader'
                    ? isPolish
                      ? 'Lider rynku'
                      : 'Market Leader'
                    : pos === 'challenger'
                      ? isPolish
                        ? 'Pretendent'
                        : 'Challenger'
                      : pos === 'follower'
                        ? isPolish
                          ? 'Naśladowca'
                          : 'Follower'
                        : isPolish
                          ? 'Gracz niszowy'
                          : 'Niche Player'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {isPolish
            ? '💡 Jasno zdefiniowany cel pomoże AI generować bardziej trafne sugestie w kolejnych krokach.'
            : '💡 A clearly defined goal will help AI generate more relevant suggestions in the following steps.'}
        </p>
      </div>
    </div>
  );
};

export default ContextStep;
