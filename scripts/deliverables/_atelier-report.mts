/**
 * _atelier-report — VEGAS/OXFORD R3: golden-path PREMIUM report (DOCX) for the
 * Atelier Toys demo case, driven by the REAL document renderer
 * (renderDocumentSchemaToDocxBuffer / documentDocxRenderer + documentDocxStyles).
 *
 * Content source: docs/demo/ATELIER_TOYS_INTERVIEW_FINDINGS_REPORT_GAMMA.md.
 *
 * Doctrine: CONCLUSION_LAYER §W1 — the report opens with an answer-first,
 * 5-paragraph executive summary (STATE → MEANING → THREE GAPS → WHAT FIRST →
 * EFFECT). Every section leads with a verdict-headline (thesis, not topic).
 * Numbers come only from the findings report (engine/data), never invented.
 *
 * The schema exercises the premium block types the renderer materializes as
 * real OOXML: heading, paragraph, kpi_strip (shaded strip), table (real
 * <w:tbl> with cell shading), callout (toned), quote (attributed), bullet_list.
 *
 * RUN:  node --import tsx scripts/deliverables/_atelier-report.mts
 * OUT:  docs/qa/deliverables/runs/ATELIER-REPORT.docx
 */
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const { renderDocumentSchemaToDocxBuffer } = await import(
  '../../server/src/services/documentStudio/documentDocxRenderer.js'
);
const { DEFAULT_CONSULTING_FORMATTING_SCHEMA } = await import(
  '../../server/src/services/documentStudio/documentStudioTypes.js'
);

const OUT_DIR = path.resolve('docs/qa/deliverables/runs');
const now = new Date().toISOString();

let sid = 0;
let bid = 0;
const section = (title: string, level: 1 | 2 | 3, blocks: any[]) => ({
  sectionId: `sec-${sid++}`,
  orderIndex: sid,
  level,
  title,
  blocks: blocks.map((b) => ({ blockId: `b-${bid++}`, ...b })),
  sourceRefs: [],
});
const p = (text: string) => ({ type: 'paragraph', content: { text } });
const h = (text: string, level: 1 | 2 | 3 = 2) => ({ type: 'heading', content: { text, level } });
const bullets = (items: string[]) => ({ type: 'bullet_list', content: { style: 'bullet', items } });
const callout = (tone: string, text: string) => ({ type: 'callout', content: { tone, text } });
const quote = (text: string, attribution: string) => ({ type: 'quote', content: { text, attribution } });
const kpi = (items: Array<{ label: string; value: string; delta?: string }>) => ({
  type: 'kpi_strip',
  content: { items },
});
const table = (headers: string[], rows: string[][], caption?: string) => ({
  type: 'table',
  content: { headers, rows, caption },
});

const schema = {
  documentId: 'atelier-findings',
  artifactId: 'atelier-vol-i',
  title: 'Atelier Toys — Digital Transformation Discovery Report (Volume I)',
  documentType: 'client_discovery_report',
  language: 'en',
  audience: ['Atelier Toys Executive Committee', 'Board', 'Family Ownership'],
  goal: 'recommend',
  communicationRegister: 'executive',
  density: 'detailed',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  formattingSchema: DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  sourceRefs: [],
  createdAt: now,
  updatedAt: now,
  sections: [
    // ── §1 Executive Summary — CONCLUSION_LAYER W1 (5 paragraphs, answer-first) ──
    section('Executive Summary', 1, [
      callout(
        'info',
        'Evidence base: 22 leadership personas · 440 structured interview answers · 18 technology insights · 20 transformation initiatives. Classification: confidential, executive readership.',
      ),
      // 1. STATE (K1)
      p(
        'Atelier Toys is not digitally immature; its digital work is ungoverned. The company has already built the ingredients of a serious digital transformation — factory telemetry, a Digital Twin program, the Atelier Digital subscription line, AI governance, and OT cybersecurity investment — but these ingredients do not yet operate as one management system.',
      ),
      // 2. MEANING (K2)
      p(
        'For a family-controlled B2B manufacturer moving into accelerated US expansion, that gap is expensive. The executive layer does not receive one integrated view of value, risk, adoption and capital allocation, so good digital work still underperforms: decisions arrive late, data definitions are inconsistent, and owners do not share the same definition of progress. This is a digital transformation that happens to also be operational, commercial and governance work — not the other way around.',
      ),
      // 3. THREE GAPS (K1+K2)
      p(
        'Three gaps dominate the evidence. First, factory signals are not yet shift-decision signals — supervisors react roughly 30 minutes after the loss, leaking 0.8-1.2 M EUR/yr on Line 3. Second, Atelier Digital renewal risk is detected too late to cure, putting 4-6 M EUR of ARR at stake. Third, data governance — the common dependency under nearly every value pool — is inconsistent, dragging portfolio productivity 8-12% and raising US audit cost as scale grows.',
      ),
      // 4. WHAT FIRST (K3)
      p(
        'The first move is to launch a focused Wave 1 now rather than wait for a perfect maturity audit, and to reposition the PMO as a Transformation Control Tower with a decision ledger, baseline standard and staged funding gates. Sequencing starts where evidence is strong, the value pool is material, and named owners already exist: Line 3 Digital Twin, the procurement control tower, and the renewal-risk action system lead, because they prove the operating model and create visible value.',
      ),
      // 5. EFFECT (K4)
      p(
        'Within 12-18 months, disciplined execution converts distributed digital signals into governed enterprise decisions: Line 3 same-shift response closes, gross renewal moves toward the 88-92% top-quartile reference, and one board-endorsed narrative removes 1.4-3.3 M EUR/yr of avoidable value leakage from strategic-narrative debt. The evidence is decision-grade for prioritization today; board-grade ROI commitment follows a 90-day baseline-validation phase run in parallel.',
      ),
    ]),

    // ── At a glance ──
    section('Atelier Toys at a Glance', 2, [
      p(
        'Founded in 1948 and family-controlled, Atelier Toys runs 100% European manufacturing across two digitized Lyon sites and sells B2B only, through vetted educational distributors, to 4,000+ institutions in 45 countries with 1.2M+ active app subscribers.',
      ),
      kpi([
        { label: 'Institutions served', value: '4,000+', delta: '45 countries' },
        { label: 'App subscribers', value: '1.2M+', delta: 'active' },
        { label: 'Revenue (demo basis)', value: '290-340 M EUR', delta: 'mid-teens EBITDA' },
        { label: 'Workforce', value: '~1,900 FTE', delta: 'family-controlled' },
      ]),
      p(
        'The 2015-2025 Programme Ateliertoy Forward is the precedent: the company already moved from margin compression and operational chaos to global B2B STEM leadership. This is not a company learning how to run a transformation — it is moving from operational and product transformation to enterprise-wide digital transformation governance.',
      ),
    ]),

    // ── The overall finding ──
    section('The Overall Finding: Strong Narrative, Incomplete Control System', 2, [
      p(
        'Atelier Toys has a strong transformation narrative but an incomplete transformation control system. The company is not blocked by a lack of ideas; it is blocked by the friction that appears when many good ideas compete for scarce management attention, capital, data-engineering capacity, frontline adoption and executive decision time.',
      ),
      table(
        ['Recurring pattern', 'What teams experience', 'Management risk'],
        [
          ['Signals arrive late', 'Issue seen only after it becomes escalation', 'Value leakage before intervention'],
          ['Data definitions vary', 'Different teams use different success measures', 'Portfolio progress not comparable'],
          ['Pilots lack scale gates', 'Local gains are real but not repeatable', 'Pilot theater and capital dilution'],
          ['Weak cross-fn dependencies', 'Accountability inside functions, not across', 'Slow cross-functional execution'],
          ['Governance not evidence-driven', 'Meetings happen; decisions do not close the loop', 'Reopened decisions, delayed benefits'],
        ],
        'The same operating-model gap, observed from five functional angles.',
      ),
    ]),

    // ── Benchmarks & value at stake ──
    section('Where the Value Is: Benchmarked Gaps and Value at Stake', 2, [
      p(
        'Every theme is anchored to a defensible, anonymized top-quartile reference; no specific company is named. The value pool is concentrated, which is what makes Wave 1 sequencing possible. Ranges are deliberately conservative "demo basis" figures, to be validated against Atelier’s own production, financial and customer data in a 90-day evidence phase.',
      ),
      table(
        ['Theme', 'Atelier today', 'Top-quartile ref.', 'Value at stake (demo basis)'],
        [
          ['Line 3 OEE', '62-66%', '78-82%', '2.4-3.6 M EUR EBITDA / line / yr'],
          ['Digital gross renewal', '76-80%', '88-92%', '4-6 M EUR ARR protected'],
          ['Supplier risk governance', 'Visible, not margin-governed', 'War-room with escalation', '2.0-3.5 M EUR margin & WC'],
          ['Repeat defect rate', '9-12%', '3-4%', '0.9-1.6 M EUR cost of poor quality'],
          ['Partner 90-day activation', '~50% productive', '75%', '2-3 M EUR pipeline'],
          ['Changeover time', '16-20 min', '8-10 min', '0.6-1.1 M EUR throughput / line / yr'],
        ],
        'Anonymized industry-quartile composites; Peer A/B/C are illustrative references only.',
      ),
    ]),

    // ── Priority insights (top 5) — each answer-first ──
    section('Priority Insights and Decisions Required', 2, [
      h('Insight 1 — Factory signals are not yet shift-decision signals', 3),
      p(
        'Telemetry on Line 3 is rich, but event taxonomy, routing and supervisor action rules are inconsistent across shifts, creating a 20-30 minute event-to-response lag. Consequence: 0.8-1.2 M EUR/yr value leakage before changeover and downtime gains are layered in.',
      ),
      quote(
        'Telemetry on Line 3 is rich, but my supervisors still react to the alert thirty minutes after the loss already happened. We need a same-shift decision contract, not another dashboard.',
        'Marc Dubois, Plant Manager, 2026-04-19',
      ),
      callout('warning', 'Decision required: approve a Line 3 shift-decision contract (event taxonomy + alert routing + action protocol + learning capture) before expanding sensors or software.'),

      h('Insight 5 — Digital renewal risk is detected too late', 3),
      p(
        'Activation, usage, support and account signals live in separate views, so renewal risk surfaces only after escalation — when intervention cost is higher and recovery probability lower. Moving gross renewal from 76-80% toward the 88-92% reference protects 4-6 M EUR of ARR.',
      ),
      quote(
        'We learn that a school is at renewal risk when the renewal is already in escalation. By then we are negotiating, not curing.',
        'Lea Martin, Customer Success Lead, 2026-04-24',
      ),
      callout('warning', 'Decision required: launch a renewal-risk action system (prioritized intervention list with owners and playbooks), not another analytics dashboard.'),

      h('Insight 13 — Data governance is the portfolio’s common dependency', 3),
      p(
        'OEE, defect recurrence, supplier risk, renewal risk, partner activation and roadmap value all need one source of truth. Inconsistent definitions drag portfolio productivity 8-12% and raise COPPA/FERPA-aligned audit cost as US scale grows.',
      ),
      callout('danger', 'Decision required: fund top-25 metric ownership and lineage in Wave 1; treat data governance as enabling infrastructure, not a back-office project.'),
    ]),

    // ── US readiness ──
    section('US Readiness Gap Matrix', 2, [
      p(
        'US expansion raises the management bar. A board pack that does not address COPPA posture, district procurement readiness and tariff scenarios will not survive a serious US executive review. Atelier is strong on operations and ESG credentials, but data, AI, partner activation and tariff readiness require explicit evidence packages before US scale is a contractually safe bet.',
      ),
      table(
        ['US requirement', 'Atelier today', 'Owner of closure'],
        [
          ['District & GPO contract readiness', 'Partial', 'Partner Program + Legal'],
          ['COPPA & US state privacy posture', 'Needs evidence', 'Industrial Data Lead + Legal'],
          ['AI use-case governance (child-facing)', 'Needs evidence', 'CTO + OT Security + CFO'],
          ['Tariff & origin-aware procurement', 'Needs evidence', 'Procurement + CFO'],
          ['ESG & supply-chain traceability', 'Yes', 'Marketing + Sustainability'],
          ['US partner activation system', 'Needs evidence', 'Partner Program + Customer Success'],
        ],
        'Yes / Partial / Needs evidence coding across US enterprise-readiness requirements.',
      ),
    ]),

    // ── What to do first (K3) ──
    section('What to Do First: The 30-Day Action Plan', 2, [
      p(
        'The 30-day plan is designed to produce management evidence quickly, not to become a long planning exercise. Launch Wave 1 now while assigning data owners to close baseline gaps in parallel.',
      ),
      table(
        ['Week', 'Management action', 'Output'],
        [
          ['Week 1', 'Confirm Wave 1 initiatives and owners', 'Approved portfolio scope'],
          ['Week 1', 'Define KPI baselines and evidence owners', 'Baseline register'],
          ['Week 2', 'Run first transformation control tower', 'Decision ledger and dependency map'],
          ['Week 2', 'Prototype three signal systems', 'Line 3, supplier risk, renewal risk'],
          ['Week 3', 'Validate financial assumptions', 'Confidence-banded value view'],
          ['Week 4', 'Executive review', 'Scale, adjust or stop decisions'],
        ],
      ),
      bullets([
        'Wave 1 focuses executive attention on 5-7 initiatives, not all 20.',
        'Require confidence-banded value cases and stop rights before Gate 2 funding.',
        'Reposition the PMO as a Transformation Control Tower with explicit decision rights.',
      ]),
    ]),

    // ── What to expect (K4) ──
    section('What to Expect: One Governed Digital Transformation', 2, [
      p(
        'Adopt one explicit board narrative: Atelier Toys runs a governed digital transformation that converts distributed digital signals into reliable enterprise decisions, with measurable value in operations, digital revenue quality and enterprise risk. Every Wave 1 initiative must be expressible as a sub-thesis of that one story.',
      ),
      p(
        'Within 12-18 months, Line 3 same-shift response closes, gross renewal moves toward top quartile, the decision ledger ends reopened decisions, and role-level adoption KPIs protect 1.5-2.5 M EUR of Wave 1 value. Conservatively, one coherent narrative removes 1.4-3.3 M EUR/yr of avoidable value leakage — the compounding multiplier on the other 17 insights.',
      ),
      callout(
        'success',
        'The strongest outcome is not "we generated content." It is that Atelier converts messy executive discovery into a governed transformation portfolio — internal governance and external US stakeholder communication running off one protected evidence base.',
      ),
    ]),
  ],
};

const buf = await renderDocumentSchemaToDocxBuffer(schema as any);
const out = path.join(OUT_DIR, 'ATELIER-REPORT.docx');
await writeFile(out, buf);
console.log(`ATELIER-REPORT.docx written: ${buf.length} bytes, ${schema.sections.length} sections → ${out}`);
process.exit(0);
