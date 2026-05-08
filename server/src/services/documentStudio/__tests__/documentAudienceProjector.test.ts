/**
 * Document Studio — Audience-driven projector tests (Epic E9, Slice 9.1).
 *
 * Covers the pure structural projection contract:
 *   - schema-level scalar overrides (audience, register, density, languageStyle);
 *   - section / block tag filters (include / exclude / precedence / default-include);
 *   - executive-summary policy (preserve / drop), with title heuristics;
 *   - appendix policy (preserve / drop), reusing the E8 appendix detector;
 *   - input immutability (deep clone on every kept section / block);
 *   - provenance accuracy (sectionsKept, sectionsDropped reasons, blocksDropped);
 *   - 4 system-default profiles (board / client / engineering / pmo);
 *   - audit-only `describeAudienceProjectionPlan` matches the projector's decisions.
 */

import { describe, expect, it } from 'vitest';

import {
  BOARD_EXECUTIVE_PROFILE,
  CLIENT_EXTERNAL_PROFILE,
  ENGINEERING_TECHNICAL_PROFILE,
  getSystemAudienceProfile,
  isSystemAudienceProfileId,
  PMO_OPERATIONAL_PROFILE,
  SYSTEM_AUDIENCE_PROFILES,
} from '../documentAudienceProfileSeeds.js';
import {
  describeAudienceProjectionPlan,
  isExecutiveSummarySection,
  passesTagFilter,
  projectDocumentForAudience,
} from '../documentAudienceProjector.js';
import {
  type AudienceProfile,
  DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  type DocumentBlock,
  type DocumentSchema,
  type DocumentSection,
} from '../documentStudioTypes.js';

function makeBlock(overrides: Partial<DocumentBlock> & { blockId: string }): DocumentBlock {
  return {
    blockId: overrides.blockId,
    type: overrides.type ?? 'paragraph',
    content: overrides.content ?? { text: 'Lorem ipsum.' },
    sourceRef: overrides.sourceRef,
    isAssumption: overrides.isAssumption,
    audienceTags: overrides.audienceTags,
  };
}

function makeSection(overrides: Partial<DocumentSection> & { sectionId: string }): DocumentSection {
  return {
    sectionId: overrides.sectionId,
    orderIndex: overrides.orderIndex ?? 0,
    level: overrides.level ?? 1,
    title: overrides.title ?? 'Untitled',
    purpose: overrides.purpose,
    blocks: overrides.blocks ?? [],
    sourceRefs: overrides.sourceRefs ?? [],
    kind: overrides.kind,
    audienceTags: overrides.audienceTags,
  };
}

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: overrides.documentId ?? 'doc-1',
    artifactId: overrides.artifactId ?? 'art-1',
    title: overrides.title ?? 'Sample document',
    documentType: overrides.documentType ?? 'executive_memo',
    language: overrides.language ?? 'en',
    audience: overrides.audience ?? ['Mixed'],
    goal: overrides.goal ?? 'inform',
    communicationRegister: overrides.communicationRegister ?? 'professional',
    density: overrides.density ?? 'standard',
    languageStyle: overrides.languageStyle ?? 'consulting',
    confidentiality: overrides.confidentiality ?? 'internal',
    formattingSchema: overrides.formattingSchema ?? DEFAULT_CONSULTING_FORMATTING_SCHEMA,
    sections: overrides.sections ?? [],
    sourceRefs: overrides.sourceRefs ?? [],
    createdAt: overrides.createdAt ?? '2026-05-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-01T00:00:00.000Z',
    documentStatus: overrides.documentStatus,
    statusChangedAt: overrides.statusChangedAt,
    statusChangedBy: overrides.statusChangedBy,
    statusReason: overrides.statusReason,
  };
}

function makeProfile(overrides: Partial<AudienceProfile> & { profileId: string }): AudienceProfile {
  return {
    profileId: overrides.profileId,
    organizationId: overrides.organizationId ?? 'org-1',
    name: overrides.name ?? 'Test profile',
    description: overrides.description,
    status: overrides.status ?? 'active',
    version: overrides.version ?? 'v1',
    audienceLabels: overrides.audienceLabels ?? [],
    registerOverride: overrides.registerOverride,
    densityOverride: overrides.densityOverride,
    languageStyleOverride: overrides.languageStyleOverride,
    sectionFilters: overrides.sectionFilters ?? {},
    blockFilters: overrides.blockFilters ?? {},
    executiveSummaryPolicy: overrides.executiveSummaryPolicy ?? 'preserve',
    appendixPolicy: overrides.appendixPolicy ?? 'preserve',
    jargonPolicy: overrides.jargonPolicy ?? 'as_is',
    notes: overrides.notes,
    createdBy: overrides.createdBy ?? 'tester',
    createdAt: overrides.createdAt ?? '2026-05-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-01T00:00:00.000Z',
    activatedBy: overrides.activatedBy,
    activatedAt: overrides.activatedAt,
    archivedBy: overrides.archivedBy,
    archivedAt: overrides.archivedAt,
  };
}

const FROZEN_NOW = () => new Date('2026-05-08T12:00:00.000Z');

describe('passesTagFilter', () => {
  it('keeps untagged elements regardless of include/exclude lists', () => {
    expect(passesTagFilter(undefined, { include: ['a'], exclude: ['b'] })).toBe(true);
    expect(passesTagFilter([], { include: ['a'], exclude: ['b'] })).toBe(true);
  });

  it('drops elements whose tag matches the exclude list', () => {
    expect(passesTagFilter(['engineering_only'], { exclude: ['engineering_only'] })).toBe(false);
    expect(passesTagFilter(['engineering_only', 'extra'], { exclude: ['engineering_only'] })).toBe(
      false
    );
  });

  it('exclude wins over include', () => {
    expect(passesTagFilter(['t'], { include: ['t'], exclude: ['t'] })).toBe(false);
  });

  it('respects include when set and tagged element does not match', () => {
    expect(passesTagFilter(['x'], { include: ['y'] })).toBe(false);
  });

  it('keeps a tagged element when at least one include tag matches', () => {
    expect(passesTagFilter(['x', 'y'], { include: ['y'] })).toBe(true);
  });

  it('treats empty filter as default-keep', () => {
    expect(passesTagFilter(['x'], {})).toBe(true);
    expect(passesTagFilter(undefined, {})).toBe(true);
  });
});

describe('isExecutiveSummarySection', () => {
  it('matches executive summary in EN and PL', () => {
    expect(
      isExecutiveSummarySection(makeSection({ sectionId: 's1', title: 'Executive Summary' }))
    ).toBe(true);
    expect(
      isExecutiveSummarySection(makeSection({ sectionId: 's2', title: 'executive summary' }))
    ).toBe(true);
    expect(
      isExecutiveSummarySection(makeSection({ sectionId: 's3', title: 'Streszczenie zarządcze' }))
    ).toBe(true);
  });

  it('does not false-positive on look-alike titles', () => {
    expect(
      isExecutiveSummarySection(makeSection({ sectionId: 's4', title: 'Executive committee' }))
    ).toBe(false);
    expect(isExecutiveSummarySection(makeSection({ sectionId: 's5', title: 'Findings' }))).toBe(
      false
    );
    expect(isExecutiveSummarySection(makeSection({ sectionId: 's6', title: '' }))).toBe(false);
  });
});

describe('projectDocumentForAudience — scalar overrides', () => {
  it('overrides audience, register, density and languageStyle from the profile', () => {
    const schema = makeSchema({
      audience: ['Mixed'],
      communicationRegister: 'professional',
      density: 'standard',
      languageStyle: 'consulting',
    });
    const profile = makeProfile({
      profileId: 'p1',
      audienceLabels: ['Board'],
      registerOverride: 'executive',
      densityOverride: 'concise',
      languageStyleOverride: 'formal',
    });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.audience).toEqual(['Board']);
    expect(variant.schema.communicationRegister).toBe('executive');
    expect(variant.schema.density).toBe('concise');
    expect(variant.schema.languageStyle).toBe('formal');
  });

  it('inherits source schema audience when profile.audienceLabels is empty', () => {
    const schema = makeSchema({ audience: ['Sponsor', 'PMO'] });
    const profile = makeProfile({ profileId: 'p2', audienceLabels: [] });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.audience).toEqual(['Sponsor', 'PMO']);
  });

  it('inherits scalar fields when profile does not override them', () => {
    const schema = makeSchema({
      communicationRegister: 'narrative',
      density: 'detailed',
      languageStyle: 'narrative',
    });
    const profile = makeProfile({ profileId: 'p3' });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.communicationRegister).toBe('narrative');
    expect(variant.schema.density).toBe('detailed');
    expect(variant.schema.languageStyle).toBe('narrative');
  });
});

describe('projectDocumentForAudience — section / block filtering', () => {
  it('drops sections whose tags match the section exclude list', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Findings' }),
        makeSection({
          sectionId: 's2',
          title: 'Engineering details',
          audienceTags: ['engineering_only'],
        }),
      ],
    });
    const profile = makeProfile({
      profileId: 'p4',
      sectionFilters: { exclude: ['engineering_only'] },
    });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1']);
    expect(variant.provenance.sectionsKept).toEqual(['s1']);
    expect(variant.provenance.sectionsDropped).toEqual([
      { sectionId: 's2', reason: 'section_tag_filter' },
    ]);
  });

  it('drops blocks whose tags match the block exclude list', () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            makeBlock({ blockId: 'b1' }),
            makeBlock({ blockId: 'b2', audienceTags: ['client_only'] }),
            makeBlock({ blockId: 'b3', audienceTags: ['engineering_only'] }),
          ],
        }),
      ],
    });
    const profile = makeProfile({
      profileId: 'p5',
      blockFilters: { exclude: ['client_only'] },
    });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    const blockIds = variant.schema.sections[0]!.blocks.map((b) => b.blockId);
    expect(blockIds).toEqual(['b1', 'b3']);
    expect(variant.provenance.blocksDropped).toBe(1);
  });

  it('include filter still keeps untagged sections (default-include)', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Untagged' }),
        makeSection({ sectionId: 's2', title: 'Tagged', audienceTags: ['custom_tag'] }),
        makeSection({ sectionId: 's3', title: 'Other tag', audienceTags: ['other'] }),
      ],
    });
    const profile = makeProfile({
      profileId: 'p6',
      sectionFilters: { include: ['custom_tag'] },
    });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1', 's2']);
  });
});

describe('projectDocumentForAudience — executive summary policy', () => {
  it('drops the executive summary section when policy is drop', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Executive Summary' }),
        makeSection({ sectionId: 's2', title: 'Findings' }),
      ],
    });
    const profile = makeProfile({ profileId: 'p7', executiveSummaryPolicy: 'drop' });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s2']);
    expect(variant.provenance.sectionsDropped).toContainEqual({
      sectionId: 's1',
      reason: 'executive_summary_drop',
    });
  });

  it('keeps the executive summary when policy is preserve (default)', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Executive Summary' }),
        makeSection({ sectionId: 's2', title: 'Findings' }),
      ],
    });
    const profile = makeProfile({ profileId: 'p8' });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1', 's2']);
  });
});

describe('projectDocumentForAudience — appendix policy', () => {
  it('drops appendix sections when policy is drop (kind-based)', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Findings' }),
        makeSection({ sectionId: 's2', title: 'Glossary', kind: 'appendix' }),
      ],
    });
    const profile = makeProfile({ profileId: 'p9', appendixPolicy: 'drop' });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1']);
    expect(variant.provenance.sectionsDropped).toContainEqual({
      sectionId: 's2',
      reason: 'appendix_policy_drop',
    });
  });

  it('drops appendix sections when policy is drop (heuristic title prefix)', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Findings' }),
        makeSection({ sectionId: 's2', title: 'Załącznik A — Słownik' }),
      ],
    });
    const profile = makeProfile({ profileId: 'p10', appendixPolicy: 'drop' });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1']);
  });
});

describe('projectDocumentForAudience — immutability + provenance', () => {
  it('does not mutate the input schema or its sections', () => {
    const sourceSection = makeSection({
      sectionId: 's1',
      title: 'Findings',
      blocks: [makeBlock({ blockId: 'b1', content: { text: 'Hello' } })],
    });
    const schema = makeSchema({ sections: [sourceSection] });
    const profile = makeProfile({
      profileId: 'p11',
      registerOverride: 'executive',
    });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });
    variant.schema.title = 'Mutated';
    variant.schema.sections[0]!.title = 'Mutated section';
    (variant.schema.sections[0]!.blocks[0]!.content as { text: string }).text = 'Mutated';

    expect(schema.title).toBe('Sample document');
    expect(schema.sections[0]!.title).toBe('Findings');
    expect((schema.sections[0]!.blocks[0]!.content as { text: string }).text).toBe('Hello');
  });

  it('stamps provenance with source ids, profile metadata, and projectedAt', () => {
    const schema = makeSchema({ documentId: 'doc-99', artifactId: 'art-99' });
    const profile = makeProfile({ profileId: 'p12', version: 'v3' });

    const variant = projectDocumentForAudience(schema, profile, { now: FROZEN_NOW });

    expect(variant.provenance.sourceDocumentId).toBe('doc-99');
    expect(variant.provenance.sourceArtifactId).toBe('art-99');
    expect(variant.provenance.profileId).toBe('p12');
    expect(variant.provenance.profileVersion).toBe('v3');
    expect(variant.provenance.projectedAt).toBe('2026-05-08T12:00:00.000Z');
    expect(variant.schema.updatedAt).toBe('2026-05-08T12:00:00.000Z');
  });
});

describe('System default audience profiles', () => {
  it('exposes exactly four immutable system seeds', () => {
    expect(SYSTEM_AUDIENCE_PROFILES).toHaveLength(4);
    for (const profile of SYSTEM_AUDIENCE_PROFILES) {
      expect(profile.organizationId).toBe('system');
      expect(profile.status).toBe('active');
      expect(Object.isFrozen(profile)).toBe(true);
    }
  });

  it('is queryable by id', () => {
    expect(getSystemAudienceProfile('system_board_executive')).toEqual(BOARD_EXECUTIVE_PROFILE);
    expect(getSystemAudienceProfile('does-not-exist')).toBeUndefined();
    expect(isSystemAudienceProfileId('system_pmo_operational')).toBe(true);
    expect(isSystemAudienceProfileId('custom-profile')).toBe(false);
  });

  it('Board / Executive variant drops appendices and engineering-only sections', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Executive Summary' }),
        makeSection({
          sectionId: 's2',
          title: 'Engineering details',
          audienceTags: ['engineering_only'],
        }),
        makeSection({ sectionId: 's3', title: 'Findings' }),
        makeSection({ sectionId: 's4', title: 'Appendix A — Glossary', kind: 'appendix' }),
      ],
    });

    const variant = projectDocumentForAudience(schema, BOARD_EXECUTIVE_PROFILE, {
      now: FROZEN_NOW,
    });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1', 's3']);
    expect(variant.schema.audience).toEqual(['Board', 'CEO', 'CFO']);
    expect(variant.schema.communicationRegister).toBe('executive');
    expect(variant.schema.density).toBe('concise');
  });

  it('Engineering / Technical variant drops the executive summary and client-only sections', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Executive Summary' }),
        makeSection({ sectionId: 's2', title: 'Architecture' }),
        makeSection({ sectionId: 's3', title: 'Pricing pitch', audienceTags: ['client_only'] }),
        makeSection({ sectionId: 's4', title: 'Appendix A — Glossary', kind: 'appendix' }),
      ],
    });

    const variant = projectDocumentForAudience(schema, ENGINEERING_TECHNICAL_PROFILE, {
      now: FROZEN_NOW,
    });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s2', 's4']);
    expect(variant.schema.communicationRegister).toBe('technical');
    expect(variant.schema.density).toBe('detailed');
  });

  it('Client / External variant keeps appendices but drops internal-only material', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Findings' }),
        makeSection({
          sectionId: 's2',
          title: 'Internal next steps',
          audienceTags: ['internal_only'],
        }),
        makeSection({ sectionId: 's3', title: 'Appendix A — Methodology', kind: 'appendix' }),
      ],
    });

    const variant = projectDocumentForAudience(schema, CLIENT_EXTERNAL_PROFILE, {
      now: FROZEN_NOW,
    });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1', 's3']);
    expect(variant.schema.audience).toEqual(['Client']);
  });

  it('PMO / Operational variant drops client-only and keeps everything else', () => {
    const schema = makeSchema({
      sections: [
        makeSection({ sectionId: 's1', title: 'Executive Summary' }),
        makeSection({ sectionId: 's2', title: 'Findings' }),
        makeSection({
          sectionId: 's3',
          title: 'Client-facing pitch',
          audienceTags: ['client_only'],
        }),
        makeSection({ sectionId: 's4', title: 'Appendix A — Risks', kind: 'appendix' }),
      ],
    });

    const variant = projectDocumentForAudience(schema, PMO_OPERATIONAL_PROFILE, {
      now: FROZEN_NOW,
    });

    expect(variant.schema.sections.map((s) => s.sectionId)).toEqual(['s1', 's2', 's4']);
    expect(variant.schema.audience).toEqual(['PMO', 'Project Team']);
  });
});

describe('describeAudienceProjectionPlan', () => {
  it('matches the projector decisions without performing the deep clone', () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Executive Summary',
          blocks: [makeBlock({ blockId: 'b1', audienceTags: ['client_only'] })],
        }),
        makeSection({ sectionId: 's2', title: 'Engineering', audienceTags: ['engineering_only'] }),
        makeSection({ sectionId: 's3', title: 'Findings' }),
      ],
    });

    const plan = describeAudienceProjectionPlan(schema, BOARD_EXECUTIVE_PROFILE);
    const variant = projectDocumentForAudience(schema, BOARD_EXECUTIVE_PROFILE, {
      now: FROZEN_NOW,
    });

    expect(plan.sectionsKept).toEqual(variant.provenance.sectionsKept);
    expect(plan.sectionsDropped).toEqual(variant.provenance.sectionsDropped);
    expect(plan.blocksDroppedEstimate).toBe(variant.provenance.blocksDropped);
    expect(plan.effectiveAudience).toEqual(variant.schema.audience);
    expect(plan.effectiveRegister).toBe(variant.schema.communicationRegister);
    expect(plan.effectiveDensity).toBe(variant.schema.density);
    expect(plan.effectiveLanguageStyle).toBe(variant.schema.languageStyle);
  });
});
