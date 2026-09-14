import { describe, expect, it } from 'vitest';

import { localizedReportMessage, reportMessage, resolveReportLocale } from '../reportLocale.js';

describe('reportLocale — DEC-510', () => {
  it('uses the first valid job/user/org locale and falls back to English', () => {
    expect(resolveReportLocale('pl-PL', 'en')).toBe('pl');
    expect(resolveReportLocale(null, 'en-US', 'pl')).toBe('en');
    expect(resolveReportLocale(null, 'de-DE')).toBe('en');
  });

  it('returns a stable key, params and one-locale value', () => {
    expect(localizedReportMessage('en', 'scheduledReports.subject', { name: 'Northwind' })).toEqual(
      {
        key: 'scheduledReports.subject',
        params: { name: 'Northwind' },
        value: 'Report “Northwind” is ready',
        locale: 'en',
      }
    );
    expect(reportMessage('pl', 'executionReports.noTarget')).toBe('Brak celu');
  });
});
