// @vitest-environment node
/**
 * Anti-false-green unit tests for the "equity-research grade" workbook
 * primitives (EQ-A scenario switch, EQ-B sensitivity table, EQ-C chart image).
 *
 * Every assertion targets a REAL .xlsx built by buildWorkbookBuffer() and read
 * back via ExcelJS + raw-XML unzip. These are RED on the base branch:
 *   - the schema did not know `scenarioSwitch` / `sensitivityTables` /
 *     `chartImages`, so the builder never emitted the CHOOSE/MATCH formulas,
 *     the grid of formulas, or the image — and the read-back assertions fail.
 * They are GREEN after this change.
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';

// 1x1 transparent PNG (base64, no data-URI prefix).
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const EQ_SEED: WorkbookSchema = {
  title: 'Equity model — scenario switch + sensitivity',
  description: 'P&L Base/Bull/Bear switch + EBITDA sensitivity grid',
  author: 'tests',
  sheets: [
    {
      name: 'P&L',
      columns: [
        { key: 'pozycja', header: 'Pozycja', type: 'text' },
        { key: 'active', header: 'Active', type: 'number' },
        { key: 'base', header: 'Base', type: 'number' },
        { key: 'bull', header: 'Bull', type: 'number' },
        { key: 'bear', header: 'Bear', type: 'number' },
      ],
      rows: [
        { cells: { pozycja: { value: 'Revenue (base yr)' }, active: { value: 1000000 } } },
        { cells: { pozycja: { value: 'Placeholder' }, active: { value: 0 } } },
      ],
      scenarioSwitch: {
        scenarios: ['Base', 'Bull', 'Bear'],
        active: 'Bull',
        labelColumn: 'pozycja',
        activeColumn: 'active',
        scenarioColumns: ['base', 'bull', 'bear'],
        selectorLabel: 'Scenariusz',
        drivers: [
          {
            label: 'Revenue growth %',
            values: [0.05, 0.12, -0.02],
            numberFormat: '0.0%',
            namePrefix: 'RevGrowth',
          },
          {
            label: 'EBITDA margin %',
            values: [0.18, 0.24, 0.12],
            numberFormat: '0.0%',
            namePrefix: 'EbitdaMargin',
          },
        ],
      },
      sensitivityTables: [
        {
          title: 'EBITDA sensitivity (growth × margin)',
          anchorCell: 'H3',
          cornerLabel: 'EBITDA →',
          colInputs: [0.0, 0.05, 0.1, 0.15],
          rowInputs: [0.1, 0.15, 0.2, 0.25],
          outputFormulaTemplate: '1000000 * (1 + {col}) * {row}',
          numberFormat: '#,##0',
          headerNumberFormat: '0.0%',
        },
      ],
      chartImages: [{ pngBase64: TINY_PNG, anchorCell: 'H12', width: 320, height: 200 }],
    },
  ],
};

async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

// -------------------------------------------------------------------------
// Schema — the base branch does not know these keys, so a strict round-trip
// through the validator drops them; after the change they survive.
// -------------------------------------------------------------------------

describe('EQ schema — new primitives are accepted & preserved', () => {
  it('scenarioSwitch survives validation', () => {
    const parsed = WorkbookSchemaValidator.parse(EQ_SEED);
    expect(parsed.sheets[0].scenarioSwitch).toBeDefined();
    expect(parsed.sheets[0].scenarioSwitch!.scenarios).toEqual(['Base', 'Bull', 'Bear']);
  });

  it('sensitivityTables + chartImages survive validation', () => {
    const parsed = WorkbookSchemaValidator.parse(EQ_SEED);
    expect(parsed.sheets[0].sensitivityTables).toHaveLength(1);
    expect(parsed.sheets[0].chartImages).toHaveLength(1);
  });
});

// -------------------------------------------------------------------------
// EQ-A — Scenario switch
// -------------------------------------------------------------------------

describe('EQ-A — scenario switch (dropdown + CHOOSE/MATCH + named ranges)', () => {
  it('emits a dropdown selector cell (Base/Bull/Bear list)', async () => {
    const buf = await buildWorkbookBuffer(EQ_SEED, { applyConsultantStyling: true });
    const wb = await load(buf);
    const ws = wb.getWorksheet('P&L')!;

    let found: any = null;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const dv: any = (cell as any).dataValidation;
        if (dv && dv.type === 'list' && String(dv.formulae?.[0] ?? '').includes('Bull')) {
          found = { addr: cell.address, value: cell.value, list: dv.formulae[0] };
        }
      });
    });
    expect(found).not.toBeNull();
    expect(found.value).toBe('Bull'); // honored `active`
    expect(found.list).toContain('Base');
    expect(found.list).toContain('Bear');
  });

  it('writes a CHOOSE(MATCH(...)) selection formula per driver, targeting the scenario band', async () => {
    const buf = await buildWorkbookBuffer(EQ_SEED, { applyConsultantStyling: true });
    const wb = await load(buf);
    const ws = wb.getWorksheet('P&L')!;

    const chooseCells: Array<{ addr: string; f: string }> = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const v: any = cell.value;
        if (
          v &&
          typeof v === 'object' &&
          typeof v.formula === 'string' &&
          v.formula.includes('CHOOSE')
        ) {
          chooseCells.push({ addr: cell.address, f: v.formula });
        }
      });
    });
    // 2 drivers → 2 CHOOSE formulas.
    expect(chooseCells).toHaveLength(2);
    for (const c of chooseCells) {
      expect(c.f).toMatch(/^CHOOSE\(MATCH\(\$[A-Z]+\$\d+,\{/);
      // The CHOOSE must reference all THREE scenario-band columns (C, D, E) —
      // proof the selector re-points across 3 columns, not 1.
      expect(c.f).toMatch(/\$C\$\d+/);
      expect(c.f).toMatch(/\$D\$\d+/);
      expect(c.f).toMatch(/\$E\$\d+/);
    }
  });

  it('creates named ranges spanning 3 DISTINCT scenario columns (not 1)', async () => {
    const buf = await buildWorkbookBuffer(EQ_SEED, { applyConsultantStyling: true });
    const wb = await load(buf);

    const defModel: any = (wb as any).definedNames?.model ?? [];
    const scenNames = defModel.filter((d: any) => /RevGrowth_|EbitdaMargin_/.test(d.name));
    // 2 drivers × 3 scenarios = 6 named ranges.
    expect(scenNames.length).toBe(6);

    const distinctCols = new Set<string>();
    for (const d of scenNames) {
      const refs = (d.ranges ?? []).join(' | ');
      const m = /\$([A-Z]+)\$\d+/.exec(refs);
      if (m) distinctCols.add(m[1]);
    }
    expect(distinctCols.size).toBe(3);
    expect([...distinctCols].sort()).toEqual(['C', 'D', 'E']);
  });
});

// -------------------------------------------------------------------------
// EQ-B — Sensitivity table
// -------------------------------------------------------------------------

describe('EQ-B — sensitivity table (N×M formula grid + color-scale)', () => {
  it('writes a 4×4 grid of interior recompute formulas with {col}/{row} substituted', async () => {
    const buf = await buildWorkbookBuffer(EQ_SEED, { applyConsultantStyling: true });
    const wb = await load(buf);
    const ws = wb.getWorksheet('P&L')!;

    const interior: Array<{ addr: string; f: string }> = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const v: any = cell.value;
        if (
          v &&
          typeof v === 'object' &&
          typeof v.formula === 'string' &&
          /\* \(1 \+/.test(v.formula)
        ) {
          interior.push({ addr: cell.address, f: v.formula });
        }
      });
    });
    // 4 col-inputs × 4 row-inputs = 16 interior cells.
    expect(interior).toHaveLength(16);
    // Each interior formula references a column header (row 3) AND a row header
    // (col H) — proof the {col}/{row} placeholders were substituted with A1.
    for (const c of interior) {
      expect(c.f).toMatch(/[I-L]3/); // column header cell (top row of grid)
      expect(c.f).toMatch(/H\d/); // row header cell (left column of grid)
    }
  });

  it('applies a color-scale over the interior grid (raw XML)', async () => {
    const buf = await buildWorkbookBuffer(EQ_SEED, { applyConsultantStyling: true });
    const zip = await JSZip.loadAsync(buf as any);
    const sheet1Xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet1Xml).toContain('colorScale');
  });
});

// -------------------------------------------------------------------------
// EQ-C — Chart image mount
// -------------------------------------------------------------------------

describe('EQ-C — chart image mount (exceljs addImage, no native chart API)', () => {
  it('embeds a PNG image (xl/media + drawing) into the real file', async () => {
    const buf = await buildWorkbookBuffer(EQ_SEED, { applyConsultantStyling: true });
    const zip = await JSZip.loadAsync(buf as any);
    const media = Object.keys(zip.files).filter((f) => /^xl\/media\/image\d+\.png$/.test(f));
    const drawings = Object.keys(zip.files).filter((f) =>
      /^xl\/drawings\/drawing\d+\.xml$/.test(f)
    );
    expect(media.length).toBeGreaterThanOrEqual(1);
    expect(drawings.length).toBeGreaterThanOrEqual(1);

    const wb = await load(buf);
    const ws = wb.getWorksheet('P&L')!;
    expect(ws.getImages()).toHaveLength(1);
  });
});
