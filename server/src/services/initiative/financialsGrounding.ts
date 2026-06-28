/**
 * F0 — Financials grounding (INITIATIVE BACKBONE, §F0 task 2).
 *
 * `buildOrgFinancialsSummary(db, orgId)` reads an organization's REAL headline
 * financial figures (Revenue / EBITDA / Net income, latest confirmed period) and
 * renders them into one short Polish sentence that the generation pipeline injects
 * into the grounding block (business_case / financial_impact / kpis sections).
 *
 * Source of truth (simplest reliable org-level financials — migration 565/20260316):
 *   financial_statements        — the statement document (period, currency, scaling, status)
 *   financial_statement_values  — the actual numeric line values (REAL)
 *   financial_statement_lines   — canonical line taxonomy (line_code: REVENUE/EBITDA/NET_INCOME)
 *
 * HARD RULES:
 * - NO fabrication. Only real DB rows. If nothing confirmed exists → undefined.
 * - Best-effort + fail-soft: ANY error (missing table on a drifted schema, parse
 *   failure, etc.) returns undefined so the caller's grounding stays optional.
 * - Numbers are de-scaled to absolute amounts (scaling thousands/millions/billions)
 *   then formatted compactly (e.g. "8.8M EUR").
 *
 * The `db` parameter is the same low-level `Database` handle used by
 * `initiativeGenerationService.enrichContext` (`this.db`), so wiring is a one-liner
 * (see WIRING NOTE in handoff). We go through `DbPromise.all` exactly like the
 * sibling portfolio/org-context grounding queries.
 */
import DbPromise, { type Database } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/** Canonical P&L line codes we surface, in display priority order. */
const HEADLINE_LINE_CODES = ['REVENUE', 'EBITDA', 'NET_INCOME'] as const;

/** Polish labels for the headline line codes. */
const LINE_LABEL_PL: Record<string, string> = {
  REVENUE: 'Przychód',
  EBITDA: 'EBITDA',
  NET_INCOME: 'Zysk netto',
};

/** Multiply a stored `value` by its statement scaling to get the absolute amount. */
const SCALING_MULTIPLIER: Record<string, number> = {
  units: 1,
  thousands: 1_000,
  millions: 1_000_000,
  billions: 1_000_000_000,
};

interface FinancialRow {
  line_code: string;
  value: number | string | null;
  scaling: string | null;
  currency: string | null;
  period_label: string | null;
  period_end: string | null;
}

/**
 * Format an absolute amount compactly: "8.8M", "2.7M", "950K", "1.2B".
 * Keeps it human-readable for a one-line prompt grounding string.
 */
function formatAmount(abs: number): string {
  const sign = abs < 0 ? '-' : '';
  const v = Math.abs(abs);
  if (v >= 1_000_000_000) return `${sign}${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${sign}${Math.round(v / 1_000)}K`;
  return `${sign}${Math.round(v)}`;
}

/**
 * Build a one-line Polish summary of the org's latest confirmed financials.
 *
 * Returns e.g. "Przychód 2025: 8.8M EUR; EBITDA 2.7M; Zysk netto 1.4M" — or
 * `undefined` when there is no confirmed financial data (or on ANY error).
 *
 * @param db    Low-level Database handle (initiativeGenerationService `this.db`).
 * @param orgId Organization id to scope the query.
 */
export async function buildOrgFinancialsSummary(
  db: Database,
  orgId: string
): Promise<string | undefined> {
  if (!db || !orgId) return undefined;

  try {
    // Pick the most recent CONFIRMED P&L statement for the org, then read its
    // headline line values. We anchor on a single statement (the latest period)
    // so figures are internally consistent (same period/currency/scaling).
    const rows = await DbPromise.all<FinancialRow>(
      db,
      `SELECT fsl.line_code           AS line_code,
              fsv.value               AS value,
              fs.scaling              AS scaling,
              fs.currency             AS currency,
              fs.period_label         AS period_label,
              fs.period_end           AS period_end
       FROM financial_statement_values fsv
       JOIN financial_statement_lines  fsl ON fsv.canonical_line_id = fsl.id
       JOIN financial_statements       fs  ON fsv.statement_id = fs.id
       WHERE fs.organization_id = ?
         AND fs.statement_type = 'P&L'
         AND fs.status = 'confirmed'
         AND fsl.line_code IN ('REVENUE', 'EBITDA', 'NET_INCOME')
         AND fs.period_end = (
           SELECT MAX(period_end) FROM financial_statements
           WHERE organization_id = ? AND statement_type = 'P&L' AND status = 'confirmed'
         )`,
      [orgId, orgId]
    );

    if (!Array.isArray(rows) || rows.length === 0) return undefined;

    // Index by line_code; coerce REAL (node-pg may hand back string for numeric).
    const byCode = new Map<string, FinancialRow>();
    let currency = 'PLN';
    let periodLabel: string | undefined;

    for (const r of rows) {
      if (!r || !r.line_code) continue;
      byCode.set(r.line_code, r);
      if (r.currency) currency = String(r.currency);
      if (!periodLabel) {
        periodLabel =
          (r.period_label && String(r.period_label)) ||
          (r.period_end ? String(r.period_end).slice(0, 4) : undefined);
      }
    }

    const parts: string[] = [];
    for (const code of HEADLINE_LINE_CODES) {
      const row = byCode.get(code);
      if (!row) continue;
      const raw = row.value;
      const num = typeof raw === 'string' ? Number(raw) : raw;
      if (num == null || !Number.isFinite(num)) continue;
      const scale = SCALING_MULTIPLIER[String(row.scaling || 'units').toLowerCase()] ?? 1;
      const abs = num * scale;
      const label = LINE_LABEL_PL[code] || code;
      // Currency stamped on the first (REVENUE-priority) figure only — keeps the
      // line compact while still naming the unit.
      parts.push(
        parts.length === 0
          ? `${label}${periodLabel ? ` ${periodLabel}` : ''}: ${formatAmount(abs)} ${currency}`
          : `${label} ${formatAmount(abs)}`
      );
    }

    if (parts.length === 0) return undefined;
    return parts.join('; ');
  } catch (err) {
    // Fail-soft: drifted schema (tables absent), query/parse failure — financials
    // grounding is strictly optional, never block or surface the error.
    logger.warn(
      `[financialsGrounding] best-effort summary failed (ignored): ${
        (err as Error)?.message || err
      }`
    );
    return undefined;
  }
}

export default { buildOrgFinancialsSummary };
