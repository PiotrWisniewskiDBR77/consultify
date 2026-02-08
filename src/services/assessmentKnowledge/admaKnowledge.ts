/**
 * ADMA Knowledge Base
 *
 * Source of truth for ADMA (Advanced Digital Maturity Assessment) assessment:
 * - 3 yes/no questions per dimension/level
 * - Example per dimension/level
 * - Suggested technologies per dimension/level
 *
 * Structure: 5 Pillars, 12 Dimensions, Scale 1-5
 */
import { ADMA_DIMENSIONS, ADMA_MATURITY_LEVELS, ADMA_PILLARS, ADMADimension } from '@/services/admaStructure';

export type ADMALevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
};

export type ADMADimensionLevelKey = `${string}#${number}`; // e.g. "digital_strategy#3"

// ============================================
// TECHNOLOGY SUGGESTIONS PER DIMENSION
// ============================================

const DIMENSION_TECH: Record<string, Record<number, string[]>> = {
  digital_strategy: {
    1: ['Strategy Documents', 'SWOT Analysis'],
    2: ['Digital Maturity Assessment', 'Roadmap Tools', 'Strategy Frameworks'],
    3: ['Digital Strategy Platform', 'OKR/KPI Tracking', 'Portfolio Management'],
    4: ['AI-powered Strategy Simulation', 'Scenario Planning', 'Strategic Analytics'],
    5: ['Adaptive Strategy Engine', 'Real-time Market Intelligence', 'Digital Business Model Innovation'],
  },
  digital_investments: {
    1: ['Budget Spreadsheets', 'Basic Financial Reporting'],
    2: ['Investment Tracking', 'ROI Templates', 'Business Case Framework'],
    3: ['Portfolio Management', 'Financial Planning & Analysis', 'TCO Models'],
    4: ['AI ROI Prediction', 'Value Stream Analytics', 'Dynamic Resource Allocation'],
    5: ['Autonomous Investment Optimization', 'Continuous Value Assessment', 'Real-time Portfolio Balancing'],
  },
  digital_culture: {
    1: ['Internal Communication', 'Basic Intranet'],
    2: ['Digital Skills Assessment', 'E-learning Platform', 'Change Communication'],
    3: ['Digital Academy', 'Innovation Programs', 'Digital Champions Network'],
    4: ['AI-personalized Learning', 'Culture Analytics', 'Innovation Lab'],
    5: ['Self-directed Learning Culture', 'Digital Innovation Ecosystem', 'Knowledge Marketplace'],
  },
  product_features: {
    1: ['Basic Product Spec Sheets', 'Manual Documentation'],
    2: ['CAD/CAM', 'Basic IoT Sensors', 'Connected Product Concepts'],
    3: ['IoT Platform', 'Product Data Management', 'Digital Service Layer'],
    4: ['AI-powered Product Intelligence', 'Predictive Product Features', 'Edge Computing'],
    5: ['Autonomous Smart Products', 'Self-evolving Product Features', 'Digital Twin (Product)'],
  },
  product_data: {
    1: ['Manual Data Collection', 'Spreadsheets'],
    2: ['Basic Data Logging', 'Product Usage Reports', 'CSV/Excel Analytics'],
    3: ['Product Analytics Platform', 'Usage Dashboards', 'Customer Feedback Integration'],
    4: ['AI Product Analytics', 'Predictive Usage Models', 'Real-time Telemetry'],
    5: ['Autonomous Product Optimization', 'Self-learning Analytics', 'Data Monetization Platform'],
  },
  production_tech: {
    1: ['Manual Operations', 'Basic Machinery'],
    2: ['CNC Machines', 'Basic Automation', 'PLC Controllers'],
    3: ['Flexible Manufacturing', 'Cobots', 'Automated Quality Control'],
    4: ['AI-guided Manufacturing', 'Predictive Maintenance', 'Digital Twin (Process)'],
    5: ['Autonomous Production', 'Self-optimizing Lines', 'Lights-out Manufacturing'],
  },
  production_it: {
    1: ['Paper-based Tracking', 'Standalone Systems'],
    2: ['Basic MES', 'SCADA', 'Shop Floor Terminals'],
    3: ['Integrated MES/ERP', 'OEE Monitoring', 'IT/OT Bridge'],
    4: ['AI Production Scheduling', 'Real-time Digital Thread', 'Edge Analytics'],
    5: ['Cognitive MES', 'Autonomous IT/OT', 'Self-healing Systems'],
  },
  supply_integration: {
    1: ['Phone/Email Orders', 'Manual Supplier Management'],
    2: ['Basic EDI', 'Supplier Portal', 'Order Tracking'],
    3: ['B2B Integration Platform', 'Collaborative Planning', 'Track & Trace'],
    4: ['AI Demand Sensing', 'Autonomous Procurement', 'Predictive Logistics'],
    5: ['Self-orchestrating Supply Network', 'Blockchain Integration', 'Cognitive Supply Chain'],
  },
  supply_visibility: {
    1: ['No Visibility', 'Manual Tracking'],
    2: ['Basic Dashboards', 'Order Status Reports', 'Inventory Counts'],
    3: ['Real-time Visibility Platform', 'Control Tower', 'Multi-tier Mapping'],
    4: ['Predictive Visibility', 'Risk Analytics', 'Dynamic Re-routing'],
    5: ['Full Network Transparency', 'Autonomous Exception Handling', 'Ecosystem Visibility'],
  },
  data_collection: {
    1: ['Manual Records', 'Paper Forms'],
    2: ['Basic Sensors', 'Spreadsheet Logging', 'SCADA Data'],
    3: ['IoT Platform', 'Data Lake', 'Automated Collection'],
    4: ['Edge Computing', 'Real-time Streaming', 'Data Quality AI'],
    5: ['Pervasive Sensing', 'Self-classifying Data', 'Universal Data Fabric'],
  },
  data_analytics: {
    1: ['Manual Calculations', 'Basic Excel'],
    2: ['BI Dashboards', 'Reports', 'Descriptive Analytics'],
    3: ['Predictive Analytics', 'ML Models', 'Data Science Team'],
    4: ['AI/ML at Scale', 'Prescriptive Analytics', 'AutoML'],
    5: ['Autonomous Insights', 'Cognitive Analytics', 'Embedded AI Everywhere'],
  },
  data_services: {
    1: ['No Data Services', 'Basic Reporting'],
    2: ['Data-enriched Products', 'Basic API Services', 'Customer Reports'],
    3: ['Data-as-a-Service', 'Analytics Platform', 'Industry Benchmarks'],
    4: ['AI-powered Data Products', 'Monetization Platform', 'Ecosystem Data Exchange'],
    5: ['Autonomous Data Marketplace', 'AI-generated Insights-as-a-Service', 'Data Economy Leadership'],
  },
};

// ============================================
// OVERRIDES (empty by default, fill as needed)
// ============================================

const ADMA_KNOWLEDGE_OVERRIDES: Partial<
  Record<ADMADimensionLevelKey, Partial<ADMALevelKnowledge>>
> = {};

// ============================================
// HELPER FUNCTIONS
// ============================================

function defaultQuestions(dimension: ADMADimension, level: number): [string, string, string] {
  const dimName = dimension.name;
  const levelTitle = ADMA_MATURITY_LEVELS.find((l) => l.level === level)?.title || `Level ${level}`;
  return [
    `In "${dimName}", is level ${level} ("${levelTitle}") achieved as described?`,
    `Can we show evidence for level ${level} (e.g. system, process, documentation, metrics)?`,
    `Is this consistently applied across the organization (not just a pilot or isolated initiative)?`,
  ];
}

function defaultExample(dimension: ADMADimension, level: number): string {
  const dimName = dimension.name;
  const levelTitle = ADMA_MATURITY_LEVELS.find((l) => l.level === level)?.title || `Level ${level}`;
  return `Example: in "${dimName}" at level ${level} ("${levelTitle}"), we provide a concrete artifact confirming maturity (e.g. system demo, analytics report, process map, documented evidence).`;
}

function getTechnologies(dimensionId: string, level: number): string[] {
  const dimTech = DIMENSION_TECH[dimensionId];
  if (dimTech && dimTech[level]) return dimTech[level];
  return ['Process Documentation', 'KPI Dashboard', 'Standard Operating Procedures (SOP)'];
}

// ============================================
// PUBLIC API
// ============================================

export function getADMAKnowledge(dimensionId: string, levelNumber: number): ADMALevelKnowledge {
  const dimension = ADMA_DIMENSIONS.find((d) => d.id === dimensionId);

  const fallback: ADMALevelKnowledge = {
    questions: [
      'Is this level achieved?',
      'Do we have evidence that this level is met?',
      'Is it consistently applied?',
    ],
    example: 'Example: provide evidence (system/metrics/documentation).',
    suggestedTechnologies: ['KPI Dashboard', 'Process Documentation'],
  };

  if (!dimension) return fallback;

  const base: ADMALevelKnowledge = {
    questions: defaultQuestions(dimension, levelNumber),
    example: defaultExample(dimension, levelNumber),
    suggestedTechnologies: getTechnologies(dimensionId, levelNumber),
  };

  const key: ADMADimensionLevelKey = `${dimensionId}#${levelNumber}`;
  const override = ADMA_KNOWLEDGE_OVERRIDES[key];
  if (!override) return base;

  return {
    questions: (override.questions as any) || base.questions,
    example: override.example || base.example,
    suggestedTechnologies: override.suggestedTechnologies || base.suggestedTechnologies,
  };
}

/**
 * Get pillar context (useful for overview panels)
 */
export function getADMAPillarInfo(pillarId: string) {
  const pillar = ADMA_PILLARS[pillarId as keyof typeof ADMA_PILLARS];
  if (!pillar) return null;
  return {
    name: pillar.name,
    description: pillar.description,
    dimensions: ADMA_DIMENSIONS.filter((d) => d.pillar === pillarId),
  };
}
