/**
 * filterEval — single source of truth for evaluating a table FilterRule against a row.
 *
 * M08 L-02: the two evaluators (useTableRows legacy + useTablePlatformIntegration
 * platform) each had their own 6-operator switch (contains/equals/not_empty/
 * is_empty/gt/lt) and fell through to `return true` for everything else. But the
 * active filter UI (FilterBuilder) emits a much richer vocabulary — startsWith,
 * notEquals, isEmpty, gte, isAnyOf, between, date operators, … — so most filter
 * rules silently did nothing. This module handles the full union (both the legacy
 * snake_case operators and FilterBuilder's camelCase ones) so a filter the user
 * sets actually filters.
 */

export interface EvaluableRule {
  column: string;
  operator: string;
  value: string | string[] | number | null | undefined;
}

export interface EvaluableRow {
  type?: string;
  data?: Record<string, unknown> | null;
}

const cellRaw = (row: EvaluableRow, column: string): unknown =>
  row?.data?.[column] ?? row?.data?.label ?? '';

const toStr = (v: unknown): string => (v == null ? '' : String(v));

const toList = (v: EvaluableRule['value']): string[] => {
  if (Array.isArray(v)) return v.map((x) => toStr(x).trim().toLowerCase()).filter(Boolean);
  return toStr(v)
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
};

const startOfDay = (d: Date): number => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
};

/** Relative date presets used by FilterBuilder's `isWithin` operator. */
function withinRange(preset: string, now: Date): { from: number; to: number } | null {
  const today = startOfDay(now);
  const day = 86_400_000;
  switch (preset) {
    case 'today':
      return { from: today, to: today + day - 1 };
    case 'thisWeek':
      return { from: today - ((now.getDay() + 6) % 7) * day, to: today + day - 1 + 6 * day };
    case 'thisMonth': {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = startOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) + day - 1;
      return { from, to };
    }
    case 'thisYear': {
      const from = startOfDay(new Date(now.getFullYear(), 0, 1));
      const to = startOfDay(new Date(now.getFullYear(), 11, 31)) + day - 1;
      return { from, to };
    }
    case 'pastWeek':
      return { from: today - 7 * day, to: today + day - 1 };
    case 'pastMonth':
      return { from: today - 30 * day, to: today + day - 1 };
    case 'pastYear':
      return { from: today - 365 * day, to: today + day - 1 };
    case 'nextWeek':
      return { from: today, to: today + 7 * day };
    case 'nextMonth':
      return { from: today, to: today + 30 * day };
    case 'nextYear':
      return { from: today, to: today + 365 * day };
    default:
      return null;
  }
}

/**
 * Evaluate one filter rule against one row.
 * `now` is injectable so tests stay deterministic; callers pass new Date().
 */
export function evaluateFilterRule(
  rule: EvaluableRule,
  row: EvaluableRow,
  now: Date = new Date()
): boolean {
  const raw = cellRaw(row, rule.column);
  const val = toStr(raw).toLowerCase();
  const ruleVal = toStr(rule.value).toLowerCase();
  const num = Number(raw);
  const ruleNum = Number(rule.value);

  switch (rule.operator) {
    // ── text ──────────────────────────────────────────────────────────────
    case 'contains':
      return val.includes(ruleVal);
    case 'doesNotContain':
    case 'not_contains':
      return !val.includes(ruleVal);
    case 'startsWith':
      return val.startsWith(ruleVal);
    case 'endsWith':
      return val.endsWith(ruleVal);

    // ── equality (text/number/select) ───────────────────────────────────────
    case 'equals':
    case 'is':
      return val === ruleVal;
    case 'notEquals':
    case 'isNot':
      return val !== ruleVal;

    // ── emptiness (both naming conventions) ─────────────────────────────────
    case 'is_empty':
    case 'isEmpty':
      return val.trim().length === 0;
    case 'not_empty':
    case 'isNotEmpty':
      return val.trim().length > 0;

    // ── numeric ─────────────────────────────────────────────────────────────
    case 'gt':
      return Number.isFinite(num) && Number.isFinite(ruleNum) && num > ruleNum;
    case 'gte':
      return Number.isFinite(num) && Number.isFinite(ruleNum) && num >= ruleNum;
    case 'lt':
      return Number.isFinite(num) && Number.isFinite(ruleNum) && num < ruleNum;
    case 'lte':
      return Number.isFinite(num) && Number.isFinite(ruleNum) && num <= ruleNum;
    case 'between': {
      // value: [min, max] or "min,max"
      const parts = Array.isArray(rule.value) ? rule.value : toStr(rule.value).split(',');
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (!Number.isFinite(num) || !Number.isFinite(min) || !Number.isFinite(max)) return false;
      return num >= min && num <= max;
    }

    // ── set membership ──────────────────────────────────────────────────────
    case 'in':
    case 'isAnyOf':
      return toList(rule.value).includes(val);
    case 'isNoneOf':
      return !toList(rule.value).includes(val);

    // ── dates ───────────────────────────────────────────────────────────────
    case 'isBefore':
    case 'isAfter':
    case 'isOnOrBefore':
    case 'isOnOrAfter': {
      const cell = Date.parse(toStr(raw));
      const target = Date.parse(toStr(rule.value));
      if (Number.isNaN(cell) || Number.isNaN(target)) return false;
      const c = startOfDay(new Date(cell));
      const t = startOfDay(new Date(target));
      if (rule.operator === 'isBefore') return c < t;
      if (rule.operator === 'isAfter') return c > t;
      if (rule.operator === 'isOnOrBefore') return c <= t;
      return c >= t; // isOnOrAfter
    }
    case 'isWithin': {
      const cell = Date.parse(toStr(raw));
      if (Number.isNaN(cell)) return false;
      const range = withinRange(toStr(rule.value), now);
      if (!range) return false;
      return cell >= range.from && cell <= range.to;
    }

    default:
      // Unknown operator → do not silently drop rows; treat as no-op match.
      return true;
  }
}
