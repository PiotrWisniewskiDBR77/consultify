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
import {
  ADMA_DIMENSIONS,
  ADMA_MATURITY_LEVELS,
  ADMA_PILLARS,
  ADMADimension,
} from '@/services/admaStructure';

export type ADMALevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
  evidenceGuidance: string;
  commonMistakes: string[];
  levelMeaning: string;
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
    5: [
      'Adaptive Strategy Engine',
      'Real-time Market Intelligence',
      'Digital Business Model Innovation',
    ],
  },
  digital_investments: {
    1: ['Budget Spreadsheets', 'Basic Financial Reporting'],
    2: ['Investment Tracking', 'ROI Templates', 'Business Case Framework'],
    3: ['Portfolio Management', 'Financial Planning & Analysis', 'TCO Models'],
    4: ['AI ROI Prediction', 'Value Stream Analytics', 'Dynamic Resource Allocation'],
    5: [
      'Autonomous Investment Optimization',
      'Continuous Value Assessment',
      'Real-time Portfolio Balancing',
    ],
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
    5: [
      'Autonomous Data Marketplace',
      'AI-generated Insights-as-a-Service',
      'Data Economy Leadership',
    ],
  },
};

// ============================================
// LEVEL MEANINGS
// ============================================

export const ADMA_LEVEL_MEANINGS: Record<
  number,
  { title: string; meaning: string; evidencePattern: string }
> = {
  1: {
    title: 'Newcomer',
    meaning:
      'No or very limited digital capabilities. Traditional, manual methods dominate all operations. No digital strategy or roadmap exists.',
    evidencePattern:
      'Paper-based processes, no digital tools beyond basic office software, no data collection.',
  },
  2: {
    title: 'Beginner',
    meaning:
      'Initial digital initiatives exist. Some awareness of digital transformation with isolated pilot projects. Basic digital tools are deployed in some areas.',
    evidencePattern:
      'Some digital tools in use (CRM, basic ERP modules), pilot projects documented, initial training programs.',
  },
  3: {
    title: 'Intermediate',
    meaning:
      'Digital technologies are integrated in key business areas. Data-driven decision-making is emerging. Cross-functional digital processes are established.',
    evidencePattern:
      'Integrated platforms in daily use, data analytics dashboards, defined digital strategy, cross-department data flows.',
  },
  4: {
    title: 'Experienced',
    meaning:
      'Advanced digital integration with predictive capabilities. Automation and AI augment operations. The organization proactively uses digital tools for competitive advantage.',
    evidencePattern:
      'Predictive analytics in production, AI-assisted decisions, automated workflows, measurable digital ROI.',
  },
  5: {
    title: 'Expert',
    meaning:
      'Full digital transformation achieved. Self-optimizing, innovative organization that leads industry transformation and creates new digital business models.',
    evidencePattern:
      'Autonomous operations, digital revenue streams, innovation pipeline, industry benchmarking leadership.',
  },
};

// ============================================
// EVIDENCE GUIDANCE PER DIMENSION
// ============================================

const DIMENSION_EVIDENCE_GUIDANCE: Record<string, Record<number, string>> = {
  digital_strategy: {
    1: 'Confirm no formal digital strategy exists. Is digital transformation discussed at board level?',
    2: 'Check for initial roadmap documents. Are there any digital pilot projects approved?',
    3: 'Verify a formal digital strategy with KPIs, timeline, and budget allocation.',
    4: 'Look for dynamic strategy that adapts based on data. Is there scenario planning?',
    5: 'Check for adaptive strategy engine with real-time market intelligence feeds.',
  },
  digital_investments: {
    1: 'Confirm no dedicated digital budget exists. IT spending is ad-hoc.',
    2: 'Check for initial digital investment tracking and basic ROI calculations.',
    3: 'Verify portfolio management of digital investments with formal TCO models.',
    4: 'Look for AI-driven ROI prediction and value stream analytics.',
    5: 'Check for autonomous investment optimization with continuous value assessment.',
  },
  digital_culture: {
    1: 'Confirm no digital skills development program. Limited digital awareness.',
    2: 'Check for basic digital skills assessments and initial e-learning offerings.',
    3: 'Verify a digital academy or structured program with innovation initiatives.',
    4: 'Look for AI-personalized learning and active innovation labs.',
    5: 'Check for self-directed learning culture with a knowledge marketplace.',
  },
  product_features: {
    1: 'Confirm products have no digital capabilities or connectivity.',
    2: 'Check for initial IoT sensors or connected product concepts.',
    3: 'Verify IoT platform integration with product data management.',
    4: 'Look for AI-powered product intelligence and predictive features.',
    5: 'Check for autonomous smart products with self-evolving features.',
  },
  product_data: {
    1: 'Confirm product usage data is not collected systematically.',
    2: 'Check for basic data logging and product usage reports.',
    3: 'Verify a product analytics platform with usage dashboards.',
    4: 'Look for AI-driven product analytics with predictive usage models.',
    5: 'Check for autonomous product optimization using real-time data.',
  },
  production_tech: {
    1: 'Confirm manual operations with basic machinery only.',
    2: 'Check for CNC machines and basic automation (PLC controllers).',
    3: 'Verify flexible manufacturing cells with cobots and automated QC.',
    4: 'Look for AI-guided manufacturing with predictive maintenance.',
    5: 'Check for autonomous production with self-optimizing lines.',
  },
  production_it: {
    1: 'Confirm paper-based tracking and standalone systems.',
    2: 'Check for basic MES or SCADA with shop floor terminals.',
    3: 'Verify integrated MES/ERP with OEE monitoring and IT/OT bridge.',
    4: 'Look for AI production scheduling with real-time digital thread.',
    5: 'Check for cognitive MES with autonomous IT/OT operations.',
  },
  supply_integration: {
    1: 'Confirm phone/email-based ordering with manual supplier management.',
    2: 'Check for basic EDI, supplier portals, and order tracking.',
    3: 'Verify B2B integration platform with collaborative planning.',
    4: 'Look for AI demand sensing and autonomous procurement.',
    5: 'Check for self-orchestrating supply network with blockchain.',
  },
  supply_visibility: {
    1: 'Confirm no supply chain visibility beyond internal operations.',
    2: 'Check for basic dashboards with order status and inventory counts.',
    3: 'Verify real-time visibility platform with control tower capabilities.',
    4: 'Look for predictive visibility with risk analytics and dynamic re-routing.',
    5: 'Check for full network transparency with autonomous exception handling.',
  },
  data_collection: {
    1: 'Confirm manual records and paper forms dominate data collection.',
    2: 'Check for basic sensors and spreadsheet-based data logging.',
    3: 'Verify IoT platform with data lake and automated collection.',
    4: 'Look for edge computing with real-time streaming and data quality AI.',
    5: 'Check for pervasive sensing with self-classifying, universal data fabric.',
  },
  data_analytics: {
    1: 'Confirm manual calculations and basic spreadsheet usage only.',
    2: 'Check for BI dashboards with descriptive analytics reports.',
    3: 'Verify predictive analytics and ML models with a data science team.',
    4: 'Look for AI/ML at scale with prescriptive analytics and AutoML.',
    5: 'Check for autonomous insights with cognitive analytics embedded everywhere.',
  },
  data_services: {
    1: 'Confirm no data-driven services or data monetization.',
    2: 'Check for data-enriched products and basic API services.',
    3: 'Verify Data-as-a-Service offerings with an analytics platform.',
    4: 'Look for AI-powered data products and monetization platform.',
    5: 'Check for autonomous data marketplace and AI-generated insights.',
  },
};

// ============================================
// COMMON MISTAKES PER DIMENSION
// ============================================

const DIMENSION_COMMON_MISTAKES: Record<string, string[]> = {
  digital_strategy: [
    'Confusing IT modernization plans with a proper digital transformation strategy.',
    'Rating strategy by document quality rather than actual execution and governance.',
    'Overlooking alignment between digital strategy and business strategy.',
  ],
  digital_investments: [
    'Counting total IT spend as digital investment without distinguishing transformation spend.',
    'Not validating ROI claims with actual measured outcomes.',
    'Missing opportunity cost analysis — what are competitors investing?',
  ],
  digital_culture: [
    'Equating LMS enrollment with actual digital capability development.',
    'Rating management awareness without checking shop-floor digital fluency.',
    'Overlooking resistance to change — culture is about behavior, not awareness.',
  ],
  product_features: [
    'Rating connectivity hardware without assessing actual data utilization.',
    'Confusing concept/prototype IoT with production-deployed smart products.',
    'Overlooking the service layer — smart products need backend data processing.',
  ],
  product_data: [
    'Counting raw sensor data as product analytics maturity.',
    'Not verifying that product usage data actually reaches decision-makers.',
    'Confusing customer feedback surveys with systematic product telemetry.',
  ],
  production_tech: [
    'Rating CNC as automation when it still requires full manual setup and supervision.',
    'Confusing a single robot cell with enterprise-wide flexible manufacturing.',
    'Ignoring maintenance automation — production tech maturity includes uptime management.',
  ],
  production_it: [
    'Equating having MES software with having a functioning MES deployment.',
    'Not checking real-time data quality in MES/ERP integration.',
    'Rating IT infrastructure without assessing OT network capabilities.',
  ],
  supply_integration: [
    'Counting email-based supplier communication as digital integration.',
    'Not verifying bi-directional data flow with key suppliers.',
    'Overlooking last-mile logistics when assessing supply chain digitization.',
  ],
  supply_visibility: [
    'Equating internal warehouse visibility with supply chain visibility.',
    'Not testing real-time capabilities — check actual refresh rates of dashboards.',
    'Overlooking multi-tier visibility beyond direct (Tier 1) suppliers.',
  ],
  data_collection: [
    'Counting manual data entry into spreadsheets as automated data collection.',
    'Not verifying sensor data quality and calibration processes.',
    'Overlooking unstructured data sources (images, documents, voice).',
  ],
  data_analytics: [
    'Confusing BI dashboards with predictive or prescriptive analytics.',
    'Counting AI pilots as production-grade analytics maturity.',
    'Not verifying that analytics outputs actually drive business decisions.',
  ],
  data_services: [
    'Counting internal reports as data services. Check for external value creation.',
    'Rating data API availability without measuring actual consumption and monetization.',
    'Overlooking data governance requirements for external data sharing.',
  ],
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

function getAdmaLevelMeaning(level: number): string {
  return ADMA_LEVEL_MEANINGS[level]?.meaning || `Level ${level} maturity.`;
}

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
    evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber),
    commonMistakes: getCommonMistakes(dimensionId),
    levelMeaning: getAdmaLevelMeaning(levelNumber),
  };

  if (!dimension) return fallback;

  const base: ADMALevelKnowledge = {
    questions: defaultQuestions(dimension, levelNumber),
    example: defaultExample(dimension, levelNumber),
    suggestedTechnologies: getTechnologies(dimensionId, levelNumber),
    evidenceGuidance: getEvidenceGuidance(dimensionId, levelNumber),
    commonMistakes: getCommonMistakes(dimensionId),
    levelMeaning: getAdmaLevelMeaning(levelNumber),
  };

  const key: ADMADimensionLevelKey = `${dimensionId}#${levelNumber}`;
  const override = ADMA_KNOWLEDGE_OVERRIDES[key];
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

export function getADMALevelMeaning(
  level: number
): { title: string; meaning: string; evidencePattern: string } | null {
  return ADMA_LEVEL_MEANINGS[level] || null;
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
