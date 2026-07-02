/**
 * StrategicToolsView - Strategic Analysis Tools (1-10)
 *
 * Classic strategic frameworks powered by AI:
 * 1. Dynamic SWOT
 * 2. Market Forces (Porter's 5 Forces)
 * 3. Growth Paths (Ansoff Matrix)
 * 4. Value Chain Analysis
 * 5. Strategic Portfolio Prioritization (BCG)
 * 6. Strategic Ambition Decomposer
 * 7. Strategic Focus & Trade-off Engine
 * 8. Strategic Risk & Uncertainty Mapper
 * 9. Strategic Capability-to-Outcome Mapper
 * 10. Strategic Narrative & Alignment Engine
 */

import {
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronRight,
  Focus,
  GitBranch,
  Grid3x3,
  Layers,
  LineChart,
  MessageSquare,
  PieChart,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ToolDocumentView } from '@/components/DiscoveryTools';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { ToolType } from '@/store/useToolStore';
import { AppView } from '@/types';
import { parseArtifactRef } from '@/utils/artifactLinks';

interface StrategicTool {
  id: string;
  number: number;
  name: string;
  namePl: string;
  classicFramework: string;
  description: string;
  descriptionPl: string;
  icon: React.ElementType;
  outputs: string[];
  outputsPl: string[];
}

const STRATEGIC_TOOLS: StrategicTool[] = [
  {
    id: 'dynamic-swot',
    number: 1,
    name: 'Dynamic SWOT',
    namePl: 'Dynamiczny SWOT',
    classicFramework: 'SWOT Analysis',
    description:
      'AI-driven SWOT that connects strengths with opportunities and weaknesses with threats to generate strategic initiatives',
    descriptionPl:
      'SWOT wsparty AI łączący mocne strony z szansami oraz słabe strony z zagrożeniami do generowania inicjatyw strategicznych',
    icon: Grid3x3,
    outputs: ['SWOT Matrix', 'S+O/W+T Combinations', 'Strategic Initiatives'],
    outputsPl: ['Macierz SWOT', 'Kombinacje S+O/W+T', 'Inicjatywy strategiczne'],
  },
  {
    id: 'market-forces',
    number: 2,
    name: 'Market Forces Analysis',
    namePl: 'Analiza Sił Rynkowych',
    classicFramework: "Porter's 5 Forces",
    description:
      'Analyze competitive forces with data-driven scoring and margin protection initiatives',
    descriptionPl:
      'Analiza sił konkurencyjnych z oceną opartą na danych i inicjatywami ochrony marży',
    icon: Target,
    outputs: ['5 Forces Diagram', 'Margin Risk Assessment', 'Competitive Initiatives'],
    outputsPl: ['Diagram 5 Sił', 'Ocena ryzyka marży', 'Inicjatywy konkurencyjne'],
  },
  {
    id: 'growth-paths',
    number: 3,
    name: 'Growth Paths Analysis',
    namePl: 'Analiza Ścieżek Wzrostu',
    classicFramework: 'Ansoff Matrix',
    description:
      'Map growth opportunities with ROI estimates, risk profiles, and capability requirements',
    descriptionPl:
      'Mapowanie możliwości wzrostu z estymacjami ROI, profilami ryzyka i wymaganiami kompetencyjnymi',
    icon: GitBranch,
    outputs: ['Ansoff Matrix', 'Growth ROI Estimates', 'Capability Gap Analysis'],
    outputsPl: ['Macierz Ansoffa', 'Estymacje ROI wzrostu', 'Analiza luk kompetencyjnych'],
  },
  {
    id: 'value-chain',
    number: 4,
    name: 'Value Chain Analysis',
    namePl: 'Analiza Łańcucha Wartości',
    classicFramework: 'Porter Value Chain',
    description:
      'Identify where value is created and leaked across activities, with optimization initiatives',
    descriptionPl:
      'Identyfikacja gdzie wartość jest tworzona i tracona w działaniach, z inicjatywami optymalizacji',
    icon: Layers,
    outputs: ['Value Chain Map', 'Leakage Points', 'Optimization Initiatives'],
    outputsPl: ['Mapa łańcucha wartości', 'Punkty utraty wartości', 'Inicjatywy optymalizacji'],
  },
  {
    id: 'portfolio-priority',
    number: 5,
    name: 'Strategic Portfolio Prioritization',
    namePl: 'Priorytetyzacja Portfolio Strategicznego',
    classicFramework: 'BCG Matrix',
    description: 'Classify and prioritize initiatives based on impact and resource constraints',
    descriptionPl:
      'Klasyfikacja i priorytetyzacja inicjatyw na podstawie wpływu i ograniczeń zasobowych',
    icon: PieChart,
    outputs: ['BCG-style Grid', 'Priority Ranking', 'Stop/Scale/Merge Decisions'],
    outputsPl: ['Siatka typu BCG', 'Ranking priorytetów', 'Decyzje Stop/Skaluj/Połącz'],
  },
  {
    id: 'ambition-decomposer',
    number: 6,
    name: 'Strategic Ambition Decomposer',
    namePl: 'Dekompozycja Ambicji Strategicznej',
    classicFramework: 'Vision-to-Strategy',
    description:
      'Break down vision and ambition into measurable strategic dimensions and trade-offs',
    descriptionPl: 'Rozbicie wizji i ambicji na mierzalne wymiary strategiczne i kompromisy',
    icon: TrendingUp,
    outputs: ['Ambition Dimensions', 'Trade-off Matrix', 'Direction Initiatives'],
    outputsPl: ['Wymiary ambicji', 'Macierz kompromisów', 'Inicjatywy kierunkowe'],
  },
  {
    id: 'focus-tradeoff',
    number: 7,
    name: 'Strategic Focus & Trade-off Engine',
    namePl: 'Silnik Fokusu i Kompromisów',
    classicFramework: 'Strategic Choice',
    description:
      'Identify what NOT to do - surface strategic conflicts and generate exit/consolidation initiatives',
    descriptionPl:
      'Identyfikacja czego NIE robić - wykrycie konfliktów strategicznych i generowanie inicjatyw wyjścia/konsolidacji',
    icon: Focus,
    outputs: ['Conflict Map', 'Cost of Indecision', 'Exit/Stop Initiatives'],
    outputsPl: ['Mapa konfliktów', 'Koszt niezdecydowania', 'Inicjatywy wyjścia/zatrzymania'],
  },
  {
    id: 'risk-uncertainty',
    number: 8,
    name: 'Strategic Risk & Uncertainty Mapper',
    namePl: 'Mapa Ryzyka i Niepewności Strategicznej',
    classicFramework: 'Scenario Planning',
    description:
      'Map strategic assumptions and risks, simulate scenarios, generate resilience initiatives',
    descriptionPl:
      'Mapowanie założeń i ryzyk strategicznych, symulacja scenariuszy, generowanie inicjatyw odporności',
    icon: Shield,
    outputs: ['Risk Heatmap', 'Scenario Analysis', 'Resilience Initiatives'],
    outputsPl: ['Mapa cieplna ryzyka', 'Analiza scenariuszy', 'Inicjatywy odporności'],
  },
  {
    id: 'capability-outcome',
    number: 9,
    name: 'Strategic Capability-to-Outcome Mapper',
    namePl: 'Mapa Kompetencji do Wyników',
    classicFramework: 'Capability Assessment',
    description:
      'Map strategic goals to required capabilities, identify gaps, generate building initiatives',
    descriptionPl:
      'Mapowanie celów strategicznych do wymaganych kompetencji, identyfikacja luk, generowanie inicjatyw budowania',
    icon: Brain,
    outputs: ['Capability Gap Matrix', 'Critical Gaps', 'Building Initiatives'],
    outputsPl: ['Macierz luk kompetencyjnych', 'Krytyczne luki', 'Inicjatywy budowania'],
  },
  {
    id: 'narrative-alignment',
    number: 10,
    name: 'Strategic Narrative & Alignment Engine',
    namePl: 'Silnik Narracji i Wyrównania Strategicznego',
    classicFramework: 'Strategy Communication',
    description:
      'Create coherent strategic narrative, test alignment, generate communication initiatives',
    descriptionPl:
      'Tworzenie spójnej narracji strategicznej, testowanie wyrównania, generowanie inicjatyw komunikacyjnych',
    icon: MessageSquare,
    outputs: ['Strategy Narrative', 'Alignment Score', 'Communication Initiatives'],
    outputsPl: ['Narracja strategii', 'Wynik wyrównania', 'Inicjatywy komunikacyjne'],
  },
];

export const StrategicToolsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPolish = i18n.language === 'pl';
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);

  // Handle tool query parameter from URL
  useEffect(() => {
    const toolParam = searchParams.get('tool');
    if (toolParam) {
      console.log('[StrategicToolsView] Tool param from URL:', toolParam);
      // Auto-open the tool if it's supported
      if (
        toolParam === 'dynamic-swot' ||
        toolParam === 'market-forces' ||
        toolParam === 'growth-paths' ||
        toolParam === 'portfolio-priority' ||
        toolParam === 'risk-uncertainty'
      ) {
        setActiveTool(toolParam as ToolType);
        setSelectedTool(toolParam);
        setActiveSessionId(searchParams.get('sessionId') || undefined);
      }
      // Clear the URL parameter after processing
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Deep link support: /discovery-tools/strategic?artifact=tool:<sessionId>
  useEffect(() => {
    const parsed = parseArtifactRef(searchParams.get('artifact'));
    if (!parsed || parsed.type !== 'tool') {
      const hasArtifact = searchParams.has('artifact');
      const hasCode = searchParams.has('code');
      if (!hasArtifact && !hasCode) return;

      const next = new URLSearchParams(searchParams);
      next.delete('artifact');
      next.delete('code');
      setSearchParams(next, { replace: true });
      return;
    }

    const run = async () => {
      try {
        const session = await Api.getToolSession(parsed.id);
        const resolvedToolType = String(session?.toolType || '').toLowerCase();
        if (
          resolvedToolType === 'dynamic-swot' ||
          resolvedToolType === 'market-forces' ||
          resolvedToolType === 'growth-paths' ||
          resolvedToolType === 'portfolio-priority' ||
          resolvedToolType === 'risk-uncertainty'
        ) {
          setActiveTool(resolvedToolType as ToolType);
          setSelectedTool(resolvedToolType);
          setActiveSessionId(parsed.id);
        } else {
          toast.error(
            isPolish
              ? 'Nieobsługiwany typ narzędzia dla deep-linku'
              : 'Unsupported tool type for deep link'
          );
        }
      } catch {
        toast.error(
          isPolish ? 'Nie udało się otworzyć sesji narzędzia' : 'Failed to open tool session'
        );
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete('artifact');
        next.delete('code');
        setSearchParams(next, { replace: true });
      }
    };

    void run();
  }, [searchParams, setSearchParams, isPolish]);

  const handleBack = () => {
    if (activeTool) {
      // Go back to tool list
      setActiveTool(null);
      setSelectedTool(null);
      setActiveSessionId(undefined);
    } else {
      // Go back to Discovery Tools main view
      setCurrentView(AppView.DISCOVERY_TOOLS);
    }
  };

  const handleStartTool = (toolId: string) => {
    console.log('[StrategicToolsView] Starting tool:', toolId);
    setSelectedTool(toolId);
    // Only open workspace for implemented tools
    if (
      toolId === 'dynamic-swot' ||
      toolId === 'market-forces' ||
      toolId === 'growth-paths' ||
      toolId === 'portfolio-priority' ||
      toolId === 'risk-uncertainty'
    ) {
      console.log('[StrategicToolsView] Setting active tool:', toolId);
      setActiveTool(toolId as ToolType);
    }
  };

  // If a tool is active, show the document view (canonical two-column layout)
  if (activeTool) {
    return (
      <ToolDocumentView
        toolType={activeTool}
        sessionId={activeSessionId}
        onBack={handleBack}
        onOpenInitiative={(initiativeId) => {
          console.log('Open initiative:', initiativeId);
          // Could navigate to initiative detail view
        }}
      />
    );
  }

  return (
    <div className="min-h-full bg-c-bg">
      {/* Header */}
      <div className="bg-c-surface border-b border-c-border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back', 'Back to Discovery Tools')}
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
              <Target className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-c-text">
                {t('discoveryTools.strategic.title', 'Strategic Analysis Tools')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {t(
                  'discoveryTools.strategic.subtitle',
                  '10 classic strategic frameworks powered by AI'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {STRATEGIC_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = selectedTool === tool.id;
            const isImplemented =
              tool.id === 'dynamic-swot' ||
              tool.id === 'market-forces' ||
              tool.id === 'growth-paths' ||
              tool.id === 'portfolio-priority' ||
              tool.id === 'risk-uncertainty';

            return (
              <div
                key={tool.id}
                className={`
                  p-5 rounded-xl border-2 transition-all cursor-pointer relative
                  ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-c-border-subtle bg-c-surface hover:border-emerald-300'
                  }
                  ${!isImplemented ? 'opacity-60' : ''}
                `}
                onClick={() => handleStartTool(tool.id)}
              >
                {/* In Development badge for non-implemented tools */}
                {!isImplemented && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-700 text-xs text-c-text-muted">
                    {isPolish ? 'W przygotowaniu' : 'In Development'}
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-600">#{tool.number}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
                        {tool.classicFramework}
                      </span>
                    </div>

                    <h3 className="font-semibold text-c-text mb-1">
                      {isPolish ? tool.namePl : tool.name}
                    </h3>

                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {isPolish ? tool.descriptionPl : tool.description}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {(isPolish ? tool.outputsPl : tool.outputs).map((output, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        >
                          {output}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StrategicToolsView;
