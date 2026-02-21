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
  evidenceGuidance: string;
  commonMistakes: string[];
  levelMeaning: string;
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
    5: [
      'AI-driven Product Innovation',
      'Autonomous Design Optimization',
      'Smart Connected Products',
    ],
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
// LEVEL MEANINGS
// ============================================

export const SIRI_LEVEL_MEANINGS: Record<
  number,
  { title: string; meaning: string; evidencePattern: string }
> = {
  0: {
    title: 'Not Started',
    meaning:
      'No formal approach exists. Processes are ad-hoc, undocumented, or non-existent. There is no awareness of Industry 4.0 in this dimension.',
    evidencePattern: 'Absence of documentation, no KPIs, manual/paper-based workflows only.',
  },
  1: {
    title: 'Defined',
    meaning:
      'Basic processes are documented and understood. Initial standardization exists but execution is inconsistent. Isolated digital tools may be in use.',
    evidencePattern:
      'SOPs or process maps exist; basic tools (spreadsheets, standalone software) are used; training materials available.',
  },
  2: {
    title: 'Digital',
    meaning:
      'Core processes are digitized with basic monitoring. Automation handles routine tasks. Data is collected but analysis is limited to descriptive reporting.',
    evidencePattern:
      'Digital systems in daily use (MES, ERP, CRM); dashboards showing KPIs; automated workflows for repetitive tasks.',
  },
  3: {
    title: 'Integrated',
    meaning:
      'Systems are integrated across functions. Real-time data flows between departments. Decision-making uses data analytics. Cross-functional collaboration is standard.',
    evidencePattern:
      'Integrated platforms (ERP-MES-CRM); real-time dashboards; documented data flows between systems; cross-team digital processes.',
  },
  4: {
    title: 'Automated',
    meaning:
      'Advanced automation with predictive analytics. AI assists decisions. Processes self-adjust based on data. Proactive rather than reactive operations.',
    evidencePattern:
      'AI/ML models in production; predictive maintenance active; automated decision support; measurable ROI from digital initiatives.',
  },
  5: {
    title: 'Intelligent',
    meaning:
      'Self-optimizing systems operate autonomously. Continuous innovation is embedded. The organization leads industry transformation and creates new digital value.',
    evidencePattern:
      'Autonomous operations; self-learning systems; innovation pipeline documented; industry benchmarks exceeded; digital revenue streams.',
  },
};

// ============================================
// EVIDENCE GUIDANCE PER DIMENSION
// ============================================

const DIMENSION_EVIDENCE_GUIDANCE: Record<string, Record<number, string>> = {
  operations: {
    0: 'Look for absence of production tracking systems. Are work orders paper-based?',
    1: 'Check for documented SOPs and basic production planning tools (even spreadsheets count).',
    2: 'Verify MES or equivalent is actively used. Are OEE metrics tracked digitally?',
    3: 'Confirm ERP-MES integration exists. Can production data flow to business planning in real-time?',
    4: 'Look for AI-driven scheduling or predictive quality systems. Are decisions automated?',
    5: 'Verify autonomous production control. Do systems self-optimize without human intervention?',
  },
  supply_chain: {
    0: 'Confirm procurement and logistics are manual (phone, email, paper POs).',
    1: 'Check for basic ERP modules for purchasing. Is there a supplier database?',
    2: 'Verify EDI or e-procurement is active. Is warehouse management digitized?',
    3: 'Look for end-to-end supply chain visibility platform. Can you track orders across tiers?',
    4: 'Check for AI-powered demand forecasting or autonomous procurement triggers.',
    5: 'Verify self-orchestrating supply chain with blockchain traceability and autonomous routing.',
  },
  product_lifecycle: {
    0: 'Are product designs stored locally or on paper? No version control?',
    1: 'Check for basic CAD usage and document management systems.',
    2: 'Verify PLM/PDM system is in use with CAD integration and BOM management.',
    3: 'Look for integrated PLM with simulation capabilities and digital mock-ups.',
    4: 'Check for digital twin of products and model-based systems engineering.',
    5: 'Verify AI-driven product innovation with autonomous design optimization.',
  },
  automation: {
    0: 'Confirm operations are fully manual with hand tools only.',
    1: 'Check for basic CNC or PLC machines. Any semi-automated processes?',
    2: 'Look for industrial robots, SCADA systems, and automated material handling.',
    3: 'Verify flexible manufacturing cells, cobots, and AGV/AMR deployments.',
    4: 'Check for AI-guided robotics and predictive maintenance systems.',
    5: 'Look for fully autonomous production lines (lights-out manufacturing capability).',
  },
  connectivity: {
    0: 'Confirm systems are isolated with no network connectivity between machines.',
    1: 'Check for basic LAN/WiFi and shared drives. Any machine connectivity?',
    2: 'Verify IIoT sensors are deployed. Is edge computing in use?',
    3: 'Look for IT/OT convergence. Is there a cloud platform with API-first architecture?',
    4: 'Check for 5G/private networks and digital thread implementation.',
    5: 'Verify mesh networks with autonomous edge intelligence across all systems.',
  },
  intelligence: {
    0: 'Confirm there is no analytics capability. All reporting is manual.',
    1: 'Check for basic reporting (spreadsheets, static dashboards).',
    2: 'Verify BI platform or data warehouse with descriptive analytics.',
    3: 'Look for predictive analytics and ML models in active use.',
    4: 'Check for AI/ML at scale with prescriptive analytics and real-time decision support.',
    5: 'Verify autonomous AI decision-making with self-learning systems.',
  },
  talent_readiness: {
    0: 'Confirm no digital training program exists. Learning is ad-hoc.',
    1: 'Check for basic training plans and skills inventory.',
    2: 'Verify LMS is in use. Are digital skills formally assessed?',
    3: 'Look for a competency framework and digital academy program.',
    4: 'Check for AI-personalized learning paths and VR/AR training tools.',
    5: 'Verify self-directed learning culture with knowledge marketplace.',
  },
  structure_management: {
    0: 'Confirm traditional hierarchy with no digital governance.',
    1: 'Check for basic digital strategy document and initial governance framework.',
    2: 'Verify Digital Transformation Office exists with KPI dashboards.',
    3: 'Look for agile organization structure with data governance and innovation management.',
    4: 'Check for platform organization model and AI governance framework.',
    5: 'Verify adaptive organization with self-organizing teams.',
  },
};

// ============================================
// COMMON MISTAKES PER DIMENSION
// ============================================

const DIMENSION_COMMON_MISTAKES: Record<string, string[]> = {
  operations: [
    'Rating based on tool ownership rather than actual daily usage and process integration.',
    'Confusing having an MES license with having a functioning, data-producing MES deployment.',
    'Ignoring sub-processes: operations includes planning, execution, quality, and maintenance.',
  ],
  supply_chain: [
    'Rating the internal logistics only without considering supplier and customer integration.',
    'Confusing order tracking within ERP with true end-to-end supply chain visibility.',
    'Overlooking procurement digitization — SCM is not just warehouse management.',
  ],
  product_lifecycle: [
    'Equating CAD usage with PLM maturity. PLM covers the entire product lifecycle.',
    'Missing version control and collaboration aspects — file sharing is not PLM.',
    'Overlooking the connection between design, manufacturing, and service data.',
  ],
  automation: [
    'Rating CNC machines as advanced automation when they still require full manual setup.',
    'Confusing isolated robot cells with flexible, integrated manufacturing systems.',
    'Ignoring the human-machine interface — cobots and AMRs need proper integration assessment.',
  ],
  connectivity: [
    'Assuming internet access equals connectivity maturity. Focus on machine-to-machine data flow.',
    'Overlooking OT network security when assessing IT/OT convergence.',
    'Rating cloud adoption without assessing actual real-time data streaming capabilities.',
  ],
  intelligence: [
    'Confusing dashboards with analytics. Descriptive reporting is not predictive analytics.',
    'Rating AI pilots as production-grade. Check if models are in daily decision workflows.',
    'Overlooking data quality — analytics maturity depends on clean, governed data pipelines.',
  ],
  talent_readiness: [
    'Equating having an LMS with a learning culture. Check actual participation and impact.',
    'Rating management awareness as organization-wide readiness. Assess shop-floor skills too.',
    'Overlooking change management. Skills training without cultural adoption has limited impact.',
  ],
  structure_management: [
    'Confusing digital strategy document with strategy execution and governance.',
    'Rating a committee as a transformation office. Check actual mandate and budget.',
    'Overlooking middle management alignment — strategy-execution gap is common here.',
  ],
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

function getEvidenceGuidance(dimensionId: string, level: number): string {
  return (
    DIMENSION_EVIDENCE_GUIDANCE[dimensionId]?.[level] ||
    'Look for documented processes, systems in active use, and measurable outcomes at this level.'
  );
}

function getCommonMistakes(dimensionId: string): string[] {
  return (
    DIMENSION_COMMON_MISTAKES[dimensionId] || [
      'Ensure scores reflect actual practice, not aspirations.',
      'Verify with evidence, not just management perception.',
      'Check consistency across the organization.',
    ]
  );
}

function getLevelMeaning(level: number): string {
  return SIRI_LEVEL_MEANINGS[level]?.meaning || `Level ${level} maturity.`;
}

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
    evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber),
    commonMistakes: getCommonMistakes(dimensionId),
    levelMeaning: getLevelMeaning(levelNumber),
  };

  if (!dimension) return fallback;

  const base: SIRILevelKnowledge = {
    questions: defaultQuestions(dimension, levelNumber),
    example: defaultExample(dimension, levelNumber),
    suggestedTechnologies: getTechnologies(dimensionId, levelNumber),
    evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber),
    commonMistakes: getCommonMistakes(dimensionId),
    levelMeaning: getLevelMeaning(levelNumber),
  };

  const key: SIRIDimensionLevelKey = `${dimensionId}#${levelNumber}`;
  const override = SIRI_KNOWLEDGE_OVERRIDES[key];
  if (!override) return base;

  return {
    questions: (override.questions as any) || base.questions,
    example: override.example || base.example,
    suggestedTechnologies: override.suggestedTechnologies || base.suggestedTechnologies,
    evidenceGuidance: override.evidenceGuidance || base.evidenceGuidance,
    commonMistakes: override.commonMistakes || base.commonMistakes,
    levelMeaning: base.levelMeaning,
  };
}

export function getSIRILevelMeaning(
  level: number
): { title: string; meaning: string; evidencePattern: string } | null {
  return SIRI_LEVEL_MEANINGS[level] || null;
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
