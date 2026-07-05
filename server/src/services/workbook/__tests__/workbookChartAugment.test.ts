/**
 * @vitest-environment node
 *
 * Anti-false-green dla workbookChartAugment (mostek: rasterizer wykresów →
 * WorkbookSchema.chartImages).
 *
 * Test 1 (mechanizm): schemat z danymi liczbowymi + zamockowany rasterizer
 * (documentChartRasterizer.renderChartBlockToPng) zwraca znany PNG buffer →
 * arkusz dostaje chartImages z tym PNG (base64) + sensownym anchorCell.
 *
 * Test 2 (fail-soft): rasterizer RZUCA → augmentWorkbookWithCharts NIE rzuca,
 * zwraca schemat BEZ chartImages (identyczny w treści danych).
 *
 * Rasterizer jest zamockowany celowo — realny canvas (@napi-rs/canvas) może
 * nie być dostępny w środowisku CI/testowym; to NIE jest ten kontrakt, który
 * testujemy tutaj (kontrakt canvas-render jest już pokryty przez testy
 * documentStudio). Tu testujemy WYŁĄCZNIE mostek: ekstrakcję danych, wołanie
 * rasterizera z sensownym payloadem, i wpięcie wyniku do schematu + fail-soft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkbookSchema } from '../WorkbookSchema.js';

const renderChartBlockToPngMock = vi.fn();

vi.mock('../../documentStudio/documentChartRasterizer.js', () => ({
  renderChartBlockToPng: (...args: unknown[]) => renderChartBlockToPngMock(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { augmentWorkbookWithCharts } from '../workbookChartAugment.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Arkusz z prostymi danymi liczbowymi — kandydat na wykres. */
function schemaWithNumericSheet(): WorkbookSchema {
  return {
    title: 'Budżet Q1',
    sheets: [
      {
        name: 'Budget',
        columns: [
          { key: 'item', header: 'Pozycja', type: 'text' },
          { key: 'amount', header: 'Kwota', type: 'number' },
        ],
        rows: [
          { cells: { item: { value: 'Marketing' }, amount: { value: 1000 } } },
          { cells: { item: { value: 'Sprzedaż' }, amount: { value: 2000 } } },
          { cells: { item: { value: 'IT' }, amount: { value: 3000 } } },
          {
            isSummary: true,
            cells: { item: { value: 'Razem' }, amount: { formula: '=SUM(B2:B4)' } },
          },
        ],
      },
    ],
  };
}

/** Arkusz bez sensownych danych liczbowych (tylko tekst) — musi zostać pominięty. */
function schemaWithNoNumericData(): WorkbookSchema {
  return {
    title: 'Notatki',
    sheets: [
      {
        name: 'Notes',
        columns: [{ key: 'note', header: 'Notatka', type: 'text' }],
        rows: [{ cells: { note: { value: 'Coś tam' } } }],
      },
    ],
  };
}

const FAKE_PNG = Buffer.from('fake-png-bytes');

describe('workbookChartAugment — mechanizm', () => {
  beforeEach(() => {
    renderChartBlockToPngMock.mockReset();
  });

  it('arkusz z danymi liczbowymi → chartImages z PNG rasterizera + anchorCell', async () => {
    renderChartBlockToPngMock.mockResolvedValue(FAKE_PNG);

    const result = await augmentWorkbookWithCharts(schemaWithNumericSheet());

    expect(renderChartBlockToPngMock).toHaveBeenCalledTimes(1);
    const [blockArg] = renderChartBlockToPngMock.mock.calls[0];
    expect(blockArg.type).toBe('chart');
    expect(blockArg.content.series.length).toBeGreaterThan(0);
    // formula cell (Razem/SUM) must NOT leak into the illustrative series.
    expect(blockArg.content.categories).not.toContain('Razem');

    const sheet = result.sheets[0];
    expect(sheet.chartImages).toBeDefined();
    expect(sheet.chartImages).toHaveLength(1);
    expect(sheet.chartImages![0].pngBase64).toBe(FAKE_PNG.toString('base64'));
    expect(sheet.chartImages![0].anchorCell).toMatch(/^[A-Z]+\d+$/);

    // Original data untouched.
    expect(sheet.rows).toEqual(schemaWithNumericSheet().sheets[0].rows);
  });

  it('arkusz bez sensownych danych liczbowych → pominięty (brak wywołania rasterizera)', async () => {
    renderChartBlockToPngMock.mockResolvedValue(FAKE_PNG);

    const result = await augmentWorkbookWithCharts(schemaWithNoNumericData());

    expect(renderChartBlockToPngMock).not.toHaveBeenCalled();
    expect(result.sheets[0].chartImages).toBeUndefined();
  });

  it('arkusz z już istniejącym chartImages → nie dubluje wykresu', async () => {
    renderChartBlockToPngMock.mockResolvedValue(FAKE_PNG);
    const schema = schemaWithNumericSheet();
    schema.sheets[0].chartImages = [
      { pngBase64: 'existing', anchorCell: 'Z1', width: 100, height: 100 },
    ];

    const result = await augmentWorkbookWithCharts(schema);

    expect(renderChartBlockToPngMock).not.toHaveBeenCalled();
    expect(result.sheets[0].chartImages).toHaveLength(1);
    expect(result.sheets[0].chartImages![0].pngBase64).toBe('existing');
  });
});

describe('workbookChartAugment — fail-soft', () => {
  beforeEach(() => {
    renderChartBlockToPngMock.mockReset();
  });

  it('rasterizer rzuca → funkcja NIE rzuca, zwraca schemat bez chartImages', async () => {
    renderChartBlockToPngMock.mockRejectedValue(new Error('canvas boom'));

    const input = schemaWithNumericSheet();
    await expect(augmentWorkbookWithCharts(input)).resolves.toBeDefined();

    const result = await augmentWorkbookWithCharts(input);
    expect(result.sheets[0].chartImages ?? []).toHaveLength(0);
    // Data still intact — fail-soft never corrupts the schema.
    expect(result.sheets[0].rows).toEqual(input.sheets[0].rows);
  });

  it('rasterizer zwraca null → traktowane jak brak wykresu, bez wyjątku', async () => {
    renderChartBlockToPngMock.mockResolvedValue(null);

    const result = await augmentWorkbookWithCharts(schemaWithNumericSheet());
    expect(result.sheets[0].chartImages ?? []).toHaveLength(0);
  });

  it('rasterizer zwraca pusty buffer → traktowane jak brak wykresu', async () => {
    renderChartBlockToPngMock.mockResolvedValue(Buffer.alloc(0));

    const result = await augmentWorkbookWithCharts(schemaWithNumericSheet());
    expect(result.sheets[0].chartImages ?? []).toHaveLength(0);
  });
});
