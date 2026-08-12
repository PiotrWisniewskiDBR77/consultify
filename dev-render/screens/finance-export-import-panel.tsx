/**
 * AP-CLIENT (Gate J) — dev-render host for the REAL `<FinanceExportImportPanel>`
 * (`src/components/Finance/exportImport/FinanceExportImportPanel.tsx`). Priorytet #5.
 *
 * URL: ?screen=finance-export-import-panel[&lang=pl|en][&theme=light|dark]
 *   &scene=default|off
 *
 * Zrzut pokazuje stan PO kliknięciu „Eksportuj" (manifest widoczny) — plik
 * .xlsx faktycznie się pobiera w tym harnessie (prawdziwy Blob), co jest OK
 * do zrzutu (nie wymaga zgody Piotra — to lokalny plik generowany przez mock
 * fetch, nie realny network call).
 */
import React, { useEffect } from 'react';

import { FinanceExportImportPanel } from '../../src/components/Finance/exportImport/FinanceExportImportPanel';
import { FINANCE_EXPORT_IMPORT_FLAG_ID } from '../../src/hooks/useFinanceExportImportFlag';

const params = new URLSearchParams(window.location.search);
const scene = (params.get('scene') as 'default' | 'off' | null) ?? 'default';

// Explicit true/false (not "skip when off") — localStorage persists across page.goto()
// within the same browser context. See finance-lineage-navigator.tsx for the bug this fixes.
{
  const raw = window.localStorage.getItem('consultify_feature_flags');
  const overrides = raw ? JSON.parse(raw) : {};
  overrides[FINANCE_EXPORT_IMPORT_FLAG_ID] = scene !== 'off';
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify(overrides));
}

const ARTIFACT_ID = 'art-dbr77-statement';
const BV_ID = 'bv-dbr77-statement-3';

const SAMPLE_MANIFEST = {
  manifestVersion: 1,
  source: 'consultify-finance-v3-ap02',
  exportId: 'exp-dbr77-1',
  organizationId: 'org-dbr77',
  artifactId: ARTIFACT_ID,
  artifactType: 'STATEMENT_PACK',
  businessVersionId: BV_ID,
  businessVersionStatus: 'APPROVED',
  businessVersionNo: 3,
  businessVersionCasVersion: 5,
  workingRevisionId: 'wr-dbr77-3',
  asOf: '2026-08-12T00:00:00.000Z',
  defaultUnit: 'THOUSANDS',
  defaultPresentationCurrency: 'PLN',
  rowCount: 372,
};

function xlsxResponse(): Response {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK.. zip magic — realistyczny nagłówek .xlsx do zrzutu/pobrania
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ARTIFACT_ID}-v3.xlsx"`,
      'X-Finance-Export-Manifest': JSON.stringify(SAMPLE_MANIFEST),
    },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
}

const IMPORT_ROWS = [
  { __rowNumber: 2, entityCode: 'PARENT', canonicalLineId: 'REVENUE', periodLabel: '02/2026', status: 'PRESENT_NONZERO', valueDecimal: '431000' },
  { __rowNumber: 3, entityCode: 'PARENT', canonicalLineId: 'COGS', periodLabel: '02/2026', status: 'PRESENT_NONZERO', valueDecimal: '-251500' },
];

const g = window as unknown as { __EXPORT_IMPORT_PANEL_FETCH__?: boolean };
if (!g.__EXPORT_IMPORT_PANEL_FETCH__) {
  g.__EXPORT_IMPORT_PANEL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/export/statement-pack/')) return xlsxResponse();
    if (url.includes('/import/parse')) {
      return json({ manifest: SAMPLE_MANIFEST, manifestIssues: [], rows: IMPORT_ROWS });
    }
    if (url.includes('/import/preview')) {
      return json({
        ok: true,
        manifestCheck: { ok: true, issues: [] },
        diff: {
          toAdd: [],
          toChange: [
            {
              cellKey: 'REVENUE-02/2026',
              cellRef: {},
              before: { status: 'PRESENT_NONZERO', valueDecimal: '420000' },
              after: { rowNumber: 2, cellKey: 'REVENUE-02/2026', cellRef: {}, value: { status: 'PRESENT_NONZERO', valueDecimal: '431000' } },
            },
            {
              cellKey: 'COGS-02/2026',
              cellRef: {},
              before: { status: 'PRESENT_NONZERO', valueDecimal: '-243600' },
              after: { rowNumber: 3, cellKey: 'COGS-02/2026', cellRef: {}, value: { status: 'PRESENT_NONZERO', valueDecimal: '-251500' } },
            },
          ],
          toClear: [],
          unchangedCount: 370,
        },
        rowErrors: [],
        totalRows: IMPORT_ROWS.length,
      });
    }
    if (url.includes('/api/')) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return realFetch(input as RequestInfo, init);
  };
}

function SimulatedMenu1(): React.ReactElement {
  return (
    <div className="flex h-10 items-center gap-4 border-b border-c-border-subtle bg-c-surface px-4 text-xs text-c-text-secondary">
      <span className="font-semibold text-c-text">Consultify</span>
      <span>Finance</span>
      <span className="text-c-text-muted">(symulowane Menu 1 — nie część tego pakietu)</span>
    </div>
  );
}

export default function FinanceExportImportPanelScreen(): React.ReactElement {
  // Auto-klik "Eksportuj" przy montowaniu, żeby zrzut pokazał stan PO eksporcie (manifest widoczny), nie tylko pusty przycisk.
  useEffect(() => {
    if (scene === 'off') return;
    const t = window.setTimeout(() => {
      const btn = document.querySelector('[data-testid="export-button"]') as HTMLButtonElement | null;
      btn?.click();
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-c-bg p-6" data-testid="finance-export-import-panel-screen" data-scene={scene}>
      <SimulatedMenu1 />
      <div className="mx-auto mt-4 max-w-md">
        <FinanceExportImportPanel artifactId={ARTIFACT_ID} businessVersionId={BV_ID} expectedWorkingRevisionId="wr-dbr77-3" />
      </div>
    </div>
  );
}
