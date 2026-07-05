/**
 * _atelier-table — VEGAS/OXFORD R3: golden-path PREMIUM workbook (XLSX) for the
 * Atelier Toys demo case, driven by the REAL builder + styler
 * (buildWorkbookBuffer + WorkbookStyler): navy headers, locale currency,
 * per-type alignment, banded rows, color scales, conditional formatting, and a
 * leading Info metadata sheet — a FORMATTED workbook, not a bare grid.
 *
 * Content source: docs/demo/ATELIER_TOYS_INTERVIEW_FINDINGS_REPORT_GAMMA.md.
 * All numbers come from the findings report; the workbook only structures them.
 *
 * Three sheets:
 *   1. Wave 1 Portfolio — 7 initiatives, priority, value at stake, status (CF).
 *   2. Value at Stake   — benchmarked gaps, current vs top-quartile, EUR pool.
 *   3. US Readiness      — Yes/Partial/Needs-evidence matrix with owners (CF).
 *
 * RUN:  node --import tsx scripts/deliverables/_atelier-table.mts
 * OUT:  docs/qa/deliverables/runs/ATELIER-TABLE.xlsx
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildWorkbookBuffer } from '../../server/src/services/workbook/WorkbookBuilder.js';
import type { WorkbookSchema } from '../../server/src/services/workbook/WorkbookSchema.js';

const OUT_DIR = path.resolve('docs/qa/deliverables/runs');

// Helper — build a row from a flat record of key→value.
const row = (cells: Record<string, string | number>) => ({
  cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, { value: v }])),
});

const schema: WorkbookSchema = {
  title: 'Atelier Toys — Digital Transformation Portfolio (Volume I)',
  description:
    'Wave 1 portfolio, benchmarked value at stake, and US readiness matrix — derived from 22 leadership personas, 440 interview answers, 18 technology insights.',
  author: 'Consultify',
  metadata: { source: 'ATELIER_TOYS_INTERVIEW_FINDINGS_REPORT', classification: 'client_confidential' },
  sheets: [
    // ── Sheet 1: Wave 1 Portfolio ──
    {
      name: 'Wave 1 Portfolio',
      purpose: 'Executive Wave 1 initiatives with priority, value pool and status.',
      freezeRow: 1,
      tabColor: '0C447C',
      columns: [
        { key: 'priority', header: 'Priority', type: 'number' },
        { key: 'initiative', header: 'Initiative', type: 'text' },
        { key: 'owner', header: 'Owner profile', type: 'text' },
        { key: 'valueLow', header: 'Value low (M EUR/yr)', type: 'currency' },
        { key: 'valueHigh', header: 'Value high (M EUR/yr)', type: 'currency' },
        { key: 'urgency', header: 'Urgency', type: 'text' },
        { key: 'status', header: 'Status', type: 'text' },
      ],
      conditionalFormatting: [
        {
          ref: 'G2:G8',
          rules: [
            { type: 'cellIs', operator: 'equal', formulae: ['"At Risk"'], style: { bgColor: 'FCE4E4', fontColor: '85182F', bold: true } },
            { type: 'cellIs', operator: 'equal', formulae: ['"On Track"'], style: { bgColor: 'E4F4EC', fontColor: '1D7A54' } },
            { type: 'cellIs', operator: 'equal', formulae: ['"Executing"'], style: { bgColor: 'E8EEF6', fontColor: '0C447C' } },
          ],
        },
      ],
      rows: [
        row({ priority: 1, initiative: 'Line 3 Digital Twin', owner: 'Plant + CTO', valueLow: 2.4, valueHigh: 3.6, urgency: 'Immediate', status: 'Executing' }),
        row({ priority: 2, initiative: 'Procurement Control Tower', owner: 'Procurement + CFO', valueLow: 2.0, valueHigh: 3.5, urgency: 'Immediate', status: 'On Track' }),
        row({ priority: 3, initiative: 'Renewal-Risk Action System', owner: 'Product + Customer Success', valueLow: 4.0, valueHigh: 6.0, urgency: 'Immediate', status: 'At Risk' }),
        row({ priority: 4, initiative: 'Closed-Loop Quality Cockpit', owner: 'QA + Engineering', valueLow: 0.9, valueHigh: 1.6, urgency: 'Immediate', status: 'On Track' }),
        row({ priority: 5, initiative: 'OT Cyber Hardening', owner: 'OT Security + CTO', valueLow: 5.0, valueHigh: 10.0, urgency: 'Immediate', status: 'On Track' }),
        row({ priority: 6, initiative: 'Data Governance Backbone', owner: 'Industrial Data Lead', valueLow: 1.5, valueHigh: 2.5, urgency: 'Immediate', status: 'Executing' }),
        row({ priority: 7, initiative: 'Partner Activation System', owner: 'Partner Program + CS', valueLow: 2.0, valueHigh: 3.0, urgency: 'Near term', status: 'At Risk' }),
      ],
    },

    // ── Sheet 2: Value at Stake (benchmarks) ──
    {
      name: 'Value at Stake',
      purpose: 'Benchmarked gaps: current vs anonymized top-quartile reference and EUR pool.',
      freezeRow: 1,
      tabColor: '1D9E75',
      columns: [
        { key: 'theme', header: 'Theme', type: 'text' },
        { key: 'current', header: 'Atelier today', type: 'text' },
        { key: 'benchmark', header: 'Top-quartile ref.', type: 'text' },
        { key: 'poolLow', header: 'Pool low (M EUR)', type: 'currency' },
        { key: 'poolHigh', header: 'Pool high (M EUR)', type: 'currency' },
        { key: 'gapScore', header: 'Gap severity (0-100)', type: 'number' },
        // No explicit CF on this column → exercises AUTO status-semaphore path.
        { key: 'health', header: 'Health', type: 'text' },
      ],
      rows: [
        row({ theme: 'Line 3 OEE', current: '62-66%', benchmark: '78-82%', poolLow: 2.4, poolHigh: 3.6, gapScore: 82, health: 'At Risk' }),
        row({ theme: 'Digital gross renewal', current: '76-80%', benchmark: '88-92%', poolLow: 4.0, poolHigh: 6.0, gapScore: 90, health: 'At Risk' }),
        row({ theme: 'Supplier risk governance', current: 'Visible, not governed', benchmark: 'War-room + escalation', poolLow: 2.0, poolHigh: 3.5, gapScore: 74, health: 'In Progress' }),
        row({ theme: 'Repeat defect rate', current: '9-12%', benchmark: '3-4%', poolLow: 0.9, poolHigh: 1.6, gapScore: 68, health: 'In Progress' }),
        row({ theme: 'Partner 90-day activation', current: '~50% productive', benchmark: '75%', poolLow: 2.0, poolHigh: 3.0, gapScore: 66, health: 'On Track' }),
        row({ theme: 'Changeover time', current: '16-20 min', benchmark: '8-10 min', poolLow: 0.6, poolHigh: 1.1, gapScore: 60, health: 'On Track' }),
        // Accounting TOTAL row — WorkbookBuilder bolds it and adds a top rule.
        {
          cells: {
            theme: { value: 'TOTAL' },
            current: { value: '' },
            benchmark: { value: '' },
            poolLow: { formula: 'SUM(D2:D7)' },
            poolHigh: { formula: 'SUM(E2:E7)' },
            gapScore: { formula: 'ROUND(AVERAGE(F2:F7),0)' },
            health: { value: '' },
          },
        },
      ],
    },

    // ── Sheet 3: US Readiness ──
    {
      name: 'US Readiness',
      purpose: 'US enterprise-readiness matrix with gap-to-close and owner.',
      freezeRow: 1,
      tabColor: '64748B',
      columns: [
        { key: 'requirement', header: 'US requirement', type: 'text' },
        { key: 'today', header: 'Atelier today', type: 'text' },
        { key: 'gap', header: 'Gap to close before scale', type: 'text' },
        { key: 'owner', header: 'Owner of closure', type: 'text' },
      ],
      conditionalFormatting: [
        {
          ref: 'B2:B11',
          rules: [
            { type: 'cellIs', operator: 'equal', formulae: ['"Needs evidence"'], style: { bgColor: 'FCE4E4', fontColor: '85182F', bold: true } },
            { type: 'cellIs', operator: 'equal', formulae: ['"Partial"'], style: { bgColor: 'FDF3E0', fontColor: '9A6A00' } },
            { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], style: { bgColor: 'E4F4EC', fontColor: '1D7A54', bold: true } },
          ],
        },
      ],
      rows: [
        row({ requirement: 'District & GPO contract readiness', today: 'Partial', gap: 'Standardized contract pack + evidence library', owner: 'Partner Program + Legal' }),
        row({ requirement: 'COPPA & US state privacy posture', today: 'Needs evidence', gap: 'Documented child-data flows, DPIAs, district addenda', owner: 'Industrial Data Lead + Legal' }),
        row({ requirement: 'FERPA / SOPIPA addenda for Atelier Digital', today: 'Partial', gap: 'Standard rider, vendor pack, retention SLAs', owner: 'Data Lead + Customer Success' }),
        row({ requirement: 'AI use-case governance (child-facing)', today: 'Needs evidence', gap: 'Approved use-case registry, data boundary, audit trail', owner: 'CTO + OT Security + CFO' }),
        row({ requirement: 'OT & product cybersecurity posture', today: 'Partial', gap: 'Wave 1 OT hardening floor + audit-ready pack', owner: 'OT Security + CTO' }),
        row({ requirement: 'Tariff & origin-aware procurement', today: 'Needs evidence', gap: 'Origin-aware scorecards, scenario model, playbook', owner: 'Procurement + CFO' }),
        row({ requirement: 'Learning-outcome evidence', today: 'Partial', gap: 'Outcome studies, references, longitudinal usage', owner: 'Customer Success + Marketing' }),
        row({ requirement: 'LMS / SSO / rostering integrations', today: 'Partial', gap: 'Standard integration pack + certification status', owner: 'CTO + Customer Success' }),
        row({ requirement: 'ESG & supply-chain traceability', today: 'Yes', gap: 'Package as buyer asset, not compliance topic', owner: 'Marketing + Sustainability' }),
        row({ requirement: 'US partner activation system', today: 'Needs evidence', gap: 'Activation scorecard, proof assets, cohorts', owner: 'Partner Program + Customer Success' }),
      ],
    },
  ],
};

const buf = await buildWorkbookBuffer(schema, {
  applyConsultantStyling: true,
  meta: {
    organizationName: 'Atelier Toys',
    source: 'ATELIER_TOYS_INTERVIEW_FINDINGS_REPORT (Volume I)',
    generatedAt: '2026-07-03',
  },
});
const out = path.join(OUT_DIR, 'ATELIER-TABLE.xlsx');
await writeFile(out, buf);
console.log(`ATELIER-TABLE.xlsx written: ${buf.length} bytes, ${schema.sheets.length} sheets (+ Info) → ${out}`);
process.exit(0);
