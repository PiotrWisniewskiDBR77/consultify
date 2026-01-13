/**
 * Transformation Tools Catalog
 *
 * Catalog of tools and methodologies for transformation consulting.
 * Used by Discovery Consultant to recommend appropriate tools.
 */

import { TransformationType } from '@/types/discovery';

export interface TransformationTool {
  id: string;
  name: string;
  namePl: string;
  category: string;
  categoryPl: string;
  description: string;
  descriptionPl: string;
  icon: string; // Lucide icon name
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  duration: string; // e.g., "1-2 weeks"
  prerequisites?: string[];
  deliverables: string[];
  deliverablespl: string[];
}

export const TRANSFORMATION_TOOLS: Record<TransformationType, TransformationTool[]> = {
  strategic: [
    {
      id: 'swot',
      name: 'SWOT Analysis',
      namePl: 'Analiza SWOT',
      category: 'Strategic Analysis',
      categoryPl: 'Analiza strategiczna',
      description: 'Analyze Strengths, Weaknesses, Opportunities, and Threats',
      descriptionPl: 'Analiza mocnych i słabych stron oraz szans i zagrożeń',
      icon: 'Grid3x3',
      effort: 'low',
      impact: 'medium',
      duration: '1-2 days',
      deliverables: ['SWOT Matrix', 'Strategic recommendations'],
      deliverablespl: ['Macierz SWOT', 'Rekomendacje strategiczne'],
    },
    {
      id: 'porter',
      name: "Porter's 5 Forces",
      namePl: '5 Sił Portera',
      category: 'Competition Analysis',
      categoryPl: 'Analiza konkurencji',
      description: 'Analyze competitive forces in the industry',
      descriptionPl: 'Analiza sił konkurencyjnych w branży',
      icon: 'Pentagon',
      effort: 'medium',
      impact: 'high',
      duration: '1 week',
      deliverables: ['Industry analysis', 'Competitive positioning'],
      deliverablespl: ['Analiza branży', 'Pozycjonowanie konkurencyjne'],
    },
    {
      id: 'bcg',
      name: 'BCG Matrix',
      namePl: 'Macierz BCG',
      category: 'Portfolio Analysis',
      categoryPl: 'Analiza portfolio',
      description: 'Evaluate product/service portfolio for investment decisions',
      descriptionPl: 'Ocena portfolio produktów/usług dla decyzji inwestycyjnych',
      icon: 'LayoutGrid',
      effort: 'medium',
      impact: 'high',
      duration: '1-2 weeks',
      deliverables: ['Portfolio matrix', 'Investment priorities'],
      deliverablespl: ['Macierz portfolio', 'Priorytety inwestycyjne'],
    },
    {
      id: 'okr',
      name: 'OKR Framework',
      namePl: 'Framework OKR',
      category: 'Goal Setting',
      categoryPl: 'Definiowanie celów',
      description: 'Define Objectives and Key Results for strategic alignment',
      descriptionPl: 'Definiowanie celów i kluczowych wyników dla spójności strategicznej',
      icon: 'Target',
      effort: 'medium',
      impact: 'high',
      duration: '2-4 weeks',
      deliverables: ['OKR hierarchy', 'Measurement framework'],
      deliverablespl: ['Hierarchia OKR', 'Framework pomiarowy'],
    },
    {
      id: 'balanced_scorecard',
      name: 'Balanced Scorecard',
      namePl: 'Zrównoważona karta wyników',
      category: 'Performance Management',
      categoryPl: 'Zarządzanie wydajnością',
      description: 'Multi-perspective performance measurement framework',
      descriptionPl: 'Wielowymiarowy framework pomiaru wyników',
      icon: 'PieChart',
      effort: 'high',
      impact: 'high',
      duration: '4-6 weeks',
      deliverables: ['Scorecard design', 'KPI definitions', 'Dashboards'],
      deliverablespl: ['Projekt karty', 'Definicje KPI', 'Dashboardy'],
    },
    {
      id: 'business_model_canvas',
      name: 'Business Model Canvas',
      namePl: 'Canvas Modelu Biznesowego',
      category: 'Business Design',
      categoryPl: 'Projektowanie biznesu',
      description: 'Visual business model design and innovation tool',
      descriptionPl: 'Wizualne narzędzie do projektowania i innowacji modelu biznesowego',
      icon: 'Layers',
      effort: 'low',
      impact: 'high',
      duration: '1-3 days',
      deliverables: ['Business Model Canvas', 'Value proposition'],
      deliverablespl: ['Canvas modelu biznesowego', 'Propozycja wartości'],
    },
    {
      id: 'scenario_planning',
      name: 'Scenario Planning',
      namePl: 'Planowanie scenariuszowe',
      category: 'Strategic Foresight',
      categoryPl: 'Prognozowanie strategiczne',
      description: 'Develop and analyze future scenarios for strategic planning',
      descriptionPl: 'Opracowanie i analiza scenariuszy przyszłości dla planowania strategicznego',
      icon: 'GitBranch',
      effort: 'high',
      impact: 'high',
      duration: '2-4 weeks',
      deliverables: ['Scenario narratives', 'Strategic options'],
      deliverablespl: ['Opisy scenariuszy', 'Opcje strategiczne'],
    },
  ],

  operational: [
    {
      id: 'vsm',
      name: 'Value Stream Mapping',
      namePl: 'Mapowanie strumienia wartości',
      category: 'Process Analysis',
      categoryPl: 'Analiza procesów',
      description: 'Visualize and analyze the flow of materials and information',
      descriptionPl: 'Wizualizacja i analiza przepływu materiałów i informacji',
      icon: 'Workflow',
      effort: 'medium',
      impact: 'high',
      duration: '1-2 weeks',
      deliverables: ['Current state map', 'Future state map', 'Action plan'],
      deliverablespl: ['Mapa stanu obecnego', 'Mapa stanu docelowego', 'Plan działań'],
    },
    {
      id: 'kaizen',
      name: 'Kaizen Events',
      namePl: 'Warsztaty Kaizen',
      category: 'Continuous Improvement',
      categoryPl: 'Ciągłe doskonalenie',
      description: 'Rapid improvement workshops focused on specific processes',
      descriptionPl: 'Warsztaty szybkiego doskonalenia skupione na konkretnych procesach',
      icon: 'TrendingUp',
      effort: 'medium',
      impact: 'medium',
      duration: '3-5 days',
      deliverables: ['Improved process', 'Standard work', 'Sustainability plan'],
      deliverablespl: ['Usprawniony proces', 'Praca standaryzowana', 'Plan utrzymania'],
    },
    {
      id: '5s',
      name: '5S Methodology',
      namePl: 'Metodologia 5S',
      category: 'Workplace Organization',
      categoryPl: 'Organizacja miejsca pracy',
      description: 'Sort, Set in order, Shine, Standardize, Sustain',
      descriptionPl: 'Sortuj, Systematyzuj, Sprzątaj, Standaryzuj, Samodyscyplina',
      icon: 'LayoutList',
      effort: 'low',
      impact: 'medium',
      duration: '2-4 weeks',
      deliverables: ['5S audit checklist', 'Visual standards', 'Maintenance schedule'],
      deliverablespl: ['Lista kontrolna 5S', 'Standardy wizualne', 'Harmonogram utrzymania'],
    },
    {
      id: 'smed',
      name: 'SMED',
      namePl: 'SMED',
      category: 'Changeover Reduction',
      categoryPl: 'Redukcja przezbrojeń',
      description: 'Single-Minute Exchange of Die - reduce changeover times',
      descriptionPl: 'Szybkie przezbrojenie - redukcja czasów przezbrojeń',
      icon: 'Clock',
      effort: 'medium',
      impact: 'high',
      duration: '2-4 weeks',
      deliverables: ['Changeover analysis', 'External/internal separation', 'New procedure'],
      deliverablespl: [
        'Analiza przezbrojenia',
        'Separacja zewnętrzna/wewnętrzna',
        'Nowa procedura',
      ],
    },
    {
      id: 'tpm',
      name: 'Total Productive Maintenance',
      namePl: 'TPM',
      category: 'Equipment Effectiveness',
      categoryPl: 'Efektywność urządzeń',
      description: 'Maximize equipment effectiveness through proactive maintenance',
      descriptionPl: 'Maksymalizacja efektywności urządzeń poprzez proaktywne utrzymanie',
      icon: 'Wrench',
      effort: 'high',
      impact: 'high',
      duration: '3-6 months',
      deliverables: ['OEE baseline', 'Maintenance program', 'Autonomous maintenance'],
      deliverablespl: ['Baseline OEE', 'Program utrzymania', 'Autonomiczne utrzymanie'],
    },
    {
      id: 'six_sigma',
      name: 'Six Sigma DMAIC',
      namePl: 'Six Sigma DMAIC',
      category: 'Quality Improvement',
      categoryPl: 'Poprawa jakości',
      description: 'Define, Measure, Analyze, Improve, Control - data-driven improvement',
      descriptionPl:
        'Definiuj, Mierz, Analizuj, Ulepszaj, Kontroluj - doskonalenie oparte na danych',
      icon: 'LineChart',
      effort: 'high',
      impact: 'high',
      duration: '2-4 months',
      deliverables: ['Process capability analysis', 'Root cause analysis', 'Control plan'],
      deliverablespl: ['Analiza zdolności procesu', 'Analiza przyczyn źródłowych', 'Plan kontroli'],
    },
    {
      id: 'kanban',
      name: 'Kanban System',
      namePl: 'System Kanban',
      category: 'Flow Management',
      categoryPl: 'Zarządzanie przepływem',
      description: 'Visual pull-based production control system',
      descriptionPl: 'Wizualny system sterowania produkcją typu pull',
      icon: 'Columns3',
      effort: 'medium',
      impact: 'high',
      duration: '4-8 weeks',
      deliverables: ['Kanban board design', 'WIP limits', 'Replenishment rules'],
      deliverablespl: ['Projekt tablicy Kanban', 'Limity WIP', 'Zasady uzupełniania'],
    },
    {
      id: 'standardized_work',
      name: 'Standardized Work',
      namePl: 'Praca standaryzowana',
      category: 'Process Standardization',
      categoryPl: 'Standaryzacja procesów',
      description: 'Document and establish best practices for consistent operations',
      descriptionPl: 'Dokumentacja i ustanowienie najlepszych praktyk dla spójnych operacji',
      icon: 'FileText',
      effort: 'medium',
      impact: 'medium',
      duration: '2-4 weeks',
      deliverables: ['Work instructions', 'Standard operating procedures', 'Training materials'],
      deliverablespl: [
        'Instrukcje pracy',
        'Standardowe procedury operacyjne',
        'Materiały szkoleniowe',
      ],
    },
  ],

  digital: [
    {
      id: 'process_mining',
      name: 'Process Mining',
      namePl: 'Process Mining',
      category: 'Process Analytics',
      categoryPl: 'Analityka procesów',
      description: 'Discover and analyze real processes from event logs',
      descriptionPl: 'Odkrywanie i analiza rzeczywistych procesów z logów zdarzeń',
      icon: 'Search',
      effort: 'medium',
      impact: 'high',
      duration: '2-4 weeks',
      prerequisites: ['Event log data', 'Process understanding'],
      deliverables: ['Process discovery', 'Conformance analysis', 'Bottleneck identification'],
      deliverablespl: ['Odkrycie procesu', 'Analiza zgodności', 'Identyfikacja wąskich gardeł'],
    },
    {
      id: 'rpa_assessment',
      name: 'RPA Assessment',
      namePl: 'Ocena RPA',
      category: 'Automation',
      categoryPl: 'Automatyzacja',
      description: 'Identify and prioritize processes for robotic process automation',
      descriptionPl: 'Identyfikacja i priorytetyzacja procesów do automatyzacji robotycznej',
      icon: 'Bot',
      effort: 'medium',
      impact: 'high',
      duration: '2-3 weeks',
      deliverables: ['Automation candidates', 'ROI analysis', 'Implementation roadmap'],
      deliverablespl: ['Kandydaci do automatyzacji', 'Analiza ROI', 'Mapa drogowa wdrożenia'],
    },
    {
      id: 'data_governance',
      name: 'Data Governance Framework',
      namePl: 'Framework Data Governance',
      category: 'Data Management',
      categoryPl: 'Zarządzanie danymi',
      description: 'Establish policies and procedures for data management',
      descriptionPl: 'Ustanowienie polityk i procedur zarządzania danymi',
      icon: 'Database',
      effort: 'high',
      impact: 'high',
      duration: '2-3 months',
      deliverables: ['Data policies', 'Data quality rules', 'Governance structure'],
      deliverablespl: ['Polityki danych', 'Zasady jakości danych', 'Struktura governance'],
    },
    {
      id: 'api_integration',
      name: 'API Integration Audit',
      namePl: 'Audyt integracji API',
      category: 'Integration',
      categoryPl: 'Integracja',
      description: 'Assess and plan system integrations via APIs',
      descriptionPl: 'Ocena i planowanie integracji systemów przez API',
      icon: 'Plug',
      effort: 'medium',
      impact: 'high',
      duration: '2-4 weeks',
      deliverables: ['Integration map', 'API requirements', 'Implementation plan'],
      deliverablespl: ['Mapa integracji', 'Wymagania API', 'Plan wdrożenia'],
    },
    {
      id: 'cloud_readiness',
      name: 'Cloud Readiness Assessment',
      namePl: 'Ocena gotowości do chmury',
      category: 'Infrastructure',
      categoryPl: 'Infrastruktura',
      description: 'Evaluate readiness for cloud migration',
      descriptionPl: 'Ocena gotowości do migracji do chmury',
      icon: 'Cloud',
      effort: 'medium',
      impact: 'high',
      duration: '2-4 weeks',
      deliverables: ['Application assessment', 'Migration strategy', 'Cost analysis'],
      deliverablespl: ['Ocena aplikacji', 'Strategia migracji', 'Analiza kosztów'],
    },
    {
      id: 'digital_twin',
      name: 'Digital Twin Roadmap',
      namePl: 'Roadmapa Digital Twin',
      category: 'Industry 4.0',
      categoryPl: 'Przemysł 4.0',
      description: 'Plan for creating digital replicas of physical assets/processes',
      descriptionPl: 'Plan tworzenia cyfrowych replik fizycznych zasobów/procesów',
      icon: 'Copy',
      effort: 'high',
      impact: 'high',
      duration: '1-2 months',
      deliverables: [
        'Use case prioritization',
        'Technology requirements',
        'Implementation roadmap',
      ],
      deliverablespl: [
        'Priorytetyzacja use case',
        'Wymagania technologiczne',
        'Roadmapa wdrożenia',
      ],
    },
    {
      id: 'ai_readiness',
      name: 'AI/ML Readiness Assessment',
      namePl: 'Ocena gotowości AI/ML',
      category: 'Artificial Intelligence',
      categoryPl: 'Sztuczna inteligencja',
      description: 'Evaluate organizational readiness for AI adoption',
      descriptionPl: 'Ocena gotowości organizacyjnej do wdrożenia AI',
      icon: 'Brain',
      effort: 'medium',
      impact: 'high',
      duration: '2-4 weeks',
      deliverables: ['AI use case catalog', 'Data readiness', 'Capability gaps'],
      deliverablespl: ['Katalog use case AI', 'Gotowość danych', 'Luki kompetencyjne'],
    },
    {
      id: 'cybersecurity',
      name: 'Cybersecurity Assessment',
      namePl: 'Ocena cyberbezpieczeństwa',
      category: 'Security',
      categoryPl: 'Bezpieczeństwo',
      description: 'Assess and improve security posture',
      descriptionPl: 'Ocena i poprawa stanu bezpieczeństwa',
      icon: 'Shield',
      effort: 'high',
      impact: 'high',
      duration: '3-6 weeks',
      deliverables: ['Risk assessment', 'Security gaps', 'Remediation plan'],
      deliverablespl: ['Ocena ryzyka', 'Luki bezpieczeństwa', 'Plan naprawczy'],
    },
  ],
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get all tools for a transformation type
 */
export function getToolsForType(type: TransformationType): TransformationTool[] {
  return TRANSFORMATION_TOOLS[type] || [];
}

/**
 * Get tool by ID
 */
export function getToolById(id: string): TransformationTool | undefined {
  for (const tools of Object.values(TRANSFORMATION_TOOLS)) {
    const found = tools.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get quick wins (low effort, high impact)
 */
export function getQuickWins(type: TransformationType): TransformationTool[] {
  return TRANSFORMATION_TOOLS[type].filter(
    (t) => t.effort === 'low' && (t.impact === 'high' || t.impact === 'medium')
  );
}

/**
 * Get strategic investments (high effort, high impact)
 */
export function getStrategicInvestments(type: TransformationType): TransformationTool[] {
  return TRANSFORMATION_TOOLS[type].filter((t) => t.effort === 'high' && t.impact === 'high');
}

/**
 * Get all unique categories for a type
 */
export function getCategoriesForType(type: TransformationType): string[] {
  const categories = new Set<string>();
  TRANSFORMATION_TOOLS[type].forEach((t) => categories.add(t.category));
  return Array.from(categories);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(
  type: TransformationType,
  category: string
): TransformationTool[] {
  return TRANSFORMATION_TOOLS[type].filter((t) => t.category === category);
}

/**
 * Search tools by name or description
 */
export function searchTools(query: string): TransformationTool[] {
  const lowerQuery = query.toLowerCase();
  const results: TransformationTool[] = [];

  for (const tools of Object.values(TRANSFORMATION_TOOLS)) {
    for (const tool of tools) {
      if (
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.namePl.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.descriptionPl.toLowerCase().includes(lowerQuery)
      ) {
        results.push(tool);
      }
    }
  }

  return results;
}

export default TRANSFORMATION_TOOLS;
