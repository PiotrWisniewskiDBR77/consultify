/**
 * Step 1/7 — Source (OWN-FIN-021 point 1): the valuation must point at an exact, APPROVED,
 * immutable Baseline/Scenario version — never "latest" — and lineage must PROVE it.
 *
 * ★ HONEST GAP (see PKG_H_VALUATION_report.md): at base SHA 9604652e27 there is no HTTP endpoint
 * anywhere under `/api/v8/finance-v2/*` that CREATES the lineage edge this step needs to display
 * (`lineageService.insertEdge()` is called only from test files — grep-verified, zero route
 * callers). `POST /valuation/variants/:id/compute/dcf` fails with `NO_VALUATION_SOURCE_EDGE` when
 * this edge is missing. This step therefore RENDERS the edge(s) if any already exist (read-only,
 * via `GET /versions/:id/lineage`) and otherwise says so plainly — it does not pretend a picker
 * that writes anywhere would work.
 *
 * ★ FIXC (martwa przestrzeń, gate-e): `getAncestors()` (`lineageService.ts`) walks the FULL
 * lineage chain with a recursive CTE (`WITH RECURSIVE ancestors ... JOIN ancestors a ON
 * e.target_version_id = a.source_version_id`, depth up to 50) — a real valuation typically
 * descends from Statement Pack -> Baseline -> Scenario, i.e. `lineage.ancestors` legitimately
 * holds MULTIPLE edges. This step previously read only `lineage.ancestors[0]`, silently dropping
 * every edge past the first — real, already-fetched data that never reached the screen. That is
 * what the dead-space audit (`AP_MOUNT_report.md` §"Audyt martwej przestrzeni") had misread as
 * "only 4 lineage facts exist to show": the facts existed, the component just never rendered
 * them. Fixed by mapping over the whole array — see `FIXC_LAYOUT_report.md`.
 *
 * ★ FIXC also drops the `max-w-5xl` cap this step still carried (same defect class as the six
 * sibling steps fixed in `e36d275410`, just not caught in that pass because it only measured
 * width, and Source's remaining shortfall after that fix was mostly HEIGHT, not width) — a
 * multi-card lineage chain benefits from the full available width for its 4-column fact grid,
 * same as the other six steps already do at `max-w-5xl`.
 */
import React from 'react';

import {
  financeArtifactTypeLabel,
  financeLineageTransformationKindLabel,
  type ValuationLineageDto,
  type ValuationVariantDto,
} from '@/services/api/financeV2.types';

export interface SourceStepProps {
  businessVersionId: string;
  variant: ValuationVariantDto | null;
  lineage: ValuationLineageDto | null;
}

/**
 * `edgeType` (`ValuationLineageEdgeType = string`, financeV2.types.ts) is open-ended free text —
 * no dedicated label helper exists for it anywhere in the codebase (the one other renderer,
 * `RelatedArtifactsSection.tsx`, shows it raw too). Still, never paint a bare SCREAMING_SNAKE_CASE
 * token — apply the SAME readable fallback `financeLineageTransformationKindLabel` already uses
 * for an unrecognized `transformationKind`, so `VALUATION_SOURCE`/`derived_from` both render as
 * plain sentence-case text instead of a raw code.
 */
function formatFreeformLineageCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function SourceStep(props: SourceStepProps): React.ReactElement {
  const { businessVersionId, variant, lineage } = props;
  // ★ FIXC: full chain, chronological (root/oldest first) — the DB query has no ORDER BY of its
  // own (`SELECT DISTINCT ... FROM ancestors`, see `lineageService.ts`), so this component owns
  // the display order rather than depending on incidental SQL row order.
  const sourceEdges = lineage
    ? [...lineage.ancestors].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  const immediateEdge = sourceEdges[sourceEdges.length - 1] ?? null;

  return (
    <div className="w-full space-y-4" data-testid="valuation-source-step">
      <h2 className="text-sm font-semibold text-c-text">Źródło wyceny</h2>
      <p className="text-xs text-c-text-muted">
        Ta wersja wyceny (<span className="font-mono">{businessVersionId}</span>
        {variant ? `, wariant „${variant.name}"` : ''}) musi wskazywać dokładną, zatwierdzoną wersję
        Baseline/Scenario — nigdy „najnowszą". Poniżej pokazujemy realny, pełny łańcuch pochodzenia
        (lineage) z rejestru, nie deklarację.
      </p>

      {lineage === null && (
        <p className="text-xs text-c-text-muted" data-testid="source-step-loading">
          Wczytywanie powiązania źródła…
        </p>
      )}

      {lineage && sourceEdges.length > 0 && (
        <div className="space-y-3" data-testid="source-edge-present">
          <p className="text-sm text-c-text">
            Powiązano z wersją źródłową{' '}
            <span className="font-mono">{immediateEdge?.sourceVersionId}</span> (
            {immediateEdge ? financeArtifactTypeLabel(immediateEdge.sourceArtifactType) : '—'})
            przez łańcuch {sourceEdges.length}{' '}
            {sourceEdges.length === 1 ? 'powiązania' : 'powiązań'} pochodzenia.
          </p>
          {sourceEdges.map((edge, index) => (
            <div
              key={edge.edgeId}
              className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
              data-testid={`source-edge-${edge.edgeId}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                Krok {index + 1}/{sourceEdges.length} ·{' '}
                {financeArtifactTypeLabel(edge.sourceArtifactType)} →{' '}
                {financeArtifactTypeLabel(edge.targetArtifactType)}
              </p>
              <p className="mt-1 text-sm text-c-text">
                <span className="font-mono">{edge.sourceVersionId}</span> →{' '}
                <span className="font-mono">{edge.targetVersionId}</span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-c-text-muted md:grid-cols-4">
                <dt>Typ powiązania</dt>
                <dd className="text-c-text">{formatFreeformLineageCode(edge.edgeType)}</dd>
                <dt>Typ transformacji</dt>
                <dd className="text-c-text">
                  {financeLineageTransformationKindLabel(edge.transformationKind)}
                </dd>
                <dt>Hash migawki założeń</dt>
                <dd className="font-mono text-c-text">{edge.assumptionSnapshotHash ?? '—'}</dd>
                <dt>Compute run</dt>
                <dd className="font-mono text-c-text">{edge.computeRunId ?? '—'}</dd>
                <dt>Autor</dt>
                <dd className="text-c-text">{edge.authorId ?? '—'}</dd>
                <dt>Utworzono</dt>
                <dd className="text-c-text">{edge.createdAt}</dd>
                <dt>ID powiązania</dt>
                <dd className="font-mono text-c-text">{edge.edgeId}</dd>
              </dl>
            </div>
          ))}
        </div>
      )}

      {lineage && sourceEdges.length === 0 && (
        <div
          className="rounded-xl border border-c-warning/30 bg-c-warning/10 p-4"
          data-testid="source-edge-missing"
        >
          <p className="text-sm font-medium text-c-text">Brak powiązania ze źródłem</p>
          <p className="mt-1 text-xs text-c-text-muted">
            Ten wariant nie ma dziś zapisanego powiązania (lineage edge) z żadną wersją
            Baseline/Scenario. Obliczenie DCF/FCFF zwróci błąd{' '}
            <span className="font-mono">NO_VALUATION_SOURCE_EDGE</span>, dopóki powiązanie nie
            powstanie. W tym pakiecie (B3, baza {'​'}9604652e27) nie istnieje endpoint tworzący to
            powiązanie — zgłoszone jako luka w raporcie odbiorowym, nie naprawione tutaj (poza
            allowlistą tego pakietu).
          </p>
        </div>
      )}
    </div>
  );
}

export default SourceStep;
