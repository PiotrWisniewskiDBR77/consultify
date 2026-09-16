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
          ['Operations analyst', 'Northwind', 1, 26],
        ],
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
          body: 'Sequence MES rollout and the shared data layer.',
          recommended: true,
        },
        {
          label: 'Option B',
          title: 'Run both in parallel',
          body: 'Keep the pilot on current data.',
        },
      ],
      recommendation: 'Approve Option A and hold the automation envelope unchanged.',
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
});
