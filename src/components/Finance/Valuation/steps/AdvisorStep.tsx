/**
 * Step 6/7 — Valuation Advisor (DEC-FIN-006): runs on a fresh, PRE-APPROVAL candidate version
 * only; returns facts/hypotheses/risks/questions/actions with explicit evidence + confidence;
 * NEVER approves anything itself.
 *
 * Fact-vs-hypothesis is rendered as an explicit, always-visible label next to every finding
 * (`normalizeAdvisorFinding().isFactual`) — never left for the reader to infer from wording.
 * Findings from either response shape (`POST .../advisor/generate` camelCase or
 * `GET .../advisor` snake_case) are normalized to ONE view before rendering.
 */
import React from 'react';

import {
  BusinessVersionStatusValues,
  businessVersionStatusLabel,
  valuationAdvisorConfidenceLabel,
  type BusinessVersionStatus,
  type ValuationAdvisorFindingGeneratedDto,
  type ValuationAdvisorFindingStoredDto,
} from '@/services/api/financeV2.types';

import { groupAdvisorFindingsByKind, normalizeAdvisorFinding, type ValuationAdvisorFindingView } from '../valuationMath';

export interface AdvisorStepProps {
  findings: (ValuationAdvisorFindingGeneratedDto | ValuationAdvisorFindingStoredDto)[] | null;
  /** Advisor only runs pre-approval (DEC-FIN-006) — an APPROVED/terminal variant must show why generation is blocked, not a silently-disabled button. */
  status: string;
  onGenerate: () => Promise<void>;
}

const ADVISOR_FORBIDDEN_STATUSES = new Set(['APPROVED', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED']);

const KIND_LABELS: Record<ValuationAdvisorFindingView['outputKind'], string> = {
  FACT: 'Fakt',
  HYPOTHESIS: 'Hipoteza',
  RISK: 'Ryzyko',
  QUESTION: 'Pytanie',
  ACTION: 'Działanie',
};

/** `status` arrives as a loose `string` prop (see `AdvisorStepProps`) — label the known lifecycle statuses via the shared map, fall back to the raw value only for a truly unknown one (never crash on an unrecognized string). */
function statusLabel(status: string): string {
  return (BusinessVersionStatusValues as readonly string[]).includes(status)
    ? businessVersionStatusLabel(status as BusinessVersionStatus)
    : status;
}

export function AdvisorStep(props: AdvisorStepProps): React.ReactElement {
  const { findings, status, onGenerate } = props;
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const canGenerate = !ADVISOR_FORBIDDEN_STATUSES.has(status);

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setGenError(null);
    try {
      await onGenerate();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generowanie nie powiodło się.');
    } finally {
      setGenerating(false);
    }
  }

  const view = (findings ?? []).map(normalizeAdvisorFinding);
  const grouped = groupAdvisorFindingsByKind(view);

  return (
    <div className="max-w-5xl space-y-4" data-testid="valuation-advisor-step">
      <h2 className="text-sm font-semibold text-c-text">Doradca wyceny</h2>
      <p className="text-xs text-c-text-muted">
        Doradca odczytuje dane, formułuje fakty i hipotezy oraz wskazuje dowody — <strong>nie zatwierdza decyzji</strong>{' '}
        i nie zastępuje zatwierdzenia przez człowieka. Działa wyłącznie na świeżej, jeszcze niezatwierdzonej wersji
        kandydackiej.
      </p>

      {!canGenerate && (
        <p role="alert" className="text-xs text-c-warning" data-testid="advisor-blocked-status">
          Ta wersja ma status „{statusLabel(status)}" — Doradca nie generuje nowych wniosków dla wersji zatwierdzonych/terminalnych
          (DEC-FIN-006).
        </p>
      )}

      {genError && (
        <p role="alert" className="text-xs text-c-danger" data-testid="advisor-generate-error">
          {genError}
        </p>
      )}

      <button
        type="button"
        data-testid="advisor-generate-button"
        disabled={!canGenerate || generating}
        onClick={handleGenerate}
        className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-c-text px-4 text-xs font-semibold text-c-surface shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
      >
        {generating ? 'Generowanie…' : 'Wygeneruj wnioski Doradcy'}
      </button>

      {findings === null && (
        <p className="text-xs text-c-text-muted" data-testid="advisor-step-loading">
          Wczytywanie wniosków…
        </p>
      )}

      {findings !== null && view.length === 0 && (
        <p className="text-xs text-c-text-muted" data-testid="advisor-empty">
          Brak wygenerowanych wniosków dla tego wariantu.
        </p>
      )}

      {(Object.keys(grouped) as ValuationAdvisorFindingView['outputKind'][])
        .filter((kind) => grouped[kind].length > 0)
        .map((kind) => (
          <div key={kind} data-testid={`advisor-group-${kind}`}>
            <p className="text-xs font-semibold text-c-text">{KIND_LABELS[kind]}</p>
            <ul className="mt-1 space-y-2">
              {grouped[kind].map((f) => (
                <li key={f.id} className="rounded-lg border border-c-border-subtle bg-c-surface p-3" data-testid="advisor-finding">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${f.isFactual ? 'bg-c-text/10 text-c-text' : 'bg-c-warning/10 text-c-warning'}`}
                      data-testid="advisor-finding-factual-label"
                    >
                      {f.isFactual ? 'Fakt' : 'Hipoteza / ocena'}
                    </span>
                    {f.confidence && (
                      <span className="text-[10px] text-c-text-muted">Pewność: {valuationAdvisorConfidenceLabel(f.confidence)}</span>
                    )}
                    {f.isFrozen && <span className="text-[10px] text-c-text-muted">Zamrożone</span>}
                    {f.isStale && <span className="text-[10px] text-c-warning">Nieaktualne</span>}
                  </div>
                  <p className="mt-1 text-sm text-c-text">{f.title}</p>
                  <p className="mt-0.5 text-xs text-c-text-muted">{f.narrative}</p>
                  <p className="mt-1 text-[10px] text-c-text-muted">Dowody: {f.evidencePointerCount}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

export default AdvisorStep;
