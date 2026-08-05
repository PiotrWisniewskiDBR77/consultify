import React from 'react';

export interface TrustPanelProps {
  bundle?: unknown;
  isCompact?: boolean;
  isRtl?: boolean;
  showOperatorDetail?: boolean;
  messageId?: string | null;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

function formatLabel(value: unknown): string {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function formatConfidence(value: unknown): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

/**
 * M01-P04B (GF-CHAT-08, coverage) — the single authoritative "is this answer
 * grounded" check the UI is allowed to trust. An answer is grounded ONLY when
 * it has at least one citation AND the claim↔citation coverage check (when
 * present) did not fail. Deliberately conservative: `citationsCount <= 0`
 * (or missing) is NEVER grounded, and a `coverage.passesPolicy === false`
 * downgrades an otherwise-cited answer — a response must not read as
 * "grounded" just because SOME citation exists while its actual claims are
 * uncited. This is the function the M01-P04B negative control (c) exercises:
 * feed it a bundle with `citationsCount: 0` and assert `false`.
 */
export function isAnswerGrounded(
  data: {
    citationsCount?: unknown;
    coverage?: { passesPolicy?: boolean } | null;
  } | null
): boolean {
  if (!data) return false;
  const citationsCount = typeof data.citationsCount === 'number' ? data.citationsCount : 0;
  if (citationsCount <= 0) return false;
  if (data.coverage && data.coverage.passesPolicy === false) return false;
  return true;
}

export const TrustPanel: React.FC<TrustPanelProps> = ({
  bundle,
  isCompact = false,
  isRtl = false,
  showOperatorDetail = false,
}) => {
  const data = asRecord(bundle);
  if (!data) return null;

  const sourceClasses = Array.isArray(data.sourceClasses) ? data.sourceClasses : [];
  const tokens = asRecord(data.tokens);
  const sourceSummary = asRecord(data.sourceLedgerSummary);
  const coverage = asRecord(data.coverage);
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
  const routingTrace = data.routingTrace;
  const confidence = formatConfidence(data.confidence);
  const grounded = isAnswerGrounded(data as { citationsCount?: unknown; coverage?: any });

  return (
    <details
      className={`rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 ${
        isCompact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
      data-testid="trust-panel"
    >
      <summary className="cursor-pointer select-none font-medium">
        Why this answer? Trust details
      </summary>
      <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-950">
            Model: {data.model || 'unknown'}
          </span>
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-950">
            Provider: {data.provider || 'unknown'}
          </span>
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-950">
            Tier: {data.tier || 'default'}
          </span>
          {confidence && (
            <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-950">
              Confidence: {confidence}
            </span>
          )}
          {/* M01-P04B (GF-CHAT-08, coverage): an explicit grounded/not-grounded
              signal — the previous state had no visible indicator when an
              answer carried zero citations (or failed claim coverage) beyond
              a since-suppressed TrustBadge "No cited sources" chip. */}
          <span
            data-testid="trust-panel-grounded"
            data-grounded={grounded}
            className={`rounded-full px-2 py-1 font-medium ${
              grounded
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
          >
            {grounded ? 'Grounded' : 'Not grounded'}
          </span>
        </div>

        <div>
          <div className="font-medium">Source classes</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(sourceClasses.length ? sourceClasses : ['general']).map((sourceClass: unknown) => (
              <span
                key={String(sourceClass)}
                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-950"
              >
                {formatLabel(sourceClass)}
              </span>
            ))}
          </div>
        </div>

        {sourceSummary && (
          <div>
            Sources used: {sourceSummary.usedCount ?? 0}; blocked: {sourceSummary.blockedCount ?? 0}
          </div>
        )}

        {coverage && typeof coverage.totalClaims === 'number' && coverage.totalClaims > 0 && (
          <div data-testid="trust-panel-coverage">
            Claim coverage: {coverage.citedClaims ?? 0}/{coverage.totalClaims} cited
            {typeof coverage.coverageScore === 'number'
              ? ` (${Math.round(coverage.coverageScore * 100)}%)`
              : ''}
          </div>
        )}

        {tokens && (
          <div>
            Tokens: input {tokens.input ?? 0}, output {tokens.output ?? 0}, total{' '}
            {tokens.total ?? 0}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="text-amber-700 dark:text-amber-300">
            Warnings: {warnings.map((warning) => formatLabel(warning)).join(', ')}
          </div>
        )}

        {showOperatorDetail && routingTrace && (
          <pre className="max-h-40 overflow-auto rounded-lg bg-white p-2 text-[11px] dark:bg-slate-950">
            {JSON.stringify(routingTrace, null, 2)}
          </pre>
        )}
      </div>
    </details>
  );
};

export default TrustPanel;
