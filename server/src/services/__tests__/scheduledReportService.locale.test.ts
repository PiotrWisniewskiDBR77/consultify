import { describe, expect, it } from 'vitest';

import { buildScheduledReportEmail } from '../scheduledReportService.js';

describe('scheduled report email locale', () => {
  it('renders the Northwind delivery wholly in English', () => {
    const email = buildScheduledReportEmail('en', 'Northwind weekly report', 'report-42', false);
    expect(email.subject).toBe('Report “Northwind weekly report” is ready');
    expect(email.html).toContain('The scheduled report');
    expect(email.html).toContain('Report identifier');
    expect(email.html).toContain('Materials library');
    expect(email.html).not.toMatch(/Zaplanowany|Identyfikator|Materiał/);
  });

  it('renders the same delivery wholly in Polish', () => {
    const email = buildScheduledReportEmail('pl', 'Raport tygodniowy', 'raport-42', true);
    expect(email.subject).toBe('Raport „Raport tygodniowy” gotowy');
    expect(email.html).toContain('Zaplanowany raport');
    expect(email.html).toContain('Identyfikator raportu');
    expect(email.html).toContain('W załączniku');
    expect(email.html).not.toMatch(/The scheduled report|Report identifier|complete file bundle/);
  });
});
