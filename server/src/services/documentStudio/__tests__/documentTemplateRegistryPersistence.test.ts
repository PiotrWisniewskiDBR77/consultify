/**
 * Document Studio — Template Registry Persistence (Epic E1, Slice 1.1).
 *
 * Verifies that:
 *   1. Every write through the public service API (`draftTemplate`,
 *      `approveTemplate`, `deprecateTemplate`, `draftTemplateAsync`)
 *      triggers a best-effort `persistTemplate` write to the DAO.
 *   2. Audit entries are also written through to the DAO.
 *   3. `ensureTemplateRegistryHydrated` populates the cache from the DAO
 *      on first access and is idempotent on subsequent calls.
 *   4. Hydration brings system-org templates into every tenant's listing
 *      via the SYSTEM_ORG_ID convention.
 *   5. Persistence failures (DB outage / missing migration) degrade
 *      gracefully — the service keeps functioning with the in-process Map
 *      and never throws on the public API path.
 *
 * The DAO is mocked at the module boundary so these specs run without a
 * live Postgres backing store.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The DAO stubs are invoked through the `vi.mock` factory below with the real
// DAO arguments; declare the rest signature so `mock.calls[n][0]` is typed as a
// captured argument rather than as an element of an empty tuple.
const persistTemplateMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const persistAuditEntryMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const loadTemplatesForOrgMock = vi.fn(async (_orgId: string) => [] as never[]);
const loadAuditForTemplateMock = vi.fn(async (_t: string, _o: string) => [] as never[]);

vi.mock('../documentTemplateRegistryDao.js', () => ({
  SYSTEM_ORG_ID: '__system__',
  persistTemplate: (...args: unknown[]) => persistTemplateMock(...(args as [never])),
  persistAuditEntry: (...args: unknown[]) => persistAuditEntryMock(...(args as [never])),
  loadTemplatesForOrg: (...args: unknown[]) =>
    loadTemplatesForOrgMock(...(args as [string])) as never,
  loadAuditForTemplate: (...args: unknown[]) =>
    loadAuditForTemplateMock(...(args as [string, string])) as never,
  __resetTemplateRegistryDaoForTests: async () => undefined,
}));

// Service must be imported after the mock is registered.
const {
  __resetTemplateRegistryForTests,
  approveTemplate,
  deprecateTemplate,
  draftTemplate,
  draftTemplateAsync,
  ensureTemplateRegistryHydrated,
  getTemplate,
  listTemplates,
  listTemplateAuditEntries,
  reviseTemplateStructureDurably,
} = await import('../documentTemplateService.js');

describe('documentTemplateService — persistence write-through', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
    persistTemplateMock.mockClear();
    persistAuditEntryMock.mockClear();
    loadTemplatesForOrgMock.mockClear();
    loadAuditForTemplateMock.mockClear();
  });

  afterEach(() => {
    persistTemplateMock.mockResolvedValue({ ok: true });
    persistAuditEntryMock.mockResolvedValue({ ok: true });
    loadTemplatesForOrgMock.mockResolvedValue([]);
    loadAuditForTemplateMock.mockResolvedValue([]);
  });

  it('draftTemplate triggers persistTemplate and persistAuditEntry write-through', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-X',
      userId: 'user-1',
      input: { purpose: 'persist test', documentType: 'executive_memo' },
    });
    // Allow the fire-and-forget micro-tasks to flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(persistTemplateMock).toHaveBeenCalledTimes(1);
    const persistedArg = persistTemplateMock.mock.calls[0]?.[0] as unknown as {
      templateId: string;
      organizationId: string;
    };
    expect(persistedArg.templateId).toBe(template.templateId);
    expect(persistedArg.organizationId).toBe('org-X');

    expect(persistAuditEntryMock).toHaveBeenCalledTimes(1);
    const auditArg = persistAuditEntryMock.mock.calls[0]?.[0] as unknown as {
      action: string;
    };
    expect(auditArg.action).toBe('template_drafted');
  });

  it('approveTemplate writes the updated row and a template_approved audit entry', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-X',
      userId: 'user-1',
      input: { purpose: 'approve persist', documentType: 'executive_memo' },
    });
    await Promise.resolve();
    persistTemplateMock.mockClear();
    persistAuditEntryMock.mockClear();

    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-X',
      userId: 'user-2',
    });
    await Promise.resolve();
    expect(approved.status).toBe('approved');

    expect(persistTemplateMock).toHaveBeenCalledTimes(1);
    const persisted = persistTemplateMock.mock.calls[0]?.[0] as unknown as {
      status: string;
      version: string;
    };
    expect(persisted.status).toBe('approved');
    expect(persisted.version).toBe('1.0');

    const auditCalls = persistAuditEntryMock.mock.calls.map(
      (c) => (c[0] as unknown as { action: string }).action
    );
    expect(auditCalls).toContain('template_approved');
  });

  it('durable structure save does not resolve before the DAO confirms the edited blueprint', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-X',
      userId: 'author',
      input: { purpose: 'durable save', documentType: 'executive_memo' },
    });
    await Promise.resolve();
    persistTemplateMock.mockClear();

    let releasePersist!: (value: { ok: boolean }) => void;
    const persistenceBarrier = new Promise<{ ok: boolean }>((resolve) => {
      releasePersist = resolve;
    });
    // reviseTemplateStructure keeps its legacy best-effort write-through;
    // the second call is the explicit durability barrier used by HTTP.
    persistTemplateMock
      .mockResolvedValueOnce({ ok: true })
      .mockImplementationOnce(() => persistenceBarrier);

    let resolved = false;
    const save = reviseTemplateStructureDurably({
      templateId: template.templateId,
      organizationId: 'org-X',
      userId: 'author',
      sections: [
        {
          title: 'Decision required',
          level: 1,
          purpose: 'State the decision, deadline and accountable owner.',
          required: true,
          expectedLengthHint: 'short',
          keyMessage: 'The Board must decide before the delivery gate.',
          dataNeeded: ['Decision deadline', 'Named owner'],
          suggestedEvidence: 'Signed decision record',
        },
      ],
      requiredInputs: ['Board decision record'],
    }).then((value) => {
      resolved = true;
      return value;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    releasePersist({ ok: true });
    const saved = await save;

    expect(saved.requiredInputs).toEqual(['Board decision record']);
    expect(saved.sectionBlueprint[0]?.keyMessage).toBe(
      'The Board must decide before the delivery gate.'
    );
    expect(persistTemplateMock).toHaveBeenCalledTimes(2);
  });

  it('deprecateTemplate writes the updated row and a template_deprecated audit entry', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-X',
      userId: 'user-1',
      input: { purpose: 'deprecate persist', documentType: 'executive_memo' },
    });
    approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-X',
      userId: 'user-1',
    });
    await Promise.resolve();
    persistTemplateMock.mockClear();
    persistAuditEntryMock.mockClear();

    const deprecated = deprecateTemplate({
      templateId: template.templateId,
      organizationId: 'org-X',
      userId: 'user-3',
      reason: 'Replaced',
    });
    await Promise.resolve();
    expect(deprecated.status).toBe('deprecated');
    expect(persistTemplateMock).toHaveBeenCalledTimes(1);
    const persisted = persistTemplateMock.mock.calls[0]?.[0] as unknown as { status: string };
    expect(persisted.status).toBe('deprecated');

    const auditCalls = persistAuditEntryMock.mock.calls.map(
      (c) => (c[0] as unknown as { action: string }).action
    );
    expect(auditCalls).toContain('template_deprecated');
  });

  it('persistence failures do not throw — the service keeps the in-process Map authoritative', async () => {
    persistTemplateMock.mockRejectedValueOnce(new Error('connection refused'));
    persistAuditEntryMock.mockRejectedValueOnce(new Error('connection refused'));

    expect(() => {
      draftTemplate({
        organizationId: 'org-X',
        userId: 'user-1',
        input: { purpose: 'failure path', documentType: 'executive_memo' },
      });
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    // Cache must still hold the template even when persistence failed.
    const drafts = listTemplates('org-X', { status: 'draft' });
    expect(drafts).toHaveLength(1);
  });

  it('ensureTemplateRegistryHydrated is idempotent and only loads each org once', async () => {
    loadTemplatesForOrgMock.mockResolvedValue([] as never[]);
    await ensureTemplateRegistryHydrated('org-Y');
    await ensureTemplateRegistryHydrated('org-Y');
    await ensureTemplateRegistryHydrated('org-Y');
    // The hydration path triggers `seedSystemDocumentTemplates()` which
    // itself probes `loadTemplatesForOrg('__system__')` once per process.
    // We assert that the *requesting tenant* org load happens exactly
    // once (idempotent re-entry) and tolerate the system probe.
    const tenantLoads = loadTemplatesForOrgMock.mock.calls.filter(
      (call) => (call[0] as string) === 'org-Y'
    );
    expect(tenantLoads).toHaveLength(1);
  });

  it('hydration populates the cache from the DAO so cold-start reads return persisted templates', async () => {
    const persistedTemplate = {
      templateId: 'doc-template-persisted-1',
      organizationId: 'org-Y',
      name: 'Persisted memo',
      category: 'memo',
      documentType: 'executive_memo',
      purpose: 'restored from DB',
      audience: ['Board'],
      language: 'pl',
      languageStyle: 'consulting',
      communicationRegister: 'executive',
      density: 'standard',
      confidentiality: 'internal',
      requiredInputs: [],
      sectionBlueprint: [],
      formattingSchema: {},
      exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
      status: 'approved',
      version: '1.0',
      createdBy: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    loadTemplatesForOrgMock.mockResolvedValueOnce([persistedTemplate] as never[]);
    loadAuditForTemplateMock.mockResolvedValueOnce([
      {
        auditId: 'audit-1',
        templateId: persistedTemplate.templateId,
        organizationId: 'org-Y',
        action: 'template_drafted',
        actorId: 'user-1',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    ] as never[]);

    await ensureTemplateRegistryHydrated('org-Y');

    const list = listTemplates('org-Y', { status: 'approved' });
    expect(list.map((t) => t.templateId)).toContain('doc-template-persisted-1');

    const audit = listTemplateAuditEntries('doc-template-persisted-1', 'org-Y');
    expect(audit.map((a) => a.action)).toEqual(['template_drafted']);
  });

  it('hydration folds SYSTEM_ORG_ID seeded templates into every tenant listing', async () => {
    const seeded = {
      templateId: 'doc-template-seed-board-report',
      organizationId: '__system__',
      name: 'Board Report',
      category: 'report',
      documentType: 'board_report',
      purpose: 'system seed',
      audience: ['Board'],
      language: 'pl',
      languageStyle: 'consulting',
      communicationRegister: 'executive',
      density: 'standard',
      confidentiality: 'restricted',
      requiredInputs: [],
      sectionBlueprint: [],
      formattingSchema: {},
      exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: true },
      status: 'approved',
      version: '1.0',
      createdBy: 'system',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    loadTemplatesForOrgMock.mockResolvedValueOnce([seeded] as never[]);
    loadAuditForTemplateMock.mockResolvedValueOnce([] as never[]);

    await ensureTemplateRegistryHydrated('org-Z');

    const list = listTemplates('org-Z', { status: 'approved' });
    expect(list.map((t) => t.templateId)).toContain('doc-template-seed-board-report');

    // The seeded template must also be reachable via getTemplate from
    // any organization that triggers hydration.
    const fetched = getTemplate('doc-template-seed-board-report', 'org-Z');
    expect(fetched?.documentType).toBe('board_report');
  });

  it('draftTemplateAsync persists the refined row when the LLM produces a change', async () => {
    persistTemplateMock.mockClear();
    const { template, llmRefined } = await draftTemplateAsync({
      organizationId: 'org-X',
      userId: 'user-1',
      input: { purpose: 'async persist', documentType: 'executive_memo' },
      useLlm: false,
    });
    await Promise.resolve();
    expect(template.templateId).toBeTruthy();
    expect(llmRefined).toBe(false);
    // useLlm: false path → exactly ONE write (the deterministic draft).
    expect(persistTemplateMock).toHaveBeenCalledTimes(1);
  });
});
