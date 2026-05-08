/**
 * Document Studio — Chat-first creation flow tests (Epic E4, Slice 4.4).
 *
 * Covers `createDocumentFromChatSourcePack`: the orchestration that
 * Teresa invokes when the user says "make me a memo from these sources".
 *
 *   - Drafts a SourcePack scoped to the caller tenant.
 *   - Ingests every supplied connector input via the connector adapters.
 *   - Marks the pack ready (governance handshake).
 *   - Calls materializeDocumentArtifact with the pack's sourceRefs.
 *   - Records pack_attached_to_document audit row carrying the artifact id.
 *   - Rolls back the pack via archive when any connector fails.
 *   - Refuses calls without organizationId / userId / intake / sources.
 *
 * Mocks `wave5ArtifactRuntimeService` so the test stays a pure unit and
 * does not require a database fixture, mirroring the preflight test
 * already on disk.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(async () => ({ artifact_id: 'wave5-chat-create-1' })),
  getWave5Artifact: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import {
  __resetSourcePackRegistryAndPersistenceForTests,
  getSourcePack,
  listSourcePackAuditEntries,
  listSourcePacks,
} from '../documentSourcePackService.js';
import {
  type CreateChatSourcePackConnectorInput,
  createDocumentFromChatSourcePack,
} from '../documentStudioService.js';
import type { DocumentIntake } from '../documentStudioTypes.js';

const ORG = 'org-chat-create';
const USER = 'user-teresa-driver';

const baseIntake: DocumentIntake = {
  title: 'Q3 Findings',
  description: 'Memo summarizing Q3 findings for the board.',
  audience: ['Board'],
  language: 'en',
  goal: 'decide',
};

beforeEach(async () => {
  await __resetSourcePackRegistryAndPersistenceForTests();
});

afterEach(async () => {
  await __resetSourcePackRegistryAndPersistenceForTests();
});

describe('createDocumentFromChatSourcePack', () => {
  it('drafts a pack, ingests two text sources, and returns the artifactId + packId + itemCount', async () => {
    const sources: CreateChatSourcePackConnectorInput[] = [
      {
        connector: 'text',
        title: 'CFO interview',
        body: 'CFO: Programme spend is on plan for Q3.',
        language: 'en',
      },
      {
        connector: 'text',
        title: 'PMO update',
        body: 'PMO: Two milestones at risk; mitigation in flight.',
        language: 'en',
      },
    ];

    const result = await createDocumentFromChatSourcePack({
      organizationId: ORG,
      userId: USER,
      intake: baseIntake,
      sources,
    });

    expect(result.artifactId).toBe('wave5-chat-create-1');
    expect(result.itemCount).toBe(2);
    expect(result.packId).toMatch(/^source-pack-/);
    expect(result.schema).toBeDefined();
    expect(result.schema.title).toBe('Q3 Findings');

    const pack = getSourcePack(result.packId, ORG);
    expect(pack).not.toBeNull();
    expect(pack!.status).toBe('ready');
    expect(pack!.items).toHaveLength(2);
    expect(pack!.name).toBe('Q3 Findings — sources');
  });

  it('records pack_attached_to_document audit with the artifact id', async () => {
    const sources: CreateChatSourcePackConnectorInput[] = [
      {
        connector: 'text',
        title: 'Single source',
        body: 'Programme on track.',
      },
    ];

    const result = await createDocumentFromChatSourcePack({
      organizationId: ORG,
      userId: USER,
      intake: baseIntake,
      sources,
    });

    const audit = listSourcePackAuditEntries(result.packId, ORG);
    const actions = audit.map((a) => a.action);
    expect(actions).toContain('pack_drafted');
    expect(actions).toContain('pack_item_added');
    expect(actions).toContain('pack_marked_ready');
    expect(actions).toContain('pack_attached_to_document');

    const attachEntry = audit.find((a) => a.action === 'pack_attached_to_document');
    expect((attachEntry?.details as { artifactId?: string } | undefined)?.artifactId).toBe(
      'wave5-chat-create-1'
    );
  });

  it('rolls back the pack via archive when a connector fails', async () => {
    const sources = [
      { connector: 'text', title: 'OK source', body: 'fine body' },
      { connector: 'text', title: '', body: 'this will throw at the connector' },
    ] as CreateChatSourcePackConnectorInput[];

    await expect(
      createDocumentFromChatSourcePack({
        organizationId: ORG,
        userId: USER,
        intake: baseIntake,
        sources,
      })
    ).rejects.toThrow();

    // The half-built pack must NOT be left in `ready` state in the
    // listing; archive rollback flips it to `archived`.
    const allPacks = listSourcePacks(ORG, { includeArchived: true });
    expect(allPacks).toHaveLength(1);
    expect(allPacks[0]!.status).toBe('archived');
  });

  it('refuses calls without organizationId / userId / intake / sources', async () => {
    await expect(
      createDocumentFromChatSourcePack({
        organizationId: '',
        userId: USER,
        intake: baseIntake,
        sources: [{ connector: 'text', title: 't', body: 'b' }],
      })
    ).rejects.toThrow(/organizationId/);

    await expect(
      createDocumentFromChatSourcePack({
        organizationId: ORG,
        userId: '',
        intake: baseIntake,
        sources: [{ connector: 'text', title: 't', body: 'b' }],
      })
    ).rejects.toThrow(/userId/);

    await expect(
      createDocumentFromChatSourcePack({
        organizationId: ORG,
        userId: USER,
        intake: undefined as unknown as DocumentIntake,
        sources: [{ connector: 'text', title: 't', body: 'b' }],
      })
    ).rejects.toThrow(/intake/);

    await expect(
      createDocumentFromChatSourcePack({
        organizationId: ORG,
        userId: USER,
        intake: baseIntake,
        sources: [],
      })
    ).rejects.toThrow(/at least one source/);
  });

  it('honors a custom packName when supplied', async () => {
    const sources: CreateChatSourcePackConnectorInput[] = [
      { connector: 'text', title: 'a', body: 'b' },
    ];
    const result = await createDocumentFromChatSourcePack({
      organizationId: ORG,
      userId: USER,
      intake: baseIntake,
      sources,
      packName: '  Custom Pack Name  ',
    });
    const pack = getSourcePack(result.packId, ORG);
    expect(pack!.name).toBe('Custom Pack Name');
  });

  it('falls back packLanguage to intake.language when not supplied', async () => {
    const sources: CreateChatSourcePackConnectorInput[] = [
      { connector: 'text', title: 'a', body: 'b' },
    ];
    const result = await createDocumentFromChatSourcePack({
      organizationId: ORG,
      userId: USER,
      intake: { ...baseIntake, language: 'pl' },
      sources,
    });
    const pack = getSourcePack(result.packId, ORG);
    expect(pack!.language).toBe('pl');
  });
});
