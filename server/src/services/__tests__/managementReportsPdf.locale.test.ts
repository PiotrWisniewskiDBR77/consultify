import { describe, expect, it } from 'vitest';

import { managementReportPdfLabels } from '../managementReportsService.js';

describe('management report PDF locale', () => {
  it('provides Polish copy for every literal written through doc.text', () => {
    const labels = Object.values(managementReportPdfLabels('pl'));
    expect(labels).toEqual([
      'Raport zarządczy',
      'Wymagane decyzje',
      'Brak',
      'Decyzja',
      'Właściciel',
      'Do ustalenia',
      'Najważniejsze informacje',
      'Brak dostępnych informacji.',
    ]);
    expect(labels).not.toContain('Decisions Required');
    expect(labels).not.toContain('No highlights available.');
  });
});
