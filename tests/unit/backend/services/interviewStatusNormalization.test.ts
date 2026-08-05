/**
 * M03R-004 — normalizacja statusów wywiadu.
 *
 * Testy celują w konkretny kształt danych zastany na demo (`ASSIGNED` obok
 * `assigned`, `IN_PROGRESS` obok `in_progress`), bo to on ujawnił defekt.
 * Dodatkowo pilnują, żeby wygenerowany SQL faktycznie był odporny na wielkość
 * liter — sam fakt, że funkcja zwraca string, niczego nie dowodzi.
 */
import { describe, expect, it } from 'vitest';

import {
  canonicalStatusToken,
  statusEqualsSql,
  statusInSql,
} from '../../../../server/src/services/interview/interviewStatusNormalization.js';

describe('canonicalStatusToken', () => {
  it('sprowadza warianty zastane na demo do jednej postaci', () => {
    expect(canonicalStatusToken('ASSIGNED')).toBe('assigned');
    expect(canonicalStatusToken('assigned')).toBe('assigned');
    expect(canonicalStatusToken('IN_PROGRESS')).toBe('in_progress');
    expect(canonicalStatusToken('in_progress')).toBe('in_progress');
    expect(canonicalStatusToken('SUBMITTED')).toBe('submitted');
    expect(canonicalStatusToken('COMPLETED')).toBe('completed');
  });

  it('scala warianty z myślnikiem i spacją', () => {
    expect(canonicalStatusToken('in-progress')).toBe('in_progress');
    expect(canonicalStatusToken('In Progress')).toBe('in_progress');
    expect(canonicalStatusToken('  sent_back  ')).toBe('sent_back');
  });

  it('null/undefined dają pusty token, nie wybuch', () => {
    expect(canonicalStatusToken(null)).toBe('');
    expect(canonicalStatusToken(undefined)).toBe('');
  });

  it('jest idempotentny', () => {
    const once = canonicalStatusToken('IN-PROGRESS');
    expect(canonicalStatusToken(once)).toBe(once);
  });
});

describe('statusEqualsSql', () => {
  it('sprowadza kolumnę do lowercase i ujednolica myślnik', () => {
    const sql = statusEqualsSql('a.status');
    expect(sql).toContain('lower(');
    expect(sql).toContain('a.status');
    expect(sql).toContain("replace(a.status, '-', '_')");
    expect(sql.endsWith('= ?')).toBe(true);
  });
});

describe('statusInSql', () => {
  const sql = statusInSql('a.status', ['assigned', 'in_progress', 'sent_back']);

  it('generuje warunek IN po znormalizowanej kolumnie', () => {
    expect(sql).toBe(
      "lower(replace(a.status, '-', '_')) IN ('assigned', 'in_progress', 'sent_back')"
    );
  });

  it('normalizuje także literały podane niekanonicznie', () => {
    expect(statusInSql('s.status', ['COMPLETED', 'In-Progress'])).toBe(
      "lower(replace(s.status, '-', '_')) IN ('completed', 'in_progress')"
    );
  });

  it('kontrola negatywna: nie zostawia w warunku surowej wielkiej litery', () => {
    expect(statusInSql('a.status', ['ASSIGNED'])).not.toMatch(/'ASSIGNED'/);
  });
});
