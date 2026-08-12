/**
 * Step 1/7 — Source (OWN-FIN-021 point 1): the valuation must point at an exact, APPROVED,
 * immutable Baseline/Scenario version — never "latest" — and lineage must PROVE it.
 *
 * ★ HONEST GAP (see PKG_H_VALUATION_report.md): at base SHA 9604652e27 there is no HTTP endpoint
 * anywhere under `/api/v8/finance-v2/*` that CREATES the lineage edge this step needs to display
 * (`lineageService.insertEdge()` is called only from test files — grep-verified, zero route
 * callers). `POST /valuation/variants/:id/compute/dcf` fails with `NO_VALUATION_SOURCE_EDGE` when
 * this edge is missing. This step therefore RENDERS the edge if one already exists (read-only,
 * via `GET /versions/:id/lineage`) and otherwise says so plainly — it does not pretend a picker
 * that writes anywhere would work.
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

export function SourceStep(props: SourceStepProps): React.ReactElement {
  const { businessVersionId, variant, lineage } = props;
  const sourceEdge = lineage?.ancestors[0] ?? null;

  return (
    <div className="max-w-2xl space-y-4" data-testid="valuation-source-step">
      <h2 className="text-sm font-semibold text-c-text">Źródło wyceny</h2>
      <p className="text-xs text-c-text-muted">
        Ta wersja wyceny (<span className="font-mono">{businessVersionId}</span>
        {variant ? `, wariant „${variant.name}"` : ''}) musi wskazywać dokładną, zatwierdzoną wersję Baseline/Scenario
        — nigdy „najnowszą". Poniżej pokazujemy realne powiązanie z rejestru pochodzenia (lineage), nie deklarację.
      </p>

      {lineage === null && (
        <p className="text-xs text-c-text-muted" data-testid="source-step-loading">
          Wczytywanie powiązania źródła…
        </p>
      )}

      {lineage && sourceEdge && (
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4" data-testid="source-edge-present">
          <p className="text-sm text-c-text">
            Powiązano z wersją źródłową <span className="font-mono">{sourceEdge.sourceVersionId}</span> (
            {financeArtifactTypeLabel(sourceEdge.sourceArtifactType)})
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-c-text-muted">
            <dt>Typ transformacji</dt>
            <dd className="text-c-text">{financeLineageTransformationKindLabel(sourceEdge.transformationKind)}</dd>
            <dt>Hash migawki założeń</dt>
            <dd className="font-mono text-c-text">{sourceEdge.assumptionSnapshotHash ?? '—'}</dd>
            <dt>Compute run</dt>
            <dd className="font-mono text-c-text">{sourceEdge.computeRunId ?? '—'}</dd>
            <dt>Utworzono</dt>
            <dd className="text-c-text">{sourceEdge.createdAt}</dd>
          </dl>
        </div>
      )}

      {lineage && !sourceEdge && (
        <div className="rounded-xl border border-c-warning/30 bg-c-warning/10 p-4" data-testid="source-edge-missing">
          <p className="text-sm font-medium text-c-text">Brak powiązania ze źródłem</p>
          <p className="mt-1 text-xs text-c-text-muted">
            Ten wariant nie ma dziś zapisanego powiązania (lineage edge) z żadną wersją Baseline/Scenario. Obliczenie
            DCF/FCFF zwróci błąd <span className="font-mono">NO_VALUATION_SOURCE_EDGE</span>, dopóki powiązanie nie
            powstanie. W tym pakiecie (B3, baza {'​'}9604652e27) nie istnieje endpoint tworzący to powiązanie —
            zgłoszone jako luka w raporcie odbiorowym, nie naprawione tutaj (poza allowlistą tego pakietu).
          </p>
        </div>
      )}
    </div>
  );
}

export default SourceStep;
