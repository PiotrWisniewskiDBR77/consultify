/**
 * notebookTopicService — Topics as a living, aggregating entity for M04.
 *
 * A topic is an org-scoped entity. Notes pin to topics (notebook_page_topics).
 * A topic aggregates its related notes + linked outputs + initiatives (via
 * link_graph_edges).
 *
 * DB access goes through queryHelpers (queryOne/queryAll/queryRun) — the same
 * mockable layer used by the notebook routes — so this service is unit-testable
 * with MOCK_DB.
 *
 * Owned by AGENT 1. New types live in this file (not src/types/myWork).
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

// ── Types (local to this workstream) ─────────────────────────────────────────

export interface NotebookTopic {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  createdAt: string | null;
}

export type NotebookTopicSource = 'ai' | 'manual';

export interface NotebookPageTopicLink {
  pageId: string;
  topicId: string;
  score: number;
  source: NotebookTopicSource;
}

/** A topic candidate produced by {@link deriveTopicsForPage}. */
export interface DerivedTopic {
  name: string;
  slug: string;
  score: number;
}

export interface AggregatedNote {
  id: string;
  title: string;
  updatedAt: string | null;
  score: number;
  source: NotebookTopicSource;
}

export interface AggregatedArtifact {
  type: string;
  id: string;
  /** 'output' | 'initiative' | 'other' — bucketed from the edge type. */
  bucket: 'output' | 'initiative' | 'other';
}

export interface TopicAggregate {
  topic: NotebookTopic;
  notes: AggregatedNote[];
  outputs: AggregatedArtifact[];
  initiatives: AggregatedArtifact[];
  counts: {
    notes: number;
    outputs: number;
    initiatives: number;
  };
  lastActiveAt: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a free-text topic name into a stable slug for idempotent upserts. */
export function slugifyTopic(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (ł handled below)
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const normalizeSource = (raw: unknown): NotebookTopicSource =>
  String(raw || '').toLowerCase() === 'manual' ? 'manual' : 'ai';

const ARTIFACT_BUCKETS: Array<{ bucket: 'output' | 'initiative'; needles: string[] }> = [
  {
    bucket: 'initiative',
    needles: ['initiative', 'inicjatyw'],
  },
  {
    bucket: 'output',
    needles: [
      'output',
      'deliverable',
      'report',
      'raport',
      'artifact',
      'artefakt',
      'document',
      'sheet',
      'deck',
      'presentation',
    ],
  },
];

const NOTEBOOK_REF_TYPES = new Set(['notebook_page', 'notebook']);

function bucketArtifact(type: string): 'output' | 'initiative' | 'other' {
  const t = String(type || '').toLowerCase();
  for (const { bucket, needles } of ARTIFACT_BUCKETS) {
    if (needles.some((n) => t.includes(n))) return bucket;
  }
  return 'other';
}

function mapTopicRow(row: any): NotebookTopic {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? row.organizationId ?? ''),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

// ── Keyword heuristic for derivation ─────────────────────────────────────────

// Stopwords (EN + PL) to avoid deriving noise topics.
const STOPWORDS = new Set<string>([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'with',
  'this',
  'that',
  'have',
  'from',
  'they',
  'will',
  'would',
  'there',
  'their',
  'what',
  'about',
  'which',
  'when',
  'them',
  'then',
  'into',
  'than',
  'your',
  'been',
  'were',
  'also',
  'some',
  'more',
  'such',
  'only',
  'over',
  'oraz',
  'jest',
  'sie',
  'nie',
  'tak',
  'jak',
  'dla',
  'ale',
  'lub',
  'czy',
  'aby',
  'tez',
  'bez',
  'pod',
  'nad',
  'przy',
  'ten',
  'tej',
  'tym',
  'tych',
  'jego',
  'jej',
  'ich',
  'gdy',
  'oraz',
  'bardzo',
  'tylko',
  'mozna',
  'wiec',
  'jako',
  'przez',
  'ktore',
  'ktory',
  'ktora',
]);

/**
 * Derive candidate topics from a page's title + content using a keyword-frequency
 * heuristic. Title terms are weighted higher. Tags are treated as strong signals.
 *
 * LLM-hook: a richer derivation (semantic topic extraction) can replace/augment
 * this — see TODO below. Kept deterministic + dependency-free so it works in the
 * degraded / no-AI path and is trivially unit-testable.
 */
export function deriveTopicsFromText(input: {
  title?: string | null;
  contentText?: string | null;
  tags?: string[];
  max?: number;
}): DerivedTopic[] {
  const max = Math.max(1, Math.min(input.max ?? 5, 10));
  const title = String(input.title || '');
  const content = String(input.contentText || '').slice(0, 4000);
  const tags = (input.tags || []).map((t) => String(t || '').trim()).filter(Boolean);

  const freq = new Map<string, { display: string; score: number }>();

  const ingest = (text: string, weight: number) => {
    const words = text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
    for (const w of words) {
      const cur = freq.get(w) ?? { display: w, score: 0 };
      cur.score += weight;
      freq.set(w, cur);
    }
  };

  ingest(title, 3);
  ingest(content, 1);

  // Tags are explicit user signal → strongest weight, keep original display.
  for (const tag of tags) {
    const slug = slugifyTopic(tag);
    if (!slug) continue;
    const cur = freq.get(slug) ?? { display: tag, score: 0 };
    cur.display = tag; // prefer human-authored tag casing
    cur.score += 5;
    freq.set(slug, cur);
  }

  // TODO(LLM): optionally call an LLM to extract higher-order semantic topics
  // and merge with the heuristic candidates (dedupe by slug, keep max score).

  return (
    Array.from(freq.entries())
      .map(([key, v]) => ({
        name: v.display,
        slug: slugifyTopic(v.display) || key,
        score: v.score,
      }))
      .filter((t) => t.slug.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      // normalize score into 0..1 relative to the top candidate
      .map((t, _i, arr) => ({ ...t, score: Math.round((t.score / arr[0].score) * 100) / 100 }))
  );
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listTopics(orgId: string): Promise<NotebookTopic[]> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT t.id, t.organization_id, t.name, t.slug, t.created_at,
            (SELECT COUNT(*) FROM notebook_page_topics pt WHERE pt.topic_id = t.id) AS page_count
       FROM notebook_topics t
      WHERE t.organization_id = ?
      ORDER BY t.name ASC`,
    [orgId]
  );
  return (rows || []).map(
    (r) => ({ ...mapTopicRow(r), pageCount: Number(r.page_count ?? 0) }) as any
  );
}

export async function getTopicById(orgId: string, topicId: string): Promise<NotebookTopic | null> {
  const row = await queryHelpers.queryOne<any>(
    `SELECT id, organization_id, name, slug, created_at
       FROM notebook_topics WHERE id = ? LIMIT 1`,
    [topicId]
  );
  if (!row) return null;
  if (String(row.organization_id ?? '') !== String(orgId)) return null;
  return mapTopicRow(row);
}

/**
 * Create a topic, or return the existing one with the same slug within the org
 * (idempotent on slug — re-derivation never duplicates).
 */
export async function createTopic(orgId: string, name: string): Promise<NotebookTopic> {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Topic name required');
  const slug = slugifyTopic(trimmed);
  if (!slug) throw new Error('Topic name produced empty slug');

  const existing = await queryHelpers.queryOne<any>(
    `SELECT id, organization_id, name, slug, created_at
       FROM notebook_topics WHERE organization_id = ? AND slug = ? LIMIT 1`,
    [orgId, slug]
  );
  if (existing) return mapTopicRow(existing);

  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO notebook_topics (id, organization_id, name, slug, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [id, orgId, trimmed, slug]
  );

  // Read-back keeps the contract honest even when the DB fills defaults.
  const created = await queryHelpers.queryOne<any>(
    `SELECT id, organization_id, name, slug, created_at
       FROM notebook_topics WHERE id = ? LIMIT 1`,
    [id]
  );
  return created
    ? mapTopicRow(created)
    : { id, organizationId: orgId, name: trimmed, slug, createdAt: null };
}

/**
 * Pin a page to a topic. Idempotent on (page_id, topic_id): re-pinning updates
 * score/source rather than inserting a duplicate.
 */
export async function pinPageToTopic(params: {
  pageId: string;
  topicId: string;
  score?: number;
  source?: NotebookTopicSource;
}): Promise<NotebookPageTopicLink> {
  const { pageId, topicId } = params;
  if (!pageId || !topicId) throw new Error('pageId and topicId required');
  const score = Number.isFinite(params.score) ? Number(params.score) : 0;
  const source = normalizeSource(params.source ?? 'manual');

  const existing = await queryHelpers.queryOne<any>(
    `SELECT id FROM notebook_page_topics WHERE page_id = ? AND topic_id = ? LIMIT 1`,
    [pageId, topicId]
  );

  if (existing) {
    await queryHelpers.queryRun(
      `UPDATE notebook_page_topics SET score = ?, source = ? WHERE id = ?`,
      [score, source, existing.id]
    );
  } else {
    await queryHelpers.queryRun(
      `INSERT INTO notebook_page_topics (id, page_id, topic_id, score, source, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), pageId, topicId, score, source]
    );
  }

  return { pageId, topicId, score, source };
}

export async function unpinPageFromTopic(pageId: string, topicId: string): Promise<void> {
  await queryHelpers.queryRun(
    `DELETE FROM notebook_page_topics WHERE page_id = ? AND topic_id = ?`,
    [pageId, topicId]
  );
}

/** Topics currently pinned to a page (used by chips). */
export async function listTopicsForPage(
  orgId: string,
  pageId: string
): Promise<Array<NotebookTopic & { score: number; source: NotebookTopicSource }>> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT t.id, t.organization_id, t.name, t.slug, t.created_at,
            pt.score AS score, pt.source AS source
       FROM notebook_page_topics pt
       JOIN notebook_topics t ON t.id = pt.topic_id
      WHERE pt.page_id = ? AND t.organization_id = ?
      ORDER BY pt.score DESC, t.name ASC`,
    [pageId, orgId]
  );
  return (rows || []).map((r) => ({
    ...mapTopicRow(r),
    score: Number(r.score ?? 0),
    source: normalizeSource(r.source),
  }));
}

// ── Derivation (persisting) ──────────────────────────────────────────────────

/**
 * Contract consumed by AGENT 3 (notebookAIEnrichService.suggestTopicLinks).
 *
 * deriveTopicsForPage(pageId, opts?):
 *   - loads the page (title/content/tags) within `orgId`
 *   - derives candidate topics (heuristic; LLM-hook TODO)
 *   - upserts each topic (idempotent on slug) and pins the page to it
 *     (source defaults to 'ai')
 *   - returns the derived candidates (name/slug/score)
 *
 * `persist: false` derives without writing (preview mode).
 *
 * @param pageId  notebook_pages.id
 * @param opts.orgId   REQUIRED org scope. If omitted, resolved from the page row.
 * @param opts.persist default true — upsert topics + pin the page.
 * @param opts.source  default 'ai'.
 * @param opts.max     max candidates (default 5).
 */
export async function deriveTopicsForPage(
  pageId: string,
  opts?: {
    orgId?: string;
    persist?: boolean;
    source?: NotebookTopicSource;
    max?: number;
  }
): Promise<DerivedTopic[]> {
  if (!pageId) throw new Error('pageId required');
  const persist = opts?.persist !== false;
  const source = normalizeSource(opts?.source ?? 'ai');

  const page = await queryHelpers.queryOne<any>(
    `SELECT id, organization_id, title, content_text, tags_json
       FROM notebook_pages WHERE id = ? LIMIT 1`,
    [pageId]
  );
  if (!page) return [];

  const orgId = String(opts?.orgId ?? page.organization_id ?? '');
  if (!orgId) return [];
  // Defense-in-depth: never derive across org boundary.
  if (opts?.orgId && String(page.organization_id ?? '') !== orgId) return [];

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(page.tags_json ?? '[]'));
    if (Array.isArray(parsed)) tags = parsed.map((t) => String(t)).filter(Boolean);
  } catch {
    /* tags optional */
  }

  const derived = deriveTopicsFromText({
    title: page.title,
    contentText: page.content_text,
    tags,
    max: opts?.max ?? 5,
  });

  if (!persist || derived.length === 0) return derived;

  for (const cand of derived) {
    const topic = await createTopic(orgId, cand.name);
    await pinPageToTopic({
      pageId,
      topicId: topic.id,
      score: cand.score,
      source,
    });
  }

  return derived;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregate a topic: its pinned notes + linked outputs + initiatives.
 *
 * Notes come from notebook_page_topics (org-scoped via notebook_pages).
 * Outputs/initiatives come from link_graph_edges where any of the topic's notes
 * is an endpoint of an edge; the non-notebook endpoint is bucketed by type.
 */
export async function aggregateTopic(
  orgId: string,
  topicId: string
): Promise<TopicAggregate | null> {
  const topic = await getTopicById(orgId, topicId);
  if (!topic) return null;

  const noteRows = await queryHelpers.queryAll<any>(
    `SELECT np.id, np.title, np.updated_at,
            pt.score AS score, pt.source AS source
       FROM notebook_page_topics pt
       JOIN notebook_pages np ON np.id = pt.page_id
      WHERE pt.topic_id = ? AND np.organization_id = ?
      ORDER BY np.updated_at DESC`,
    [topicId, orgId]
  );

  const notes: AggregatedNote[] = (noteRows || []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ''),
    updatedAt: r.updated_at ?? null,
    score: Number(r.score ?? 0),
    source: normalizeSource(r.source),
  }));

  const lastActiveAt = notes.reduce<string | null>((acc, n) => {
    if (!n.updatedAt) return acc;
    if (!acc || String(n.updatedAt) > String(acc)) return n.updatedAt;
    return acc;
  }, null);

  const outputs: AggregatedArtifact[] = [];
  const initiatives: AggregatedArtifact[] = [];

  if (notes.length > 0) {
    const noteIds = notes.map((n) => n.id);
    const placeholders = noteIds.map(() => '?').join(', ');
    const edgeRows = await queryHelpers.queryAll<any>(
      `SELECT source_type, source_id, target_type, target_id
         FROM link_graph_edges
        WHERE organization_id = ?
          AND (
            (source_type IN ('notebook_page', 'notebook') AND source_id IN (${placeholders}))
            OR (target_type IN ('notebook_page', 'notebook') AND target_id IN (${placeholders}))
          )`,
      [orgId, ...noteIds, ...noteIds]
    );

    const seen = new Set<string>();
    const pushArtifact = (type: string, id: string) => {
      const t = String(type || '').trim();
      const i = String(id || '').trim();
      if (!t || !i) return;
      if (NOTEBOOK_REF_TYPES.has(t)) return; // skip the note endpoints themselves
      const key = `${t}:${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      const bucket = bucketArtifact(t);
      const artifact: AggregatedArtifact = { type: t, id: i, bucket };
      if (bucket === 'initiative') initiatives.push(artifact);
      else if (bucket === 'output') outputs.push(artifact);
      // 'other' artifacts are intentionally not surfaced in the two named buckets.
    };

    for (const row of edgeRows || []) {
      pushArtifact(row.source_type, row.source_id);
      pushArtifact(row.target_type, row.target_id);
    }
  }

  return {
    topic,
    notes,
    outputs,
    initiatives,
    counts: {
      notes: notes.length,
      outputs: outputs.length,
      initiatives: initiatives.length,
    },
    lastActiveAt,
  };
}

export default {
  slugifyTopic,
  deriveTopicsFromText,
  deriveTopicsForPage,
  listTopics,
  getTopicById,
  createTopic,
  pinPageToTopic,
  unpinPageFromTopic,
  listTopicsForPage,
  aggregateTopic,
};
