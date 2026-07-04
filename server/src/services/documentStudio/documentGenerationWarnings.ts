/**
 * Consultify Document Studio — Generation Warnings channel (A4).
 *
 * Motivation: the document-generation pipeline degrades SILENTLY today.
 * When the LLM prose call fails, `generateBlockProse` returns the
 * deterministic stubs and only logs `console.warn`. When a chart cannot
 * be rasterized, the DOCX renderer emits a "[Figure N chart placeholder
 * … rasterization fallback]" line and moves on. When the org logo cannot
 * be hydrated for a cover page, the export writes an error to the
 * manifest that nobody reads. The consultant sees a finished document and
 * has no idea it was produced with reduced fidelity.
 *
 * This module introduces a small, allocation-cheap collector that the
 * pipeline threads through the fallback sites. It changes NOTHING about
 * the fallback behaviour — the fallbacks still never throw and still
 * produce the same degraded output. It only RECORDS that a fallback
 * happened, so the warnings can be persisted on the artifact metadata and
 * surfaced to the user as a discreet "Generated with limitations (N)"
 * chip.
 *
 * Design contract:
 *   - The collector is OPTIONAL everywhere. Passing `undefined` is the
 *     legacy behaviour (no recording, zero overhead).
 *   - `record()` NEVER throws. A collector that fails to record must not
 *     turn a soft-degrade into a hard failure.
 *   - Warnings are plain-serializable objects so they round-trip through
 *     `metadata_json` and the export manifest without special handling.
 */

/**
 * Where in the pipeline the fallback occurred. Scopes let the FE group
 * warnings ("2 export limitations, 1 section limitation") and let the
 * export path filter to just the export-time warnings (chart / logo).
 */
export type DocumentGenerationWarningScope = 'document' | 'section' | 'block' | 'export';

/**
 * Canonical warning codes. Kept as a string union rather than an enum so
 * the type is structural (round-trips through JSON without an import) and
 * new codes can be added without a migration. The four codes below cover
 * the four silent fallbacks the A4 contract targets; the loose
 * `(string & {})` tail keeps the type open for future fallbacks without
 * forcing a type change at every recording site.
 */
export type DocumentGenerationWarningCode =
  | 'llm_prose_fallback'
  | 'citation_fallback'
  | 'chart_raster_failed'
  | 'logo_unavailable'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/**
 * A single recorded degradation event. Plain-serializable so it persists
 * verbatim in `metadata_json.generationWarnings` and in the export
 * manifest.
 */
export interface DocumentGenerationWarning {
  code: DocumentGenerationWarningCode;
  scope: DocumentGenerationWarningScope;
  /** Section the fallback affected (when scope is `section` / `block`). */
  sectionId?: string;
  /** Block the fallback affected (when scope is `block`). */
  blockId?: string;
  /** Human-readable, non-localized explanation for logs / audit. */
  message: string;
  /** ISO-8601 timestamp of when the fallback happened. */
  occurredAt: string;
}

/**
 * The collector handle threaded through the pipeline. A tiny object with
 * a single `record` method so call sites stay terse (`warnings?.record(…)`)
 * and the optional-chaining short-circuit does the "no collector → no-op"
 * work for free.
 */
export interface DocumentGenerationWarningCollector {
  record(warning: DocumentGenerationWarningInput): void;
  /** Snapshot of everything recorded so far (defensive copy). */
  list(): DocumentGenerationWarning[];
  /** Count without allocating the list. */
  size(): number;
}

/**
 * Input shape for `record` — `occurredAt` is auto-stamped when omitted so
 * call sites don't repeat `new Date().toISOString()` everywhere.
 */
export interface DocumentGenerationWarningInput {
  code: DocumentGenerationWarningCode;
  scope: DocumentGenerationWarningScope;
  sectionId?: string;
  blockId?: string;
  message: string;
  occurredAt?: string;
}

/**
 * Create a fresh in-memory collector. Cheap; allocate one per generation /
 * export run.
 */
export function createDocumentGenerationWarningCollector(): DocumentGenerationWarningCollector {
  const warnings: DocumentGenerationWarning[] = [];
  return {
    record(input: DocumentGenerationWarningInput): void {
      // Contract: recording MUST NOT throw. A malformed input degrades to
      // a best-effort push; it can never turn a soft-degrade into a crash.
      try {
        warnings.push({
          code: input.code,
          scope: input.scope,
          ...(input.sectionId ? { sectionId: input.sectionId } : {}),
          ...(input.blockId ? { blockId: input.blockId } : {}),
          message: typeof input.message === 'string' ? input.message : String(input.message),
          occurredAt:
            typeof input.occurredAt === 'string' && input.occurredAt.length > 0
              ? input.occurredAt
              : new Date().toISOString(),
        });
      } catch {
        /* never throws — the fallback it accompanies stays soft */
      }
    },
    list(): DocumentGenerationWarning[] {
      return warnings.map((w) => ({ ...w }));
    },
    size(): number {
      return warnings.length;
    },
  };
}

/**
 * Defensive normalizer for warnings loaded from persistence
 * (`metadata_json.generationWarnings`). Historical artifacts predate this
 * channel and legitimately carry no warnings; corrupt rows must never
 * crash the read path. Returns a clean `DocumentGenerationWarning[]`,
 * dropping any entry that is not a structurally-valid warning.
 */
export function normalizeGenerationWarnings(raw: unknown): DocumentGenerationWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentGenerationWarning[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.code !== 'string' || e.code.length === 0) continue;
    const scope = e.scope;
    if (scope !== 'document' && scope !== 'section' && scope !== 'block' && scope !== 'export') {
      continue;
    }
    const message = typeof e.message === 'string' ? e.message : '';
    const occurredAt =
      typeof e.occurredAt === 'string' && e.occurredAt.length > 0
        ? e.occurredAt
        : new Date(0).toISOString();
    out.push({
      code: e.code,
      scope,
      ...(typeof e.sectionId === 'string' && e.sectionId.length > 0
        ? { sectionId: e.sectionId }
        : {}),
      ...(typeof e.blockId === 'string' && e.blockId.length > 0 ? { blockId: e.blockId } : {}),
      message,
      occurredAt,
    });
  }
  return out;
}
