/**
 * SIRI Knowledge Base
 *
 * Source of truth for SIRI (Smart Industry Readiness Index) assessment:
 * - 3 yes/no questions per dimension/level
 * - Example per dimension/level
 * - Suggested technologies per dimension/level
 *
 * Structure: 3 Building Blocks, 8 Dimensions, Scale 0-5
 */
import {
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  SIRIDimension,
} from '@/services/siriStructure';

export type SIRILevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
};

export type SIRIDimensionLevelKey = `${string}#${number}`; // e.g. "operations#3"

// ============================================
// TECHNOLOGY SUGGESTIONS PER DIMENSION
// ============================================

const DIMENSION_TECH: Record<string, Record<number, string[]>> = {
  operations: {
    0: ['Process Documentation', 'Standard Operating Procedures (SOP)'],
    1: ['Basic MES', 'Production Planning Spreadsheets', 'Work Instructions'],
    2: ['MES', 'OEE Dashboard', 'Quality Management System (QMS)'],
    3: ['MES with ERP Integration', 'Real-time Production Monitoring', 'Digital Andon'],
    4: ['AI-driven Production Scheduling', 'Predictive Quality Analytics', 'Digital Twin'],
    5: ['Autonomous Production Control', 'Self-optimizing MES', 'Cognitive Manufacturing'],
  },
  supply_chain: {
    0: ['Manual Procurement', 'Spreadsheet Tracking'],
    1: ['Basic ERP', 'Order Management System', 'Supplier Database'],
    2: ['EDI Integration', 'Warehouse Management System (WMS)', 'Demand Planning'],
    3: ['End-to-end SCM Platform', 'Track & Trace', 'Supplier Portal'],
    4: ['AI Demand Forecasting', 'Control Tower', 'Autonomous Procurement'],
    5: ['Self-orchestrating Supply Chain', 'Blockchain Traceability', 'Cognitive Logistics'],
  },
  product_lifecycle: {
    0: ['Paper-based Documentation', 'Local File Storage'],
    1: ['Basic CAD', 'Document Management', 'Version Control'],
    2: ['PLM/PDM', 'CAD/CAM Integration', 'BOM Management'],
    3: ['Integrated PLM', 'Digital Mock-up', 'Simulation & Testing'],
    4: ['Digital Twin (Product)', 'Model-Based Systems Engineering', 'Generative Design'],
    5: ['AI-driven Product Innovation', 'Autonomous Design Optimization', 'Smart Connected Products'],
  },
  automation: {
    0: ['Manual Operations', 'Hand Tools'],
    1: ['Basic CNC/PLC', 'Semi-automated Machines', 'Conveyor Systems'],
    2: ['Industrial Robots', 'SCADA', 'Automated Material Handling'],
    3: ['Flexible Manufacturing Cells', 'Cobots', 'AGV/AMR'],
    4: ['AI-guided Robots', 'Adaptive Manufacturing', 'Predictive Maintenance'],
    5: ['Fully Autonomous Production', 'Self-configuring Cells', 'Lights-out Manufacturing'],
  },
  connectivity: {
    0: ['Isolated Systems', 'Air-gapped Networks'],
    1: ['Basic LAN/WiFi', 'Email Communication', 'Shared Drives'],
    2: ['IIoT Sensors', 'Edge Computing', 'Machine Connectivity'],
    3: ['IT/OT Convergence', 'Cloud Platform', 'API-first Architecture'],
    4: ['5G/Private Networks', 'Digital Thread', 'Real-time Streaming'],
    5: ['Mesh Networks', 'Autonomous Edge Intelligence', 'Universal Connectivity'],
  },
  intelligence: {
    0: ['No Analytics', 'Manual Reporting'],
    1: ['Basic Reports', 'Spreadsheet Analytics', 'Static Dashboards'],
    2: ['BI Platform', 'Data Warehouse', 'Descriptive Analytics'],
    3: ['Predictive Analytics', 'Machine Learning Models', 'Data Lake'],
    4: ['AI/ML at Scale', 'Prescriptive Analytics', 'Real-time Decision Support'],
    5: ['Autonomous AI Decision-making', 'Self-learning Systems', 'Cognitive Analytics'],
  },
  talent_readiness: {
    0: ['No Training Program', 'Ad-hoc Learning'],
    1: ['Basic Training Plan', 'Onboarding Program', 'Skills Inventory'],
    2: ['LMS (Learning Management System)', 'Digital Skills Assessment', 'E-learning'],
    3: ['Competency Framework', 'Digital Academy', 'Cross-functional Development'],
    4: ['AI-personalized Learning', 'VR/AR Training', 'Skills Analytics'],
    5: ['Self-directed Learning Culture', 'Knowledge Marketplace', 'Innovation Labs'],
  },
  structure_management: {
    0: ['Traditional Hierarchy', 'Manual Governance'],
    1: ['Basic Digital Strategy', 'Initial Governance Framework', 'Steering Committee'],
    2: ['Digital Transformation Office', 'KPI Dashboard', 'Change Management'],
    3: ['Agile Organization', 'Data Governance', 'Innovation Management'],
    4: ['Platform Organization', 'AI Governance', 'Ecosystem Management'],
    5: ['Adaptive Organization', 'Self-organizing Teams', 'Autonomous Decision-making'],
  },
};

// ============================================
// OVERRIDES (empty by default, fill as needed)
// ============================================

const SIRI_KNOWLEDGE_OVERRIDES: Partial<
  Record<SIRIDimensionLevelKey, Partial<SIRILevelKnowledge>>
> = {};

// ============================================
// HELPER FUNCTIONS
// ============================================

function defaultQuestions(dimension: SIRIDimension, level: number): [string, string, string] {
  const dimName = dimension.name;
  const levelTitle = SIRI_MATURITY_LEVELS[level]?.title || `Level ${level}`;
  return [
    `In "${dimName}", is level ${level} ("${levelTitle}") achieved as described?`,
    `Can we show evidence for level ${level} (e.g. system, metrics, process, documentation)?`,
    `Is this consistently applied across the organization (not just a pilot or isolated case)?`,
  ];
}

function defaultExample(dimension: SIRIDimension, level: number): string {
  const dimName = dimension.name;
  const levelTitle = SIRI_MATURITY_LEVELS[level]?.title || `Level ${level}`;
  return `Example: in "${dimName}" at level ${level} ("${levelTitle}"), we provide a concrete artifact confirming maturity (e.g. system screenshot, analytics report, process documentation, KPI evidence).`;
}

function getTechnologies(dimensionId: string, level: number): string[] {
  const dimTech = DIMENSION_TECH[dimensionId];
  if (dimTech && dimTech[level]) return dimTech[level];
  // Fallback
  return ['Process Documentation', 'KPI Dashboard', 'Standard Operating Procedures (SOP)'];
}

// ============================================
// PUBLIC API
// ============================================

export function getSIRIKnowledge(dimensionId: string, levelNumber: number): SIRILevelKnowledge {
  const dimension = SIRI_DIMENSIONS.find((d) => d.id === dimensionId);

  const fallback: SIRILevelKnowledge = {
    questions: [
      'Is this level achieved?',
      'Do we have evidence that this level is met?',
      'Is it consistently applied?',
    ],
    example: 'Example: provide evidence (system/metrics/documentation).',
    suggestedTechnologies: ['KPI Dashboard', 'Process Documentation'],
  };

  if (!dimension) return fallback;

  const base: SIRILevelKnowledge = {
    questions: defaultQuestions(dimension, levelNumber),
    example: defaultExample(dimension, levelNumber),
    suggestedTechnologies: getTechnologies(dimensionId, levelNumber),
  };

  const key: SIRIDimensionLevelKey = `${dimensionId}#${levelNumber}`;
  const override = SIRI_KNOWLEDGE_OVERRIDES[key];
  if (!override) return base;

  return {
    questions: (override.questions as any) || base.questions,
    example: override.example || base.example,
    suggestedTechnologies: override.suggestedTechnologies || base.suggestedTechnologies,
  };
}

/**
 * Get building block context (useful for overview panels)
 */
export function getSIRIBuildingBlockInfo(blockId: string) {
  const block = SIRI_BUILDING_BLOCKS[blockId as keyof typeof SIRI_BUILDING_BLOCKS];
  if (!block) return null;
  return {
    name: block.name,
    description: block.description,
    dimensions: SIRI_DIMENSIONS.filter((d) => d.buildingBlock === blockId),
  };
}
