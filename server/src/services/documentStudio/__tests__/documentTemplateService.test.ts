/**
 * Document Studio — Template Service tests (MVP-2).
 *
 * Covers:
 *   - draft -> approve -> deprecate happy path with audit entries.
 *   - tenant isolation (templates from another organization are not visible).
 *   - guard rails on approving a deprecated template.
 *   - rejection of empty / malformed input.
 *   - listTemplates filters by status and documentType.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  __recordTemplateAuditActionForTests,
  __resetTemplateRegistryForTests,
  approveTemplate,
  cloneTemplateAsDraft,
  deprecateTemplate,
  draftTemplate,
  getTemplate,
  isTemplateUsableForGeneration,
  listTemplateAuditEntries,
  listTemplates,
  restoreTemplateAuditSnapshotAsDraft,
  validateTemplate,
} from '../documentTemplateService.js';

describe('documentTemplateService — registry CRUD', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('drafts a template with deterministic blueprint and an audit entry', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: {
        name: 'Quarterly board memo template',
        documentType: 'executive_memo',
        purpose: 'Standardize quarterly board memos.',
        audience: ['Board'],
      },
    });

    expect(template.templateId).toMatch(/^doc-template-/);
    expect(template.organizationId).toBe('org-A');
    expect(template.status).toBe('draft');
    expect(template.version).toBe('0.1');
    expect(template.documentType).toBe('executive_memo');
    expect(template.category).toBe('memo');
    expect(template.sectionBlueprint.length).toBeGreaterThan(0);
    expect(template.formattingSchema.fonts.body).toBeTruthy();

    const audit = listTemplateAuditEntries(template.templateId, 'org-A');
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('template_drafted');
    expect(audit[0]?.actorId).toBe('user-1');
  });

  it('rejects empty purpose', () => {
    expect(() =>
      draftTemplate({
        organizationId: 'org-A',
        userId: 'user-1',
        input: { purpose: '' },
      })
    ).toThrow();
  });

  it('approves a draft template, bumps version, and writes an audit entry', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Approve flow test', documentType: 'executive_memo' },
    });

    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-2',
      notes: 'Looks good',
    });
    expect(approved.status).toBe('approved');
    expect(approved.version).toBe('1.0');
    expect(approved.approvedBy).toBe('user-2');
    expect(approved.approvedAt).toBeTruthy();

    const audit = listTemplateAuditEntries(template.templateId, 'org-A');
    expect(audit.map((entry) => entry.action)).toEqual(['template_drafted', 'template_approved']);
  });

  it('deprecates an approved template and prevents re-approval', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Deprecate test', documentType: 'executive_memo' },
    });
    approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
    });
    const deprecated = deprecateTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-3',
      reason: 'Replaced by 1.1',
    });
    expect(deprecated.status).toBe('deprecated');
    expect(deprecated.deprecatedBy).toBe('user-3');

    expect(() =>
      approveTemplate({
        templateId: template.templateId,
        organizationId: 'org-A',
        userId: 'user-1',
      })
    ).toThrow('template_deprecated');

    const audit = listTemplateAuditEntries(template.templateId, 'org-A');
    expect(audit.map((entry) => entry.action)).toEqual([
      'template_drafted',
      'template_approved',
      'template_deprecated',
    ]);
  });

  it('creates an exact editable draft from an approved or deprecated version', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: { purpose: 'Version source template', documentType: 'business_case' },
    });
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'owner',
    });
    const next = cloneTemplateAsDraft({
      templateId: approved.templateId,
      organizationId: 'org-A',
      userId: 'editor',
    });

    expect(next.templateId).not.toBe(approved.templateId);
    expect(next.status).toBe('draft');
    expect(next.version).toBe('0.1');
    expect(next.sectionBlueprint).toEqual(approved.sectionBlueprint);
    expect(next.formattingSchema).toEqual(approved.formattingSchema);
    expect(next.notes).toContain(`${approved.templateId} v1.0`);
  });

  it('returns actionable blocking validation issues', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: { purpose: 'Validation test template', documentType: 'executive_memo' },
    });
    const invalid = {
      ...template,
      sectionBlueprint: [template.sectionBlueprint[0], { ...template.sectionBlueprint[0] }],
      requiredInputs: ['finance', 'Finance'],
    };
    expect(validateTemplate(invalid).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate_section_title', 'duplicate_required_input'])
    );
    expect(validateTemplate(template)).toEqual([]);
  });

  it('restores an immutable audit snapshot as a new draft without overwriting approved', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: { purpose: 'Snapshot restore template', documentType: 'executive_memo' },
    });
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'owner',
    });
    const approvedEntry = listTemplateAuditEntries(template.templateId, 'org-A').find(
      (entry) => entry.action === 'template_approved'
    );
    expect(approvedEntry).toBeDefined();
    if (!approvedEntry) throw new Error('approved audit snapshot missing');
    const restored = restoreTemplateAuditSnapshotAsDraft({
      templateId: template.templateId,
      auditId: approvedEntry.auditId,
      organizationId: 'org-A',
      userId: 'editor',
    });

    expect(restored.templateId).not.toBe(approved.templateId);
    expect(restored.status).toBe('draft');
    expect(restored.sectionBlueprint).toEqual(approved.sectionBlueprint);
    expect(getTemplate(approved.templateId, 'org-A')?.status).toBe('approved');
  });

  it('rejects restore of a non-existent audit id', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: { purpose: 'Restore-missing test', documentType: 'executive_memo' },
    });
    expect(() =>
      restoreTemplateAuditSnapshotAsDraft({
        templateId: template.templateId,
        auditId: 'audit-does-not-exist',
        organizationId: 'org-A',
        userId: 'editor',
      })
    ).toThrow('template_audit_not_found');
  });

  it('rejects restore of an audit entry that carries no template snapshot', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: { purpose: 'Restore-no-snapshot test', documentType: 'executive_memo' },
    });
    // `template_usage_recorded` entries (see `recordTemplateUsage`) never
    // carry a `templateSnapshot` — only drafted/approved/deprecated do.
    __recordTemplateAuditActionForTests(
      template.templateId,
      'org-A',
      'template_usage_recorded',
      'user-1'
    );
    const usageEntry = listTemplateAuditEntries(template.templateId, 'org-A').find(
      (entry) => entry.action === 'template_usage_recorded'
    );
    expect(usageEntry).toBeDefined();
    expect(() =>
      restoreTemplateAuditSnapshotAsDraft({
        templateId: template.templateId,
        auditId: usageEntry!.auditId,
        organizationId: 'org-A',
        userId: 'editor',
      })
    ).toThrow('template_snapshot_unavailable');
  });

  it('rejects restore against a template owned by a different tenant', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: { purpose: 'Cross-tenant restore test', documentType: 'executive_memo' },
    });
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'owner',
    });
    const approvedEntry = listTemplateAuditEntries(template.templateId, 'org-A').find(
      (entry) => entry.action === 'template_approved'
    );
    expect(approvedEntry).toBeDefined();
    expect(() =>
      restoreTemplateAuditSnapshotAsDraft({
        templateId: approved.templateId,
        auditId: approvedEntry!.auditId,
        organizationId: 'org-B',
        userId: 'attacker',
      })
    ).toThrow('template_not_found');
  });

  it('isolates templates across tenants', () => {
    const a = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Tenant A', documentType: 'executive_memo' },
    });
    draftTemplate({
      organizationId: 'org-B',
      userId: 'user-2',
      input: { purpose: 'Tenant B', documentType: 'executive_memo' },
    });

    expect(listTemplates('org-A')).toHaveLength(1);
    expect(listTemplates('org-B')).toHaveLength(1);
    expect(getTemplate(a.template.templateId, 'org-B')).toBeNull();
    expect(getTemplate(a.template.templateId, 'org-A')).not.toBeNull();
  });

  it('isTemplateUsableForGeneration only returns true for approved & matching tenant', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Usable test', documentType: 'executive_memo' },
    });
    expect(isTemplateUsableForGeneration(template, 'org-A')).toBe(false);
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
    });
    expect(isTemplateUsableForGeneration(approved, 'org-A')).toBe(true);
    expect(isTemplateUsableForGeneration(approved, 'org-B')).toBe(false);
    expect(isTemplateUsableForGeneration(null, 'org-A')).toBe(false);
  });

  it('listTemplates filters by status and documentType', () => {
    const a = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Memo', documentType: 'executive_memo' },
    });
    const b = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Audit', documentType: 'ai_audit_report' },
    });
    approveTemplate({
      templateId: a.template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
    });

    const drafts = listTemplates('org-A', { status: 'draft' });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.templateId).toBe(b.template.templateId);

    const approved = listTemplates('org-A', { status: 'approved' });
    expect(approved).toHaveLength(1);
    expect(approved[0]?.templateId).toBe(a.template.templateId);

    const audits = listTemplates('org-A', { documentType: 'ai_audit_report' });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.documentType).toBe('ai_audit_report');
  });
});
