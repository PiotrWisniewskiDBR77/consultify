#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Report Builder — Premium Template Seeder
 * ═════════════════════════════════════════
 * Creates 11 comprehensive, production-quality report templates:
 *
 *   DRD (3):
 *     1. Full Diagnostic Report        — 14 sections, deep axis-by-axis analysis
 *     2. Board Presentation Deck       — 10 sections, slide-style for C-suite
 *     3. Executive One-Pager           — 6 sections, concise strategic brief
 *
 *   SIRI (2):
 *     4. Industry 4.0 Readiness Report — 12 sections, full SIRI framework analysis
 *     5. Smart Factory Action Plan     — 8 sections, operational transformation roadmap
 *
 *   ADMA (2):
 *     6. Digital Maturity Deep Dive    — 12 sections, 5-pillar analysis
 *     7. Quick Assessment Brief        — 7 sections, concise steering committee brief
 *
 *   TOOL (2):
 *     8. Tool Evaluation Report        — 9 sections, single tool deep analysis
 *     9. Tool Comparison Matrix        — 8 sections, multi-tool side-by-side
 *
 *   INTERVIEW (2):
 *    10. Discovery Insights Report     — 10 sections, full interview analysis
 *    11. Stakeholder Summary Brief     — 7 sections, concise insights for leadership
 *
 * Usage:
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-report-templates.ts
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

// ============================================================
// TEMPLATE DEFINITIONS
// ============================================================

type Section = {
  key: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  defaultLength: 'short' | 'medium' | 'long';
  defaultLanguage: 'business' | 'technical' | 'executive';
  promptHints?: string;
  config?: Record<string, any>;
  repeatFor?: string;
  repeatKey?: string;
};

type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  source_type: 'ASSESSMENT' | 'INTERVIEW' | 'TOOL';
  report_type: string;
  is_default: boolean;
  layout_profile: string;
  sections: Section[];
};

// ────────────────────────────────────────────────────────────
// DRD TEMPLATE 1: Full Diagnostic Report (14 sections)
// ────────────────────────────────────────────────────────────
const DRD_FULL_DIAGNOSTIC: TemplateDefinition = {
  id: 'tpl-drd-full-diagnostic-v3',
  name: 'DRD Full Diagnostic Report',
  description: 'Comprehensive digital maturity diagnostic covering all 7 transformation axes with deep analysis, heatmaps, benchmarking, strategic gap analysis, transformation roadmap, investment prioritization, and risk assessment. The definitive report for transformation teams and board-level decision making. 30-50 pages.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_DRD',
  is_default: true,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showVersion: true, showOrganization: true, subtitle: 'Digital Readiness Diagnosis — Full Diagnostic Report' },
    },
    {
      key: 'executive_summary', type: 'summary', title: 'Executive Summary', required: true, order: 1,
      defaultLength: 'long', defaultLanguage: 'executive',
      promptHints: 'Write a compelling executive summary (400-600 words) structured in 4 parts: (1) Context — why this assessment was conducted, the business objectives it serves, and the scope (number of plants, business units, employees); (2) Key Findings — the overall maturity score with percentage, top 3 strongest axes and top 3 weakest axes with exact scores and what they mean in business terms; (3) Critical Gaps — the 3-5 largest gaps between achieved and target levels, quantified as absolute numbers and percentages, with business impact for each; (4) Strategic Priority — the single most impactful recommendation with expected ROI timeline. Use confident, McKinsey-grade consulting language. Include concrete data points from the assessment scores. End with a clear call to action.',
    },
    {
      key: 'methodology', type: 'methodology', title: 'Assessment Methodology & Framework', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Describe the DRD (Digital Readiness Diagnosis) methodology based on the Digital Pathfinder framework by Dr. Piotr Wiśniewski. Structure as: (1) Framework Overview — the 7 axes of digital transformation and their strategic purpose; (2) Scoring Scale — levels 1-7 for Process (Axis 1) and Data (Axis 4) axes, levels 1-5 for remaining axes, with brief level descriptions; (3) Assessment Process — how data was collected (self-assessment, structured interviews, evidence review, workshop validation); (4) Quality Assurance — confidence scoring, cross-validation mechanisms. Include a visual summary table of all 7 axes with their area counts. Keep professional but accessible — the reader should understand the framework without prior knowledge.',
    },
    {
      key: 'overall_maturity', type: 'matrix', title: 'Overall Maturity Overview', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      config: { showOverallScore: true, showGap: true, showComparison: true, matrixType: 'heatmap', colorScheme: 'professional' },
      promptHints: 'Create a comprehensive maturity overview: (1) Overall Score — weighted maturity score prominently displayed as both absolute and percentage; (2) Axis Summary Table — all 7 axes showing: axis name, number of areas, achieved level, target level, gap (absolute and %), and RAG status (Red if gap >40%, Amber if 20-40%, Green if <20%); (3) Maturity Heatmap — describe the pattern across axes; (4) Key Insight — 3-4 sentences interpreting what this maturity profile means strategically. Use markdown tables with clear formatting.',
    },
    {
      key: 'axis_1_processes', type: 'axis_analysis', title: 'Axis 1: Digital Processes', required: true, order: 10,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '1',
      promptHints: 'Deep-dive analysis of Axis 1 (Digital Processes, scale 1-7) structured as: (1) Axis Score Card — achieved vs target with RAG status; (2) Current State narrative — what the achieved level means in operational terms; (3) Area-by-Area Breakdown — analyze each of the 9 process areas (Sales, Marketing, R&D, Procurement, Logistics, Production, Quality, Finance, HR) with individual scores, strengths, and gaps. Reference actual justification notes where provided; (4) Key Strengths — 3-4 specific capabilities the organization does well; (5) Critical Gaps — 3-4 specific weaknesses with business impact quantification; (6) Quick Wins — 2-3 improvements achievable within 90 days with low investment; (7) Strategic Recommendations — 2-3 medium-term initiatives for this axis.',
    },
    {
      key: 'axis_2_products', type: 'axis_analysis', title: 'Axis 2: Digital Products & Services', required: true, order: 11,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '2',
      promptHints: 'Deep-dive analysis of Axis 2 (Digital Products & Services, scale 1-5) structured as: (1) Axis Score Card; (2) Current State — what the achieved level reveals about product/service digitization; (3) Area Breakdown — individual area scores with observations; (4) Digital Product Portfolio Assessment — what digital offerings exist, their maturity, revenue contribution; (5) Gaps & Competitive Risks — missing digital channels, outdated interfaces, threats from digitally-native competitors; (6) Innovation Opportunities — 2-3 specific product/service digitization opportunities with market potential; (7) Recommendations — prioritized actions for product digital transformation.',
    },
    {
      key: 'axis_3_business_models', type: 'axis_analysis', title: 'Axis 3: Digital Business Models', required: true, order: 12,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '3',
      promptHints: 'Deep-dive analysis of Axis 3 (Digital Business Models, scale 1-5): (1) Axis Score Card; (2) Current State — level of business model innovation achieved; (3) Area Breakdown — e-commerce, platform solutions, as-a-service models, resource sharing, data monetization; (4) Revenue Model Analysis — current vs potential digital revenue streams; (5) Ecosystem Assessment — platform thinking, partnership readiness, API strategy; (6) Strategic Opportunities — 2-3 business model innovations aligned with capabilities and market position; (7) Implementation Path — how to pilot new business models with minimal risk.',
    },
    {
      key: 'axis_4_data', type: 'axis_analysis', title: 'Axis 4: Data Management & Analytics', required: true, order: 13,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '4',
      promptHints: 'Deep-dive analysis of Axis 4 (Data Management, scale 1-7): (1) Axis Score Card; (2) Data Maturity Narrative — what the achieved level implies about data governance, quality, and utilization; (3) Area Breakdown — data collection, storage methodology, data communication, Big Data analytics, computing/processing; (4) Data Architecture Assessment — current stack, integration points, data flows; (5) Data Quality & Governance — quality scores, ownership model, GDPR/NIS2 compliance status; (6) Analytics Capability Gap — from descriptive to predictive to prescriptive analytics; (7) Data Strategy Recommendations — prioritized steps including quick wins (data catalog, quality rules) and strategic investments (data platform, advanced analytics).',
    },
    {
      key: 'axis_5_culture', type: 'axis_analysis', title: 'Axis 5: Organizational Culture & Competencies', required: true, order: 14,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '5',
      promptHints: 'Deep-dive analysis of Axis 5 (Culture of Transformation, scale 1-5): (1) Axis Score Card; (2) Cultural Readiness Assessment — leadership style, change appetite, innovation mindset; (3) Area Breakdown — leadership, change readiness, continuous improvement, innovation culture, resource availability; (4) Digital Skills Gap Analysis — current vs required competencies across organizational levels; (5) Change Barriers — resistance patterns, organizational structure blockers, incentive misalignment; (6) People & Culture Recommendations — digital academy design, change management program, organizational design changes. Emphasize that culture is the #1 predictor of transformation success.',
    },
    {
      key: 'axis_6_security', type: 'axis_analysis', title: 'Axis 6: Cybersecurity & Risk Management', required: true, order: 15,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '6',
      promptHints: 'Deep-dive analysis of Axis 6 (Cybersecurity, scale 1-5): (1) Axis Score Card; (2) Security Posture Summary — overall risk exposure and maturity; (3) Area Breakdown — strategy & risk management, network & system protection, data security, training & awareness, incident response; (4) OT/IT Convergence Assessment — industrial control system security, network segmentation status; (5) Compliance Status — NIS2, DORA, ISO 27001 alignment; (6) Critical Vulnerabilities — flag any area scoring below 3 as requiring urgent attention; (7) Security Roadmap — from immediate actions (patch critical gaps) to strategic initiatives (zero-trust architecture, SOC capability).',
    },
    {
      key: 'axis_7_ai', type: 'axis_analysis', title: 'Axis 7: AI & Machine Learning Maturity', required: true, order: 16,
      defaultLength: 'long', defaultLanguage: 'business',
      repeatFor: 'axis', repeatKey: '7',
      promptHints: 'Deep-dive analysis of Axis 7 (AI Maturity, scale 1-5): (1) Axis Score Card; (2) AI Readiness Assessment — current adoption level, organizational understanding of AI potential; (3) Area Breakdown — AI data foundations, AI-supported processes, AI in products/services, AI governance/ethics, AI competencies & culture; (4) Use Case Portfolio — existing AI/ML initiatives and their maturity; (5) AI Readiness Prerequisites — data quality, computing infrastructure, talent, governance frameworks; (6) AI Adoption Roadmap — phased from quick wins (RPA, simple ML) through advanced (generative AI, autonomous systems). Cross-reference with Axis 4 (Data) maturity as critical enabler.',
    },
    {
      key: 'strategic_gap_analysis', type: 'recommendations', title: 'Strategic Gap Analysis & Priority Matrix', required: true, order: 50,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Synthesize findings from all 7 axes into a strategic gap analysis: (1) Priority Matrix — rank all gaps by business impact (High/Medium/Low) × implementation effort (High/Medium/Low), creating a clear 2×2 prioritization grid with specific initiatives in each quadrant; (2) Cross-Axis Dependencies — identify where gaps in one axis block progress in another (e.g., weak data governance blocks AI adoption, low culture scores slow all technology initiatives); (3) Top 5 Strategic Priorities — the most critical transformation initiatives with expected impact, timeline (months), estimated investment range (€), and confidence level; (4) Cost of Inaction — what happens if the organization does NOT address these gaps over 12-24 months (competitive risk, regulatory risk, operational risk, talent risk). Use concrete consulting language, avoid generic statements.',
    },
    {
      key: 'transformation_roadmap', type: 'action_plan', title: 'Transformation Roadmap', required: true, order: 60,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Design a phased transformation roadmap with 3 horizons: (1) Quick Wins (0-3 months) — 5-7 immediate actions requiring minimal investment that close critical gaps or deliver visible improvements, each with: objective, owner suggestion, estimated effort, expected outcome, success metric; (2) Foundation Building (3-12 months) — 4-6 medium-term initiatives establishing infrastructure for sustained transformation, including: technology investments, process redesign, capability building, governance setup; (3) Strategic Transformation (12-36 months) — 3-4 major programs fundamentally upgrading digital capabilities. For each initiative specify: key activities, KPIs, dependencies, budget range (€), risk factors. Present as a structured timeline with clear milestones and gates. Include a total investment summary and expected cumulative ROI.',
    },
    {
      key: 'appendix', type: 'appendix', title: 'Appendix: Detailed Scores, Methodology & Glossary', required: false, order: 100,
      defaultLength: 'long', defaultLanguage: 'technical',
      promptHints: 'Generate a comprehensive appendix: (1) Complete Score Table — all areas across all 7 axes with achieved level, target level, gap, confidence rating, and assessor notes in a structured markdown table; (2) Scoring Criteria — what defines each level for each axis type (1-7 scale and 1-5 scale); (3) Assessment Metadata — date conducted, scope details, data sources, participants, limitations and caveats; (4) Glossary — key terms (DRD, digital maturity, axis, area, etc.); (5) References — relevant frameworks, standards, and benchmarks used.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// DRD TEMPLATE 2: Board Presentation Deck (10 sections)
// ────────────────────────────────────────────────────────────
const DRD_PRESENTATION: TemplateDefinition = {
  id: 'tpl-drd-presentation-v3',
  name: 'DRD Board Presentation Deck',
  description: 'Slide-style presentation optimized for C-suite workshops, steering committees, and board meetings. Focused on impact, decisions, and next steps. Visual-first design with punchy headlines, scorecard views, and clear action items. 15-25 slides.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_DRD',
  is_default: false,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Title Slide', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'executive',
      config: { showLogo: true, showDate: true, showVersion: false, showOrganization: true, subtitle: 'Digital Readiness Diagnosis — Results & Strategic Decisions' },
    },
    {
      key: 'agenda', type: 'summary', title: 'Agenda & Meeting Objectives', required: true, order: 1,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Create an agenda slide: (1) Meeting purpose — one powerful sentence; (2) Agenda — 6-8 numbered items matching presentation flow; (3) Expected Outcomes — 3 bullet points on decisions to make today. Bullet points only, no paragraphs. Clean and authoritative.',
    },
    {
      key: 'headline_findings', type: 'key_messages', title: 'Headline Findings', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Create 5 headline findings as punchy statements. Each: (1) Bold headline (max 8 words) — e.g., "Data maturity is our biggest blocker"; (2) One supporting sentence with exact data point; (3) Impact indicator: 🟢 Strength, 🟡 Watch, 🔴 Critical. Format as visually scannable list. These headlines should tell the entire assessment story in 30 seconds. Think newspaper headlines — dramatic, specific, data-backed.',
    },
    {
      key: 'maturity_scorecard', type: 'matrix', title: 'Maturity Scorecard', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'executive',
      config: { showOverallScore: true, showGap: true, showComparison: true },
      promptHints: 'Create a visual scorecard: (1) Overall maturity score displayed prominently; (2) Compact table — all 7 axes with: axis name, achieved, target, gap bar, RAG color; (3) One-sentence narrative summarizing the pattern. Optimize for visual impact — this is the slide everyone will photograph.',
    },
    {
      key: 'strengths_recognition', type: 'recommendations', title: 'Where We Excel', required: true, order: 4,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Highlight 4-5 strengths from highest-scoring areas. Each: (1) Positive headline; (2) Score backing it up; (3) Why it matters — one sentence on business value. Use ✅ indicators. This slide should generate pride before the harder conversations.',
    },
    {
      key: 'critical_gaps', type: 'recommendations', title: 'Critical Gaps & Strategic Risks', required: true, order: 5,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Present 5-6 most significant gaps. Each: (1) Specific gap title (not generic); (2) Current vs Target score; (3) Business impact — one real-world consequence sentence; (4) Urgency: Immediate / Short-term / Medium-term. Sort by urgency. Use 🔴/🟡 indicators. Be direct but constructive — frame gaps as opportunities. End with: "The good news: these gaps have clear, actionable solutions."',
    },
    {
      key: 'priority_axes_deep_dive', type: 'axis_analysis', title: 'Deep Dive: Top 3 Priority Axes', required: true, order: 6,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Deep-dive into the 3 axes with the LARGEST GAPS (not all 7 — this is a presentation). For each: (1) Axis name + score header; (2) 3-4 key observations as bullets; (3) Area-level breakdown table; (4) The #1 recommended action. Keep each axis to 1-2 slide equivalents. For remaining 4 axes: single summary sentence each. Use actual assessment data — no generic statements.',
    },
    {
      key: 'transformation_roadmap', type: 'action_plan', title: 'Transformation Roadmap', required: true, order: 7,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Visual roadmap with 3 horizons: (1) NOW (0-3 months) — 3-4 quick wins with suggested owners; (2) NEXT (3-12 months) — 3-4 foundation initiatives with effort estimates; (3) LATER (12-36 months) — 2-3 strategic programs with expected outcomes. Add "Key Dependencies" section listing 2-3 critical blockers. This should be the slide that generates the most discussion.',
    },
    {
      key: 'decisions_needed', type: 'consulting_decisions', title: 'Discussion & Decision Points', required: true, order: 8,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Create 4-5 discussion questions driving alignment and decisions: (1) "Do we agree that [axis] is priority #1?"; (2) "Are we willing to invest €X in [initiative] this quarter?"; (3) "Who owns the transformation roadmap?" Customize based on actual findings. End with "Decisions Needed Today" — 2-3 yes/no decisions required to move forward.',
    },
    {
      key: 'next_steps', type: 'next_steps', title: 'Next Steps & Accountability', required: true, order: 9,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Exactly 5 next steps: (1) Action — what happens; (2) Who — responsible person/role; (3) By When — specific date/timeline. Include: schedule detailed planning workshop, distribute full diagnostic report, establish transformation governance, launch first quick win, set 90-day review date. End with "Thank you" and contact info placeholder.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// DRD TEMPLATE 3: Executive One-Pager (6 sections)
// ────────────────────────────────────────────────────────────
const DRD_EXECUTIVE_BRIEF: TemplateDefinition = {
  id: 'tpl-drd-executive-brief-v3',
  name: 'DRD Executive One-Pager',
  description: 'Ultra-concise strategic brief for time-constrained executives and investors. Distills the entire DRD assessment into a 3-5 page document with headline scores, top gaps, investment ask, and immediate next steps. Perfect for pre-reads and email attachments.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_DRD',
  is_default: false,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'executive',
      config: { showLogo: true, showDate: true, showVersion: false, showOrganization: true, subtitle: 'Digital Readiness — Executive Brief' },
    },
    {
      key: 'at_a_glance', type: 'scorecard', title: 'Assessment at a Glance', required: true, order: 1,
      defaultLength: 'medium', defaultLanguage: 'executive',
      config: { showOverallScore: true, showGap: true },
      promptHints: 'Create an "at a glance" dashboard in one page: (1) Overall Score — big number with % interpretation; (2) 7-axis summary table — axis, score, target, RAG status, one-word verdict (e.g., "Strong", "Critical", "On Track"); (3) Three headline metrics: biggest gap, strongest axis, estimated investment to close top 3 gaps. Everything scannable in under 60 seconds.',
    },
    {
      key: 'top_findings', type: 'key_messages', title: 'Top 5 Findings', required: true, order: 2,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'List exactly 5 findings — the 5 things this executive MUST know. Each: bold one-line statement + one supporting sentence with data. Mix strengths and gaps (approximately 2 strengths, 3 gaps). Start with the single most important finding. Use 🟢/🔴 indicators.',
    },
    {
      key: 'investment_case', type: 'recommendations', title: 'Investment Case', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Create a compelling investment case: (1) Total Estimated Investment — range in €; (2) Top 3 Priority Initiatives — name, budget range, timeline, expected impact; (3) Expected Returns — cost savings, revenue uplift, risk reduction over 3 years; (4) Cost of Inaction — what happens in 12-24 months without investment. Use a simple table format. Be specific with numbers, avoid vague language.',
    },
    {
      key: 'risk_register', type: 'consulting_risks_register', title: 'Key Risks', required: true, order: 4,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Present top 5 transformation risks as a compact table: Risk | Probability (H/M/L) | Impact (H/M/L) | Mitigation. Include both execution risks (talent, budget, timeline) and strategic risks (competitive pressure, regulatory, technology obsolescence). Keep each row to 1-2 lines.',
    },
    {
      key: 'call_to_action', type: 'next_steps', title: 'Recommended Next Steps', required: true, order: 5,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Exactly 3 immediate actions the executive should take: (1) Approve — what decision is needed; (2) Fund — what investment to commit; (3) Meet — what workshop/review to schedule. Each with a specific timeline (this week, this month, this quarter). End with: "Detailed report available upon request."',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// SIRI TEMPLATE 1: Industry 4.0 Readiness Report (12 sections)
// ────────────────────────────────────────────────────────────
const SIRI_FULL_REPORT: TemplateDefinition = {
  id: 'tpl-siri-full-report-v3',
  name: 'SIRI Industry 4.0 Readiness Report',
  description: 'Comprehensive Smart Industry Readiness Index assessment covering all 8 dimensions across Process, Technology, and Organization blocks. Includes dimension analysis, radar charts, global benchmarking, band progression analysis, and a phased implementation roadmap. 25-40 pages.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_SIRI',
  is_default: true,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showVersion: true, showOrganization: true, subtitle: 'Smart Industry Readiness Index — Assessment Report' },
    },
    {
      key: 'executive_summary', type: 'summary', title: 'Executive Summary', required: true, order: 1,
      defaultLength: 'long', defaultLanguage: 'executive',
      promptHints: 'Write an executive summary for a SIRI assessment (400-500 words): (1) Context — why Industry 4.0 readiness matters for this organization, competitive landscape; (2) Overall Band — the composite SIRI band (0-5) with interpretation (e.g., Band 2.75 = "Intermediate - Active digitization with emerging connectivity"); (3) Block Summary — Process block, Technology block, Organization block scores; (4) Key Findings — strongest dimension (e.g., Automation Band 4) and weakest (e.g., Intelligence Band 2); (5) Strategic Recommendation — the #1 priority with impact estimate. Reference SIRI framework terminology (Bands, Blocks, Dimensions). Use manufacturing/Industry 4.0 language.',
    },
    {
      key: 'siri_framework', type: 'methodology', title: 'SIRI Framework & Methodology', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Explain the SIRI framework: (1) Origin — developed by Singapore EDB for Smart Factory assessment; (2) Structure — 3 Blocks (Process, Technology, Organization), 8 Dimensions; (3) Scoring — Band 0-5 scale with band descriptions; (4) Dimensions breakdown: Process Block (Operations, Supply Chain, Product Lifecycle), Technology Block (Automation, Connectivity, Intelligence), Organization Block (Workforce Learning, Leadership); (5) How assessment was conducted — self-assessment, evidence review, validation. Include a framework diagram description.',
    },
    {
      key: 'overall_readiness', type: 'scorecard', title: 'Overall Readiness Profile', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      config: { showOverallScore: true, showGap: true, showComparison: true },
      promptHints: 'Present the overall SIRI readiness profile: (1) Composite Band Score — prominently displayed; (2) Block Summary — Process, Technology, Organization block averages; (3) Dimension Summary Table — all 8 dimensions with current band, target band, gap, RAG status; (4) Radar Chart Description — describe the radar shape pattern (e.g., "Technology-led but Intelligence-poor"); (5) Interpretation — what this profile means for Industry 4.0 journey stage (Beginner/Intermediate/Advanced/Leader).',
    },
    {
      key: 'process_block', type: 'axis_analysis', title: 'Process Block: Operations, Supply Chain & Product Lifecycle', required: true, order: 10,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze the Process Block (3 dimensions): For each of Operations, Supply Chain, and Product Lifecycle: (1) Current Band vs Target; (2) What the band level means in practical terms (e.g., Band 3 Operations = "Connected shop floor with real-time monitoring"); (3) Key strengths from the evidence; (4) Critical gaps with manufacturing impact; (5) Specific improvement actions. Include cross-dimension dependencies (e.g., "Supply Chain visibility requires Operations data quality"). Use manufacturing terminology: OEE, OTIF, PLM, MES, digital twin.',
    },
    {
      key: 'technology_block', type: 'axis_analysis', title: 'Technology Block: Automation, Connectivity & Intelligence', required: true, order: 11,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze the Technology Block (3 dimensions): For Automation, Connectivity, and Intelligence: (1) Current Band vs Target; (2) Technology maturity interpretation; (3) Infrastructure assessment — what is deployed, what is missing; (4) Integration gaps — how well do automation, connectivity, and intelligence work together; (5) Technology stack recommendations. Special focus on the Automation→Connectivity→Intelligence maturity ladder — intelligence cannot advance without connectivity and data foundations. Reference: OPC-UA, MQTT, edge computing, ML/AI, digital twin, cobots, AGVs.',
    },
    {
      key: 'organization_block', type: 'axis_analysis', title: 'Organization Block: Workforce Learning & Leadership', required: true, order: 12,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze the Organization Block (2 dimensions): For Workforce Learning and Leadership: (1) Current Band vs Target; (2) People readiness assessment — digital skills, change management, leadership commitment; (3) Skills gap analysis — what competencies are needed vs available; (4) Organizational enablers — governance, KPIs, digital steering committee, transformation office; (5) Culture indicators — innovation mindset, experimentation tolerance, cross-functional collaboration. Emphasize that Organization Block often limits the speed of Technology adoption.',
    },
    {
      key: 'benchmark_comparison', type: 'comparison', title: 'Industry Benchmark Comparison', required: true, order: 20,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Compare the organization against industry benchmarks: (1) Global SIRI Average — how this organization compares to worldwide SIRI assessments; (2) Regional Comparison — EU manufacturing average; (3) Sector Comparison — same industry vertical peers; (4) Best-in-Class — what top performers score in each dimension; (5) Competitive Position — where the organization stands (bottom quartile, median, top quartile). Use comparative tables and highlight dimensions where the organization outperforms or significantly lags peers.',
    },
    {
      key: 'prioritization_matrix', type: 'consulting_2x2', title: 'Prioritization Matrix: Impact × Effort', required: true, order: 30,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Create a 2×2 prioritization matrix (Impact vs Effort) for all improvement initiatives derived from the 8 dimensions: (1) Quick Wins (High Impact, Low Effort) — list 3-4 initiatives; (2) Strategic Bets (High Impact, High Effort) — list 3-4 initiatives; (3) Fill-ins (Low Impact, Low Effort) — list 2-3 initiatives; (4) Deprioritize (Low Impact, High Effort) — list items to defer. For each initiative: name, dimension it addresses, estimated effort (months), expected band improvement. This matrix should guide resource allocation decisions.',
    },
    {
      key: 'implementation_roadmap', type: 'action_plan', title: 'Industry 4.0 Implementation Roadmap', required: true, order: 40,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Design a phased Industry 4.0 implementation roadmap: (1) Phase 1: Connect (0-6 months) — connectivity standardization, data pipeline setup, edge deployment; (2) Phase 2: Analyze (6-12 months) — analytics platform, predictive maintenance PoC, BI migration; (3) Phase 3: Optimize (12-24 months) — AI optimization, digital twin, autonomous operations; (4) Phase 4: Transform (24-36 months) — new business models, smart supply chain, workforce 4.0. For each phase: key deliverables, budget range, success metrics, prerequisites from previous phase. Include a total investment summary and target SIRI band after each phase.',
    },
    {
      key: 'risk_assessment', type: 'consulting_risks_register', title: 'Transformation Risk Assessment', required: true, order: 50,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Present top 8 risks for the Industry 4.0 transformation as a structured risk register: Risk | Category (Technology/People/Budget/External) | Probability (H/M/L) | Impact (H/M/L) | Risk Score | Mitigation Strategy. Include risks like: OT/IT integration complexity, skills shortage, budget overrun, vendor lock-in, cybersecurity exposure during transition, change resistance, technology obsolescence, regulatory changes.',
    },
    {
      key: 'appendix', type: 'appendix', title: 'Appendix: Detailed Scores & Evidence', required: false, order: 100,
      defaultLength: 'long', defaultLanguage: 'technical',
      promptHints: 'Comprehensive appendix: (1) Dimension-by-dimension detailed scores with evidence notes; (2) SIRI Band scale definitions (Band 0 through Band 5); (3) Assessment metadata — date, scope, participants, data sources; (4) Glossary of Industry 4.0 terms; (5) References to SIRI framework documentation.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// SIRI TEMPLATE 2: Smart Factory Action Plan (8 sections)
// ────────────────────────────────────────────────────────────
const SIRI_ACTION_PLAN: TemplateDefinition = {
  id: 'tpl-siri-action-plan-v3',
  name: 'SIRI Smart Factory Action Plan',
  description: 'Operational transformation plan focused on concrete actions, timelines, and responsibilities. Translates SIRI assessment findings into a 12-month sprint-based execution plan for plant managers and operational leaders. 10-18 pages.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_SIRI',
  is_default: false,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showOrganization: true, subtitle: 'Smart Factory — 12-Month Action Plan' },
    },
    {
      key: 'situation_summary', type: 'summary', title: 'Current Situation & Objectives', required: true, order: 1,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Concise situation assessment (200 words): (1) Where we are — overall SIRI band and what it means operationally; (2) Where we need to be — target band and what capabilities that unlocks; (3) The gap — quantified in band points and translated to operational impact (e.g., "Closing the Intelligence gap from Band 2→4 would enable predictive maintenance saving €200K/year in unplanned downtime"); (4) 12-month objective — specific target band after executing this plan.',
    },
    {
      key: 'quick_wins', type: 'action_plan', title: 'Sprint 1: Quick Wins (Month 1-3)', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Detail 4-6 quick win actions for months 1-3. Each action: (1) Name; (2) Which SIRI dimension it addresses; (3) Current state; (4) Target state after action; (5) Key activities (3-5 bullets); (6) Owner (role, not name); (7) Budget estimate; (8) Success metric. Focus on: connectivity standardization, data pipeline fixes, existing tool optimization, training quick sessions. These should be achievable without major investment or procurement.',
    },
    {
      key: 'foundation_sprint', type: 'action_plan', title: 'Sprint 2: Foundation Building (Month 4-6)', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Detail 3-5 foundation initiatives for months 4-6: analytics platform MVP, edge computing deployment, workforce upskilling program launch. Each with same structure: name, dimension, activities, owner, budget, success metric. These build on Sprint 1 outputs and prepare for intelligence capabilities.',
    },
    {
      key: 'intelligence_sprint', type: 'action_plan', title: 'Sprint 3: Intelligence Layer (Month 7-9)', required: true, order: 4,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Detail 3-4 intelligence-focused initiatives for months 7-9: predictive maintenance PoC, real-time analytics dashboards, ML model development. Show how these depend on foundation work from Sprint 2. Include go/no-go decision criteria at sprint boundaries.',
    },
    {
      key: 'scale_sprint', type: 'action_plan', title: 'Sprint 4: Scale & Optimize (Month 10-12)', required: true, order: 5,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Detail 3-4 scaling initiatives for months 10-12: production AI optimization, digital twin pilot, cross-plant replication. Include: how to measure success of the full 12-month program, expected SIRI band improvement, and handover to BAU operations.',
    },
    {
      key: 'resource_plan', type: 'table', title: 'Resource & Budget Plan', required: true, order: 6,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Create structured resource plan: (1) Budget Summary Table — Sprint | Internal Costs | External Costs | Technology | Total, with grand total; (2) Team Requirements — roles needed (e.g., Data Engineer, OT Specialist, Change Manager) × FTE per sprint; (3) Technology Stack — key tools/platforms to procure or deploy per sprint; (4) External Support — where consultants/vendors are needed vs internal capability.',
    },
    {
      key: 'kpis_governance', type: 'kpis', title: 'KPIs & Governance', required: true, order: 7,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Define program governance: (1) KPI Dashboard — 8-10 KPIs tracking transformation progress (operational KPIs like OEE improvement, and transformation KPIs like SIRI band movement); (2) Governance Cadence — weekly stand-ups, monthly steering committee, quarterly board reviews; (3) Decision Rights — who approves budget, scope changes, go/no-go at sprint boundaries; (4) Escalation Path — how to handle blockers and scope changes; (5) Risk Triggers — early warning indicators that the program is going off track.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// ADMA TEMPLATE 1: Digital Maturity Deep Dive (12 sections)
// ────────────────────────────────────────────────────────────
const ADMA_FULL_REPORT: TemplateDefinition = {
  id: 'tpl-adma-full-report-v3',
  name: 'ADMA Digital Maturity Deep Dive',
  description: 'Full analysis based on the ADMA (Advanced Digital Maturity Assessment) framework covering all 5 pillars: Strategy, Smart Products, Smart Operations, Smart Supply Chain, and Data-Driven Services. Includes pillar radar analysis, technology stack assessment, vendor landscape, and transformation investment case. 25-35 pages.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_ADMA',
  is_default: true,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showVersion: true, showOrganization: true, subtitle: 'ADMA — Digital Maturity Assessment Report' },
    },
    {
      key: 'executive_summary', type: 'summary', title: 'Executive Summary', required: true, order: 1,
      defaultLength: 'long', defaultLanguage: 'executive',
      promptHints: 'Write an executive summary for an ADMA assessment (400-500 words): (1) Context — why digital maturity matters for European manufacturers in 2026, competitive pressure from Industry 4.0 leaders; (2) Overall Score — composite maturity level (1-5 scale) with interpretation (Beginner/Developing/Intermediate/Advanced/Leader); (3) Pillar Summary — score for each of 5 pillars with one-line verdict; (4) Critical Insight — the single most important finding from the assessment; (5) Investment Recommendation — estimated total investment and expected ROI. Use ADMA terminology: pillars, dimensions, maturity levels. Reference European manufacturing context.',
    },
    {
      key: 'adma_framework', type: 'methodology', title: 'ADMA Framework & Methodology', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Explain the ADMA framework: (1) Origin — developed by ADMA (European Advanced Manufacturing) network; (2) Purpose — assess digital maturity of manufacturing SMEs; (3) Structure — 5 Pillars, 12 Dimensions; (4) Pillars: Digital Strategy (strategy, investments, culture), Smart Products (features, data, services, integration), Smart Operations (automation, connectivity, intelligence), Smart Supply (visibility, agility), Data-Driven (services and analytics); (5) Scoring — 1-5 scale per dimension; (6) Assessment process description.',
    },
    {
      key: 'maturity_overview', type: 'scorecard', title: 'Maturity Overview', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      config: { showOverallScore: true, showGap: true },
      promptHints: 'Present overall ADMA maturity: (1) Composite Score; (2) Pillar Summary Table — all 5 pillars with average score, target, gap, RAG status; (3) Dimension Detail Table — all 12 dimensions grouped by pillar with current, target, gap; (4) Maturity Profile Interpretation — what this pattern means (e.g., "Strategy-strong but execution-weak" or "Technology-ahead but data-behind").',
    },
    {
      key: 'pillar_strategy', type: 'axis_analysis', title: 'Pillar 1: Digital Strategy', required: true, order: 10,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze Strategy pillar (3 dimensions: Digital Strategy, Digital Investments, Digital Culture): For each dimension: (1) Current vs Target score; (2) What it means operationally; (3) Evidence-based observations; (4) Gap impact. Cross-cutting analysis: Is the strategy cascaded to all BUs? Is the investment matched to ambition? Is culture enabling or blocking execution? End with 3 specific recommendations for this pillar.',
    },
    {
      key: 'pillar_products', type: 'axis_analysis', title: 'Pillar 2: Smart Products', required: true, order: 11,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze Smart Products pillar (4 dimensions: Product Features, Product Data, Product Services, Product Integration): Assess the product digitization journey — from basic IoT features through data-driven services to full ecosystem integration. Evaluate: what % of products have digital features, is there a product data platform, are there outcome-based service models, what is the API/integration strategy. Compare against industry leaders. End with 3 specific recommendations.',
    },
    {
      key: 'pillar_operations', type: 'axis_analysis', title: 'Pillar 3: Smart Operations', required: true, order: 12,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze Smart Operations pillar (3 dimensions: Factory Automation, Factory Connectivity, Factory Intelligence): Evaluate the smart factory maturity — from PLC/SCADA basics through connected systems to intelligent, self-optimizing operations. Assess: automation coverage (% of lines), connectivity standard (OPC-UA/MQTT adoption), intelligence capabilities (analytics, ML, digital twin). Map the automation→connectivity→intelligence maturity ladder. End with 3 specific recommendations.',
    },
    {
      key: 'pillar_supply', type: 'axis_analysis', title: 'Pillar 4: Smart Supply Chain', required: true, order: 13,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Analyze Smart Supply Chain pillar (2 dimensions: Value Chain Visibility, Value Chain Agility): Assess supply chain digital maturity — visibility across tiers, real-time tracking, disruption alerting, dynamic scheduling, supplier collaboration platforms. Evaluate: OTIF tracking, lead time visibility, inventory optimization, demand sensing capability. End with 3 specific recommendations addressing supply chain resilience and agility.',
    },
    {
      key: 'pillar_data_services', type: 'axis_analysis', title: 'Pillar 5: Data-Driven Services', required: true, order: 14,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Analyze the data-driven dimension spanning across pillars: (1) Current data monetization and service capabilities; (2) Opportunities for outcome-based pricing, predictive services, condition-based maintenance offerings; (3) Data platform readiness for service innovation; (4) Revenue potential from data-driven business models. This pillar often has the largest gap and the highest revenue upside for mature manufacturers. End with 2-3 specific recommendations.',
    },
    {
      key: 'technology_assessment', type: 'comparison', title: 'Technology Stack Assessment', required: true, order: 20,
      defaultLength: 'medium', defaultLanguage: 'technical',
      promptHints: 'Assess the current technology stack against ADMA requirements: (1) Current Stack Overview — ERP, MES, PLM, SCADA, BI, IoT platform; (2) Gap Analysis — what is missing or outdated; (3) Integration Assessment — how well do systems communicate; (4) Technology Recommendations — specific tools/platforms for each gap area; (5) Build vs Buy analysis for key capabilities. Present as a comparison table: Current Tool | Gap | Recommended Solution | Priority.',
    },
    {
      key: 'transformation_roadmap', type: 'action_plan', title: 'Transformation Roadmap & Investment Case', required: true, order: 30,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Design an 18-month transformation roadmap with investment case: (1) Phase 1: Foundation (M1-M6) — data platform, connectivity, change management; (2) Phase 2: Intelligence (M7-M12) — analytics, edge computing, IoT expansion; (3) Phase 3: Optimization (M13-M18) — supply chain tower, dynamic scheduling, advanced services. For each phase: initiatives, budget, team, KPIs. Total Investment Summary: per-phase and cumulative. Expected ROI timeline. Include a maturity target: current ADMA score → expected score after each phase.',
    },
    {
      key: 'appendix', type: 'appendix', title: 'Appendix: Scores, Methodology & Glossary', required: false, order: 100,
      defaultLength: 'long', defaultLanguage: 'technical',
      promptHints: 'Comprehensive appendix: (1) All 12 dimension scores with evidence notes; (2) ADMA maturity scale definitions (Level 1-5); (3) Assessment metadata; (4) Glossary of manufacturing and digital terms; (5) ADMA network references.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// ADMA TEMPLATE 2: Quick Assessment Brief (7 sections)
// ────────────────────────────────────────────────────────────
const ADMA_BRIEF: TemplateDefinition = {
  id: 'tpl-adma-brief-v3',
  name: 'ADMA Quick Assessment Brief',
  description: 'Concise steering committee brief for ADMA assessments, especially useful for in-progress or preliminary results. Provides snapshot of maturity profile, top gaps, quick wins, and investment preview. 5-10 pages.',
  source_type: 'ASSESSMENT',
  report_type: 'ASSESSMENT_ADMA',
  is_default: false,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showOrganization: true, subtitle: 'ADMA — Assessment Brief' },
    },
    {
      key: 'snapshot', type: 'scorecard', title: 'Maturity Snapshot', required: true, order: 1,
      defaultLength: 'medium', defaultLanguage: 'executive',
      config: { showOverallScore: true, showGap: true },
      promptHints: 'Create a one-page maturity snapshot: (1) Overall Score — big number with maturity level label; (2) 5-Pillar Summary — pillar name, score, target, one-word status; (3) Completion Note — if assessment is not 100% complete, note this and indicate confidence level. Should be readable in under 30 seconds.',
    },
    {
      key: 'key_findings', type: 'key_messages', title: 'Key Findings (Top 5)', required: true, order: 2,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Exactly 5 key findings — mix of strengths (2) and gaps (3). Each: bold headline + one data-backed sentence. Use 🟢 for strengths and 🔴 for critical gaps. Start with the most strategically important finding.',
    },
    {
      key: 'pillar_summary', type: 'matrix', title: 'Pillar-by-Pillar Summary', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Compact summary of all 5 pillars in 2-3 sentences each: (1) Score interpretation; (2) Single biggest strength; (3) Single biggest gap. Use a consistent format for quick scanning. Include a small summary table at the top.',
    },
    {
      key: 'quick_wins', type: 'action_plan', title: 'Quick Wins (Next 90 Days)', required: true, order: 4,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'List 5-7 quick wins achievable in 90 days: Name | Pillar | Effort (Low/Medium) | Impact (Description) | Estimated Cost. Focus on actions requiring no procurement, no organizational change, and minimal budget. These should generate visible progress and build momentum.',
    },
    {
      key: 'investment_preview', type: 'recommendations', title: 'Investment Preview', required: true, order: 5,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: 'Brief investment overview: (1) Estimated Total (range) for full transformation; (2) Top 3 investment priorities with budget, timeline, expected impact; (3) Quick comparison: investment vs cost of inaction. This is a preview — full investment case available in the comprehensive report.',
    },
    {
      key: 'next_steps', type: 'next_steps', title: 'Recommended Next Steps', required: true, order: 6,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: '4 immediate next steps: (1) Complete the assessment if not at 100%; (2) Schedule deep-dive workshop; (3) Approve quick wins budget; (4) Set 90-day review date. Each with timeline and responsible role.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// TOOL TEMPLATE 1: Tool Evaluation Report (9 sections)
// ────────────────────────────────────────────────────────────
const TOOL_EVALUATION: TemplateDefinition = {
  id: 'tpl-tool-evaluation-v3',
  name: 'Tool Evaluation Report',
  description: 'In-depth evaluation report for a single tool-based assessment session. Covers tool scoring methodology, detailed findings per evaluation criterion, strengths & weaknesses analysis, fit assessment, implementation considerations, and actionable recommendations. 10-20 pages.',
  source_type: 'TOOL',
  report_type: 'tool_evaluation',
  is_default: true,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showOrganization: true, subtitle: 'Tool Assessment — Evaluation Report' },
    },
    {
      key: 'executive_summary', type: 'summary', title: 'Executive Summary', required: true, order: 1,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Write an executive summary of the tool evaluation (200-300 words): (1) Tool/Solution evaluated and its purpose; (2) Evaluation methodology — what criteria were assessed; (3) Overall Score — composite rating with interpretation; (4) Verdict — clear recommendation (Recommend / Recommend with caveats / Do not recommend); (5) Key differentiators — 2-3 standout findings. Be direct and actionable.',
    },
    {
      key: 'evaluation_criteria', type: 'methodology', title: 'Evaluation Methodology & Criteria', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Describe the evaluation framework: (1) Criteria used — list all evaluation dimensions (e.g., functionality, usability, scalability, security, integration, cost, vendor stability, support); (2) Scoring methodology — how each criterion was scored; (3) Weighting — which criteria were weighted more heavily and why; (4) Data sources — demos, PoC results, reference checks, documentation review; (5) Evaluation team — roles involved in the assessment.',
    },
    {
      key: 'detailed_scores', type: 'scorecard', title: 'Detailed Scoring', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      config: { showOverallScore: true, showGap: true },
      promptHints: 'Present detailed scores: (1) Overall Score prominently displayed; (2) Criterion-by-criterion table — criterion name, weight, raw score, weighted score, RAG status; (3) Score distribution analysis — where does this tool excel vs fall short; (4) Score comparison to "ideal" baseline. Use markdown tables with clear formatting.',
    },
    {
      key: 'strengths', type: 'findings', title: 'Strengths & Differentiators', required: true, order: 4,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Detail 5-7 key strengths: For each: (1) Strength title; (2) Evidence — specific observation from the evaluation; (3) Business value — why this matters for the organization; (4) Comparison note — how this compares to alternatives if applicable. Be specific — "Excellent UX" is weak, "Intuitive drag-and-drop workflow builder reduced configuration time by 60% during PoC" is strong.',
    },
    {
      key: 'weaknesses', type: 'findings', title: 'Weaknesses & Risks', required: true, order: 5,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Detail 4-6 weaknesses and risks: For each: (1) Weakness title; (2) Evidence — specific observation; (3) Business impact — what this means operationally; (4) Mitigation — can this be worked around, and at what cost; (5) Severity — Critical (deal-breaker) / Major (significant but manageable) / Minor (acceptable trade-off). Be honest but constructive.',
    },
    {
      key: 'fit_assessment', type: 'gap_analysis', title: 'Organizational Fit Assessment', required: true, order: 6,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Assess fit with the organization: (1) Technical Fit — integration with existing stack (ERP, CRM, etc.), data format compatibility, API availability; (2) Operational Fit — matches current workflows, user skill levels, support model; (3) Strategic Fit — aligns with digital strategy, scalability for growth, future-proofing; (4) Cultural Fit — vendor relationship model, implementation approach, training philosophy. Use a fit matrix: Dimension | Fit Rating | Notes.',
    },
    {
      key: 'implementation', type: 'action_plan', title: 'Implementation Considerations', required: true, order: 7,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Address implementation practicalities: (1) Estimated Timeline — phases and duration; (2) Resource Requirements — internal team, external support; (3) Budget — licensing, implementation, training, ongoing costs; (4) Integration Effort — complexity of connecting with existing systems; (5) Change Management — user adoption challenges and mitigation; (6) Risk Factors — top 3-4 implementation risks with mitigation strategies.',
    },
    {
      key: 'recommendation', type: 'recommendations', title: 'Final Recommendation & Next Steps', required: true, order: 8,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Clear final recommendation: (1) Verdict — Recommend / Recommend with conditions / Do not recommend; (2) Conditions — if applicable, what must be resolved before proceeding; (3) Comparison Summary — if alternatives were considered, brief positioning; (4) Next Steps — 3-5 specific actions (e.g., negotiate contract, plan PoC extension, schedule reference visits, prepare business case, get budget approval); (5) Decision Timeline — when should the go/no-go decision be made.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// TOOL TEMPLATE 2: Tool Comparison Matrix (8 sections)
// ────────────────────────────────────────────────────────────
const TOOL_COMPARISON: TemplateDefinition = {
  id: 'tpl-tool-comparison-v3',
  name: 'Tool Comparison Matrix',
  description: 'Side-by-side comparison report for multiple tool assessment sessions. Features a structured comparison matrix, scoring breakdown, fit analysis for each candidate, and a clear winner recommendation. Ideal for technology selection decisions. 12-20 pages.',
  source_type: 'TOOL',
  report_type: 'tool_comparison',
  is_default: false,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showOrganization: true, subtitle: 'Tool Assessment — Comparison Report' },
    },
    {
      key: 'executive_summary', type: 'summary', title: 'Executive Summary & Recommendation', required: true, order: 1,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Summary of tool comparison (200-300 words): (1) Context — what business need triggered this evaluation; (2) Tools Evaluated — names and brief descriptions; (3) Evaluation Methodology — criteria and weighting approach; (4) Winner — clear recommendation with overall scores; (5) Key Differentiator — the single most important factor that determined the recommendation. Lead with the recommendation — executives want the answer first, rationale second.',
    },
    {
      key: 'comparison_matrix', type: 'comparison', title: 'Head-to-Head Comparison Matrix', required: true, order: 2,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Create a comprehensive comparison matrix: (1) Overall Scores — each tool with composite score and rank; (2) Criterion-by-Criterion Table — rows are criteria, columns are tools, cells contain scores with RAG coloring; (3) Winner per Criterion — which tool leads in each dimension; (4) Visualization narrative — describe the pattern (e.g., "Tool A leads in functionality but Tool B excels in integration and cost"). Present as a clear markdown table optimized for scanning.',
    },
    {
      key: 'per_tool_analysis', type: 'analysis', title: 'Per-Tool Analysis', required: true, order: 3,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'For each evaluated tool, provide a structured profile: (1) Tool Name & Vendor; (2) Overall Score and Rank; (3) Top 3 Strengths — evidence-based; (4) Top 3 Weaknesses — evidence-based; (5) Best For — which scenario or use case this tool is best suited for; (6) Deal Breakers — any critical issues that could disqualify this tool. Keep each tool profile to 1 page equivalent. Be balanced and factual.',
    },
    {
      key: 'fit_comparison', type: 'gap_analysis', title: 'Organizational Fit Comparison', required: true, order: 4,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Compare organizational fit across tools: (1) Technical Fit Matrix — integration complexity, data compatibility, infrastructure requirements for each tool; (2) Operational Fit — workflow alignment, user readiness, support model comparison; (3) Strategic Fit — scalability, vendor roadmap alignment, future-proofing; (4) Fit Score Summary — which tool has the best overall fit for THIS organization. Present as a comparative table.',
    },
    {
      key: 'tco_comparison', type: 'table', title: 'Total Cost of Ownership Comparison', required: true, order: 5,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'TCO comparison over 3 years: (1) Cost Breakdown Table — rows: licensing (Y1/Y2/Y3), implementation, training, customization, integration, support, infrastructure; columns: each tool; (2) Total 3-Year TCO per tool; (3) Cost per User/Month; (4) Hidden Costs — what is NOT included in vendor quotes; (5) Value Analysis — TCO relative to capability score. Present as a structured financial comparison table.',
    },
    {
      key: 'risk_comparison', type: 'consulting_risks_register', title: 'Risk Comparison', required: true, order: 6,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Compare implementation and vendor risks: For each tool: (1) Implementation Risk (H/M/L) — complexity, timeline, resource needs; (2) Vendor Risk — stability, market position, support quality; (3) Lock-in Risk — data portability, contract terms, switching costs; (4) Security Risk — compliance certifications, vulnerability track record. Present as a comparative risk table with overall risk score per tool.',
    },
    {
      key: 'recommendation', type: 'recommendations', title: 'Final Recommendation & Decision Framework', required: true, order: 7,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Clear recommendation: (1) Primary Recommendation — which tool and why (2-3 sentences); (2) Runner-up — which tool is the backup option and when it might be preferred; (3) Decision Criteria Summary — the 3 factors that most influenced the recommendation; (4) Conditions — any negotiations, PoC extensions, or validations needed before final commitment; (5) Next Steps — 4-5 specific actions with timeline to reach a final procurement decision.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// INTERVIEW TEMPLATE 1: Discovery Insights Report (10 sections)
// ────────────────────────────────────────────────────────────
const INTERVIEW_INSIGHTS: TemplateDefinition = {
  id: 'tpl-interview-insights-v3',
  name: 'Discovery Insights Report',
  description: 'Comprehensive analysis of discovery interview sessions capturing stakeholder perspectives, organizational pain points, opportunity mapping, cross-cutting themes, and strategic recommendations. Transforms raw interview data into actionable consulting insights. 15-25 pages.',
  source_type: 'INTERVIEW',
  report_type: 'interview_detailed',
  is_default: true,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showOrganization: true, subtitle: 'Discovery Interview — Insights Report' },
    },
    {
      key: 'executive_summary', type: 'summary', title: 'Executive Summary', required: true, order: 1,
      defaultLength: 'long', defaultLanguage: 'executive',
      promptHints: 'Write an executive summary of discovery findings (300-400 words): (1) Interview Scope — how many sessions, what roles/areas covered, time period; (2) Key Themes — the 3-4 overarching themes that emerged; (3) Critical Insights — the 2-3 most impactful findings that should drive immediate action; (4) Organizational Readiness — overall assessment of change readiness based on stakeholder attitudes; (5) Recommendation — the strategic direction suggested by the interviews. Use consulting language — "stakeholders consistently emphasized...", "a recurring pattern across all levels...".',
    },
    {
      key: 'methodology', type: 'methodology', title: 'Interview Methodology & Coverage', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Document the interview methodology: (1) Approach — structured vs semi-structured, question categories used; (2) Coverage Matrix — which departments/roles were covered and which have gaps; (3) Question Categories — list the topic areas explored; (4) Response Quality — completion rates, depth of answers, confidence scores; (5) Limitations — what was not covered and what might be biased. Include a coverage summary table.',
    },
    {
      key: 'theme_analysis', type: 'findings', title: 'Cross-Cutting Theme Analysis', required: true, order: 3,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Identify and analyze 5-7 cross-cutting themes that emerged: For each theme: (1) Theme Name — clear, descriptive; (2) Frequency — how many interviews/categories raised this; (3) Key Quotes/Observations — 2-3 specific insights (anonymized if needed); (4) Business Impact — what this theme means for the organization; (5) Sentiment — Positive/Mixed/Negative. Present themes in order of strategic importance. Connect themes to each other where they reinforce or contradict.',
    },
    {
      key: 'category_findings', type: 'analysis', title: 'Findings by Category', required: true, order: 4,
      defaultLength: 'long', defaultLanguage: 'business',
      promptHints: 'Organize findings by interview category (e.g., Strategy, Operations, Digital, People, Finance). For each category: (1) Summary Score / Completion; (2) Key Facts Discovered — the most important objective findings; (3) Pain Points — recurring frustrations and bottlenecks; (4) Opportunities — positive signals and untapped potential; (5) Gaps — questions that remained unanswered or need deeper investigation. Use actual question-answer data where available.',
    },
    {
      key: 'pain_points', type: 'findings', title: 'Pain Point Map', required: true, order: 5,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Create a structured pain point map: (1) Categorized Pain Points — group by type (Process, Technology, People, Data, Governance); (2) For each: description, who raised it, how often it appeared, estimated business impact; (3) Root Cause Connections — link pain points that share common root causes; (4) Priority Classification — Critical (blocking daily operations) / Important (causing significant inefficiency) / Watch (emerging concern). Present as a structured table with severity indicators.',
    },
    {
      key: 'opportunity_map', type: 'recommendations', title: 'Opportunity Map', required: true, order: 6,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Map opportunities identified during interviews: (1) Quick Wins — improvements stakeholders themselves suggested that can be done easily; (2) Strategic Opportunities — larger initiatives that multiple stakeholders pointed to; (3) Innovation Ideas — creative suggestions that emerged from interviews; (4) For each: opportunity name, category, stakeholder support level (high/medium/low), estimated effort, potential impact. Present as a 2×2 matrix (Support vs Impact).',
    },
    {
      key: 'stakeholder_sentiment', type: 'comparison', title: 'Stakeholder Sentiment & Readiness', required: true, order: 7,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Analyze stakeholder sentiment: (1) Overall Change Readiness — are stakeholders eager, cautious, or resistant; (2) Sentiment by Department — which areas are most/least open to transformation; (3) Champions vs Skeptics — identify where champions exist (without naming names) and where resistance is strongest; (4) Communication Patterns — what messages resonate vs what creates anxiety; (5) Recommendations — how to engage different stakeholder groups in the transformation journey.',
    },
    {
      key: 'gap_register', type: 'gap_analysis', title: 'Knowledge Gaps & Follow-Up Needs', required: true, order: 8,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Document gaps in the discovery: (1) Unanswered Questions — important questions that got incomplete or no answers; (2) Areas Not Covered — departments, topics, or perspectives missing from interviews; (3) Contradictions — where different stakeholders gave conflicting information; (4) Recommended Follow-Ups — specific additional interviews, data requests, or workshops needed. Present as a prioritized action list for the next phase of discovery.',
    },
    {
      key: 'recommendations', type: 'recommendations', title: 'Strategic Recommendations', required: true, order: 9,
      defaultLength: 'long', defaultLanguage: 'executive',
      promptHints: 'Synthesize all findings into 8-10 strategic recommendations: For each: (1) Recommendation title; (2) Rationale — which findings/themes support this; (3) Priority — High/Medium/Low; (4) Effort — High/Medium/Low; (5) Expected Impact; (6) Dependencies; (7) Suggested Owner (role). Group into: Immediate Actions (next 30 days), Short-term (1-3 months), Strategic (3-12 months). End with a summary visualization matching recommendations to themes/pain points.',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// INTERVIEW TEMPLATE 2: Stakeholder Summary Brief (7 sections)
// ────────────────────────────────────────────────────────────
const INTERVIEW_BRIEF: TemplateDefinition = {
  id: 'tpl-interview-brief-v3',
  name: 'Stakeholder Interview Summary',
  description: 'Concise summary of discovery interview findings for leadership and stakeholder communication. Highlights key themes, critical pain points, and immediate action items without overwhelming detail. Perfect for sharing interview outcomes with interviewees and sponsors. 5-10 pages.',
  source_type: 'INTERVIEW',
  report_type: 'interview_summary',
  is_default: false,
  layout_profile: 'DOCUMENT_A4_PORTRAIT',
  sections: [
    {
      key: 'cover', type: 'cover', title: 'Cover', required: true, order: 0,
      defaultLength: 'short', defaultLanguage: 'business',
      config: { showLogo: true, showDate: true, showOrganization: true, subtitle: 'Discovery Interview — Summary Brief' },
    },
    {
      key: 'interview_overview', type: 'summary', title: 'Interview Overview', required: true, order: 1,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Provide a concise overview (200 words): (1) Scope — sessions conducted, roles covered, categories explored; (2) Completion — questions answered vs total, average confidence; (3) Overall Sentiment — one-sentence characterization; (4) Purpose — what these interviews will inform (assessment, roadmap, strategy). Keep it factual and professional.',
    },
    {
      key: 'key_themes', type: 'key_messages', title: 'Key Themes (Top 5)', required: true, order: 2,
      defaultLength: 'medium', defaultLanguage: 'executive',
      promptHints: 'Present the 5 most important themes from interviews: Each theme: (1) Bold title (max 6 words); (2) 2-3 sentence explanation with evidence; (3) Indicator: 💡 Insight, ⚠️ Concern, ✅ Strength. Order by strategic importance. These themes should capture the "voice of the organization."',
    },
    {
      key: 'facts_discovered', type: 'findings', title: 'Key Facts & Observations', required: true, order: 3,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'List 10-15 key facts discovered during interviews, grouped by category. Each fact: one clear sentence with specific data or observation. Mix quantitative facts ("OEE at 63%") with qualitative ("Middle management shows resistance to new tools"). These are the building blocks that inform recommendations.',
    },
    {
      key: 'pain_points_summary', type: 'findings', title: 'Critical Pain Points', required: true, order: 4,
      defaultLength: 'short', defaultLanguage: 'business',
      promptHints: 'Summarize top 5-7 pain points: Each: (1) Pain point (one sentence); (2) Business impact (one sentence); (3) Severity: 🔴 Critical / 🟡 Important / 🟢 Manageable. Focus on actionable pain points that the organization can address.',
    },
    {
      key: 'opportunities', type: 'recommendations', title: 'Opportunities & Quick Wins', required: true, order: 5,
      defaultLength: 'medium', defaultLanguage: 'business',
      promptHints: 'Present opportunities in two tiers: (1) Quick Wins (3-5 items) — can be started immediately, low effort, visible impact; (2) Strategic Opportunities (3-5 items) — larger initiatives suggested by stakeholder input. For each: name, rationale, estimated effort, expected impact. Frame positively — these are the "good news" items from the discovery.',
    },
    {
      key: 'next_steps', type: 'next_steps', title: 'Next Steps', required: true, order: 6,
      defaultLength: 'short', defaultLanguage: 'executive',
      promptHints: '4-5 next steps after this discovery: (1) Share this summary with interviewees for validation; (2) Complete any follow-up interviews/data collection; (3) Feed findings into assessment/strategy process; (4) Schedule stakeholder workshop to align on priorities; (5) Set timeline for detailed report. Each with responsible role and timeline.',
    },
  ],
};

// ============================================================
// ALL TEMPLATES
// ============================================================
const ALL_TEMPLATES: TemplateDefinition[] = [
  DRD_FULL_DIAGNOSTIC,
  DRD_PRESENTATION,
  DRD_EXECUTIVE_BRIEF,
  SIRI_FULL_REPORT,
  SIRI_ACTION_PLAN,
  ADMA_FULL_REPORT,
  ADMA_BRIEF,
  TOOL_EVALUATION,
  TOOL_COMPARISON,
  INTERVIEW_INSIGHTS,
  INTERVIEW_BRIEF,
];

// ============================================================
// MAIN
// ============================================================
async function main() {
  log.header('═══════════════════════════════════════════════════════════');
  log.header('  Report Builder — Premium Template Seeder');
  log.header(`  ${ALL_TEMPLATES.length} templates across 5 modules`);
  log.header('═══════════════════════════════════════════════════════════');

  const db = await createDatabase();

  // ── Purge ALL existing templates ──
  log.header('Purging all existing report templates');

  try {
    const countBefore = await db.query(`SELECT COUNT(*) as c FROM report_builder_templates`, []);
    const before = countBefore?.rows?.[0]?.c || 0;
    log.info(`Found ${before} existing templates`);

    await db.query(`DELETE FROM report_builder_templates`, []);
    log.success(`Purged ${before} templates`);
  } catch (e: any) {
    log.warn(`Purge warning: ${e?.message || e}`);
  }

  // Also clean the seeded fake block type
  try {
    await db.query(`DELETE FROM report_builder_block_types WHERE id = '16c9db2d-23d7-4077-8044-7bb61c18bfca'`, []);
    log.step('Cleaned up fake seeded block type');
  } catch { /* ignore */ }

  // ── Insert new templates ──
  log.header('Seeding premium templates');

  const now = new Date().toISOString();

  for (const tpl of ALL_TEMPLATES) {
    const sectionCount = tpl.sections.length;

    await db.query(
      `INSERT INTO report_builder_templates (
        id, organization_id, name, description, source_type, report_type,
        sections_json, default_options_json, is_system, is_default, is_public,
        layout_profile, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        source_type = excluded.source_type,
        report_type = excluded.report_type,
        sections_json = excluded.sections_json,
        default_options_json = excluded.default_options_json,
        is_system = excluded.is_system,
        is_default = excluded.is_default,
        is_public = excluded.is_public,
        layout_profile = excluded.layout_profile,
        updated_at = excluded.updated_at`,
      [
        tpl.id,
        null, // organization_id: null = system template
        tpl.name,
        tpl.description,
        tpl.source_type,
        tpl.report_type,
        JSON.stringify(tpl.sections),
        JSON.stringify({ language: 'en', tone: 'professional' }),
        1, // is_system
        tpl.is_default ? 1 : 0,
        1, // is_public
        tpl.layout_profile,
        'system',
        now,
        now,
      ]
    );

    const typeEmoji: Record<string, string> = {
      'ASSESSMENT_DRD': '🔷',
      'ASSESSMENT_SIRI': '🟢',
      'ASSESSMENT_ADMA': '🟡',
      'tool_evaluation': '🔧',
      'tool_comparison': '🔧',
      'interview_detailed': '💬',
      'interview_summary': '💬',
    };
    const emoji = typeEmoji[tpl.report_type] || '📄';
    const defaultBadge = tpl.is_default ? ' [DEFAULT]' : '';
    log.step(`${emoji} ${tpl.source_type}/${tpl.report_type}: ${tpl.name} (${sectionCount} sections)${defaultBadge}`);
  }

  log.success(`${ALL_TEMPLATES.length} templates seeded`);

  // ── Summary ──
  log.header('═══════════════════════════════════════════════════════════');
  log.header('  Template Seed Complete!');
  log.header('═══════════════════════════════════════════════════════════');

  const byModule: Record<string, number> = {};
  const totalSections: Record<string, number> = {};
  for (const t of ALL_TEMPLATES) {
    const key = `${t.source_type}/${t.report_type}`;
    byModule[key] = (byModule[key] || 0) + 1;
    totalSections[key] = (totalSections[key] || 0) + t.sections.length;
  }

  log.info('Templates by module:');
  for (const [key, count] of Object.entries(byModule)) {
    log.info(`  ${key}: ${count} templates, ${totalSections[key]} total sections`);
  }
  log.info(`Total: ${ALL_TEMPLATES.length} templates, ${ALL_TEMPLATES.reduce((sum, t) => sum + t.sections.length, 0)} sections`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
