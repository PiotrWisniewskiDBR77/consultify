/**
 * FIN-005 — Finance period serialization.
 *
 * The bug under test: `financial_statements.period_end` is a Postgres `DATE`,
 * node-pg returns it as a JS `Date`, and `String(date)` in the pack-label
 * fallback produced
 * `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)`,
 * which was persisted to `period_label` and rendered to the user.
 *
 * Required coverage (packet FIN-005): ISO string, bare year, null, legacy
 * date string. Each is asserted below, plus the `Date`-object case that is the
 * actual production input shape.
 */

import { describe, expect, it } from 'vitest';

import {
  formatPeriodLabel,
  resolvePeriodLabel,
  serializeRowPeriodFields,
  serializeRowsPeriodFields,
  toPeriodIsoDate,
} from '../financePeriodFormat.js';

/** The exact string the 2026-08-01 staging probe saw in the PERIOD column. */
const LEGACY_DATE_STRING = 'Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)';

/** Nothing the serializer emits may look like a raw JS Date.toString(). */
const RAW_JS_DATE_RE = /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\b/;

describe('formatPeriodLabel', () => {
  it('ISO string — renders the calendar date, not a timestamp', () => {
    expect(formatPeriodLabel('2014-12-31')).toBe('2014-12-31');
    expect(formatPeriodLabel('2014-12-31T00:00:00.000Z')).toBe('2014-12-31');
    expect(formatPeriodLabel('2014-12-31 00:00:00')).toBe('2014-12-31');
  });

  it('year — a bare year is already a label and is passed through', () => {
    expect(formatPeriodLabel('2014')).toBe('2014');
    expect(formatPeriodLabel(2014)).toBe('2014');
  });

  it('year as a number is never misread as an epoch timestamp', () => {
    // `new Date(2014)` is 1970-01-01T00:00:02.014Z — silently wrong.
    expect(formatPeriodLabel(2014)).not.toContain('1970');
    expect(toPeriodIsoDate(2014)).toBeNull();
  });

  it('null — empty inputs collapse to an empty label, never "Invalid Date"', () => {
    expect(formatPeriodLabel(null)).toBe('');
    expect(formatPeriodLabel(undefined)).toBe('');
    expect(formatPeriodLabel('')).toBe('');
    expect(formatPeriodLabel('   ')).toBe('');
  });

  it('legacy date string — the raw Date.toString() form is converted', () => {
    expect(formatPeriodLabel(LEGACY_DATE_STRING)).toBe('2026-12-31');
    expect(formatPeriodLabel(LEGACY_DATE_STRING)).not.toMatch(RAW_JS_DATE_RE);
  });

  it('Date object — the production input shape from node-pg (local-midnight DATE)', () => {
    expect(formatPeriodLabel(new Date(2014, 11, 31))).toBe('2014-12-31');
    expect(formatPeriodLabel(new Date('2014-12-31T00:00:00.000Z'))).toBe('2014-12-31');
  });

  it('a Date-object period end never renders as a raw Date string', () => {
    const rendered = formatPeriodLabel(new Date(2026, 11, 31));
    expect(rendered).not.toMatch(RAW_JS_DATE_RE);
    expect(rendered).not.toContain('GMT');
    expect(rendered).not.toContain('Coordinated Universal Time');
  });

  it('a real human period label is passed through untouched', () => {
    expect(formatPeriodLabel('FY2014')).toBe('FY2014');
    expect(formatPeriodLabel('Q1 2026')).toBe('Q1 2026');
    expect(formatPeriodLabel('  FY2025  ')).toBe('FY2025');
  });

  it('does not invent a period type it cannot know', () => {
    // A quarter-end date is NOT relabelled "Q1 2026" — it could be a March
    // monthly close. The serializer only states what the value proves.
    expect(formatPeriodLabel('2026-03-31')).toBe('2026-03-31');
  });

  it('an unparsable Date-shaped string is dropped, not passed through', () => {
    expect(formatPeriodLabel('Thu Xxx 99 2026 raw')).toBe('');
  });
});

describe('toPeriodIsoDate', () => {
  /**
   * REGRESSION — caught by running the seed against a real PostgreSQL.
   *
   * node-pg parses a `DATE` column (OID 1082) into LOCAL midnight, i.e.
   * `new Date(2014, 11, 31)`. An earlier version of this module read every Date
   * with UTC getters, so on a `Europe/Warsaw` host a pack seeded as
   * `2014-12-31` read back as `2014-12-30` — the period silently shifted a day.
   *
   * `new Date(y, m, d)` reproduces the node-pg shape in ANY host timezone, so
   * this assertion is timezone-independent.
   */
  it('a Postgres DATE (local midnight) keeps its calendar day', () => {
    expect(toPeriodIsoDate(new Date(2014, 11, 31))).toBe('2014-12-31');
    expect(toPeriodIsoDate(new Date(2014, 0, 1))).toBe('2014-01-01');
  });

  it('an ISO instant is read as UTC, not shifted by the host timezone', () => {
    expect(toPeriodIsoDate(new Date('2014-12-31T00:00:00.000Z'))).toBe('2014-12-31');
    expect(toPeriodIsoDate('2014-12-31T00:00:00.000Z')).toBe('2014-12-31');
  });

  it('returns null for values that do not denote a specific day', () => {
    expect(toPeriodIsoDate('FY2014')).toBeNull();
    expect(toPeriodIsoDate('2014')).toBeNull();
    expect(toPeriodIsoDate(null)).toBeNull();
    expect(toPeriodIsoDate('')).toBeNull();
  });

  it('returns null for an invalid Date instead of "Invalid Date"', () => {
    expect(toPeriodIsoDate(new Date('nonsense'))).toBeNull();
  });
});

describe('resolvePeriodLabel', () => {
  it('prefers the explicit label over the period end', () => {
    expect(resolvePeriodLabel('FY2014', new Date(2014, 11, 31))).toBe('FY2014');
  });

  it('falls back to the period end — the exact path that leaked the raw Date', () => {
    expect(resolvePeriodLabel(null, new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(resolvePeriodLabel('', new Date(2026, 11, 31))).not.toMatch(RAW_JS_DATE_RE);
  });

  it('repairs a label that was already persisted as a raw Date string', () => {
    expect(resolvePeriodLabel(LEGACY_DATE_STRING, new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('returns an empty label when nothing is resolvable', () => {
    expect(resolvePeriodLabel(null, null)).toBe('');
  });
});

describe('serializeRowPeriodFields', () => {
  it('normalizes the period columns of a statement row from node-pg', () => {
    const row = serializeRowPeriodFields({
      id: 'stmt-1',
      statement_type: 'P&L',
      // node-pg DATE shape: local midnight.
      period_start: new Date(2014, 0, 1),
      period_end: new Date(2014, 11, 31),
      period_label: 'FY2014',
      currency: 'EUR',
    });

    expect(row.period_start).toBe('2014-01-01');
    expect(row.period_end).toBe('2014-12-31');
    expect(row.period_label).toBe('FY2014');
    // Untouched fields survive.
    expect(row.currency).toBe('EUR');
    expect(row.statement_type).toBe('P&L');
  });

  it('repairs a legacy row whose label holds the raw Date string', () => {
    const row = serializeRowPeriodFields({
      id: 'stmt-legacy',
      period_end: new Date(2026, 11, 31),
      period_label: LEGACY_DATE_STRING,
    });

    expect(row.period_label).toBe('2026-12-31');
    expect(JSON.stringify(row)).not.toMatch(/GMT\+\d{4}/);
  });

  it('leaves a row with no period columns alone', () => {
    const row = serializeRowPeriodFields({ id: 'model-1', name: 'Atelier Toys' });
    expect(row).toEqual({ id: 'model-1', name: 'Atelier Toys' });
  });

  it('empties a label that cannot be resolved rather than emitting a Date', () => {
    const row = serializeRowPeriodFields({ id: 'x', period_label: null, period_end: null });
    expect(row.period_label).toBeNull();
  });
});

describe('serializeRowsPeriodFields', () => {
  it('normalizes every row and tolerates a null list', () => {
    const rows = serializeRowsPeriodFields([
      { id: 'a', period_end: new Date(2014, 11, 31), period_label: null },
      { id: 'b', period_end: new Date(2015, 11, 31), period_label: 'FY2015' },
    ]);

    expect(rows.map((r) => r.period_label)).toEqual(['2014-12-31', 'FY2015']);
    expect(serializeRowsPeriodFields(null)).toEqual([]);
    expect(serializeRowsPeriodFields(undefined)).toEqual([]);
  });
});
