#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Full Assessment Module Seeder — Production-quality demo dataset
 * ═══════════════════════════════════════════════════════════════
 * Creates a complete, diverse test dataset for the Assessment module:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  4 Assessments:                                             │
 * │    • DRD — Testowy (Manufacturing)      — APPROVED          │
 * │    • DRD — Finalny (Enterprise)         — APPROVED          │
 * │    • SIRI — Industry 4.0 Readiness      — APPROVED          │
 * │    • ADMA — Digital Maturity            — DRAFT (65%)       │
 * │                                                             │
 * │  12 Reports (3 per assessment):                             │
 * │    • Mixed statuses: DRAFT, CONFIGURING, GENERATED,         │
 * │      IN_REVIEW, APPROVED, UTILIZED                          │
 * │    • Mixed sizes: 2–42 pages                                │
 * │    • Mixed types: executive, roadmap, brief, investment,    │
 * │      technical analysis, benchmark                          │
 * │                                                             │
 * │  40 Initiatives (10 per assessment):                        │
 * │    • Full lifecycle: DRAFT, REVIEW, PROMOTED, PLANNING,     │
 * │      APPROVED, SCHEDULED, EXECUTING, BLOCKED, DONE,         │
 * │      TRACKING, CANCELLED                                    │
 * │    • Linked to specific reports                             │
 * │    • Diverse budgets: €15k – €1.2M                          │
 * │    • Diverse timelines: 2 months – 24 months                │
 * │    • Diverse priorities: low, medium, high, critical        │
 * │    • Diverse categories: Technology, AI/ML, Data, People,   │
 * │      Operations, Security, Innovation, Sustainability,      │
 * │      Compliance, Strategy                                   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   cd server && NODE_ENV=development DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-full-assessment-module.ts
 *   cd server && NODE_ENV=development DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-full-assessment-module.ts --purge
 */

import { createDatabase } from '../src/database/Database.js';
import { DRD_STRUCTURE } from '../../src/services/drdStructure';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}i${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}!${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
  header: (msg: string) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
};

function isoDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const DEFAULT_ORG_ID = 'org-dbr77-system';

// ============================================================
// DRD HELPERS
// ============================================================

type AreaState = {
  achievedLevel: number;
  targetLevel?: number;
  levelNotes?: Record<string, string>;
  levelLinks?: Record<string, string[]>;
  levelDecisions?: Record<string, 'skip'>;
};

function getAllDrdAreas(): Array<{ axisId: number; levelCount: number; areaId: string }> {
  const out: Array<{ axisId: number; levelCount: number; areaId: string }> = [];
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      out.push({ axisId: axis.id, levelCount: axis.levelCount || 5, areaId: area.id });
    }
  }
  return out;
}

function buildDrdAreas(params: {
  coverage: number;
  maturityByAxis: Partial<Record<number, { achieved: number; target: number }>>;
  focusNotes?: Partial<Record<string, string>>;
  focusLinks?: Partial<Record<string, string[]>>;
}): Record<string, AreaState> {
  const all = getAllDrdAreas();
  const total = all.length || 1;
  const cutoff = Math.round(total * clamp(params.coverage, 0, 1));

  const areas: Record<string, AreaState> = {};
  for (let idx = 0; idx < all.length; idx++) {
    const { axisId, levelCount, areaId } = all[idx];
    const base = params.maturityByAxis[axisId] || { achieved: 0, target: 0 };
    const isIncluded = idx < cutoff;
    const wobble = (idx % 3) - 1;
    const achieved = isIncluded ? clamp(base.achieved + wobble, 0, levelCount) : 0;
    const target = isIncluded ? clamp(base.target, 1, levelCount) : 0;

    areas[areaId] = {
      achievedLevel: achieved,
      ...(target > 0 ? { targetLevel: target } : {}),
      ...(params.focusNotes?.[areaId]
        ? { levelNotes: { [String(Math.max(1, achieved || 1))]: params.focusNotes[areaId]! } }
        : {}),
      ...(params.focusLinks?.[areaId]?.length
        ? { levelLinks: { [String(Math.max(1, achieved || 1))]: params.focusLinks[areaId]! } }
        : {}),
      ...(isIncluded && achieved === 0 ? { levelDecisions: { '1': 'skip' as const } } : {}),
    };
  }
  return areas;
}

// ============================================================
// SIRI HELPERS
// ============================================================

const SIRI_DIM_IDS = [
  'operations',
  'supply_chain',
  'product_lifecycle',
  'automation',
  'connectivity',
  'intelligence',
  'workforce_learning',
  'leadership',
];

function buildSiriAnswers(
  maturityMap: Record<
    string,
    { current: number; target: number; notes?: string; evidence?: string }
  >
) {
  const dimensions: Record<string, any> = {};
  for (const id of SIRI_DIM_IDS) {
    const m = maturityMap[id] || { current: 2, target: 4 };
    dimensions[id] = {
      current: m.current,
      target: m.target,
      notes: m.notes || '',
      evidence: m.evidence || '',
    };
  }
  return { siri: { dimensions, prioritisationMatrix: {} } };
}

// ============================================================
// ADMA HELPERS
// ============================================================

const ADMA_DIM_IDS = [
  'digital_strategy',
  'digital_investments',
  'digital_culture',
  'product_features',
  'product_data',
  'product_services',
  'product_integration',
  'factory_automation',
  'factory_connectivity',
  'factory_intelligence',
  'value_chain_visibility',
  'value_chain_agility',
];

function buildAdmaAnswers(
  maturityMap: Record<
    string,
    { current: number; target: number; notes?: string; evidence?: string }
  >
) {
  const dimensions: Record<string, any> = {};
  for (const id of ADMA_DIM_IDS) {
    const m = maturityMap[id] || { current: 2, target: 4 };
    dimensions[id] = {
      current: m.current,
      target: m.target,
      notes: m.notes || '',
      evidence: m.evidence || '',
    };
  }
  return { adma: { dimensions } };
}

// ============================================================
// SEED DATA: 4 ASSESSMENTS
// ============================================================

type SeedAssessment = {
  id: string;
  name: string;
  assessment_type: string;
  status: string;
  completionPercent: number;
  confidenceAvg: number;
  updatedAtDaysAgo: number;
  answers: Record<string, any>;
  contextSnapshot: Record<string, any>;
  scoreSummary: Record<string, any>;
};

const ASSESSMENTS: SeedAssessment[] = [
  // ─── 1. DRD Full Assessment (Manufacturing) — APPROVED ───
  {
    id: 'assess-drd-manufacturing-01',
    name: 'DRD — Testowy (Manufacturing)',
    assessment_type: 'DRD',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 3.8,
    updatedAtDaysAgo: 3,
    answers: {
      drd: {
        areas: buildDrdAreas({
          coverage: 1,
          maturityByAxis: {
            1: { achieved: 4, target: 6 },
            2: { achieved: 5, target: 7 },
            3: { achieved: 3, target: 5 },
            4: { achieved: 4, target: 6 },
            5: { achieved: 3, target: 6 },
            6: { achieved: 4, target: 5 },
            7: { achieved: 2, target: 5 },
          },
          focusNotes: {
            '1A': 'CRM wdrożony, integracja z ERP zaplanowana na Q2. Obsługa klienta częściowo zdigitalizowana — portal self-service dla top 20 klientów.',
            '1F': 'MES działa na 2 z 3 linii produkcyjnych. Pełne OEE tracking z raportowaniem real-time na dashboardach shop-floor.',
            '4D': 'Data warehouse z Power BI, ale brak governance frameworku. Dane jakościowe niespójne między lokalizacjami.',
            '7A': 'Pilotaż AI do predykcji jakości na linii 2 — wyniki obiecujące (30% redukcja defektów). Brak MLOps pipeline.',
            '5A': 'Change management program w fazie planowania. Szkolenia digital literacy dla 200 pracowników zakończone.',
            '6B': 'Firewall OT zainstalowany. Brak segmentacji sieci OT/IT. Audit cyberbezpieczeństwa zaplanowany na Q2 2026.',
          },
        }),
      },
    },
    contextSnapshot: {
      audit: {
        phase: 'APPROVAL',
        notes: 'Assessment complete. Report approved. Ready for initiative generation.',
      },
      scope: {
        plants: 3,
        businessUnits: ['Production', 'Sales', 'Supply Chain'],
        timeframe: '2026-Q1',
        employeeCount: 1200,
        industryVertical: 'Manufacturing — Automotive Components',
      },
    },
    scoreSummary: {
      overall: { actual: 4.1, target: 5.5, gap: 1.4 },
      byAxis: { 1: 3.8, 2: 5.0, 3: 3.1, 4: 4.2, 5: 2.9, 6: 4.0, 7: 2.0 },
      seeded: true,
    },
  },

  // ─── 2. DRD Full Assessment (Enterprise) — APPROVED ───
  {
    id: 'assess-drd-enterprise-01',
    name: 'DRD — Finalny (Enterprise)',
    assessment_type: 'DRD',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 3.4,
    updatedAtDaysAgo: 3,
    answers: {
      drd: {
        areas: buildDrdAreas({
          coverage: 1,
          maturityByAxis: {
            1: { achieved: 5, target: 7 },
            2: { achieved: 3, target: 5 },
            3: { achieved: 4, target: 6 },
            4: { achieved: 5, target: 7 },
            5: { achieved: 4, target: 6 },
            6: { achieved: 3, target: 5 },
            7: { achieved: 3, target: 6 },
          },
          focusNotes: {
            '1A': 'Pełna integracja CRM-ERP. Automatyzacja sprzedaży na poziomie 80%. Chatbot AI obsługuje 35% zapytań klientów.',
            '2B': 'Szkolenia cyfrowe w programie onboarding. Brak formalnej digital academy. Plan: uruchomienie LMS w Q3.',
            '5A': 'IAM wdrożony, MFA na 100% kont. SIEM w fazie implementacji. SOC 24/7 outsourced.',
            '7B': 'ML pipeline dla demand forecasting (MAPE < 12%). MLOps w budowie — Docker + Airflow.',
            '3A': 'E-commerce B2B z konfiguratorem produktu. Marketplace pilot w 2 krajach UE.',
            '4A': 'Master Data Management wdrożony dla product data. Customer 360 w planowaniu.',
          },
        }),
      },
    },
    contextSnapshot: {
      audit: {
        phase: 'APPROVAL',
        notes:
          'Enterprise audit complete. High maturity in processes and data. Key gaps: AI governance, advanced analytics, OT security.',
      },
      scope: {
        plants: 5,
        businessUnits: ['All — Corporate, Production, Sales, Supply Chain, R&D, Finance'],
        timeframe: '2026-Q1',
        employeeCount: 4500,
        industryVertical: 'Manufacturing — Industrial Equipment',
      },
    },
    scoreSummary: {
      overall: { actual: 5.5, target: 7.0, gap: 1.5 },
      byAxis: { 1: 5.2, 2: 3.0, 3: 4.1, 4: 5.3, 5: 3.8, 6: 3.0, 7: 3.1 },
      seeded: true,
    },
  },

  // ─── 3. SIRI — APPROVED ───
  {
    id: 'assess-siri-readiness-01',
    name: 'SIRI — Industry 4.0 Readiness',
    assessment_type: 'SIRI',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 3.2,
    updatedAtDaysAgo: 5,
    answers: buildSiriAnswers({
      operations: {
        current: 3,
        target: 5,
        notes:
          'Shop floor digitized, real-time OEE via IoT sensors. Predictive maintenance pilot on CNC machines.',
        evidence: 'OEE dashboards, MES screenshots, PM pilot results',
      },
      supply_chain: {
        current: 2,
        target: 4,
        notes:
          'Basic ERP integration. No real-time supply chain visibility. Supplier portal planned for Q3.',
        evidence: 'ERP screenshots, OTIF reports, supplier audit results',
      },
      product_lifecycle: {
        current: 3,
        target: 5,
        notes:
          'PLM system in place, digital twin for flagship products. CAD/CAM integration automated.',
        evidence: 'PLM workflow screenshots, digital twin demo',
      },
      automation: {
        current: 4,
        target: 5,
        notes:
          'AGV and cobot deployment on 2 lines. Full robotic welding cell. Semi-autonomous quality inspection.',
        evidence: 'Robot cell photos, throughput data, safety audit',
      },
      connectivity: {
        current: 3,
        target: 5,
        notes:
          'OPC-UA on most machines, MQTT for edge. Industrial WiFi in 60% of plant. No 5G yet.',
        evidence: 'Network topology, bandwidth tests, latency reports',
      },
      intelligence: {
        current: 2,
        target: 4,
        notes:
          'BI dashboards operational. No predictive analytics yet. ML feasibility study completed for energy optimization.',
        evidence: 'BI screenshots, ML feasibility report',
      },
      workforce_learning: {
        current: 2,
        target: 4,
        notes:
          'Ad-hoc training. No formal upskilling program. Digital literacy assessment done for 300 operators.',
        evidence: 'Training records, literacy assessment results',
      },
      leadership: {
        current: 3,
        target: 4,
        notes:
          'C-suite committed. Digital transformation officer appointed. Quarterly digital steering committee meetings.',
        evidence: 'Board minutes, transformation roadmap, KPI dashboard',
      },
    }),
    contextSnapshot: {
      scope: {
        plants: 2,
        businessUnits: ['Production', 'Supply Chain'],
        timeframe: '2026-Q1',
        employeeCount: 800,
        industryVertical: 'Manufacturing — Electronics Assembly',
      },
    },
    scoreSummary: {
      overall: { actual: 2.75, target: 4.5, gap: 1.75 },
      byDimension: {
        operations: 3,
        supply_chain: 2,
        product_lifecycle: 3,
        automation: 4,
        connectivity: 3,
        intelligence: 2,
        workforce_learning: 2,
        leadership: 3,
      },
      seeded: true,
    },
  },

  // ─── 4. ADMA — DRAFT (in progress, 65%) ───
  {
    id: 'assess-adma-maturity-01',
    name: 'ADMA — Digital Maturity Assessment',
    assessment_type: 'ADMA',
    status: 'DRAFT',
    completionPercent: 65,
    confidenceAvg: 2.8,
    updatedAtDaysAgo: 1,
    answers: buildAdmaAnswers({
      digital_strategy: {
        current: 3,
        target: 5,
        notes:
          'Strategy document exists but not cascaded to all BUs. KPI framework for digital initiatives in development.',
        evidence: 'Strategy document v2.1, stakeholder workshop notes',
      },
      digital_investments: {
        current: 3,
        target: 4,
        notes:
          'Budget allocated (€2.1M/year), but ROI tracking is basic. No formal benefits realization process.',
        evidence: 'Budget allocation spreadsheet, quarterly reviews',
      },
      digital_culture: {
        current: 2,
        target: 4,
        notes:
          'Resistance to change in middle management. Innovation lab launched but underutilized. Employee digital survey: 45% positive.',
      },
      product_features: {
        current: 2,
        target: 4,
        notes: 'Basic IoT in 30% of products. Remote monitoring for premium line only.',
        evidence: 'Product spec sheets, IoT platform dashboard',
      },
      product_data: {
        current: 1,
        target: 3,
        notes:
          'No formal product data platform yet. Data scattered in ERP, PLM, spreadsheets. Data quality: estimated 60%.',
      },
      product_services: {
        current: 1,
        target: 3,
        notes:
          'After-sales service is manual (phone/email). No predictive service or condition-based maintenance offering.',
      },
      product_integration: {
        current: 2,
        target: 4,
        notes: 'API gateway for partner integration. 3 integrations live, 8 planned.',
      },
      factory_automation: {
        current: 3,
        target: 5,
        notes:
          'PLC/SCADA on all lines, MES on 60%. Automated material handling on main line. Manual changeovers still dominant.',
        evidence: 'SCADA screenshots, MES deployment map',
      },
      factory_connectivity: {
        current: 2,
        target: 4,
        notes: 'Ethernet to PLCs. No edge computing. OPC-UA migration started (20% complete).',
      },
      factory_intelligence: {
        current: 1,
        target: 3,
        notes:
          'Descriptive analytics only. No real-time dashboards on shop floor. SPC charts maintained manually.',
      },
      value_chain_visibility: {
        current: 2,
        target: 4,
        notes:
          'ERP-based visibility. Supplier lead times tracked in spreadsheet. No real-time disruption alerting.',
      },
      value_chain_agility: {
        current: 1,
        target: 3,
        notes:
          'Fixed production schedules. Re-planning cycle: weekly. No dynamic scheduling capability.',
      },
    }),
    contextSnapshot: {
      scope: {
        plants: 2,
        businessUnits: ['Production', 'Engineering'],
        timeframe: '2026-Q1',
        employeeCount: 600,
        industryVertical: 'Manufacturing — Packaging Machinery',
      },
    },
    scoreSummary: {
      overall: { actual: 1.9, target: 3.8, gap: 1.9 },
      byPillar: {
        strategy: 2.7,
        smart_products: 1.5,
        smart_operations: 2.0,
        smart_supply: 1.5,
        data_driven: 1.0,
      },
      seeded: true,
    },
  },
];

// ============================================================
// SEED DATA: REPORTS — 3 per assessment, max diversity
// ============================================================

type SeedReport = {
  id: string;
  assessmentId: string;
  title: string;
  status: string; // Assessment module status
  rbStatus: string; // Report Builder status
  description: string;
  templateType: string;
  updatedAtDaysAgo: number;
  contentJson: Record<string, any>;
};

const REPORTS: SeedReport[] = [
  // ═══════════════════════════════════════════
  // DRD — Testowy (Manufacturing) — 3 reports
  // ═══════════════════════════════════════════

  // LARGE report (42 pages) — fully approved, rich with data
  {
    id: 'report-drd-test-exec',
    assessmentId: 'assess-drd-manufacturing-01',
    title: 'DRD Manufacturing — Executive Summary & Deep Analysis (C-suite)',
    status: 'APPROVED',
    rbStatus: 'APPROVED',
    description:
      'Comprehensive 42-page report for executive leadership. Includes full gap analysis, benchmarking against industry, investment roadmap, and organizational impact assessment. Contains 15 charts, 8 data tables, and 3 heatmaps.',
    templateType: 'executive_summary',
    updatedAtDaysAgo: 2,
    contentJson: {
      executiveSummary:
        'Manufacturing Digital Readiness: Overall maturity 4.1/7 vs target 5.5/7 (gap: 1.4). Strongest areas: Digital Products (5.0) and Digital Processes (3.8). Critical gaps in AI Maturity (2.0) and Culture of Transformation (2.9). Investment required: €2.8M over 18 months. Expected ROI: 185% within 3 years. Key recommendation: Accelerate data governance and MLOps capabilities as foundation for AI-driven manufacturing excellence.',
      sections: [
        'Executive Overview',
        'Assessment Methodology',
        'Maturity Scorecard',
        'Axis 1: Digital Processes — Detailed Analysis',
        'Axis 2: Digital Products — Detailed Analysis',
        'Axis 3: Digital Business Models — Gap Assessment',
        'Axis 4: Data Management — Critical Findings',
        'Axis 5: Culture of Transformation — Organizational Readiness',
        'Axis 6: Cybersecurity — OT/IT Risk Profile',
        'Axis 7: AI Maturity — Current State & Potential',
        'Cross-Axis Dependencies',
        'Industry Benchmark Comparison',
        'Investment Roadmap (3 phases)',
        'Risk Register',
        'Appendix A: Detailed Scores',
        'Appendix B: Evidence Log',
        'Appendix C: Methodology',
      ],
      pageCount: 42,
      orientation: 'portrait',
      hasCharts: true,
      chartCount: 15,
      tableCount: 8,
      heatmapCount: 3,
      generatedAt: isoDaysAgo(5),
    },
  },

  // MEDIUM report (14 pages) — in review, roadmap focus
  {
    id: 'report-drd-test-review',
    assessmentId: 'assess-drd-manufacturing-01',
    title: 'DRD Manufacturing — 12-Month Transformation Roadmap',
    status: 'PENDING_APPROVAL',
    rbStatus: 'IN_REVIEW',
    description:
      'Roadmap with phased implementation plan. Currently in review — awaiting PMO approval. Contains timeline Gantt chart, resource allocation matrix, and dependency map.',
    templateType: 'roadmap',
    updatedAtDaysAgo: 1,
    contentJson: {
      executiveSummary:
        'Roadmap 12m: Phase 1 (Q1-Q2) — Foundation: Data governance, MES completion, OT security. Phase 2 (Q2-Q3) — Intelligence: Analytics platform, predictive maintenance, ML pilot. Phase 3 (Q3-Q4) — Scale: AI production optimization, digital twin, workforce transformation.',
      sections: [
        'Roadmap Overview',
        'Phase 1: Foundation (Q1-Q2 2026)',
        'Phase 2: Intelligence (Q2-Q3 2026)',
        'Phase 3: Scale (Q3-Q4 2026)',
        'Resource Allocation',
        'Dependencies & Critical Path',
        'KPI Targets per Phase',
        'Risk Mitigation Plan',
      ],
      pageCount: 14,
      orientation: 'landscape',
      hasCharts: true,
      chartCount: 4,
      tableCount: 3,
      generatedAt: isoDaysAgo(3),
      reviewComments: [
        {
          author: 'Jan Kowalski',
          date: isoDaysAgo(1),
          text: 'Phase 2 timeline seems aggressive. Consider buffer for ML model training.',
        },
        {
          author: 'Anna Nowak',
          date: isoDaysAgo(0),
          text: 'Resource allocation for OT security needs revision — we need external consultants.',
        },
      ],
    },
  },

  // SMALL report (2 pages) — draft, text-only one-pager
  {
    id: 'report-drd-test-draft',
    assessmentId: 'assess-drd-manufacturing-01',
    title: 'DRD Manufacturing — Quick Summary One-Pager',
    status: 'DRAFT',
    rbStatus: 'CONFIGURING',
    description:
      'Minimalist one-pager for quick stakeholder briefing. Text-only, no charts. Draft — not yet generated.',
    templateType: 'stakeholder_brief',
    updatedAtDaysAgo: 0,
    contentJson: {
      executiveSummary:
        'Top 3 gaps: AI Maturity (2.0/5), Culture (2.9/5), Cybersecurity OT (4.0/5 but critical risk). Top 3 quick wins: Complete MES rollout (3 months), launch data governance (6 months), OT security hardening (4 months).',
      sections: ['Top Gaps', 'Quick Wins', 'Key Numbers'],
      pageCount: 2,
      orientation: 'portrait',
      hasCharts: false,
      chartCount: 0,
      generatedAt: isoDaysAgo(1),
    },
  },

  // ═══════════════════════════════════════════
  // DRD — Finalny (Enterprise) — 3 reports
  // ═══════════════════════════════════════════

  // LARGE report (34 pages) — utilized, sent externally
  {
    id: 'report-drd-final-board',
    assessmentId: 'assess-drd-enterprise-01',
    title: 'DRD Enterprise — Board Presentation & Strategic Investment Case',
    status: 'UTILIZED',
    rbStatus: 'UTILIZED',
    description:
      'Board-level presentation with strategic investment rationale. Approved and utilized for investor meetings. Landscape format with heavy visual content — 20 charts, executive dashboards, and benchmark comparisons against Fortune 500 manufacturers.',
    templateType: 'executive_summary',
    updatedAtDaysAgo: 7,
    contentJson: {
      executiveSummary:
        'Enterprise Digital Transformation: Maturity 5.5/7. Strong foundation in processes (5.2) and data management (5.3). Critical investments needed: AI governance (€800K), advanced analytics platform (€1.2M), cybersecurity convergence (€650K). Total program: €4.1M/24m. Expected NPV: €12.4M. Board approved on 2026-01-28.',
      sections: [
        'Board Summary',
        'Strategic Context',
        'Key Metrics Dashboard',
        'Maturity Profile vs Industry Leaders',
        'Gap Analysis Heat Map',
        'Investment Priorities (Ranked)',
        'Financial Model — NPV & IRR',
        'Governance Model',
        'Risk & Mitigation',
        'Timeline & Milestones',
        'Appendix: Detailed Assessment Data',
      ],
      pageCount: 34,
      orientation: 'landscape',
      hasCharts: true,
      chartCount: 20,
      tableCount: 6,
      heatmapCount: 2,
      generatedAt: isoDaysAgo(10),
      approvedAt: isoDaysAgo(7),
      utilizedAt: isoDaysAgo(5),
      utilizationNotes:
        'Presented at Board meeting 2026-01-28. Approved for investor presentation Q2.',
    },
  },

  // MEDIUM report (22 pages) — generated, ready for review
  {
    id: 'report-drd-final-generated',
    assessmentId: 'assess-drd-enterprise-01',
    title: 'DRD Enterprise — Investment Case & Benefits Realization Plan',
    status: 'FINAL',
    rbStatus: 'GENERATED',
    description:
      'Detailed investment case with benefits realization framework. Generated by AI, awaiting human review. Mixed content — financial projections, org charts, and narrative sections.',
    templateType: 'investment_case',
    updatedAtDaysAgo: 2,
    contentJson: {
      executiveSummary:
        'Investment Case: €4.1M / 24 months. Phase 1 (€1.5M): Data & Analytics platform. Phase 2 (€1.8M): AI/ML + Cybersecurity. Phase 3 (€0.8M): Scale & optimize. Benefits: €6.8M cost savings, €5.6M revenue uplift over 5 years. Payback period: 22 months. IRR: 42%.',
      sections: [
        'Investment Summary',
        'Current State Assessment',
        'Target State Vision',
        'Financial Model — Detailed',
        'Phase 1: Data & Analytics',
        'Phase 2: AI & Security',
        'Phase 3: Scale & Optimize',
        'Benefits Realization Framework',
        'KPI Dashboard Design',
        'Organizational Impact',
        'Risk Register',
        'Next Steps & Decision Points',
      ],
      pageCount: 22,
      orientation: 'portrait',
      hasCharts: true,
      chartCount: 8,
      tableCount: 5,
      generatedAt: isoDaysAgo(3),
    },
  },

  // SMALL report (5 pages) — draft, brief format
  {
    id: 'report-drd-final-draft',
    assessmentId: 'assess-drd-enterprise-01',
    title: 'DRD Enterprise — Stakeholder Communication Brief',
    status: 'DRAFT',
    rbStatus: 'CONFIGURING',
    description:
      'Short communication brief for internal stakeholders. Draft stage — template selected but content not yet generated. Will include key messages and action items per department.',
    templateType: 'stakeholder_brief',
    updatedAtDaysAgo: 1,
    contentJson: {
      executiveSummary:
        'Brief for department heads: AI governance priorities, data platform migration timeline, digital academy launch schedule. Action items per BU.',
      sections: ['Key Messages', 'Action Items by Department', 'Timeline', 'FAQ', 'Contact Points'],
      pageCount: 5,
      orientation: 'portrait',
      hasCharts: false,
      chartCount: 0,
      generatedAt: isoDaysAgo(2),
    },
  },

  // ═══════════════════════════════════════════
  // SIRI — Industry 4.0 Readiness — 3 reports
  // ═══════════════════════════════════════════

  // LARGE report (30 pages) — in review, comprehensive SIRI analysis
  {
    id: 'report-siri-review',
    assessmentId: 'assess-siri-readiness-01',
    title: 'SIRI — Full Industry 4.0 Readiness Report & Benchmark',
    status: 'PENDING_APPROVAL',
    rbStatus: 'IN_REVIEW',
    description:
      'Comprehensive SIRI assessment report with global benchmark comparison. In review — 2 reviewers have commented. Includes radar charts, dimension heatmaps, and prioritization matrix visualization.',
    templateType: 'siri_full_report',
    updatedAtDaysAgo: 4,
    contentJson: {
      executiveSummary:
        'SIRI Assessment: Overall Band 2.75 (target 4.5). Strong automation capability (Band 4), but intelligence (Band 2) and workforce readiness (Band 2) lag significantly. Compared to ASEAN Smart Factory benchmark: below median in 5/8 dimensions. Priority actions: (1) Deploy analytics platform, (2) Launch workforce transformation program, (3) Achieve full connectivity standard.',
      sections: [
        'SIRI Framework Overview',
        'Assessment Scope & Method',
        'Process Block: Operations, Supply Chain, Product Lifecycle',
        'Technology Block: Automation, Connectivity, Intelligence',
        'Organization Block: Workforce, Leadership',
        'Dimension Radar Chart',
        'Prioritisation Matrix',
        'Global Benchmark Comparison',
        'Band Progression Roadmap',
        'Investment Requirements',
        'Risk Assessment',
      ],
      pageCount: 30,
      orientation: 'portrait',
      hasCharts: true,
      chartCount: 12,
      tableCount: 4,
      heatmapCount: 1,
      generatedAt: isoDaysAgo(6),
      reviewComments: [
        {
          author: 'Tomasz Mazur',
          date: isoDaysAgo(3),
          text: 'Benchmark data should include EU manufacturers, not just ASEAN.',
        },
        {
          author: 'Katarzyna Wiśniewska',
          date: isoDaysAgo(2),
          text: 'Workforce section needs more detail on skills gap analysis.',
        },
      ],
    },
  },

  // MEDIUM report (12 pages) — generated, sprint plan format
  {
    id: 'report-siri-generated',
    assessmentId: 'assess-siri-readiness-01',
    title: 'SIRI — 6 Month Sprint Plan (Quick Wins)',
    status: 'FINAL',
    rbStatus: 'GENERATED',
    description:
      'Agile-style sprint plan for first 6 months. Generated — ready for review. Landscape format with sprint timeline, deliverable cards, and burn-down projection.',
    templateType: 'roadmap',
    updatedAtDaysAgo: 3,
    contentJson: {
      executiveSummary:
        'Sprint Plan (6 months, 3 sprints): Sprint 1 (M1-M2) — Connectivity standardization, OPC-UA migration, edge gateway deployment. Sprint 2 (M3-M4) — Analytics MVP, BI migration, predictive maintenance PoC. Sprint 3 (M5-M6) — Workforce upskilling pilot (50 operators), leadership digital KPI dashboard.',
      sections: [
        'Sprint Overview',
        'Sprint 1: Connect (Month 1-2)',
        'Sprint 2: Analyze (Month 3-4)',
        'Sprint 3: Empower (Month 5-6)',
        'Deliverables per Sprint',
        'KPI Targets',
        'Resource Requirements',
        'Burn-down Projection',
      ],
      pageCount: 12,
      orientation: 'landscape',
      hasCharts: true,
      chartCount: 5,
      generatedAt: isoDaysAgo(4),
    },
  },

  // SMALL report (3 pages) — draft, text-focused overview
  {
    id: 'report-siri-draft',
    assessmentId: 'assess-siri-readiness-01',
    title: 'SIRI — Management Summary (Draft)',
    status: 'DRAFT',
    rbStatus: 'CONFIGURING',
    description: 'Concise management summary. Text-heavy, minimal visuals. Draft stage.',
    templateType: 'stakeholder_brief',
    updatedAtDaysAgo: 2,
    contentJson: {
      executiveSummary:
        'Band avg 2.75 vs target 4.5. Key findings: Automation leads (Band 4), Intelligence lags (Band 2). Budget needed: €1.8M/12m. Quick wins available in connectivity and analytics.',
      sections: ['Results at a Glance', 'Key Findings', 'Recommended Next Steps'],
      pageCount: 3,
      orientation: 'portrait',
      hasCharts: false,
      generatedAt: isoDaysAgo(3),
    },
  },

  // ═══════════════════════════════════════════
  // ADMA — Digital Maturity — 3 reports (assessment DRAFT, reports for UX testing)
  // ═══════════════════════════════════════════

  // SMALL report (4 pages) — draft, early stage
  {
    id: 'report-adma-draft',
    assessmentId: 'assess-adma-maturity-01',
    title: 'ADMA — Quick Brief for Steering Committee',
    status: 'DRAFT',
    rbStatus: 'CONFIGURING',
    description:
      'Early draft brief for steering committee. Assessment still in progress (65%), so data is preliminary. Text-only format.',
    templateType: 'stakeholder_brief',
    updatedAtDaysAgo: 1,
    contentJson: {
      executiveSummary:
        'ADMA preliminary results (65% complete): Overall maturity 1.9/5 (Beginner+). Strongest: Strategy (2.7), weakest: Data-Driven Services (1.0). Critical gaps in product data platform, factory intelligence, and value chain agility.',
      sections: [
        'Preliminary Snapshot',
        'Top Gaps (Provisional)',
        'Recommended Focus Areas',
        'Next Steps',
      ],
      pageCount: 4,
      orientation: 'portrait',
      hasCharts: false,
      generatedAt: isoDaysAgo(2),
    },
  },

  // LARGE report (26 pages) — generated, deep technical analysis
  {
    id: 'report-adma-generated',
    assessmentId: 'assess-adma-maturity-01',
    title: 'ADMA — Deep Pillar Analysis & Technology Roadmap',
    status: 'FINAL',
    rbStatus: 'GENERATED',
    description:
      'Deep technical analysis across all 5 ADMA pillars. AI-generated with rich content. Contains pillar radar charts, technology stack assessment, and vendor comparison matrix. Note: Based on 65% data — will need refresh when assessment completes.',
    templateType: 'technical_analysis',
    updatedAtDaysAgo: 3,
    contentJson: {
      executiveSummary:
        'ADMA Deep Analysis (based on 65% assessment data): Strategy pillar shows promise (2.7/5) but lacks cascading. Smart Products critically underdeveloped (1.5/5) — no product data platform, minimal IoT. Smart Operations moderate (2.0/5) — good SCADA/PLC foundation but zero intelligence layer. Smart Supply weakest overall (1.5/5). Recommended technology investments: Product Data Platform (€350K), Edge Computing + Analytics (€280K), Supply Chain Control Tower (€420K).',
      sections: [
        'Methodology & Caveats (65% Assessment)',
        'Pillar 1: Strategy — Analysis',
        'Pillar 2: Smart Products — Analysis',
        'Pillar 3: Smart Operations — Analysis',
        'Pillar 4: Smart Supply — Analysis',
        'Pillar 5: Data-Driven Services — Analysis',
        'Cross-Pillar Dependencies',
        'Technology Stack Assessment',
        'Vendor Comparison Matrix',
        'Investment Prioritization',
        'Implementation Roadmap (18 months)',
        'Risk Register',
      ],
      pageCount: 26,
      orientation: 'portrait',
      hasCharts: true,
      chartCount: 10,
      tableCount: 6,
      generatedAt: isoDaysAgo(4),
    },
  },

  // MEDIUM report (10 pages) — in review, roadmap format
  {
    id: 'report-adma-review',
    assessmentId: 'assess-adma-maturity-01',
    title: 'ADMA — Transformation Roadmap (Review)',
    status: 'PENDING_APPROVAL',
    rbStatus: 'IN_REVIEW',
    description:
      'Transformation roadmap in review. Landscape format with timeline visualization and milestones. Reviewer comments about scope and prioritization.',
    templateType: 'roadmap',
    updatedAtDaysAgo: 2,
    contentJson: {
      executiveSummary:
        'ADMA Transformation Roadmap: 18-month plan. Phase 1: Foundation (M1-M6) — Product data platform, OPC-UA migration, change management. Phase 2: Intelligence (M7-M12) — Analytics, edge computing, IoT expansion. Phase 3: Optimization (M13-M18) — Supply chain tower, dynamic scheduling, advanced services.',
      sections: [
        'Roadmap Overview',
        'Phase 1: Foundation',
        'Phase 2: Intelligence',
        'Phase 3: Optimization',
        'Milestones & Gates',
        'KPIs per Phase',
        'Resource & Budget Plan',
      ],
      pageCount: 10,
      orientation: 'landscape',
      hasCharts: true,
      chartCount: 3,
      tableCount: 2,
      generatedAt: isoDaysAgo(3),
      reviewComments: [
        {
          author: 'Marek Zieliński',
          date: isoDaysAgo(1),
          text: 'Phase 1 scope too broad — suggest splitting into 1a and 1b.',
        },
      ],
    },
  },
];

// ============================================================
// SEED DATA: INITIATIVES — 10 per assessment = 40 total
// Maximum diversity in statuses, categories, budgets, sizes
// ============================================================

type SeedInitiative = {
  id: string;
  assessmentId: string;
  reportId: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  effort: string;
  category: string;
  estimatedBudget?: number;
  estimatedTimeline?: string;
  axis?: string;
  area?: string;
};

// DRD Manufacturing — 10 initiatives (diverse statuses, sizes, budgets)
const INITIATIVES_DRD_TEST: SeedInitiative[] = [
  {
    id: 'init-drd-test-01',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-exec',
    name: 'MES Full Rollout — Line 3 Deployment & Integration',
    description:
      'Complete MES deployment on remaining production Line 3. Integrate with existing Lines 1-2 for unified OEE monitoring. Scope: hardware installation, software configuration, ERP integration, operator training, parallel run, go-live support.',
    status: 'IN_EXECUTION',
    priority: 'critical',
    impact: 'high',
    effort: 'high',
    category: 'Technology',
    estimatedBudget: 450000,
    estimatedTimeline: '12 months',
    axis: 'Digital Processes',
    area: 'Production',
  },
  {
    id: 'init-drd-test-02',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-exec',
    name: 'AI Predictive Quality System',
    description:
      'Deploy ML models for real-time quality prediction on welding and assembly lines. Use vibration, temperature, and visual inspection data. Target: 40% defect reduction. Technology: Python/TensorFlow, edge inference on NVIDIA Jetson, integration with MES quality module.',
    status: 'APPROVED',
    priority: 'high',
    impact: 'high',
    effort: 'high',
    category: 'AI/ML',
    estimatedBudget: 280000,
    estimatedTimeline: '8 months',
    axis: 'AI Maturity',
    area: 'Production',
  },
  {
    id: 'init-drd-test-03',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-exec',
    name: 'Data Governance Framework',
    description:
      'Establish enterprise data governance: data quality rules, ownership model, metadata catalog (Collibra), GDPR/NIS2 compliance. Quick win with high organizational impact.',
    status: 'PENDING_APPROVAL',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'Data',
    estimatedBudget: 120000,
    estimatedTimeline: '6 months',
    axis: 'Data Management',
    area: 'Enterprise',
  },
  {
    id: 'init-drd-test-04',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-review',
    name: 'Digital Skills Academy — Phase 1',
    description:
      'Launch digital literacy program for 200 shop floor operators and 50 team leaders. Curriculum: Industry 4.0 basics, data reading, MES usage, IoT awareness. Blended learning: 60% online (LMS), 40% hands-on workshops.',
    status: 'APPROVED',
    priority: 'medium',
    impact: 'medium',
    effort: 'medium',
    category: 'People',
    estimatedBudget: 85000,
    estimatedTimeline: '9 months',
    axis: 'Culture of Transformation',
    area: 'HR',
  },
  {
    id: 'init-drd-test-05',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-review',
    name: 'OT/IT Network Segmentation & Hardening',
    description:
      'Critical cybersecurity initiative: network segmentation between OT and IT, firewall rule optimization, IDS/IPS deployment on OT network, vulnerability scanning for SCADA/PLC systems.',
    status: 'PENDING_APPROVAL',
    priority: 'critical',
    impact: 'critical',
    effort: 'medium',
    category: 'Security',
    estimatedBudget: 195000,
    estimatedTimeline: '5 months',
    axis: 'Cybersecurity',
    area: 'Infrastructure',
  },
  {
    id: 'init-drd-test-06',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-review',
    name: 'IoT Sensor Expansion — Remaining Assets',
    description:
      'Expand IoT sensor coverage from 60% to 95% of production assets. Standardize on OPC-UA/MQTT. Deploy edge gateways for local data preprocessing. Estimated 150 new sensor points.',
    status: 'DRAFT',
    priority: 'medium',
    impact: 'medium',
    effort: 'medium',
    category: 'Technology',
    estimatedBudget: 165000,
    estimatedTimeline: '7 months',
    axis: 'Digital Processes',
    area: 'Production',
  },
  {
    id: 'init-drd-test-07',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-draft',
    name: 'Energy Management & Carbon Tracking',
    description:
      'ISO 50001-aligned energy management: real-time monitoring, anomaly detection, carbon footprint dashboard. Quick integration with existing SCADA data. Low cost, high visibility.',
    status: 'CLOSED',
    priority: 'low',
    impact: 'medium',
    effort: 'low',
    category: 'Sustainability',
    estimatedBudget: 45000,
    estimatedTimeline: '3 months',
    axis: 'Digital Processes',
    area: 'Facilities',
  },
  {
    id: 'init-drd-test-08',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-draft',
    name: 'Supply Chain Visibility Dashboard',
    description:
      'Build real-time supply chain dashboard integrating ERP, WMS, and carrier APIs. Show OTIF, lead times, inventory levels, disruption alerts. Power BI + Azure Data Factory.',
    status: 'CLOSED',
    priority: 'medium',
    impact: 'medium',
    effort: 'low',
    category: 'Operations',
    estimatedBudget: 75000,
    estimatedTimeline: '4 months',
    axis: 'Digital Processes',
    area: 'Supply Chain',
  },
  {
    id: 'init-drd-test-09',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-exec',
    name: 'Digital Twin — Pilot for Line 1',
    description:
      'Create digital twin of production Line 1 for simulation-based optimization and virtual commissioning. Technology: Siemens Xcelerator / Azure Digital Twins. Very high innovation value but also high complexity and cost.',
    status: 'PENDING_APPROVAL',
    priority: 'high',
    impact: 'high',
    effort: 'high',
    category: 'Innovation',
    estimatedBudget: 380000,
    estimatedTimeline: '14 months',
    axis: 'Digital Products',
    area: 'R&D',
  },
  {
    id: 'init-drd-test-10',
    assessmentId: 'assess-drd-manufacturing-01',
    reportId: 'report-drd-test-exec',
    name: 'MLOps Pipeline Setup',
    description:
      'Establish ML model lifecycle management: training, versioning, deployment, monitoring. Docker + Airflow + MLflow. Foundation for all future AI initiatives.',
    status: 'REJECTED',
    priority: 'medium',
    impact: 'high',
    effort: 'medium',
    category: 'AI/ML',
    estimatedBudget: 95000,
    estimatedTimeline: '4 months',
    axis: 'AI Maturity',
    area: 'IT',
  },
];

// DRD Enterprise — 10 initiatives (different mix of statuses)
const INITIATIVES_DRD_FINAL: SeedInitiative[] = [
  {
    id: 'init-drd-final-01',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-board',
    name: 'Enterprise Data Platform Modernization',
    description:
      'Migrate from legacy data warehouse to modern lakehouse architecture (Databricks/Delta Lake on Azure). Unified data platform for all BUs. Phase 1: ingest + catalog. Phase 2: analytics + ML workbench. Phase 3: real-time streaming.',
    status: 'IN_EXECUTION',
    priority: 'critical',
    impact: 'critical',
    effort: 'high',
    category: 'Data',
    estimatedBudget: 1200000,
    estimatedTimeline: '18 months',
  },
  {
    id: 'init-drd-final-02',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-board',
    name: 'AI Governance & Ethics Framework',
    description:
      'Develop AI governance policy, establish AI ethics board, implement model risk management, create AI transparency reporting. Alignment with EU AI Act requirements.',
    status: 'APPROVED',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'Compliance',
    estimatedBudget: 180000,
    estimatedTimeline: '8 months',
  },
  {
    id: 'init-drd-final-03',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-board',
    name: 'Customer 360 & CRM Enhancement',
    description:
      'Build unified customer view combining CRM, ERP, e-commerce, and support data. Deploy customer segmentation ML model. Enable personalized B2B experience.',
    status: 'APPROVED',
    priority: 'high',
    impact: 'high',
    effort: 'high',
    category: 'Strategy',
    estimatedBudget: 420000,
    estimatedTimeline: '12 months',
  },
  {
    id: 'init-drd-final-04',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-generated',
    name: 'SOC Enhancement — SIEM Full Deployment',
    description:
      'Complete SIEM deployment (Sentinel), integrate IT+OT log sources, establish detection rules, automate incident response workflows. 24/7 SOC readiness.',
    status: 'PENDING_APPROVAL',
    priority: 'critical',
    impact: 'critical',
    effort: 'high',
    category: 'Security',
    estimatedBudget: 650000,
    estimatedTimeline: '10 months',
  },
  {
    id: 'init-drd-final-05',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-generated',
    name: 'Demand Forecasting ML Enhancement',
    description:
      'Improve existing demand forecasting from MAPE 12% to <8%. Add external signal processing (weather, market, social). Deploy model monitoring and auto-retraining.',
    status: 'PENDING_APPROVAL',
    priority: 'medium',
    impact: 'high',
    effort: 'medium',
    category: 'AI/ML',
    estimatedBudget: 150000,
    estimatedTimeline: '6 months',
  },
  {
    id: 'init-drd-final-06',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-generated',
    name: 'Digital Academy — Enterprise-wide Program',
    description:
      'Company-wide digital skills program: executive digital immersion (50 leaders), manager digital toolkit (200 managers), specialist certifications (100 tech staff), basic digital literacy (4000 employees). LMS + external partnerships.',
    status: 'IN_EXECUTION',
    priority: 'medium',
    impact: 'medium',
    effort: 'high',
    category: 'People',
    estimatedBudget: 340000,
    estimatedTimeline: '24 months',
  },
  {
    id: 'init-drd-final-07',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-draft',
    name: 'B2B Marketplace International Expansion',
    description:
      'Expand e-commerce B2B marketplace from 2 to 8 EU countries. Multi-language, multi-currency, local logistics integration. Product configurator enhancement.',
    status: 'DRAFT',
    priority: 'medium',
    impact: 'high',
    effort: 'high',
    category: 'Strategy',
    estimatedBudget: 520000,
    estimatedTimeline: '15 months',
  },
  {
    id: 'init-drd-final-08',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-draft',
    name: 'Master Data Management — Product Data',
    description:
      'Extend MDM from product data to customer, supplier, and asset master data. Implement data quality scoring, automated cleansing, and cross-system synchronization.',
    status: 'CLOSED',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'Data',
    estimatedBudget: 185000,
    estimatedTimeline: '8 months',
  },
  {
    id: 'init-drd-final-09',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-board',
    name: 'Process Mining — Finance & Procurement',
    description:
      'Deploy process mining (Celonis) for finance and procurement workflows. Identify automation opportunities, bottlenecks, and compliance deviations. Small scope, big insight.',
    status: 'CLOSED',
    priority: 'low',
    impact: 'medium',
    effort: 'low',
    category: 'Operations',
    estimatedBudget: 75000,
    estimatedTimeline: '4 months',
  },
  {
    id: 'init-drd-final-10',
    assessmentId: 'assess-drd-enterprise-01',
    reportId: 'report-drd-final-board',
    name: 'Robotic Process Automation — HR & Finance',
    description:
      'Implement RPA bots for repetitive back-office tasks: invoice processing, employee onboarding documents, report generation. UiPath platform. Target: 2000 hours/year saved.',
    status: 'PENDING_APPROVAL',
    priority: 'low',
    impact: 'medium',
    effort: 'low',
    category: 'Technology',
    estimatedBudget: 65000,
    estimatedTimeline: '3 months',
  },
];

// SIRI — 10 initiatives (Industry 4.0 themed)
const INITIATIVES_SIRI: SeedInitiative[] = [
  {
    id: 'init-siri-01',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-review',
    name: 'OPC-UA Migration & Industrial Connectivity Standard',
    description:
      'Migrate all machine communication to OPC-UA standard. Replace proprietary protocols, deploy UA gateways for legacy equipment. Establish connectivity architecture standard for future expansions. Foundation for all intelligence initiatives.',
    status: 'IN_EXECUTION',
    priority: 'critical',
    impact: 'high',
    effort: 'high',
    category: 'Technology',
    estimatedBudget: 220000,
    estimatedTimeline: '10 months',
  },
  {
    id: 'init-siri-02',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-review',
    name: 'Predictive Maintenance — CNC Machines',
    description:
      'Deploy predictive maintenance on 12 CNC machines. Vibration + temperature sensors, edge ML inference, maintenance alert system integrated with CMMS. Target: 35% reduction in unplanned downtime.',
    status: 'APPROVED',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'AI/ML',
    estimatedBudget: 175000,
    estimatedTimeline: '7 months',
  },
  {
    id: 'init-siri-03',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-review',
    name: 'Real-time Analytics Platform (BI Upgrade)',
    description:
      'Replace static BI reports with real-time analytics dashboard. Stream data from MES/IoT → Azure Event Hub → Power BI Embedded. Enable self-service analytics for production managers.',
    status: 'PENDING_APPROVAL',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'Data',
    estimatedBudget: 130000,
    estimatedTimeline: '5 months',
  },
  {
    id: 'init-siri-04',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-generated',
    name: 'Operator Upskilling Program — 50 Pilot',
    description:
      'Pilot digital skills program for 50 machine operators. Curriculum: data reading, dashboard usage, basic troubleshooting with digital tools, IoT sensor understanding. Success metric: digital competency score improvement by 40%.',
    status: 'APPROVED',
    priority: 'medium',
    impact: 'medium',
    effort: 'low',
    category: 'People',
    estimatedBudget: 35000,
    estimatedTimeline: '3 months',
  },
  {
    id: 'init-siri-05',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-generated',
    name: 'Edge Computing Deployment — Plant A',
    description:
      'Deploy edge computing infrastructure (AWS Outpost / Azure Stack Edge) for local data processing. Reduce latency for real-time control applications. Enable on-premise AI inference.',
    status: 'DRAFT',
    priority: 'medium',
    impact: 'high',
    effort: 'high',
    category: 'Technology',
    estimatedBudget: 310000,
    estimatedTimeline: '8 months',
  },
  {
    id: 'init-siri-06',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-generated',
    name: 'Supplier Portal & EDI Integration',
    description:
      'Deploy supplier collaboration portal with EDI integration. Automate PO transmission, delivery scheduling, and invoice reconciliation. Cover top 20 suppliers (80% of spend).',
    status: 'PENDING_APPROVAL',
    priority: 'medium',
    impact: 'medium',
    effort: 'medium',
    category: 'Operations',
    estimatedBudget: 95000,
    estimatedTimeline: '6 months',
  },
  {
    id: 'init-siri-07',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-draft',
    name: 'Digital Leadership KPI Dashboard',
    description:
      'Build executive dashboard showing digital transformation progress: initiative status, KPI trends, investment vs actual, skills gap metrics. Monthly automated reporting to steering committee.',
    status: 'CLOSED',
    priority: 'low',
    impact: 'low',
    effort: 'low',
    category: 'Strategy',
    estimatedBudget: 25000,
    estimatedTimeline: '2 months',
  },
  {
    id: 'init-siri-08',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-draft',
    name: 'AGV Fleet Expansion & Traffic Management',
    description:
      'Expand AGV fleet from 4 to 12 units. Deploy traffic management system for multi-AGV coordination. Integrate with MES for automated material delivery scheduling.',
    status: 'PENDING_APPROVAL',
    priority: 'high',
    impact: 'high',
    effort: 'high',
    category: 'Technology',
    estimatedBudget: 480000,
    estimatedTimeline: '12 months',
  },
  {
    id: 'init-siri-09',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-review',
    name: 'PLM-MES Integration for Recipe Management',
    description:
      'Connect PLM system with MES for automated recipe/work instruction transfer. Eliminate manual data entry errors in production configuration. Critical for product changeover efficiency.',
    status: 'IN_EXECUTION',
    priority: 'medium',
    impact: 'high',
    effort: 'medium',
    category: 'Operations',
    estimatedBudget: 110000,
    estimatedTimeline: '5 months',
  },
  {
    id: 'init-siri-10',
    assessmentId: 'assess-siri-readiness-01',
    reportId: 'report-siri-review',
    name: 'Industrial WiFi 6 Network Upgrade',
    description:
      'Upgrade plant WiFi to WiFi 6 (802.11ax) for reliable IoT connectivity. Replace aging access points, deploy mesh network, QoS for industrial applications. Prerequisite for mobile HMI and AR maintenance.',
    status: 'REJECTED',
    priority: 'low',
    impact: 'medium',
    effort: 'medium',
    category: 'Technology',
    estimatedBudget: 85000,
    estimatedTimeline: '4 months',
  },
];

// ADMA — 10 initiatives (Digital Maturity themed)
const INITIATIVES_ADMA: SeedInitiative[] = [
  {
    id: 'init-adma-01',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-generated',
    name: 'Product Data Platform (PDP) — Greenfield',
    description:
      'Build centralized product data platform from scratch. Consolidate product information from ERP, PLM, and 15+ spreadsheets into single source of truth. Enable product configurator, digital catalog, and API-driven product information distribution to partners and customers. Technology: PIM (Akeneo) + MDM + API gateway.',
    status: 'DRAFT',
    priority: 'critical',
    impact: 'critical',
    effort: 'high',
    category: 'Data',
    estimatedBudget: 350000,
    estimatedTimeline: '12 months',
  },
  {
    id: 'init-adma-02',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-generated',
    name: 'OPC-UA Migration & Edge Gateway',
    description:
      'Migrate factory communications from proprietary to OPC-UA. Deploy edge gateways for protocol conversion on legacy machines. Standardize data model across both plants.',
    status: 'PENDING_APPROVAL',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'Technology',
    estimatedBudget: 145000,
    estimatedTimeline: '6 months',
  },
  {
    id: 'init-adma-03',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-generated',
    name: 'Shop Floor Analytics Dashboard',
    description:
      'Deploy real-time production KPI dashboards on shop floor displays. Replace manual SPC charts. Show OEE, cycle time, reject rate, energy consumption per line. Low cost, immediate value.',
    status: 'PENDING_APPROVAL',
    priority: 'medium',
    impact: 'medium',
    effort: 'low',
    category: 'Operations',
    estimatedBudget: 55000,
    estimatedTimeline: '3 months',
  },
  {
    id: 'init-adma-04',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-review',
    name: 'Change Management & Digital Culture Program',
    description:
      'Address middle management resistance through structured change program: leadership workshops, digital champion network (15 ambassadors), success story communication, gamified learning platform. Key enabler for all other initiatives.',
    status: 'APPROVED',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'People',
    estimatedBudget: 120000,
    estimatedTimeline: '12 months',
  },
  {
    id: 'init-adma-05',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-review',
    name: 'IoT Product Enhancement — Remote Monitoring',
    description:
      'Add IoT remote monitoring capability to premium product line. Real-time machine status, usage analytics, predictive alert for maintenance. Create basis for outcome-based service model.',
    status: 'DRAFT',
    priority: 'medium',
    impact: 'high',
    effort: 'high',
    category: 'Innovation',
    estimatedBudget: 280000,
    estimatedTimeline: '10 months',
  },
  {
    id: 'init-adma-06',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-review',
    name: 'ERP-MES Real-time Integration',
    description:
      'Establish real-time bidirectional integration between ERP and MES. Currently batch sync (overnight). Enable real-time production order management, material consumption reporting, and quality data flow.',
    status: 'APPROVED',
    priority: 'high',
    impact: 'high',
    effort: 'medium',
    category: 'Technology',
    estimatedBudget: 160000,
    estimatedTimeline: '7 months',
  },
  {
    id: 'init-adma-07',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-draft',
    name: 'Supply Chain Visibility — Phase 1',
    description:
      'Basic supply chain visibility: integrate top 10 supplier lead times, automate OTIF tracking, deploy disruption alert mechanism. Foundation for future control tower.',
    status: 'PENDING_APPROVAL',
    priority: 'medium',
    impact: 'medium',
    effort: 'low',
    category: 'Operations',
    estimatedBudget: 70000,
    estimatedTimeline: '4 months',
  },
  {
    id: 'init-adma-08',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-draft',
    name: 'Digital Strategy Cascading Workshops',
    description:
      'Series of workshops to cascade digital strategy to all BUs. Create BU-specific digital action plans aligned with corporate strategy. 8 workshops, 4 weeks, output: digital roadmap per BU.',
    status: 'CLOSED',
    priority: 'medium',
    impact: 'medium',
    effort: 'low',
    category: 'Strategy',
    estimatedBudget: 15000,
    estimatedTimeline: '2 months',
  },
  {
    id: 'init-adma-09',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-generated',
    name: 'Automated Changeover Optimization',
    description:
      'Reduce changeover time by 30% through SMED methodology + digital support tools. Tablet-guided changeover procedures, automatic parameter adjustment via MES, video analytics for process verification.',
    status: 'DRAFT',
    priority: 'low',
    impact: 'medium',
    effort: 'medium',
    category: 'Operations',
    estimatedBudget: 90000,
    estimatedTimeline: '5 months',
  },
  {
    id: 'init-adma-10',
    assessmentId: 'assess-adma-maturity-01',
    reportId: 'report-adma-generated',
    name: 'Dynamic Production Scheduling Pilot',
    description:
      'Pilot AI-based dynamic production scheduling to replace fixed weekly schedules. Optimize for multiple objectives: delivery dates, changeover minimization, energy costs, machine utilization. High complexity but transformational impact.',
    status: 'DRAFT',
    priority: 'medium',
    impact: 'high',
    effort: 'high',
    category: 'AI/ML',
    estimatedBudget: 250000,
    estimatedTimeline: '10 months',
  },
];

const ALL_INITIATIVES: SeedInitiative[] = [
  ...INITIATIVES_DRD_TEST,
  ...INITIATIVES_DRD_FINAL,
  ...INITIATIVES_SIRI,
  ...INITIATIVES_ADMA,
];

// ============================================================
// MAIN
// ============================================================

async function main() {
  log.header('═══════════════════════════════════════════════════════════');
  log.header('  Assessment Module — Full Seed');
  log.header('  4 assessments · 12 reports · 40 initiatives');
  log.header('═══════════════════════════════════════════════════════════');

  const db = await createDatabase();

  // Determine org
  let orgId = process.env.TARGET_ORG_ID || process.env.ORG_ID || '';
  if (!orgId) {
    try {
      const orgCounts = await db.query(
        `SELECT organization_id as orgId, COUNT(*) as count FROM assessments GROUP BY organization_id ORDER BY count DESC`,
        []
      );
      orgId = orgCounts?.rows?.[0]?.orgId || '';
    } catch {
      /* ignore */
    }
  }
  if (!orgId) {
    try {
      const orgRows = await db.query(`SELECT id FROM organizations LIMIT 1`, []);
      orgId = orgRows?.rows?.[0]?.id || '';
    } catch {
      /* ignore */
    }
  }
  if (!orgId) orgId = DEFAULT_ORG_ID;

  // Find user
  let userId = 'system';
  try {
    const u = await db.query(`SELECT id FROM users WHERE organization_id = ? LIMIT 1`, [orgId]);
    userId = u?.rows?.[0]?.id || userId;
  } catch {
    /* ignore */
  }
  if (userId === 'system') {
    try {
      const anyU = await db.query(`SELECT id FROM users LIMIT 1`, []);
      userId = anyU?.rows?.[0]?.id || userId;
    } catch {
      /* ignore */
    }
  }

  log.info(`Organization: ${orgId}`);
  log.info(`User: ${userId}`);

  // ---- Ensure tables ----
  log.header('Ensuring database tables exist');

  await db.query(
    `CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    project_id TEXT,
    assessment_type TEXT NOT NULL,
    name TEXT NOT NULL,
    completion_percent INTEGER DEFAULT 0,
    confidence_avg REAL DEFAULT 0,
    answers_json TEXT DEFAULT '{}',
    context_snapshot TEXT DEFAULT '{}',
    score_summary TEXT DEFAULT '{}',
    navigation_json TEXT DEFAULT '{}',
    review_requested_at TEXT,
    report_approved_at TEXT,
    approved_at TEXT,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
    []
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS assessment_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT,
    status TEXT DEFAULT 'DRAFT',
    template_id TEXT,
    builder_report_id TEXT,
    axis_data TEXT,
    executive_summary TEXT,
    detailed_analysis TEXT,
    recommendations TEXT,
    generated_by TEXT,
    generation_params TEXT,
    created_by TEXT,
    updated_by TEXT,
    approved_by TEXT,
    approved_at TEXT,
    rejected_by TEXT,
    rejected_at TEXT,
    rejection_reason TEXT,
    utilized_by TEXT,
    utilized_at TEXT,
    utilization_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
    []
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS assessment_sessions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT
  )`,
    []
  );

  // Report Builder reports table
  try {
    await db.query(
      `CREATE TABLE IF NOT EXISTS report_builder_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      source_type TEXT DEFAULT 'ASSESSMENT',
      source_id TEXT,
      source_name TEXT,
      source_framework TEXT,
      title TEXT NOT NULL,
      description TEXT,
      report_type TEXT,
      template_id TEXT,
      config_json TEXT DEFAULT '{}',
      company_context_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'DRAFT',
      created_by TEXT NOT NULL,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      generated_at TEXT,
      finalized_at TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      approved_by TEXT,
      utilized_at TEXT,
      version INTEGER DEFAULT 1,
      parent_report_id TEXT,
      pdf_path TEXT,
      pptx_path TEXT,
      generation_metadata TEXT
    )`,
      []
    );
  } catch {
    /* ignore */
  }

  // Initiatives table (matches the schema used by initiatives.routes.ts)
  try {
    await db.query(
      `CREATE TABLE IF NOT EXISTS initiatives (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      title TEXT,
      description TEXT,
      axis TEXT,
      area TEXT,
      summary TEXT,
      hypothesis TEXT,
      status TEXT DEFAULT 'DRAFT',
      priority TEXT DEFAULT 'medium',
      impact TEXT DEFAULT 'medium',
      effort TEXT DEFAULT 'medium',
      category TEXT,
      source_type TEXT DEFAULT 'manual',
      source_id TEXT,
      report_id TEXT,
      report_name TEXT,
      estimated_budget REAL,
      estimated_timeline TEXT,
      risk_level TEXT,
      charter_completeness INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
      []
    );
  } catch {
    /* ignore */
  }

  // Ensure extra columns exist (safe for SQLite — ADD COLUMN is idempotent-ish)
  const ensureCols = [
    ['initiatives', 'title', 'TEXT'],
    ['initiatives', 'description', 'TEXT'],
    ['initiatives', 'priority', "TEXT DEFAULT 'medium'"],
    ['initiatives', 'impact', "TEXT DEFAULT 'medium'"],
    ['initiatives', 'effort', "TEXT DEFAULT 'medium'"],
    ['initiatives', 'category', 'TEXT'],
    ['initiatives', 'report_name', 'TEXT'],
    ['initiatives', 'estimated_budget', 'REAL'],
    ['initiatives', 'estimated_timeline', 'TEXT'],
    ['initiatives', 'source_type', "TEXT DEFAULT 'manual'"],
    ['initiatives', 'source_id', 'TEXT'],
    ['initiatives', 'created_by', 'TEXT'],
    ['initiatives', 'updated_by', 'TEXT'],
    ['initiatives', 'charter_completeness', 'INTEGER DEFAULT 0'],
    ['initiatives', 'progress', 'INTEGER DEFAULT 0'],
    ['initiatives', 'risk_level', 'TEXT'],
    ['initiatives', 'source_report_id', 'TEXT'],
    ['initiatives', 'source_assessment_id', 'TEXT'],
  ];

  for (const [table, col, ddl] of ensureCols) {
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`, []);
      log.step(`Added column ${table}.${col}`);
    } catch {
      // Already exists — OK
    }
  }

  // ---- Purge ----
  const purge = process.argv.includes('--purge');
  if (purge) {
    log.header('Purging previous seeded data (scoped to seed IDs)');
    const assessmentIds = ASSESSMENTS.map((a) => a.id);
    const placeholders = assessmentIds.map(() => '?').join(', ');

    // Initiatives: remove by deterministic IDs
    const initIds = ALL_INITIATIVES.map((i) => i.id);
    const initPlaceholders = initIds.map(() => '?').join(', ');
    try {
      await db.query(`DELETE FROM initiatives WHERE id IN (${initPlaceholders})`, initIds);
      log.step(`Purged ${initIds.length} seeded initiatives`);
    } catch {
      /* ignore */
    }

    // Also remove by source_id linkage
    try {
      await db.query(
        `DELETE FROM initiatives WHERE organization_id = ? AND LOWER(COALESCE(source_type,'')) = 'assessment' AND source_id IN (${placeholders})`,
        [orgId, ...assessmentIds]
      );
      log.step('Purged assessment-linked initiatives');
    } catch {
      /* ignore */
    }

    // Assessment reports
    try {
      await db.query(
        `DELETE FROM assessment_reports WHERE organization_id = ? AND assessment_id IN (${placeholders})`,
        [orgId, ...assessmentIds]
      );
      log.step('Purged assessment reports');
    } catch {
      /* ignore */
    }

    // Report builder reports
    try {
      await db.query(
        `DELETE FROM report_builder_reports WHERE organization_id = ? AND UPPER(COALESCE(source_type,'')) = 'ASSESSMENT' AND source_id IN (${placeholders})`,
        [orgId, ...assessmentIds]
      );
      log.step('Purged report builder reports');
    } catch {
      /* ignore */
    }

    // Sessions
    try {
      await db.query(`DELETE FROM assessment_sessions WHERE assessment_id IN (${placeholders})`, [
        ...assessmentIds,
      ]);
      log.step('Purged assessment sessions');
    } catch {
      /* ignore */
    }

    // Assessments themselves
    try {
      await db.query(`DELETE FROM assessments WHERE id IN (${placeholders})`, [...assessmentIds]);
      log.step('Purged assessments');
    } catch {
      /* ignore */
    }
  }

  // ────────────────────────────────────────
  // Seed Assessments
  // ────────────────────────────────────────
  log.header('Seeding 4 Assessments');

  for (const a of ASSESSMENTS) {
    const now = new Date().toISOString();
    const updatedAt = isoDaysAgo(a.updatedAtDaysAgo);

    await db.query(
      `INSERT INTO assessments (
        id, organization_id, project_id, assessment_type, name, status,
        completion_percent, confidence_avg,
        answers_json, context_snapshot, score_summary, navigation_json,
        report_approved_at, approved_at,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        assessment_type = excluded.assessment_type,
        completion_percent = excluded.completion_percent,
        confidence_avg = excluded.confidence_avg,
        answers_json = excluded.answers_json,
        context_snapshot = excluded.context_snapshot,
        score_summary = excluded.score_summary,
        report_approved_at = excluded.report_approved_at,
        approved_at = excluded.approved_at,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at`,
      [
        a.id,
        orgId,
        null,
        a.assessment_type,
        a.name,
        a.status,
        a.completionPercent,
        a.confidenceAvg,
        JSON.stringify(a.answers),
        JSON.stringify(a.contextSnapshot),
        JSON.stringify(a.scoreSummary),
        JSON.stringify({ axisId: 1, areaId: '1A', level: 1 }),
        a.status === 'APPROVED' ? updatedAt : null,
        a.status === 'APPROVED' ? updatedAt : null,
        userId,
        userId,
        now,
        updatedAt,
      ]
    );

    // Session for dynamic submenu
    try {
      await db.query(
        `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at, closed_at)
         VALUES (?, ?, ?, ?, NULL) ON CONFLICT(id) DO NOTHING`,
        [`sess-${a.id}`, a.id, userId, updatedAt]
      );
    } catch {
      /* ignore */
    }

    const statusIcon = a.status === 'APPROVED' ? '✅' : '📝';
    log.step(`${statusIcon} ${a.assessment_type} [${a.status}]: ${a.name}`);
  }
  log.success(`${ASSESSMENTS.length} assessments seeded`);

  // ────────────────────────────────────────
  // Seed Reports
  // ────────────────────────────────────────
  log.header('Seeding 12 Reports (3 per assessment)');

  // Detect report builder schema
  let rbReportCols: Set<string> | null = null;
  try {
    const info = await db.query(`PRAGMA table_info(report_builder_reports)`, []);
    rbReportCols = new Set((info?.rows || []).map((r: any) => String(r.name)));
  } catch {
    rbReportCols = null;
  }

  // assessment_reports has UNIQUE(assessment_id), so only 1 legacy report per assessment.
  // We pick the highest-status report per assessment for the legacy table.
  const statusRank: Record<string, number> = {
    DRAFT: 0,
    CONFIGURING: 1,
    FINAL: 2,
    PENDING_APPROVAL: 3,
    APPROVED: 4,
    UTILIZED: 5,
  };
  const bestReportPerAssessment = new Map<string, SeedReport>();
  for (const r of REPORTS) {
    const existing = bestReportPerAssessment.get(r.assessmentId);
    if (!existing || (statusRank[r.status] ?? 0) > (statusRank[existing.status] ?? 0)) {
      bestReportPerAssessment.set(r.assessmentId, r);
    }
  }

  // Insert legacy assessment_reports (1 per assessment)
  for (const [, r] of bestReportPerAssessment) {
    const updatedAt = isoDaysAgo(r.updatedAtDaysAgo);
    const createdAt = isoDaysAgo(r.updatedAtDaysAgo + 3);
    const utilizedAt = r.status === 'UTILIZED' ? updatedAt : null;

    await db.query(
      `INSERT INTO assessment_reports (
        id, assessment_id, organization_id, name, status, template_id, builder_report_id,
        executive_summary, recommendations,
        approved_by, approved_at,
        utilized_by, utilized_at, utilization_notes,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(assessment_id) DO UPDATE SET
        id = excluded.id,
        name = excluded.name,
        status = excluded.status,
        builder_report_id = excluded.builder_report_id,
        executive_summary = excluded.executive_summary,
        recommendations = excluded.recommendations,
        approved_by = excluded.approved_by,
        approved_at = excluded.approved_at,
        utilized_by = excluded.utilized_by,
        utilized_at = excluded.utilized_at,
        utilization_notes = excluded.utilization_notes,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at`,
      [
        r.id,
        r.assessmentId,
        orgId,
        r.title,
        r.status,
        r.templateType,
        r.id,
        r.contentJson.executiveSummary || '',
        JSON.stringify(r.contentJson.sections || []),
        ['APPROVED', 'UTILIZED'].includes(r.status) ? userId : null,
        ['APPROVED', 'UTILIZED'].includes(r.status) ? updatedAt : null,
        r.status === 'UTILIZED' ? userId : null,
        utilizedAt,
        r.contentJson.utilizationNotes || null,
        userId,
        userId,
        createdAt,
        updatedAt,
      ]
    );
    log.step(`Legacy assessment_report: ${r.title} [${r.status}]`);
  }

  // Insert ALL 12 reports into report_builder_reports (no unique constraint on source_id)
  for (const r of REPORTS) {
    const updatedAt = isoDaysAgo(r.updatedAtDaysAgo);
    const createdAt = isoDaysAgo(r.updatedAtDaysAgo + 3);

    // Report builder report
    try {
      const assessment = ASSESSMENTS.find((a) => a.id === r.assessmentId);
      const sourceName = assessment?.name || 'Assessment';
      const sourceFramework = assessment?.assessment_type || 'DRD';
      const reportType = `ASSESSMENT_${String(sourceFramework).toUpperCase()}`;

      const cols = rbReportCols;
      const has = (c: string) => (cols ? cols.has(c) : true);

      const insertCols: string[] = [];
      const insertVals: any[] = [];
      const push = (col: string, val: any) => {
        if (!has(col)) return;
        insertCols.push(col);
        insertVals.push(val);
      };

      push('id', r.id);
      push('organization_id', orgId);
      push('project_id', null);
      push('source_type', 'ASSESSMENT');
      push('source_id', r.assessmentId);
      push('source_name', sourceName);
      push('source_framework', sourceFramework);
      push('title', r.title);
      push('description', r.description);
      push('report_type', reportType);
      push('template_id', r.templateType);
      push(
        'config_json',
        JSON.stringify({
          description: r.description,
          pageCount: r.contentJson.pageCount,
          orientation: r.contentJson.orientation,
          hasCharts: r.contentJson.hasCharts,
          chartCount: r.contentJson.chartCount || 0,
          tableCount: r.contentJson.tableCount || 0,
          heatmapCount: r.contentJson.heatmapCount || 0,
          seeded: true,
        })
      );
      push('company_context_json', JSON.stringify({ seeded: true }));
      push('status', r.rbStatus);
      push('created_by', userId);
      push('created_at', createdAt);
      push('updated_at', updatedAt);
      push('updated_by', userId);
      push('version', 1);
      push('approved_at', ['APPROVED', 'UTILIZED'].includes(r.rbStatus) ? updatedAt : null);
      push('approved_by', ['APPROVED', 'UTILIZED'].includes(r.rbStatus) ? userId : null);
      push('utilized_at', r.rbStatus === 'UTILIZED' ? updatedAt : null);

      const placeholders = insertCols.map(() => '?').join(', ');
      const updateCols = [
        'title',
        'description',
        'status',
        'config_json',
        'updated_by',
        'updated_at',
        'approved_at',
        'approved_by',
        'utilized_at',
      ]
        .filter((c) => has(c))
        .map((c) => `${c} = excluded.${c}`)
        .join(', ');

      await db.query(
        `INSERT INTO report_builder_reports (${insertCols.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updateCols}`,
        insertVals
      );
    } catch {
      /* ignore — table may not exist */
    }

    const statusEmoji: Record<string, string> = {
      DRAFT: '📝',
      CONFIGURING: '⚙️',
      GENERATED: '🤖',
      IN_REVIEW: '👀',
      APPROVED: '✅',
      UTILIZED: '📤',
      FINAL: '🤖',
      PENDING_APPROVAL: '👀',
    };
    log.step(
      `${statusEmoji[r.status] || '•'} [${r.status}] ${r.contentJson.pageCount}pg: ${r.title}`
    );
  }
  log.success(`${REPORTS.length} reports seeded`);

  // ────────────────────────────────────────
  // Seed Initiatives
  // ────────────────────────────────────────
  log.header('Seeding 40 Initiatives (10 per assessment)');

  // Charter completeness and progress by status
  const statusMeta: Record<string, { charterCompleteness: number; progress: number }> = {
    DRAFT: { charterCompleteness: 15, progress: 0 },
    REVIEW: { charterCompleteness: 60, progress: 0 },
    PROMOTED: { charterCompleteness: 70, progress: 5 },
    PLANNING: { charterCompleteness: 80, progress: 10 },
    APPROVED: { charterCompleteness: 90, progress: 15 },
    SCHEDULED: { charterCompleteness: 95, progress: 20 },
    EXECUTING: { charterCompleteness: 100, progress: 45 },
    BLOCKED: { charterCompleteness: 100, progress: 35 },
    DONE: { charterCompleteness: 100, progress: 100 },
    TRACKING: { charterCompleteness: 100, progress: 100 },
    CANCELLED: { charterCompleteness: 50, progress: 0 },
  };

  for (const init of ALL_INITIATIVES) {
    const updatedAt = isoDaysAgo(Math.floor(Math.random() * 14));
    const createdAt = isoDaysAgo(Math.floor(Math.random() * 30) + 14);
    const report = REPORTS.find((r) => r.id === init.reportId);
    const meta = statusMeta[init.status] || { charterCompleteness: 0, progress: 0 };

    try {
      await db.query(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, title, description,
          status, priority, impact, effort, category,
          axis, area,
          source_type, source_id, source_assessment_id,
          report_id, report_name, source_report_id,
          estimated_budget, estimated_timeline, risk_level,
          charter_completeness, progress,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          title = excluded.title,
          description = excluded.description,
          status = excluded.status,
          priority = excluded.priority,
          impact = excluded.impact,
          effort = excluded.effort,
          category = excluded.category,
          axis = excluded.axis,
          area = excluded.area,
          source_id = excluded.source_id,
          source_assessment_id = excluded.source_assessment_id,
          report_id = excluded.report_id,
          report_name = excluded.report_name,
          source_report_id = excluded.source_report_id,
          estimated_budget = excluded.estimated_budget,
          estimated_timeline = excluded.estimated_timeline,
          risk_level = excluded.risk_level,
          charter_completeness = excluded.charter_completeness,
          progress = excluded.progress,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at`,
        [
          init.id,
          orgId,
          null,
          init.name,
          init.name,
          init.description,
          init.status,
          init.priority,
          init.impact,
          init.effort,
          init.category,
          init.axis || null,
          init.area || null,
          'assessment',
          init.assessmentId,
          init.assessmentId,
          init.reportId,
          report?.title || null,
          init.reportId,
          init.estimatedBudget || null,
          init.estimatedTimeline || null,
          init.priority === 'critical' ? 'high' : init.priority === 'high' ? 'medium' : 'low',
          meta.charterCompleteness,
          meta.progress,
          userId,
          userId,
          createdAt,
          updatedAt,
        ]
      );
    } catch (e: any) {
      log.warn(`Initiative ${init.id}: ${e?.message || 'failed'}`);
    }

    const statusEmoji: Record<string, string> = {
      DRAFT: '📝',
      REVIEW: '👀',
      PROMOTED: '⬆️',
      PLANNING: '📋',
      APPROVED: '✅',
      SCHEDULED: '📅',
      EXECUTING: '🔧',
      BLOCKED: '🚫',
      DONE: '✔️',
      TRACKING: '📊',
      CANCELLED: '❌',
    };
    log.step(
      `${statusEmoji[init.status] || '•'} [${init.status}] ${init.priority.toUpperCase()} €${((init.estimatedBudget || 0) / 1000).toFixed(0)}k: ${init.name}`
    );
  }
  log.success(`${ALL_INITIATIVES.length} initiatives seeded`);

  // ────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────
  log.header('═══════════════════════════════════════════════════════════');
  log.header('  Seed Complete!');
  log.header('═══════════════════════════════════════════════════════════');

  const statusCounts = (items: { status: string }[], statuses: string[]) =>
    statuses.map((s) => `${items.filter((i) => i.status === s).length} ${s}`).join(', ');

  log.info(`Assessments: ${ASSESSMENTS.length}`);
  log.info(`  ${statusCounts(ASSESSMENTS, ['APPROVED', 'DRAFT'])}`);
  log.info(`  Types: ${[...new Set(ASSESSMENTS.map((a) => a.assessment_type))].join(', ')}`);

  log.info(`Reports: ${REPORTS.length}`);
  log.info(
    `  ${statusCounts(REPORTS, ['DRAFT', 'FINAL', 'PENDING_APPROVAL', 'APPROVED', 'UTILIZED'])}`
  );
  log.info(
    `  Pages: ${Math.min(...REPORTS.map((r) => r.contentJson.pageCount))}–${Math.max(...REPORTS.map((r) => r.contentJson.pageCount))}`
  );
  log.info(`  Templates: ${[...new Set(REPORTS.map((r) => r.templateType))].join(', ')}`);

  log.info(`Initiatives: ${ALL_INITIATIVES.length}`);
  log.info(
    `  ${statusCounts(ALL_INITIATIVES, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION', 'CLOSED', 'REJECTED'])}`
  );
  log.info(
    `  Budgets: €${Math.min(...ALL_INITIATIVES.map((i) => i.estimatedBudget || 0)) / 1000}k–€${Math.max(...ALL_INITIATIVES.map((i) => i.estimatedBudget || 0)) / 1000}k`
  );
  log.info(`  Categories: ${[...new Set(ALL_INITIATIVES.map((i) => i.category))].join(', ')}`);
  log.info(`  Priorities: ${[...new Set(ALL_INITIATIVES.map((i) => i.priority))].join(', ')}`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
