/**
 * Api-method mock for the dev-render screen `gen-excel-templates-tab`.
 *
 * Patches the shared Api singleton's `listWorkbookTemplates`/
 * `buildWorkbookTemplate`/`getWorkbookSchema` at MOUNT (not window.fetch —
 * main.tsx clobbers Api.get at load; same reasoning as
 * presentationTemplateArchitectMocks.ts). Returns the 3-entry registry shape
 * (threeScenarioPnL + the 2 new W1 templates operatingBudget/dcfValuation) so
 * the new hub tab can be screenshotted BEFORE the owner sees it (rule #7).
 * No backend/DB.
 *
 * Inline grid preview (2026-07-23): `buildWorkbookTemplate` must return `id`
 * (the REAL server shape from finalizeGeneratedWorkbook in
 * server/src/routes/workbook.routes.ts — the earlier `workbookId` field here
 * was stale/wrong and made ExceleParametricTemplates' `built.id` undefined,
 * silently skipping the grid fetch). `getWorkbookSchema` is now mocked too —
 * WorkbookSchema-shaped sheets (columns[].key/header, rows[].cells[key] with
 * value/formula, server/src/services/workbook/WorkbookSchema.ts) so
 * buildWorkbookGridSheets (src/utils/workbookGridPreview.ts) has real cells to
 * turn into the grid.
 */
import { Api } from '@/services/api';

const TEMPLATES = [
  {
    id: 'threeScenarioPnL',
    name: 'Model P&L (3 scenariusze × 3 lata)',
    description: 'Rachunek zysków i strat w 3 scenariuszach (baza/optymistyczny/pesymistyczny) na 3 lata.',
    params: [
      { name: 'companyName', label: 'Nazwa spółki', type: 'text', default: 'Spółka', group: 'Ogólne' },
      { name: 'base.revenue', label: 'Przychód (baza)', type: 'currency', default: 1000000, min: 0, group: 'Scenariusz bazowy' },
      { name: 'base.growth', label: 'Wzrost r/r (baza)', type: 'percent', default: 12, min: -50, max: 200, group: 'Scenariusz bazowy' },
      { name: 'bull.growth', label: 'Wzrost r/r (optymistyczny)', type: 'percent', default: 25, group: 'Scenariusz optymistyczny' },
      { name: 'bear.growth', label: 'Wzrost r/r (pesymistyczny)', type: 'percent', default: 3, group: 'Scenariusz pesymistyczny' },
    ],
  },
  {
    id: 'operatingBudget',
    name: 'Budżet operacyjny (12 miesięcy)',
    description: 'Miesięczny budżet: przychody, koszty zmienne i stałe, marża, wynik narastająco.',
    params: [
      { name: 'companyName', label: 'Nazwa spółki', type: 'text', default: 'Spółka', group: 'Ogólne' },
      { name: 'startRevenue', label: 'Przychód m-c 1', type: 'currency', default: 80000, min: 0, group: 'Przychody' },
      { name: 'revenueGrowth', label: 'Wzrost m/m', type: 'percent', default: 3, min: -20, max: 50, group: 'Przychody' },
      { name: 'varCostPct', label: 'Koszty zmienne (% przychodu)', type: 'percent', default: 35, min: 0, max: 100, group: 'Koszty' },
      { name: 'fixedPayroll', label: 'Wynagrodzenia (stałe)', type: 'currency', default: 30000, min: 0, group: 'Koszty stałe' },
      { name: 'fixedRent', label: 'Najem (stały)', type: 'currency', default: 8000, min: 0, group: 'Koszty stałe' },
    ],
  },
  {
    id: 'dcfValuation',
    name: 'Wycena DCF',
    description: 'Zdyskontowane przepływy pieniężne: projekcja FCF, WACC, wartość rezydualna, EV.',
    params: [
      { name: 'companyName', label: 'Nazwa spółki', type: 'text', default: 'Spółka', group: 'Ogólne' },
      { name: 'fcf0', label: 'FCF rok 0', type: 'currency', default: 500000, min: 0, group: 'Projekcja' },
      { name: 'growth', label: 'Wzrost FCF r/r', type: 'percent', default: 10, min: -20, max: 100, group: 'Projekcja' },
      { name: 'years', label: 'Horyzont (lata)', type: 'integer', default: 5, min: 3, max: 10, group: 'Projekcja' },
      { name: 'wacc', label: 'WACC', type: 'percent', default: 11, min: 1, max: 40, group: 'Dyskonto' },
      { name: 'terminalGrowth', label: 'Wzrost rezydualny', type: 'percent', default: 2.5, min: 0, max: 5, group: 'Dyskonto' },
    ],
  },
];

/** Mock WorkbookSchema (server/src/services/workbook/WorkbookSchema.ts shape)
 *  for `getWorkbookSchema` — 2 sheets, one with a live formula column, so the
 *  inline grid preview has something real to render (mono formula + tooltip). */
function mockSchemaForTemplate(templateId: string) {
  return {
    id: `wb-dev-render-${templateId}`,
    title: TEMPLATES.find((t) => t.id === templateId)?.name || templateId,
    description: null,
    sheets: [
      {
        name: 'Założenia',
        columns: [
          { key: 'label', header: 'Pozycja' },
          { key: 'y1', header: 'Rok 1' },
          { key: 'y2', header: 'Rok 2' },
          { key: 'y3', header: 'Rok 3' },
        ],
        rows: [
          {
            cells: {
              label: { value: 'Przychód' },
              y1: { value: 1000000 },
              y2: { formula: 'y1*1.12' },
              y3: { formula: 'y2*1.12' },
            },
          },
          {
            cells: {
              label: { value: 'Koszty' },
              y1: { value: 620000 },
              y2: { formula: 'y1*1.08' },
              y3: { formula: 'y2*1.08' },
            },
          },
          {
            cells: {
              label: { value: 'Wynik' },
              y1: { formula: 'y1-y1' },
              y2: { formula: 'SUM(B2:B3)' },
              y3: { formula: 'SUM(C2:C3)' },
            },
          },
        ],
      },
      {
        name: 'Podsumowanie',
        columns: [
          { key: 'metric', header: 'Metryka' },
          { key: 'value', header: 'Wartość' },
        ],
        rows: [
          { cells: { metric: { value: 'Marża rok 1' }, value: { formula: '(B2-B3)/B2' } } },
          { cells: { metric: { value: 'CAGR' }, value: { value: 0.12 } } },
        ],
      },
    ],
  };
}

export function installWorkbookTemplatesApiMock(): () => void {
  const realList = Api.listWorkbookTemplates;
  const realBuild = Api.buildWorkbookTemplate;
  const realSchema = Api.getWorkbookSchema;

  Api.listWorkbookTemplates = (async () => ({ templates: TEMPLATES })) as typeof Api.listWorkbookTemplates;
  Api.buildWorkbookTemplate = (async (id: string) => ({
    id: `wb-dev-render-${id}`,
    title: TEMPLATES.find((t) => t.id === id)?.name || id,
    fileName: `${id}.xlsx`,
    downloadUrl: '#',
    sheets: mockSchemaForTemplate(id).sheets.map((s) => ({
      name: s.name,
      columnCount: s.columns.length,
      rowCount: s.rows.length,
    })),
  })) as typeof Api.buildWorkbookTemplate;
  Api.getWorkbookSchema = (async (workbookId: string) => {
    const templateId = workbookId.replace(/^wb-dev-render-/, '');
    return mockSchemaForTemplate(templateId);
  }) as typeof Api.getWorkbookSchema;

  return () => {
    Api.listWorkbookTemplates = realList;
    Api.buildWorkbookTemplate = realBuild;
    Api.getWorkbookSchema = realSchema;
  };
}
