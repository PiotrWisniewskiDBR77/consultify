/**
 * OperationalToolsView - Operational Excellence Tools (11-20)
 *
 * Lean and process excellence tools:
 * 11. Digital VSM Builder
 * 12. Standard Work & SOP Builder
 * 13. A3 Problem Solving
 * 14. SMED / Changeover Planner
 * 15. Daily Management System Builder
 * 16. Operational Automation Pipeline
 * 17. Real-Time Constraint Control Loop
 * 18. Decision Automation Engine
 * 19. Shopfloor Digital Control Tower
 * 20. Inventory Autopilot
 */

import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  Gauge,
  Layers,
  Package,
  Settings,
  Target,
  Workflow,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolWorkspace } from '@/components/DiscoveryTools';
import { useAppStore } from '@/store/useAppStore';
import { ToolType } from '@/store/useToolStore';
import { AppView } from '@/types';

interface OperationalTool {
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

const OPERATIONAL_TOOLS: OperationalTool[] = [
  {
    id: 'vsm-builder',
    number: 11,
    name: 'Digital Value Stream Map Builder',
    namePl: 'Cyfrowy Kreator Mapy Strumienia Wartości',
    classicFramework: 'Value Stream Mapping',
    description:
      'Chat-guided VSM creation with templates for O2C, P2P, and more - identify bottlenecks and waste',
    descriptionPl:
      'Tworzenie VSM prowadzone przez czat z szablonami dla O2C, P2P i więcej - identyfikacja wąskich gardeł i marnotrawstwa',
    icon: Workflow,
    outputs: ['Current State VSM', 'Future State VSM', 'Improvement Initiatives'],
    outputsPl: ['VSM stanu obecnego', 'VSM stanu docelowego', 'Inicjatywy usprawnienia'],
  },
  {
    id: 'sop-builder',
    number: 12,
    name: 'Standard Work & SOP Builder',
    namePl: 'Kreator Pracy Standaryzowanej i SOP',
    classicFramework: 'Standard Work',
    description:
      'Create operational standards with checklists, quality criteria, and drift detection',
    descriptionPl:
      'Tworzenie standardów operacyjnych z checklistami, kryteriami jakości i wykrywaniem odchyleń',
    icon: FileText,
    outputs: ['SOP Document', 'Checklists', 'Training Materials'],
    outputsPl: ['Dokument SOP', 'Checklisty', 'Materiały szkoleniowe'],
  },
  {
    id: 'a3-problem-solving',
    number: 13,
    name: 'A3 Problem Solving',
    namePl: 'Rozwiązywanie Problemów A3',
    classicFramework: 'Toyota A3',
    description: 'Structured root cause analysis with 5 Why, countermeasures, and follow-up KPIs',
    descriptionPl:
      'Strukturalna analiza przyczyn źródłowych z 5 Why, środkami zaradczymi i KPI monitorowania',
    icon: Target,
    outputs: ['A3 Report', 'Countermeasures List', 'Follow-up KPIs'],
    outputsPl: ['Raport A3', 'Lista środków zaradczych', 'KPI monitorowania'],
  },
  {
    id: 'smed-planner',
    number: 14,
    name: 'SMED / Changeover Reduction Planner',
    namePl: 'Planer Redukcji Przezbrojeń SMED',
    classicFramework: 'SMED',
    description:
      'Analyze changeover activities, separate internal/external, calculate ROI of improvements',
    descriptionPl:
      'Analiza czynności przezbrojeń, separacja wewnętrzne/zewnętrzne, kalkulacja ROI usprawnień',
    icon: Clock,
    outputs: ['SMED Analysis', 'Quick Wins List', 'Investment ROI'],
    outputsPl: ['Analiza SMED', 'Lista szybkich usprawnień', 'ROI inwestycji'],
  },
  {
    id: 'dms-builder',
    number: 15,
    name: 'Daily Management System Builder',
    namePl: 'Kreator Systemu Zarządzania Dziennego',
    classicFramework: 'Lean DMS',
    description:
      'Configure tier meetings, KPIs, escalation rules, and issue-to-initiative pipeline',
    descriptionPl: 'Konfiguracja spotkań tier, KPI, reguł eskalacji i ścieżki problem-inicjatywa',
    icon: BarChart3,
    outputs: ['Tier Meeting Structure', 'KPI Boards', 'Escalation Rules'],
    outputsPl: ['Struktura spotkań tier', 'Tablice KPI', 'Reguły eskalacji'],
  },
  {
    id: 'automation-pipeline',
    number: 16,
    name: 'Operational Automation Pipeline Builder',
    namePl: 'Kreator Ścieżki Automatyzacji Operacyjnej',
    classicFramework: 'Automation Backlog',
    description:
      'Build prioritized automation backlog from VSM insights - RPA, workflow, AI, integrations',
    descriptionPl:
      'Budowanie priorytetyzowanego backlogu automatyzacji z wniosków VSM - RPA, workflow, AI, integracje',
    icon: Bot,
    outputs: ['Automation Backlog', 'Technology Recommendations', 'ROI Estimates'],
    outputsPl: ['Backlog automatyzacji', 'Rekomendacje technologii', 'Estymacje ROI'],
  },
  {
    id: 'constraint-control',
    number: 17,
    name: 'Real-Time Constraint Control Loop',
    namePl: 'Pętla Sterowania Ograniczeniami',
    classicFramework: 'Theory of Constraints',
    description: 'Define bottlenecks, prioritization rules, dispatch logic, and capacity alerts',
    descriptionPl:
      'Definiowanie wąskich gardeł, reguł priorytetyzacji, logiki dyspozycji i alertów pojemności',
    icon: Gauge,
    outputs: ['Constraint Map', 'Priority Rules', 'Alert Configuration'],
    outputsPl: ['Mapa ograniczeń', 'Reguły priorytetów', 'Konfiguracja alertów'],
  },
  {
    id: 'decision-automation',
    number: 18,
    name: 'Decision Automation Engine',
    namePl: 'Silnik Automatyzacji Decyzji',
    classicFramework: 'Policy-as-Code',
    description: 'Map decision points, define policy rules, simulate impact of automation',
    descriptionPl:
      'Mapowanie punktów decyzyjnych, definiowanie reguł polityki, symulacja wpływu automatyzacji',
    icon: Settings,
    outputs: ['Decision Catalog', 'Policy Rules', 'Automation Impact'],
    outputsPl: ['Katalog decyzji', 'Reguły polityki', 'Wpływ automatyzacji'],
  },
  {
    id: 'control-tower',
    number: 19,
    name: 'Shopfloor Digital Control Tower',
    namePl: 'Cyfrowa Wieża Kontroli Produkcji',
    classicFramework: 'Visual Management',
    description: 'Design visibility dashboard for physical operations - states, anomalies, actions',
    descriptionPl:
      'Projektowanie dashboardu widoczności dla operacji fizycznych - stany, anomalie, akcje',
    icon: Layers,
    outputs: ['Dashboard Design', 'Anomaly Detection', 'Action Protocols'],
    outputsPl: ['Projekt dashboardu', 'Wykrywanie anomalii', 'Protokoły akcji'],
  },
  {
    id: 'inventory-autopilot',
    number: 20,
    name: 'Inventory Autopilot',
    namePl: 'Autopilot Zapasów',
    classicFramework: 'ABC/XYZ Analysis',
    description: 'Classify SKUs, define replenishment policies, simulate cash and stockout impact',
    descriptionPl:
      'Klasyfikacja SKU, definiowanie polityk uzupełniania, symulacja wpływu na gotówkę i braki',
    icon: Package,
    outputs: ['ABC/XYZ Map', 'Replenishment Policies', 'Cash Impact Simulation'],
    outputsPl: ['Mapa ABC/XYZ', 'Polityki uzupełniania', 'Symulacja wpływu na gotówkę'],
  },
];

export const OperationalToolsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const isPolish = i18n.language === 'pl';
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

  const handleBack = () => {
    if (activeTool) {
      setActiveTool(null);
      setSelectedTool(null);
    } else {
      setCurrentView(AppView.DISCOVERY_TOOLS);
    }
  };

  const handleStartTool = (toolId: string) => {
    console.log('Starting tool:', toolId);
    setSelectedTool(toolId);
    if (
      toolId === 'sop-builder' ||
      toolId === 'a3-problem-solving' ||
      toolId === 'smed-planner' ||
      toolId === 'dms-builder' ||
      toolId === 'inventory-autopilot'
    ) {
      setActiveTool(toolId as ToolType);
    }
  };

  if (activeTool) {
    return <ToolWorkspace toolType={activeTool} onBack={handleBack} />;
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
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <Workflow className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-c-text">
                {t('discoveryTools.operational.title', 'Operational Excellence Tools')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {t(
                  'discoveryTools.operational.subtitle',
                  '10 Lean and process excellence tools powered by AI'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {OPERATIONAL_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = selectedTool === tool.id;
            const isImplemented =
              tool.id === 'sop-builder' ||
              tool.id === 'a3-problem-solving' ||
              tool.id === 'smed-planner' ||
              tool.id === 'dms-builder' ||
              tool.id === 'inventory-autopilot';

            return (
              <div
                key={tool.id}
                className={`
                  p-5 rounded-xl border-2 transition-all cursor-pointer relative
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-c-border-subtle bg-c-surface hover:border-blue-300'
                  }
                  ${!isImplemented ? 'opacity-60' : ''}
                `}
                onClick={() => handleStartTool(tool.id)}
              >
                {!isImplemented && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-700 text-xs text-c-text-muted">
                    {isPolish ? 'W przygotowaniu' : 'In Development'}
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                          className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
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

export default OperationalToolsView;
