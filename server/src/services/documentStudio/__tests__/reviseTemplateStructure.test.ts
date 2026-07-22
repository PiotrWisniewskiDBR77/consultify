/**
 * Document Studio — reviseTemplateStructure tests (robota C1).
 *
 * The author's manual structure editor persists full STRUCTURAL edits
 * (add / remove / reorder / rename) to a DRAFT blueprint — the opposite of the
 * purpose-only LLM refiner. These tests lock:
 *   - structural change is accepted and persisted with a `template_updated` audit
 *   - anti-garbage guards remain (blank titles, empty list, draft-only, tenant)
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetTemplateRegistryForTests,
  approveTemplate,
  draftTemplate,
  getTemplate,
  listTemplateAuditEntries,
  reviseTemplateStructure,
} from '../documentTemplateService.js';
import type { TemplateSectionBlueprint } from '../documentStudioTypes.js';

function section(title: string): TemplateSectionBlueprint {
  return { title, level: 1, purpose: `${title} purpose`, required: false, expectedLengthHint: 'medium' };
}

describe('reviseTemplateStructure — author manual structure editor', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('accepts add / remove / reorder / rename on a draft and audits it', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Structure edit test', documentType: 'executive_memo' },
    });

    const next = reviseTemplateStructure({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      sections: [section('Intro'), section('Body'), section('Close')],
    });

    expect(next.sectionBlueprint.map((s) => s.title)).toEqual(['Intro', 'Body', 'Close']);
    // Persisted to the registry.
    expect(
      getTemplate(template.templateId, 'org-A')?.sectionBlueprint.map((s) => s.title)
    ).toEqual(['Intro', 'Body', 'Close']);

    const audit = listTemplateAuditEntries(template.templateId, 'org-A');
    expect(audit.map((e) => e.action)).toEqual(['template_drafted', 'template_updated']);
    expect(audit[1]?.details?.source).toBe('author_manual_structure_edit');
  });

  it('sanitizes section fields and rejects a blank title', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Sanitize test', documentType: 'executive_memo' },
    });

    // A blank title is the one hard structural guard.
    expect(() =>
      reviseTemplateStructure({
        templateId: template.templateId,
        organizationId: 'org-A',
        userId: 'user-1',
        sections: [section('Ok'), section('   ')],
      })
    ).toThrow('template_section_title_required');

    // Titles are trimmed; level/hint coerced to their legal range.
    const next = reviseTemplateStructure({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      sections: [
        { title: '  Trimmed  ', level: 9 as 1, purpose: '', required: true, expectedLengthHint: 'x' as 'short' },
      ],
    });
    expect(next.sectionBlueprint[0].title).toBe('Trimmed');
    expect(next.sectionBlueprint[0].level).toBe(1);
    expect(next.sectionBlueprint[0].expectedLengthHint).toBe('medium');
  });

  it('rejects an empty section list', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Empty test', documentType: 'executive_memo' },
    });
    expect(() =>
      reviseTemplateStructure({
        templateId: template.templateId,
        organizationId: 'org-A',
        userId: 'user-1',
        sections: [],
      })
    ).toThrow('template_sections_required');
  });

  it('refuses to edit an approved (non-draft) template', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Immutable test', documentType: 'executive_memo' },
    });
    approveTemplate({ templateId: template.templateId, organizationId: 'org-A', userId: 'user-1' });
    expect(() =>
      reviseTemplateStructure({
        templateId: template.templateId,
        organizationId: 'org-A',
        userId: 'user-1',
        sections: [section('X')],
      })
    ).toThrow('template_not_draft');
  });

  it('does not leak across tenants', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Tenant test', documentType: 'executive_memo' },
    });
    expect(() =>
      reviseTemplateStructure({
        templateId: template.templateId,
        organizationId: 'org-B',
        userId: 'user-2',
        sections: [section('X')],
      })
    ).toThrow('template_not_found');
  });
});
