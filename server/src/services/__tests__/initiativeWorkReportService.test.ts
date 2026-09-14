/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { renderInitiativeWorkReportPdf } from '../initiativeWorkReportService.js';

describe('initiative work report PDF', () => {
  it('renders a real PDF from captured portfolio and decision-debtor data', async () => {
    const pdf = await renderInitiativeWorkReportPdf({
      generatedAt: '2026-09-14T12:00:00.000Z',
      title: 'Tygodniowy raport pracy — Łódź',
      templateId: 'DECISION_BACKLOG',
      projectIds: ['project-1'],
      summary: {
        initiatives: 1,
        pendingDecisions: 2,
        overdueDecisions: 1,
        byStatus: { IN_EXECUTION: 1 },
      },
      initiatives: [
        {
          id: 'initiative-1',
          version: 4,
          title: 'Uruchomienie pilotażu',
          status: 'IN_EXECUTION',
          projectId: 'project-1',
          ownerId: 'owner-1',
          updatedAt: '2026-09-14T11:00:00.000Z',
        },
      ],
      decisionDebtors: [
        {
          authorityId: 'manager-1',
          authorityName: 'Żaneta Łącka',
          pending: 2,
          overdue: 1,
          oldestDueAt: '2026-09-10T09:00:00.000Z',
        },
      ],
    });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });
});
