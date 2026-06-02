/**
 * Document Studio — Brand QA × Brand Voice profile (Epic E7, Slice 7.2).
 *
 * Asserts the profile-aware behavior of `runBrandQa` when the active
 * tenant Brand Voice profile is forwarded via `RunDocumentQaOptions`:
 *
 *   - tenant banned phrases extend the global lexicon (additive),
 *   - disabled global banned phrases drop matching globals (escape-hatch),
 *   - glossary entries (avoid → prefer) emit `glossary_replacement`,
 *   - required keywords missing from the document emit a high finding,
 *   - register override pins the casual-marker check stricter than
 *     the schema's `communicationRegister`,
 *   - language scope filters profiles whose scope ≠ schema language.
 *
 * The tests construct profiles inline (no DAO involvement) so they
 * stay focused on the QA contract and don't rely on the brand-voice
 * service lifecycle.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { BrandVoiceProfile, DocumentSchema } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-bv-1',
    artifactId: 'artifact-bv-1',
    title: 'Brand Voice Test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeParagraph(blockId: string, text: string) {
  return {
    blockId,
    type: 'paragraph' as const,
    content: { text },
  };
}

function makeSection(
  sectionId: string,
  orderIndex: number,
  title: string,
  blocks: ReturnType<typeof makeParagraph>[]
) {
  return {
    sectionId,
    orderIndex,
    level: 1 as const,
    title,
    blocks,
    sourceRefs: [],
  };
}

function makeProfile(overrides: Partial<BrandVoiceProfile> = {}): BrandVoiceProfile {
  return {
    profileId: 'profile-1',
    organizationId: 'org-A',
    name: 'Test profile',
    status: 'active',
    version: 'v1',
    languageScope: 'all',
    bannedPhrases: [],
    disabledGlobalBannedPhrases: [],
    preferredPhrases: [],
    glossaryEntries: [],
    requiredKeywords: [],
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function brandReport(schema: DocumentSchema, profile: BrandVoiceProfile | null) {
  const report = runDocumentQa(schema, { brandVoiceProfile: profile });
  return report.categories.find((c) => c.category === 'brand')!;
}

describe('Brand QA — tenant profile integration', () => {
  it('flags tenant banned phrases on top of the global lexicon', () => {
    const schema = makeSchema({
      sections: [
        makeSection('sec-1', 0, 'Summary', [
          makeParagraph('blk-1', 'Our team will deliver a Acmeco partnership.'),
        ]),
      ],
    });
    const profile = makeProfile({ bannedPhrases: ['Acmeco'] });
    const brand = brandReport(schema, profile);
    const tenantHits = brand.findings.filter((f) => f.code === 'tenant_banned_phrase');
    expect(tenantHits).toHaveLength(1);
    expect(tenantHits[0]!.message).toContain('Acmeco');
    expect(tenantHits[0]!.severity).toBe('medium');
  });

  it('disables a global banned phrase when listed in disabledGlobalBannedPhrases', () => {
    const schema = makeSchema({
      sections: [
        makeSection('sec-1', 0, 'Vision', [
          makeParagraph('blk-1', 'We bring an amazing approach to the engagement.'),
        ]),
      ],
    });

    const baselineBrand = brandReport(schema, null);
    expect(
      baselineBrand.findings.some(
        (f) => f.code === 'banned_phrase' && f.message.toLowerCase().includes('amazing')
      )
    ).toBe(true);

    const profile = makeProfile({ disabledGlobalBannedPhrases: ['amazing'] });
    const overriddenBrand = brandReport(schema, profile);
    expect(
      overriddenBrand.findings.some(
        (f) => f.code === 'banned_phrase' && f.message.toLowerCase().includes('amazing')
      )
    ).toBe(false);
  });

  it('emits glossary_replacement findings without double-flagging banned hits', () => {
    const schema = makeSchema({
      sections: [
        makeSection('sec-1', 0, 'Summary', [
          makeParagraph(
            'blk-1',
            'We will utilize our partner network and ship rapid value across initiatives.'
          ),
        ]),
      ],
    });
    const profile = makeProfile({
      glossaryEntries: [
        { avoid: 'utilize', prefer: 'use' },
        { avoid: 'ship', prefer: 'deliver', note: 'preferred verb in client-facing prose' },
      ],
    });
    const brand = brandReport(schema, profile);

    // `utilize` is also on the global banned list, so it should appear
    // as banned_phrase (not glossary_replacement) — no double-flag.
    const utilizeBanned = brand.findings.filter(
      (f) => f.code === 'banned_phrase' && f.message.toLowerCase().includes('utilize')
    );
    const utilizeGlossary = brand.findings.filter(
      (f) => f.code === 'glossary_replacement' && f.message.toLowerCase().includes('utilize')
    );
    expect(utilizeBanned).toHaveLength(1);
    expect(utilizeGlossary).toHaveLength(0);

    // `ship` is not globally banned → fires glossary_replacement and
    // surfaces both the suggestion and the note in the message.
    const shipFindings = brand.findings.filter(
      (f) => f.code === 'glossary_replacement' && f.message.includes('ship')
    );
    expect(shipFindings).toHaveLength(1);
    expect(shipFindings[0]!.message).toContain('deliver');
    expect(shipFindings[0]!.message).toContain('preferred verb in client-facing prose');
  });

  it('flags missing required keywords with one high finding per missing term', () => {
    const schema = makeSchema({
      sections: [
        makeSection('sec-intro', 0, 'Introduction', [
          makeParagraph('blk-1', 'A quick overview of the engagement scope.'),
        ]),
        makeSection('sec-body', 1, 'Body', [
          makeParagraph('blk-2', 'Acme will deliver outcomes by Q4.'),
        ]),
      ],
    });
    const profile = makeProfile({
      requiredKeywords: ['Acme', 'Confidential', 'GDPR'],
    });
    const brand = brandReport(schema, profile);
    const missing = brand.findings.filter((f) => f.code === 'required_keyword_missing');
    expect(missing).toHaveLength(2);
    const messages = missing.map((f) => f.message);
    expect(messages.some((m) => m.includes('Confidential'))).toBe(true);
    expect(messages.some((m) => m.includes('GDPR'))).toBe(true);
    // Anchored to the first section so the UI can scroll to a stable target.
    for (const finding of missing) {
      expect(finding.sectionId).toBe('sec-intro');
      expect(finding.severity).toBe('high');
    }
  });

  it('register override pins casual checks stricter than the schema', () => {
    const schema = makeSchema({
      communicationRegister: 'professional',
      sections: [
        makeSection('sec-1', 0, 'Summary', [
          makeParagraph(
            'blk-1',
            'Basically the team will literally execute and we kinda need a sign-off.'
          ),
        ]),
      ],
    });

    // Without override the schema is `professional` so no register findings.
    const without = brandReport(schema, null);
    expect(without.findings.some((f) => f.code === 'register_mismatch')).toBe(false);

    // With override → register_mismatch fires for each casual marker.
    const profile = makeProfile({ registerOverride: 'executive' });
    const withOverride = brandReport(schema, profile);
    const registerMismatches = withOverride.findings.filter((f) => f.code === 'register_mismatch');
    expect(registerMismatches.length).toBeGreaterThan(0);
    for (const finding of registerMismatches) {
      expect(finding.message).toContain('executive');
    }
  });

  it('languageScope filters: profile scoped to "pl" does NOT apply to an English schema', () => {
    const schema = makeSchema({
      language: 'en',
      sections: [
        makeSection('sec-1', 0, 'Summary', [
          makeParagraph('blk-1', 'We will deliver an Acmeco partnership in Q3.'),
        ]),
      ],
    });
    const plProfile = makeProfile({ languageScope: 'pl', bannedPhrases: ['Acmeco'] });
    const brand = brandReport(schema, plProfile);
    expect(brand.findings.some((f) => f.code === 'tenant_banned_phrase')).toBe(false);

    const allProfile = makeProfile({ languageScope: 'all', bannedPhrases: ['Acmeco'] });
    const brandAll = brandReport(schema, allProfile);
    expect(brandAll.findings.some((f) => f.code === 'tenant_banned_phrase')).toBe(true);

    const enProfile = makeProfile({ languageScope: 'en', bannedPhrases: ['Acmeco'] });
    const brandEn = brandReport(schema, enProfile);
    expect(brandEn.findings.some((f) => f.code === 'tenant_banned_phrase')).toBe(true);
  });

  it('inactive profiles are ignored even when forwarded to runDocumentQa', () => {
    const schema = makeSchema({
      sections: [
        makeSection('sec-1', 0, 'Summary', [
          makeParagraph('blk-1', 'We will partner with Acmeco.'),
        ]),
      ],
    });
    const draftProfile = makeProfile({ status: 'draft', bannedPhrases: ['Acmeco'] });
    const brand = brandReport(schema, draftProfile);
    expect(brand.findings.some((f) => f.code === 'tenant_banned_phrase')).toBe(false);

    const archivedProfile = makeProfile({ status: 'archived', bannedPhrases: ['Acmeco'] });
    const brandArchived = brandReport(schema, archivedProfile);
    expect(brandArchived.findings.some((f) => f.code === 'tenant_banned_phrase')).toBe(false);
  });

  it('clean documents with an active profile produce a profile-aware summary', () => {
    const schema = makeSchema({
      communicationRegister: 'professional',
      sections: [
        makeSection('sec-1', 0, 'Summary', [
          makeParagraph(
            'blk-1',
            'Acme will partner with the client team to deliver measurable outcomes by Q4.'
          ),
        ]),
      ],
    });
    const profile = makeProfile({
      name: 'Acme corporate voice',
      bannedPhrases: ['Acmeco'],
      requiredKeywords: ['Acme'],
    });
    const brand = brandReport(schema, profile);
    expect(brand.findings).toHaveLength(0);
    expect(brand.score).toBe(100);
    expect(brand.summary).toContain('Acme corporate voice');
  });
});
