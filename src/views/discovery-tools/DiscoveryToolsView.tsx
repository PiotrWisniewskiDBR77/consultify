/**
 * DiscoveryToolsView - Landing page for Discovery Tools module
 *
 * Shows the 4 categories of tools:
 * - Strategic Analysis (10 tools)
 * - Operational Tools (10 tools)
 * - Digital Transformation (10 tools)
 * - Process Automation by AI (1 tool)
 */

import {
  ArrowRight,
  BarChart3,
  Brain,
  Cpu,
  Factory,
  Lightbulb,
  Target,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';

interface ToolCategory {
  id: string;
  title: string;
  titlePl: string;
  description: string;
  descriptionPl: string;
  icon: React.ElementType;
  color: string;
  toolCount: number;
  viewId: AppView;
  tools: string[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'strategic',
    title: 'Strategic Analysis',
    titlePl: 'Analiza Strategiczna',
    description:
      'Classic strategic frameworks powered by AI for data-driven insights and initiative generation',
    descriptionPl:
      'Klasyczne frameworki strategiczne wspierane przez AI dla wglądów opartych na danych i generowania inicjatyw',
    icon: Target,
    color: 'emerald',
    toolCount: 10,
    viewId: AppView.DISCOVERY_TOOLS_STRATEGIC,
    tools: [
      'Dynamic SWOT',
      'Market Forces (Porter)',
      'Growth Paths (Ansoff)',
      'Value Chain Analysis',
      'Portfolio Prioritization',
      'Ambition Decomposer',
      'Focus & Trade-off',
      'Risk & Uncertainty',
      'Capability Mapper',
      'Narrative & Alignment',
    ],
  },
  {
    id: 'operational',
    title: 'Operational Tools',
    titlePl: 'Narzędzia Operacyjne',
    description:
      'Lean and process excellence tools adapted for AI-driven optimization and standardization',
    descriptionPl:
      'Narzędzia Lean i doskonałości procesowej dostosowane do optymalizacji i standaryzacji wspieranej przez AI',
    icon: Workflow,
    color: 'blue',
    toolCount: 10,
    viewId: AppView.DISCOVERY_TOOLS_OPERATIONAL,
    tools: [
      'VSM Builder',
      'SOP Builder',
      'A3 Problem Solving',
      'SMED Planner',
      'DMS Builder',
      'Automation Pipeline',
      'Constraint Control',
      'Decision Automation',
      'Control Tower',
      'Inventory Autopilot',
    ],
  },
  {
    id: 'digital',
    title: 'Digital Transformation',
    titlePl: 'Transformacja Cyfrowa',
    description: 'Technology readiness and automation assessment tools for digital initiatives',
    descriptionPl:
      'Narzędzia oceny gotowości technologicznej i automatyzacji dla inicjatyw cyfrowych',
    icon: Cpu,
    color: 'purple',
    toolCount: 10,
    viewId: AppView.DISCOVERY_TOOLS_DIGITAL,
    tools: [
      'Robotics Feasibility',
      'Logistics Automation',
      'RPA Scanner',
      'AI Use-Case Discovery',
      'Integration Diagnostic',
      'Digital Value Pool',
      'Legacy Drag Analyzer',
      'Data Asset Inventory',
      'Pain-to-Solution Matcher',
      'Structured Pain Explorer',
    ],
  },
  {
    id: 'process-automation',
    title: 'Process Automation by AI',
    titlePl: 'Automatyzacja Procesów AI',
    description:
      'Interactive workshop for process analysis, lean optimization, and automation planning',
    descriptionPl:
      'Interaktywny warsztat do analizy procesów, optymalizacji lean i planowania automatyzacji',
    icon: Zap,
    color: 'amber',
    toolCount: 1,
    viewId: AppView.DISCOVERY_TOOLS_PROCESS_AUTOMATION,
    tools: ['Process Automation Builder'],
  },
];

export const DiscoveryToolsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const isPolish = i18n.language === 'pl';

  const handleCategoryClick = (viewId: AppView) => {
    setCurrentView(viewId);
  };

  return (
    <div className="min-h-full bg-c-bg">
      {/* Header */}
      <div className="bg-c-surface border-b border-c-border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-c-accent-soft rounded-xl">
              <Wrench className="w-6 h-6 text-c-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-c-text">
                {t('discoveryTools.title', 'Discovery Tools')}
              </h1>
              <p className="text-c-text-secondary">
                {t(
                  'discoveryTools.subtitle',
                  '31 AI-powered tools for strategic, operational, and digital transformation'
                )}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-c-info" />
              <span className="text-sm text-c-text-secondary">
                {t('discoveryTools.stats.aiPowered', 'AI-powered analysis')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-c-warning" />
              <span className="text-sm text-c-text-secondary">
                {t('discoveryTools.stats.initiatives', 'Generates initiatives')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-c-success" />
              <span className="text-sm text-c-text-secondary">
                {t('discoveryTools.stats.visualizations', 'Interactive visualizations')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TOOL_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const colorClasses = {
              emerald:
                'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400',
              blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-400',
              purple:
                'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 hover:border-violet-400',
              amber:
                'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:border-amber-400',
            };
            const iconColorClasses = {
              emerald: 'text-emerald-600 dark:text-emerald-400',
              blue: 'text-blue-600 dark:text-blue-400',
              purple: 'text-violet-600 dark:text-violet-400',
              amber: 'text-amber-600 dark:text-amber-400',
            };

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.viewId)}
                className={`
                  p-6 rounded-xl border-2 text-left transition-[box-shadow,border-color] duration-200
                  ${colorClasses[category.color as keyof typeof colorClasses]}
                  hover:shadow-lg group
                `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-c-surface shadow-sm`}>
                    <Icon
                      className={`w-6 h-6 ${iconColorClasses[category.color as keyof typeof iconColorClasses]}`}
                    />
                  </div>
                  <span className="text-sm font-medium text-c-text-muted">
                    {category.toolCount} {category.toolCount === 1 ? 'tool' : 'tools'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-c-text mb-2">
                  {isPolish ? category.titlePl : category.title}
                </h3>

                <p className="text-sm text-c-text-secondary mb-4">
                  {isPolish ? category.descriptionPl : category.description}
                </p>

                {/* Tool list preview */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {category.tools.slice(0, 4).map((tool) => (
                    <span
                      key={tool}
                      className="px-2 py-1 text-xs rounded-full bg-c-surface/60 text-c-text-secondary"
                    >
                      {tool}
                    </span>
                  ))}
                  {category.tools.length > 4 && (
                    <span className="px-2 py-1 text-xs rounded-full bg-c-surface/60 text-c-text-muted">
                      +{category.tools.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-c-text group-hover:text-c-accent transition-colors duration-200">
                  {t('discoveryTools.explore', 'Explore tools')}
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* How it works */}
        <div className="mt-12 p-6 bg-c-surface rounded-xl border border-c-border-subtle">
          <h2 className="text-lg font-semibold text-c-text mb-4">
            {t('discoveryTools.howItWorks.title', 'How Discovery Tools Work')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                step: 1,
                title: 'Select Tool',
                titlePl: 'Wybierz narzędzie',
                desc: 'Choose from 31 specialized tools',
                descPl: 'Wybierz spośród 31 specjalistycznych narzędzi',
              },
              {
                step: 2,
                title: 'AI Interview',
                titlePl: 'Rozmowa z AI',
                desc: 'Chat guides you through analysis',
                descPl: 'Czat prowadzi Cię przez analizę',
              },
              {
                step: 3,
                title: 'Visualization',
                titlePl: 'Wizualizacja',
                desc: 'See results in real-time',
                descPl: 'Zobacz wyniki w czasie rzeczywistym',
              },
              {
                step: 4,
                title: 'Generate Initiatives',
                titlePl: 'Generuj inicjatywy',
                desc: 'Create actionable initiatives',
                descPl: 'Twórz wykonalne inicjatywy',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-c-accent-soft flex items-center justify-center">
                  <span className="text-sm font-bold text-c-accent">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-c-text">
                    {isPolish ? item.titlePl : item.title}
                  </h3>
                  <p className="text-sm text-c-text-secondary">
                    {isPolish ? item.descPl : item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryToolsView;
