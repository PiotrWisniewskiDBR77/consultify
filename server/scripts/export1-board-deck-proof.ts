import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { unifiedExportService } from '../src/services/export/UnifiedExportService.js';

const outputDir = path.resolve(process.cwd(), 'docs/program/EXPORT_1_PPTX_20260916/dowody');
const dumpSnapshot = JSON.parse(
  readFileSync(path.join(outputDir, 'northwind-dump-20260911.json'), 'utf8')
);
const oee = dumpSnapshot.oeeLine3;
const mes = dumpSnapshot.initiatives.mesLine3;
const warehouse = dumpSnapshot.initiatives.warehouseAutomation;

const buffer = await unifiedExportService.exportBoardDeckPptx({
  title: 'Northwind 2027 — Operational Maturity Assessment',
  organizationName: dumpSnapshot.organization.name,
  date: '16 September 2026',
  confidentiality: 'Confidential',
  slides: [
    {
      role: 'cover',
      kicker: 'Client final review',
      title: 'Northwind 2027 — Operational Maturity Assessment',
      subtitle: 'Northwind Manufacturing Ltd.',
    },
    {
      role: 'agenda',
      kicker: 'Agenda',
      title: 'What we will cover',
      agenda: [
        {
          number: '01',
          title: 'Where Northwind stands',
          detail: 'Maturity result across seven axes',
        },
        {
          number: '02',
          title: 'What the numbers say',
          detail: 'Eight operational KPIs against target',
        },
        { number: '03', title: 'Delivery capacity', detail: 'Role load across the programme' },
        { number: '04', title: 'Decision for the board', detail: 'Investment sequencing' },
      ],
    },
    {
      role: 'section',
      kicker: 'Section 01',
      title: 'Where Northwind stands',
      subtitle: 'Maturity result across seven axes · frozen DRD output',
    },
    {
      role: 'content-one',
      kicker: 'Maturity result',
      title: 'Level 3 on every axis — the gap is connection, not capability',
      bullets: [
        'All seven axes sit at Level 3; practices exist and repeat inside teams.',
        'Data and Value Foundation shows the widest gap to target.',
        'Strong shopfloor engineering talent cannot compensate for disconnected systems.',
      ],
      keyMessage:
        'Fix the data foundation before scaling automation or predictive maintenance spend.',
    },
    {
      role: 'content-two',
      kicker: 'Findings',
      title: 'What holds performance back — and what already works',
      columns: [
        {
          title: 'Constraints',
          bullets: [
            'Downtime reason codes are not agreed between Quality and Operations.',
            'Supplier nonconformance data is reviewed quarterly.',
            'Changeover knowledge sits with a handful of named people.',
          ],
        },
        {
          title: 'Foundations in place',
          bullets: [
            'Line 3 OEE has improved six months running.',
            'Thirteen initiatives are registered with owners and dates.',
            'Engineering and Quality already run a scored audit cadence.',
          ],
        },
      ],
    },
    {
      role: 'table',
      kicker: 'Delivery capacity',
      title: 'Load worksheet — programme roles, Sep 2026 to Mar 2027',
      table: {
        headers: ['Role', 'Team', 'FTE', 'Weeks', 'Primary focus'],
        rows: [
          ['Engagement lead', 'Consultify', 0.4, 26, 'Steering, board reporting, scope'],
          ['Operations analyst', 'Plant Operations', 1, 26, 'OEE and downtime reason codes'],
          ['Quality engineer', 'Engineering & Quality', 0.6, 20, 'Supplier NC / SPC files'],
          ['Data engineer', 'Digital and Data', 1, 24, 'Shared production/quality data layer'],
          ['OT security lead', 'Digital and Data', 0.3, 12, 'OT/IT segmentation hardening'],
        ],
        totalRow: ['Total', '5 roles', 3.3, 108, 'Peak demand falls in Q4 2026'],
        columnWidths: [2.2, 2.2, 0.8, 0.8, 5.35],
      },
      source: 'Consultify initiatives and teams; Northwind Manufacturing Ltd.',
    },
    {
      role: 'chart',
      kicker: 'Line 3 performance',
      title: 'OEE recovered 5.4 points in six months — still short of target',
      chart: {
        categories: oee.measurements.map((measurement: { period: string }) => measurement.period),
        series: [
          {
            name: 'OEE — Line 3',
            values: oee.measurements.map((measurement: { value: number }) => measurement.value),
          },
        ],
        target: oee.target,
        unit: oee.unit,
      },
      keyMessage: '76.2% latest; the remaining gap is stable and measurable.',
      source: `Northwind ${oee.code} measurements · Jan–Jun 2026 · dump 11.09`,
    },
    {
      role: 'decision',
      kicker: 'Board decision',
      title: 'Do we fund the shared data foundation ahead of the automation pilot?',
      options: [
        {
          label: 'Option A',
          title: 'Data foundation first',
          meta: `£${mes.budget / 1000}k · MES Line 3`,
          body: 'Sequence MES rollout and a shared data layer ahead of everything else.',
          recommended: true,
        },
        {
          label: 'Option B',
          title: 'Run both in parallel',
          meta: `£${(mes.budget + warehouse.budget) / 1000}k · MES + Warehouse`,
          body: 'Keep the automation pilot on current data and accept higher rework risk.',
        },
      ],
      recommendation: 'Approve Option A and hold the automation envelope unchanged.',
      decisionMeta: {
        owner: 'Board — Operations & Capital Committee',
        dueBy: '30 October 2026 (before summer shutdown planning)',
        linkedRaid: mes.risk,
      },
    },
  ],
});

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'northwind-board-deck.pptx'), buffer);
console.log(path.join(outputDir, 'northwind-board-deck.pptx'));
