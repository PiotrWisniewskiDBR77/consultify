import { all as dbAll } from '../utils/DbPromise.js';
import {
  getCanonicalLineByCode,
  getCanonicalLinesByStatementType,
  type CanonicalLineDefinition,
  type CanonicalStatementType,
} from './financeCanonicalRegistry.js';
import { normalizeCanonicalLineCode } from './financeCanonicalResolver.js';

type PersistedValueRow = {
  id: string;
  canonical_line_id: string | null;
  original_label: string;
  value: number;
  confidence?: number | null;
  source_page?: number | null;
  source_row?: number | null;
  mapping_status?: string | null;
  value_origin?: string | null;
  mapping_confidence?: number | null;
  evidence_json?: unknown;
  line_code?: string | null;
  line_name?: string | null;
  line_name_en?: string | null;
  line_name_pl?: string | null;
  aggregation_level?: number | null;
  required_level?: string | null;
  sign_convention?: string | null;
  is_total?: boolean | null;
  is_subtotal?: boolean | null;
  is_computed?: boolean | null;
  deaggregation_ready?: boolean | null;
  parent_line_id?: string | null;
};

type PeriodInfo = {
  key: string;
  label: string;
  index: number;
};

type AnalyticsExplain = {
  valueId: string;
  originalLabel: string;
  mappedTo?: string | null;
  lineCode?: string | null;
  value: number;
  mappingStatus: string;
  valueOrigin: string;
  mappingConfidence: number;
  evidenceJson?: Record<string, unknown> | null;
  evidences: Array<{
    evidenceType: 'direct' | 'aggregated' | 'split' | 'derived' | 'manual_note';
    weight: number;
    contributionValue?: number | null;
    explanation?: string | null;
    source?: {
      candidateRowId?: string | null;
      rowLabel?: string | null;
      sourceRow?: number | null;
      sourcePage?: number | null;
      rawValue?: string | null;
    } | null;
  }>;
  selectedMappingCandidate?: null;
};

export type StatementAnalyticsRow = {
  id: string;
  canonicalLineId: string;
  lineCode: string;
  lineName: string;
  lineNameEn: string;
  lineNamePl: string;
  aggregationLevel: number;
  parentCanonicalLineId?: string | null;
  requiredLevel: string;
  signConvention: string;
  isTotal: boolean;
  isSubtotal: boolean;
  isComputed: boolean;
  deaggregationReady: boolean;
  mappingStatus: string;
  valueOrigin: string;
  mappingConfidence: number;
  confidence: number;
  value: number;
  valuePeriodLabel?: string | null;
  valuePeriodIndex?: number | null;
  periodValues: Array<{ id: string; periodLabel?: string | null; periodIndex?: number | null; value: number }>;
  originalLabel: string;
  sourcePage?: number | null;
  sourceRow?: number | null;
  evidenceJson?: Record<string, unknown> | null;
  explain: AnalyticsExplain;
};

export type StatementAnalyticsPayload = {
  statementId: string;
  statementType: string;
  requestedLevel: number;
  periods: Array<{ label: string; index: number }>;
  rows: StatementAnalyticsRow[];
};

function parseEvidenceJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function buildPeriods(rows: PersistedValueRow[], defaultPeriodLabel?: string | null): PeriodInfo[] {
  const periods = new Map<string, PeriodInfo>();
  for (const row of rows) {
    const evidence = parseEvidenceJson(row.evidence_json);
    const label = String(evidence?.periodLabel || defaultPeriodLabel || '').trim();
    const index = Number(evidence?.periodIndex ?? 0);
    const key = `${index}:${label || 'default'}`;
    if (!periods.has(key)) {
      periods.set(key, { key, label: label || defaultPeriodLabel || 'Current', index });
    }
  }
  return Array.from(periods.values()).sort((left, right) => left.index - right.index);
}

function formulaValue(
  line: CanonicalLineDefinition,
  periodKey: string,
  byLineId: Map<string, Map<string, number>>,
  byCode: Map<string, string>,
  visiting: Set<string>
): number | null {
  const formula = line.formulaJson;
  if (!formula || typeof formula !== 'object') return null;
  const inputs = Array.isArray((formula as any).inputs) ? ((formula as any).inputs as string[]) : [];
  const resolved = inputs
    .map((code) => byCode.get(normalizeCanonicalLineCode(code)) || getCanonicalLineByCode(code)?.id || null)
    .filter(Boolean) as string[];
  if (!resolved.length) return null;
  const values = resolved.map((lineId) => computeLineValue(lineId, periodKey, byLineId, byCode, visiting) ?? 0);
  if ((formula as any).type === 'difference') {
    return Number(values[0] || 0) - Number(values[1] || 0);
  }
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function computeLineValue(
  lineId: string,
  periodKey: string,
  byLineId: Map<string, Map<string, number>>,
  byCode: Map<string, string>,
  visiting: Set<string>
): number | null {
  const direct = byLineId.get(lineId)?.get(periodKey);
  if (direct != null) return direct;
  if (visiting.has(`${lineId}:${periodKey}`)) return null;
  const canonicalLine = Array.from(byCode.entries()).find(([, id]) => id === lineId)?.[0]
    ? getCanonicalLineByCode(Array.from(byCode.entries()).find(([, id]) => id === lineId)?.[0] || '')
    : null;
  if (!canonicalLine) return null;
  visiting.add(`${lineId}:${periodKey}`);
  const derived = formulaValue(canonicalLine, periodKey, byLineId, byCode, visiting);
  visiting.delete(`${lineId}:${periodKey}`);
  return derived;
}

export async function buildStatementAnalytics(params: {
  statementId: string;
  statementType: CanonicalStatementType;
  requestedLevel: number;
  defaultPeriodLabel?: string | null;
}): Promise<StatementAnalyticsPayload> {
  const persistedRows = (await dbAll(
    `SELECT fsv.id, fsv.canonical_line_id, fsv.original_label, fsv.value, fsv.confidence, fsv.source_page, fsv.source_row,
            fsv.mapping_status, fsv.value_origin, fsv.mapping_confidence, fsv.evidence_json,
            fsl.line_code, fsl.line_name, fsl.line_name_en, fsl.line_name_pl, fsl.aggregation_level, fsl.required_level,
            fsl.sign_convention, fsl.is_total, fsl.is_subtotal, fsl.is_computed, fsl.deaggregation_ready, fsl.parent_line_id
     FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsl.id = fsv.canonical_line_id
     WHERE fsv.statement_id = ?
     ORDER BY fsl.sort_order, fsv.source_row, fsv.id`,
    [params.statementId]
  )) as PersistedValueRow[];

  const periods = buildPeriods(persistedRows, params.defaultPeriodLabel || null);
  const canonicalLines = getCanonicalLinesByStatementType(params.statementType);
  const lineIdByCode = new Map(canonicalLines.map((line) => [normalizeCanonicalLineCode(line.code), line.id]));
  const valuesByLineAndPeriod = new Map<string, Map<string, number>>();
  const rowBuckets = new Map<string, Map<string, PersistedValueRow[]>>();

  for (const row of persistedRows) {
    const evidence = parseEvidenceJson(row.evidence_json);
    const periodLabel = String(evidence?.periodLabel || params.defaultPeriodLabel || 'Current');
    const periodIndex = Number(evidence?.periodIndex ?? 0);
    const periodKey = `${periodIndex}:${periodLabel}`;
    const lineId =
      String(row.canonical_line_id || '').trim() ||
      lineIdByCode.get(normalizeCanonicalLineCode(String(row.line_code || ''))) ||
      '';
    if (!lineId) continue;
    if (!valuesByLineAndPeriod.has(lineId)) valuesByLineAndPeriod.set(lineId, new Map());
    if (!rowBuckets.has(lineId)) rowBuckets.set(lineId, new Map());
    const current = valuesByLineAndPeriod.get(lineId)!;
    current.set(periodKey, Number(current.get(periodKey) || 0) + Number(row.value || 0));
    const rowsForPeriod = rowBuckets.get(lineId)!;
    rowsForPeriod.set(periodKey, [...(rowsForPeriod.get(periodKey) || []), row]);
  }

  const rows: StatementAnalyticsRow[] = canonicalLines
    .filter((line) => line.aggregationLevel <= params.requestedLevel)
    .map((line) => {
      const periodValues = periods
        .map((period) => {
          const directRows = rowBuckets.get(line.id)?.get(period.key) || [];
          const direct = valuesByLineAndPeriod.get(line.id)?.get(period.key);
          const computed = direct != null ? direct : computeLineValue(line.id, period.key, valuesByLineAndPeriod, lineIdByCode, new Set());
          if (computed == null) return null;
          const topRow = directRows[0] || null;
          return {
            id: topRow?.id || `analytics:${line.id}:${period.index}`,
            periodLabel: period.label,
            periodIndex: period.index,
            value: Number(computed || 0),
          };
        })
        .filter(Boolean) as Array<{ id: string; periodLabel?: string | null; periodIndex?: number | null; value: number }>;

      if (!periodValues.length && line.requiredLevel === 'optional' && !line.isComputed) {
        return null;
      }
      const firstPeriod = periodValues[0] || { id: `analytics:${line.id}`, periodLabel: periods[0]?.label || null, periodIndex: periods[0]?.index || 0, value: 0 };
      const directRows = rowBuckets.get(line.id)?.get(`${firstPeriod.periodIndex}:${firstPeriod.periodLabel}`) || [];
      const directHead = directRows[0] || null;
      const isDerived = !directHead && (line.isComputed || line.formulaJson);
      const explain: AnalyticsExplain = {
        valueId: firstPeriod.id,
        originalLabel: directHead?.original_label || line.labelEn,
        mappedTo: line.labelEn,
        lineCode: line.code,
        value: Number(firstPeriod.value || 0),
        mappingStatus: directHead?.mapping_status || (isDerived ? 'computed' : 'auto'),
        valueOrigin: directHead?.value_origin || (isDerived ? 'computed' : 'mapped'),
        mappingConfidence: Number(directHead?.mapping_confidence ?? directHead?.confidence ?? (isDerived ? 1 : 0)),
        evidenceJson: parseEvidenceJson(directHead?.evidence_json || null),
        evidences: [
          {
            evidenceType: directHead ? 'direct' : isDerived ? 'derived' : 'aggregated',
            weight: 1,
            contributionValue: Number(firstPeriod.value || 0),
            explanation: directHead
              ? `Mapped from source line "${directHead.original_label}".`
              : line.formulaJson
                ? `Computed from formula for ${line.code}.`
                : `Aggregated from child analytical lines for ${line.code}.`,
            source: directHead
              ? {
                  rowLabel: directHead.original_label || null,
                  sourceRow: directHead.source_row != null ? Number(directHead.source_row) : null,
                  sourcePage: directHead.source_page != null ? Number(directHead.source_page) : null,
                }
              : null,
          },
        ],
        selectedMappingCandidate: null,
      };
      return {
        id: firstPeriod.id,
        canonicalLineId: line.id,
        lineCode: line.code,
        lineName: line.labelEn,
        lineNameEn: line.labelEn,
        lineNamePl: line.labelPl,
        aggregationLevel: line.aggregationLevel,
        parentCanonicalLineId: line.parentId || null,
        requiredLevel: line.requiredLevel,
        signConvention: line.signConvention,
        isTotal: !!line.isTotal,
        isSubtotal: !!line.isSubtotal,
        isComputed: !!line.isComputed,
        deaggregationReady: !!line.deaggregationReady,
        mappingStatus: explain.mappingStatus,
        valueOrigin: explain.valueOrigin,
        mappingConfidence: explain.mappingConfidence,
        confidence: Number(directHead?.confidence ?? explain.mappingConfidence ?? 0),
        value: Number(firstPeriod.value || 0),
        valuePeriodLabel: firstPeriod.periodLabel || null,
        valuePeriodIndex: Number(firstPeriod.periodIndex ?? 0),
        periodValues,
        originalLabel: directHead?.original_label || line.labelEn,
        sourcePage: directHead?.source_page != null ? Number(directHead.source_page) : null,
        sourceRow: directHead?.source_row != null ? Number(directHead.source_row) : null,
        evidenceJson: explain.evidenceJson,
        explain,
      };
    })
    .filter(Boolean) as StatementAnalyticsRow[];

  return {
    statementId: params.statementId,
    statementType: params.statementType,
    requestedLevel: params.requestedLevel,
    periods: periods.map((period) => ({ label: period.label, index: period.index })),
    rows,
  };
}
