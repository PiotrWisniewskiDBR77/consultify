import type { CanvasToolType } from './ideaSelectionTypes';

// ── V5 §9.3: Idea stage model ──────────────────────────────────────────────
export type IdeaStageV5 =
  | 'spark'
  | 'framing'
  | 'exploring'
  | 'structuring'
  | 'validating'
  | 'ready_to_convert'
  | 'converted';

export const IDEA_STAGES_V5: IdeaStageV5[] = [
  'spark',
  'framing',
  'exploring',
  'structuring',
  'validating',
  'ready_to_convert',
  'converted',
];

export const IDEA_STAGE_LABELS: Record<IdeaStageV5, { en: string; pl: string }> = {
  spark: { en: 'Spark', pl: 'Iskra' },
  framing: { en: 'Framing', pl: 'Ramowanie' },
  exploring: { en: 'Exploring', pl: 'Eksploracja' },
  structuring: { en: 'Structuring', pl: 'Strukturyzacja' },
  validating: { en: 'Validating', pl: 'Walidacja' },
  ready_to_convert: { en: 'Ready to convert', pl: 'Gotowy do konwersji' },
  converted: { en: 'Converted', pl: 'Skonwertowany' },
};

export const IDEA_STAGE_COLORS: Record<IdeaStageV5, string> = {
  spark: 'from-amber-400/20 to-amber-400/10 text-amber-600 dark:text-amber-400',
  framing: 'from-sky-400/20 to-blue-400/10 text-sky-600 dark:text-sky-400',
  exploring: 'from-violet-400/20 to-violet-400/10 text-violet-600 dark:text-violet-400',
  structuring: 'from-blue-400/20 to-emerald-400/10 text-blue-600 dark:text-blue-400',
  validating: 'from-indigo-400/20 to-blue-400/10 text-indigo-600 dark:text-indigo-400',
  ready_to_convert: 'from-emerald-400/20 to-green-400/10 text-emerald-600 dark:text-emerald-400',
  converted: 'from-slate-400/20 to-gray-400/10 text-slate-600 dark:text-slate-400',
};

export type IdeaStageListBucket = 'spark' | 'incubating' | 'shaping' | 'ready' | 'promoted';

const LEGACY_STAGE_MAP: Record<string, IdeaStageV5> = {
  seed: 'spark',
  spark: 'spark',
  incubating: 'framing',
  shaping: 'structuring',
  ready: 'ready_to_convert',
  promoted: 'converted',
  idea: 'spark',
  exploring: 'exploring',
  validated: 'validating',
  ready_to_convert: 'ready_to_convert',
  converted: 'converted',
  framing: 'framing',
  structuring: 'structuring',
  validating: 'validating',
};

export function normalizeStageToV5(raw?: string | null): IdeaStageV5 {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  return LEGACY_STAGE_MAP[s] || 'spark';
}

const V5_TO_LIST_BUCKET: Record<IdeaStageV5, IdeaStageListBucket> = {
  spark: 'spark',
  framing: 'incubating',
  exploring: 'incubating',
  structuring: 'shaping',
  validating: 'ready',
  ready_to_convert: 'ready',
  converted: 'promoted',
};

export function bucketIdeaStageForList(raw?: string | null): IdeaStageListBucket {
  return V5_TO_LIST_BUCKET[normalizeStageToV5(raw)];
}

// ── List-facing stage labels (2026-07-24 SSOT unification) ─────────────────
// The Ideas list shows the coarse 5-bucket stage (`IdeaStageListBucket`), not
// the fine-grained V5 stage the right-side panel shows (`IDEA_STAGE_LABELS`
// above). Those are two different granularities by design — see
// `V5_TO_LIST_BUCKET` — so they will never read byte-identical to the panel.
// Within the list itself, though, every renderer (badge/filter/preview) must
// use this ONE dictionary instead of its own inline copy — before this, three
// near-duplicate dicts had drifted apart on Polish diacritics ("Rosnie" vs
// "Rośnie", "Ksztaltuje" vs "Kształtuje się").
export const IDEA_STAGE_BUCKET_LABELS: Record<IdeaStageListBucket, { en: string; pl: string }> = {
  spark: { en: 'Spark', pl: 'Iskra' },
  incubating: { en: 'Growing', pl: 'Rośnie' },
  shaping: { en: 'Shaping', pl: 'Kształtuje się' },
  ready: { en: 'Ready', pl: 'Gotowy' },
  promoted: { en: 'Promoted', pl: 'Promowany' },
};

export function getIdeaStageBucketLabel(bucket: IdeaStageListBucket, isPolish: boolean): string {
  const entry = IDEA_STAGE_BUCKET_LABELS[bucket];
  return isPolish ? entry.pl : entry.en;
}

// ── Entry types ─────────────────────────────────────────────────────────────
export type IdeaStartMode = 'describe_with_ai' | 'blank_canvas' | 'use_template';

export type IdeaStructuredBrief = {
  problem?: string;
  currentState?: string;
  desiredOutcome?: string;
  constraints?: string;
  evidenceNotes?: string;
};

/**
 * Pre-built {nodes, edges} graph handed off from a backend skeleton builder
 * (chat `generate_deliverable` mind-map / process-flow / table / whiteboard
 * branches — see `server/src/services/ai/mindmapSkeleton.ts` and
 * `canvasToolSkeletons.ts`). Same ReactFlow-like shape the idea-workspace
 * graph runtime and `POST /my-ideas/:id/map/sync` already accept.
 */
export type IdeaWorkspaceSeedGraph = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  /**
   * Optional canvas extensions the backend skeleton carries alongside the graph.
   * Currently `table.columns` — custom Ideas-Table columns requested in the chat
   * prompt (e.g. ROI / Budżet PLN / Ryzyko). Merged into the persisted map's
   * extensions so those columns render filled (values live on node.data[key]).
   */
  extensions?: Record<string, unknown> | null;
};

export type IdeaWorkspaceSeedIntent = {
  startMode: IdeaStartMode;
  seedText: string;
  preferredSystem?: CanvasToolType | null;
  templateId?: string | null;
  popularStartId?: string | null;
  popularStartLabel?: string | null;
  structuredBrief?: IdeaStructuredBrief | null;
  source?: 'seed_surface' | 'chat_handoff';
  /**
   * When present, the workspace hydrates this graph directly instead of
   * starting a fresh AI kickoff — the backend already built a real skeleton
   * from the user's chat intent, so re-deriving from `seedText` would waste
   * it and produce a different result than what the chat message described.
   */
  seedGraph?: IdeaWorkspaceSeedGraph | null;
};

export type IdeaWorkspaceCreationPayload = {
  title?: string;
  body?: string;
  tags?: string[];
  sourceType?: string | null;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
};

function nonEmpty(value?: string | null): string | null {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

export function normalizePreferredSystem(system?: string | null): CanvasToolType | null {
  if (
    system === 'mindmap' ||
    system === 'process_flow' ||
    system === 'table' ||
    system === 'whiteboard'
  ) {
    return system;
  }
  return null;
}

export function composeIdeaBodyFromSeedIntent(intent?: IdeaWorkspaceSeedIntent | null): string {
  if (!intent) return '';

  const sections: string[] = [];
  const seedText = nonEmpty(intent.seedText);
  if (seedText) sections.push(seedText);

  if (intent.popularStartLabel) {
    sections.push(`Intent: ${intent.popularStartLabel}`);
  }

  const brief = intent.structuredBrief;
  if (brief) {
    const rows = [
      ['Problem', brief.problem],
      ['Current state', brief.currentState],
      ['Desired outcome', brief.desiredOutcome],
      ['Constraints', brief.constraints],
      ['Evidence / notes', brief.evidenceNotes],
    ]
      .map(([label, value]) => {
        const normalized = nonEmpty(value);
        return normalized ? `${label}: ${normalized}` : null;
      })
      .filter(Boolean) as string[];

    if (rows.length > 0) {
      sections.push(['Structured brief', ...rows].join('\n'));
    }
  }

  return sections.join('\n\n').trim();
}

export function deriveIdeaTitleFromSeedIntent(
  intent?: IdeaWorkspaceSeedIntent | null,
  fallback = 'New challenge'
): string {
  const primary =
    nonEmpty(intent?.seedText)?.split('\n')[0] || nonEmpty(intent?.popularStartLabel) || fallback;

  return primary.slice(0, 120);
}
