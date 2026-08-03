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

import type { TemplateSectionBlueprint } from '../documentStudioTypes.js';
import {
  __resetTemplateRegistryForTests,
  approveTemplate,
  draftTemplate,
  getTemplate,
  listTemplateAuditEntries,
  reviseTemplateStructure,
} from '../documentTemplateService.js';

function section(title: string): TemplateSectionBlueprint {
  return {
    title,
    level: 1,
    purpose: `${title} purpose`,
    required: false,
    expectedLengthHint: 'medium',
  };
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
    expect(getTemplate(template.templateId, 'org-A')?.sectionBlueprint.map((s) => s.title)).toEqual(
      ['Intro', 'Body', 'Close']
    );

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
        {
          title: '  Trimmed  ',
          level: 9 as 1,
          purpose: '',
          required: true,
          expectedLengthHint: 'x' as 'short',
        },
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

  it('persists author-typed contentHints and caps them at 4 items / 100 chars each', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Content hints test', documentType: 'executive_memo' },
    });

    const longHint = 'y'.repeat(200);
    const next = reviseTemplateStructure({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      sections: [
        {
          ...section('Intro'),
          contentHints: ['a', '', 'b', 'c', longHint, 'd', 'e'] as unknown as string[],
        },
      ],
    });

    const hints = next.sectionBlueprint[0].contentHints!;
    expect(hints.length).toBe(4);
    expect(hints).toEqual(['a', 'b', 'c', longHint.slice(0, 100)]);
  });

  it('persists author-typed briefing fields (keyMessage/dataNeeded/suggestedEvidence) and caps them', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Briefing fields test', documentType: 'executive_memo' },
    });

    const longKeyMessage = 'k'.repeat(300);
    const longEvidence = 'e'.repeat(200);
    const longDataItem = 'd'.repeat(150);
    const next = reviseTemplateStructure({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      sections: [
        {
          ...section('Intro'),
          keyMessage: `  ${longKeyMessage}  `,
          dataNeeded: ['a', '', 'b', 'c', 'd', longDataItem, 'f', 'g'] as unknown as string[],
          suggestedEvidence: `  ${longEvidence}  `,
        },
      ],
    });

    const persisted = next.sectionBlueprint[0];
    expect(persisted.keyMessage).toBe(longKeyMessage.slice(0, 200));
    expect(persisted.dataNeeded).toEqual(['a', 'b', 'c', 'd', longDataItem.slice(0, 100), 'f']);
    expect(persisted.suggestedEvidence).toBe(longEvidence.slice(0, 150));

    // Re-fetched from the registry so the FE round trip (revise → refresh) is covered too.
    const reloaded = getTemplate(template.templateId, 'org-A');
    expect(reloaded?.sectionBlueprint[0].keyMessage).toBe(longKeyMessage.slice(0, 200));
  });

  it('clears briefing fields when the author empties them', () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'user-1',
      input: { purpose: 'Briefing clear test', documentType: 'executive_memo' },
    });

    reviseTemplateStructure({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      sections: [
        {
          ...section('Intro'),
          keyMessage: 'Some thesis',
          dataNeeded: ['x'],
          suggestedEvidence: 'Some proof',
        },
      ],
    });

    const cleared = reviseTemplateStructure({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      sections: [{ ...section('Intro'), keyMessage: '', dataNeeded: [], suggestedEvidence: '' }],
    });

    expect(cleared.sectionBlueprint[0].keyMessage).toBeUndefined();
    expect(cleared.sectionBlueprint[0].dataNeeded).toBeUndefined();
    expect(cleared.sectionBlueprint[0].suggestedEvidence).toBeUndefined();
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
