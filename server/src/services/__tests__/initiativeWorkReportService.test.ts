/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import {
  renderInitiativeWorkReportPdf,
  selectInitiativeWorkReportSections,
  type InitiativeWorkReportContent,
  type InitiativeWorkReportTemplate,
} from '../initiativeWorkReportService.js';

const content = (templateId: InitiativeWorkReportTemplate): InitiativeWorkReportContent => ({
  generatedAt: '2026-09-14T12:00:00.000Z',
  title: 'Tygodniowy raport pracy — Łódź',
  templateId,
  projectIds: ['project-1'],
  summary: {
    initiatives: 2,
    pendingDecisions: 2,
    overdueDecisions: 1,
    byStatus: { BLOCKED: 1, ACTIVE: 1 },
  },
  initiatives: [
    {
      id: 'risk',
      version: 4,
      title: 'Risk',
      status: 'BLOCKED',
      projectId: 'project-1',
      ownerId: 'owner-1',
      updatedAt: '2026-09-14T11:00:00.000Z',
    },
    {
      id: 'old',
      version: 2,
      title: 'Old',
      status: 'ACTIVE',
      projectId: 'project-1',
      ownerId: 'owner-2',
      updatedAt: '2026-08-01T11:00:00.000Z',
    },
  ],
  decisionDebtors: [
    {
      authorityId: 'manager-1',
      authorityName: 'Żaneta Łącka',
      pending: 1,
      overdue: 1,
      oldestDueAt: '2026-09-10T09:00:00.000Z',
    },
    { authorityId: 'manager-2', authorityName: 'Noah', pending: 1, overdue: 0, oldestDueAt: null },
  ],
});

describe('initiative work report PDF', () => {
  it('renders a real PDF from captured portfolio and decision-debtor data', async () => {
    const pdf = await renderInitiativeWorkReportPdf(content('DECISION_BACKLOG'));

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });

  it.each([
    ['EXECUTIVE_SUMMARY', 'Priority initiatives', 2, 2],
    ['PORTFOLIO_STATUS', 'Initiatives', 2, 0],
    ['DECISION_BACKLOG', null, 0, 2],
    ['DELIVERY_RISKS', 'Initiatives requiring attention', 1, 1],
    ['WEEKLY_TEAM_UPDATE', 'Initiatives updated this week', 1, 2],
  ] as const)('%s has a distinct section contract', (templateId, heading, initiatives, debtors) => {
    const selected = selectInitiativeWorkReportSections(content(templateId));
    expect(selected.initiativeHeading).toBe(heading);
    expect(selected.initiatives).toHaveLength(initiatives);
    expect(selected.decisionDebtors).toHaveLength(debtors);
  });
});
