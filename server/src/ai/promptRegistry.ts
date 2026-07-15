// NOTE: to NIE jest mózg promptów narzędzi. Prompty per-tool żyją w
// src/hooks/discovery/toolAi/promptRegistry.ts (build*ConclusionPrompt).
// Ten plik = tylko indeks meta.
/**
 * AI Prompt Registry — index of prompt assets used across Consultify (O5.5).
 *
 * WHAT THIS IS: a lightweight, static INDEX. It does not own or duplicate
 * prompt text — each entry points at the real source (file + export/const)
 * so the "AI brain" is a discoverable, versioned, owned resource instead of
 * scattered strings nobody tracks. When you change a listed prompt, bump its
 * `version` and update `lastReviewed` here; do not fork the prompt text into
 * this file.
 *
 * WHAT THIS IS NOT:
 *  - Not a rewrite or copy of prompt bodies — see `path`/`exportName` to find
 *    the actual source.
 *  - Not the V8 "Prompt Operating System" runtime (presets, release bundles,
 *    canary rollout, eval gates) — that is a separate, DB-backed governance
 *    layer. See server/src/services/v8/promptOsRuntimeService.ts and
 *    docs/product/PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md for
 *    that system. This registry is the lightweight, code-level counterpart
 *    for prompts that live directly in source rather than in the V8 preset
 *    store.
 *  - Not exhaustive of every ad-hoc prompt string in the codebase — it
 *    covers the prompt assets that materially shape user-facing AI output
 *    (persona, section/tool prompts, deliverable generation, initiative
 *    doctrine). Extend it as new prompt surfaces are added or discovered.
 *
 * OWNERSHIP: `owner` is the team/role accountable for the prompt's quality
 * and behavior, not necessarily the original author. Default owner for
 * consulting-voice prompts is "content-quality" per Paczka1 #9.
 *
 * RUNTIME ACCESS (O5.5 mechanics, added 2026-07-14):
 *  - `getPrompt(id, inlineFallback)` — backwards-compatible adapter. Entries
 *    that centralize a live template (via `resolve`) return it; everything
 *    else returns the caller's own inline prompt. This lets callers opt into
 *    the registry ONE at a time (`getPrompt('id', () => INLINE)`) without a
 *    big-bang rewrite of every prompt site.
 *  - `checksum` + `verifyPromptChecksum(id)` — drift detection. `checksum` is
 *    the sha256 snapshot taken at `lastReviewed`; if the live source text
 *    diverges, verification reports `drifted` so review can be re-triggered.
 */

import { createHash } from 'crypto';

import {
  CARD_CONTENT_FORMULA_A3_FULL,
  CARD_CONTENT_FORMULA_A3_LITE,
} from '../services/initiative/cardContentFormulaPrompt.js';

export type PromptModule =
  | 'persona'
  | 'initiative-generation'
  | 'deliverables-doc'
  | 'deliverables-sheet'
  | 'discovery-tools'
  | 'v8-prompt-os';

export type PromptOwner =
  | 'content-quality'
  | 'initiatives'
  | 'deliverables'
  | 'discovery'
  | 'v8-platform';

export interface PromptAsset {
  /** Stable identifier for this prompt asset. Use kebab-case, module-prefixed. */
  id: string;
  /** Functional area this prompt belongs to. */
  module: PromptModule;
  /** Semver-ish version. Bump on any meaningful behavior/tone change. */
  version: string;
  /** Team/role accountable for this prompt's quality and review cadence. */
  owner: PromptOwner;
  /** Repo-relative path to the file that actually holds the prompt text. */
  path: string;
  /** Exported symbol / function / const name inside `path`, when applicable. */
  exportName?: string;
  /** One-line description of what this prompt drives. */
  description: string;
  /** Languages the prompt is authored/maintained in. */
  languages: Array<'pl' | 'en' | 'de' | 'es' | 'ja' | 'ar'>;
  /** ISO date this entry was last confirmed to match the source. */
  lastReviewed: string;
  /**
   * Optional live-template loader. Present only for prompts small/stable enough
   * to centralize their body here (lightweight exported consts — NOT heavy
   * runtime prompt builders). When present, `getPrompt(id)` returns this text
   * and `verifyPromptChecksum(id)` can detect source drift. Absent for
   * pointer-only entries, which remain index metadata (path/exportName).
   */
  resolve?: () => string;
  /**
   * sha256 snapshot (prefixed `sha256:`) of the resolved template as of
   * `lastReviewed`. Used by `verifyPromptChecksum` to flag drift. Only
   * meaningful alongside `resolve`.
   */
  checksum?: string;
}

/**
 * The registry. Keep entries sorted by module, then id.
 * Add a new entry whenever a new prompt surface materially shapes AI output.
 */
export const PROMPT_REGISTRY: PromptAsset[] = [
  // -------------------------------------------------------------------------
  // Persona — Teresa's core identity, response contract, challenge mode.
  // -------------------------------------------------------------------------
  {
    id: 'persona-core',
    module: 'persona',
    version: '3.1',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildCorePersona',
    description:
      "Teresa's core identity: BCG-class consultant + PM + financial analyst, consultant register.",
    languages: ['pl', 'en', 'de', 'es', 'ja', 'ar'],
    lastReviewed: '2026-07-03',
  },
  {
    id: 'persona-response-discipline',
    module: 'persona',
    version: '3.1',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildResponseDiscipline',
    description:
      'Output contract: answer-first (BLUF), WHAT IT MEANS -> WHAT TO DO -> EXPECTED EFFECT structure, anti-chatbot-filler rules.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-07-03',
  },
  {
    id: 'persona-consulting-frameworks',
    module: 'persona',
    version: '3.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildConsultingFrameworks',
    description: 'Pyramid Principle, MECE, Issue Tree, 80/20 — applied in strategic analyses.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'persona-challenge-mode',
    module: 'persona',
    version: '3.1',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildChallengeInstructions',
    description:
      "Strategic challenge mode — when Teresa must push back on the client's data/claims.",
    languages: ['pl', 'en'],
    lastReviewed: '2026-07-03',
  },
  {
    id: 'persona-citations',
    module: 'persona',
    version: '3.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildCitationInstructions',
    description:
      'Inline citation rules — cite only system-provided sources, no fabricated markers.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'persona-artifacts',
    module: 'persona',
    version: '3.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildArtifactInstructions',
    description:
      'When/how to wrap chat output as downloadable artifacts (doc, table, diagram, matrix...).',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'persona-agency-model',
    module: 'persona',
    version: '3.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildAgencyModel',
    description:
      'Copilot-not-autopilot contract: propose vs fake-execute, honesty about reach, routing to modules.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'persona-response-style-directives',
    module: 'persona',
    version: '3.1',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildResponseStyleDirective',
    description:
      'User-selectable answer modes (normal/concise/executive/analyst/formal/coach/professional/friendly).',
    languages: ['pl', 'en'],
    lastReviewed: '2026-07-03',
  },
  {
    id: 'persona-org-retrieval-guidance',
    module: 'persona',
    version: '1.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'buildOrgRetrievalGuidance',
    description:
      'Guidance for search_org_notes/search_insights/get_initiative tools (gated by ENABLE_TERESA_RETRIEVAL).',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },

  // -------------------------------------------------------------------------
  // Initiative generation — doctrine + adversarial review prompts.
  // -------------------------------------------------------------------------
  {
    id: 'initiative-doctrine-system-prompt',
    module: 'initiative-generation',
    version: '1.0',
    owner: 'initiatives',
    path: 'server/src/services/initiativeGenerationService.ts',
    exportName: 'DOCTRINE_SYSTEM_PROMPT / DOCTRINE_SYSTEM_PROMPT_EN',
    description:
      'McKinsey-grade doctrine system prompt for generating initiative section content (PL/EN pair).',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'initiative-reviewer-system-prompt',
    module: 'initiative-generation',
    version: '1.0',
    owner: 'initiatives',
    path: 'server/src/services/initiativeGenerationService.ts',
    exportName: 'REVIEWER_SYSTEM_PROMPT_PL / REVIEWER_SYSTEM_PROMPT_EN',
    description:
      'Adversarial content-quality reviewer prompt, graded against CARD_CONTENT_FORMULA and INITIATIVE_FORMULA (PL/EN pair).',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'initiative-section-ai-prompt-template',
    module: 'initiative-generation',
    version: 'db-managed',
    owner: 'initiatives',
    path: 'server/src/services/initiativeSectionTypeService.ts',
    exportName: 'ai_prompt_template (column, initiative_section_types table)',
    description:
      'Per-section-type prompt templates stored in the DB (initiative_section_types.ai_prompt_template), seeded via migrations 529/530/539/540/541/542.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },

  {
    id: 'initiative-card-formula-a3-lite',
    module: 'initiative-generation',
    version: '1.0',
    owner: 'content-quality',
    path: 'server/src/services/initiative/cardContentFormulaPrompt.ts',
    exportName: 'CARD_CONTENT_FORMULA_A3_LITE',
    description:
      'CARD_CONTENT_FORMULA §A3 (lite) — quality doctrine fragment for LIGHT initiative candidates (title/description/hypothesis only). Centralized here, live-resolvable + checksummed.',
    languages: ['pl'],
    lastReviewed: '2026-07-14',
    resolve: () => CARD_CONTENT_FORMULA_A3_LITE,
    checksum: 'sha256:f34e84b369db31323214f0c171cd2f1c0aa3e7f347496a4f4834dffc9f3eb027',
  },
  {
    id: 'initiative-card-formula-a3-full',
    module: 'initiative-generation',
    version: '1.0',
    owner: 'content-quality',
    path: 'server/src/services/initiative/cardContentFormulaPrompt.ts',
    exportName: 'CARD_CONTENT_FORMULA_A3_FULL',
    description:
      'CARD_CONTENT_FORMULA §A3 (full) — quality doctrine fragment for FULL initiative cards (KPI/RAID/scope/milestones/sizing). Centralized here, live-resolvable + checksummed.',
    languages: ['pl'],
    lastReviewed: '2026-07-14',
    resolve: () => CARD_CONTENT_FORMULA_A3_FULL,
    checksum: 'sha256:18300fe5cf746cc94314d6a4d1bf0f638f891ef7969cdb21269fd9b2d250e0e6',
  },

  // -------------------------------------------------------------------------
  // Deliverables generation — doc/sheet runtime prompts.
  // -------------------------------------------------------------------------
  {
    id: 'deliverables-doc-system-prompt',
    module: 'deliverables-doc',
    version: '1.0',
    owner: 'deliverables',
    path: 'server/src/services/deliverables/docGenerationRuntime.ts',
    exportName: 'systemPromptBase (planDoc)',
    description: 'System prompt driving document-from-chat generation (outline + section prose).',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },
  {
    id: 'deliverables-sheet-system-prompt',
    module: 'deliverables-sheet',
    version: '1.0',
    owner: 'deliverables',
    path: 'server/src/services/deliverables/docGenerationRuntime.ts',
    exportName: 'sheetSystemBase (startSheet)',
    description: 'System prompt driving sheet/table-from-chat generation.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
  },

  // -------------------------------------------------------------------------
  // Discovery tools — per-tool AI suggestion/summary prompts (front-end).
  // -------------------------------------------------------------------------
  {
    id: 'discovery-tool-suggestion-prompts',
    module: 'discovery-tools',
    version: '1.0',
    owner: 'discovery',
    path: 'src/hooks/discovery/toolAi/promptRegistry.ts',
    exportName: 'getToolSuggestionPrompt',
    description:
      'Per-step suggestion prompts for Discovery tools (SWOT, Porter Five Forces, Ansoff Growth Paths, Portfolio Priority, Risk & Uncertainty, operational tools).',
    languages: ['en'],
    lastReviewed: '2026-07-03',
  },
  {
    id: 'discovery-tool-summary-prompts',
    module: 'discovery-tools',
    version: '1.0',
    owner: 'discovery',
    path: 'src/hooks/discovery/toolAi/promptRegistry.ts',
    exportName: 'getToolSummaryPrompt',
    description:
      'Consulting-grade closing summary prompts for Discovery tools (executive summary, moves, initiatives, output candidates).',
    languages: ['en'],
    lastReviewed: '2026-07-03',
  },

  // -------------------------------------------------------------------------
  // V8 Prompt Operating System — pointer only. Governed elsewhere.
  // -------------------------------------------------------------------------
  {
    id: 'v8-prompt-os-runtime',
    module: 'v8-prompt-os',
    version: 'see-v8-ssot',
    owner: 'v8-platform',
    path: 'server/src/services/v8/promptOsRuntimeService.ts',
    exportName: 'n/a — DB-backed presets/release-bundles/canary/rollback',
    description:
      'Pointer to the separate V8 Prompt OS governance runtime (presets, eval gates, canary, rollback). Not managed by this lightweight registry — see docs/product/PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-07-03',
  },
];

/** Look up a single prompt asset by id. Returns undefined if not found. */
export function getPromptAsset(id: string): PromptAsset | undefined {
  return PROMPT_REGISTRY.find((entry) => entry.id === id);
}

/** List all prompt assets belonging to a module. */
export function getPromptAssetsByModule(module: PromptModule): PromptAsset[] {
  return PROMPT_REGISTRY.filter((entry) => entry.module === module);
}

/** List all prompt assets owned by a given owner/team. */
export function getPromptAssetsByOwner(owner: PromptOwner): PromptAsset[] {
  return PROMPT_REGISTRY.filter((entry) => entry.owner === owner);
}

/** Defensive copy of the full registry (for admin/debug surfaces). */
export function getAllPromptAssets(): PromptAsset[] {
  return [...PROMPT_REGISTRY];
}

// ---------------------------------------------------------------------------
// O5.5 runtime mechanics — getPrompt adapter + checksum drift detection.
// ---------------------------------------------------------------------------

/** sha256 of `text`, prefixed `sha256:`. Pure — same input, same output. */
export function computePromptChecksum(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

/**
 * Backwards-compatible prompt accessor. Returns the registry-managed template
 * for `id` when the entry centralizes one (`resolve`), otherwise the caller's
 * own `inlineFallback` (string or lazy thunk). Returns `undefined` only when
 * neither a managed template nor a fallback is available.
 *
 * This is the adapter that lets a caller migrate a single prompt site onto the
 * registry without rewriting every other site:
 *   const prompt = getPrompt('initiative-card-formula-a3-lite', () => LOCAL);
 */
export function getPrompt(
  id: string,
  inlineFallback?: string | (() => string)
): string | undefined {
  const entry = getPromptAsset(id);
  if (entry?.resolve) {
    return entry.resolve();
  }
  if (typeof inlineFallback === 'function') {
    return inlineFallback();
  }
  return inlineFallback;
}

export type PromptChecksumStatus = 'ok' | 'drifted' | 'unverifiable';

export interface PromptChecksumResult {
  id: string;
  status: PromptChecksumStatus;
  /** sha256 recorded on the entry (snapshot at lastReviewed). */
  expected?: string;
  /** sha256 recomputed from the live resolved template. */
  actual?: string;
}

/**
 * Compare an entry's stored `checksum` against the live `resolve()` output.
 *  - `ok`           — live template matches the reviewed snapshot.
 *  - `drifted`      — live template changed since review (re-review needed).
 *  - `unverifiable` — no entry, or entry has no resolve/checksum to compare.
 */
export function verifyPromptChecksum(id: string): PromptChecksumResult {
  const entry = getPromptAsset(id);
  if (!entry || !entry.resolve || !entry.checksum) {
    return { id, status: 'unverifiable' };
  }
  const actual = computePromptChecksum(entry.resolve());
  return {
    id,
    status: actual === entry.checksum ? 'ok' : 'drifted',
    expected: entry.checksum,
    actual,
  };
}

/** Verify every entry that carries a checksum. Cheap; safe for admin/CI use. */
export function verifyAllPromptChecksums(): PromptChecksumResult[] {
  return PROMPT_REGISTRY.filter((entry) => entry.resolve && entry.checksum).map((entry) =>
    verifyPromptChecksum(entry.id)
  );
}

/**
 * Registry summary for read-only admin surfaces. Deliberately omits prompt
 * BODIES — exposes only metadata + checksum verification status, never the
 * template text (some prompts encode proprietary consulting doctrine).
 */
export interface PromptRegistrySummaryRow {
  id: string;
  module: PromptModule;
  version: string;
  owner: PromptOwner;
  path: string;
  exportName?: string;
  description: string;
  languages: PromptAsset['languages'];
  lastReviewed: string;
  managed: boolean;
  checksumStatus: PromptChecksumStatus;
}

export function getPromptRegistrySummary(): PromptRegistrySummaryRow[] {
  return PROMPT_REGISTRY.map((entry) => {
    const managed = Boolean(entry.resolve);
    const checksumStatus: PromptChecksumStatus = entry.checksum
      ? verifyPromptChecksum(entry.id).status
      : 'unverifiable';
    return {
      id: entry.id,
      module: entry.module,
      version: entry.version,
      owner: entry.owner,
      path: entry.path,
      exportName: entry.exportName,
      description: entry.description,
      languages: entry.languages,
      lastReviewed: entry.lastReviewed,
      managed,
      checksumStatus,
    };
  });
}
