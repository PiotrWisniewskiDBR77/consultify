/** @vitest-environment node */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { BOARD_DECK_LAYOUT_ROLES, unifiedExportService } from '../UnifiedExportService.js';

const deck = {
  title: 'Northwind 2027 — Operational Maturity Assessment',
  organizationName: 'Northwind Manufacturing Ltd.',
  date: '16 September 2026',
  confidentiality: 'Confidential',
  slides: [
    {
      role: 'cover' as const,
      title: 'Northwind 2027 — Operational Maturity Assessment',
      subtitle: 'Northwind Manufacturing Ltd.',
    },
    {
      role: 'agenda' as const,
      kicker: 'Agenda',
      title: 'What we will cover',
      agenda: [{ title: 'Where Northwind stands', detail: 'Maturity result across seven axes' }],
    },
    {
      role: 'section' as const,
      kicker: 'Section 01',
      title: 'Where Northwind stands',
      subtitle: 'Maturity result across seven axes',
    },
    {
      role: 'content-one' as const,
      kicker: 'Maturity result',
      title: 'Level 3 on every axis — the gap is connection, not capability',
      bullets: ['All seven axes sit at Level 3.', 'Practices are not connected across functions.'],
      keyMessage: 'Fix the data foundation before scaling automation.',
    },
    {
      role: 'content-two' as const,
      kicker: 'Findings',
      title: 'What holds performance back — and what already works',
      columns: [
        { title: 'Constraints', bullets: ['Downtime reason codes are inconsistent.'] },
        { title: 'Foundations in place', bullets: ['Line 3 OEE has improved.'] },
      ],
    },
    {
      role: 'table' as const,
      kicker: 'Delivery capacity',
      title: 'Load worksheet — programme roles',
      table: {
        headers: ['Role', 'Team', 'FTE', 'Weeks'],
        rows: [
          ['Engagement lead', 'Consultify', 0.4, 26],
          ['Operations analyst', 'Northwind Manufacturing — Leeds & Rotherham', 1, 26],
          ['Quality engineer', 'Engineering & Quality', 0.6, 20],
          ['Data engineer', 'Digital and Data', 1, 24],
          ['OT security lead', 'Digital and Data', 0.3, 12],
        ],
        totalRow: ['Total', '5 roles', 3.3, 108],
      },
      source: 'Consultify initiatives and teams',
    },
    {
      role: 'chart' as const,
      kicker: 'Line 3 performance',
      title: 'OEE recovered 5.4 points in six months',
      chart: {
        categories: ['Jan', 'Feb', 'Mar'],
        series: [{ name: 'OEE', values: [70.8, 71.6, 72.9] }],
        target: 78,
        unit: '%',
      },
      keyMessage: 'Latest: 72.9%',
      source: 'KPI measurements',
    },
    {
      role: 'decision' as const,
      kicker: 'Board decision',
      title: 'Do we fund the shared data foundation?',
      options: [
        {
          label: 'Option A',
          title: 'Data foundation first',
          meta: '£410k · MES Line 3',
          body: 'Sequence MES rollout and the shared data layer.',
          recommended: true,
        },
        {
          label: 'Option B',
          title: 'Run both in parallel',
          meta: '£930k · MES + Warehouse',
          body: 'Keep the pilot on current data.',
        },
      ],
      recommendation: 'Approve Option A and hold the automation envelope unchanged.',
      decisionMeta: {
        owner: 'Board — Operations & Capital Committee',
        dueBy: '30 October 2026',
        linkedRaid: 'Line 3 cutover slips past the summer shutdown window',
      },
    },
  ],
};

async function packageXml(buffer: Buffer): Promise<{ zip: JSZip; xml: string }> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => name.endsWith('.xml'));
  const xml = (await Promise.all(names.map((name) => zip.file(name)!.async('string')))).join('\n');
  return { zip, xml };
}

describe('EXPORT-1 board deck renderer', () => {
  it('renders all eight approved slide roles through UnifiedExportService', async () => {
    const buffer = await unifiedExportService.exportBoardDeckPptx(deck);
    const { zip, xml } = await packageXml(buffer);
    const slides = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name)
    );
    const layouts = Object.keys(zip.files).filter((name) =>
      /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)
    );
    const masters = Object.keys(zip.files).filter((name) =>
      /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)
    );

    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(slides).toHaveLength(8);
    expect(BOARD_DECK_LAYOUT_ROLES).toEqual([
      'cover',
      'agenda',
      'section',
      'content-one',
      'content-two',
      'table',
      'chart',
      'decision',
    ]);
    expect(layouts).toHaveLength(1);
    expect(masters).toHaveLength(1);
  });

  it('writes Aptos in the theme and leaves text runs theme-driven', async () => {
    const { zip } = await packageXml(await unifiedExportService.exportBoardDeckPptx(deck));
    const theme = await zip.file('ppt/theme/theme1.xml')!.async('string');
    const slideXml = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .map((name) => zip.file(name)!.async('string'))
      )
    ).join('\n');

    expect(theme).toContain('Aptos');
    expect(slideXml).not.toMatch(/typeface=/i);
    expect(slideXml).not.toContain('85182F');
  });

  it('keeps the table and chart editable and repeats the co-brand footer', async () => {
    const { zip, xml } = await packageXml(await unifiedExportService.exportBoardDeckPptx(deck));
    expect(xml).toContain('<a:tbl>');
    expect(
      Object.keys(zip.files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))
    ).toHaveLength(1);

    const slideEight = await zip.file('ppt/slides/slide8.xml')!.async('string');
    expect(slideEight).toContain('Consultify');
    expect(slideEight).toContain('Northwind Manufacturing Ltd.');
    expect(slideEight).toContain('Confidential');
  });

  it('matches the accepted composition contract for slides 4 and 6–8', async () => {
    const { zip, xml } = await packageXml(await unifiedExportService.exportBoardDeckPptx(deck));
    const slideFour = await zip.file('ppt/slides/slide4.xml')!.async('string');
    const slideSix = await zip.file('ppt/slides/slide6.xml')!.async('string');
    const slideEight = await zip.file('ppt/slides/slide8.xml')!.async('string');
    const chartName = Object.keys(zip.files).find((name) =>
      /^ppt\/charts\/chart\d+\.xml$/.test(name)
    );
    expect(chartName).toBeDefined();
    const chart = await zip.file(chartName!)!.async('string');

    const rowHeights = [...slideSix.matchAll(/<a:tr h="(\d+)"/g)].map((match) => Number(match[1]));
    expect(rowHeights).toHaveLength(7);
    expect(new Set(rowHeights).size).toBeGreaterThan(1);
    expect(Math.max(...rowHeights)).toBeLessThan(914400);
    expect(slideSix).toContain('DCE6FA');
    expect(slideSix).toContain('F1F4F8');

    expect(chart.match(/<c:ser>/g) || []).toHaveLength(2);
    expect(chart).toContain('2563EB');
    expect(chart).toContain('667085');
    expect(chart).toMatch(/<c:showVal val="1"\/>/);

    expect(slideFour).toContain('SO WHAT');
    expect(slideEight).toContain('£410k · MES Line 3');
    expect(slideEight).toContain('DECISION OWNER');
    expect(slideEight).toContain('DUE BY');
    expect(slideEight).toContain('LINKED RAID');
    expect(slideEight).toContain('DCE6FA');
    expect(xml).not.toMatch(/typeface="Arial"/i);
  });
});
