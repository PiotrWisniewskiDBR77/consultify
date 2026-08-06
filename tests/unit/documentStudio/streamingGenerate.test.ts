/**
 * Document Studio — Streaming generation contract (C1).
 *
 * The streaming route (`POST /generate/stream`) delegates to the SAME
 * `materializeDocumentArtifact` pipeline as the synchronous `/generate` route;
 * it only threads pure observer hooks (`onPlan`, `onSection`, `onWarning`)
 * that emit SSE events. This spec locks that contract at the service layer:
 *
 *   1. The hooks fire in the canonical order plan → section* → (return).
 *      `onPlan` fires exactly once before any `onSection`, and one `onSection`
 *      fires per section in `orderIndex` order (index 0..total-1).
 *   2. THE key guarantee: the schema assembled while streaming (hooks present)
 *      is BYTE-IDENTICAL to the schema the sync path returns for the same
 *      input (hooks absent) — streaming is progressive delivery, not a
 *      different result. Asserted via JSON.stringify equality.
 *   3. The sections handed to `onSection` are the SAME section objects that
 *      appear in the final `schema`, so what the FE renders progressively is
 *      exactly what it persists.
 *
 * The wave5 runtime is mocked with a stateful in-memory store (mirrors the
 * happy-path spec) and the LLM is mocked deterministically so both runs
 * produce a stable, comparable schema.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DocumentOutline,
  DocumentSection,
} from '../../../server/src/services/documentStudio/documentStudioTypes.js';
import type { DocumentGenerationWarning } from '../../../server/src/services/documentStudio/documentGenerationWarnings.js';

interface StoredArtifact {
  artifact_id: string;
  organization_id: string;
  title: string;
  content: string;
  content_json: unknown;
  metadata_json: unknown;
  status?: string;
}

const store = new Map<string, StoredArtifact>();
let seq = 0;

vi.mock('../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(
    async (params: {
      organizationId: string;
      title: string;
      content: string;
      contentJson: unknown;
      metadata: unknown;
    }) => {
      seq += 1;
      // Deterministic id so the two runs (sync + streamed) produce identical
      // artifactIds → identical final schema (which carries artifactId).
      const artifactId = `art-stream-${seq}`;
      const row: StoredArtifact = {
        artifact_id: artifactId,
        organization_id: params.organizationId,
        title: params.title,
        content: params.content,
        content_json: params.contentJson,
        metadata_json: params.metadata,
        status: 'draft',
      };
      store.set(`${params.organizationId}::${artifactId}`, row);
      return { artifactId, artifact_id: artifactId };
    }
  ),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    return store.get(`${organizationId}::${artifactId}`) ?? null;
  }),
  buildWave5ExportManifest: vi.fn(async (artifactId: string) => ({ artifactId, formats: [] })),
  markWave5ArtifactExported: vi.fn(async () => ({ status: 'exported' })),
}));

// Deterministic LLM: echoes each requested block's placeholder back so the
// prose stage runs the full success path identically on both runs.
vi.mock('../../../server/src/services/aiService.js', () => ({
  generateChatResponse: vi.fn(async (args: { messages: { content: string }[] }) => {
    // The user prompt embeds a JSON array of { blockId, kind, placeholder }.
    const userContent = args.messages?.[0]?.content ?? '';
    const match = userContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
    let blocks: Array<{ blockId?: string; text?: string; items?: string[] }> = [];
    if (match) {
      try {
        const targets = JSON.parse(match[0]) as Array<{ blockId: string; kind: string }>;
        blocks = targets.map((t) =>
          t.kind === 'items'
            ? {
                blockId: t.blockId,
                items: [`Point A for ${t.blockId}`, `Point B for ${t.blockId}`],
              }
            : { blockId: t.blockId, text: `Deterministic prose for ${t.blockId}.` }
        );
      } catch {
        blocks = [];
      }
    }
    return { content: JSON.stringify({ blocks }) };
  }),
}));

const { materializeDocumentArtifact } =
  await import('../../../server/src/services/documentStudio/documentStudioService.js');
const { getDocumentArtifact } =
  await import('../../../server/src/services/documentStudio/documentStudioService.js');
const { applyOrgContextGrounding } =
  await import('../../../server/src/services/documentStudio/documentOrgContextSourcePack.js');

const INTAKE = {
  description:
    'Recommend whether to consolidate the three regional data centers into one cloud region.',
  language: 'en' as const,
  goal: 'decide' as const,
  audience: ['Board'],
};

/**
 * The pipeline mints fresh UUIDs (documentId / sectionId / blockId) and
 * timestamps (createdAt / updatedAt / statusChangedAt) on every call — these
 * are non-deterministic BY DESIGN and orthogonal to the streaming-vs-sync
 * question. Normalizing them lets the equality test assert the STRUCTURAL
 * byte-equality of the two schemas (same sections, blocks, prose, ordering,
 * flags) without being defeated by random ids. Ids are canonicalized
 * positionally so a genuine reordering / block-count divergence still fails.
 */
function canonicalizeSchema(schema: unknown): string {
  const clone = JSON.parse(JSON.stringify(schema)) as {
    documentId?: string;
    createdAt?: string;
    updatedAt?: string;
    statusChangedAt?: string;
    sections?: Array<{
      sectionId?: string;
      blocks?: Array<{ blockId?: string; content?: unknown }>;
    }>;
  };
  clone.documentId = '<docId>';
  clone.createdAt = '<ts>';
  clone.updatedAt = '<ts>';
  clone.statusChangedAt = '<ts>';
  (clone.sections ?? []).forEach((section, sIdx) => {
    section.sectionId = `<sec-${sIdx}>`;
    (section.blocks ?? []).forEach((block, bIdx) => {
      // The deterministic LLM mock echoes the blockId into the prose, so
      // canonicalize the id inside the text too before erasing the id itself.
      const canonicalBlockId = `<blk-${sIdx}-${bIdx}>`;
      if (block.content && typeof block.content === 'object') {
        const c = block.content as { text?: string; items?: string[] };
        if (typeof c.text === 'string' && block.blockId) {
          c.text = c.text.split(block.blockId).join(canonicalBlockId);
        }
        if (Array.isArray(c.items) && block.blockId) {
          c.items = c.items.map((i) =>
            typeof i === 'string' ? i.split(block.blockId as string).join(canonicalBlockId) : i
          );
        }
      }
      block.blockId = canonicalBlockId;
    });
  });
  // EvidenceContract messages intentionally quote canonical block UUIDs; they
  // must be normalized too when comparing two independently materialized runs.
  return JSON.stringify(clone).replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    '<uuid>'
  );
}

describe('Document Studio — streaming generation contract (C1)', () => {
  beforeEach(() => {
    store.clear();
    seq = 0;
  });

  it('production SSE path keeps an explicit three-fact brief isolated and persists only grounded board content', async () => {
    const intake = {
      title: 'Raport dla zarządu',
      description:
        '72% realizacji planu, budżet 1,4 mln EUR, 18/21 kamieni milowych; zakaz utożsamiania realizacji planu z wykorzystaniem budżetu; brakujące owners i dates oznacz jako assumptions.',
      documentType: 'board_report' as const,
      // Production may carry the browser locale rather than the narrow UI
      // union; the runtime must normalize it before final grounding.
      language: 'pl-PL' as any,
      goal: 'decide' as const,
      audience: ['Zarząd'],
    };
    const routed = applyOrgContextGrounding(intake, [], {
      contextSummaryPl:
        'DACH. 8 inicjatyw. Offense-Repair-Conversion. Automated Changeover. Status: green.',
      sourceRef: {
        sourceType: 'organization_context',
        sourceId: 'org-context',
        sourceTitle: 'Org',
      },
      activeProjectNames: [],
      activeInitiativeNames: [],
    });
    expect(routed.intake.description).toBe(intake.description);
    expect(routed.sourceRefs[0]?.sourceId).toBe('explicit-user-brief');

    const streamedSections: DocumentSection[] = [];
    const run = await materializeDocumentArtifact({
      organizationId: 'org-production-path',
      userId: 'user-production-path',
      intake: routed.intake,
      sourceRefs: routed.sourceRefs,
      useLlm: true,
      hooks: { onSection: (section) => streamedSections.push(section) },
    });
    const reopened = await getDocumentArtifact(run.artifactId, 'org-production-path');
    expect(reopened).not.toBeNull();
    expect(JSON.stringify(streamedSections)).toBe(JSON.stringify(run.schema.sections));
    expect(JSON.stringify(reopened?.sections)).toBe(JSON.stringify(run.schema.sections));

    const text = JSON.stringify(reopened);
    expect(text).toContain('Realizacja planu wynosi 72%');
    expect(text).toContain('1,4 mln EUR');
    expect(text).toContain('18/21');
    expect(text).not.toMatch(
      /DACH|8 inicjatyw|Offense-Repair-Conversion|Automated Changeover|Status: green|stopień wykorzystania budżetu.*pozostaje w ramach alokacji|realokacj/i
    );
    expect(reopened?.sections).toHaveLength(7);
    const safetyPlaceholder = 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).';
    for (const section of reopened?.sections ?? []) {
      const sectionText = JSON.stringify(section.blocks);
      expect(sectionText).not.toContain(safetyPlaceholder);
      expect(sectionText.length).toBeGreaterThan(80);
    }
    expect(
      reopened?.sections.flatMap((section) => section.blocks).some((block) => block.isAssumption)
    ).toBe(true);
    const { runDocumentQa } =
      await import('../../../server/src/services/documentStudio/documentQaService.js');
    const qa = runDocumentQa(reopened!);
    expect(qa.anyBlocking).toBe(false);
    expect(qa.categories.filter((category) => category.blocking)).toEqual([]);
  });

  it('fires hooks in order plan → section* and never before its schema is ready', async () => {
    const events: string[] = [];
    let planOutline: DocumentOutline | null = null;
    const sectionOrder: number[] = [];

    const run = await materializeDocumentArtifact({
      organizationId: 'org-stream',
      userId: 'user-1',
      intake: INTAKE,
      useLlm: true,
      hooks: {
        onPlan: (outline) => {
          events.push('plan');
          planOutline = outline;
        },
        onSection: (_section: DocumentSection, index: number) => {
          events.push('section');
          sectionOrder.push(index);
        },
      },
    });

    // plan fires exactly once, before any section.
    expect(events[0]).toBe('plan');
    expect(events.filter((e) => e === 'plan')).toHaveLength(1);
    expect(planOutline).not.toBeNull();

    // one section per schema section, in ascending index order 0..N-1.
    const total = run.schema.sections.length;
    expect(total).toBeGreaterThan(0);
    expect(events.filter((e) => e === 'section')).toHaveLength(total);
    expect(sectionOrder).toEqual([...Array(total).keys()]);
  });

  it('streamed sections are the SAME objects that appear in the final schema', async () => {
    const streamed: DocumentSection[] = [];
    const run = await materializeDocumentArtifact({
      organizationId: 'org-stream',
      userId: 'user-1',
      intake: INTAKE,
      useLlm: true,
      hooks: {
        onSection: (section) => streamed.push(section),
      },
    });

    const ordered = [...run.schema.sections].sort((a, b) => a.orderIndex - b.orderIndex);
    expect(streamed).toHaveLength(ordered.length);
    ordered.forEach((section, i) => {
      // Reference identity: the FE renders exactly what is persisted.
      expect(streamed[i]).toBe(section);
      expect(streamed[i].blocks).toBe(section.blocks);
    });
  });

  it('done.schema (streamed) is byte-identical to the sync-path schema for the same input', async () => {
    // Streamed run (hooks present).
    const streamedSections: DocumentSection[] = [];
    const warnings: DocumentGenerationWarning[] = [];
    const streamed = await materializeDocumentArtifact({
      organizationId: 'org-identity',
      userId: 'user-1',
      intake: INTAKE,
      useLlm: true,
      hooks: {
        onSection: (s) => streamedSections.push(s),
        onWarning: (w) => warnings.push(w),
      },
    });

    // Reset the store so the sync run mints the SAME deterministic artifactId
    // (art-stream-1), making the two schemas comparable including artifactId.
    store.clear();
    seq = 0;

    // Sync run (no hooks) — the exact pre-C1 code path.
    const sync = await materializeDocumentArtifact({
      organizationId: 'org-identity',
      userId: 'user-1',
      intake: INTAKE,
      useLlm: true,
    });

    // THE contract: identical bytes (modulo the per-call random UUIDs +
    // timestamps that both paths mint identically-at-random).
    expect(canonicalizeSchema(streamed.schema)).toEqual(canonicalizeSchema(sync.schema));
    expect(streamed.artifactId).toEqual(sync.artifactId);

    // The streamed schema was fully assembled — its sections were emitted.
    expect(streamedSections).toHaveLength(streamed.schema.sections.length);
    // Deterministic LLM never fell back, so no warnings on either path.
    expect(warnings).toHaveLength(0);
    expect(streamed.generationWarnings ?? []).toEqual(sync.generationWarnings ?? []);
  });
});
