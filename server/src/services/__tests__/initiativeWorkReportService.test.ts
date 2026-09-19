/** @vitest-environment node */
import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { resolveWorkReportInitiativeStatus } from '../../domain/initiatives-execution/postgresInitiativeReader.js';
import {
  renderInitiativeWorkReportPdf,
  selectInitiativeWorkReportSections,
  workReportInitiativeLine,
  type InitiativeWorkReportContent,
  type InitiativeWorkReportTemplate,
} from '../initiativeWorkReportService.js';

const PROJECT_UUID = '6174636d-c4f2-4a1b-9d1e-0a1b2c3d4e5f';
const OWNER_UUID = 'd62073a5-7095-4b6c-8a2d-1c2d3e4f5a6b';

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
      projectId: PROJECT_UUID,
      ownerId: OWNER_UUID,
      projectName: 'Margin Leakage Recovery',
      ownerName: 'Lena Meyer',
      updatedAt: '2026-09-14T11:00:00.000Z',
    },
    {
      // Frozen snapshot captured before D-45: no names — the line falls back
      // to the captured ids instead of inventing them.
      id: 'old',
      version: 2,
      title: 'Old',
      status: 'ACTIVE',
      projectId: 'project-1',
      ownerId: null,
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

async function extractText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  return result.text.replace(/\n*--\s*\d+\s*of\s*\d+\s*--\n*/g, '\n').trim();
}

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

describe('D-45 — the client PDF carries words and names, not codes and uuids', () => {
  it('wpięcie: rendered PDF text shows names and dictionary words (no raw uuid)', async () => {
    const text = await extractText(await renderInitiativeWorkReportPdf(content('PORTFOLIO_STATUS')));
    expect(text).toContain('Blocked · project Margin Leakage Recovery · owner Lena Meyer');
    expect(text).not.toContain(PROJECT_UUID);
    expect(text).not.toContain(OWNER_UUID);
  });

  it('wpięcie: a name-less frozen snapshot falls back to the captured ids', async () => {
    const text = await extractText(await renderInitiativeWorkReportPdf(content('PORTFOLIO_STATUS')));
    expect(text).toContain('Active · project project-1 · owner unassigned');
  });

  it('logika: the line composer labels the status code and prefers names', () => {
    expect(workReportInitiativeLine(content('PORTFOLIO_STATUS').initiatives[0])).toBe(
      `Blocked · project Margin Leakage Recovery · owner Lena Meyer`
    );
  });

  it.each([
    [{ lifecycleState: 'ANALYZING' }, 'PENDING_APPROVAL'],
    [{ lifecycleState: 'IN_EXECUTION' }, 'IN_EXECUTION'],
    [{ status: 'EXECUTING' }, 'IN_EXECUTION'],
    [{ status: 'PENDING_APPROVAL' }, 'PENDING_APPROVAL'],
    [{}, 'UNKNOWN'],
    [null, 'UNKNOWN'],
  ] as const)(
    'logika: resolver maps payload %j to the seven-code dictionary (%s)',
    (payload, expected) => {
      expect(resolveWorkReportInitiativeStatus(payload as Record<string, unknown> | null)).toBe(
        expected
      );
    }
  );

  it('logika: the engine stage wins over a stale legacy status key', () => {
    expect(
      resolveWorkReportInitiativeStatus({ lifecycleState: 'SCHEDULED', status: 'EXECUTING' })
    ).toBe('APPROVED');
  });
});
