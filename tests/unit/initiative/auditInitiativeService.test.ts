// @vitest-environment node
/**
 * F0/L1 — createInitiativeFromAudit: audyt → inicjatywa DRAFT z lineage source_type='audit'.
 * Część kręgosłupa inicjatyw (INITIATIVE_SYSTEM_SSOT §F0).
 *
 * Mockuje queryHelpers + kanoniczny lejek createInitiative (wzorzec
 * InitiativeController.test.ts) — czysta logika konwersji + stampowanie lineage.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockFunnelCreate = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: (...args: unknown[]) => mockFunnelCreate(...args),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { createInitiativeFromAudit } from '../../../server/src/services/initiative/auditInitiativeService.ts';

describe('F0 — createInitiativeFromAudit (audyt → inicjatywa)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue([
      { name: 'risk_level' },
      { name: 'created_by' },
    ]);
    // Funnel echoes back a DRAFT initiative with the lineage it was given.
    mockFunnelCreate.mockImplementation(async (_orgId: string, input: any) => ({
      id: 'init-uuid-1',
      name: input.title,
      title: input.title,
      status: 'DRAFT',
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    }));
  });

  const auditRow = {
    id: 'audit-1',
    organization_id: 'org-1',
    project_id: 'proj-9',
    name: 'ISO 27001 Readiness',
    findings: JSON.stringify([
      {
        title: 'Brak polityki backupu',
        description: 'Nie istnieje udokumentowana polityka kopii zapasowych.',
        severity: 'high',
        recommendation: 'Wdrożyć politykę 3-2-1 i testy odtworzeniowe.',
        area: 'cybersecurity',
      },
    ]),
  };

  it('stampuje source_type=audit + source_id=auditId, status DRAFT', async () => {
    const res = await createInitiativeFromAudit({
      auditId: 'audit-1',
      organizationId: 'org-1',
      userId: 'user-1',
      audit: auditRow,
    });

    expect(res.sourceType).toBe('audit');
    expect(res.sourceId).toBe('audit-1');
    expect(res.status).toBe('DRAFT');
    expect(res.id).toBe('init-uuid-1');

    // Funnel called with lineage + NO explicit status (funnel normalizes to DRAFT).
    const [, input, opts] = mockFunnelCreate.mock.calls[0];
    expect(input.sourceType).toBe('audit');
    expect(input.sourceId).toBe('audit-1');
    expect(input.status).toBeUndefined();
    expect(opts).toMatchObject({ validate: false, actor: { id: 'user-1' } });
  });

  it('mapuje finding na pola inicjatywy (title, problem, rekomendacja, priorytet)', async () => {
    await createInitiativeFromAudit({
      auditId: 'audit-1',
      organizationId: 'org-1',
      userId: 'user-1',
      audit: auditRow,
    });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.title).toBe('Brak polityki backupu');
    expect(input.problemStatement).toContain('kopii zapasowych');
    expect(input.description).toContain('Rekomendacja: Wdrożyć politykę 3-2-1');
    expect(input.priority).toBe('high'); // severity high → priority high
    expect(input.projectId).toBe('proj-9'); // inherits audit project
  });

  it('ładuje audyt z DB gdy nie podano go wprost', async () => {
    mockQueryOne.mockResolvedValue(auditRow);
    const res = await createInitiativeFromAudit({
      auditId: 'audit-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockQueryOne).toHaveBeenCalledOnce();
    expect(res.title).toBe('Brak polityki backupu');
  });

  it('używa jawnego finding zamiast pierwszego z audytu', async () => {
    await createInitiativeFromAudit({
      auditId: 'audit-1',
      organizationId: 'org-1',
      userId: 'user-1',
      audit: auditRow,
      finding: { title: 'Inny problem', severity: 'critical' },
    });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.title).toBe('Inny problem');
    expect(input.priority).toBe('critical');
  });

  it('post-create UPDATE ustawia risk_level + created_by (schema-safe)', async () => {
    await createInitiativeFromAudit({
      auditId: 'audit-1',
      organizationId: 'org-1',
      userId: 'user-1',
      audit: auditRow,
    });
    expect(mockQueryRun).toHaveBeenCalledOnce();
    const [sql, vals] = mockQueryRun.mock.calls[0];
    expect(sql).toContain('UPDATE initiatives SET');
    expect(sql).toContain('risk_level = ?');
    expect(sql).toContain('created_by = ?');
    // risk derived from severity high → high; created_by = user; then id + org
    expect(vals).toEqual(['high', 'user-1', 'init-uuid-1', 'org-1']);
  });

  it('audyt nieznaleziony → błąd 404', async () => {
    mockQueryOne.mockResolvedValue(null);
    await expect(
      createInitiativeFromAudit({ auditId: 'nope', organizationId: 'org-1', userId: 'u' })
    ).rejects.toMatchObject({ message: 'Audit not found', statusCode: 404 });
    expect(mockFunnelCreate).not.toHaveBeenCalled();
  });

  it('audyt bez findings → błąd 422, nie tworzy inicjatywy', async () => {
    await expect(
      createInitiativeFromAudit({
        auditId: 'audit-1',
        organizationId: 'org-1',
        userId: 'u',
        audit: { ...auditRow, findings: '[]' },
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(mockFunnelCreate).not.toHaveBeenCalled();
  });

  it('brak auditId/organizationId → guard rzuca', async () => {
    await expect(
      createInitiativeFromAudit({ auditId: '', organizationId: 'org-1', userId: 'u' })
    ).rejects.toThrow('auditId is required');
    await expect(
      createInitiativeFromAudit({ auditId: 'a', organizationId: '', userId: 'u' })
    ).rejects.toThrow('organizationId is required');
  });

  it('parsuje findings z opakowania { findings: [...] }', async () => {
    await createInitiativeFromAudit({
      auditId: 'audit-1',
      organizationId: 'org-1',
      userId: 'user-1',
      audit: {
        ...auditRow,
        findings: JSON.stringify({ findings: [{ title: 'Z opakowania', severity: 'low' }] }),
      },
    });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.title).toBe('Z opakowania');
    expect(input.priority).toBe('low');
  });
});
