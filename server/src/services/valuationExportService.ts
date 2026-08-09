import fs from 'fs';
import path from 'path';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { exportsDir } from '../utils/storagePaths.js';
import { PptxPipelineService } from './report/pptx/PptxPipelineService.js';
import type {
  ChartDataSet,
  TableData,
  UnifiedReportJSON,
  UnifiedSlide,
} from './report/pptx/types.js';

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function formatValuationMoney(
  n: number | null | undefined,
  currency: string,
  multiplier = 1
): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n) * multiplier;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B ${currency}`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M ${currency}`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k ${currency}`;
  return `${v.toFixed(0)} ${currency}`;
}

function toTableFromSensitivity(s: any, currency: string, multiplier: number): TableData | null {
  if (!s || !s.kind) return null;
  if (s.kind !== 'wacc_vs_g') return null;
  const headers = ['g \\\\ WACC', ...(s.waccGrid || []).map((w: number) => `${w.toFixed(1)}%`)];
  const rows = (s.table || [])
    .slice(0, 8)
    .map((r: any) => [
      `${Number(r.g).toFixed(1)}%`,
      ...((r.values || []).map((v: any) =>
        Number.isFinite(Number(v)) ? formatValuationMoney(Number(v), currency, multiplier) : 'n/a'
      ) as string[]),
    ]);
  return { headers, rows };
}

function toCompsTable(comps: any, currency: string, multiplier: number): TableData | null {
  if (!comps) return null;
  const implied = comps?.impliedEnterpriseValue;
  if (!implied) return null;
  const headers = [
    'Metric',
    'Multiple (min)',
    'Multiple (median)',
    'Multiple (max)',
    'Implied EV (min/med/max)',
  ];
  const metric = String(comps.metric || '—');
  const row = [
    metric,
    String(comps.min ?? '—'),
    String(comps.median ?? '—'),
    String(comps.max ?? '—'),
    `${formatValuationMoney(implied.min, currency, multiplier)} / ${formatValuationMoney(implied.median, currency, multiplier)} / ${formatValuationMoney(implied.max, currency, multiplier)}`,
  ];
  return { headers, rows: [row] };
}

function toTornadoChartData(tornado: any, multiplier: number): ChartDataSet | null {
  if (!Array.isArray(tornado) || tornado.length < 1) return null;
  const labels = tornado.slice(0, 8).map((d: any) => String(d?.driver || 'Driver').slice(0, 40));
  const values = tornado
    .slice(0, 8)
    .map((d: any) => Math.max(0, Number(d?.swing ?? 0) * multiplier));
  if (!values.some((v) => Number.isFinite(v) && v > 0)) return null;
  return {
    labels,
    series: [{ name: 'EV swing', values: values.map((v) => (Number.isFinite(v) ? v : 0)) }],
  };
}

export async function exportValuationPptx(params: {
  organizationId: string;
  valuationId: string;
  language?: 'en' | 'pl';
  theme?: 'corporate' | 'minimal' | 'modern';
  confidentiality?: 'confidential' | 'internal' | 'public';
}): Promise<{ exportPath: string; slideCount: number; warnings: string[] }> {
  const row = await dbGet<any>(
    `SELECT v.*, o.name as org_name
     FROM valuations v
     JOIN organizations o ON o.id = v.organization_id
     WHERE v.id = ? AND v.organization_id = ?`,
    [params.valuationId, params.organizationId]
  );
  if (!row) throw new Error('Valuation not found');
  if (String(row.status || '').toUpperCase() !== 'APPROVED')
    throw new Error('Valuation must be APPROVED to export');

  const currency = row.currency || 'PLN';
  const results = safeJsonParse<any>(row.results, {});
  const displayMultiplier = Math.max(1, Number(results?.monetaryUnit?.multiplier) || 1);
  const dcf = results?.dcf || {};
  const sensitivity = results?.sensitivity || null;
  const comps = results?.comps || null;
  const tornado = results?.tornado || null;
  const lang = params.language === 'pl' ? 'pl' : 'en';

  const slides: UnifiedSlide[] = [
    {
      intent: 'cover',
      key_message: row.title,
      content: {
        type: 'cover',
        title: row.title,
        subtitle: lang === 'pl' ? 'Wycena przedsiębiorstwa' : 'Enterprise Valuation',
        organization: row.org_name || 'Organization',
        date: new Date().toISOString().slice(0, 10),
        confidentiality: params.confidentiality || 'confidential',
      } as any,
    },
    {
      intent: 'executive_summary',
      key_message: lang === 'pl' ? 'Podsumowanie wyceny' : 'Valuation Summary',
      content: {
        type: 'executive_summary',
        headline:
          lang === 'pl'
            ? `Wartość przedsiębiorstwa (EV): ${formatValuationMoney(dcf.enterpriseValue, currency, displayMultiplier)}`
            : `Enterprise value (EV): ${formatValuationMoney(dcf.enterpriseValue, currency, displayMultiplier)}`,
        key_findings: [
          `Equity value: ${formatValuationMoney(dcf.equityValue, currency, displayMultiplier)}`,
          `WACC: ${dcf.discountRatePercent ?? '—'}%`,
          dcf.terminalMethod === 'gordon'
            ? `Terminal growth (g): ${dcf.terminalGrowthPercent ?? '—'}%`
            : `Terminal: ${dcf.terminalMethod ?? '—'}`,
          `PV split (explicit/terminal): ${formatValuationMoney(dcf.pvExplicit, currency, displayMultiplier)} / ${formatValuationMoney(dcf.pvTerminal, currency, displayMultiplier)}`,
        ],
        recommendation:
          lang === 'pl'
            ? 'Tylko informacyjnie; nie stanowi porady inwestycyjnej.'
            : 'Informational only; not investment advice.',
      },
    },
    {
      intent: 'key_messages',
      key_message: lang === 'pl' ? 'DCF — szczegóły' : 'DCF — Details',
      content: {
        type: 'key_messages',
        messages: [
          {
            title: lang === 'pl' ? 'Okres jawny vs terminal' : 'Explicit period vs terminal',
            description: `${formatValuationMoney(dcf.pvExplicit, currency, displayMultiplier)} / ${formatValuationMoney(dcf.pvTerminal, currency, displayMultiplier)}`,
          },
          {
            title: lang === 'pl' ? 'Metoda terminalna' : 'Terminal method',
            description:
              dcf.terminalMethod === 'gordon'
                ? `Gordon (g=${dcf.terminalGrowthPercent ?? '—'}%)`
                : `Exit multiple (${dcf.exitMultipleMetric ?? '—'} × ${dcf.exitMultiple ?? '—'})`,
          },
          {
            title: lang === 'pl' ? 'Kapitał własny' : 'Equity value bridge',
            description: `${lang === 'pl' ? 'EV' : 'EV'} ${formatValuationMoney(dcf.enterpriseValue, currency, displayMultiplier)} − net debt ${formatValuationMoney(
              safeJsonParse<any>(row.assumptions, {})?.netDebt ?? null,
              currency,
              displayMultiplier
            )} = ${formatValuationMoney(dcf.equityValue, currency, displayMultiplier)}`,
          },
        ],
      } as any,
    },
  ];

  const compsTable = toCompsTable(comps, currency, displayMultiplier);
  if (compsTable) {
    slides.push({
      intent: 'appendix',
      key_message: lang === 'pl' ? 'Comps (multiples)' : 'Comps (multiples)',
      content: {
        type: 'appendix',
        title:
          lang === 'pl' ? 'Porównania rynkowe (multiples)' : 'Comparable valuation (multiples)',
        body:
          lang === 'pl'
            ? 'Zakres wyceny porównawczej na podstawie ręcznie wprowadzonych multiple (V2).'
            : 'Comparable range based on manually provided multiples (V2).',
        tables: [compsTable],
        footnotes: ['Informational only; not investment advice.'],
      } as any,
    });
  }

  const tornadoChart = toTornadoChartData(tornado, displayMultiplier);
  if (tornadoChart) {
    slides.push({
      intent: 'single_insight',
      key_message: lang === 'pl' ? 'Sensitivity — top drivery' : 'Sensitivity — Top drivers',
      content: {
        type: 'single_insight',
        chart_type: 'bar',
        chart_data: tornadoChart,
        insight_text:
          lang === 'pl'
            ? 'Wykres pokazuje, które założenia mają największy wpływ na EV (na bazie tornado).'
            : 'This shows which assumptions have the largest impact on EV (tornado drivers).',
        source: 'Valuation assumptions (computed)',
      } as any,
    });
  }

  const sensTable = toTableFromSensitivity(sensitivity, currency, displayMultiplier);
  if (sensTable) {
    slides.push({
      intent: 'appendix',
      key_message: 'Sensitivity table',
      content: {
        type: 'appendix',
        title: lang === 'pl' ? 'Sensitivity: WACC vs g (EV)' : 'Sensitivity: WACC vs g (EV)',
        body:
          lang === 'pl'
            ? 'Tabela sensitivity: EV przy różnych WACC i g (wartości n/a dla przypadków g ≥ WACC).'
            : 'Sensitivity table: EV under varying WACC and g (n/a when g ≥ WACC).',
        tables: [sensTable],
        footnotes: ['Informational only; not investment advice.'],
      } as any,
    });
  }

  slides.push({
    intent: 'appendix',
    key_message: lang === 'pl' ? 'Zastrzeżenia' : 'Disclaimers',
    content: {
      type: 'appendix',
      title: lang === 'pl' ? 'Zastrzeżenia i metodologia' : 'Disclaimers & Methodology',
      body:
        lang === 'pl'
          ? 'Niniejszy materiał ma charakter wyłącznie informacyjny. Wyniki są oparte o założenia i nie są audytowane. Consultify nie udziela porad inwestycyjnych, prawnych ani podatkowych.'
          : 'This material is for informational purposes only. Outputs are assumptions-driven and not audited. Consultify does not provide investment, legal, or tax advice.',
    } as any,
  });

  const unified: UnifiedReportJSON = {
    meta: {
      client: row.org_name || 'Organization',
      project: row.title,
      date: new Date().toISOString().slice(0, 10),
      author: 'Consultify',
      confidentiality: params.confidentiality || 'confidential',
      language: lang,
      template: params.theme || 'corporate',
      sourceType: 'valuation',
    },
    slides,
  };

  const pipeline = new PptxPipelineService();
  const result = await pipeline.generateFromUnifiedJson(unified, {
    template: params.theme || 'corporate',
    language: lang,
    confidentiality: params.confidentiality || 'confidential',
    skipValidation: false,
  });

  const exportDirFs = exportsDir('valuations');
  const fileName = `${params.valuationId}.pptx`;
  const exportPathFs = path.join(exportDirFs, fileName);
  const exportPathPublic = `/exports/valuations/${fileName}`;
  fs.writeFileSync(exportPathFs, result.buffer);

  await dbRun(
    `UPDATE valuations SET export_path = ?, exported_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [exportPathPublic, params.valuationId, params.organizationId]
  );

  logger.info(`[ValuationExport] Exported valuation ${params.valuationId} to ${exportPathFs}`);
  return { exportPath: exportPathPublic, slideCount: result.slideCount, warnings: result.warnings };
}
