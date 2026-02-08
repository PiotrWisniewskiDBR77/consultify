#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Report Instance Seeder — 8 Professional Assessment Reports (2 per assessment)
 * ══════════════════════════════════════════════════════════════════════════════
 * Creates 8 report_builder_reports + 8 assessment_reports linking them.
 *
 * Reports:
 *   DRD Manufacturing: 1. Full Diagnostic (APPROVED) + 2. Executive One-Pager (GENERATED)
 *   DRD Enterprise:    3. Board Presentation (APPROVED) + 4. Strategic Roadmap (IN_REVIEW)
 *   SIRI:              5. Full Report (APPROVED) + 6. Action Plan (IN_REVIEW)
 *   ADMA:              7. Deep Dive (GENERATED) + 8. Quick Brief (DRAFT)
 *
 * Usage:
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-report-instances.ts
 */

import { createDatabase } from '../src/database/Database.js';

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

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const ORG_ID = 'org-dbr77-system';

type SectionDef = {
  key: string;
  type: string;
  title: string;
  order: number;
  enabled: boolean;
  required: boolean;
  length: string;
  language: string;
  content: string;
  repeatFor?: string;
  repeatKey?: string;
};

type ReportDef = {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  sourceFramework: string;
  title: string;
  description: string;
  reportType: string;
  templateId: string;
  status: string;
  generatedDaysAgo: number;
  approvedDaysAgo?: number;
  sections: SectionDef[];
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 1: DRD Full Diagnostic → Manufacturing (4.1/5.5)
// ═══════════════════════════════════════════════════════════════════════
const R1: ReportDef = {
  id: 'rpt-drd-full-manufacturing',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-drd-manufacturing-01',
  sourceName: 'DRD — Testowy (Manufacturing)',
  sourceFramework: 'DRD',
  title: 'DRD Full Diagnostic Report — Manufacturing Division',
  description: 'Comprehensive diagnostic covering all 7 transformation axes.',
  reportType: 'ASSESSMENT_DRD',
  templateId: 'tpl-drd-full-diagnostic-v3',
  status: 'APPROVED',
  generatedDaysAgo: 5,
  approvedDaysAgo: 2,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover Page',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'business',
      content: `# Digital Readiness Diagnosis\n## Full Diagnostic Report\n\n**Organization:** DBR77 — Manufacturing Division\n**Assessment:** DRD — Testowy (Manufacturing)\n**Framework:** Digital Readiness Diagnosis (DRD)\n**Date:** February 2026\n**Version:** 1.0\n**Classification:** Confidential\n\n---\n\n*Prepared by the Digital Transformation Advisory Team*\n*Based on the Digital Pathfinder methodology by Dr. Piotr Wisniewski*`,
    },

    {
      key: 'executive_summary',
      type: 'summary',
      title: 'Executive Summary',
      order: 1,
      enabled: true,
      required: true,
      length: 'long',
      language: 'executive',
      content: `## Executive Summary\n\nThis Digital Readiness Diagnosis was conducted for DBR77's Manufacturing Division encompassing 3 production plants, 1,200 employees, and business units spanning Production, Sales, and Supply Chain.\n\n### Overall Assessment\n\nThe Manufacturing Division achieved an **overall maturity score of 4.1 out of 7.0** (target: 5.5), representing a **gap of 1.4 points (25%)**. This positions the organization at the **"Managed & Measured"** level.\n\n### Key Findings\n\n**Strongest Axes:**\n- **Digital Products (5.0/7)** — Strong IoT integration on key product lines\n- **Data Management (4.2/7)** — Functional data warehouse with Power BI analytics\n- **Cybersecurity (4.0/5)** — Solid OT firewall infrastructure\n\n**Weakest Axes:**\n- **AI Maturity (2.0/5)** — Critical gap; AI pilot shows promise (30% defect reduction) but lacks MLOps\n- **Culture of Transformation (2.9/5)** — Digital literacy for only 200 of 1,200 employees\n- **Digital Business Models (3.1/5)** — E-commerce and platform strategies nascent\n\n### Critical Gaps\n\n| Gap | Current | Target | Delta | Business Impact |\n|-----|---------|--------|-------|-----------------|\n| AI Maturity | 2.0 | 5.0 | -3.0 (60%) | Missing €400K+ annual savings |\n| Culture | 2.9 | 5.0 | -2.1 (42%) | 83% workforce lacks digital skills |\n| Business Models | 3.1 | 5.0 | -1.9 (38%) | Missing 8-12% digital revenue |\n\n**Recommended total transformation investment: €2.8M over 18 months. Expected 3-year ROI: 185%.**`,
    },

    {
      key: 'methodology',
      type: 'methodology',
      title: 'Assessment Methodology & Framework',
      order: 2,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Assessment Methodology & Framework\n\n### The DRD Framework\n\nBased on the **Digital Pathfinder** methodology — comprehensive assessment across 7 interconnected transformation axes.\n\n### 7 Axes of Digital Transformation\n\n| # | Axis | Areas | Scale | Focus |\n|---|------|-------|-------|-------|\n| 1 | Digital Processes | 9 | 1-7 | End-to-end process digitization |\n| 2 | Digital Products & Services | 5 | 1-5 | Product portfolio digitization |\n| 3 | Digital Business Models | 5 | 1-5 | Revenue model innovation |\n| 4 | Data Management & Analytics | 5 | 1-7 | Data governance and analytics |\n| 5 | Culture of Transformation | 5 | 1-5 | Leadership and change readiness |\n| 6 | Cybersecurity & Risk | 5 | 1-5 | Security posture and compliance |\n| 7 | AI & ML Maturity | 5 | 1-5 | AI readiness and governance |\n\n**Total areas assessed: 39 | Completion: 100% | Confidence: 3.8/5.0**`,
    },

    {
      key: 'overall_maturity',
      type: 'matrix',
      title: 'Overall Maturity Overview',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Overall Maturity Overview\n\n### Composite Score: **4.1 / 7.0** (59%) | Target: 5.5 | Gap: 1.4\n\n| Axis | Score | Target | Gap | Gap % | Status |\n|------|-------|--------|-----|-------|--------|\n| 1. Digital Processes | 3.8 | 5.5 | 1.7 | 31% | Watch |\n| 2. Digital Products | 5.0 | 6.0 | 1.0 | 17% | Strong |\n| 3. Business Models | 3.1 | 5.0 | 1.9 | 38% | Critical |\n| 4. Data Management | 4.2 | 6.0 | 1.8 | 30% | Watch |\n| 5. Culture | 2.9 | 5.0 | 2.1 | 42% | Critical |\n| 6. Cybersecurity | 4.0 | 5.0 | 1.0 | 20% | On Track |\n| 7. AI Maturity | 2.0 | 5.0 | 3.0 | 60% | Critical |\n\nThe Manufacturing Division displays a **"Technology-Strong, People-Weak"** profile. Three axes exceed 40% gap (Critical): AI Maturity, Culture, and Business Models.\n\n### Key Insight\n\nThe gap between Data Management (4.2) and AI Maturity (2.0) reveals a critical disconnect — the organization collects data but lacks capabilities to convert it into AI-driven value.`,
    },

    {
      key: 'axis_1_processes',
      type: 'axis_analysis',
      title: 'Axis 1: Digital Processes',
      order: 10,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '1',
      content: `## Axis 1: Digital Processes\n\n**Score: 3.8 / 7.0** | Target: 5.5 | Gap: 1.7 (31%)\n\n### Area Breakdown\n\n| Area | Score | Key Observation |\n|------|-------|-----------------|\n| 1A Sales | 3 | CRM deployed, ERP integration planned for Q2 |\n| 1B Marketing | 4 | Digital marketing tools operational |\n| 1C R&D/Technology | 5 | Strong digital R&D, PLM integrated |\n| 1D Procurement | 3 | MRP operational but approvals partly email-based |\n| 1E Logistics | 4 | WMS planning underway, barcode tracking |\n| 1F Production | 5 | MES on 2/3 lines, real-time OEE |\n| 1G Quality | 3 | Quality in MES module, predictive quality in pilot |\n| 1H Finance | 4 | ERP-based processes, basic automation |\n| 1I HR | 5 | HR digitized, onboarding automated |\n\n### Critical Gaps\n- MES Line 3 — third line operates without MES (33% blind spot)\n- Procurement — manual email approvals create 2-3 day delays\n- Cross-system integration — CRM-MES-WMS data flows not automated\n\n### Quick Wins\n1. Complete MES Line 3 scoping\n2. Digitize procurement approvals (€5K, 2 weeks)\n3. CRM-ERP data sync automation`,
    },

    {
      key: 'axis_2_products',
      type: 'axis_analysis',
      title: 'Axis 2: Digital Products & Services',
      order: 11,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '2',
      content: `## Axis 2: Digital Products & Services\n\n**Score: 5.0 / 7.0** | Target: 6.0 | Gap: 1.0 (17%) | Status: Strong\n\n### Key Strengths\n- IoT integration on flagship product line with remote monitoring\n- Digital product configurator deployed for sales\n- R&D team exploring digital twin for product development\n\n### Gaps & Opportunities\n- Premium IoT features only on top-tier products\n- Predictive service models not yet developed\n- Customer self-service portal limited to top 20 clients\n\n### Recommendations\n1. Extend IoT to mid-range products — 15% revenue uplift\n2. Launch predictive service offering\n3. Unified product data platform for multi-channel distribution`,
    },

    {
      key: 'axis_3_business',
      type: 'axis_analysis',
      title: 'Axis 3: Digital Business Models',
      order: 12,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '3',
      content: `## Axis 3: Digital Business Models\n\n**Score: 3.1 / 5.0** | Target: 5.0 | Gap: 1.9 (38%) | Status: Critical\n\n### Current State\nBasic digital business model awareness but limited execution. No B2B e-commerce, no platform strategy, no data monetization.\n\n### Strategic Opportunities\n1. **B2B E-commerce platform** — online ordering for standard products\n2. **Product-as-a-Service pilot** — recurring revenue model\n3. **Data monetization** — anonymized operational data as benchmarking insights\n\n### Implementation Path\n- Phase 1 (Q2): E-commerce MVP\n- Phase 2 (Q4): Product-as-a-Service pilot with 3 customers\n- Phase 3 (2027): Data services and marketplace`,
    },

    {
      key: 'axis_4_data',
      type: 'axis_analysis',
      title: 'Axis 4: Data Management & Analytics',
      order: 13,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '4',
      content: `## Axis 4: Data Management & Analytics\n\n**Score: 4.2 / 7.0** | Target: 6.0 | Gap: 1.8 (30%)\n\n### Key Findings\n- Data warehouse operational with Power BI dashboards\n- **No data governance framework** — ownership, quality rules not formalized\n- Data quality inconsistent between Plants 1-3\n- No data catalog or metadata management\n- Analytics limited to descriptive — no predictive or prescriptive\n\n### Critical Gap: Governance\nAbsence of data governance is the **single biggest blocker** for AI initiatives. Without consistent quality, model training produces unreliable results.\n\n### Recommendations\n1. Data Governance Framework — €120K, 6 months\n2. Data Catalog — €80K, 4 months\n3. Data Quality Program — automated monitoring across locations\n4. Analytics Platform Upgrade — from descriptive to predictive`,
    },

    {
      key: 'axis_5_culture',
      type: 'axis_analysis',
      title: 'Axis 5: Culture & Competencies',
      order: 14,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '5',
      content: `## Axis 5: Organizational Culture & Competencies\n\n**Score: 2.9 / 5.0** | Target: 5.0 | Gap: 2.1 (42%) | Status: Critical\n\n### Key Findings\n- Change management in planning phase only\n- Digital literacy training completed for 200/1,200 employees (17%)\n- No digital academy or continuous learning platform\n- Middle management engagement mixed\n\n### Why This Matters\nCulture is the **#1 predictor of transformation success**. Organizations with strong cultural readiness achieve 2.5x higher ROI on technology investments.\n\n### Recommendations\n1. Digital Skills Academy Phase 1 — 200 operators + 50 leads (€85K, 9 months)\n2. Change Champion Network — 15 digital champions\n3. Innovation Lab — safe space for experimentation\n4. Leadership Digital Immersion — top 30 managers`,
    },

    {
      key: 'axis_6_security',
      type: 'axis_analysis',
      title: 'Axis 6: Cybersecurity & Risk',
      order: 15,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '6',
      content: `## Axis 6: Cybersecurity & Risk Management\n\n**Score: 4.0 / 5.0** | Target: 5.0 | Gap: 1.0 (20%) | Status: On Track\n\nOT firewalls deployed, IT security policies enforced, annual awareness training. However:\n- **OT/IT network segmentation incomplete** — critical vulnerability\n- No IDS/IPS on OT network\n- Cybersecurity audit planned for Q2 but not yet conducted\n\n### Urgent: OT/IT Segmentation\nLack of proper segmentation = highest-risk finding. Estimated impact: **€200-500K per day** of production downtime from breach.\n\n### Recommendations\n1. OT/IT Network Segmentation & Hardening — €195K, 5 months\n2. IDS/IPS Deployment on OT network\n3. Accelerate cybersecurity audit\n4. NIS2 Compliance Assessment`,
    },

    {
      key: 'axis_7_ai',
      type: 'axis_analysis',
      title: 'Axis 7: AI & ML Maturity',
      order: 16,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      repeatFor: 'axis',
      repeatKey: '7',
      content: `## Axis 7: AI & Machine Learning Maturity\n\n**Score: 2.0 / 5.0** | Target: 5.0 | Gap: 3.0 (60%) | Status: Critical\n\n### Key Findings\n- AI pilot on Line 2: predictive quality — **30% defect reduction**\n- **No MLOps pipeline** — manual deployment, no versioning\n- **No AI governance** — no EU AI Act readiness\n- AI competencies limited to 2-3 individuals\n\n### AI Adoption Roadmap\n\n**Phase 1 (0-6 months):** MLOps pipeline + AI governance + data quality\n**Phase 2 (6-12 months):** Extend predictive quality to all lines + PM PoC\n**Phase 3 (12-24 months):** Production optimization AI + autonomous quality\n\n**Investment: €375K / 24 months | Expected annual value: €800K+**`,
    },

    {
      key: 'gap_analysis',
      type: 'recommendations',
      title: 'Strategic Gap Analysis',
      order: 50,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Strategic Gap Analysis & Priority Matrix\n\n### Top 5 Strategic Priorities\n\n| # | Initiative | Investment | Timeline | Expected Impact | Confidence |\n|---|-----------|-----------|----------|----------------|------------|\n| 1 | Data Governance + MLOps Foundation | €215K | 6 months | Enables all AI initiatives, €800K+ annual | High |\n| 2 | OT/IT Security Hardening | €195K | 5 months | Eliminates €200-500K/day risk exposure | High |\n| 3 | MES Line 3 Deployment | €450K | 12 months | 33% production visibility gap closed | High |\n| 4 | Digital Skills Academy | €85K | 9 months | 83% workforce digital literacy gap | Medium |\n| 5 | AI Predictive Quality Scale-up | €280K | 8 months | 40% defect reduction across all lines | Medium |\n\n### Cross-Axis Dependencies\n\n    Data Governance (Axis 4) ──────> AI Maturity (Axis 7)\n           |                              |\n           v                              v\n      Analytics Platform ──────> Predictive Quality\n           |\n           v\n    Culture & Skills (Axis 5) ──> Adoption & Scaling\n\n### Cost of Inaction (12-24 months)\n- Competitive risk: 15-20% productivity gap widens\n- Regulatory risk: NIS2 fines up to €10M\n- Operational risk: €200-500K/day security exposure\n- Talent risk: digital-skilled employees leave`,
    },

    {
      key: 'roadmap',
      type: 'action_plan',
      title: 'Transformation Roadmap',
      order: 60,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Transformation Roadmap\n\n### Phase 1: Quick Wins (0-3 months) | €265K\n\n| # | Initiative | Owner | Budget | Success Metric |\n|---|-----------|-------|--------|----------------|\n| 1 | Data Governance Framework | CDO | €120K | Charter approved, 5 stewards |\n| 2 | OT/IT segmentation design | CISO | €50K | Architecture documented |\n| 3 | Procurement digitization | COO | €5K | 100% digital approvals |\n| 4 | CRM-ERP data sync | CIO | €15K | Zero manual re-entry |\n| 5 | Energy monitoring | Plant Mgr | €45K | Real-time visibility |\n| 6 | AI governance draft | CDO | €30K | EU AI Act assessment |\n\n### Phase 2: Foundation (3-12 months) | €1.1M\n\n| # | Initiative | Owner | Budget | Success Metric |\n|---|-----------|-------|--------|----------------|\n| 1 | MES Line 3 | COO | €450K | MES live all 3 lines |\n| 2 | OT/IT segmentation | CISO | €195K | Full segmentation + IDS |\n| 3 | MLOps pipeline | CTO | €95K | Automated deployment |\n| 4 | Digital Skills Academy | CHRO | €85K | 250 employees trained |\n| 5 | Data catalog | CDO | €80K | 90% assets cataloged |\n| 6 | SC visibility dashboard | SCM Dir | €75K | Real-time OTIF |\n\n### Phase 3: Strategic (12-36 months) | €1.4M\n\n| # | Initiative | Budget | Success Metric |\n|---|-----------|--------|----------------|\n| 1 | AI Predictive Quality | €280K | 40% defect reduction |\n| 2 | B2B e-commerce | €350K | 20% orders online |\n| 3 | Digital Twin pilot | €380K | Virtual commissioning |\n| 4 | Predictive maintenance | €175K | 35% downtime reduction |\n| 5 | Advanced analytics | €215K | 50 self-service users |\n\n**Total: €2.77M / 36 months | ROI at 36 months: €5.1M (185%)**`,
    },

    {
      key: 'appendix',
      type: 'appendix',
      title: 'Appendix',
      order: 100,
      enabled: false,
      required: false,
      length: 'long',
      language: 'technical',
      content: `## Appendix: Detailed Scores\n\n| Area | Axis | Achieved | Target | Gap |\n|------|------|----------|--------|-----|\n| 1A Sales | Processes | 3 | 6 | 3 |\n| 1B Marketing | Processes | 4 | 6 | 2 |\n| 1C R&D | Processes | 5 | 6 | 1 |\n| 1D Procurement | Processes | 3 | 6 | 3 |\n| 1E Logistics | Processes | 4 | 6 | 2 |\n| 1F Production | Processes | 5 | 6 | 1 |\n| 1G Quality | Processes | 3 | 6 | 3 |\n| 1H Finance | Processes | 4 | 6 | 2 |\n| 1I HR | Processes | 5 | 6 | 1 |\n\n**Assessment Date:** Q1 2026 | **Scope:** 3 plants, 1,200 employees | **Confidence:** 3.8/5.0`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 2: DRD Executive One-Pager → Manufacturing
// ═══════════════════════════════════════════════════════════════════════
const R2: ReportDef = {
  id: 'rpt-drd-brief-manufacturing',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-drd-manufacturing-01',
  sourceName: 'DRD — Testowy (Manufacturing)',
  sourceFramework: 'DRD',
  title: 'DRD Executive One-Pager — Manufacturing Division',
  description: 'Ultra-concise strategic brief for the Manufacturing DRD assessment.',
  reportType: 'ASSESSMENT_DRD',
  templateId: 'tpl-drd-executive-brief-v3',
  status: 'GENERATED',
  generatedDaysAgo: 3,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `# Digital Readiness — Executive Brief\n\n**DBR77 Manufacturing Division** | February 2026 | Confidential`,
    },
    {
      key: 'at_a_glance',
      type: 'scorecard',
      title: 'Assessment at a Glance',
      order: 1,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Assessment at a Glance\n\n### Overall Score: **4.1 / 7.0** (59%)\n\n| Axis | Score | Target | Verdict |\n|------|-------|--------|--------|\n| Digital Processes | 3.8 | 5.5 | Developing |\n| Digital Products | 5.0 | 6.0 | Strong |\n| Business Models | 3.1 | 5.0 | Critical |\n| Data Management | 4.2 | 6.0 | Developing |\n| Culture & Skills | 2.9 | 5.0 | Critical |\n| Cybersecurity | 4.0 | 5.0 | On Track |\n| AI Maturity | 2.0 | 5.0 | Critical |\n\n**Biggest gap:** AI Maturity (60% below target)\n**Strongest axis:** Digital Products (5.0)\n**Investment to close top 3 gaps:** ~€680K`,
    },
    {
      key: 'top_findings',
      type: 'key_messages',
      title: 'Top 5 Findings',
      order: 2,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Top 5 Findings\n\n**Product digitization leads the pack** — IoT integration and digital configurator position us well for smart product offerings.\n\n**Production MES drives real-time visibility** — OEE tracking on 2/3 lines delivers data-driven management.\n\n**AI maturity is a 60% gap** — Promising pilot (30% defect reduction) but no pipeline to scale. €800K+ left on table.\n\n**83% of workforce lacks digital skills** — Only 200 of 1,200 employees trained. This will bottleneck every initiative.\n\n**OT/IT security gap creates €200-500K/day risk** — Network segmentation incomplete. A single breach could halt production.`,
    },
    {
      key: 'investment_case',
      type: 'recommendations',
      title: 'Investment Case',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Investment Case\n\n**Total: €2.5M – €3.0M over 24 months**\n\n| Priority | Initiative | Budget | Timeline | Impact |\n|----------|-----------|--------|----------|--------|\n| 1 | Data Governance + MLOps | €215K | 6 months | Enables AI; €800K annual |\n| 2 | OT/IT Security | €195K | 5 months | Eliminates €200-500K/day risk |\n| 3 | MES Line 3 + Integration | €450K | 12 months | 100% production visibility |\n\n### Expected 3-Year Returns\n- Cost savings: €2.4M (quality, downtime, energy)\n- Revenue uplift: €1.8M (digital products, e-commerce)\n- Risk reduction: €3.0M+ (security, compliance)`,
    },
    {
      key: 'risks',
      type: 'consulting_risks_register',
      title: 'Key Risks',
      order: 4,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Key Risks\n\n| Risk | Probability | Impact | Mitigation |\n|------|------------|--------|------------|\n| AI talent shortage | High | High | University partnership, hire 2 ML engineers |\n| OT/IT project overruns | Medium | Critical | Phase approach, external consultancy |\n| Change resistance | High | Medium | Champion network, visible quick wins |\n| Budget pressure | Medium | High | Phase-gated, ROI milestones |\n| Regulatory (NIS2) | Medium | High | Start compliance assessment immediately |`,
    },
    {
      key: 'next_steps',
      type: 'next_steps',
      title: 'Recommended Next Steps',
      order: 5,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Recommended Next Steps\n\n1. **APPROVE** — Phase 1 budget (€265K) this month\n2. **FUND** — Reserve €1.1M for Phase 2 in H1 budget\n3. **MEET** — Planning workshop with COO, CTO, CISO, CHRO — next 2 weeks\n\n*Detailed 42-page diagnostic report available upon request.*`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 3: DRD Board Presentation → Enterprise (5.5/7.0)
// ═══════════════════════════════════════════════════════════════════════
const R3: ReportDef = {
  id: 'rpt-drd-board-enterprise',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-drd-enterprise-01',
  sourceName: 'DRD — Finalny (Enterprise)',
  sourceFramework: 'DRD',
  title: 'DRD Board Presentation — Enterprise Digital Transformation',
  description:
    'C-suite presentation summarizing enterprise DRD assessment with strategic decisions.',
  reportType: 'ASSESSMENT_DRD',
  templateId: 'tpl-drd-presentation-v3',
  status: 'APPROVED',
  generatedDaysAgo: 6,
  approvedDaysAgo: 3,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Title Slide',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `# Digital Readiness Diagnosis\n## Board Presentation — Enterprise Results\n\n**Organization:** DBR77 — Enterprise (All BUs)\n**Scope:** 5 plants, 4,500 employees\n**Date:** February 2026\n\n*Strategic Decision Briefing for the Board of Directors*`,
    },
    {
      key: 'headline',
      type: 'key_messages',
      title: 'Headline Findings',
      order: 1,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Headline Findings\n\n**Enterprise maturity at 5.5/7 — above industry median.** Top 35% of European industrial manufacturers.\n\n**Data management is our foundation (5.3/7).** Master Data Management deployed, Customer 360 in planning.\n\n**AI governance gap threatens EU AI Act compliance.** No formal framework. Estimated €800K compliance investment needed.\n\n**Cybersecurity convergence critically behind (3.0/5).** SIEM incomplete, OT/IT convergence not addressed. NIS2 exposure.\n\n**Digital products lag behind process maturity (3.0 vs 5.2).** Competitors launching IoT-enabled offerings.`,
    },
    {
      key: 'scorecard',
      type: 'matrix',
      title: 'Maturity Scorecard',
      order: 2,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Maturity Scorecard\n\n### Overall: **5.5 / 7.0** (79%) | Target: 7.0 | Gap: 1.5\n\n| Axis | Score | Target | Gap | Status |\n|------|-------|--------|-----|--------|\n| 1. Digital Processes | **5.2** | 7.0 | 1.8 | Strong |\n| 2. Digital Products | **3.0** | 5.0 | 2.0 | Critical |\n| 3. Business Models | **4.1** | 6.0 | 1.9 | Watch |\n| 4. Data Management | **5.3** | 7.0 | 1.7 | Strong |\n| 5. Culture & Skills | **3.8** | 6.0 | 2.2 | Watch |\n| 6. Cybersecurity | **3.0** | 5.0 | 2.0 | Critical |\n| 7. AI Maturity | **3.1** | 6.0 | 2.9 | Critical |\n\n**Pattern: "Process-Data Strong, Product-Security Weak"**`,
    },
    {
      key: 'critical_gaps',
      type: 'recommendations',
      title: 'Critical Gaps & Strategic Risks',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Critical Gaps & Strategic Risks\n\n**No AI governance framework** | Gap: 2.9 points\nML pipeline for demand forecasting exists but no model risk management. EU AI Act non-compliance fines: up to €35M.\n*Urgency: Immediate*\n\n**Cybersecurity convergence gap** | Gap: 2.0 points\nSIEM incomplete. No integrated IT+OT log monitoring. OT attack surface not covered.\n*Urgency: Immediate*\n\n**Digital product lag** | Gap: 2.0 points\nCompetitors launching IoT-enabled equipment. We have no equivalent offering.\n*Urgency: Short-term*\n\n**Skills scaling challenge** | Gap: 2.2 points\n4,000 employees (89%) lack structured digital training program.\n*Urgency: Short-term*`,
    },
    {
      key: 'deep_dive',
      type: 'axis_analysis',
      title: 'Deep Dive: Top 3 Priority Axes',
      order: 4,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Deep Dive: Top 3 Priority Axes\n\n### AI Maturity (3.1/6 — Gap: 2.9)\n- ML pipeline for demand forecasting (MAPE <12%) — strong foundation\n- MLOps in early build (Docker + Airflow)\n- **No AI governance** — critical for EU AI Act\n- Action: AI governance + expand MLOps (€180K, 8 months)\n\n### Cybersecurity (3.0/5 — Gap: 2.0)\n- IAM with 100% MFA — strong identity foundation\n- SIEM (Sentinel) in implementation but incomplete\n- SOC 24/7 outsourced — lacks OT visibility\n- Action: Complete SIEM + IT/OT integration (€650K, 10 months)\n\n### Culture & Skills (3.8/6 — Gap: 2.2)\n- Digital onboarding operational for new employees\n- No formal digital academy — planned but not launched\n- 4,000 employees without structured upskilling\n- Action: Enterprise digital academy (€340K, 24 months)`,
    },
    {
      key: 'roadmap',
      type: 'action_plan',
      title: 'Transformation Roadmap',
      order: 5,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Transformation Roadmap\n\n### NOW (0-3 months) — €380K\n- AI Governance Framework + EU AI Act assessment — CDO\n- SIEM OT integration — accelerate Sentinel — CISO\n- NIS2 compliance gap assessment — CISO + Legal\n- Digital Academy curriculum design — CHRO\n\n### NEXT (3-12 months) — €1.8M\n- SOC enhancement — full IT+OT SIEM (€650K)\n- MLOps platform expansion (€150K)\n- Digital Academy launch — 350 staff (€340K)\n- Customer 360 build (€420K)\n- Demand forecasting upgrade (€150K)\n\n### LATER (12-36 months) — €1.9M\n- B2B Marketplace to 8 EU countries (€520K)\n- AI governance maturity + advanced cases (€180K)\n- Enterprise data platform modernization (€1.2M)\n\n**Total: €4.1M / 36 months | Expected NPV: €12.4M**`,
    },
    {
      key: 'decisions',
      type: 'consulting_decisions',
      title: 'Decisions Needed',
      order: 6,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Decisions Needed Today\n\n| # | Decision | Recommendation | Budget Impact |\n|---|----------|---------------|---------------|\n| 1 | Approve Phase 1 (AI Gov + Security) | **YES** | €380K |\n| 2 | Appoint transformation program owner | **CDO** | — |\n| 3 | Establish quarterly steering committee | **YES** | — |\n| 4 | Accelerate B2B marketplace to Q2? | Discuss | +€80K |\n| 5 | Establish AI Ethics Board? | Recommend YES | — |`,
    },
    {
      key: 'next_steps',
      type: 'next_steps',
      title: 'Next Steps',
      order: 7,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Next Steps\n\n| # | Action | Owner | By When |\n|---|--------|-------|--------|\n| 1 | Phase 1 planning workshop | CDO | This week |\n| 2 | Distribute full diagnostic to leadership | CDO | This week |\n| 3 | Establish steering committee | CEO | End of February |\n| 4 | Launch AI governance workstream | CDO + Legal | March 1 |\n| 5 | Set 90-day progress review | CEO | March 15 |\n\n*Full diagnostic report (42 pages) available upon request.*`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 4: DRD Strategic Roadmap → Enterprise (NEW — second report)
// ═══════════════════════════════════════════════════════════════════════
const R4: ReportDef = {
  id: 'rpt-drd-roadmap-enterprise',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-drd-enterprise-01',
  sourceName: 'DRD — Finalny (Enterprise)',
  sourceFramework: 'DRD',
  title: 'DRD Strategic Transformation Roadmap — Enterprise',
  description: 'Detailed 36-month transformation roadmap with investment plan and governance.',
  reportType: 'ASSESSMENT_DRD',
  templateId: 'tpl-drd-full-diagnostic-v3',
  status: 'IN_REVIEW',
  generatedDaysAgo: 4,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'business',
      content: `# DRD — Strategic Transformation Roadmap\n## Enterprise-Wide Digital Transformation Plan\n\n**Organization:** DBR77 — Enterprise\n**Based on:** DRD Assessment (Score: 5.5/7.0)\n**Planning Horizon:** 36 months\n**Version:** 1.0 | February 2026`,
    },
    {
      key: 'executive_summary',
      type: 'summary',
      title: 'Executive Summary',
      order: 1,
      enabled: true,
      required: true,
      length: 'long',
      language: 'executive',
      content: `## Executive Summary\n\nThis strategic roadmap translates the DRD Enterprise assessment findings (5.5/7.0) into a concrete 36-month transformation program. The plan addresses 3 critical gaps (AI governance, cybersecurity, digital products) through a phased approach with clear governance and ROI milestones.\n\n### The Challenge\nDBR77 has strong process and data foundations (5.2 and 5.3 respectively) but faces critical gaps in AI governance (3.1), cybersecurity (3.0), and digital products (3.0). Without action, regulatory risk (EU AI Act, NIS2) and competitive pressure will erode our position.\n\n### The Plan\n- **Investment:** €4.1M over 36 months across 3 phases\n- **Target:** Move from 5.5 to 6.5+ overall maturity\n- **Expected NPV:** €12.4M (3:1 return ratio)\n- **Critical timeline:** AI governance and NIS2 compliance by H2 2026\n\n### Key Principles\n1. **Regulatory-first** — AI governance and NIS2 compliance are non-negotiable\n2. **People before technology** — every tech investment paired with skills investment\n3. **Phase-gated** — each phase has go/no-go criteria before proceeding\n4. **Quick wins fuel momentum** — visible results in first 90 days`,
    },
    {
      key: 'current_state',
      type: 'scorecard',
      title: 'Current State Assessment',
      order: 2,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Current State: Where We Are\n\n### Enterprise Digital Maturity: 5.5 / 7.0\n\n| Axis | Score | Classification | Roadmap Focus |\n|------|-------|---------------|---------------|\n| Digital Processes | 5.2 | Strong | Maintain & optimize |\n| Digital Products | 3.0 | Critical | Major investment needed |\n| Business Models | 4.1 | Developing | Marketplace expansion |\n| Data Management | 5.3 | Strong | Extend to Customer 360 |\n| Culture & Skills | 3.8 | Developing | Academy launch |\n| Cybersecurity | 3.0 | Critical | Regulatory urgency |\n| AI Maturity | 3.1 | Critical | Governance + scaling |\n\n### Strengths to Build On\n- Process standardization ahead of plan (full CRM-ERP integration)\n- ML pipeline for demand forecasting achieving MAPE <12%\n- E-commerce B2B with product configurator live\n- IAM deployed with 100% MFA coverage`,
    },
    {
      key: 'target_state',
      type: 'matrix',
      title: 'Target State Vision',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Target State: Where We Need to Be (36 Months)\n\n| Axis | Current | 12-Month | 24-Month | 36-Month | Delta |\n|------|---------|----------|----------|----------|-------|\n| Digital Processes | 5.2 | 5.5 | 6.0 | 6.5 | +1.3 |\n| Digital Products | 3.0 | 3.5 | 4.2 | 5.0 | +2.0 |\n| Business Models | 4.1 | 4.5 | 5.0 | 5.5 | +1.4 |\n| Data Management | 5.3 | 5.8 | 6.2 | 6.5 | +1.2 |\n| Culture & Skills | 3.8 | 4.3 | 5.0 | 5.5 | +1.7 |\n| Cybersecurity | 3.0 | 4.0 | 4.5 | 5.0 | +2.0 |\n| AI Maturity | 3.1 | 4.0 | 5.0 | 5.5 | +2.4 |\n| **Overall** | **5.5** | **5.9** | **6.2** | **6.5** | **+1.0** |\n\n### Vision Statement\nBy 2029, DBR77 will be a **digitally mature, AI-governed, cyber-resilient** enterprise with connected products, data-driven decision-making, and a digitally skilled workforce — positioned in the **top 15%** of European industrial manufacturers.`,
    },
    {
      key: 'phase1',
      type: 'action_plan',
      title: 'Phase 1: Foundation (M1-M6)',
      order: 10,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Phase 1: Foundation (Months 1-6) | Budget: €780K\n\n### Workstream A: Regulatory Compliance (€280K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| AI Governance Framework | CDO | €120K | Framework approved, EU AI Act gap assessment complete |\n| NIS2 Compliance Assessment | CISO | €80K | Gap analysis complete, remediation roadmap |\n| SIEM OT Integration (Sentinel) | CISO | €80K | OT data sources connected to SIEM |\n\n### Workstream B: Data & Analytics (€220K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| Customer 360 Phase 1 | CMO | €180K | CRM+ERP+E-commerce unified view |\n| Demand Forecasting v2 | CTO | €40K | MAPE <8% (from <12%) |\n\n### Workstream C: People (€180K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| Digital Academy Design | CHRO | €40K | Curriculum, platform selected |\n| Leadership Immersion | CHRO | €60K | 50 leaders completed program |\n| Digital Champion Network | CHRO | €30K | 20 champions active |\n| Innovation Lab Reboot | CTO | €50K | Lab utilization >60% |\n\n### Workstream D: Quick Wins (€100K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| Process automation (5 RPA bots) | CIO | €60K | 200 hours/month saved |\n| Marketplace UX upgrade | CMO | €40K | Conversion rate +15% |\n\n**Phase 1 Go/No-Go Criteria:**\n- AI governance framework approved by legal\n- NIS2 gap assessment complete\n- Customer 360 MVP operational\n- 50+ leaders through immersion program`,
    },
    {
      key: 'phase2',
      type: 'action_plan',
      title: 'Phase 2: Build (M7-M18)',
      order: 11,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Phase 2: Build (Months 7-18) | Budget: €1.8M\n\n### Workstream A: Cybersecurity (€650K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| Full SIEM + SOC Enhancement | CISO | €450K | IT+OT unified monitoring |\n| OT Network Hardening | CISO | €120K | Full segmentation complete |\n| NIS2 Compliance Implementation | CISO | €80K | NIS2 audit passed |\n\n### Workstream B: AI & Analytics (€380K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| MLOps Platform v2 | CTO | €150K | 5 models in production |\n| Model Risk Management | CDO | €80K | EU AI Act compliant |\n| Predictive Maintenance v1 | CTO | €150K | 25% downtime reduction |\n\n### Workstream C: Digital Products (€420K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| IoT Platform Foundation | CTO | €250K | Connected product framework |\n| Product Data Platform | CPO | €170K | Unified product catalog |\n\n### Workstream D: People & Culture (€350K)\n| Initiative | Owner | Budget | KPI |\n|-----------|-------|--------|-----|\n| Digital Academy Phase 1 | CHRO | €250K | 200 managers + 100 tech |\n| B2B Marketplace to 4 countries | CMO | €100K | 4 EU markets live |`,
    },
    {
      key: 'phase3',
      type: 'action_plan',
      title: 'Phase 3: Scale (M19-M36)',
      order: 12,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Phase 3: Scale & Transform (Months 19-36) | Budget: €1.5M\n\n### Strategic Initiatives\n| Initiative | Owner | Budget | Expected Impact |\n|-----------|-------|--------|----------------|\n| B2B Marketplace — 8 EU countries | CMO | €420K | €2M incremental revenue |\n| Advanced AI Use Cases (5) | CTO | €280K | €1.5M annual value |\n| Enterprise Data Lakehouse | CIO | €400K | Unified analytics platform |\n| Digital Twin — Flagship Product | CPO | €200K | 20% faster time-to-market |\n| Digital Academy Phase 2 (Scale) | CHRO | €200K | 2,000 employees certified |\n\n**Phase 3 Milestones:**\n- AI maturity score >5.0\n- All critical NIS2 controls implemented\n- IoT-enabled products generating revenue\n- 50% of workforce digitally certified`,
    },
    {
      key: 'investment_summary',
      type: 'table',
      title: 'Investment & ROI Summary',
      order: 20,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Investment & ROI Summary\n\n### Program Budget\n\n| Phase | Timeline | Investment | Cumulative |\n|-------|----------|-----------|------------|\n| Foundation | M1-M6 | €780K | €780K |\n| Build | M7-M18 | €1.8M | €2.58M |\n| Scale | M19-M36 | €1.5M | €4.08M |\n| Contingency (10%) | — | €410K | €4.49M |\n\n### Expected Returns\n\n| Value Driver | 12-Month | 24-Month | 36-Month |\n|-------------|----------|----------|----------|\n| Revenue Growth | €0.5M | €2.0M | €4.5M |\n| Cost Savings | €0.3M | €1.5M | €3.2M |\n| Risk Avoidance | €1.0M | €2.5M | €4.7M |\n| **Total Value** | **€1.8M** | **€6.0M** | **€12.4M** |\n\n**NPV (10% discount): €9.8M | IRR: 145% | Payback: 14 months**`,
    },
    {
      key: 'governance',
      type: 'kpis',
      title: 'Governance & KPIs',
      order: 30,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Governance & KPIs\n\n### Transformation KPIs\n\n| KPI | Current | Y1 Target | Y3 Target |\n|-----|---------|-----------|----------|\n| DRD Overall Score | 5.5 | 5.9 | 6.5 |\n| AI Models in Production | 1 | 5 | 12 |\n| Cybersecurity (SIRI) | 3.0 | 4.0 | 5.0 |\n| Digital Products Revenue | 0% | 3% | 12% |\n| Workforce Certified | 0% | 10% | 50% |\n| NIS2 Compliance | No | Partial | Full |\n| EU AI Act Compliance | No | Yes | Yes |\n\n### Governance Structure\n- **Steering Committee:** CEO + CDO + CIO + CISO + CHRO — Quarterly\n- **Program Board:** CDO + Workstream Leads — Monthly\n- **Sprint Reviews:** Workstream Leads — Bi-weekly\n- **Budget Authority:** CDO (up to €100K), Steering Committee (above)\n\n### Risk Escalation\n- Budget >15% over: Steering Committee\n- Timeline slip >4 weeks: Program Board\n- Critical risk materialization: CEO + Board`,
    },
    {
      key: 'risks',
      type: 'consulting_risks_register',
      title: 'Risk Register',
      order: 40,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Program Risk Register\n\n| Risk | Probability | Impact | Mitigation |\n|------|------------|--------|------------|\n| Regulatory timeline accelerates (NIS2/AI Act) | Medium | Critical | Start compliance immediately, buffer in plan |\n| Key talent attrition (CDO, CTO) | Low | Critical | Retention packages, succession planning |\n| Vendor lock-in on SIEM platform | Medium | High | Multi-vendor strategy, exit clauses |\n| Transformation fatigue | High | Medium | Quick wins first, celebrate milestones |\n| Budget cuts due to economic downturn | Medium | High | Phase-gated approach, ROI-justified spend |\n| Integration complexity underestimated | Medium | Medium | Architecture review before each phase |\n| Change resistance at middle management | High | Medium | Champion network, leadership sponsorship |`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 5: SIRI Full Report (2.75/4.5)
// ═══════════════════════════════════════════════════════════════════════
const R5: ReportDef = {
  id: 'rpt-siri-full-readiness',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-siri-readiness-01',
  sourceName: 'SIRI — Industry 4.0 Readiness',
  sourceFramework: 'SIRI',
  title: 'SIRI Industry 4.0 Readiness Report — Electronics Assembly',
  description: 'Full SIRI assessment with 8-dimension analysis, benchmarking, and roadmap.',
  reportType: 'ASSESSMENT_SIRI',
  templateId: 'tpl-siri-full-report-v3',
  status: 'APPROVED',
  generatedDaysAgo: 6,
  approvedDaysAgo: 3,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover Page',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'business',
      content: `# Smart Industry Readiness Index\n## Assessment Report\n\n**Organization:** DBR77 — Electronics Assembly\n**Scope:** 2 plants, 800 employees\n**Framework:** SIRI\n**Period:** Q1 2026`,
    },
    {
      key: 'executive_summary',
      type: 'summary',
      title: 'Executive Summary',
      order: 1,
      enabled: true,
      required: true,
      length: 'long',
      language: 'executive',
      content: `## Executive Summary\n\nSIRI assessment for DBR77's Electronics Assembly Division — 2 plants, 800 employees.\n\n### Overall Band: **2.75 / 5.0** — Intermediate\n\nThe division is at **"Active Digitization"** — connected shop floor but intelligence layer underdeveloped.\n\n### Block Summary\n\n| Block | Avg Band | Assessment |\n|-------|----------|------------|\n| **Process** | 2.7 | Operations digitized, supply chain basic, PLM integrated |\n| **Technology** | 3.0 | Automation leads (Band 4), connectivity partial, intelligence minimal |\n| **Organization** | 2.5 | Leadership committed but workforce readiness lags |\n\n### Critical Insight\n\nThe **Automation-Connectivity-Intelligence ladder** is broken at Intelligence. Automation (Band 4) is strong with AGVs and cobots, connectivity partial (OPC-UA 60%), but **cannot convert data into predictive insights** (Intelligence Band 2).\n\n### Priority #1\nDeploy real-time analytics platform — €130K, 5 months, expected 15% OEE improvement.`,
    },
    {
      key: 'framework',
      type: 'methodology',
      title: 'SIRI Framework',
      order: 2,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## SIRI Framework\n\n### 3 Blocks, 8 Dimensions\n\n| Block | Dimension | Focus |\n|-------|-----------|-------|\n| **Process** | Operations | Shop floor, MES, OEE |\n| | Supply Chain | Supplier integration, visibility |\n| | Product Lifecycle | PLM, digital twin |\n| **Technology** | Automation | Robotics, AGVs, cobots |\n| | Connectivity | OPC-UA, MQTT, edge |\n| | Intelligence | Analytics, ML, AI |\n| **Organization** | Workforce | Digital skills, training |\n| | Leadership | Strategy, governance |\n\n### Bands 0-5\n- Band 0: No capability → Band 5: Leading (autonomous, self-optimizing)`,
    },
    {
      key: 'readiness_profile',
      type: 'scorecard',
      title: 'Readiness Profile',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Overall Readiness Profile\n\n### Composite Band: **2.75 / 5.0** — Intermediate\n\n| Dimension | Current | Target | Gap | Status |\n|-----------|---------|--------|-----|--------|\n| Operations | 3 | 5 | 2 | Established |\n| Supply Chain | 2 | 4 | 2 | Emerging |\n| Product Lifecycle | 3 | 5 | 2 | Established |\n| Automation | 4 | 5 | 1 | Advanced |\n| Connectivity | 3 | 5 | 2 | Established |\n| Intelligence | 2 | 4 | 2 | Emerging |\n| Workforce | 2 | 4 | 2 | Emerging |\n| Leadership | 3 | 4 | 1 | Established |\n\n**Profile: "Automation-Led, Intelligence-Poor"** — hardware-rich but intelligence-poor.`,
    },
    {
      key: 'process_block',
      type: 'axis_analysis',
      title: 'Process Block',
      order: 10,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Process Block\n\n### Operations (Band 3 → 5)\nMES operational with real-time OEE. Predictive maintenance pilot on CNC.\n**Strengths:** Real-time OEE, MES, PM pilot\n**Gaps:** Predictive analytics not in production, no digital twin\n\n### Supply Chain (Band 2 → 4)\nBasic ERP MRP. No real-time visibility.\n**Gaps:** No supplier portal, manual communication, no disruption alerting\n**Action:** Supplier portal for top 20 suppliers (80% spend)\n\n### Product Lifecycle (Band 3 → 5)\nPLM operational. Digital twin for flagship products. CAD/CAM automated.\n**Gaps:** Digital twin limited to 2 products, no virtual commissioning`,
    },
    {
      key: 'tech_block',
      type: 'axis_analysis',
      title: 'Technology Block',
      order: 11,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Technology Block\n\n### Automation (Band 4 → 5)\nAGV fleet (4 units), cobots on 2 lines, robotic welding cell.\n**Gaps:** Only 2/4 lines automated, manual changeovers\n\n### Connectivity (Band 3 → 5)\nOPC-UA on 60% machines, MQTT for edge. Industrial WiFi 60%.\n**Gaps:** 40% without WiFi, no edge computing, OPC-UA incomplete\n\n### Intelligence (Band 2 → 4) — CRITICAL GAP\nBI dashboards for basic reporting. No predictive analytics.\n**Gaps:** No real-time analytics, no ML in production\n**Action:** Real-time analytics platform + predictive maintenance PoC\n\n### The Maturity Ladder\n\n    Automation (Band 4) --> Connectivity (Band 3) --> Intelligence (Band 2)\n\nIntelligence cannot advance without connectivity. Focus: complete connectivity, THEN intelligence.`,
    },
    {
      key: 'org_block',
      type: 'axis_analysis',
      title: 'Organization Block',
      order: 12,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Organization Block\n\n### Workforce (Band 2 → 4)\nAd-hoc training. Literacy assessment for 300 operators completed but not acted upon.\n**Action:** Operator upskilling pilot (50 operators) with structured curriculum\n\n### Leadership (Band 3 → 4)\nDTO appointed. Quarterly digital steering committee.\n**Action:** Deploy digital leadership KPI dashboard\n\n### Key Insight\nOrganization Block (avg 2.5) is the **bottleneck** for Technology Block (3.0). Without workforce readiness, technology investments will underdeliver. Every €1 in people yields €2.5 in technology ROI.`,
    },
    {
      key: 'benchmark',
      type: 'comparison',
      title: 'Industry Benchmark',
      order: 20,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Industry Benchmark\n\n| Dimension | DBR77 | EU Mfg Avg | Best-in-Class | Position |\n|-----------|-------|-----------|---------------|----------|\n| Operations | 3.0 | 2.8 | 4.5 | Above median |\n| Supply Chain | 2.0 | 2.5 | 4.0 | Below median |\n| Product Lifecycle | 3.0 | 2.6 | 4.5 | Above median |\n| Automation | 4.0 | 3.0 | 5.0 | Top quartile |\n| Connectivity | 3.0 | 2.8 | 4.5 | Above median |\n| Intelligence | 2.0 | 2.2 | 4.0 | Below median |\n| Workforce | 2.0 | 2.5 | 4.0 | Below median |\n| Leadership | 3.0 | 2.8 | 4.5 | Above median |\n\n**Automation advantage** (+1.0 vs EU avg) is a differentiator but Intelligence and Workforce gaps will erode it within 18-24 months.`,
    },
    {
      key: 'roadmap',
      type: 'action_plan',
      title: 'Implementation Roadmap',
      order: 30,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Implementation Roadmap\n\n### Phase 1: Connect (0-6 months) | €315K\n- OPC-UA migration completion — €220K\n- Edge gateway deployment — €60K\n- Real-time analytics MVP — €35K\n- **Target SIRI: 3.25 (+0.50)**\n\n### Phase 2: Analyze (6-12 months) | €340K\n- Predictive maintenance (12 CNC) — €175K\n- Analytics platform rollout — €95K\n- Operator upskilling (50) — €35K\n- Supplier portal (top 20) — €35K\n- **Target SIRI: 3.75 (+1.00)**\n\n### Phase 3: Optimize (12-24 months) | €590K\n- AGV fleet expansion (4→12) — €480K\n- PLM-MES integration — €110K\n- **Target SIRI: 4.25 (+1.50)**\n\n**Total: €1.80M / 36 months → SIRI Band 4.50**`,
    },
    {
      key: 'risks',
      type: 'consulting_risks_register',
      title: 'Risk Assessment',
      order: 40,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Risk Assessment\n\n| Risk | Prob | Impact | Mitigation |\n|------|------|--------|------------|\n| OPC-UA migration complexity (legacy) | High | High | Phase approach, protocol converters |\n| ML talent shortage | High | Medium | University partnership, contractor bridge |\n| Budget pressure reduces scope | Medium | High | Phase-gated with ROI milestones |\n| Vendor lock-in on analytics | Medium | Medium | Open-source stack preference |\n| Cybersecurity exposure during OT expansion | Medium | Critical | Security-first architecture |\n| Operator change resistance | High | Medium | Champion program, visible quick wins |`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 6: SIRI Action Plan
// ═══════════════════════════════════════════════════════════════════════
const R6: ReportDef = {
  id: 'rpt-siri-action-plan',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-siri-readiness-01',
  sourceName: 'SIRI — Industry 4.0 Readiness',
  sourceFramework: 'SIRI',
  title: 'SIRI Smart Factory 12-Month Action Plan',
  description: 'Sprint-based 12-month execution plan for SIRI improvement.',
  reportType: 'ASSESSMENT_SIRI',
  templateId: 'tpl-siri-action-plan-v3',
  status: 'IN_REVIEW',
  generatedDaysAgo: 4,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'business',
      content: `# Smart Factory — 12-Month Action Plan\n\n**DBR77 Electronics Assembly** | Q1 2026\n*From SIRI Band 2.75 to Band 3.75 in 12 months*`,
    },
    {
      key: 'situation',
      type: 'summary',
      title: 'Current Situation',
      order: 1,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Current Situation & Objectives\n\n**Where we are:** SIRI Band 2.75 (Intermediate) — automation hardware strong but no intelligence layer.\n\n**Where we need to be:** Band 3.75 within 12 months — established analytics, PM operational, workforce literate.\n\n**The gap:** Intelligence Band 2→3 enables predictive maintenance = **€200K/year** in downtime savings.\n\n**12-month objective:** Band 3.75 — from "Active Digitization" to "Established Smart Factory."`,
    },
    {
      key: 'sprint1',
      type: 'action_plan',
      title: 'Sprint 1: Quick Wins (M1-3)',
      order: 2,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Sprint 1: Quick Wins (Month 1-3)\n\n| Action | Dimension | Budget | Success Metric |\n|--------|-----------|--------|----------------|\n| OPC-UA migration (60%→95%) | Connectivity | €80K | 95% machines connected |\n| Real-time analytics dashboard | Intelligence | €35K | 3 live KPI dashboards |\n| Edge gateway pilot (5 machines) | Connectivity | €15K | <100ms edge response |\n| Digital literacy pre-assessment | Workforce | €5K | 100% operators assessed |\n| Leadership KPI dashboard | Leadership | €10K | Automated monthly report |\n\n**Sprint 1 Budget: €145K | Expected Band: +0.25**`,
    },
    {
      key: 'sprint2',
      type: 'action_plan',
      title: 'Sprint 2: Foundation (M4-6)',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Sprint 2: Foundation (Month 4-6)\n\n| Action | Dimension | Budget | Success Metric |\n|--------|-----------|--------|----------------|\n| Analytics platform production rollout | Intelligence | €95K | 10 users, 5 automated alerts |\n| Predictive maintenance PoC (3 CNC) | Intelligence | €50K | >70% failure prediction |\n| Operator upskilling (50 operators) | Workforce | €35K | 40% competency improvement |\n| Supplier portal MVP (top 5) | Supply Chain | €25K | 5 suppliers on portal |\n\n**Sprint 2 Budget: €205K | Expected Band: +0.50 (cum. +0.75)**`,
    },
    {
      key: 'sprint3',
      type: 'action_plan',
      title: 'Sprint 3: Intelligence (M7-9)',
      order: 4,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Sprint 3: Intelligence Layer (Month 7-9)\n\n| Action | Dimension | Budget | Success Metric |\n|--------|-----------|--------|----------------|\n| PM scale to 12 CNC | Intelligence | €125K | 35% downtime reduction |\n| Real-time quality monitoring | Operations | €45K | Real-time defect detection |\n| Supplier portal expansion (top 20) | Supply Chain | €10K | 80% spend via portal |\n\n**Go/No-Go at Sprint 3:**\n- PM accuracy >70% on pilot CNC\n- 30+ operators completed upskilling\n- Analytics adopted by >5 managers\n\n**Sprint 3 Budget: €180K | Expected Band: +0.50 (cum. +1.00)**`,
    },
    {
      key: 'sprint4',
      type: 'action_plan',
      title: 'Sprint 4: Scale (M10-12)',
      order: 5,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Sprint 4: Scale & Optimize (Month 10-12)\n\n| Action | Dimension | Budget | Success Metric |\n|--------|-----------|--------|----------------|\n| Production optimization analytics | Operations | €40K | 5% OEE improvement |\n| Cross-plant replication planning | All | €15K | Playbook for Plant B |\n| SIRI re-assessment | All | €25K | SIRI score validated |\n\n**Sprint 4 Budget: €80K | Expected final Band: 3.75**\n\n### 12-Month Summary\n- Starting SIRI: 2.75\n- Target SIRI: 3.75 (+1.00)\n- Total Investment: €610K\n- Expected Annual Value: €350K\n- Payback: 21 months`,
    },
    {
      key: 'resources',
      type: 'table',
      title: 'Resource Plan',
      order: 6,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Resource & Budget Plan\n\n| Sprint | Internal | External | Technology | Total |\n|--------|----------|----------|-----------|-------|\n| Sprint 1 | €30K | €40K | €75K | €145K |\n| Sprint 2 | €45K | €60K | €100K | €205K |\n| Sprint 3 | €30K | €50K | €100K | €180K |\n| Sprint 4 | €20K | €35K | €25K | €80K |\n| **Total** | **€125K** | **€185K** | **€300K** | **€610K** |\n\n### Team Requirements\n| Role | Sprint 1-2 | Sprint 3-4 | Source |\n|------|-----------|-----------|--------|\n| OT Engineer | 1.0 FTE | 0.5 FTE | Internal |\n| Data Engineer | 0.5 FTE | 1.0 FTE | Hire Q1 |\n| IT Integration | 0.5 FTE | 0.5 FTE | Internal |\n| Training Coordinator | 0.5 FTE | 0.5 FTE | Internal |`,
    },
    {
      key: 'kpis',
      type: 'kpis',
      title: 'KPIs & Governance',
      order: 7,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## KPIs & Governance\n\n| KPI | Baseline | 6-month | 12-month |\n|-----|----------|---------|----------|\n| SIRI Composite | 2.75 | 3.25 | 3.75 |\n| OEE (Plant A) | 63% | 66% | 68% |\n| Unplanned Downtime | 8.5% | 6.5% | 5.5% |\n| PM Accuracy | 0% | 65% | 75% |\n| Operators Literate | 0 | 30 | 50 |\n| Machines on OPC-UA | 60% | 95% | 100% |\n| Suppliers on Portal | 0 | 5 | 20 |\n\n### Governance Cadence\n- Weekly: Sprint stand-ups (30 min)\n- Monthly: Steering committee (60 min)\n- Quarterly: Board update (30 min)`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 7: ADMA Deep Dive (1.9/3.8)
// ═══════════════════════════════════════════════════════════════════════
const R7: ReportDef = {
  id: 'rpt-adma-full-maturity',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-adma-maturity-01',
  sourceName: 'ADMA — Digital Maturity Assessment',
  sourceFramework: 'ADMA',
  title: 'ADMA Digital Maturity Deep Dive — Packaging Machinery',
  description: 'Full 5-pillar ADMA analysis.',
  reportType: 'ASSESSMENT_ADMA',
  templateId: 'tpl-adma-full-report-v3',
  status: 'GENERATED',
  generatedDaysAgo: 3,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'business',
      content: `# ADMA — Digital Maturity Assessment\n## Deep Dive Report\n\n**Organization:** DBR77 — Packaging Machinery\n**Scope:** 2 plants, 600 employees\n**Framework:** ADMA\n**Period:** Q1 2026 (65% complete)`,
    },
    {
      key: 'executive_summary',
      type: 'summary',
      title: 'Executive Summary',
      order: 1,
      enabled: true,
      required: true,
      length: 'long',
      language: 'executive',
      content: `## Executive Summary\n\nADMA assessment for DBR77's Packaging Machinery Division. **Assessment 65% complete** — findings preliminary but reliable.\n\n### Overall: **1.9 / 5.0** — Beginner+\n\n| Pillar | Score | Target | Gap |\n|--------|-------|--------|-----|\n| Digital Strategy | 2.7 | 5.0 | 2.3 |\n| Smart Products | 1.5 | 4.0 | 2.5 |\n| Smart Operations | 2.0 | 4.0 | 2.0 |\n| Smart Supply Chain | 1.5 | 4.0 | 2.5 |\n| Data-Driven Services | 1.0 | 3.0 | 2.0 |\n\n### Strategic Priority\nBuild a **Product Data Platform** (€350K) as foundation for smart products, connected services, and data monetization — unlocks value across 3 of 5 pillars.\n\n**Total investment: €1.05M / 18 months.**`,
    },
    {
      key: 'pillar_strategy',
      type: 'axis_analysis',
      title: 'Pillar 1: Digital Strategy',
      order: 10,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Pillar 1: Digital Strategy (2.7/5)\n\n**Strategy (3/5):** Document exists but not cascaded. KPIs in development.\n**Investments (3/4):** €2.1M/year allocated. ROI tracking basic.\n**Culture (2/4):** Middle management resistance. Innovation lab <20% utilized.\n\n### Recommendations\n1. Strategy cascade workshops — 8 BUs\n2. Benefits realization framework\n3. 15 digital champions for middle management engagement`,
    },
    {
      key: 'pillar_products',
      type: 'axis_analysis',
      title: 'Pillar 2: Smart Products',
      order: 11,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Pillar 2: Smart Products (1.5/5) — CRITICAL\n\n**Features (2/4):** Basic IoT in 30% products. Remote monitoring for premium only.\n**Data (1/3):** No product data platform. Scattered across 15+ sources.\n**Services (1/3):** After-sales phone/email only. No predictive maintenance.\n**Integration (2/4):** API gateway with 3 live integrations, 8 planned.\n\n### Critical Gap: Product Data Platform\nBlocks ALL smart product initiatives. Without clean data, IoT can't scale.\n\n### Recommendations\n1. Product Data Platform (PIM + MDM) — €350K, 12 months\n2. IoT expansion to mid-range products\n3. Predictive service pilot for 3 key accounts`,
    },
    {
      key: 'pillar_operations',
      type: 'axis_analysis',
      title: 'Pillar 3: Smart Operations',
      order: 12,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Pillar 3: Smart Operations (2.0/5)\n\n**Automation (3/5):** PLC/SCADA all lines, MES 60%. Manual changeovers.\n**Connectivity (2/4):** Ethernet to PLCs. OPC-UA only 20%.\n**Intelligence (1/3):** Descriptive analytics only. No real-time dashboards.\n\n### The Operations Stack\n\n    Intelligence (1) — No analytics\n         ^\n    Connectivity (2) — OPC-UA 20%\n         ^\n    Automation (3) — PLC/SCADA/MES foundation\n\n### Recommendations\n1. OPC-UA migration 20%→80% — €145K, 6 months\n2. Shop floor analytics dashboards — €55K\n3. Automated changeover pilot — €90K`,
    },
    {
      key: 'pillar_supply',
      type: 'axis_analysis',
      title: 'Pillar 4: Smart Supply Chain',
      order: 13,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Pillar 4: Smart Supply Chain (1.5/5)\n\n**Visibility (2/4):** ERP only. Spreadsheet-based supplier tracking.\n**Agility (1/3):** Fixed weekly schedules. 5-day response latency.\n\nSupply chain is **manual and reactive**. In a market demanding agility, weekly re-planning is a major competitive disadvantage.\n\n### Recommendations\n1. Visibility Phase 1 — integrate top 10 supplier lead times (€70K, 4 months)\n2. Dynamic scheduling pilot — AI-based production scheduling PoC (€250K, 10 months)`,
    },
    {
      key: 'pillar_data',
      type: 'axis_analysis',
      title: 'Pillar 5: Data-Driven Services',
      order: 14,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Pillar 5: Data-Driven Services (1.0/5) — ABSENT\n\nNo data monetization, no outcome-based pricing, no digital service offerings.\n\n### Opportunity\n- Machine performance benchmarking\n- Condition-based maintenance contracts\n- Outcome-based pricing (throughput guarantees)\n- Spare parts prediction\n\nPrerequisites: Product Data Platform (Pillar 2) + IoT connectivity\nRoadmap as Phase 3 initiative (Month 13-18).`,
    },
    {
      key: 'tech_stack',
      type: 'comparison',
      title: 'Technology Stack',
      order: 20,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'technical',
      content: `## Technology Stack Assessment\n\n| Capability | Current | Gap | Recommended | Priority |\n|-----------|---------|-----|-------------|----------|\n| ERP | SAP S/4 | Integration latency | Real-time MES link | High |\n| MES | Wonderware (60%) | Coverage | Extend to 100% | High |\n| PLM | Siemens Teamcenter | Adequate | Maintain | Low |\n| Product Data | Spreadsheets | **Critical** | PIM + MDM | Critical |\n| IoT | None | **Critical** | Azure IoT Hub | High |\n| Analytics | Excel + basic BI | **Critical** | Power BI + streaming | High |\n| Edge | None | Missing | Azure Stack Edge | Medium |`,
    },
    {
      key: 'roadmap',
      type: 'action_plan',
      title: 'Roadmap & Investment',
      order: 30,
      enabled: true,
      required: true,
      length: 'long',
      language: 'business',
      content: `## Transformation Roadmap\n\n### Phase 1: Foundation (M1-6) — €440K\n- Product Data Platform kickoff (€200K)\n- OPC-UA migration 20%→80% (€145K)\n- Shop floor dashboards (€55K)\n- Change management & champions (€40K)\n- **Expected ADMA: 2.4 (+0.5)**\n\n### Phase 2: Intelligence (M7-12) — €360K\n- PDP completion (€150K)\n- ERP-MES real-time integration (€160K)\n- Edge computing deployment (€50K)\n- **Expected ADMA: 3.0 (+1.1)**\n\n### Phase 3: Optimization (M13-18) — €250K\n- SC visibility & control tower PoC (€105K)\n- Dynamic scheduling pilot (€100K)\n- Data-driven service pilot (€45K)\n- **Expected ADMA: 3.5 (+1.6)**\n\n**Total: €1.05M / 18 months | Target ADMA: 3.5**`,
    },
    {
      key: 'appendix',
      type: 'appendix',
      title: 'Appendix',
      order: 100,
      enabled: false,
      required: false,
      length: 'medium',
      language: 'technical',
      content: `## Appendix\n\nCompletion: 65% | Confidence: 2.8/5.0\nScope: 2 plants, 600 employees\nIndustry: Manufacturing — Packaging Machinery\n\n*Final scores may shift as remaining 35% is completed.*`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// REPORT 8: ADMA Quick Brief
// ═══════════════════════════════════════════════════════════════════════
const R8: ReportDef = {
  id: 'rpt-adma-brief',
  sourceType: 'ASSESSMENT',
  sourceId: 'assess-adma-maturity-01',
  sourceName: 'ADMA — Digital Maturity Assessment',
  sourceFramework: 'ADMA',
  title: 'ADMA Quick Assessment Brief — Steering Committee',
  description: 'Concise brief for the ADMA assessment.',
  reportType: 'ASSESSMENT_ADMA',
  templateId: 'tpl-adma-brief-v3',
  status: 'DRAFT',
  generatedDaysAgo: 1,
  sections: [
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover',
      order: 0,
      enabled: true,
      required: true,
      length: 'short',
      language: 'business',
      content: `# ADMA — Assessment Brief\n\n**DBR77 Packaging Machinery** | February 2026 | Preliminary (65% complete)`,
    },
    {
      key: 'snapshot',
      type: 'scorecard',
      title: 'Maturity Snapshot',
      order: 1,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'executive',
      content: `## Maturity Snapshot\n\n### Overall: **1.9 / 5.0** — Beginner+\n\n| Pillar | Score | Target | Status |\n|--------|-------|--------|--------|\n| Digital Strategy | 2.7 | 5.0 | Developing |\n| Smart Products | 1.5 | 4.0 | Beginner |\n| Smart Operations | 2.0 | 4.0 | Beginner |\n| Smart Supply | 1.5 | 4.0 | Beginner |\n| Data-Driven | 1.0 | 3.0 | Absent |\n\n*Assessment 65% complete — results preliminary.*`,
    },
    {
      key: 'findings',
      type: 'key_messages',
      title: 'Key Findings',
      order: 2,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Key Findings\n\n**Strategy foundation exists** — Digital strategy document and €2.1M/year budget.\n\n**Automation base solid** — PLC/SCADA on all lines, MES 60%.\n\n**No product data platform** — Data in 15+ sources. Blocks all smart product initiatives.\n\n**Factory intelligence absent** — Zero real-time analytics. Manual SPC.\n\n**Supply chain reactive** — Weekly re-planning. 5-day response latency.`,
    },
    {
      key: 'pillars',
      type: 'matrix',
      title: 'Pillar Summary',
      order: 3,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Pillar Summary\n\n**Strategy (2.7):** Exists and funded. Gap: not cascaded, culture at 45% positive.\n\n**Products (1.5):** IoT on 30% premium. No PDP. No digital services. Highest revenue upside.\n\n**Operations (2.0):** Good PLC/SCADA but MES 60%, OPC-UA 20%. No analytics.\n\n**Supply Chain (1.5):** ERP-only visibility. Spreadsheet tracking. Fixed weekly schedules.\n\n**Data Services (1.0):** Non-existent. Highest growth potential but needs PDP and IoT first.`,
    },
    {
      key: 'quick_wins',
      type: 'action_plan',
      title: 'Quick Wins (90 Days)',
      order: 4,
      enabled: true,
      required: true,
      length: 'medium',
      language: 'business',
      content: `## Quick Wins (Next 90 Days)\n\n| # | Action | Pillar | Est. Cost |\n|---|--------|--------|-----------|\n| 1 | Strategy cascading workshops (8 BUs) | Strategy | €15K |\n| 2 | Shop floor display dashboards | Operations | €25K |\n| 3 | OPC-UA vendor selection | Operations | €10K |\n| 4 | Digital champion network (15) | Strategy | €5K |\n| 5 | PDP requirements & RFP | Products | €15K |\n| 6 | Supplier OTIF automation | Supply | €10K |\n| 7 | IoT data collection (premium products) | Products | €5K |`,
    },
    {
      key: 'investment',
      type: 'recommendations',
      title: 'Investment Preview',
      order: 5,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Investment Preview\n\n**Estimated Total: €1.0M – €1.1M / 18 months**\n\n| Priority | Initiative | Budget | Impact |\n|----------|-----------|--------|--------|\n| 1 | Product Data Platform | €350K | Unlocks Products + Services |\n| 2 | OPC-UA + Analytics | €200K | Real-time operations |\n| 3 | ERP-MES Integration | €160K | Eliminates data latency |`,
    },
    {
      key: 'next_steps',
      type: 'next_steps',
      title: 'Next Steps',
      order: 6,
      enabled: true,
      required: true,
      length: 'short',
      language: 'executive',
      content: `## Next Steps\n\n1. Complete assessment (remaining 35%) — CDO, 2 weeks\n2. Deep-dive workshop with BU leaders — CDO, this month\n3. Approve quick wins budget (€85K) — Steering Committee, this meeting\n4. Set 90-day review — CDO, calendar invite today`,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// ALL REPORTS — 8 assessment-linked reports (2 per assessment)
// ═══════════════════════════════════════════════════════════════════════
const ALL_REPORTS: ReportDef[] = [R1, R2, R3, R4, R5, R6, R7, R8];

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  log.header('═══════════════════════════════════════════════════════════');
  log.header('  Report Instance Seeder — 8 Assessment Reports (2 each)');
  log.header('═══════════════════════════════════════════════════════════');

  const db = await createDatabase();

  // Find user
  let userId = 'system';
  try {
    const u = await db.query(`SELECT id FROM users WHERE organization_id = ? LIMIT 1`, [ORG_ID]);
    userId = u?.rows?.[0]?.id || userId;
  } catch {
    /* ignore */
  }

  log.info(`Organization: ${ORG_ID}`);
  log.info(`User: ${userId}`);

  // ── Purge ──
  log.header('Purging existing reports');

  try {
    await db.query(`DELETE FROM report_builder_sections`, []);
    log.step('Deleted report_builder_sections');
  } catch (e: any) {
    log.warn(e?.message);
  }
  try {
    await db.query(`DELETE FROM report_builder_reports`, []);
    log.step('Deleted report_builder_reports');
  } catch (e: any) {
    log.warn(e?.message);
  }
  try {
    await db.query(`DELETE FROM assessment_reports`, []);
    log.step('Deleted assessment_reports');
  } catch (e: any) {
    log.warn(e?.message);
  }

  log.success('All existing reports purged');

  // ── Seed 8 report_builder_reports + assessment_reports ──
  log.header(`Seeding ${ALL_REPORTS.length} reports`);

  const now = new Date().toISOString();

  for (const r of ALL_REPORTS) {
    const generatedAt = daysAgo(r.generatedDaysAgo);
    const approvedAt = r.approvedDaysAgo !== undefined ? daysAgo(r.approvedDaysAgo) : null;
    const createdAt = daysAgo(r.generatedDaysAgo + 2);

    // ── report_builder_reports ──
    await db.query(
      `INSERT INTO report_builder_reports (
        id, organization_id, source_type, source_id, source_name, source_framework,
        title, description, report_type, template_id,
        config_json, company_context_json, status,
        created_by, created_at, updated_at, updated_by,
        generated_at, approved_at, approved_by, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, status = excluded.status, updated_at = excluded.updated_at,
        generated_at = excluded.generated_at, approved_at = excluded.approved_at`,
      [
        r.id,
        ORG_ID,
        r.sourceType,
        r.sourceId,
        r.sourceName,
        r.sourceFramework,
        r.title,
        r.description,
        r.reportType,
        r.templateId,
        JSON.stringify({ seeded: true }),
        JSON.stringify({ organizationName: 'DBR77', assessmentType: r.sourceFramework }),
        r.status,
        userId,
        createdAt,
        now,
        userId,
        generatedAt,
        approvedAt,
        approvedAt ? userId : null,
        1,
      ]
    );

    // ── assessment_reports (bridge for hub "Reports" tab) — 1 per assessment ──
    // Only insert if this assessment doesn't already have an entry
    const arId = `ar-${r.sourceId}`;
    try {
      await db.query(
        `INSERT OR IGNORE INTO assessment_reports (
          id, assessment_id, organization_id, name, status,
          template_id, builder_report_id,
          created_by, created_at, updated_at, updated_by,
          approved_at, approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          arId,
          r.sourceId,
          ORG_ID,
          r.title,
          r.status,
          r.templateId,
          r.id,
          userId,
          createdAt,
          now,
          userId,
          approvedAt,
          approvedAt ? userId : null,
        ]
      );
    } catch {
      /* already exists for this assessment — skip */
    }

    // ── Sections ──
    for (const s of r.sections) {
      const sectionId = `sec-${r.id}-${s.key}`;

      await db.query(
        `INSERT INTO report_builder_sections (
          id, report_id, section_key, section_type, title,
          order_index, enabled, required, length, language,
          generated_content, content_format, generated_at,
          tokens_used, generation_model,
          block_type_id, render_kind,
          repeat_for, repeat_key,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          generated_content = excluded.generated_content, updated_at = excluded.updated_at`,
        [
          sectionId,
          r.id,
          s.key,
          s.type,
          s.title,
          s.order,
          s.enabled ? 1 : 0,
          s.required ? 1 : 0,
          s.length,
          s.language,
          s.content,
          'markdown',
          generatedAt,
          Math.floor(s.content.length * 0.3),
          'claude-4-opus',
          s.type,
          'markdown',
          s.repeatFor || null,
          s.repeatKey || null,
          createdAt,
          now,
        ]
      );
    }

    const emoji: Record<string, string> = {
      DRAFT: '📝',
      GENERATED: '🤖',
      IN_REVIEW: '👀',
      APPROVED: '✅',
    };
    log.step(`${emoji[r.status] || '•'} [${r.status}] ${r.title} (${r.sections.length} sections)`);
  }

  log.success(`${ALL_REPORTS.length} reports seeded`);

  // ── Summary ──
  log.header('Summary');
  const byAssessment = new Map<string, string[]>();
  for (const r of ALL_REPORTS) {
    const list = byAssessment.get(r.sourceId) || [];
    list.push(`${r.status} — ${r.title}`);
    byAssessment.set(r.sourceId, list);
  }
  for (const [assessmentId, reports] of byAssessment) {
    log.info(`${assessmentId}: ${reports.length} reports`);
    reports.forEach((r) => log.step(r));
  }

  const totalSections = ALL_REPORTS.reduce((s, r) => s + r.sections.length, 0);
  const totalChars = ALL_REPORTS.reduce(
    (s, r) => s + r.sections.reduce((s2, sec) => s2 + sec.content.length, 0),
    0
  );

  log.info(
    `Total: ${ALL_REPORTS.length} reports, ${totalSections} sections, ${(totalChars / 1000).toFixed(0)}K chars`
  );
  log.info(`Tables populated: report_builder_reports, report_builder_sections, assessment_reports`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
