/**
 * AssessmentView
 *
 * Main view for Assessment module with framework selection.
 * Routes to AssessmentModuleHub with selected framework.
 *
 * Supported frameworks:
 * - DRD (Digital Readiness Diagnosis) - Full implementation
 * - SIRI (Smart Industry Readiness Index) - Full implementation
 * - ADMA (Advanced Digital Maturity Assessment) - Full implementation
 * - CMMI - Coming soon
 * - Lean 4.0 - Coming soon
 */

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Layers,
  Plus,
  Settings,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AssessmentModuleHub } from '../components/assessment/AssessmentModuleHub';
import { SplitLayout } from '../components/layout/SplitLayout';
import { useAppStore } from '../store/useAppStore';
import { AssessmentFramework, useMultiFrameworkStore } from '../store/useMultiFrameworkStore';
import { AppView } from '../types';

// Framework configuration
const FRAMEWORKS: {
  id: AssessmentFramework;
  name: string;
  namePL: string;
  description: string;
  descriptionPL: string;
  icon: React.ReactNode;
  color: string;
  status: 'available' | 'coming_soon';
}[] = [
  {
    id: 'DRD',
    name: 'Digital Readiness Diagnosis',
    namePL: 'Diagnoza Gotowości Cyfrowej',
    description:
      '7-axis digital maturity assessment covering processes, products, business models, data, culture, cybersecurity, and AI.',
    descriptionPL:
      '7-osiowa ocena dojrzałości cyfrowej obejmująca procesy, produkty, modele biznesowe, dane, kulturę, cyberbezpieczeństwo i AI.',
    icon: <Activity size={32} />,
    color: 'purple',
    status: 'available',
  },
  {
    id: 'SIRI',
    name: 'Smart Industry Readiness Index',
    namePL: 'Indeks Gotowości do Przemysłu 4.0',
    description:
      'Industry 4.0 readiness with 3 building blocks, 8 dimensions, and 16 prioritisation areas.',
    descriptionPL:
      'Gotowość do Przemysłu 4.0 z 3 blokami budowlanymi, 8 wymiarami i 16 obszarami priorytetyzacji.',
    icon: <Cpu size={32} />,
    color: 'green',
    status: 'available',
  },
  {
    id: 'ADMA',
    name: 'Advanced Digital Maturity Assessment',
    namePL: 'Zaawansowana Ocena Dojrzałości Cyfrowej',
    description: 'Comprehensive digital maturity model for manufacturing excellence.',
    descriptionPL: 'Kompleksowy model dojrzałości cyfrowej dla doskonałości produkcyjnej.',
    icon: <Database size={32} />,
    color: 'blue',
    // T3A 2026-06-29: odbramkowane — ADMA kompletny (editor/map/report/knowledgeBase
    // = full integration w frameworkRegistry; weryfikacja przed flipem). CMMI/LEAN
    // zostają coming_soon (D-B: wydmuszka/brak warstwy doradczej).
    status: 'available',
  },
  {
    id: 'CMMI',
    name: 'Capability Maturity Model Integration',
    namePL: 'Zintegrowany Model Dojrzałości Zdolności',
    description: 'Process improvement framework for development and service excellence.',
    descriptionPL: 'Framework doskonalenia procesów dla rozwoju i doskonałości usług.',
    icon: <Layers size={32} />,
    color: 'orange',
    status: 'coming_soon',
  },
  {
    id: 'LEAN',
    name: 'Lean 4.0',
    namePL: 'Lean 4.0',
    description: 'Lean manufacturing maturity assessment with Industry 4.0 integration.',
    descriptionPL: 'Ocena dojrzałości lean manufacturing z integracją Przemysłu 4.0.',
    icon: <Workflow size={32} />,
    color: 'cyan',
    status: 'coming_soon',
  },
];

interface AssessmentViewProps {
  initialFramework?: AssessmentFramework;
  initialAssessmentId?: string;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  initialFramework,
  initialAssessmentId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { setCurrentView, currentProjectId } = useAppStore();

  const [selectedFramework, setSelectedFramework] = useState<AssessmentFramework | null>(
    initialFramework || null
  );
  const [showFrameworkSelector, setShowFrameworkSelector] = useState(!initialFramework);

  // Get recent assessments count per framework
  const { drdData, siriData, admaData, cmmiData, leanData } = useMultiFrameworkStore();

  const frameworkStats = useMemo(() => {
    return {
      DRD: drdData ? 1 : 0,
      SIRI: siriData ? 1 : 0,
      ADMA: admaData ? 1 : 0,
      CMMI: cmmiData ? 1 : 0,
      LEAN: leanData ? 1 : 0,
    };
  }, [drdData, siriData, admaData, cmmiData, leanData]);

  // Handle framework selection
  const handleSelectFramework = useCallback((framework: AssessmentFramework) => {
    setSelectedFramework(framework);
    setShowFrameworkSelector(false);
  }, []);

  // Handle navigation
  const handleNavigate = useCallback(
    (view: AppView, params?: any) => {
      setCurrentView(view);
    },
    [setCurrentView]
  );

  // Handle back to selector
  const handleBackToSelector = useCallback(() => {
    setSelectedFramework(null);
    setShowFrameworkSelector(true);
  }, []);

  // Render framework selector
  const renderFrameworkSelector = () => (
    <div className="min-h-full bg-slate-50 dark:bg-navy-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <BarChart3 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                {t('licensedTools.moduleName', 'Licensed Tools')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Wybierz framework oceny dojrzałości'
                  : 'Select a maturity assessment framework'}
              </p>
            </div>
          </div>
        </div>

        {/* Framework Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FRAMEWORKS.map((framework) => {
            const isAvailable = framework.status === 'available';
            const assessmentCount = frameworkStats[framework.id];

            return (
              <div
                key={framework.id}
                className={`bg-white dark:bg-navy-900 rounded-xl border transition-all ${
                  isAvailable
                    ? 'border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/50 hover:shadow-lg cursor-pointer'
                    : 'border-slate-200 dark:border-navy-700 opacity-75'
                }`}
                onClick={() => isAvailable && handleSelectFramework(framework.id)}
              >
                {/* Card Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-14 h-14 rounded-xl bg-${framework.color}-100 dark:bg-${framework.color}-900/30 text-${framework.color}-600 dark:text-${framework.color}-400 flex items-center justify-center`}
                    >
                      {framework.icon}
                    </div>
                    {framework.status === 'coming_soon' && (
                      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                        {isPolish ? 'W przygotowaniu' : 'In Development'}
                      </span>
                    )}
                    {isAvailable && assessmentCount > 0 && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {assessmentCount} {isPolish ? 'ocen' : 'assessments'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2">
                    {framework.id}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    {isPolish ? framework.namePL : framework.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? framework.descriptionPL : framework.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
                  {isAvailable ? (
                    <button
                      className={`flex items-center gap-2 text-${framework.color}-600 dark:text-${framework.color}-400 font-medium text-sm hover:underline`}
                    >
                      {isPolish ? 'Rozpocznij ocenę' : 'Start Assessment'}
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-500 text-sm">
                      <Clock size={16} />
                      {isPolish ? 'W przygotowaniu' : 'In Development'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Assessments */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
            {isPolish ? 'Ostatnie oceny' : 'Recent Assessments'}
          </h2>
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Twoje ostatnie oceny pojawią się tutaj'
                  : 'Your recent assessments will appear here'}
              </p>
              <button
                onClick={() => handleSelectFramework('DRD')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded-lg transition-colors"
              >
                <Plus size={16} />
                {isPolish ? 'Nowa ocena DRD' : 'New DRD Assessment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // If framework selected, show the module hub
  if (selectedFramework && !showFrameworkSelector) {
    return (
      <AssessmentModuleHub
        framework={selectedFramework}
        initialAssessmentId={initialAssessmentId}
        onNavigate={handleNavigate}
      />
    );
  }

  // Otherwise show the framework selector
  return (
    <SplitLayout
      title={isPolish ? 'Assessment' : 'Assessment'}
      currentView={AppView.ASSESSMENT_OVERVIEW}
    >
      {renderFrameworkSelector()}
    </SplitLayout>
  );
};

export default AssessmentView;
