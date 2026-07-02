/**
 * DigitalToolsView - Digital Transformation Tools (21-30)
 *
 * Technology readiness and automation assessment tools:
 * 21. Robotics Deployment Feasibility Analyzer
 * 22. Logistics & Warehouse Automation Analyzer
 * 23. RPA & Workflow Automation Scanner
 * 24. AI Use-Case Discovery & Readiness
 * 25. IT System Integration Diagnostic
 * 26. Digital Value Pool Identifier
 * 27. Legacy Technology Drag Analyzer
 * 28. Data Asset & Gap Inventory
 * 29. Pain-to-Solution Matcher
 * 30. Structured Pain Explorer
 */

import {
  ArrowLeft,
  Bot,
  Brain,
  ChevronRight,
  Cloud,
  Cpu,
  Database,
  HardDrive,
  Layers,
  Link,
  MessageSquare,
  Package,
  Plug,
  Search,
  Truck,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';

interface DigitalTool {
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

const DIGITAL_TOOLS: DigitalTool[] = [
  {
    id: 'robotics-feasibility',
    number: 21,
    name: 'Robotics Deployment Feasibility Analyzer',
    namePl: 'Analizator Wykonalności Wdrożenia Robotów',
    classicFramework: 'Robotics Assessment',
    description:
      'Evaluate processes for robotization potential - industrial, cobots, AMR with ROI estimates',
    descriptionPl:
      'Ocena procesów pod kątem potencjału robotyzacji - przemysłowe, coboty, AMR z estymacjami ROI',
    icon: Bot,
    outputs: ['Robotics Candidate Map', 'ROI Ranges', 'Prerequisites List'],
    outputsPl: ['Mapa kandydatów do robotyzacji', 'Zakresy ROI', 'Lista wymagań wstępnych'],
  },
  {
    id: 'logistics-automation',
    number: 22,
    name: 'Logistics & Warehouse Automation Analyzer',
    namePl: 'Analizator Automatyzacji Logistyki i Magazynu',
    classicFramework: 'Intralogistics Assessment',
    description:
      'Identify physical and algorithmic automation potential in logistics - AMR, AS/RS, slotting',
    descriptionPl:
      'Identyfikacja potencjału automatyzacji fizycznej i algorytmicznej w logistyce - AMR, AS/RS, slotting',
    icon: Truck,
    outputs: ['Logistics Automation Map', 'Feasibility Scores', 'Implementation Roadmap'],
    outputsPl: ['Mapa automatyzacji logistyki', 'Wyniki wykonalności', 'Mapa drogowa wdrożenia'],
  },
  {
    id: 'rpa-scanner',
    number: 23,
    name: 'RPA & Workflow Automation Scanner',
    namePl: 'Skaner Automatyzacji RPA i Workflow',
    classicFramework: 'RPA Suitability',
    description:
      'Identify office and transactional processes suitable for RPA, workflow, or API automation',
    descriptionPl:
      'Identyfikacja procesów biurowych i transakcyjnych odpowiednich dla RPA, workflow lub automatyzacji API',
    icon: Zap,
    outputs: ['Automation Heatmap', 'Use Case List', 'Technology Recommendations'],
    outputsPl: [
      'Mapa cieplna automatyzacji',
      'Lista przypadków użycia',
      'Rekomendacje technologii',
    ],
  },
  {
    id: 'ai-usecase-discovery',
    number: 24,
    name: 'AI Use-Case Discovery & Readiness',
    namePl: 'Odkrywanie i Gotowość Przypadków Użycia AI',
    classicFramework: 'AI Readiness',
    description:
      'Find real AI opportunities - classify use cases, assess data readiness, identify blockers',
    descriptionPl:
      'Znajdowanie realnych możliwości AI - klasyfikacja przypadków użycia, ocena gotowości danych, identyfikacja blokerów',
    icon: Brain,
    outputs: ['AI Use-Case Portfolio', 'Readiness Scores', 'Data Foundation Initiatives'],
    outputsPl: [
      'Portfolio przypadków użycia AI',
      'Wyniki gotowości',
      'Inicjatywy fundamentu danych',
    ],
  },
  {
    id: 'integration-diagnostic',
    number: 25,
    name: 'IT System Integration Diagnostic',
    namePl: 'Diagnostyka Integracji Systemów IT',
    classicFramework: 'Application Landscape',
    description:
      'Map system interactions, find integration debt, recommend architecture improvements',
    descriptionPl:
      'Mapowanie interakcji systemów, wykrywanie długu integracyjnego, rekomendowanie usprawnień architektury',
    icon: Plug,
    outputs: ['Integration Reality Map', 'Critical Points', 'Architecture Recommendations'],
    outputsPl: ['Mapa rzeczywistości integracji', 'Punkty krytyczne', 'Rekomendacje architektury'],
  },
  {
    id: 'digital-value-pool',
    number: 26,
    name: 'Digital Value Pool Identifier',
    namePl: 'Identyfikator Pul Wartości Cyfrowej',
    classicFramework: 'Digital Economics',
    description: 'Find where digitalization changes economics - capital, decisions, quality, scale',
    descriptionPl:
      'Znajdowanie gdzie cyfryzacja zmienia ekonomię - kapitał, decyzje, jakość, skala',
    icon: Database,
    outputs: ['Value Pool Map', 'Economic Initiatives', 'EBITDA Impact'],
    outputsPl: ['Mapa pul wartości', 'Inicjatywy ekonomiczne', 'Wpływ na EBITDA'],
  },
  {
    id: 'legacy-drag',
    number: 27,
    name: 'Legacy Technology Drag Analyzer',
    namePl: 'Analizator Oporu Technologii Legacy',
    classicFramework: 'Technical Debt',
    description: 'Quantify legacy drag in decision latency, change cost, and operational risk',
    descriptionPl:
      'Kwantyfikacja oporu legacy w opóźnieniu decyzji, koszcie zmian i ryzyku operacyjnym',
    icon: HardDrive,
    outputs: ['Drag Scorecard', 'Targeted Solutions', 'Migration Alternatives'],
    outputsPl: ['Karta wyników oporu', 'Ukierunkowane rozwiązania', 'Alternatywy migracji'],
  },
  {
    id: 'data-asset-inventory',
    number: 28,
    name: 'Data Asset & Gap Inventory',
    namePl: 'Inwentaryzacja Zasobów Danych i Luk',
    classicFramework: 'Data Governance',
    description: 'Map decisions to required data, identify gaps, find unused data waste',
    descriptionPl:
      'Mapowanie decyzji do wymaganych danych, identyfikacja luk, znajdowanie marnotrawstwa nieużywanych danych',
    icon: Layers,
    outputs: ['Decision-to-Data Map', 'Data Gap List', 'Foundation Initiatives'],
    outputsPl: ['Mapa decyzja-dane', 'Lista luk danych', 'Inicjatywy fundamentu'],
  },
  {
    id: 'pain-to-solution',
    number: 29,
    name: 'Pain-to-Solution Matcher',
    namePl: 'Matcher Problem-Rozwiązanie',
    classicFramework: 'Solution Mapping',
    description:
      'Bridge discovery insights to solution classes and vendor archetypes - connects to DBR77 Marketplace',
    descriptionPl:
      'Most między wnioskami discovery a klasami rozwiązań i archetypami dostawców - połączenie z DBR77 Marketplace',
    icon: Link,
    outputs: ['Solution Recommendations', 'Vendor Archetypes', 'Integration Requirements'],
    outputsPl: ['Rekomendacje rozwiązań', 'Archetypy dostawców', 'Wymagania integracji'],
  },
  {
    id: 'structured-pain-explorer',
    number: 30,
    name: 'Structured Pain Explorer',
    namePl: 'Eksplorator Strukturyzacji Problemów',
    classicFramework: 'Problem Framing',
    description:
      'Convert chaotic user descriptions into structured problems, hypotheses, and initiative drafts',
    descriptionPl:
      'Konwersja chaotycznych opisów użytkowników w strukturyzowane problemy, hipotezy i szkice inicjatyw',
    icon: MessageSquare,
    outputs: ['Problem Statement', 'Hypothesis List', 'Initiative Draft'],
    outputsPl: ['Opis problemu', 'Lista hipotez', 'Szkic inicjatywy'],
  },
];

export const DigitalToolsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const isPolish = i18n.language === 'pl';
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const handleBack = () => {
    setCurrentView(AppView.DISCOVERY_TOOLS);
  };

  const handleStartTool = (toolId: string) => {
    console.log('Starting tool:', toolId);
    setSelectedTool(toolId);
  };

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
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-c-text">
                {t('discoveryTools.digital.title', 'Digital Transformation Tools')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {t(
                  'discoveryTools.digital.subtitle',
                  '10 technology readiness and automation assessment tools'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DIGITAL_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = selectedTool === tool.id;

            return (
              <div
                key={tool.id}
                className={`
                  p-5 rounded-xl border-2 transition-all cursor-pointer
                  ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-c-border-subtle bg-c-surface hover:border-primary-300'
                  }
                `}
                onClick={() => handleStartTool(tool.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
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
                          className="px-2 py-1 text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
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

export default DigitalToolsView;
