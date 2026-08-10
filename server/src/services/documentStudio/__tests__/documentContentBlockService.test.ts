/**
 * Document Studio — Content Block Library Service tests
 * (Epic E10, Slice 10.2).
 *
 * Covers the reusable content block library data plane:
 *
 *   - draft → activate → archive lifecycle (multiple actives ALLOWED);
 *   - update bumps version, rejects archived, validates payload;
 *   - tag / documentType / languageScope normalization (trim + dedupe);
 *   - tenant isolation (cross-tenant reads return null/[]);
 *   - hydration loads persisted entries on cold start;
 *   - audit trail records every transition with stable action codes;
 *   - list filters: status, includeArchived, documentType, language,
 *     anyTag (case-insensitive);
 *   - instantiate helper allocates fresh blockId, deep-clones payload,
 *     refuses archived entries, supports explicit blockId override.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { persistContentBlock } from '../documentContentBlockRegistryDao.js';
import {
  __loadContentBlockByIdForTests,
  __resetContentBlockServiceAndPersistenceForTests,
  activateDocumentContentBlock,
  archiveDocumentContentBlock,
  DocumentContentBlockError,
  draftDocumentContentBlock,
  ensureContentBlockRegistryHydrated,
  getDocumentContentBlock,
  instantiateDocumentContentBlock,
  listDocumentContentBlockAuditEntries,
  listDocumentContentBlocks,
  updateDocumentContentBlock,
} from '../documentContentBlockService.js';
import type { DocumentTypeKey } from '../documentStudioTypes.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER = 'user-1';
const USER_2 = 'user-2';

beforeEach(async () => {
  await __resetContentBlockServiceAndPersistenceForTests();
});

afterEach(async () => {
  await __resetContentBlockServiceAndPersistenceForTests();
});

const SAMPLE_PARAGRAPH = {
  type: 'paragraph' as const,
  content: { text: 'Standard intro line.' },
};

describe('Content Block Service — draft', () => {
  it('drafts a template with normalized tags, document types, and version v1', () => {
    const template = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: {
        name: '  Standard Intro  ',
        description: 'Used at the top of every memo',
        tags: [' compliance ', 'compliance', 'standard_intro', '', 'STANDARD_INTRO'],
        // Deliberately untrimmed / duplicated: this asserts that
        // `normalizeDocumentTypes` (which accepts `unknown`) trims and dedupes.
        // The declared input type is the narrow key union, so the probe value is
        // fed through the looser runtime contract the assertion exercises.
        documentTypes: [
          ' executive_memo ',
          'executive_memo',
          'board_report',
        ] as unknown as DocumentTypeKey[],
        languageScope: 'en',
        block: SAMPLE_PARAGRAPH,
        notes: 'Reviewed by legal',
      },
    });

    expect(template.contentBlockId).toMatch(/^content-block-/);
    expect(template.organizationId).toBe(ORG_A);
    expect(template.name).toBe('Standard Intro');
    expect(template.status).toBe('draft');
    expect(template.version).toBe('v1');
    expect(template.tags).toEqual(['compliance', 'standard_intro']);
    expect(template.documentTypes).toEqual(['executive_memo', 'board_report']);
    expect(template.languageScope).toBe('en');
    expect(template.block).toEqual(SAMPLE_PARAGRAPH);
  });

  it('defaults languageScope to all when not provided', () => {
    const template = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    expect(template.languageScope).toBe('all');
  });

  it('rejects empty inputs with invalid_input', () => {
    expect(() =>
      draftDocumentContentBlock({
        organizationId: '',
        userId: USER,
        input: { name: 'X', block: SAMPLE_PARAGRAPH },
      })
    ).toThrow(DocumentContentBlockError);
    expect(() =>
      draftDocumentContentBlock({
        organizationId: ORG_A,
        userId: '',
        input: { name: 'X', block: SAMPLE_PARAGRAPH },
      })
    ).toThrow(DocumentContentBlockError);
    expect(() =>
      draftDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        input: { name: '   ', block: SAMPLE_PARAGRAPH },
      })
    ).toThrow(DocumentContentBlockError);
  });

  it('rejects unsupported block types', () => {
    expect(() =>
      draftDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        input: {
          name: 'X',
          block: { type: 'whatever' as never, content: {} },
        },
      })
    ).toThrow(/unsupported block type/);
  });

  it('writes through to persistence on draft', async () => {
    const template = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Persisted', block: SAMPLE_PARAGRAPH },
    });
    const persisted = await __loadContentBlockByIdForTests(template.contentBlockId, ORG_A);
    expect(persisted).not.toBeNull();
    expect(persisted!.name).toBe('Persisted');
  });
});

describe('Content Block Service — update', () => {
  it('updates fields and bumps version', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Original', block: SAMPLE_PARAGRAPH, languageScope: 'en' },
    });
    const updated = updateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER_2,
      contentBlockId: drafted.contentBlockId,
      input: {
        name: 'Renamed',
        languageScope: 'pl',
        tags: ['legal'],
      },
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.languageScope).toBe('pl');
    expect(updated.tags).toEqual(['legal']);
    expect(updated.version).toBe('v2');
  });

  it('clears nullable fields when input is null', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH, description: 'Initial', notes: 'Initial' },
    });
    const cleared = updateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: drafted.contentBlockId,
      input: { description: null, notes: null },
    });
    expect(cleared.description).toBeUndefined();
    expect(cleared.notes).toBeUndefined();
  });

  it('rejects updates to archived blocks', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    archiveDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: drafted.contentBlockId,
    });
    expect(() =>
      updateDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        contentBlockId: drafted.contentBlockId,
        input: { name: 'Y' },
      })
    ).toThrow(/archived/);
  });

  it('returns content_block_not_found when id does not exist for tenant', () => {
    expect(() =>
      updateDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        contentBlockId: 'does-not-exist',
        input: { name: 'X' },
      })
    ).toThrow(/content_block_not_found|not found/i);
  });

  it('validates new block payload on update', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    expect(() =>
      updateDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        contentBlockId: drafted.contentBlockId,
        input: { block: { type: 'bogus' as never, content: {} } },
      })
    ).toThrow(/unsupported block type/);
  });
});

describe('Content Block Service — activate / archive', () => {
  it('promotes a draft to active and stamps activatedBy/At', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    const activated = activateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER_2,
      contentBlockId: drafted.contentBlockId,
    });
    expect(activated.status).toBe('active');
    expect(activated.activatedBy).toBe(USER_2);
  });

  it('allows multiple active blocks per tenant', () => {
    const a = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'A', block: SAMPLE_PARAGRAPH },
    });
    const b = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'B', block: SAMPLE_PARAGRAPH },
    });
    activateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: a.contentBlockId,
    });
    activateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: b.contentBlockId,
    });

    const actives = listDocumentContentBlocks(ORG_A, { status: 'active' });
    expect(actives).toHaveLength(2);
  });

  it('throws content_block_already_active on repeated activation', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    activateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: drafted.contentBlockId,
    });
    expect(() =>
      activateDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        contentBlockId: drafted.contentBlockId,
      })
    ).toThrow(/already active/i);
  });

  it('archives a block and rejects re-archive', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    const archived = archiveDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: drafted.contentBlockId,
      reason: 'no longer relevant',
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedBy).toBe(USER);

    expect(() =>
      archiveDocumentContentBlock({
        organizationId: ORG_A,
        userId: USER,
        contentBlockId: drafted.contentBlockId,
      })
    ).toThrow(/already archived/i);
  });
});

describe('Content Block Service — list filters', () => {
  function seedFixtures() {
    const a = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: {
        name: 'PL Compliance Disclaimer',
        block: SAMPLE_PARAGRAPH,
        tags: ['compliance', 'legal'],
        documentTypes: ['board_report', 'business_case'],
        languageScope: 'pl',
      },
    });
    const b = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: {
        name: 'EN Standard Intro',
        block: SAMPLE_PARAGRAPH,
        tags: ['standard_intro'],
        languageScope: 'en',
      },
    });
    const c = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: {
        name: 'Universal Disclaimer',
        block: SAMPLE_PARAGRAPH,
        tags: ['compliance'],
        languageScope: 'all',
      },
    });
    archiveDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: c.contentBlockId,
    });
    return { a, b, c };
  }

  it('omits archived by default; includeArchived returns them', () => {
    const { a, b } = seedFixtures();
    const visible = listDocumentContentBlocks(ORG_A);
    const ids = visible.map((t) => t.contentBlockId).sort();
    expect(ids).toEqual([a.contentBlockId, b.contentBlockId].sort());

    const all = listDocumentContentBlocks(ORG_A, { includeArchived: true });
    expect(all).toHaveLength(3);
  });

  it('filters by documentType (untargeted entries always match)', () => {
    seedFixtures();
    const visible = listDocumentContentBlocks(ORG_A, { documentType: 'board_report' });
    expect(visible.map((t) => t.name)).toContain('PL Compliance Disclaimer');
    expect(visible.map((t) => t.name)).toContain('EN Standard Intro');
  });

  it('filters by language (`all` always matches)', () => {
    const { a } = seedFixtures();
    const en = listDocumentContentBlocks(ORG_A, { language: 'en' });
    expect(en.map((t) => t.contentBlockId)).not.toContain(a.contentBlockId);
  });

  it('filters by anyTag (case-insensitive, OR semantics)', () => {
    seedFixtures();
    const visible = listDocumentContentBlocks(ORG_A, { anyTag: ['LEGAL'] });
    expect(visible.map((t) => t.name)).toEqual(['PL Compliance Disclaimer']);
  });
});

describe('Content Block Service — instantiate', () => {
  it('allocates a fresh blockId + deep-clones the payload', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    const a = instantiateDocumentContentBlock({
      organizationId: ORG_A,
      contentBlockId: drafted.contentBlockId,
    });
    const b = instantiateDocumentContentBlock({
      organizationId: ORG_A,
      contentBlockId: drafted.contentBlockId,
    });
    expect(a.block.blockId).toMatch(/^block-/);
    expect(a.block.blockId).not.toBe(b.block.blockId);
    expect(a.block.type).toBe('paragraph');
    (a.block.content as { text: string }).text = 'Mutated';
    expect((b.block.content as { text: string }).text).toBe('Standard intro line.');
  });

  it('honors an explicit blockId override', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    const result = instantiateDocumentContentBlock({
      organizationId: ORG_A,
      contentBlockId: drafted.contentBlockId,
      blockId: 'explicit-id',
    });
    expect(result.block.blockId).toBe('explicit-id');
  });

  it('refuses to instantiate archived entries', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', block: SAMPLE_PARAGRAPH },
    });
    archiveDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: drafted.contentBlockId,
    });
    expect(() =>
      instantiateDocumentContentBlock({
        organizationId: ORG_A,
        contentBlockId: drafted.contentBlockId,
      })
    ).toThrow(/archived/);
  });

  it('returns content_block_not_found for unknown ids', () => {
    expect(() =>
      instantiateDocumentContentBlock({
        organizationId: ORG_A,
        contentBlockId: 'does-not-exist',
      })
    ).toThrow(/not_found|not found/i);
  });
});

describe('Content Block Service — tenant isolation + hydration', () => {
  it('cross-tenant reads return null', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'A only', block: SAMPLE_PARAGRAPH },
    });
    expect(getDocumentContentBlock(drafted.contentBlockId, ORG_B)).toBeNull();
  });

  it('hydrates persisted entries on cold start', async () => {
    await persistContentBlock({
      contentBlockId: 'pre-existing-block',
      organizationId: ORG_A,
      name: 'Pre-existing',
      status: 'active',
      version: 'v3',
      tags: ['compliance'],
      documentTypes: [],
      languageScope: 'all',
      block: SAMPLE_PARAGRAPH,
      createdBy: USER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await ensureContentBlockRegistryHydrated(ORG_A);
    const template = getDocumentContentBlock('pre-existing-block', ORG_A);
    expect(template).not.toBeNull();
    expect(template!.version).toBe('v3');
  });
});

describe('Content Block Service — audit trail', () => {
  it('records draft, update, activate, archive transitions in order', () => {
    const drafted = draftDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Audited', block: SAMPLE_PARAGRAPH },
    });
    updateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER_2,
      contentBlockId: drafted.contentBlockId,
      input: { name: 'Audited 2' },
    });
    activateDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER_2,
      contentBlockId: drafted.contentBlockId,
    });
    archiveDocumentContentBlock({
      organizationId: ORG_A,
      userId: USER,
      contentBlockId: drafted.contentBlockId,
      reason: 'cleanup',
    });

    const audit = listDocumentContentBlockAuditEntries(drafted.contentBlockId, ORG_A);
    expect(audit.map((e) => e.action)).toEqual([
      'content_block_drafted',
      'content_block_updated',
      'content_block_activated',
      'content_block_archived',
    ]);
    expect(audit[3]!.details).toMatchObject({ reason: 'cleanup', fromStatus: 'active' });
  });
});
