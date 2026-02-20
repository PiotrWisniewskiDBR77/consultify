import fs from 'fs';
import path from 'path';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { PptxPipelineService } from './report/pptx/PptxPipelineService.js';
import type { TableData, UnifiedReportJSON, UnifiedSlide } from './report/pptx/types.js';

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

function formatMoney(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B ${currency}`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M ${currency}`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k ${currency}`;
  return `${v.toFixed(0)} ${currency}`;
}

function toTableFromSensitivity(s: any, currency: string): TableData | null {
  if (!s || !s.kind) return null;
  if (s.kind === 'wacc_vs_g') {
    const headers = ['g \\\\ WACC', ...(s.waccGrid || []).map((w: number) => `${w.toFixed(1)}%`)];
    const rows = (s.table || []).slice(0, 8).map((r: any) => [
      `${Number(r.g).toFixed(1)}%`,
      ...((r.values || []).map((v: any) =>
        Number.isFinite(Number(v)) ? formatMoney(Number(v), currency) : 'n/a'
      ) as string[]),
    ]);
    return { headers, rows };
  }
  return null;
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
  if (String(row.status || '').toUpperCase() !== 'APPROVED') {
    throw new Error('Valuation must be APPROVED to export');
  }

  const currency = row.currency || 'PLN';
  const results = safeJsonParse<any>(row.results, {});
  const dcf = results?.dcf || {};
  const sensitivity = results?.sensitivity || null;
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
            ? `Wartość przedsiębiorstwa (EV): ${formatMoney(dcf.enterpriseValue, currency)}`
            : `Enterprise value (EV): ${formatMoney(dcf.enterpriseValue, currency)}`,
        key_findings: [
          `Equity value: ${formatMoney(dcf.equityValue, currency)}`,
          `WACC: ${dcf.discountRatePercent ?? '—'}%`,
        ],
        recommendation:
          lang === 'pl'
            ? 'Tylko informacyjnie; nie stanowi porady inwestycyjnej.'
            : 'Informational only; not investment advice.',
      },
    },
  ];

  const sensTable = toTableFromSensitivity(sensitivity, currency);
  if (sensTable) {
    slides.push({
      intent: 'appendix',
      key_message: 'Sensitivity',
      content: {
        type: 'appendix',
        title: lang === 'pl' ? 'Sensitivity (EV)' : 'Sensitivity (EV)',
        body:
          lang === 'pl'
            ? 'Tabela sensitivity: jak zmienia się EV przy zmianach parametrów terminala i stopy dyskonta.'
            : 'Sensitivity table: how EV changes with terminal assumptions and discount rate.',
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

  const exportDir = path.join(process.cwd(), 'exports', 'valuations');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
  const exportPath = path.join(exportDir, `${params.valuationId}.pptx`);
  fs.writeFileSync(exportPath, result.buffer);

  await dbRun(
    `UPDATE valuations SET export_path = ?, exported_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [exportPath, params.valuationId, params.organizationId]
  );

  logger.info(`[ValuationExport] Exported valuation ${params.valuationId} to ${exportPath}`);
  return { exportPath, slideCount: result.slideCount, warnings: result.warnings };
}

