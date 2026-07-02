/**
 * _atelier-deck — VEGAS/OXFORD R3: golden-path PREMIUM deck (PPTX) for the
 * Atelier Toys demo case, driven by the REAL DeckStyler pipeline
 * (deckPlansToPptxBuffer / bundlePptxRuntime).
 *
 * Content source: docs/demo/ATELIER_TOYS_INTERVIEW_FINDINGS_REPORT_GAMMA.md
 * (18 executive insights, benchmark value pools, priority matrix, 30-day plan).
 *
 * Doctrine: CONCLUSION_LAYER §W5 — every content slide title is an ACTION-TITLE
 * thesis (verb + conclusion), the sequence of titles reads as one storyline
 * (K1→K2→K3→K4), charts carry conclusion titles, and the deck CLOSES on
 * "What to do first" (K3) + "What to expect" (K4), never on "Thank you".
 * All numbers come from the findings report (engine/data), never invented here.
 *
 * RUN:  node --import tsx scripts/deliverables/_atelier-deck.mts
 * OUT:  docs/qa/deliverables/runs/ATELIER-DECK.pptx
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  deckPlansToPptxBuffer,
  type DeckPlanSlide,
} from '../../server/src/services/deliverables/bundlePptxRuntime.js';

const OUT_DIR = path.resolve('docs/qa/deliverables/runs');
const COMPANY = 'Atelier Toys';
const TITLE = 'From digital initiatives to a governed digital transformation operating model';

// ── Storyline (read titles top-to-bottom = full K1→K2→K3→K4 narrative) ────────
const PLANS: DeckPlanSlide[] = [
  {
    slideIndex: 1,
    layoutIntent: 'executive_summary',
    title: 'Atelier Toys is not digitally immature — its digital work is ungoverned',
    keyMessage:
      'Evidence base: 22 leadership personas, 440 interview answers, 18 technology insights, 20 initiatives. The ingredients of a serious digital transformation already exist; they do not yet operate as one management system.',
    bullets: [
      'Digital Twin, factory telemetry, Atelier Digital SaaS already live',
      'AI governance and OT cybersecurity investment already underway',
      'Gap is connective tissue: signals do not become governed decisions',
      'Executive layer lacks one integrated view of value, risk, adoption',
      'Good digital work underperforms because decisions arrive late',
    ],
  },
  {
    slideIndex: 2,
    layoutIntent: 'root_cause',
    title: 'The same operating-model gap recurs across every function',
    keyMessage:
      'Plant, finance, product, customer success and partners describe one shared gap from different angles: enough data to act earlier, not enough governance discipline to turn data into consistent decisions.',
    bullets: [
      'Signals arrive late — value leaks before intervention',
      'Data definitions vary — portfolio progress is not comparable',
      'Pilots lack scale gates — real gains stay unrepeatable',
      'Owners named, cross-function dependencies weak',
      'Governance is active but not yet evidence-driven',
    ],
  },
  {
    slideIndex: 3,
    layoutIntent: 'key_metrics_overview',
    title: 'Six benchmarked gaps expose 14-22 M EUR of run-rate value at stake',
    keyMessage:
      'Every theme is anchored to an anonymized top-quartile reference. The value pool is concentrated, not diffuse — which makes Wave 1 sequencing possible.',
    chartSpec: {
      type: 'bar_series',
      labels: ['Line 3 OEE', 'Renewal risk', 'Supplier risk', 'Quality CoPQ', 'Partner ramp', 'Changeover'],
      series: [{ name: 'Value at stake (M EUR/yr, midpoint)', values: [3.0, 5.0, 2.75, 1.25, 2.5, 0.85] }],
    },
  },
  {
    slideIndex: 4,
    layoutIntent: 'risk_management',
    title: 'The executive heatmap sequences Wave 1 where evidence and value both concentrate',
    keyMessage:
      'Start where evidence is strong, the value pool is material, and named owners already exist — do not wait for a perfect maturity audit before launching the first wave.',
    chartSpec: {
      type: 'harvey_balls',
      rows: [
        { label: 'Factory telemetry & Digital Twin', level: 4, note: 'High evidence · High value · Immediate' },
        { label: 'Supplier control tower', level: 4, note: 'High · High · Immediate' },
        { label: 'Digital subscription renewal risk', level: 4, note: 'High · High · Immediate' },
        { label: 'Data governance (cross-portfolio)', level: 4, note: 'High · Cross-portfolio · Immediate' },
        { label: 'Closed-loop quality', level: 3, note: 'High · Med-high · Immediate' },
        { label: 'OT cybersecurity', level: 3, note: 'High · Risk containment · Immediate' },
        { label: 'Partner activation', level: 2, note: 'Med-high · Med-high · Near term' },
      ],
    },
  },
  {
    slideIndex: 5,
    layoutIntent: 'single_insight',
    title: 'Factory telemetry is rich, but supervisors react 30 minutes after the loss',
    keyMessage:
      'Alerts exist; routing, classification and action protocols are inconsistent across shifts. A 20-30 min event-to-response lag leaks 0.8-1.2 M EUR/yr on Line 3 before changeover and downtime gains are layered in.',
    bullets: [
      'Decision required: approve a Line 3 shift-decision contract',
      'Event taxonomy + alert routing + action protocol + learning capture',
      'Fund Digital Twin as an operating system, not a dashboard',
      'Adoption KPIs sit next to outcome KPIs',
    ],
  },
  {
    slideIndex: 6,
    layoutIntent: 'single_insight',
    title: 'Atelier Digital renewal risk is detected too late to cure, only to negotiate',
    keyMessage:
      'Activation, usage, support and partner signals live in separate views; risk surfaces only after escalation. Moving gross renewal from 76-80% toward the 88-92% top-quartile reference protects 4-6 M EUR ARR.',
    bullets: [
      'Decision required: launch a renewal-risk action system',
      'Fuse usage, support, partner and account signals weekly',
      'Ship prioritized intervention list with owners and playbooks',
      'Not another analytics dashboard — an action system',
    ],
  },
  {
    slideIndex: 7,
    layoutIntent: 'single_insight',
    title: 'Data governance is the common dependency under nearly every value pool',
    keyMessage:
      'OEE, defect recurrence, supplier risk, renewal risk, partner activation and roadmap value all need one source of truth. Inconsistent definitions drag portfolio productivity 8-12% and raise US audit cost as scale grows.',
    bullets: [
      'Decision required: fund top-25 metric ownership and lineage in Wave 1',
      'Treat data governance as enabling infrastructure, not back-office',
      'Definitions, ownership, lineage, quality SLAs — the boring work',
      'Prerequisite for COPPA / FERPA-aligned US readiness',
    ],
  },
  {
    slideIndex: 8,
    layoutIntent: 'comparison',
    title: 'US expansion raises the bar: data, AI, partner and tariff readiness need evidence',
    keyMessage:
      'Atelier is genuinely strong on operations and ESG credentials, but district procurement, COPPA posture, AI use-case governance and origin-aware sourcing become contractual deal-blockers before US scale is a safe bet.',
    bullets: [
      'District & GPO contract readiness — Partial, close before scale',
      'COPPA / US state privacy posture — Needs evidence',
      'AI use-case governance for child-facing AI — Needs evidence',
      'Tariff & origin-aware procurement — Needs evidence',
      'ESG & supply-chain traceability — Yes, package as buyer asset',
    ],
  },
  {
    slideIndex: 9,
    layoutIntent: 'roadmap',
    title: 'Wave 1 focuses executive attention on seven initiatives, not twenty',
    keyMessage:
      'A portfolio can hold 20 initiatives, but executive attention should prove the operating model on the handful with clear value, named owners and a strong KPI path. Sequencing follows the priority matrix.',
    bullets: [
      '1. Line 3 Digital Twin — operational value, visible demo',
      '2. Procurement Control Tower — resilience and margin',
      '3. Renewal-Risk Action System — digital revenue quality',
      '4. Closed-Loop Quality Cockpit — prevents quality debt',
      '5-7. OT Cyber · Data Governance · Partner Activation',
    ],
  },
  {
    slideIndex: 10,
    layoutIntent: 'recommendation_single',
    title: 'What to do first: launch Wave 1 now and reposition the PMO as a control tower',
    keyMessage:
      'Evidence is decision-grade for prioritization. Start the right 30-day actions now while assigning data owners to close baseline gaps in parallel — do not wait for a full maturity audit.',
    bullets: [
      'Week 1 — confirm Wave 1 scope, owners and KPI baselines',
      'Week 2 — run first control tower; prototype 3 signal systems',
      'Week 3 — validate financials with confidence-banded value view',
      'Week 4 — executive review: scale, adjust or stop',
      'Require confidence-banded value cases before Gate 2 funding',
    ],
  },
  {
    slideIndex: 11,
    layoutIntent: 'recommendation_portfolio',
    title: 'What to expect: one board narrative that converts digital signals into governed value',
    keyMessage:
      'Adopt one thesis — Atelier runs a governed digital transformation turning distributed digital signals into reliable enterprise decisions, with measurable value in operations, digital revenue quality and enterprise risk.',
    bullets: [
      'Every Wave 1 initiative expressible as a sub-thesis of one story',
      'Decision ledger ends reopened decisions and lost momentum',
      'Adoption KPIs at role level protect 1.5-2.5 M EUR Wave 1 value',
      'US buyers, districts and partners rehearse one message back',
      'Removes 1.4-3.3 M EUR/yr of narrative-debt value leakage',
    ],
  },
];

(async () => {
  const buf = await deckPlansToPptxBuffer(PLANS, {
    themeId: 'executive',
    title: TITLE,
    company: COMPANY,
    language: 'en',
    date: '2026-07-03',
    // CONCLUSION_LAYER §W5 — decision bookend: K3 (ask) + K4 (outcome), never "Thank you".
    closingAsk: 'Launch Wave 1 now and reposition the PMO as a Transformation Control Tower',
    closingOutcome:
      'In 12-18 months, distributed digital signals become governed enterprise decisions — with one board narrative that removes 1.4-3.3 M EUR/yr of avoidable value leakage.',
  });
  if (!buf) throw new Error('deck render returned null');
  const out = path.join(OUT_DIR, 'ATELIER-DECK.pptx');
  await writeFile(out, buf);
  console.log(`ATELIER-DECK.pptx written: ${buf.length} bytes, ${PLANS.length + 1} slides → ${out}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
