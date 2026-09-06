/**
 * Assessment Evidence Enforcement Contract
 *
 * Provides evidence validation and tracking for all assessment frameworks
 * (DRD, SIRI, ADMA). Every scored dimension must have supporting evidence
 * before the assessment can be consolidated.
 */

export type EvidenceStatus = 'provided' | 'missing' | 'needs_review' | 'unknown';

export interface DimensionEvidence {
  dimensionId: string;
  frameworkId: string;
  currentScore: number;
  targetScore: number;
  evidenceText: string | null;
  evidenceAttachments: string[];
  evidenceStatus: EvidenceStatus;
  lastUpdated: string | null;
}

export interface AssessmentEvidenceReport {
  frameworkId: string;
  totalDimensions: number;
  withEvidence: number;
  missingEvidence: number;
  needsReview: number;
  completenessPercent: number;
  dimensions: DimensionEvidence[];
  isReadyForConsolidation: boolean;
  blockers: string[];
}

// ============================================
// EVIDENCE PROMPTS REGISTRY
// ============================================

interface EvidencePromptEntry {
  questions: string[];
  exampleEvidence: string[];
}

const SIRI_EVIDENCE_PROMPTS: Record<string, EvidencePromptEntry> = {
  operations: {
    questions: [
      'What automation level exists on the shop floor?',
      'How are production processes monitored in real time?',
      'What KPIs are tracked for operational efficiency?',
    ],
    exampleEvidence: [
      'OEE dashboard screenshot showing 78% efficiency across 3 production lines',
      'MES system report with real-time production tracking for Q4 2025',
    ],
  },
  supply_chain: {
    questions: [
      'How is end-to-end supply chain visibility achieved?',
      'What digital tools support supply chain planning and execution?',
      'How are suppliers integrated into your digital ecosystem?',
    ],
    exampleEvidence: [
      'EDI integration report showing 85% of suppliers connected electronically',
      'Supply chain control tower dashboard with real-time shipment tracking',
    ],
  },
  product_lifecycle: {
    questions: [
      'How are products designed and managed through their lifecycle digitally?',
      'Is there a PLM system in use? What stages does it cover?',
      'Are digital twins used for product development or simulation?',
    ],
    exampleEvidence: [
      'PLM system screenshot showing full product lifecycle from concept to EOL',
      'Digital twin simulation results for new product line validation',
    ],
  },
  automation: {
    questions: [
      'What types of automation are deployed (robotic, software, facility)?',
      'What percentage of production tasks are automated?',
      'How is automation ROI measured and tracked?',
    ],
    exampleEvidence: [
      'Robot deployment map showing 12 industrial robots across 4 work cells',
      'RPA bot inventory with 23 active automations saving 1,200 hours/month',
    ],
  },
  connectivity: {
    questions: [
      'How are IT and OT systems integrated?',
      'What IoT infrastructure is deployed on the shop floor?',
      'How is network security maintained across connected systems?',
    ],
    exampleEvidence: [
      'Network architecture diagram showing IT/OT convergence with 340 IoT endpoints',
      'IIoT platform dashboard with sensor data from 5 production lines',
    ],
  },
  intelligence: {
    questions: [
      'What analytics and AI/ML capabilities are in production use?',
      'How are data-driven decisions supported by intelligent systems?',
      'What predictive capabilities exist (maintenance, quality, demand)?',
    ],
    exampleEvidence: [
      'Predictive maintenance model performance report with 92% accuracy on failure prediction',
      'AI-powered quality inspection system reducing defect rate by 34%',
    ],
  },
  talent_readiness: {
    questions: [
      'What digital skills training programs exist for the workforce?',
      'How is workforce readiness for Industry 4.0 measured?',
      'What reskilling or upskilling initiatives are underway?',
    ],
    exampleEvidence: [
      'Training program completion report: 78% of operators completed digital skills certification',
      'Skills matrix showing digital competency levels across 200 employees',
    ],
  },
  structure_management: {
    questions: [
      'How does the organizational structure support digital transformation?',
      'Is there a dedicated digital transformation governance body?',
      'How is cross-functional collaboration facilitated?',
    ],
    exampleEvidence: [
      'Digital transformation steering committee charter and meeting minutes',
      'Org chart showing dedicated CDO role and cross-functional digital team of 15',
    ],
  },
};

const ADMA_EVIDENCE_PROMPTS: Record<string, EvidencePromptEntry> = {
  digital_strategy: {
    questions: [
      'Is there a formal digital transformation strategy document?',
      'What is the budget allocation for digital initiatives?',
      'How is the digital strategy aligned with overall business goals?',
    ],
    exampleEvidence: [
      'Board-approved digital strategy document with 3-year roadmap and KPIs',
      'Annual budget allocation showing 8% of revenue dedicated to digital transformation',
    ],
  },
  digital_investments: {
    questions: [
      'What is the total investment in digital technologies over the past 2 years?',
      'How is ROI tracked for digital investments?',
      'What is the investment pipeline for the next 12 months?',
    ],
    exampleEvidence: [
      'Investment tracking spreadsheet showing €2.4M spent on digital projects in 2025',
      'ROI analysis report for ERP modernization project showing 18-month payback',
    ],
  },
  digital_culture: {
    questions: [
      'How is digital mindset fostered across the organization?',
      'What training programs exist for digital skills development?',
      'How do employees participate in digital transformation initiatives?',
    ],
    exampleEvidence: [
      'Employee survey results: 72% report positive attitude toward digital change',
      'Digital champions network report with 25 active champions across departments',
    ],
  },
  product_features: {
    questions: [
      'What connected or smart features do your products include?',
      'How are IoT sensors or digital interfaces integrated into products?',
      'What is the roadmap for product digitalization?',
    ],
    exampleEvidence: [
      'Product catalog showing 4 out of 12 product lines with embedded IoT sensors',
      'Smart product feature comparison matrix vs. competitors',
    ],
  },
  product_data: {
    questions: [
      'How is product usage data collected and utilized?',
      'What insights are derived from product telemetry?',
      'How does product data feed back into R&D and improvement?',
    ],
    exampleEvidence: [
      'Product telemetry dashboard showing usage patterns from 5,000 connected devices',
      'Data-driven product improvement report: 3 feature changes based on usage analytics',
    ],
  },
  production_tech: {
    questions: [
      'What advanced manufacturing technologies are deployed?',
      'How is the production technology stack evolving?',
      'What is the level of robotics and additive manufacturing adoption?',
    ],
    exampleEvidence: [
      'Technology audit report listing 8 CNC machines, 4 robots, and 1 3D printer',
      'Production technology roadmap with planned upgrades for 2026-2027',
    ],
  },
  production_it: {
    questions: [
      'What MES/SCADA systems are in use on the production floor?',
      'How is IT/OT integration achieved in production?',
      'What level of real-time production visibility exists?',
    ],
    exampleEvidence: [
      'MES system architecture diagram covering 3 production halls',
      'SCADA dashboard screenshot with real-time monitoring of 120 process parameters',
    ],
  },
  supply_integration: {
    questions: [
      'How are suppliers and customers digitally integrated?',
      'What B2B platforms or EDI systems are in use?',
      'How is order-to-delivery process digitalized?',
    ],
    exampleEvidence: [
      'EDI connectivity report: 60% of top-20 suppliers connected via automated ordering',
      'B2B portal usage statistics showing 450 active supplier accounts',
    ],
  },
  supply_visibility: {
    questions: [
      'What level of real-time supply chain visibility exists?',
      'How is inventory tracked across the supply chain?',
      'What traceability capabilities are in place?',
    ],
    exampleEvidence: [
      'Supply chain visibility dashboard with GPS tracking for 90% of shipments',
      'Traceability report showing batch-level tracking from raw material to finished product',
    ],
  },
  data_collection: {
    questions: [
      'What systematic data collection mechanisms are in place?',
      'How is data quality ensured at the point of collection?',
      'What types of data are collected (operational, customer, product)?',
    ],
    exampleEvidence: [
      'Data collection architecture diagram showing 15 data sources feeding central warehouse',
      'Data quality scorecard: 94% completeness, 97% accuracy across core datasets',
    ],
  },
  data_analytics: {
    questions: [
      'What analytics capabilities exist (descriptive, predictive, prescriptive)?',
      'What BI tools and platforms are in use?',
      'How are analytics insights used in decision-making?',
    ],
    exampleEvidence: [
      'BI platform usage report: 120 active users, 45 automated dashboards',
      'Predictive analytics case study: demand forecasting model reducing stockouts by 28%',
    ],
  },
  data_services: {
    questions: [
      'What new services or revenue streams are created from data?',
      'How is data monetized or used to create customer value?',
      'What data-based service offerings exist or are planned?',
    ],
    exampleEvidence: [
      'Data service catalog: 3 paid analytics offerings generating €180K annual revenue',
      'Customer value report showing data-driven maintenance service reducing downtime by 40%',
    ],
  },
};

const DRD_EVIDENCE_PROMPTS: Record<string, EvidencePromptEntry> = {
  processes: {
    questions: [
      'How are core business processes documented and digitalized?',
      'What digital tools support process execution across departments?',
      'What is the level of process automation (sales, production, logistics)?',
    ],
    exampleEvidence: [
      'Process map showing 9 core processes with digitalization level per area (1A-1I)',
      'ERP system usage report covering sales, purchasing, production and HR modules',
    ],
  },
  digitalProducts: {
    questions: [
      'What digital product offerings does the organization provide?',
      'How are products enhanced with digital features or services?',
      'What is the product scalability and customer alignment strategy?',
    ],
    exampleEvidence: [
      'Digital product portfolio overview with 5 product lines and their digital maturity',
      'Customer satisfaction survey showing 82% approval of digital product features',
    ],
  },
  businessModels: {
    questions: [
      'What digital business models are in use (e-commerce, platform, as-a-service)?',
      'How is data monetized within the business model?',
      'What sharing or platform economy models are explored?',
    ],
    exampleEvidence: [
      'Business model canvas showing 3 active digital revenue streams',
      'E-commerce platform revenue report: 35% of total sales through digital channels',
    ],
  },
  dataManagement: {
    questions: [
      'How is data collected, stored, communicated and analyzed?',
      'What data infrastructure exists (cloud, on-premise, hybrid)?',
      'What big data or advanced analytics capabilities are in place?',
    ],
    exampleEvidence: [
      'Data architecture diagram showing collection, storage, and analytics layers',
      'Data governance policy document with defined roles and quality standards',
    ],
  },
  culture: {
    questions: [
      'How does leadership support digital transformation?',
      'What is the organizational readiness for change?',
      'How is continuous improvement and innovation culture fostered?',
    ],
    exampleEvidence: [
      'Leadership assessment results showing transformational leadership score of 4.2/5',
      'Change readiness survey: 68% of employees rate themselves as "embracing" change',
    ],
  },
  cybersecurity: {
    questions: [
      'What cybersecurity strategy and risk management framework is in place?',
      'How are networks, systems and data protected?',
      'What security training and incident response capabilities exist?',
    ],
    exampleEvidence: [
      'Cybersecurity maturity assessment report based on NIST framework',
      'Incident response plan document with last drill results (response time: 45 min)',
    ],
  },
  aiMaturity: {
    questions: [
      'What is the state of data readiness for AI applications?',
      'How are AI-supported processes deployed in the organization?',
      'What AI governance and ethics framework exists?',
    ],
    exampleEvidence: [
      'AI readiness assessment showing data pipeline maturity across 5 business areas',
      'AI project portfolio: 4 production models, 6 in development, governance board active',
    ],
  },
};

// ============================================
// CORE FUNCTIONS
// ============================================

export function computeEvidenceReport(params: {
  frameworkId: string;
  dimensions: Array<{
    id: string;
    current: number;
    target: number;
    evidence?: string | null;
    attachments?: string[];
    lastScoreChange?: string | null;
    lastEvidenceUpdate?: string | null;
  }>;
}): AssessmentEvidenceReport {
  const { frameworkId, dimensions } = params;

  const dimResults: DimensionEvidence[] = dimensions.map((dim) => {
    const hasScore = dim.current > 0;
    const hasEvidence = !!dim.evidence && dim.evidence.trim().length > 0;
    const hasAttachments = Array.isArray(dim.attachments) && dim.attachments.length > 0;
    const hasAnyEvidence = hasEvidence || hasAttachments;

    let evidenceStatus: EvidenceStatus;

    if (!hasScore) {
      evidenceStatus = 'unknown';
    } else if (!hasAnyEvidence) {
      evidenceStatus = 'missing';
    } else if (
      dim.lastScoreChange &&
      dim.lastEvidenceUpdate &&
      new Date(dim.lastScoreChange).getTime() > new Date(dim.lastEvidenceUpdate).getTime()
    ) {
      evidenceStatus = 'needs_review';
    } else {
      evidenceStatus = 'provided';
    }

    return {
      dimensionId: dim.id,
      frameworkId,
      currentScore: dim.current,
      targetScore: dim.target,
      evidenceText: dim.evidence ?? null,
      evidenceAttachments: dim.attachments ?? [],
      evidenceStatus,
      lastUpdated: dim.lastEvidenceUpdate ?? null,
    };
  });

  const totalDimensions = dimResults.length;
  const scoredDimensions = dimResults.filter((d) => d.currentScore > 0);
  const totalScored = scoredDimensions.length;
  const withEvidence = dimResults.filter((d) => d.evidenceStatus === 'provided').length;
  const missingEvidence = dimResults.filter((d) => d.evidenceStatus === 'missing').length;
  const needsReview = dimResults.filter((d) => d.evidenceStatus === 'needs_review').length;

  const completenessPercent = totalScored > 0 ? Math.round((withEvidence / totalScored) * 100) : 0;

  const blockers: string[] = [];

  const missingDims = dimResults.filter((d) => d.evidenceStatus === 'missing');
  if (missingDims.length > 0) {
    blockers.push(`Missing evidence for: ${missingDims.map((d) => d.dimensionId).join(', ')}`);
  }

  const reviewDims = dimResults.filter((d) => d.evidenceStatus === 'needs_review');
  if (reviewDims.length > 0) {
    blockers.push(
      `Evidence needs review (score changed): ${reviewDims.map((d) => d.dimensionId).join(', ')}`
    );
  }

  return {
    frameworkId,
    totalDimensions,
    withEvidence,
    missingEvidence,
    needsReview,
    completenessPercent,
    dimensions: dimResults,
    isReadyForConsolidation: missingEvidence === 0 && needsReview === 0,
    blockers,
  };
}

export function isReadyForConsolidation(report: AssessmentEvidenceReport): boolean {
  return report.missingEvidence === 0 && report.needsReview === 0;
}

export function getEvidencePrompts(
  frameworkId: string,
  dimensionId: string
): {
  questions: string[];
  exampleEvidence: string[];
} {
  const fallback: EvidencePromptEntry = {
    questions: [
      'What evidence supports the current maturity score for this dimension?',
      'What documentation or data can validate this assessment?',
    ],
    exampleEvidence: [
      'Relevant system screenshot or report',
      'Internal audit or assessment document',
    ],
  };

  switch (frameworkId.toUpperCase()) {
    case 'SIRI':
      return SIRI_EVIDENCE_PROMPTS[dimensionId] ?? fallback;
    case 'ADMA':
      return ADMA_EVIDENCE_PROMPTS[dimensionId] ?? fallback;
    case 'DRD':
      return DRD_EVIDENCE_PROMPTS[dimensionId] ?? fallback;
    default:
      return fallback;
  }
}

// ---------------------------------------------------------------------------
// API-backed functions (fall back to in-memory when backend unavailable)
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env as any)?.VITE_API_URL || '/api';

async function fetchFromApi<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchEvidenceFromDB(assessmentId: string): Promise<DimensionEvidence[]> {
  const result = await fetchFromApi<{ evidence: any[] }>(
    `${API_URL}/assessment-evidence/${assessmentId}`
  );
  if (result?.evidence?.length) {
    return result.evidence.map((e: any) => ({
      dimensionId: e.dimensionId,
      frameworkId: e.frameworkId,
      currentScore: e.currentScore ?? 0,
      targetScore: e.targetScore ?? 0,
      evidenceText: e.evidenceText,
      evidenceAttachments: e.attachments || [],
      evidenceStatus: e.evidenceStatus as EvidenceStatus,
      lastUpdated: e.lastEvidenceUpdate,
    }));
  }
  return [];
}

export async function saveEvidenceToDB(
  assessmentId: string,
  evidence: {
    frameworkId: string;
    dimensionId: string;
    currentScore?: number;
    targetScore?: number;
    evidenceText?: string;
    attachments?: string[];
  }
): Promise<DimensionEvidence | null> {
  const result = await fetchFromApi<{ evidence: any }>(
    `${API_URL}/assessment-evidence/${assessmentId}`,
    {
      method: 'POST',
      body: JSON.stringify(evidence),
    }
  );
  if (result?.evidence) {
    const e = result.evidence;
    return {
      dimensionId: e.dimensionId,
      frameworkId: e.frameworkId,
      currentScore: e.currentScore ?? 0,
      targetScore: e.targetScore ?? 0,
      evidenceText: e.evidenceText,
      evidenceAttachments: e.attachments || [],
      evidenceStatus: e.evidenceStatus as EvidenceStatus,
      lastUpdated: e.lastEvidenceUpdate,
    };
  }
  return null;
}

export async function fetchEvidenceReportFromDB(
  assessmentId: string
): Promise<AssessmentEvidenceReport | null> {
  const result = await fetchFromApi<any>(`${API_URL}/assessment-evidence/${assessmentId}/report`);
  if (result?.totalDimensions !== undefined) {
    return {
      frameworkId: result.frameworkId || '',
      totalDimensions: result.totalDimensions,
      withEvidence: result.withEvidence,
      missingEvidence: result.missingEvidence,
      needsReview: 0,
      completenessPercent: result.completenessPercent,
      dimensions: (result.dimensions || []).map((e: any) => ({
        dimensionId: e.dimensionId,
        frameworkId: e.frameworkId,
        currentScore: e.currentScore ?? 0,
        targetScore: e.targetScore ?? 0,
        evidenceText: e.evidenceText,
        evidenceAttachments: e.attachments || [],
        evidenceStatus: e.evidenceStatus as EvidenceStatus,
        lastUpdated: e.lastEvidenceUpdate,
      })),
      isReadyForConsolidation: result.isReadyForConsolidation,
      blockers: result.blockers || [],
    };
  }
  return null;
}
