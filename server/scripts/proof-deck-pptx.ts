/**
 * DOWÓD DECK PPTX 2026-07-14 — świeży dowód jakości realnego eksportu .pptx
 * (decyzja Piotra 07-14: "zrób świeży dowód PPTX vs Gamma teraz").
 *
 * Woła PRODUKCYJNĄ ścieżkę: PptxPipelineService.generateFromUnifiedJson —
 * dokładnie tę samą, którą wołają:
 *   - presentationGeneratorService (render przy tworzeniu decka),
 *   - presentations.routes.ts / regeneratePptxIfStale (re-render przed downloadem).
 *
 * Generuje DWA pliki:
 *   1. proof-deck-full.pptx  — bogaty UnifiedJSON (12 intentów, kształt jak z generatora)
 *   2. proof-deck-stale.pptx — ten sam deck przepuszczony przez deckDocumentToUnifiedJson
 *                              (ścieżka stale-regen po edycji) — dowód (nie-)degradacji treści.
 *
 * Uruchomienie:
 *   server/node_modules/.bin/tsx server/scripts/proof-deck-pptx.ts <outDir>
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { PptxPipelineService } from '../src/services/report/pptx/PptxPipelineService.js';
import type { UnifiedReportJSON } from '../src/services/report/pptx/types.js';
import {
  deckDocumentToUnifiedJson,
  type DeckDocument,
} from '../src/services/presentationDeckDocumentService.js';

const outDir = process.argv[2] || process.cwd();
fs.mkdirSync(outDir, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Reprezentatywny deck konsultingowy (realistyczne dane w stylu DBR77 Scale-Up)
// — 12 slajdów, każdy inny intent/layout: tytułowy, exec summary, section intro,
//   key messages, KPI, wykres, dwukolumnowy, heatmapa, roadmapa, ryzyka,
//   portfel inicjatyw, next steps.
// ─────────────────────────────────────────────────────────────────────────────
export const report: UnifiedReportJSON = {
  meta: {
    client: 'DBR77 Robotics Marketplace',
    project: 'Operational Scale-Up Assessment',
    date: '2026-07-14',
    author: 'Consultify',
    confidentiality: 'confidential',
    language: 'en',
    template: 'corporate',
    sourceType: 'assessment',
  },
  slides: [
    {
      intent: 'cover',
      key_message: 'Operational Scale-Up Assessment',
      content: {
        type: 'cover',
        title: 'Operational Scale-Up Assessment',
        subtitle: 'Diagnostic findings and 12-month transformation roadmap',
        organization: 'DBR77 Robotics Marketplace',
        date: '2026-07-14',
        confidentiality: 'confidential',
      },
    },
    {
      intent: 'executive_summary',
      key_message:
        'DBR77 can double marketplace revenue within 12 months, but only if fulfilment and pricing operations are industrialised first',
      content: {
        type: 'executive_summary',
        headline:
          'Revenue can double in 12 months — if fulfilment and pricing operations are industrialised first',
        kpis: [
          { name: 'Revenue growth', value: '38', unit: '%', trend: 'up', status: 'good' },
          { name: 'Quote-to-order', value: '21', unit: 'days', trend: 'flat', status: 'warning' },
          { name: 'Gross margin', value: '24', unit: '%', trend: 'down', status: 'critical' },
        ],
        key_findings: [
          'Demand is not the constraint: qualified pipeline grew 61% YoY while conversion fell from 31% to 19%',
          'Quoting is artisanal — 21-day quote-to-order cycle vs 6-day benchmark for top-quartile B2B marketplaces',
          'Margin leakage of ~PLN 2.4M/yr traced to unpriced engineering rework and ad-hoc discounts',
          'Team capability is strong but concentrated: 3 people hold 80% of integration know-how',
        ],
        recommendation:
          'Launch a 3-wave operational scale-up programme: industrialise quoting (Q3), automate fulfilment handoffs (Q4), institutionalise pricing governance (Q1 2027).',
      },
    },
    {
      intent: 'section_intro',
      key_message: 'Where the operation stands today',
      content: {
        type: 'section_intro',
        section_title: 'Diagnostic: where the operation stands today',
        section_number: 1,
        description:
          'Findings from 14 stakeholder interviews, transaction data 2024-2026 and process walkthroughs across sales, engineering and fulfilment.',
      },
    },
    {
      intent: 'key_messages',
      key_message: 'Three structural bottlenecks cap growth at ~40% YoY',
      content: {
        type: 'key_messages',
        messages: [
          {
            title: 'Quoting bottleneck',
            description:
              'Every quote passes through senior engineers; 68% of engineering hours go to pre-sales instead of delivery.',
          },
          {
            title: 'Fulfilment handoffs',
            description:
              'Five manual handoffs between order and installation; each adds 2-4 days and a 12% error rate.',
          },
          {
            title: 'Pricing discipline',
            description:
              'No price floor governance — 41% of deals close below target margin, mostly without approval trail.',
          },
        ],
      },
    },
    {
      intent: 'performance_overview',
      key_message: 'Growth is masking a margin problem',
      content: {
        type: 'performance_overview',
        period: 'FY2025 vs FY2024',
        kpis: [
          { name: 'Marketplace GMV', value: 'PLN 41M', trend: 'up', delta: '+38%', status: 'good' },
          { name: 'Gross margin', value: '24%', trend: 'down', delta: '-6 p.p.', status: 'critical' },
          { name: 'Quote-to-order', value: '21 days', trend: 'flat', delta: '0', status: 'warning' },
          { name: 'Repeat-buyer share', value: '34%', trend: 'up', delta: '+9 p.p.', status: 'good' },
        ],
        context: 'Top-line growth is healthy, but unit economics deteriorate with every incremental order.',
      },
    },
    {
      intent: 'single_insight',
      key_message: 'Conversion collapses exactly where quoting effort peaks',
      content: {
        type: 'single_insight',
        chart_type: 'bar',
        chart_data: {
          labels: ['Lead', 'Qualified', 'Quoted', 'Negotiated', 'Won'],
          series: [
            { name: 'FY2024', values: [100, 64, 48, 39, 31] },
            { name: 'FY2025', values: [100, 71, 42, 27, 19] },
          ],
        },
        insight_text:
          'Funnel conversion fell 12 p.p. YoY, and the entire drop happens between qualification and negotiation — the stages owned by the manual quoting process. Fixing quoting alone recovers an estimated PLN 7-9M GMV.',
        source: 'CRM export 2024-2026, n=1,847 opportunities',
      },
    },
    {
      intent: 'comparison',
      key_message: 'Current quoting model vs industrialised target model',
      content: {
        type: 'comparison',
        left_label: 'Today: artisanal quoting',
        right_label: 'Target: industrialised quoting',
        left_items: [
          'Senior engineer builds every quote from scratch',
          '21-day median quote-to-order cycle',
          'Pricing decided deal-by-deal, no floor',
          'Tribal knowledge, zero reuse between quotes',
        ],
        right_items: [
          'Configurator covers 70% of standard robot cells',
          '6-day cycle for standard, 12-day for custom',
          'Price floors enforced with exception workflow',
          'Quote library with win/loss feedback loop',
        ],
        verdict: 'The target model frees ~9,500 engineering hours/year for billable delivery.',
      },
    },
    {
      intent: 'assessment',
      key_message: 'Operational maturity: strong commercial engine, weak industrial backbone',
      content: {
        type: 'assessment',
        matrix_type: 'maturity',
        scale_max: 5,
        overall_score: 2.8,
        axes: [
          { axisId: 'sales', axisName: 'Sales & demand generation', score: 4.1, maxScore: 5, target: 4.5 },
          { axisId: 'quoting', axisName: 'Quoting & configuration', score: 1.9, maxScore: 5, target: 4.0 },
          { axisId: 'fulfilment', axisName: 'Fulfilment & installation', score: 2.3, maxScore: 5, target: 4.0 },
          { axisId: 'pricing', axisName: 'Pricing governance', score: 1.7, maxScore: 5, target: 3.5 },
          { axisId: 'data', axisName: 'Data & systems', score: 2.6, maxScore: 5, target: 4.0 },
          { axisId: 'people', axisName: 'People & capability', score: 3.4, maxScore: 5, target: 4.0 },
        ],
      },
    },
    {
      intent: 'roadmap',
      key_message: '12-month programme in three waves',
      content: {
        type: 'roadmap',
        phases: [
          {
            label: 'Wave 1 — Industrialise quoting',
            timeframe: 'Q3 2026',
            status: 'in_progress',
            items: ['Deploy configurator for top-20 cell types', 'Quote library + reuse workflow', 'Price floor policy v1'],
          },
          {
            label: 'Wave 2 — Automate fulfilment',
            timeframe: 'Q4 2026',
            status: 'planned',
            items: ['Order-to-installation digital handoffs', 'Partner SLA scorecards', 'Exception dashboard'],
          },
          {
            label: 'Wave 3 — Institutionalise pricing',
            timeframe: 'Q1 2027',
            status: 'planned',
            items: ['Deal-desk with approval matrix', 'Win/loss pricing analytics', 'Margin bridge reporting'],
          },
        ],
      },
    },
    {
      intent: 'risk_management',
      key_message: 'Four risks could stall the programme — all have owners and mitigations',
      content: {
        type: 'risk_management',
        risks: [
          {
            risk: 'Key-person dependency: 3 engineers hold 80% of integration know-how',
            likelihood: 'high',
            impact: 'high',
            mitigation: 'Knowledge-capture sprints in Wave 1; pair every quote with a junior',
            owner: 'CTO',
          },
          {
            risk: 'Configurator scope creep delays Wave 1 beyond Q3',
            likelihood: 'medium',
            impact: 'high',
            mitigation: 'Freeze scope at top-20 cell types; anything else goes to backlog',
            owner: 'Programme lead',
          },
          {
            risk: 'Sales resists price floors and routes around deal desk',
            likelihood: 'medium',
            impact: 'medium',
            mitigation: 'Commission model tied to margin, not GMV, from Q4',
            owner: 'CRO',
          },
          {
            risk: 'Partner network capacity insufficient for 2x volume',
            likelihood: 'low',
            impact: 'high',
            mitigation: 'Certify 6 new installation partners by Q1 2027',
            owner: 'COO',
          },
        ],
      },
    },
    {
      intent: 'initiative_portfolio',
      key_message: 'Six initiatives, sequenced by dependency and payback',
      content: {
        type: 'initiative_portfolio',
        initiatives: [
          {
            name: 'Robot-cell configurator',
            summary: 'Self-service configuration for 70% of standard quotes',
            strategicIntent: 'Fix',
            priority: 'critical',
            timeline: 'Q3 2026',
            impact: 5,
            effort: 4,
            budget: 'PLN 850k',
            roi: '4.2x / 18m',
            owner: 'CTO',
          },
          {
            name: 'Deal-desk & price floors',
            summary: 'Approval matrix and exception workflow for sub-floor pricing',
            strategicIntent: 'Fix',
            priority: 'critical',
            timeline: 'Q3-Q4 2026',
            impact: 4,
            effort: 2,
            budget: 'PLN 120k',
            roi: '11x / 12m',
            owner: 'CRO',
          },
          {
            name: 'Fulfilment digital handoffs',
            summary: 'Replace 5 manual handoffs with orchestrated workflow',
            strategicIntent: 'Stabilize',
            priority: 'high',
            timeline: 'Q4 2026',
            impact: 4,
            effort: 3,
            budget: 'PLN 430k',
            roi: '3.1x / 24m',
            owner: 'COO',
          },
          {
            name: 'Knowledge-capture programme',
            summary: 'De-risk key-person dependency in integration engineering',
            strategicIntent: 'De-risk',
            priority: 'high',
            timeline: 'Q3 2026',
            impact: 3,
            effort: 2,
            budget: 'PLN 90k',
            roi: 'risk-avoidance',
            owner: 'CTO',
          },
        ],
      },
    },
    {
      intent: 'next_steps',
      key_message: 'Decisions needed this month to hit Q3 start',
      content: {
        type: 'next_steps',
        actions: [
          { action: 'Approve Wave 1 budget (PLN 970k) and programme charter', owner: 'Board', deadline: '2026-07-25', status: 'pending' },
          { action: 'Nominate programme lead and deal-desk owner', owner: 'CEO', deadline: '2026-07-31', status: 'pending' },
          { action: 'Freeze top-20 cell-type list for configurator scope', owner: 'CTO', deadline: '2026-08-08', status: 'pending' },
          { action: 'Kick off knowledge-capture sprint #1', owner: 'CTO', deadline: '2026-08-15', status: 'pending' },
        ],
        closing_message: 'Every month of delay costs an estimated PLN 600-750k in recoverable GMV.',
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) Ten sam deck jako DeckDocument → deckDocumentToUnifiedJson (ścieżka
//    stale-regen z presentations.routes.ts) — dowód co dostaje klient po edycji.
// ─────────────────────────────────────────────────────────────────────────────
function toDeckDocument(r: UnifiedReportJSON): DeckDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    deck_id: 'proof-deck',
    deckId: 'proof-deck',
    organization_id: 'org-proof',
    title: r.meta.project,
    theme_id: 'default',
    presentation_mode: 'briefing',
    communication_register: 'professional',
    image_style_preset: 'minimal_no_images',
    color_set_id: 'brand_kit',
    status: 'ready',
    card_size: '16:9',
    cards: r.slides.map((s, i) => ({
      card_id: `card-${i}`,
      deck_id: 'proof-deck',
      order_index: i,
      intent: s.intent,
      layout_id: 'auto',
      title: s.key_message,
      key_message: s.key_message,
      blocks: [
        {
          block_id: `b-${i}`,
          card_id: `card-${i}`,
          type: 'body',
          content: { text: JSON.stringify(s.content).slice(0, 400) },
          is_refreshable: false,
          position: { area: 'full', order: 0 },
          ai_editable: true,
        },
      ],
      source_refs: [],
      has_refreshable_data: false,
      background: { type: 'theme' },
      animations: { entrance: 'none', block_stagger: false },
      is_locked: false,
    })),
    source_refs: [],
    generation_settings: {
      text_mode: 'preserve',
      content_depth: 'concise',
      audience: 'board',
      tone: 'professional',
      language: 'en',
      image_source: 'none',
    },
    animations_enabled: false,
    share_settings: { is_shared: false, permissions: 'view' },
    speaker_notes_generated: false,
    meta: {
      title: r.meta.project,
      deckType: 'assessment',
      language: 'en',
      confidentiality: 'confidential',
      theme: 'corporate',
    },
    lifecycle: { status: 'ready', createdAt: now, updatedAt: now, exportedAt: null },
    generation: { outline: [], generationSettings: {}, warnings: [] },
    delivery: { exportFormat: 'pptx', exportPath: null },
    traceability: { sourceRefs: [], sourceArtifacts: [] },
    ai: { reviewState: 'clean' },
    created_by: 'proof-script',
    created_at: now,
    updated_at: now,
  };
}

async function main() {
  const pipeline = new PptxPipelineService();

  // (1) Ścieżka główna — bogaty UnifiedJSON (kształt jak z presentationGeneratorService)
  const full = await pipeline.generateFromUnifiedJson(report, {
    template: 'corporate',
    language: 'en',
    confidentiality: 'confidential',
  });
  const fullPath = path.join(outDir, 'proof-deck-full.pptx');
  fs.writeFileSync(fullPath, full.buffer);
  console.log(`FULL : ${fullPath} (${full.buffer.length} B, ${full.slideCount} slides)`);
  console.log(`  validation.valid=${full.validation.valid}`);
  for (const v of full.validation.violations) console.log(`  [${v.severity}] ${v.message}`);
  for (const w of full.warnings) console.log(`  [warn] ${w}`);

  // (2) Ścieżka stale-regen — deck_json → deckDocumentToUnifiedJson → pipeline
  const staleUnified = deckDocumentToUnifiedJson(toDeckDocument(report));
  const stale = await pipeline.generateFromUnifiedJson(staleUnified, {
    template: 'corporate',
    language: 'en',
    confidentiality: 'confidential',
    skipValidation: true, // dokładnie jak w regeneratePptxIfStale
  });
  const stalePath = path.join(outDir, 'proof-deck-stale.pptx');
  fs.writeFileSync(stalePath, stale.buffer);
  console.log(`STALE: ${stalePath} (${stale.buffer.length} B, ${stale.slideCount} slides)`);
  const staleIntents = staleUnified.slides.map((s) => `${s.intent}→${(s.content as any).type}`);
  console.log('  stale intent→content.type map:');
  for (const line of staleIntents) console.log(`    ${line}`);
}

// Run only when executed directly (the deck data is also imported by
// proof-stale-regen-fix.ts — dowód PRZED/PO fixa stale-regen 2026-07-14).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('PROOF FAILED:', err);
    process.exit(1);
  });
}
